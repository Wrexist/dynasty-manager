/**
 * Match Engine Configuration
 * All coefficients, probabilities, and weights used by src/engine/match.ts
 */

// ── Goal Event Types (single source of truth) ──
/** All event types that count as goals for scoring/stats purposes */
export const GOAL_EVENT_TYPES = ['goal', 'penalty_scored', 'free_kick_goal', 'long_range_goal', 'counter_attack_goal', 'header_goal', 'solo_goal', 'goalkeeper_error'] as const;
/** Goal types + own_goal + var_check for display purposes (match feed, highlights) */
export const GOAL_DISPLAY_TYPES = [...GOAL_EVENT_TYPES, 'own_goal', 'var_check', 'var_disallowed'] as const;
/** Goal event types that count as actual scored goals (for counting goals from events) */
export const GOAL_SCORING_TYPES = [...GOAL_EVENT_TYPES, 'own_goal'] as const;
/** Goal event types that also count as a shot on target (excludes goalkeeper_error and own_goal) */
export const GOAL_SHOT_TYPES = ['goal', 'penalty_scored', 'free_kick_goal', 'long_range_goal', 'counter_attack_goal', 'header_goal', 'solo_goal'] as const;

// ── Formation Fit ──
/** Maximum bonus from perfect formation fit — mispositioned players are punished */
export const FORMATION_FIT_MAX_BONUS = 0.25;

// ── Attacker Selection ──
export const ATTACKER_POSITIONS = ['ST', 'LW', 'RW', 'CAM'] as const;
export const MIDFIELDER_POSITIONS = ['CM', 'LM', 'RM', 'CDM'] as const;
/** Per-position base weight for goal scoring selection — forwards >> mids >> defenders.
 *  GK is excluded from open-play scoring entirely (filtered before weighting). */
export const SCORER_POSITION_WEIGHTS: Record<string, number> = {
  ST: 4.0,
  LW: 3.5,
  RW: 3.5,
  CAM: 3.0,
  CM: 1.5,
  LM: 1.5,
  RM: 1.5,
  CDM: 0.7,
  LB: 0.2,
  RB: 0.2,
  CB: 0.15,
};
/** How much a player's shooting attribute (0–100) scales their goal weight on top of position */
export const SCORER_SHOOTING_INFLUENCE = 1.5;
/** Fitness bonus on top of position weight */
export const SCORER_FITNESS_INFLUENCE = 0.3;
/** Form bonus — form is 0-100, 50 is neutral. At extremes (form=0/100) shifts weight by ±0.75. */
export const SCORER_FORM_INFLUENCE = 1.5;

// ── Assist Selection ──
/** Probability of awarding an assist on a goal */
export const ASSIST_CHANCE = 0.78;
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
export const GK_SAVE_BASE = 0.18;
export const GK_SAVE_RANGE = 0.28;

// ── Tactical Familiarity ──
export const TACTICAL_FAMILIARITY_MULTIPLIER = 0.012;

// ── Home Advantage ──
export const HOME_ADVANTAGE = 1.15;

// ── Event Generation ──
export const BASE_EVENT_CHANCE = 0.35;
export const LATE_GAME_EVENT_BONUS = 0.10;
export const LATE_GAME_THRESHOLD_MINUTE = 85;
/** Max consecutive minutes without any event before commentary is injected */
export const COMMENTARY_GAP_MAX = 4;
/** Chance to generate a commentary event when event roll succeeds but no shot/foul/injury triggers */
export const COMMENTARY_CHANCE = 0.35;
/** Fraction of event rolls that become shot attempts */
export const SHOT_ATTEMPT_THRESHOLD = 0.52;
/** Fraction of event rolls between shots and fouls */
export const FOUL_THRESHOLD = 0.78;
/** Fraction of event rolls between fouls and non-foul injuries */
export const INJURY_EVENT_THRESHOLD = 0.81;

/** xG below this counts as a "speculative" shot — most don't reach the commentary feed.
 *  Stats (shot count, xG, momentum) still update; only the live commentary line is suppressed. */
