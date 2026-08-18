/**
 * Sunday League — who is actually going to turn up.
 *
 * This is the mode's defining system, and the one most easily got wrong. Two
 * failure modes were designed against explicitly:
 *
 *  1. RANDOM TAX. If availability were a flat coin flip, the manager would have
 *     no agency and the weekly teamsheet would be busywork. So: it is driven by
 *     attributes the manager can SEE (`commitment`), influenced by decisions the
 *     manager MAKES (benching people, keeping them happy, buying a minibus),
 *     and most absences arrive a week early so they can be planned around.
 *
 *  2. UNRECOVERABLE WEEKS. A run of bad rolls must never brick a fixture. The
 *     `SUNDAY_MIN_START` floor is handled at kickoff by drafting ringers rather
 *     than here by rigging the dice — the roll stays honest and the fiction
 *     ("somebody's brother-in-law is at left-back") absorbs the disaster.
 *
 * Multi-week absences (holidays, injuries, suspensions) are stored as
 * `weeksRemaining` and tick down, so a player who is in Tenerife stays in
 * Tenerife instead of being re-rolled available on Sunday.
 */
import type {
  Player, SundayAbsenceReason, SundayAvailability, SundaySquadMember,
} from '@/types/game';
import {
  SUNDAY_ABSENCE_WEIGHTS, SUNDAY_AVAIL_AWAY_PENALTY, SUNDAY_AVAIL_BASE,
  SUNDAY_AVAIL_BENCHED_PENALTY, SUNDAY_AVAIL_BIG_GAME_BONUS, SUNDAY_AVAIL_MAX,
  SUNDAY_AVAIL_MIN, SUNDAY_AVAIL_PER_COMMITMENT, SUNDAY_AVAIL_PER_HAPPINESS,
  SUNDAY_DOUBT_SHARE, SUNDAY_DOUBT_TURNS_UP, SUNDAY_HOLIDAY_SHARE,
  SUNDAY_HOLIDAY_WEEKS_MAX, SUNDAY_HOLIDAY_WEEKS_MIN, SUNDAY_WARN_BASE,
  SUNDAY_WARN_PER_PUNCTUALITY, SUNDAY_RINGROUND_BASE, SUNDAY_RINGROUND_PER_COMMITMENT,
} from '@/config/sundayLeague';
import { SUNDAY_ABSENCE_NOTES } from '@/data/sundayNames';
import type { SundayRng } from './rng';

export const AVAILABLE: SundayAvailability = {
  status: 'available', reason: null, note: null, warned: true, weeksRemaining: 0,
};

export interface AvailabilityContext {
  /** True when the coming fixture is away from home. */
  away: boolean;
  /** True for a cup tie or a derby — people make the effort for those. */
  bigGame: boolean;
  /** Club owns a minibus, cancelling the away penalty. */
  hasMinibus: boolean;
  /** No fixture this week: nobody can be unavailable for a match that does not
   *  exist, so multi-week absences tick down and everyone else resets. */
  freeWeek: boolean;
}

/** Probability this player is available, before the reason is chosen. */
export function sundayAvailabilityChance(m: SundaySquadMember, ctx: AvailabilityContext): number {
  let p = SUNDAY_AVAIL_BASE
    + m.commitment * SUNDAY_AVAIL_PER_COMMITMENT
    + (m.happiness - 50) * SUNDAY_AVAIL_PER_HAPPINESS
    - m.benchedStreak * SUNDAY_AVAIL_BENCHED_PENALTY;
  if (ctx.bigGame) p += SUNDAY_AVAIL_BIG_GAME_BONUS;
  if (ctx.away && !ctx.hasMinibus) p -= SUNDAY_AVAIL_AWAY_PENALTY;
  return Math.max(SUNDAY_AVAIL_MIN, Math.min(SUNDAY_AVAIL_MAX, p));
}

function noteFor(rng: SundayRng, reason: SundayAbsenceReason, firstName: string): string {
  const lines = SUNDAY_ABSENCE_NOTES[reason] ?? SUNDAY_ABSENCE_NOTES.work;
  return `${firstName} ${rng.pick(lines) ?? 'is not around'}`;
}

/**
 * Roll one player's availability for the coming week.
 *
 * `player` supplies the hard blocks the football side owns — an injury or a
 * suspension is not a matter of enthusiasm — and those always win.
 */
