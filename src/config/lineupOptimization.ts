/**
 * Lineup Optimization Configuration
 * Weights and penalties for auto-fill lineup scoring algorithm.
 */

// ── Player Scoring Weights ──
// Calibrated to match engine: baseStrength = avgOverall * (0.7 + fitness*0.2 + morale*0.1)
export const LINEUP_POSITIONAL_OVERALL_WEIGHT = 0.85;
export const LINEUP_FORM_WEIGHT = 12;
export const LINEUP_FITNESS_WEIGHT = 8;
export const LINEUP_MORALE_WEIGHT = 10;

// ── Position Match Bonuses/Penalties ──
// Match engine: formation fit = 0-25% team strength. Each of 10 outfield slots ≈ 2.5%.
export const LINEUP_NATURAL_POSITION_BONUS = 15;
export const LINEUP_COMPATIBLE_POSITION_BONUS = 8;
export const LINEUP_INCOMPATIBLE_POSITION_PENALTY = -40;

// ── Fitness & Morale ──
export const LINEUP_LOW_FITNESS_EXTRA_PENALTY = -3;
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
// Lowered from 250→120 so rating clearly dominates; chemistry is a tiebreaker, not a driver
export const LINEUP_CHEMISTRY_SCORE_SCALE = 120;

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
export const BENCH_FRESHNESS_DIFF_WEIGHT = 0.08;
/** Fitness weight for bench candidate base rating (lower than starter to keep OVR dominant) */
export const BENCH_PLAYER_FITNESS_WEIGHT = 6;
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
  'ST': 10, 'LW': 9, 'RW': 9, 'CAM': 8,   // Attackers: fitness is a tiebreaker, not primary
  'CM': 6, 'CDM': 6, 'LM': 7, 'RM': 7,    // Midfield: balanced
  'CB': 5, 'LB': 6, 'RB': 6,               // Defenders: less fitness-dependent
  'GK': 3,                                   // GK: barely degrades in-match
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

// ── Set Piece Taker Bonuses ──
/** Bonus for designated corner/free-kick taker (engine: +3% corner goal chance) */
export const LINEUP_SET_PIECE_TAKER_BONUS = 6;
/** Bonus for designated penalty taker (engine: +5% penalty conversion) */
export const LINEUP_PENALTY_TAKER_BONUS = 6;

// ── Defensive Formation Bench Coverage ──
/** Bonus for bench players covering a defensive formation slot not covered by starters */
export const BENCH_DEFENSIVE_FORMATION_COVER_BONUS = 8;

/** Max number of best-first bench-to-starter swap passes */
export const LINEUP_BENCH_SWAP_PASSES = 3;

// ──────────────────────────────────────────────────────────────────────────
// Pro-tier "Smart" Optimizer Signals
// These factor in tactics, manager perks, threat profiles, fragility, and
// reputation gap. Calibrated to keep raw rating dominant; all signals are
// tiebreakers within the rating tier they apply to.
// ──────────────────────────────────────────────────────────────────────────

// ── Tactics-aware scoring ──
/** High-tempo passing/mental boost for midfielders & attackers (passing >= threshold) */
export const TACTICS_FAST_TEMPO_PASSING_THRESHOLD = 70;
export const TACTICS_FAST_TEMPO_PASSING_BONUS = 3;
/** Slow-tempo physical/mental boost for defenders (physical >= threshold) */
export const TACTICS_SLOW_TEMPO_PHYSICAL_THRESHOLD = 70;
export const TACTICS_SLOW_TEMPO_PHYSICAL_BONUS = 2;

/** High-press fitness penalty: per-point fitness gap below threshold, scaled by intensity */
export const TACTICS_HIGH_PRESS_INTENSITY_THRESHOLD = 65;
export const TACTICS_HIGH_PRESS_FITNESS_THRESHOLD = 80;
export const TACTICS_HIGH_PRESS_FITNESS_PENALTY_PER_POINT = 0.06;
/** Bonus for high-physical/mental midfielders/forwards under high pressing */
export const TACTICS_HIGH_PRESS_PHYS_MENTAL_THRESHOLD = 70;
export const TACTICS_HIGH_PRESS_PHYS_MENTAL_BONUS = 3;

/** High defensive line: penalize slow CBs (pace below threshold) */
export const TACTICS_HIGH_LINE_CB_PACE_THRESHOLD = 65;
export const TACTICS_HIGH_LINE_CB_SLOW_PENALTY = -6;
/** Deep defensive line: forgive slow CBs but boost defending/physical */
export const TACTICS_DEEP_LINE_CB_DEFENDING_THRESHOLD = 75;
export const TACTICS_DEEP_LINE_CB_BONUS = 2;

/** Wide width: boost pacy wide players (LM/RM/LW/RW/LB/RB with pace >= threshold) */
export const TACTICS_WIDE_WIDE_PLAYER_PACE_THRESHOLD = 75;
export const TACTICS_WIDE_WIDE_PLAYER_BONUS = 3;
/** Narrow width: boost central midfielders (passing/mental) */
export const TACTICS_NARROW_CENTRAL_BONUS = 2;

/** Attacking/all-out mentality: extra weight on attacker shooting+pace */
export const TACTICS_ATTACKING_MENTALITY_BONUS = 2;
export const TACTICS_ALL_OUT_ATTACK_MENTALITY_BONUS = 4;
/** Defensive/cautious mentality: extra weight on defender defending+physical */
export const TACTICS_DEFENSIVE_MENTALITY_BONUS = 3;
export const TACTICS_CAUTIOUS_MENTALITY_BONUS = 1;

