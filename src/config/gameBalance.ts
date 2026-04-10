/**
 * Game Balance Configuration
 * Season structure, board confidence, player development, finances, and more.
 */

import type { PlayerAttributes, Position } from '@/types/game';

// ── Season Structure ──
export const TOTAL_WEEKS = 46;
export const STARTING_BOARD_CONFIDENCE = 50;
export const FRIENDLY_BOARD_CONFIDENCE_MULT = 0.25;
export const LINEUP_SIZE = 11;
export const LOW_FITNESS_THRESHOLD = 65;

// ── First Match Confidence Boost (Season 1 only) ──
export const FIRST_MATCH_ATTACK_BOOST = 0.08;
export const FIRST_MATCH_DEFENSE_BOOST = 0.05;

// ── Player Development: Growth ──
export const GROWTH_AGE_THRESHOLD = 24;
export const MAX_SEASON_GROWTH = 12;
export const GROWTH_BASE_CHANCE = 0.05;
export const GROWTH_POTENTIAL_GAP_FACTOR = 0.01;
// Diminishing returns for natural development (same formula as training)
export const DEV_DIMINISHING_RETURNS_CEILING = 100;
export const DEV_DIMINISHING_RETURNS_DIVISOR = 60;
export const PLAYING_TIME_BONUS_MAX = 0.20;
export const PLAYING_TIME_BONUS_PER_APP = 0.007;

// ── Player Development: Decline ──
export const DECLINE_AGE_THRESHOLD = 31;
export const STEEP_DECLINE_AGE_THRESHOLD = 33;
export const DECLINE_FACTOR_NORMAL = 0.015;
export const DECLINE_FACTOR_STEEP = 0.025;
export const DECLINE_BASE_CHANCE = 0.03;
/** Pace/physical decline 1.5x faster, mental declines 0.5x */
export const DECLINE_ATTR_MULTIPLIERS: Record<keyof PlayerAttributes, number> = {
  pace: 1.5, physical: 1.5, mental: 0.5,
  shooting: 1.0, passing: 1.0, defending: 1.0,
};

// ── Position-Specific Development Bonuses ──
export const POSITION_DEV_BONUS: Record<string, Partial<Record<keyof PlayerAttributes, number>>> = {
  'GK':  { defending: 0.03, mental: 0.02 },
  'CB':  { defending: 0.03, physical: 0.02, mental: 0.01 },
  'LB':  { pace: 0.02, defending: 0.02, physical: 0.01 },
  'RB':  { pace: 0.02, defending: 0.02, physical: 0.01 },
  'CDM': { defending: 0.02, passing: 0.02, mental: 0.01 },
  'CM':  { passing: 0.03, mental: 0.02 },
  'CAM': { passing: 0.02, shooting: 0.02, mental: 0.01 },
  'LM':  { pace: 0.02, passing: 0.02 },
  'RM':  { pace: 0.02, passing: 0.02 },
  'LW':  { pace: 0.03, shooting: 0.02 },
  'RW':  { pace: 0.03, shooting: 0.02 },
  'ST':  { shooting: 0.03, physical: 0.01, pace: 0.01 },
};

// ── Value Age Multipliers (calibrated to real transfer market age curves) ──
export const VALUE_AGE_MULTIPLIERS = [
  { maxAge: 18, multiplier: 0.30 },   // Very young prospect
  { maxAge: 20, multiplier: 0.50 },   // Young prospect
  { maxAge: 22, multiplier: 0.75 },   // Emerging talent
  { maxAge: 24, multiplier: 0.90 },   // Rising player
  { maxAge: 27, multiplier: 1.00 },   // Prime peak
  { maxAge: 29, multiplier: 0.85 },   // Late prime
  { maxAge: 31, multiplier: 0.60 },   // Declining
  { maxAge: 33, multiplier: 0.35 },   // Veteran
  { maxAge: Infinity, multiplier: 0.15 },  // End of career
] as const;