export function rollSundayAvailability(
  rng: SundayRng,
  m: SundaySquadMember,
  player: Player,
  ctx: AvailabilityContext,
  currentWeek: number,
): SundayAvailability {
  // Hard blocks first. These are facts, not rolls.
  if (player.injured && player.injuryWeeks > 0) {
    return {
      status: 'out', reason: 'injury', note: noteFor(rng, 'injury', player.firstName),
      warned: true, weeksRemaining: player.injuryWeeks,
    };
  }
  if (player.suspendedUntilWeek != null && player.suspendedUntilWeek > currentWeek) {
    return {
      status: 'out', reason: 'suspended', note: noteFor(rng, 'suspended', player.firstName),
      warned: true, weeksRemaining: player.suspendedUntilWeek - currentWeek,
    };
  }

  // A multi-week absence already in progress carries over untouched — that is
  // the whole point of `weeksRemaining`. Decrementing happens in `tickAbsence`
  // so a caller cannot double-count it here.
  if (m.availability.weeksRemaining > 0 && m.availability.status === 'out') {
    return { ...m.availability };
  }

  if (ctx.freeWeek) return { ...AVAILABLE };

  if (rng.chance(sundayAvailabilityChance(m, ctx))) return { ...AVAILABLE };

  // He is not available. Pick a reason, then decide whether the manager finds
  // out now or at eleven o'clock on Sunday morning.
  const reasons = Object.keys(SUNDAY_ABSENCE_WEIGHTS) as SundayAbsenceReason[];
  let reason = rng.weighted(reasons, r => {
    let w = SUNDAY_ABSENCE_WEIGHTS[r] ?? 1;
    // A no-show is a betrayal, so it belongs to the unreliable. Weighting it
    // by the inverse of punctuality keeps the club captain from mysteriously
    // vanishing while the Ghost gives a week's notice.
    if (r === 'no-show' || r === 'cant-be-bothered') w *= Math.max(0.2, (21 - m.punctuality) / 10);
    if (r === 'work') w *= Math.max(0.4, (21 - m.commitment) / 10);
    if (r === 'fell-out') w *= m.happiness < 40 ? 3 : 0.3;
    if (r === 'other-team') w *= m.loyalty < 9 ? 2.5 : 0.4;
    if (r === 'hungover') w *= Math.max(0.3, (21 - m.condition) / 10);
    return w;
  }) ?? 'work';

  let weeksRemaining = 0;
  if (rng.chance(SUNDAY_HOLIDAY_SHARE)) {
    reason = 'holiday';
    weeksRemaining = rng.int(SUNDAY_HOLIDAY_WEEKS_MIN, SUNDAY_HOLIDAY_WEEKS_MAX);
  }

  const warnChance = SUNDAY_WARN_BASE + m.punctuality * SUNDAY_WARN_PER_PUNCTUALITY;
  // A no-show is by definition unannounced; everything else depends on whether
  // he is the sort of person who sends a message.
  const warned = reason === 'no-show' ? false : rng.chance(warnChance);

  // "Should be alright" — a warned, single-week absence sometimes arrives as a
  // doubt instead, which is the most authentic state in the whole mode.
  if (warned && weeksRemaining === 0 && rng.chance(SUNDAY_DOUBT_SHARE)) {
    return {
      status: 'doubt', reason, note: noteFor(rng, reason, player.firstName),
      warned: true, weeksRemaining: 0,
    };
  }

  return {
    status: 'out',
    reason,
    // An unwarned absence is not knowable in advance. The note is generated
    // now (so it is stable across a reload) but the UI only shows it once
    // `warned` flips — the hub and squad screens gate on that flag directly.
    note: noteFor(rng, reason, player.firstName),
    warned,
    weeksRemaining,
  };
}

/** Advance a multi-week absence by one week. Returns the new availability. */
export function tickAbsence(a: SundayAvailability): SundayAvailability {
  if (a.weeksRemaining <= 1) return { ...AVAILABLE };
  return { ...a, weeksRemaining: a.weeksRemaining - 1 };
}

/** Resolve a `doubt` at kickoff — he either turns up or he does not. */
export function resolveDoubt(rng: SundayRng, a: SundayAvailability): SundayAvailability {
  if (a.status !== 'doubt') return a;
  if (rng.chance(SUNDAY_DOUBT_TURNS_UP)) return { ...AVAILABLE };
  return { ...a, status: 'out' };
}

/** Chance a ring-round talks this particular player into playing after all. */
export function ringRoundChance(m: SundaySquadMember): number {
  // Nobody is talking the injured or the banned into anything.
  if (m.availability.reason === 'injury' || m.availability.reason === 'suspended') return 0;
  if (m.availability.reason === 'holiday') return 0;
  return Math.max(0, Math.min(0.85, SUNDAY_RINGROUND_BASE + m.commitment * SUNDAY_RINGROUND_PER_COMMITMENT));
}

/** A short English summary of the week's availability, for the hub. */
export function summariseAvailability(squad: readonly SundaySquadMember[]): {
  available: number; doubts: number; out: number; knownOut: number;
} {
  let available = 0, doubts = 0, out = 0, knownOut = 0;
  for (const m of squad) {
    if (m.availability.status === 'available') available++;
    else if (m.availability.status === 'doubt') { doubts++; }
    else { out++; if (m.availability.warned) knownOut++; }
  }
  return { available, doubts, out, knownOut };
}
