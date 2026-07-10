/** Team talk effect modifiers for second half simulation */

// Motivate: boost attack, increase fouls, extra fatigue drain
export const MOTIVATE_ATTACK_BOOST = 0.08;
export const MOTIVATE_FATIGUE_MULTIPLIER = 1.15;
export const MOTIVATE_FOUL_BONUS = 0.05;

// Calm: boost defense, reduce fouls
export const CALM_DEFENSE_BOOST = 0.06;
export const CALM_FOUL_REDUCTION = 0.10;

// Demand More: high risk/reward — attack/defense during match, morale after
export const DEMAND_ATTACK_BOOST = 0.12;
export const DEMAND_DEFENSE_PENALTY = 0.06;
export const DEMAND_MORALE_WIN_BONUS = 3;
export const DEMAND_MORALE_LOSS_PENALTY = 5;

// In-match fitness degradation multiplier (applied to FITNESS_DEGRADE_PER_MINUTE during 2nd half)
export const MOTIVATE_FITNESS_DRAIN_MULT = 1.10;   // 10% faster drain
export const CALM_FITNESS_DRAIN_MULT = 0.75;       // 25% slower drain
export const DEMAND_FITNESS_DRAIN_MULT = 1.30;     // 30% faster drain

// Post-match fitness drain multiplier (applied to FITNESS_DRAIN_PER_MATCH)
// MOTIVATE_FATIGUE_MULTIPLIER already exists above = 1.15
export const CALM_FATIGUE_MULTIPLIER = 0.80;       // 20% less post-match drain
export const DEMAND_FATIGUE_MULTIPLIER = 1.30;     // 30% more post-match drain

// ── High-stakes pre-kickoff team talk (G3) ──
// A pre-match talk is only offered on high-stakes fixtures. Thresholds:
export const DERBY_INTENSITY_MIN = 1;   // any listed derby (getDerbyIntensity > 0)
export const SIX_POINTER_TOP_N = 6;     // both clubs in the top 6 = title six-pointer
export const SIX_POINTER_BOTTOM_N = 4;  // both clubs in the bottom 4 = relegation six-pointer

/**
 * Match-engine modifiers for a given team talk, shared by the half-time,
 * extra-time and pre-kickoff (first-half) paths. `none` yields undefined so
 * callers can skip the modifier entirely.
 */
export type TeamTalkModifiers = { attackMod: number; defenseMod: number; foulMod: number; fitnessDrainMult: number };

export function teamTalkModifiers(talk: string): TeamTalkModifiers | undefined {
  if (talk === 'motivate') return { attackMod: MOTIVATE_ATTACK_BOOST, defenseMod: 0, foulMod: MOTIVATE_FOUL_BONUS, fitnessDrainMult: MOTIVATE_FITNESS_DRAIN_MULT };
  if (talk === 'calm') return { attackMod: 0, defenseMod: CALM_DEFENSE_BOOST, foulMod: -CALM_FOUL_REDUCTION, fitnessDrainMult: CALM_FITNESS_DRAIN_MULT };
  if (talk === 'demand') return { attackMod: DEMAND_ATTACK_BOOST, defenseMod: -DEMAND_DEFENSE_PENALTY, foulMod: 0, fitnessDrainMult: DEMAND_FITNESS_DRAIN_MULT };
  return undefined;
}