// ── Board Confidence ──
export const CONFIDENCE_WIN_CHANGE = 4;
export const CONFIDENCE_LOSS_CHANGE = -5;
export const CONFIDENCE_DRAW_CHANGE = 0;
export const CONFIDENCE_POSITION_BONUS = 2;
export const CONFIDENCE_POSITION_PENALTY = -2;
export const CONFIDENCE_POSITION_PENALTY_THRESHOLD = -3;
export const CONFIDENCE_BUDGET_PENALTY = -2;
export const CONFIDENCE_BUDGET_THRESHOLD = -5_000_000;
export const CONFIDENCE_WIN_STREAK_BONUS = 3;
export const CONFIDENCE_LOSS_STREAK_PENALTY = -7;
export const CONFIDENCE_STREAK_LENGTH = 3;
export const CONFIDENCE_WARNING_THRESHOLD = 25;
export const CONFIDENCE_PLEASED_THRESHOLD = 80;
export const CONFIDENCE_MIN = 10;
export const CONFIDENCE_MAX = 100;

// ── Expected Position by Reputation ──
const EXPECTED_POSITION_BY_REP: { minRep: number; expectedPos: number }[] = [
  { minRep: 5, expectedPos: 3 },
  { minRep: 4, expectedPos: 8 },
  { minRep: 3, expectedPos: 12 },
  { minRep: 0, expectedPos: 17 },
];

export function getExpectedPosition(reputation: number): number {
  for (const entry of EXPECTED_POSITION_BY_REP) {
    if (reputation >= entry.minRep) return entry.expectedPos;
  }
  return 17;
}

// ── Match Result Impact ──
export const FITNESS_DRAIN_PER_MATCH = -15;
export const FITNESS_MIN_POST_MATCH = 40;
export const MORALE_WIN_CHANGE = 8;
export const MORALE_LOSS_CHANGE = -10;
export const FORM_WIN_CHANGE = 5;
export const FORM_LOSS_CHANGE = -8;
export const FORM_DRAW_CHANGE = -2;

// ── Injury ──
export const MATCH_INJURY_WEEKS_MIN = 1;
export const MATCH_INJURY_WEEKS_RANGE = 4;
export const RED_CARD_SUSPENSION_MIN = 1;
export const RED_CARD_SUSPENSION_RANGE = 2;

// ── Physio / Staff ──
export const PHYSIO_RECOVERY_BOOST_THRESHOLD = 7;
/** Probability per week that a good physio triggers +1 recovery (instead of guaranteed) */
export const PHYSIO_RECOVERY_CHANCE = 0.4;
export const PHYSIO_INJURY_REDUCTION_PER_QUALITY = 0.05;
export const ASSISTANT_MANAGER_FAMILIARITY_BOOST = 0.5;

// ── Contract Warnings ──
export const CONTRACT_WARNING_WEEKS = [15, 25, 30, 35] as const;
export const CONTRACT_WARNING_OVERALL_THRESHOLD = 60;
/** Warn about high-potential youth even if below overall threshold */
export const CONTRACT_WARNING_YOUTH_AGE_MAX = 23;
export const CONTRACT_WARNING_YOUTH_POTENTIAL_MIN = 70;
export const CONTRACT_MORALE_HIT_WEEK_THRESHOLD = 25;
export const CONTRACT_MORALE_HIT_OVERALL_THRESHOLD = 70;
export const CONTRACT_MORALE_HIT_AMOUNT = -5;
export const CONTRACT_MORALE_MIN = 20;

// ── Income ──
export const MATCHDAY_INCOME_PER_FAN = 50000;
export const COMMERCIAL_INCOME_PER_REP = 200000;
/** Base weekly income floor so lower-league clubs can still compete */
export const COMMERCIAL_INCOME_BASE = 100000;
export const STADIUM_INCOME_PER_LEVEL = 20000;
export const POSITION_PRIZE_PER_RANK = 15000;
export const POSITION_PRIZE_MAX_RANK = 21;
export const SCOUTING_COST_PER_ASSIGNMENT = 25000;
export const FAN_MOOD_BASE = 0.8;
export const FAN_MOOD_SCALE = 0.4;

// ── Facility Upgrade ──
export const FACILITY_COST_PER_LEVEL = 5_000_000;
export const FACILITY_BASE_UPGRADE_WEEKS = 2;
export const FACILITY_MAX_LEVEL = 10;

// ── Stadium Stand Upgrade ──
export const STAND_COST_PER_LEVEL = 1_500_000;       // £1.5M per stand level
export const STAND_BASE_UPGRADE_WEEKS = 1;            // 1 week base + stand level

