/**
 * Pure live-event logic (date windows + Festival Points track).
 *
 * Storage-free except for the thin `readActiveFestivalProgress` wrapper, so the
 * scheduling and reward maths are unit-testable with an injected `now`. Reuses
 * the local-day helpers from the daily-streak module — both features share the
 * same "is it a new local day?" semantics.
 */
import {
  SPECIAL_EVENTS, generateMonthlyEvent, MATCH_WIN_POINTS_DAILY_CAP,
  GOAL_POINTS_MAX_PER_MATCH, ACADEMY_APPEARANCES_MAX_PER_MATCH, SIGNING_POINTS_DAILY_CAP,
  type LiveEvent, type LiveEventTier,
} from '@/config/liveEvents';
import { localDateKey, daysBetween } from '@/utils/dailyStreak';
import { readLiveEventProgress, writeLiveEventProgress, type LiveEventProgress } from '@/store/helpers/persistence';

export type { LiveEvent, LiveEventTier, LiveEventProgress };

/**
 * The live event for `now`. There is ALWAYS one: a hand-authored special
 * event when its window contains today, otherwise the deterministic monthly
 * festival for today's calendar month. Hand-authored events take precedence on
 * any date overlap, so a curated event (e.g. the World Cup) transparently
 * overrides that month's generated festival while it runs.
 *
 * Because it never returns null, festival surfaces (banner, hub, notifications)
 * can never go empty — the exact retention gap this closes. The `| null` return
 * is retained purely so legacy call-sites that still guard on null keep working.
 */
export function getActiveLiveEvent(now: Date = new Date()): LiveEvent {
  const today = localDateKey(now);
  const special = SPECIAL_EVENTS.find(e => e.start <= today && today <= e.end);
  return special ?? generateMonthlyEvent(now);
}

/**
 * The next hand-authored SPECIAL event that starts in the future, within
 * `horizonDays` (default 45). Powers a "next event starts in N days" teaser so
 * surfaces can advertise a marquee event that isn't live yet. Returns null when
 * no special event is upcoming inside the horizon (the monthly festival always
 * fills the gap, so this is purely promotional). */
export function getUpcomingSpecialEvent(
  now: Date = new Date(),
  horizonDays = 45,
): { event: LiveEvent; startsInDays: number } | null {
  const today = localDateKey(now);
  let best: { event: LiveEvent; startsInDays: number } | null = null;
  for (const e of SPECIAL_EVENTS) {
    if (e.start <= today) continue; // already started or over
    const startsIn = daysBetween(today, e.start);
    if (startsIn === null || startsIn <= 0 || startsIn > horizonDays) continue;
    if (!best || startsIn < best.startsInDays) best = { event: e, startsInDays: startsIn };
  }
  return best;
}

/** Whole days from `now` until (and including) the event's final day. 0 on the
 *  last day, negative once it's over. Null only if the dates are malformed. */
export function getEventDaysRemaining(event: LiveEvent, now: Date = new Date()): number | null {
  return daysBetween(localDateKey(now), event.end);
}

/** A blank progress record scoped to `event`. */
export function freshProgress(event: LiveEvent): LiveEventProgress {
  return { eventId: event.id, points: 0, lastCheckInDate: '', claimedTierIds: [] };
}

/** Read persisted progress for `event`, normalising a stale/other-event or
 *  missing record to a fresh one. Pure logic stays in the helpers below;
 *  this is the single storage-touching entry point. */
export function readActiveFestivalProgress(event: LiveEvent): LiveEventProgress {
  const stored = readLiveEventProgress();
  if (!stored || stored.eventId !== event.id) return freshProgress(event);
  return stored;
}

/** True when today's check-in has not yet been taken. */
export function canCheckInToday(progress: LiveEventProgress, now: Date = new Date()): boolean {
  return progress.lastCheckInDate !== localDateKey(now);
}

/** Progress after a check-in. No-op (returns the same record) if already
 *  checked in today. */
