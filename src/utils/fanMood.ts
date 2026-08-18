/**
 * Fan mood — the 0-100 signal behind the ±20% matchday-income multiplier
 * (`FAN_MOOD_BASE` / `FAN_MOOD_SCALE`, applied in `utils/financeHelpers.ts`).
 *
 * WHY THIS FILE EXISTS. Fan mood shipped wired to exactly one input: the
 * merchandise pricing tier (+2 / 0 / -1 per week). The default tier is
 * `standard`, whose impact is 0 — so on a default save the value never left its
 * initial 50 and the whole matchday multiplier was pinned at 1.0. Measured over
 * 13 simulated seasons: board confidence swung 50 -> 88 -> 10 while fan mood
 * read exactly 50 every single week. Meanwhile the in-game help text
 * (`config/ui.ts`, key `fanMood`) promises "Good results and winning streaks
 * keep fans happy", and `utils/storylines.ts` gates a fan-unrest event on
 * `fanMood < 25` that no default save could reach.
 *
 * The other half of the same defect: a non-zero pricing impact applied every
 * week with nothing pulling back is a one-way ratchet. Fan-Friendly pricing
 * climbed to 100 and Premium fell to 0 within a season and stayed there, so the
 * pricing choice was a one-off switch rather than a standing trade-off.
 *
 * The model is therefore TARGET + MEAN REVERSION rather than an accumulator:
 * results and league standing set the level the crowd would settle at, mood
 * moves a fraction of the way there each week, and the pricing tier is an
 * offset on top. That makes pricing a real recurring cost (a few points of
 * mood) instead of a rail, and lets a press conference buy a lift that decays
 * back to whatever the results deserve.
 */
import {
  FAN_MOOD_ADJUST_RATE,
  FAN_MOOD_FORM_WEIGHT,
  FAN_MOOD_POSITION_WEIGHT,
} from '@/config/gameBalance';

/** Points a result is worth when scoring recent form (league scoring). */
const RESULT_POINTS: Record<'W' | 'D' | 'L', number> = { W: 3, D: 1, L: 0 };

/**
 * The 0-100 level the crowd would settle at given recent form and standing.
 *
 * Returns `null` when there is nothing to judge — no results played yet — so
 * callers can hold the current mood rather than snapping it to a fabricated
 * target at the start of a season.
 */
export function fanMoodTarget(
  form: ('W' | 'D' | 'L')[],
  leaguePosition: number,
  leagueSize: number,
): number | null {
  if (form.length === 0) return null;

  const earned = form.reduce((sum, r) => sum + RESULT_POINTS[r], 0);
  const formScore = earned / (form.length * RESULT_POINTS.W);

  // 1st = 1, last = 0. A one-club league has no standing to speak of, so it
  // contributes neutrally rather than dividing by zero.
  const positionScore =
    leagueSize > 1
      ? 1 - (Math.min(Math.max(leaguePosition, 1), leagueSize) - 1) / (leagueSize - 1)
      : 0.5;

  return 100 * (FAN_MOOD_FORM_WEIGHT * formScore + FAN_MOOD_POSITION_WEIGHT * positionScore);
}

/**
 * One week of fan mood.
 *
 * `pricingDelta` is the merchandise tier's per-week impact and is applied as an
 * offset AFTER reversion, which is what keeps it bounded — see the steady-state
 * note on `FAN_MOOD_ADJUST_RATE`. `floor` carries the `cult_hero` perk's
 * guaranteed minimum.
 */
export function nextFanMood(opts: {
  current: number;
  form: ('W' | 'D' | 'L')[];
  leaguePosition: number;
  leagueSize: number;
  pricingDelta: number;
  floor: number;
}): number {
  const { current, form, leaguePosition, leagueSize, pricingDelta, floor } = opts;
  const safeCurrent = Number.isFinite(current) ? current : 50;
  const target = fanMoodTarget(form, leaguePosition, leagueSize);
  const reverted =
    target === null ? safeCurrent : safeCurrent + (target - safeCurrent) * FAN_MOOD_ADJUST_RATE;
  return Math.max(floor, Math.min(100, reverted + pricingDelta));
}