// ── Initial Facilities ──
export const STADIUM_LEVEL_DIVISOR = 10;
export const MEDICAL_LEVEL_FACTOR = 0.8;
export const RECOVERY_LEVEL_FACTOR = 0.6;
export const RECOVERY_FITNESS_BONUS_PER_LEVEL = 1.0;

// ── Season-End Confidence by Verdict ──
export const SEASON_END_CONFIDENCE: Record<string, number> = {
  excellent: 80,
  good: 65,
  acceptable: 50,
  poor: 30,
  sacked: 10,
} as const;

// ── Replacement Players ──
export const TARGET_TEMPLATE: Record<string, number> = {
  'GK': 2, 'CB': 5, 'LB': 2, 'RB': 2, 'CDM': 1, 'CM': 5, 'CAM': 1, 'LW': 2, 'RW': 2, 'ST': 3,
};
export const MIN_SQUAD_SIZE = 22;
export const MAX_SQUAD_SIZE = 32;
export const REPLACEMENT_QUALITY_REP_MULTIPLIER = 10;
export const REPLACEMENT_QUALITY_BASE = 20;
export const REPLACEMENT_QUALITY_VARIANCE = 15;
export const GENERIC_FILL_POSITIONS: Position[] = ['CM', 'CB', 'ST', 'LW', 'RW'];

// ── Transfer Market Listing ──
export const LISTING_PRICE_MIN_MULTIPLIER = 1.1;
export const LISTING_PRICE_RANDOM_RANGE = 0.4;
export const INITIAL_LISTINGS_MIN = 2;
export const INITIAL_LISTINGS_RANGE = 3;

// ── Youth Intake at Season End ──
export const SEASON_YOUTH_INTAKE_MIN = 2;
export const SEASON_YOUTH_INTAKE_RANGE = 3;

// ── Starting Tactical Familiarity ──
export const STARTING_TACTICAL_FAMILIARITY = 45;

// ── Max Messages ──
export const MAX_MESSAGES = 200;

// ── State Growth Caps ──
export const MAX_FINANCE_HISTORY = 200;
export const MAX_CAREER_TIMELINE = 100;

// ── Loan Development ──
export const LOAN_PLAY_CHANCE_HIGH = 0.7;
export const LOAN_PLAY_CHANCE_LOW = 0.4;
export const LOAN_DEV_BASE_CHANCE = 0.03;
export const LOAN_DEV_REP_FACTOR = 0.005;
export const LOAN_QUALITY_FORMULA_REP_MULT = 10;
export const LOAN_QUALITY_FORMULA_BASE = 30;
export const LOAN_FITNESS_DRAIN = 8;
export const LOAN_YOUNG_AGE_THRESHOLD = 24;

// ── Congested Fixture Injury Risk ──
export const CONGESTED_FIXTURE_INJURY_MULTIPLIER = 1.3;

// ── Cup Draw Resolution ──
export const CUP_EXTRA_TIME_GOAL_CHANCE = 0.35;
export const CUP_PENALTY_WIN_CHANCE = 0.5;
export const CUP_PENALTY_GK_QUALITY_FACTOR = 0.15;
export const CUP_PENALTY_KICKS = 5;

// ── Morale: Match Appearances ──
export const MORALE_APPEARANCE_BOOST = 2;

// ── AI Loan Offers ──
export const AI_LOAN_OFFER_CHANCE = 0.08;
export const AI_LOAN_DURATIONS = [12, 16, 20, 24] as const;
export const AI_LOAN_WAGE_SPLITS = [50, 60, 75, 100] as const;
export const AI_LOAN_RECALL_CLAUSE_CHANCE = 0.4;
export const AI_LOAN_OBLIGATORY_BUY_CHANCE = 0.2;
export const AI_LOAN_OBLIGATORY_BUY_MULTIPLIER = 0.8;

// ── Win Streak Bonuses ──
export const STREAK_MORALE_THRESHOLD = 3;
export const STREAK_MORALE_BONUS = 3;
export const STREAK_INCOME_THRESHOLD = 5;
export const STREAK_INCOME_MULTIPLIER = 0.05; // +5% matchday income
export const STREAK_FORM_THRESHOLD = 8;
export const STREAK_FORM_BONUS = 3;

// ── Morale: Benched Players ──
export const MORALE_BENCH_WEEKLY_LOSS = 2;
export const MORALE_BENCH_MIN = 20;

