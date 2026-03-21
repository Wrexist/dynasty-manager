/**
 * Playoff Simulation Configuration
 * Goal ranges, strength bonuses, home advantage, and tiebreaker rules.
 */

// ── Home Advantage ──
export const PLAYOFF_HOME_ADVANTAGE = 3;

// ── Goal Simulation ──
export const PLAYOFF_GOAL_RANGE = 3;
export const PLAYOFF_STRONG_BONUS = 0.8;
export const PLAYOFF_WEAK_BONUS = 0.3;
export const PLAYOFF_FINAL_STRONG_BONUS = 0.6;
export const PLAYOFF_FINAL_WEAK_BONUS = 0.3;

// ── Extra Time / Tiebreaker ──
export const PLAYOFF_EXTRA_TIME_CHANCE = 0.5;

// ── Fallback ──
export const PLAYOFF_FALLBACK_OVERALL = 50;

// ── Promotion / Relegation Consequences ──
export const PROMOTION_BUDGET_MULTIPLIER = 1.2;
export const PROMOTION_MORALE_BONUS = 10;
export const PROMOTION_FAN_MOOD_BONUS = 15;
export const RELEGATION_BUDGET_MULTIPLIER = 0.7;
export const RELEGATION_MORALE_PENALTY = 15;
export const RELEGATION_FAN_MOOD_PENALTY = -20;
export const RELEGATION_UNHAPPY_OVERALL = 75;

// ── Board Verdict Position Offsets ──
export const VERDICT_EXCELLENT_OFFSET = -3;
export const VERDICT_ACCEPTABLE_OFFSET = 4;
export const BOARD_SACKING_THRESHOLD = 20;

// ── Storyline Chains ──
export const STORYLINE_CHAIN_TRIGGER_CHANCE = 0.15;
export const STORYLINE_CHAIN_MIN_WEEK = 5;