export const LOW_XG_MISS_THRESHOLD = 0.06;
/** Chance a low-xG missed shot still surfaces in the commentary feed. */
export const LOW_XG_MISS_SHOW_CHANCE = 0.3;

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
// Bumped from 0.30 → 0.32 in Phase E.6 after the 5-season balance sim
// reported PL mean 2.58 g/m with two seasons dipping to 2.43/2.11. The
// ~7% lift centres the PL band more solidly inside the 2.6-2.9 target.
export const GOAL_CHANCE_ATTACK_MULT = 0.32;
export const GOAL_CHANCE_DEFENSE_MULT = 0.20;
export const GOAL_CHANCE_ATTACK_MOD_SCALE = 0.35;
export const GOAL_CHANCE_COUNTER_VULN_SCALE = 0.18;
export const GOAL_CHANCE_MIN = 0.008;

// ── Corner Chances ──
export const CORNER_FROM_SAVE_CHANCE = 0.35;
export const CORNER_FROM_MISS_CHANCE = 0.22;

// ── Cards / Fouls ──
export const CARD_BASE_CHANCE = 0.11;
export const STRAIGHT_RED_CHANCE = 0.008;
/** Strength penalty per player below full squad size (11). 10v11 = 0.88x strength */
export const RED_CARD_STRENGTH_PENALTY_PER_PLAYER = 0.12;
/** Momentum swing toward the opposing team after a red card (larger than yellow's 15) */
export const MOMENTUM_RED_CARD_SWING = 25;

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

// ── Stoppage Time ──
export const STOPPAGE_TIME_BASE = 1;
export const STOPPAGE_TIME_MAX_EXTRA = 3;
export const STOPPAGE_TIME_INJURY_ADD = 0.5;
export const STOPPAGE_TIME_CARD_ADD = 0.3;
export const STOPPAGE_TIME_GOAL_ADD = 0.4;
/** Hard ceiling on stoppage minutes per half. Real football rarely exceeds this. */
export const STOPPAGE_TIME_MAX = 7;

// ── National Team OVR → Strength mapping ──
// Converts a national squad's average overall rating into a 0..1 "strength"
// used by the background tournament simulator. A 40-OVR squad lands on
// NATIONAL_OVR_STR_MIN, a 100-OVR squad saturates at NATIONAL_OVR_STR_MAX.
export const NATIONAL_OVR_STR_MIN = 0.1;
export const NATIONAL_OVR_STR_MAX = 0.85;
/** Rating floor at which strength lands on NATIONAL_OVR_STR_MIN. */
export const NATIONAL_OVR_STR_FLOOR = 40;
/** Rating span across which strength interpolates MIN → MAX. */
export const NATIONAL_OVR_STR_RANGE = 60;

// ── Corner Goal ──
export const CORNER_GOAL_CHANCE = 0.12;
export const CORNER_GOAL_PHYSICAL_WEIGHT = 0.6;
export const CORNER_GOAL_DEFENDING_WEIGHT = 0.4;

// ── In-Match Fitness Degradation ──
export const FITNESS_DEGRADE_PER_MINUTE = 0.20;
export const FITNESS_DEGRADE_VARIANCE = 0.05;
export const LOW_FITNESS_SHOT_PENALTY = 0.15;
export const MATCH_LOW_FITNESS_THRESHOLD = 50;
export const LOW_FITNESS_INJURY_BONUS = 0.02;

// ── Tactical Fitness Drain Modifiers ──
/** Extra drain per pressing point above 50 (pressing 75 = +5% drain) */
export const PRESSING_FITNESS_DRAIN_PER_POINT = 0.002;
/** Pressing baseline — no extra drain at this level */
export const PRESSING_FITNESS_DRAIN_BASELINE = 50;
/** Fast tempo fitness drain multiplier */
export const TEMPO_FAST_FITNESS_DRAIN_MOD = 1.12;
/** Slow tempo fitness drain multiplier */
export const TEMPO_SLOW_FITNESS_DRAIN_MOD = 0.90;
/** Fatigue commentary threshold — average team fitness below this triggers commentary */
export const FATIGUE_COMMENTARY_THRESHOLD = 55;
/** Minimum minute for fatigue commentary to start appearing */
export const FATIGUE_COMMENTARY_MIN_MINUTE = 60;
/** Interval between fatigue commentary events (minutes) */
export const FATIGUE_COMMENTARY_INTERVAL = 10;