// ── Board Mid-Season Review ──
export const BOARD_REVIEW_WEEKS = [15, 30];
export const BOARD_REVIEW_RELAX_THRESHOLD = -5;
export const BOARD_REVIEW_RAISE_THRESHOLD = 5;
export const BOARD_REVIEW_ADJUST_POSITIONS = 2;

// ── Board Objective Rewards ──
export const BOARD_OBJ_XP_CRITICAL = 40;
export const BOARD_OBJ_XP_IMPORTANT = 25;
export const BOARD_OBJ_XP_OPTIONAL = 15;
export const BOARD_OBJ_XP_OVERACHIEVE_MULT = 2;
export const BOARD_OBJ_BUDGET_BOOST = 2_000_000;
export const BOARD_OBJ_ALL_COMPLETE_XP = 50;
export const BOARD_OBJ_ALL_COMPLETE_CONFIDENCE = 8;

// ── Fan Confidence Formula ──
export const FAN_CONFIDENCE_FAN_WEIGHT = 0.5;
export const FAN_CONFIDENCE_BOARD_WEIGHT = 0.5;

// ── Manager Perks ──
export const MOTIVATOR_MORALE_BOOST = 5;
export const YOUTH_DEVELOPER_BOOST = 0.25;

// ── Press Conferences ──
export const PRESS_TRANSFER_RUMOUR_CHANCE = 0.3;
export const PRESS_POOR_FORM_LOSSES = 3;
export const PRESS_GOOD_FORM_WINS = 4;
export const PRESS_BIG_MATCH_REP_GAP = 2;
export const PRESS_PROMOTION_RACE_TOP_N = 3;       // top N positions to trigger promotion_race
export const PRESS_RELEGATION_BATTLE_BOTTOM_N = 3;  // bottom N positions to trigger relegation_battle
export const PRESS_INJURY_CRISIS_MIN = 3;            // minimum injured players to trigger injury_crisis
export const PRESS_DERBY_PREVIEW_CHANCE = 0.6;       // chance of derby_preview context before derby

// ── Injury Types & Severity ──
import type { InjuryType, InjurySeverity } from '@/types/game';

interface InjuryTypeConfig {
  /** Display name */
  label: string;
  /** Weeks range by severity */
  weeks: Record<InjurySeverity, [number, number]>;
  /** Re-injury risk (0-1) by severity */
  reinjuryRisk: Record<InjurySeverity, number>;
  /** Weeks of elevated re-injury risk after return */
  reinjuryDuration: Record<InjurySeverity, number>;
  /** Fitness on return (0-100) by severity */
  fitnessOnReturn: Record<InjurySeverity, number>;
  /** Whether this injury type is caused by fouls (vs non-contact) */
  foulRelated: boolean;
}

export const INJURY_TYPES: Record<InjuryType, InjuryTypeConfig> = {
  knock: {
    label: 'Knock',
    weeks: { minor: [1, 1], moderate: [1, 2], severe: [2, 3] },
    reinjuryRisk: { minor: 0.05, moderate: 0.08, severe: 0.12 },
    reinjuryDuration: { minor: 2, moderate: 3, severe: 4 },
    fitnessOnReturn: { minor: 85, moderate: 75, severe: 65 },
    foulRelated: true,
  },
  muscle_strain: {
    label: 'Muscle Strain',
    weeks: { minor: [1, 2], moderate: [2, 3], severe: [3, 5] },
    reinjuryRisk: { minor: 0.08, moderate: 0.15, severe: 0.22 },
    reinjuryDuration: { minor: 3, moderate: 4, severe: 6 },
    fitnessOnReturn: { minor: 80, moderate: 70, severe: 55 },
    foulRelated: false,
  },
  hamstring: {
    label: 'Hamstring Injury',
    weeks: { minor: [2, 3], moderate: [3, 5], severe: [5, 8] },
    reinjuryRisk: { minor: 0.12, moderate: 0.20, severe: 0.30 },
    reinjuryDuration: { minor: 4, moderate: 6, severe: 8 },
    fitnessOnReturn: { minor: 75, moderate: 60, severe: 50 },
    foulRelated: false,
  },
  ligament: {
    label: 'Ligament Damage',
    weeks: { minor: [3, 5], moderate: [5, 10], severe: [10, 16] },
    reinjuryRisk: { minor: 0.10, moderate: 0.18, severe: 0.25 },
    reinjuryDuration: { minor: 4, moderate: 6, severe: 10 },
    fitnessOnReturn: { minor: 70, moderate: 55, severe: 45 },
    foulRelated: true,
  },
  fracture: {
    label: 'Fracture',
    weeks: { minor: [4, 6], moderate: [6, 10], severe: [10, 16] },
    reinjuryRisk: { minor: 0.05, moderate: 0.08, severe: 0.10 },
    reinjuryDuration: { minor: 3, moderate: 4, severe: 6 },
    fitnessOnReturn: { minor: 65, moderate: 50, severe: 40 },
    foulRelated: true,
  },
  concussion: {
    label: 'Concussion',
    weeks: { minor: [1, 2], moderate: [2, 4], severe: [4, 6] },
    reinjuryRisk: { minor: 0.15, moderate: 0.25, severe: 0.35 },
    reinjuryDuration: { minor: 4, moderate: 6, severe: 8 },
    fitnessOnReturn: { minor: 80, moderate: 70, severe: 60 },
    foulRelated: true,
  },
  acl: {
    label: 'ACL Injury',
    weeks: { minor: [12, 16], moderate: [16, 24], severe: [24, 36] },
    reinjuryRisk: { minor: 0.15, moderate: 0.25, severe: 0.35 },
    reinjuryDuration: { minor: 8, moderate: 12, severe: 16 },
    fitnessOnReturn: { minor: 55, moderate: 40, severe: 30 },
    foulRelated: false,
  },
};