// ── Goal-flavor threat profiles (match engine event types) ──
/** Long-range goal threshold (engine: shooting >= 75 unlocks long-range goals) */
export const THREAT_LONG_RANGE_SHOOTING_THRESHOLD = 75;
export const THREAT_LONG_RANGE_BONUS = 2;
/** Header threat threshold (engine: physical >= 70 unlocks header goals) */
export const THREAT_HEADER_PHYSICAL_THRESHOLD = 70;
/** Header threat bonus, scaled by tall-player factor */
export const THREAT_HEADER_BONUS = 2;
/** Tall-player threshold (heightCm) for additional aerial bonus */
export const THREAT_TALL_HEIGHT_CM = 188;
export const THREAT_TALL_BONUS = 1;
/** Solo goal threshold (engine: skillMoves >= 4 + pace >= 70 unlocks solo goals) */
export const THREAT_SOLO_SKILL_MOVES_THRESHOLD = 4;
export const THREAT_SOLO_PACE_THRESHOLD = 70;
export const THREAT_SOLO_BONUS = 3;
/** Free-kick threat threshold (engine: shooting >= 60 for FK goals) */
export const THREAT_FREEKICK_SHOOTING_THRESHOLD = 70;
export const THREAT_FREEKICK_BONUS = 2;
/** Skill moves >=4 boost shot quality by +0.02 in engine — bonus for attackers */
export const THREAT_SKILL_MOVES_THRESHOLD = 4;
export const THREAT_SKILL_MOVES_BONUS = 2;

// ── Big-match / reputation-gap awareness ──
/** Reputation difference (opponentRep - ourRep) above which we treat as a "big match" */
export const BIG_MATCH_REP_GAP_THRESHOLD = 8;
/** Mental attribute bonus per point above threshold for big matches (capped) */
export const BIG_MATCH_MENTAL_THRESHOLD = 70;
export const BIG_MATCH_MENTAL_BONUS = 2;
/** Leadership bonus added on top of base context leadership for big matches */
export const BIG_MATCH_LEADERSHIP_BONUS = 2;
/** Cup match: leadership matters even more */
export const CUP_LEADERSHIP_BONUS = 2;
/** Cup match boost for skill moves >=4 (cup moments) */
export const CUP_SKILL_MOVES_BONUS = 2;

// ── Tactical familiarity (low familiarity → prefer natural over compatible) ──
/** Tactical familiarity below which we add an extra penalty to compatible-only fits */
export const FAMILIARITY_LOW_THRESHOLD = 40;
/** Per-missing-familiarity-point penalty for compatible (non-natural) deployments */
export const FAMILIARITY_COMPATIBLE_PENALTY_PER_POINT = 0.10;

// ── Manager perk modifiers (perk-aware scoring) ──
/** disciplinarian: yellow-card penalties multiplied by this factor */
export const PERK_DISCIPLINARIAN_CARD_MULT = 0.5;
/** fitness_guru: low-fitness penalty multiplied by this factor */
export const PERK_FITNESS_GURU_FITNESS_MULT = 0.5;
/** motivator: low-morale penalty multiplied by this factor */
export const PERK_MOTIVATOR_MORALE_MULT = 0.5;
/** iron_will: wantsToLeave penalty multiplied by this factor */
export const PERK_IRON_WILL_UNHAPPY_MULT = 0.4;
/** set_piece_coach: extra bonus for designated set-piece taker (already +6, perk adds this) */
export const PERK_SET_PIECE_COACH_TAKER_BONUS = 4;

// ── Age + physical fragility (derived from match engine injury formula) ──
/** Age above which fragility starts to matter */
export const AGE_FRAGILITY_THRESHOLD = 31;
/** Per-year-over-threshold + low-physical penalty (engine: OLD_PLAYER_INJURY_BONUS + (100-physical)*0.0005) */
export const AGE_FRAGILITY_PENALTY_PER_YEAR = 0.5;
/** When physical is below this, we add a small reliability penalty */
export const FRAGILITY_LOW_PHYSICAL_THRESHOLD = 60;
export const FRAGILITY_LOW_PHYSICAL_PENALTY = -2;
/** Older players in congested fixtures take an extra rotation penalty */
export const AGE_CONGESTED_PENALTY = -2;
/** Older-and-tired players: age >= 33 + fitness < 80 in congested weeks */
export const AGE_CONGESTED_AGE_THRESHOLD = 33;
export const AGE_CONGESTED_FITNESS_THRESHOLD = 80;

// ── Bench: long-range / pace / closer profiles ──
/** Bench long-range threat bonus (CAM/CM with shooting >= threshold) */
export const BENCH_LONG_RANGE_THREAT_BONUS = 4;
/** Bench impact-pace bonus (LW/RW/ST with pace >= threshold) */
export const BENCH_IMPACT_PACE_THRESHOLD = 80;
export const BENCH_IMPACT_PACE_BONUS = 4;
/** Bench "closer" defender bonus (CB with physical+mental high) */
export const BENCH_CLOSER_PHYSICAL_THRESHOLD = 75;
export const BENCH_CLOSER_MENTAL_THRESHOLD = 70;
export const BENCH_CLOSER_BONUS = 4;
