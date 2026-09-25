/**
 * "Skip to full time" — the rules MatchDay needs, kept out of the component.
 *
 * The skip is PLAYBACK-ONLY: it must produce exactly what the running clock
 * would have. The clock does not simulate the second half in one go — it asks
 * the store for one segment at a time (`SECOND_HALF_SEGMENTS`), each call
 * re-reading the lineup, subs and shouts. `playOutSecondHalf` replays that
 * exact sequence of calls, so a skipped match and a watched-without-touching
 * match run the same simulation with the same inputs.
 */

import { SECOND_HALF_SEGMENTS } from '@/config/matchEngine';
import { SKIP_TO_FULL_TIME_PHASES } from '@/config/matchSpeed';
import type { Match, MatchDayPhase } from '@/types/game';

/** Is the skip control on offer in this playback phase for this player? */
export function canSkipToFullTime(phase: MatchDayPhase, userIsPro: boolean): boolean {
  return SKIP_TO_FULL_TIME_PHASES[userIsPro ? 'pro' : 'free'].includes(phase);
}

/**
 * Drive the remaining second-half segments from `frontier` to 90, in the same
 * order the match clock requests them: from each frontier, the next boundary is
 * the first segment past it (90 if none). A `null` from the store stops the
 * loop exactly as the clock does ("stop asking so the clock can't stall").
 *
 * Returns the last match the store handed back (null if nothing was left to
 * simulate or the first call failed) and the frontier reached — always 90,
 * because the clock treats a failure as "done" too.
 */
export function playOutSecondHalf(
  frontier: number,
  extend: (untilMin: number) => Match | null,
): { match: Match | null; frontier: number } {
  let reached = frontier;
  let last: Match | null = null;
  while (reached < 90) {
    const nextBoundary = SECOND_HALF_SEGMENTS.find(b => b > reached) ?? 90;
    const extended = extend(nextBoundary);
    if (!extended) return { match: last, frontier: 90 };
    last = extended;
    reached = nextBoundary;
  }
  return { match: last, frontier: reached };
}
