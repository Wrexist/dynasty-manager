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
 *
 * FITNESS HAD THE SAME SHAPE. Weekly fitness recovery lives in
 * `applyWeeklyTraining`, which is likewise only run for the player's squad, so
 * AI clubs took the per-match drain and never got it back. Average fitness in
 * the player's division, player's club vs everyone else:
 *
 *     S1 kickoff   86.5  /  87.0
 *     S2 mid       88.5  /  80.4
 *     S3 mid       90.8  /  76.4
 *     S4 mid       89.2  /  74.8
 *
 * `getTeamStrength` scales by average fitness
 * (`TEAM_STRENGTH_FITNESS_SCALE`), so that gap is a compounding, unearned
 * advantage to the player: the world got measurably weaker every season. Both
 * clocks are now wound by the same weekly pass.
 */
import { FITNESS_RECOVERY_BASE, FITNESS_MIN, INTENSITY_FITNESS_COST } from '@/config/training';
import { AI_FITNESS_CEILING_BASE, AI_FITNESS_CEILING_PER_RECOVERY_LEVEL, RECOVERY_FITNESS_BONUS_PER_LEVEL, clubRecoveryLevel } from '@/config/gameBalance';
import type { Club, Player } from '@/types/game';

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
 * A club's weekly fitness gain when nobody is choosing its training.
 *
 * Modelled as the neutral schedule the player's own club would run — medium
 * intensity, no dedicated fitness days — plus the club's recovery facilities,
 * projected off the static `facilities` rating exactly as `clubMedicalLevel`
 * does for injuries. A club with the median rating lands just under a player
 * who has invested in the Recovery Suite, which is the intended shape: the
 * player's facility spending should buy an edge, not the absence of a system.
 */
export function aiWeeklyFitnessGain(clubFacilities: number): number {
  return FITNESS_RECOVERY_BASE
    + INTENSITY_FITNESS_COST.medium
    + clubRecoveryLevel(clubFacilities) * RECOVERY_FITNESS_BONUS_PER_LEVEL;
}

/** The resting fitness an AI club's squad settles at — see the constant's note. */
export function aiFitnessCeiling(clubFacilities: number): number {
  return Math.min(100, AI_FITNESS_CEILING_BASE
    + clubRecoveryLevel(clubFacilities) * AI_FITNESS_CEILING_PER_RECOVERY_LEVEL);
}

/**
 * Wind every weekly clock for players NOT handled by the player's own squad
 * pass: injury, re-injury, suspension and fitness. Returns how many players
 * returned from injury.
 *
 * One scan rather than several — this runs on the game's hottest path. It
 * writes back into `players` in place, which `advanceWeek` already owns as a
 * fresh copy (`newPlayers`); rebuilding a 5,000-entry record every week is not
 * worth the purity.
 */
export function applyWorldWeeklyUpkeep(
  players: Record<string, Player>,
  clubs: Record<string, Club>,
  week: number,
  skipIds: Iterable<string>,
): number {
  const skip = skipIds instanceof Set ? skipIds : new Set(skipIds);
  // Cache per club: `clubRecoveryLevel` is cheap but this runs over every
  // player in the world, every week.
  const restByClub = new Map<string, { gain: number; ceiling: number }>();
  const restFor = (clubId: string) => {
    let r = restByClub.get(clubId);
    if (r === undefined) {
      const facilities = clubs[clubId]?.facilities ?? 5;
      r = { gain: aiWeeklyFitnessGain(facilities), ceiling: aiFitnessCeiling(facilities) };
      restByClub.set(clubId, r);
    }
    return r;
  };

  let recoveries = 0;
  for (const id in players) {
    if (skip.has(id)) continue;
    const current = players[id];
    if (!current) continue;

    const { player, recovered } = stepInjuryRecovery(current, week);
    if (recovered) recoveries++;

    // An injured player does not train — same rule the player's squad follows
    // (`applyWeeklyTraining` is gated on `!p.injured`), and a returning player
    // has just had his fitness set to `fitnessOnReturn`, which this must not
    // immediately undo.
    let next = player;
    if (!next.injured && !recovered && next.clubId) {
      const { gain, ceiling } = restFor(next.clubId);
      // Rest brings a squad back UP to its club's ceiling and no further. Never
      // downward: a player already above it (a fresh signing, a fitness perk)
      // keeps what he has rather than being dragged to the mean.
      const rested = Math.max(FITNESS_MIN, Math.min(ceiling, next.fitness + gain));
      if (rested > next.fitness) next = { ...next, fitness: rested };
    }

    if (next !== current) players[id] = next;
  }
  return recoveries;
}