// ── Fouler Position Weights ──
export const FOULER_DEFENDER_WEIGHT = 3.0;
export const FOULER_MIDFIELDER_WEIGHT = 2.0;
export const FOULER_ATTACKER_WEIGHT = 1.0;

// ── Formation Matchup Matrix ──
export const FORMATION_MATCHUP: Record<string, Record<string, number>> = {
  '3-4-3': { '4-3-3': -0.06, '4-4-2': -0.04, '5-3-2': 0.06 },
  '3-5-2': { '4-3-3': -0.04, '3-4-3': 0.04 },
  '4-3-3': { '3-4-3': 0.06, '3-5-2': 0.04, '5-3-2': -0.04 },
  '4-4-2': { '3-4-3': 0.04, '4-2-3-1': -0.03 },
  '4-2-3-1': { '4-4-2': 0.03, '5-3-2': -0.04 },
  '4-1-4-1': { '4-3-3': 0.04, '3-4-3': 0.06 },
  '5-3-2': { '4-3-3': 0.04, '3-4-3': -0.06, '4-2-3-1': 0.04 },
};

// ── Defense Modifier Scaling ──
/** How much opponent's combined defensive mods dampen attack strength (0–1) */
export const DEFENSE_MODIFIER_SCALE = 0.3;

// ── Derby Modifiers ──
export const DERBY_EVENT_MOD_SCALE = 0.03;
export const DERBY_FOUL_MOD_SCALE = 0.06;
export const DERBY_CARD_MOD_SCALE = 0.05;

// ── Corner Header Goal ──
/** Minimum probability a header from a corner results in a goal */
export const CORNER_HEADER_MIN_CHANCE = 0.08;
/** Physical attribute scaling for corner header goal chance */
export const CORNER_HEADER_PHYSICAL_SCALE = 0.5;
/** Position-based weight multipliers for aerial contest at corners */
export const CORNER_HEADER_CB_MULT = 1.5;
export const CORNER_HEADER_ST_MULT = 1.4;
export const CORNER_HEADER_MID_MULT = 0.65;

// ── Team Viability ──
/** Minimum available players for a team to continue (FIFA Law 3: match abandoned below 7) */
export const MIN_PLAYERS_TO_CONTINUE = 7;

// ── Own Goals ──
/** Chance of an own goal per match event cycle (very low) */
export const OWN_GOAL_CHANCE = 0.003;

// ── Penalties ──
/** Chance a foul in a dangerous area becomes a penalty */
export const PENALTY_FROM_FOUL_CHANCE = 0.08;
/** Conversion rate for penalties */
export const PENALTY_CONVERSION_RATE = 0.76;

// ── Morale Performance Impact ──
/** How much morale deviation from baseline affects shot quality / defense (0–1) */
export const MORALE_PERFORMANCE_WEIGHT = 0.10;
/** Neutral morale level — above boosts performance, below penalizes */
export const MORALE_BASELINE = 50;

// ── Near-Miss Events ──
/** Chance that a missed shot becomes a dramatic woodwork hit */
export const WOODWORK_CHANCE = 0.12;
/** Chance that a saved shot becomes a goal-line clearance */
export const GOAL_LINE_CLEARANCE_CHANCE = 0.08;

// ── Key Moment Thresholds ──
export const KEY_MOMENT_LOSING_MINUTE = 70;
export const KEY_MOMENT_TIGHT_FINISH_MINUTE = 80;
/** Minute range for dominant possession key moment */
export const KEY_MOMENT_DOMINANT_POSSESSION_MIN = 30;
/** Possession share threshold to trigger dominant possession moment */
export const KEY_MOMENT_POSSESSION_THRESHOLD = 0.60;
/** Number of near-miss events against player's goal to trigger defensive warning */
export const KEY_MOMENT_NEAR_MISS_COUNT = 2;

