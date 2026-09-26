/**
 * Shared measurement code for the match-engine calibration harness
 * (`matchCalibration.test.ts`, slow) and its seeded smoke check
 * (`matchCalibrationSmoke.test.ts`, fast).
 *
 * The point of both is that they measure REAL SAVES — real clubs, real squads,
 * real fitness/form/morale after weeks of the actual game loop — not the cloned
 * 70/75-rated squads `matchBalance` / `matchRealism` use. Those isolate the
 * engine; they cannot see what a season does to the inputs.
 */

/** Deterministic PRNG (same one matchRealism uses) so a seeded run replays. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScoringSample {
  matches: number;
  goals: number;
  draws: number;
  homeWins: number;
  awayWins: number;
  nils: number;
}

export const emptySample = (): ScoringSample => ({ matches: 0, goals: 0, draws: 0, homeWins: 0, awayWins: 0, nils: 0 });

export function addResult(s: ScoringSample, homeGoals: number, awayGoals: number): void {
  s.matches++;
  s.goals += homeGoals + awayGoals;
  if (homeGoals === awayGoals) s.draws++;
  else if (homeGoals > awayGoals) s.homeWins++;
  else s.awayWins++;
  if (homeGoals === 0 && awayGoals === 0) s.nils++;
}

export function mergeSamples(...samples: ScoringSample[]): ScoringSample {
  const out = emptySample();
  for (const s of samples) {
    out.matches += s.matches; out.goals += s.goals; out.draws += s.draws;
    out.homeWins += s.homeWins; out.awayWins += s.awayWins; out.nils += s.nils;
  }
  return out;
}

export interface ScoringRates {
  matches: number;
  goalsPerMatch: number;
  drawRate: number;
  homeWinRate: number;
  awayWinRate: number;
  nilNilRate: number;
}

export function rates(s: ScoringSample): ScoringRates {
  const n = Math.max(1, s.matches);
  return {
    matches: s.matches,
    goalsPerMatch: s.goals / n,
    drawRate: s.draws / n,
    homeWinRate: s.homeWins / n,
    awayWinRate: s.awayWins / n,
    nilNilRate: s.nils / n,
  };
}

export const fmtRates = (r: ScoringRates): string =>
  `n=${r.matches} goals=${r.goalsPerMatch.toFixed(2)} draws=${(r.drawRate * 100).toFixed(1)}% ` +
  `home=${(r.homeWinRate * 100).toFixed(1)}% away=${(r.awayWinRate * 100).toFixed(1)}% 0-0=${(r.nilNilRate * 100).toFixed(1)}%`;