/** Probability weights for injury type selection (foul-related) */
export const FOUL_INJURY_TYPE_WEIGHTS: Record<string, number> = {
  knock: 40, fracture: 20, concussion: 15, ligament: 15, muscle_strain: 10,
};

/** Probability weights for injury type selection (non-foul) */
export const NON_FOUL_INJURY_TYPE_WEIGHTS: Record<string, number> = {
  muscle_strain: 35, hamstring: 30, knock: 15, ligament: 10, acl: 5, concussion: 5,
};

/** Severity distribution */
export const INJURY_SEVERITY_WEIGHTS: Record<InjurySeverity, number> = {
  minor: 50, moderate: 35, severe: 15,
};

/** How much medical facility level reduces match injury probability (per level, 1-10) */
export const MEDICAL_INJURY_PREVENTION_PER_LEVEL = 0.015;

/** How much medical facility level reduces re-injury risk (per level, 1-10) */
export const MEDICAL_REINJURY_REDUCTION_PER_LEVEL = 0.02;

/** Re-injury chance multiplier when a player with active reinjuryRisk plays a match */
export const REINJURY_MATCH_CHECK_CHANCE = 0.5;

// ── Financial Fair Play ──
/** Wage-to-revenue ratio that triggers a warning */
export const FFP_WAGE_RATIO_WARNING = 0.70;
/** Wage-to-revenue ratio that triggers critical penalties */
export const FFP_WAGE_RATIO_CRITICAL = 0.90;
/** Board confidence penalty per week when above warning threshold */
export const FFP_CONFIDENCE_PENALTY = 3;
/** Board confidence penalty per week when above critical threshold */
export const FFP_CRITICAL_CONFIDENCE_PENALTY = 6;

// ── Manager Salary Impact ──
/** Manager salary-to-income ratio that triggers a board warning */
export const MANAGER_SALARY_RATIO_WARNING = 0.15;
/** Manager salary-to-income ratio that triggers critical board concern */
export const MANAGER_SALARY_RATIO_CRITICAL = 0.25;
/** Board confidence penalty per week when manager salary ratio exceeds warning threshold */
export const MANAGER_SALARY_CONFIDENCE_PENALTY = 1;

// ── Training Focus Development ──
// MODULE_ATTR_MAP and TRAINING_FOCUS_BONUS are now in src/config/training.ts (single source of truth)

// ── Player Unhappiness ──
/** Morale threshold below which unhappiness weeks accumulate */
export const UNHAPPY_THRESHOLD = 30;
/** Weeks of low morale before player submits transfer request */
export const UNHAPPY_WEEKS_TO_REQUEST = 4;
/** Weeks of low morale before unhappiness spreads to teammates */
export const UNHAPPY_CONTAGION_WEEKS = 6;
/** Performance penalty for players wanting to leave (0-1) */
export const UNHAPPY_PERFORMANCE_PENALTY = 0.15;
/** Morale hit to random teammates from contagion */
export const UNHAPPY_CONTAGION_MORALE_HIT = 6;
/** Chance (0-1) that listing an unhappy player appeases them (loyalty-weighted) */
export const APPEASE_BASE_CHANCE = 0.12;
/** Morale boost when an unhappy player is appeased by being listed */
export const APPEASE_MORALE_BOOST = 25;