export function applyCheckIn(
  progress: LiveEventProgress,
  event: LiveEvent,
  now: Date = new Date(),
): LiveEventProgress {
  if (!canCheckInToday(progress, now)) return progress;
  return {
    ...progress,
    points: progress.points + event.checkInPoints,
    lastCheckInDate: localDateKey(now),
  };
}

/** Points a won match is worth in `event` — `derbyWinMultiplier` applies
 *  only to derby wins, and only in events that declare one. */
export function matchWinPointsFor(event: LiveEvent, isDerby: boolean): number {
  const mult = isDerby ? (event.derbyWinMultiplier ?? 1) : 1;
  return event.matchWinPoints * mult;
}

/** Add `points` as one of the day's match awards, honouring the per-day cap.
 *  No-op (same record) for zero points or once the cap is hit. */
function awardMatchPoints(progress: LiveEventProgress, points: number, now: Date): LiveEventProgress {
  if (points <= 0) return progress;
  const today = localDateKey(now);
  const count = progress.matchWinDate === today ? (progress.matchWinCount ?? 0) : 0;
  if (count >= MATCH_WIN_POINTS_DAILY_CAP) return progress;
  return {
    ...progress,
    points: progress.points + points,
    matchWinDate: today,
    matchWinCount: count + 1,
  };
}

/** Progress after a won match, honouring the per-day cap. No-op (returns the
 *  same record) once the day's cap is hit. Pure. Win points only — the full
 *  match (draws, clean sheets, goals, academy) goes through `applyMatchResult`. */
export function applyMatchWin(
  progress: LiveEventProgress,
  event: LiveEvent,
  now: Date = new Date(),
  isDerby = false,
): LiveEventProgress {
  return awardMatchPoints(progress, matchWinPointsFor(event, isDerby), now);
}

// ── content: event mechanics ──

/** What happened in the player's match, as far as a live event cares. */
export interface FestivalMatchOutcome {
  won: boolean;
  drawn: boolean;
  isDerby?: boolean;
  goalsFor: number;
  goalsAgainst: number;
  /** The player's academy graduates (`isFromYouthAcademy`) who took part. */
  academyAppearances?: number;
}

/** Festival Points one match is worth in `event`: the win (with any derby
 *  multiplier) plus whichever mechanics the event declares. Pure. */
export function matchPointsFor(event: LiveEvent, o: FestivalMatchOutcome): number {
  let points = 0;
  if (o.won) points += matchWinPointsFor(event, !!o.isDerby);
  if (o.drawn) points += event.drawPoints ?? 0;
  if (o.goalsAgainst === 0) points += event.cleanSheetPoints ?? 0;
  points += (event.goalPoints ?? 0) * Math.min(Math.max(0, o.goalsFor), GOAL_POINTS_MAX_PER_MATCH);
  points += (event.academyAppearancePoints ?? 0) * Math.min(Math.max(0, o.academyAppearances ?? 0), ACADEMY_APPEARANCES_MAX_PER_MATCH);
  return points;
}

/** Progress after a match. A match that earns nothing uses none of the day's
 *  MATCH_WIN_POINTS_DAILY_CAP awards; one that earns anything uses one. Pure. */
export function applyMatchResult(
  progress: LiveEventProgress,
  event: LiveEvent,
  outcome: FestivalMatchOutcome,
  now: Date = new Date(),
): LiveEventProgress {
  return awardMatchPoints(progress, matchPointsFor(event, outcome), now);
}

/** Progress after a completed signing, capped at SIGNING_POINTS_DAILY_CAP a
 *  day. No-op for events without `signingPoints`. Pure. */
export function applySigning(progress: LiveEventProgress, event: LiveEvent, now: Date = new Date()): LiveEventProgress {
  const points = event.signingPoints ?? 0;
  if (points <= 0) return progress;
  const today = localDateKey(now);
  const count = progress.signingDate === today ? (progress.signingCount ?? 0) : 0;
  if (count >= SIGNING_POINTS_DAILY_CAP) return progress;
  return { ...progress, points: progress.points + points, signingDate: today, signingCount: count + 1 };
}

