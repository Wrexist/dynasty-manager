/**
 * Pure live-event logic (date windows + Festival Points track).
 *
 * Storage-free except for the thin `readActiveFestivalProgress` wrapper, so the
 * scheduling and reward maths are unit-testable with an injected `now`. Reuses
 * the local-day helpers from the daily-streak module — both features share the
 * same "is it a new local day?" semantics.
 */
import { LIVE_EVENTS, type LiveEvent, type LiveEventTier } from '@/config/liveEvents';
import { localDateKey, daysBetween } from '@/utils/dailyStreak';
import { readLiveEventProgress, type LiveEventProgress } from '@/store/helpers/persistence';

export type { LiveEvent, LiveEventTier, LiveEventProgress };

/** The event whose window contains `now`, or null if none is live. Inclusive
 *  of both start and end days. YYYY-MM-DD strings compare correctly with `<=`. */
export function getActiveLiveEvent(now: Date = new Date()): LiveEvent | null {
  const today = localDateKey(now);
  return LIVE_EVENTS.find(e => e.start <= today && today <= e.end) ?? null;
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