// ── Transfer Talk ──
/** Base chance (0-1) that "convince to stay" succeeds */
export const TRANSFER_TALK_CONVINCE_BASE_CHANCE = 0.42;
/** Bonus to convince chance per point of player loyalty (scaled by 20) */
export const TRANSFER_TALK_CONVINCE_LOYALTY_BONUS = 0.25;
/** Morale penalty when manager refuses transfer request */
export const TRANSFER_TALK_REFUSE_MORALE_PENALTY = 15;
/** Team-wide morale hit when manager refuses a transfer request */
export const TRANSFER_TALK_REFUSE_TEAM_MORALE_HIT = 3;
/** Morale boost when empathizing with player's transfer request */
export const TRANSFER_TALK_EMPATHIZE_MORALE_BOOST = 5;
/** Morale boost when promising to find player a move */
export const TRANSFER_TALK_PROMISE_MORALE_BOOST = 8;
/** Morale boost when convince-to-stay succeeds */
export const TRANSFER_TALK_CONVINCE_SUCCESS_MORALE = 15;
/** Morale penalty when convince-to-stay fails */
export const TRANSFER_TALK_CONVINCE_FAIL_MORALE = 5;

// ── Free Agent Market ──
/** Maximum free agents in the pool at any time */
export const FREE_AGENT_POOL_MAX = 80;
// ── Cliffhanger System ──
/** Maximum number of cliffhangers shown per week */
export const MAX_CLIFFHANGERS = 3;
/** Points gap to leader that triggers title race cliffhanger */
export const CLIFFHANGER_TITLE_RACE_GAP = 6;
/** Minimum reputation gap for "big match" cliffhanger */
export const CLIFFHANGER_BIG_MATCH_REP_GAP = 2;
/** Board confidence threshold below which board pressure cliffhangers trigger */
export const CLIFFHANGER_BOARD_PRESSURE_THRESHOLD = 35;
/** Youth prospect potential gap that triggers breakthrough cliffhanger */
export const CLIFFHANGER_YOUTH_POTENTIAL_GAP = 8;
/** Weeks before transfer window closes that triggers deadline cliffhanger */
export const CLIFFHANGER_DEADLINE_WEEKS = 2;

// ── Monthly Objective Cycle ──
/** Number of weeks per monthly objective cycle */
export const OBJECTIVE_CYCLE_WEEKS = 4;

// ── Variable Reward Objectives ──
/** Chance that a rare objective appears (replaces one common objective) */
export const RARE_OBJECTIVE_CHANCE = 0.15;
/** Chance that a legendary objective appears (replaces one common objective) */
export const LEGENDARY_OBJECTIVE_CHANCE = 0.05;
/** XP multiplier for rare objectives */
export const RARE_OBJECTIVE_XP_MULTIPLIER = 2;
/** XP multiplier for legendary objectives */
export const LEGENDARY_OBJECTIVE_XP_MULTIPLIER = 5;
/** Consecutive months with all objectives completed required for streak multiplier */
export const OBJECTIVE_STREAK_THRESHOLD = 3;
/** XP multiplier when on a streak */
export const OBJECTIVE_STREAK_MULTIPLIER = 2;
/** Bonus XP for completing all 3 objectives in a month */
export const ALL_OBJECTIVES_BONUS_XP = 25;

// ── Coach Checklist XP Rewards ──
export const COACH_TASK_XP: Record<string, number> = {
  'lineup': 5,
  'first-match': 10,
  'objectives': 10,
  'scouting': 5,
  'contracts': 5,
  'transfers': 5,
  'inbox': 5,
};
/** Bonus XP for completing ALL coach checklist tasks */
export const COACH_ALL_TASKS_BONUS_XP = 15;

// ── Achievement XP Rewards ──
export const ACHIEVEMENT_XP_BRONZE = 15;
export const ACHIEVEMENT_XP_SILVER = 30;
export const ACHIEVEMENT_XP_GOLD = 50;