// ── Manager Perks ──
export const DISCIPLINARIAN_CARD_REDUCTION = 0.30;

// ── Substitutions ──
export const MAX_SUBSTITUTIONS = 5;
/** Match fitness bonus when a substitute enters (simulates fresh legs off the bench) */
export const SUB_ENTRY_FITNESS_BOOST = 20;

// ── Smart Sub Thresholds ──
/** Don't suggest non-urgent subs before this minute */
export const SMART_SUB_MIN_MINUTE = 45;
/** When losing, start suggesting attacking subs after this minute */
export const SMART_SUB_LOSING_MINUTE = 55;
/** When winning, suggest defensive subs after this minute */
export const SMART_SUB_WINNING_LATE_MINUTE = 75;

// ── AI Substitution Logic ──
/** Minutes at which AI considers tactical substitutions */
export const AI_SUB_CHECK_MINUTES: number[] = [60, 70, 80];
/** Fitness threshold below which AI will sub a player */
export const AI_SUB_FITNESS_THRESHOLD = 45;
/** Chance AI makes a tactical sub at each check minute */
export const AI_TACTICAL_SUB_CHANCE = 0.7;

// ── Momentum System ──
/** How much momentum swings toward the scoring team after a goal (-100 to +100 scale) */
export const MOMENTUM_GOAL_SWING = 30;
/** Momentum gained by the saving team after a GK save */
export const MOMENTUM_SAVE_SWING = 8;
/** Momentum swing toward the non-fouling team after a card */
export const MOMENTUM_CARD_SWING = 15;
/** Momentum swing toward scoring team after a penalty goal */
export const MOMENTUM_PENALTY_SWING = 20;
/** Small momentum swing toward the team with the ball during commentary/possession events */
export const MOMENTUM_COMMENTARY_SWING = 5;
/** Small momentum swing toward the attacking team after a shot attempt (miss or woodwork) */
export const MOMENTUM_SHOT_ATTEMPT_SWING = 4;
/** Small momentum swing toward the fouled team after a foul (no card) */
export const MOMENTUM_FOUL_SWING = 3;
/** How much momentum decays back toward 0 each minute (natural regression) */
export const MOMENTUM_DECAY_PER_MINUTE = 2;
/** How much momentum affects the home/away strength ratio (0-1 scale, applied as %) */
export const MOMENTUM_STRENGTH_SCALE = 0.15;

// ── Substitution Freshness ──
/** Strength bonus for recently substituted players */
export const SUB_FRESHNESS_BONUS = 0.04;

// ── Set-Piece Taker Bonus ──
/** Bonus to corner goal chance when a designated set-piece taker delivers */
export const SET_PIECE_TAKER_CORNER_BONUS = 0.03;
/** Bonus to penalty conversion when a designated penalty taker shoots */
export const PENALTY_TAKER_BONUS = 0.05;

// ── Penalty Taker Auto-Selection ──
export const PENALTY_TAKER_SHOOTING_WEIGHT = 0.6;
export const PENALTY_TAKER_MENTAL_WEIGHT = 0.4;

// ── Set-Piece Taker Auto-Selection ──
export const SET_PIECE_TAKER_PASSING_WEIGHT = 0.5;
export const SET_PIECE_TAKER_SHOOTING_WEIGHT = 0.3;
export const SET_PIECE_TAKER_MENTAL_WEIGHT = 0.2;
/** Chance the designated set-piece taker becomes the scorer on free kicks */
export const FREE_KICK_SET_PIECE_TAKER_CHANCE = 0.7;

// ── Commentary ──
/** Minute threshold for "late game" commentary (slightly earlier than drama triggers) */
export const COMMENTARY_LATE_MINUTE = 80;
/** Chance gap-filler commentary uses a weather-specific pool (when weather != clear) */
export const WEATHER_COMMENTARY_CHANCE = 0.35;
/** Chance gap-filler commentary uses a derby-specific pool (when derbyIntensity > 0) */
export const DERBY_COMMENTARY_CHANCE = 0.40;
/** Chance a weather suffix is appended to event descriptions (saves, misses, fouls, goals) */
export const WEATHER_SUFFIX_CHANCE = 0.25;
/** Chance a derby suffix is appended to event descriptions (goals, fouls, yellow cards, saves) */
export const DERBY_SUFFIX_CHANCE = 0.30;