/** The bonus mechanics `event` declares, for the Festival hub to list. */
export type EventBonus =
  | { kind: 'derby'; points: number }
  | { kind: 'draw'; points: number }
  | { kind: 'cleanSheet'; points: number }
  | { kind: 'goal'; points: number; cap: number }
  | { kind: 'academy'; points: number; cap: number }
  | { kind: 'signing'; points: number; cap: number };

export function getEventBonuses(event: LiveEvent): EventBonus[] {
  const out: EventBonus[] = [];
  if ((event.derbyWinMultiplier ?? 1) > 1) out.push({ kind: 'derby', points: matchWinPointsFor(event, true) });
  if (event.drawPoints) out.push({ kind: 'draw', points: event.drawPoints });
  if (event.cleanSheetPoints) out.push({ kind: 'cleanSheet', points: event.cleanSheetPoints });
  if (event.goalPoints) out.push({ kind: 'goal', points: event.goalPoints, cap: GOAL_POINTS_MAX_PER_MATCH });
  if (event.academyAppearancePoints) out.push({ kind: 'academy', points: event.academyAppearancePoints, cap: ACADEMY_APPEARANCES_MAX_PER_MATCH });
  if (event.signingPoints) out.push({ kind: 'signing', points: event.signingPoints, cap: SIGNING_POINTS_DAILY_CAP });
  return out;
}

/** Side-effecting: award Festival Points for the player's match, if an event
 *  is live. Safe to call from the match flow — no-op when no event is running,
 *  when the match earns nothing, or on any storage error. Never throws. */
export function awardFestivalMatchResult(outcome: FestivalMatchOutcome, now: Date = new Date()): void {
  try {
    const event = getActiveLiveEvent(now);
    if (!event) return;
    const progress = readActiveFestivalProgress(event);
    const next = applyMatchResult(progress, event, outcome, now);
    if (next.points !== progress.points) writeLiveEventProgress(next);
  } catch { /* festival points are best-effort — never break a match */ }
}

/** Win-only wrapper kept for callers that know nothing but the result. */
export function awardFestivalMatchWin(won: boolean, isDerby = false, now: Date = new Date()): void {
  if (!won) return;
  try {
    const event = getActiveLiveEvent(now);
    if (!event) return;
    const progress = readActiveFestivalProgress(event);
    const next = applyMatchWin(progress, event, now, isDerby);
    if (next.points !== progress.points) writeLiveEventProgress(next);
  } catch { /* festival points are best-effort — never break a match */ }
}

/** Side-effecting: award Festival Points for a completed signing, if the live
 *  event pays for signings. Never throws. */
export function awardFestivalSigning(now: Date = new Date()): void {
  try {
    const event = getActiveLiveEvent(now);
    if (!event?.signingPoints) return;
    const progress = readActiveFestivalProgress(event);
    const next = applySigning(progress, event, now);
    if (next.points !== progress.points) writeLiveEventProgress(next);
  } catch { /* best-effort — never break a transfer */ }
}

export interface TierStatus {
  tier: LiveEventTier;
  /** Points threshold reached. */
  unlocked: boolean;
  /** Already collected. */
  claimed: boolean;
  /** Unlocked and not yet collected. */
  claimable: boolean;
}

/** Per-tier status for the reward track, ascending by points. */
export function getTrackStatus(progress: LiveEventProgress, event: LiveEvent): TierStatus[] {
  return event.tiers.map(tier => {
    const unlocked = progress.points >= tier.points;
    const claimed = progress.claimedTierIds.includes(tier.id);
    return { tier, unlocked, claimed, claimable: unlocked && !claimed };
  });
}

/** Progress after claiming `tierId`. No-op if the tier is locked, unknown, or
 *  already claimed — caller should grant XP only when this returns a changed
 *  record (i.e. the tier id was newly added). */
export function applyTierClaim(
  progress: LiveEventProgress,
  event: LiveEvent,
  tierId: string,
): LiveEventProgress {
  const tier = event.tiers.find(t => t.id === tierId);
  if (!tier) return progress;
  if (progress.points < tier.points || progress.claimedTierIds.includes(tierId)) return progress;
  return { ...progress, claimedTierIds: [...progress.claimedTierIds, tierId] };
}