// ── Match Drama Detection ──
/** Minute threshold for "late" events */
export const DRAMA_LATE_MINUTE = 85;
/** Goal margin threshold for "thrashing" */
export const DRAMA_THRASHING_MARGIN = 4;
/** Reputation gap for underdog detection */
export const DRAMA_UNDERDOG_REP_GAP = 2;

// ── Celebration Milestones ──
export const GOAL_MILESTONES = [10, 15, 20, 25, 30] as const;
export const ASSIST_MILESTONES = [10, 15, 20] as const;
export const UNBEATEN_MILESTONES = [5, 10, 15, 20] as const;
export const WIN_MILESTONES = [3, 5, 8, 10] as const;
export const CLEAN_SHEET_MILESTONES = [5, 10, 15] as const;
export const CAREER_GOAL_MILESTONES = [50, 100, 200] as const;
export const CAREER_APP_MILESTONES = [100, 200, 500] as const;

// ── Loan Recall ──
export const LOAN_MIN_WEEKS_BEFORE_RECALL = 4;

// ── Manager XP ──
export const MANAGER_XP_BASE = 50;
export const MANAGER_XP_PER_LEVEL = 30;

// ── Talent Tree ──
export const CAPSTONE_MIN_BRANCHES = 2;
export const TRAINING_GROUND_BOOST = 0.2;
export const GOLDEN_GEN_MIN_POTENTIAL = 75;

// ── Dashboard UI ──
export const CONFIDENCE_CHANGE_DISMISS_THRESHOLD = 5;

// ── International / National Team ──
/** World Cup occurs every N seasons */
export const WORLD_CUP_FREQUENCY = 4;
/** Continental cup occurs every N seasons (offset by 2 from WC) */
export const CONTINENTAL_CUP_FREQUENCY = 4;
/** Number of groups in the World Cup */
export const WORLD_CUP_GROUPS = 8;
/** Teams per group */
export const WORLD_CUP_TEAMS_PER_GROUP = 4;
/** Number of groups in Continental Cup */
export const CONTINENTAL_CUP_GROUPS = 4;
/** National team squad size */
export const NATIONAL_SQUAD_SIZE = 23;
/** Target size for national team candidate pool (generated on job acceptance) */
export const NT_CANDIDATE_POOL_TARGET = 50;
/** Morale boost for players called up to national team */
export const NATIONAL_CALLUP_MORALE_BOOST = 5;
/** Fitness cost per international match */
export const INTERNATIONAL_FITNESS_COST = 8;

// ── National Team Job System (Career Mode) ──
/** Minimum reputation to receive first national team offer */
export const NT_JOB_MIN_REPUTATION = 350;
/** Minimum reputation to be re-offered after being sacked */
export const NT_JOB_REHIRE_REPUTATION = 550;
/** Weeks before the offer expires */
export const NT_JOB_OFFER_DURATION_WEEKS = 8;
/** Reputation bonus for winning an international tournament */
export const REP_INTL_TOURNAMENT_WIN = 100;
/** Reputation bonus for reaching the final */
export const REP_INTL_FINAL = 40;
/** Reputation bonus for reaching the semi-final */
export const REP_INTL_SEMI = 20;
/** Reputation bonus for reaching knockouts */
export const REP_INTL_KNOCKOUT = 10;
/** Reputation penalty for group stage exit */
export const REP_INTL_GROUP_EXIT = -15;
/** Consecutive group-stage exits before sacking */
export const NT_SACK_GROUP_EXIT_THRESHOLD = 2;

// ── Random Mid-Season Events ──
/** Base chance per week that a random event triggers */
export const RANDOM_EVENT_BASE_CHANCE = 0.04;
/** Morale hit from dressing room bust-up */
export const BUSTUP_MORALE_HIT = 10;
/** Fitness penalty from international fatigue */
export const INTL_FATIGUE_FITNESS_LOSS = 15;
/** Morale boost from fan favourite momentum */
export const FAN_RALLY_MORALE_BOOST = 5;
/** Budget bonus multiplier for sponsor windfall (fraction of commercial income) */
export const SPONSOR_BONUS_MULTIPLIER = 0.10;
/** Extra board confidence penalty during media scrutiny */
export const MEDIA_SCRUTINY_CONFIDENCE_HIT = 3;

// ── Player Match History ──
export const MAX_PLAYER_MATCH_HISTORY = 20;

