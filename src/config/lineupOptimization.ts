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

// ── Smart Bench Sorting ──
/** Bonus per additional formation slot a bench player can cover (natural or compatible) */
export const BENCH_VERSATILITY_BONUS_PER_SLOT = 3;
/** Weight for fitness gap between bench player and the weakest positional starter they'd replace */
export const BENCH_FRESHNESS_DIFF_WEIGHT = 0.12;
/** Form threshold above which a bench player is considered "hot" / in-form */
export const BENCH_HIGH_FORM_THRESHOLD = 70;
/** Bonus for bench players with form above the hot threshold */
export const BENCH_HIGH_FORM_BONUS = 6;
/** Bonus for covering a starter who has 2+ yellow cards (suspension risk) */
export const BENCH_YELLOW_CARD_COVER_BONUS = 12;
/** Bonus for covering a starter with active reinjury risk */
export const BENCH_REINJURY_COVER_BONUS = 10;
/** Bonus for attacking-position bench players (game-changers when chasing) */
export const BENCH_ATTACKER_IMPACT_BONUS = 5;
/** Bonus for defensive-position bench players (protect-the-lead insurance) */
export const BENCH_DEFENDER_INSURANCE_BONUS = 4;
/** Weight for position-specific attribute impact score (shooting+pace for attackers, etc.) */
export const BENCH_ATTRIBUTE_IMPACT_WEIGHT = 0.08;
/** Age threshold below which bench players get a stamina/energy bonus */
export const BENCH_YOUNG_ENERGY_THRESHOLD = 26;
/** Bonus for younger bench players (more stamina for late-game impact) */
export const BENCH_YOUNG_ENERGY_BONUS = 2;
/** Tier score for emergency/coverage subs (high versatility + covers vulnerable starters) */
export const BENCH_TIER_EMERGENCY = 200;
/** Tier score for tactical impact subs (high form + freshness + quality) */
export const BENCH_TIER_IMPACT = 100;
/** Number of starters to consider as "most vulnerable" for sub-need analysis */
export const BENCH_VULNERABLE_STARTER_COUNT = 3;
/** Fitness threshold below which a starter is considered tired and needs cover */
export const BENCH_STARTER_TIRED_THRESHOLD = 70;
