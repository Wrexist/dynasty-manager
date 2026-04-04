/**
 * Lineup Optimization Configuration
 * Weights and penalties for auto-fill lineup scoring algorithm.
 */

// ── Player Scoring Weights ──
// Calibrated to match engine: baseStrength = avgOverall * (0.7 + fitness*0.2 + morale*0.1)
export const LINEUP_POSITIONAL_OVERALL_WEIGHT = 0.70;
export const LINEUP_FORM_WEIGHT = 12;
export const LINEUP_FITNESS_WEIGHT = 20;
export const LINEUP_MORALE_WEIGHT = 10;

// ── Position Match Bonuses/Penalties ──
// Match engine: formation fit = 0-25% team strength. Each of 10 outfield slots ≈ 2.5%.
export const LINEUP_NATURAL_POSITION_BONUS = 15;
export const LINEUP_COMPATIBLE_POSITION_BONUS = 8;
export const LINEUP_INCOMPATIBLE_POSITION_PENALTY = -40;

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
// Chemistry is 0-12% of match team strength — scale accordingly
// Raised from 100→250 so chemistry competes with form/fitness differences in optimization
export const LINEUP_CHEMISTRY_SCORE_SCALE = 250;

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
/** Number of starters to consider as "most vulnerable" for sub-need analysis */
export const BENCH_VULNERABLE_STARTER_COUNT = 3;
/** Fitness threshold below which a starter is considered tired and needs cover */
export const BENCH_STARTER_TIRED_THRESHOLD = 70;

// ── Position-Specific Fitness Overrides ──
// Match engine: attackers use shooting*0.6 + fitness*0.4 for goal selection → fitness is critical
export const POSITION_FITNESS_OVERRIDE: Record<string, number> = {
  'ST': 22, 'LW': 20, 'RW': 20, 'CAM': 18,   // Attackers: fitness = 40% of goal selection
  'CM': 15, 'CDM': 14, 'LM': 16, 'RM': 16,    // Midfield: balanced
  'CB': 12, 'LB': 14, 'RB': 14,                // Defenders: less fitness-dependent
  'GK': 8,                                       // GK: barely degrades in-match
};

// ── Match Context Adjustments ──
/** Per derby intensity level, penalty per low-temperament point (hot-headed = more cards in derbies) */
export const CONTEXT_DERBY_TEMPERAMENT_PENALTY_PER_INTENSITY = 2;
/** Temperament below this triggers penalty in derby matches */
export const CONTEXT_DERBY_TEMPERAMENT_THRESHOLD = 10;
/** Bonus for defensive positions in away matches (need solidity without home advantage) */
export const CONTEXT_AWAY_DEFENSIVE_BONUS = 2;
/** Extra morale weight for away matches (mental resilience) */
export const CONTEXT_AWAY_MORALE_EXTRA_WEIGHT = 3;
/** Bonus for high-appearance players in cup matches (experience under pressure) */
export const CONTEXT_CUP_EXPERIENCE_BONUS = 2;
/** Min appearances for cup experience bonus */
export const CONTEXT_CUP_EXPERIENCE_THRESHOLD = 30;
/** Fitness below this gets penalized when there's another match next week */
export const CONTEXT_CONGESTED_FITNESS_PENALTY_THRESHOLD = 75;
/** Penalty for tired players in congested fixture weeks */
export const CONTEXT_CONGESTED_FITNESS_PENALTY = -4;

// ── Opponent Style Counter Bonuses ──
/** Boost CBs/CDMs vs attacking/direct opponents */
export const CONTEXT_VS_ATTACKING_DEFENSIVE_BONUS = 3;
/** Boost CAM/CM creative players vs defensive opponents who park the bus */
export const CONTEXT_VS_DEFENSIVE_CREATIVE_BONUS = 3;
/** Boost physical+mental midfielders vs possession-based opponents */
export const CONTEXT_VS_POSSESSION_PRESSING_BONUS = 3;
/** Boost defenders vs counter-attack opponents */
export const CONTEXT_VS_COUNTER_DEFENSIVE_BONUS = 3;

// ── Leadership & Personality ──
/** Leadership trait above this gives starter bonus */
export const CONTEXT_LEADERSHIP_BONUS_THRESHOLD = 15;
/** Flat bonus for high-leadership starters (morale + cohesion) */
export const CONTEXT_LEADERSHIP_STARTER_BONUS = 2;

// ── Bench Context Adjustments ──
/** Bonus for calm bench players (temperament >= 14) per derby intensity level */
export const BENCH_DERBY_CALM_BONUS_PER_INTENSITY = 2;
/** Temperament threshold for a bench player to be considered "calm" in derby context */
export const BENCH_DERBY_CALM_THRESHOLD = 14;
/** Bonus for high-fitness bench players when congested fixtures detected */
export const BENCH_CONGESTED_HIGH_FITNESS_BONUS = 3;
/** Fitness threshold for congested fixture bench bonus */
export const BENCH_CONGESTED_FITNESS_THRESHOLD = 85;
/** Bonus for attacking bench players in cup matches (late-game drama potential) */
export const BENCH_CUP_ATTACKER_BONUS = 3;
/** Bonus for defensive bench players in away matches */
export const BENCH_AWAY_DEFENDER_BONUS = 2;

// ── Per-Slot Chemistry Affinity ──
/** Weight per chemistry link strength point when scoring a player for a specific formation slot */
export const LINEUP_SLOT_CHEMISTRY_WEIGHT = 3;
/** Max number of best-first bench-to-starter swap passes */
export const LINEUP_BENCH_SWAP_PASSES = 3;