// ── Ballon d'Or ──
export const BALLON_DOR_TOP_N = 25;
/** Weights for the Ballon d'Or scoring formula */
export const BALLON_DOR_WEIGHTS = {
  overall: 1.5,
  goals: 3.0,
  assists: 2.0,
  appearances: 0.5,
  form: 0.5,
  teamPosition: 1.0,
  cleanSheets: 1.0,
  avgRating: 3.0,
  discipline: 1.0,
  divisionTier: 1.0,
  continentalBonus: 1.0,
} as const;
export const BALLON_DOR_POSITION_MULTIPLIERS: Record<string, { goals: number; assists: number; cleanSheets: number }> = {
  GK: { goals: 4.0, assists: 2.0, cleanSheets: 2.0 }, CB: { goals: 3.5, assists: 1.5, cleanSheets: 1.5 },
  LB: { goals: 3.0, assists: 2.0, cleanSheets: 1.2 }, RB: { goals: 3.0, assists: 2.0, cleanSheets: 1.2 },
  CDM: { goals: 2.5, assists: 2.0, cleanSheets: 0.5 }, CM: { goals: 2.0, assists: 2.5, cleanSheets: 0 },
  CAM: { goals: 1.5, assists: 2.5, cleanSheets: 0 }, LM: { goals: 1.5, assists: 2.5, cleanSheets: 0 },
  RM: { goals: 1.5, assists: 2.5, cleanSheets: 0 }, LW: { goals: 1.2, assists: 2.0, cleanSheets: 0 },
  RW: { goals: 1.2, assists: 2.0, cleanSheets: 0 }, ST: { goals: 1.0, assists: 1.5, cleanSheets: 0 },
};
export const BALLON_DOR_YELLOW_PENALTY = 0.3;
export const BALLON_DOR_RED_PENALTY = 3.0;
export const BALLON_DOR_DIVISION_BONUS: Record<number, number> = { 1: 20, 2: 12, 3: 6, 4: 0 };

/** Milestone descriptions shown on facility cards at key levels */
export const FACILITY_MILESTONES: Record<string, { level: number; label: string }[]> = {
  training: [
    { level: 3, label: 'Advanced drills unlocked' },
    { level: 5, label: '+100% training effectiveness' },
    { level: 7, label: 'Elite coaching methods' },
    { level: 10, label: 'World-class facility' },
  ],
  youth: [
    { level: 3, label: 'Better prospect intake' },
    { level: 5, label: 'Academy sponsor slot' },
    { level: 7, label: 'Elite development rate' },
    { level: 10, label: 'World-class academy' },
  ],
  medical: [
    { level: 3, label: 'Faster recovery times' },
    { level: 5, label: 'Advanced injury prevention' },
    { level: 7, label: 'Elite medical care' },
    { level: 10, label: 'World-class medical' },
  ],
  recovery: [
    { level: 3, label: '+3% weekly fitness' },
    { level: 5, label: '+5% weekly fitness' },
    { level: 7, label: 'Elite recovery protocols' },
    { level: 10, label: 'World-class recovery' },
  ],
};

/** Value multiplier for Ballon d'Or top-25 placements (rank → multiplier) */
export const BALLON_DOR_VALUE_BOOST: Record<number, number> = {
  1: 0.30,   // Winner: +30% value
  2: 0.22,
  3: 0.18,
  4: 0.14,
  5: 0.12,
  10: 0.08,  // Top 10: +8%
  25: 0.04,  // Top 25: +4%
} as const;

// ── Global Team Power Rankings (ELO) ──
export const ELO_K_FACTORS: Record<string, number> = { league: 20, cup: 15, continental: 30 };
export const ELO_INITIAL_TIER_BONUS: Record<number, number> = { 1: 400, 2: 250, 3: 100, 4: 0 };
export const ELO_REPUTATION_MULTIPLIER = 120;

// ── Ballon d'Or Continental Bonus ──
export const BALLON_DOR_CONTINENTAL_BONUS = {
  champions_cup: { group: 5, R16: 10, QF: 18, SF: 25, F: 30, winner: 40 },
  shield_cup: { group: 2, R16: 5, QF: 8, SF: 12, F: 15, winner: 20 },
  conference_cup: { group: 1, R16: 3, QF: 5, SF: 8, F: 10, winner: 14 },
} as const;
