/**
 * Weekly injury recovery — one step, applied to EVERY player in the world.
 *
 * WHY THIS FILE EXISTS. The recovery loop lived inside `advanceWeek`'s
 * `playerClub.playerIds.forEach(...)` pass, so `injuryWeeks` was only ever
 * decremented for the player's own squad. AI clubs picked up injuries from
 * their simulated matches (`processAIMatchEvents` sets `injured: true` with a
 * `weeksRemaining` scaled by the club's medical level) and then never healed:
 * `injured` stayed true for the rest of the save.
 *
 * Measured across the 20 clubs of the player's division, injured players out of
 * total squad:
 *
 *     S1 kickoff    0 / 525
 *     S1 end      206 / 518
 *     S2 end      411 / 671
 *     S3 end      539 / 667   (81% of the division unavailable)
 *
 * The consequences reached well past the injury list. AI clubs could not field
 * eleven fit players, so `playCurrentMatchImpl`'s `hp.length < 7 || ap.length < 7`
 * guard returned null for the PLAYER's fixture — no match, no message, and no
 * auto-sim (that only fires when the player played something else that week).
 * The player's club finished season 3 on 24 league games against 36-38 for
 * everyone else, which is the table, the prize money and promotion/relegation
 * all computed off a half-played season.
 *
 * It also explains a workaround already in the tree: `pickAiMatchSquad`'s
 * "Emergency XI" comment records "measured mid-season, the worst club had 6
 * available" and papers over it rather than asking why.
 *
 * No existing gate could see it. `stateValidator` and the longevity suites
 * count players that EXIST, not players who can play.
 */
import type { Player } from '@/types/game';

export interface InjuryStepResult {
  /** The player after one week of recovery. Same object identity when nothing changed. */
  player: Player;
  /** True when this step returned the player to fitness (for digest reporting). */
  recovered: boolean;
}

/**
 * Advance one player's injury and re-injury clocks by a week.
 *
 * `recoveryBoost` is the physio's extra week (player's club only — AI medical
 * quality is already priced into `weeksRemaining` at the moment of injury by
 * `generateAIInjuryDetails`). `week` clears an expired suspension.
 *
 * Mutates nothing: callers get a copy only when something actually changed, so
 * the common case (a fit player with no history) costs one boolean check.
 */
export function stepInjuryRecovery(input: Player, week: number, recoveryBoost = 0): InjuryStepResult {
  const needsInjuryStep = input.injured;
  const needsReinjuryStep = !input.injured && !!input.injuryDetails && input.injuryDetails.reinjuryWeeksRemaining > 0;
  const needsSuspensionStep = input.suspendedUntilWeek != null && input.suspendedUntilWeek <= week;
  if (!needsInjuryStep && !needsReinjuryStep && !needsSuspensionStep) {
    return { player: input, recovered: false };
  }

  const p = { ...input };
  let recovered = false;

  if (p.injured) {
    p.injuryWeeks = Math.max(0, (p.injuryWeeks ?? 0) - 1 - recoveryBoost);
    if (p.injuryDetails) p.injuryDetails = { ...p.injuryDetails, weeksRemaining: p.injuryWeeks };
    if (p.injuryWeeks === 0) {
      p.injured = false;
      recovered = true;
      if (p.injuryDetails) {
        // Fitness on return is set by severity; the re-injury window stays open.
        p.fitness = p.injuryDetails.fitnessOnReturn;
        p.injuryDetails = { ...p.injuryDetails, weeksRemaining: 0 };
      }
    }
  }

  if (!p.injured && p.injuryDetails && p.injuryDetails.reinjuryWeeksRemaining > 0) {
    p.injuryDetails = { ...p.injuryDetails, reinjuryWeeksRemaining: p.injuryDetails.reinjuryWeeksRemaining - 1 };
    if (p.injuryDetails.reinjuryWeeksRemaining === 0) p.injuryDetails = undefined;
  }

  if (p.suspendedUntilWeek != null && p.suspendedUntilWeek <= week) {
    p.suspendedUntilWeek = undefined;
  }

  return { player: p, recovered };
}

/**
 * Run the recovery step over every player NOT handled by the player's own
 * squad pass. Returns the number of players who returned to fitness.
 *
 * Writes back into `players` in place — `advanceWeek` already owns that object
 * as a fresh copy (`newPlayers`), and rebuilding a 5,000-entry record every week
 * on the game's hottest path is not worth the purity.
 */
export function recoverInjuriesForOthers(
  players: Record<string, Player>,
  week: number,
  skipIds: Iterable<string>,
): number {
  const skip = skipIds instanceof Set ? skipIds : new Set(skipIds);
  let recoveries = 0;
  for (const id in players) {
    if (skip.has(id)) continue;
    const current = players[id];
    if (!current) continue;
    const { player, recovered } = stepInjuryRecovery(current, week);
    if (player !== current) players[id] = player;
    if (recovered) recoveries++;
  }
  return recoveries;
}
