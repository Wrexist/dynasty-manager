/**
 * Lineup Optimization Configuration
 * Weights and penalties for auto-fill lineup scoring algorithm.
 */

// ── Player Scoring Weights ──
export const LINEUP_POSITIONAL_OVERALL_WEIGHT = 0.55;
export const LINEUP_FORM_WEIGHT = 20;
export const LINEUP_FITNESS_WEIGHT = 15;
export const LINEUP_MORALE_WEIGHT = 10;

// ── Position Match Bonuses/Penalties ──
export const LINEUP_NATURAL_POSITION_BONUS = 5;
export const LINEUP_COMPATIBLE_POSITION_BONUS = 2;
export const LINEUP_INCOMPATIBLE_POSITION_PENALTY = -20;

// ── Fitness & Morale ──
export const LINEUP_LOW_FITNESS_EXTRA_PENALTY = -8;
export const LINEUP_LOW_MORALE_THRESHOLD = 40;
export const LINEUP_LOW_MORALE_EXTRA_PENALTY = -6;

// ── Transfer Status ──
export const LINEUP_WANTS_TO_LEAVE_PENALTY = -5;

// ── Yellow Card Risk ──
export const LINEUP_YELLOW_CARD_LOW_PENALTY = -1;
export const LINEUP_YELLOW_CARD_HIGH_PENALTY = -8;
export const LINEUP_YELLOW_CARD_HIGH_THRESHOLD = 2;

// ── Injury & Chemistry ──
export const LINEUP_REINJURY_RISK_PENALTY_SCALE = -5;
export const LINEUP_CHEMISTRY_SCORE_SCALE = 50;

// ── Optimization ──
export const LINEUP_SWAP_OPTIMIZATION_PASSES = 3;

// ── Bench Selection Priority (higher = more important to have on bench) ──
export const LINEUP_BENCH_POSITION_PRIORITY: Record<string, number> = {
  'GK': 10, 'CB': 6, 'LB': 4, 'RB': 4,
  'CDM': 3, 'CM': 3, 'CAM': 2,
  'LM': 2, 'RM': 2, 'LW': 1, 'RW': 1, 'ST': 2,
};
