/**
 * Match Engine Configuration
 * All coefficients, probabilities, and weights used by src/engine/match.ts
 */

// ── Formation Fit ──
/** Maximum bonus from perfect formation fit — mispositioned players are punished */
export const FORMATION_FIT_MAX_BONUS = 0.18;

// ── Attacker Selection ──
export const ATTACKER_POSITIONS = ['ST', 'LW', 'RW', 'CAM', 'CF'] as const;
export const MIDFIELDER_POSITIONS = ['CM', 'LM', 'RM', 'CDM'] as const;
export const ATTACKER_SHOOTING_WEIGHT = 0.6;
export const ATTACKER_FITNESS_WEIGHT = 0.4;
/** Probability of picking from attackers when available */
export const ATTACKER_SELECTION_CHANCE = 0.7;
/** Probability of picking from midfielders if no attacker selected */
export const MIDFIELDER_SELECTION_CHANCE = 0.8;

// ── Assist Selection ──
/** Probability of awarding an assist on a goal */
export const ASSIST_CHANCE = 0.65;
export const ASSIST_PASSING_WEIGHT = 0.7;
export const ASSIST_MENTAL_WEIGHT = 0.3;

// ── Tactical Modifiers (significant impact — tactics should feel meaningful) ──
export const MENTALITY_ATTACK_MOD: Record<string, number> = {
  'defensive': -0.35, 'cautious': -0.20, 'balanced': 0, 'attacking': 0.30, 'all-out-attack': 0.50,
} as const;

export const MENTALITY_DEFENSE_MOD: Record<string, number> = {
  'defensive': 0.35, 'cautious': 0.20, 'balanced': 0, 'attacking': -0.20, 'all-out-attack': -0.40,
} as const;

export const TEMPO_SHOT_MOD: Record<string, number> = {
  'slow': -0.15, 'normal': 0, 'fast': 0.18,
} as const;

export const DEFENSIVE_LINE_COUNTER_VULN: Record<string, number> = {
  'deep': -0.18, 'normal': 0, 'high': 0.25,
} as const;

export const WIDTH_POSSESSION_MOD: Record<string, number> = {
  'narrow': -0.10, 'normal': 0, 'wide': 0.12,
} as const;

// ── Tactical Matchup Bonuses (rock-paper-scissors counters) ──
export const PRESSING_THRESHOLD = 70;
export const PRESSING_VS_SLOW_BONUS = 0.14;
export const WIDE_VS_NARROW_BONUS = 0.10;
export const DEEP_VS_HIGH_BONUS = 0.16;
export const FAST_VS_CAUTIOUS_BONUS = 0.10;
export const ALL_OUT_VS_DEFENSIVE_BONUS = 0.12;

// ── Formation Attack/Defense Profiles ──
export const FORMATION_ATTACK_BONUS: Record<string, number> = {
  '4-4-2': 0, '4-3-3': 0.06, '3-5-2': 0.04, '4-2-3-1': 0.03,
  '4-1-4-1': -0.02, '3-4-3': 0.10, '5-3-2': -0.06,
} as const;
export const FORMATION_DEFENSE_BONUS: Record<string, number> = {
  '4-4-2': 0, '4-3-3': -0.04, '3-5-2': 0.02, '4-2-3-1': 0.02,
  '4-1-4-1': 0.06, '3-4-3': -0.08, '5-3-2': 0.10,
} as const;

// ── Pressing / Foul Modifier ──
export const PRESSING_FOUL_MULTIPLIER = 0.002;
export const PRESSING_FOUL_BASELINE = 50;

// ── Defense Quality ──
export const DEFENDER_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM'] as const;
export const DEFENSE_DEFENDING_WEIGHT = 0.6;
export const DEFENSE_PHYSICAL_WEIGHT = 0.3;
export const DEFENSE_MENTAL_WEIGHT = 0.1;
export const DEFENSE_QUALITY_FALLBACK = 0.3;

// ── GK Save ──
export const GK_DEFENDING_WEIGHT = 0.4;
export const GK_MENTAL_WEIGHT = 0.3;
export const GK_PHYSICAL_WEIGHT = 0.3;
export const GK_SAVE_BASE = 0.30;
export const GK_SAVE_RANGE = 0.40;

// ── Tactical Familiarity ──
export const TACTICAL_FAMILIARITY_MULTIPLIER = 0.004;

// ── Home Advantage ──
export const HOME_ADVANTAGE = 1.07;

// ── Event Generation ──
export const BASE_EVENT_CHANCE = 0.18;
export const LATE_GAME_EVENT_BONUS = 0.08;
export const LATE_GAME_THRESHOLD_MINUTE = 85;
/** Fraction of event rolls that become shot attempts */
export const SHOT_ATTEMPT_THRESHOLD = 0.2;
/** Fraction of event rolls between shots and fouls */
export const FOUL_THRESHOLD = 0.35;
/** Fraction of event rolls between fouls and non-foul injuries */
export const INJURY_EVENT_THRESHOLD = 0.38;

// ── Shot Quality Weights ──
export const SHOT_QUALITY_WEIGHTS = {
  shooting: 0.40,
  mental: 0.20,
  pace: 0.15,
  physical: 0.10,
  form: 0.15,
} as const;

// ── Fitness Factor ──
export const FITNESS_FACTOR_BASE = 0.7;
export const FITNESS_FACTOR_SCALE = 0.3;

// ── Goal Chance Formula ──
export const GOAL_CHANCE_ATTACK_MULT = 0.45;
export const GOAL_CHANCE_DEFENSE_MULT = 0.20;
export const GOAL_CHANCE_ATTACK_MOD_SCALE = 0.35;
export const GOAL_CHANCE_COUNTER_VULN_SCALE = 0.18;
export const GOAL_CHANCE_MIN = 0.005;

// ── Corner Chances ──
export const CORNER_FROM_SAVE_CHANCE = 0.35;
export const CORNER_FROM_MISS_CHANCE = 0.15;

// ── Cards / Fouls ──
export const CARD_BASE_CHANCE = 0.18;
export const STRAIGHT_RED_CHANCE = 0.008;

// ── Match Injuries ──
export const FOUL_INJURY_CHANCE = 0.03;
export const NON_FOUL_INJURY_BASE = 0.02;
export const PHYSICAL_FRAGILITY_FACTOR = 0.0005;
export const OLD_PLAYER_INJURY_BONUS = 0.01;
export const OLD_PLAYER_INJURY_AGE_THRESHOLD = 30;

// ── Match Ratings ──
export const RATING_BASE_WIN = 6.5;
export const RATING_BASE_LOSS = 5.5;
export const RATING_BASE_DRAW = 6.0;
export const RATING_GOAL_BONUS = 1.0;
export const RATING_ASSIST_BONUS = 0.5;
export const RATING_SAVE_BONUS = 0.3;
export const RATING_YELLOW_PENALTY = 0.3;
export const RATING_RED_PENALTY = 2.0;
export const RATING_CLEAN_SHEET_BONUS = 1.0;
export const RATING_DEFENDER_SCALE = 0.5;
export const RATING_DEFENDER_OFFSET = 0.25;
export const RATING_MIDFIELDER_SCALE = 0.4;
export const RATING_MIDFIELDER_OFFSET = 0.20;
export const RATING_EXHAUSTION_THRESHOLD = 50;
export const RATING_EXHAUSTION_PENALTY = 0.5;
export const RATING_VARIANCE = 0.8;
export const RATING_MIN = 1;
export const RATING_MAX = 10;

// ── Substitutions ──
export const MAX_SUBSTITUTIONS = 3;