// ── Touchline Shouts ──
/** Duration (in minutes) a shout effect lasts */
export const SHOUT_DURATION = 5;
/** Cooldown (in minutes) between shouts */
export const SHOUT_COOLDOWN = 10;
/** Maximum shouts per match */
export const MAX_SHOUTS_PER_MATCH = 4;
/** Shout modifier values */
export const SHOUT_MODIFIERS = {
  push_forward: { attackMod: 0.15, defenseMod: -0.10, fitnessDrainMod: 1.20 },
  hold_the_line: { attackMod: -0.10, defenseMod: 0.15, fitnessDrainMod: 0.85 },
  calm_down: { cardReduction: 0.40, fitnessDrainMod: 0.90 },
  time_waste: { eventChanceReduction: 0.15, stoppageTimeAdd: 1, fitnessDrainMod: 1.05 },
} as const;

/** Scale factor for cumulative shout effects on second-half simulation (0.5 = half as strong as team talks) */
export const SHOUT_CUMULATIVE_SCALE = 0.5;

// ── Tactical Insight Thresholds ──
/** Minimum tactical bonus to show an insight pill */
export const TACTICAL_INSIGHT_MIN_BONUS = 0.06;
/** Interval (in minutes) between fitness snapshots attached to events */
export const FITNESS_SNAPSHOT_INTERVAL = 5;

// ── Weather & Pitch System ──
export const WEATHER_WEIGHTS: Record<string, number> = { clear: 0.55, rain: 0.25, snow: 0.08, wind: 0.12 };
export const PITCH_WEIGHTS: Record<string, number> = { excellent: 0.30, good: 0.45, poor: 0.20, waterlogged: 0.05 };
export const WEATHER_PASSING_MOD: Record<string, number> = { clear: 0, rain: -0.08, snow: -0.12, wind: -0.06 };
export const WEATHER_PACE_MOD: Record<string, number> = { clear: 0, rain: -0.04, snow: -0.10, wind: -0.02 };
export const WEATHER_FOUL_MOD: Record<string, number> = { clear: 0, rain: 0.04, snow: 0.06, wind: 0.02 };
export const PITCH_SHOT_MOD: Record<string, number> = { excellent: 0.02, good: 0, poor: -0.04, waterlogged: -0.08 };
export const WEATHER_GK_ERROR_MOD: Record<string, number> = { clear: 0, rain: 0.004, snow: 0.006, wind: 0.002 };

// ── New Event Type Chances ──
export const FREE_KICK_GOAL_CHANCE = 0.08;
export const LONG_RANGE_GOAL_CHANCE = 0.10;
export const COUNTER_ATTACK_GOAL_CHANCE = 0.12;
export const HEADER_GOAL_CHANCE = 0.06;
export const SOLO_GOAL_CHANCE = 0.06;
// Realistic GK errors that lead to a goal are rare (~1 per 4-6 matches across both sides).
// Base chance is evaluated ONCE per non-saved shot attempt; the effective rate is scaled
// down by the opposing GK's quality, so elite keepers make clangers roughly half as often.
export const GK_ERROR_BASE_CHANCE = 0.015;
export const GK_ERROR_MAX_CHANCE = 0.04;
/** Fraction of base chance removed for an elite GK (norm 1.0). Poor GKs pay full base. */
export const GK_ERROR_QUALITY_REDUCTION = 0.55;
export const VAR_CHECK_CHANCE = 0.12;
/** Chance that a VAR review actually disallows the goal (offside, handball, foul in buildup) */
export const VAR_DISALLOW_CHANCE = 0.08;

// ── AI Counter-Tactics ──
/** Chance of generating a tactical counter-insight comment at match start */
export const AI_COUNTER_INSIGHT_CHANCE = 0.7;
