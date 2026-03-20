/**
 * Game Balance Configuration
 * Season structure, board confidence, player development, finances, and more.
 */

import type { PlayerAttributes, Position } from '@/types/game';

// ── Season Structure ──
export const TOTAL_WEEKS = 46;
export const STARTING_BOARD_CONFIDENCE = 50;

// ── Player Development: Growth ──
export const GROWTH_AGE_THRESHOLD = 24;
export const MAX_SEASON_GROWTH = 8;
export const GROWTH_BASE_CHANCE = 0.02;
export const GROWTH_POTENTIAL_GAP_FACTOR = 0.005;
export const PLAYING_TIME_BONUS_MAX = 0.08;
export const PLAYING_TIME_BONUS_PER_APP = 0.004;

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
  'CF':  { shooting: 0.02, passing: 0.02, mental: 0.01 },
};

// ── Value Age Multipliers ──
export const VALUE_AGE_MULTIPLIERS = [
  { maxAge: 20, multiplier: 0.6 },
  { maxAge: 24, multiplier: 0.85 },
  { maxAge: 28, multiplier: 1.0 },
  { maxAge: 30, multiplier: 0.8 },
  { maxAge: 33, multiplier: 0.5 },
  { maxAge: Infinity, multiplier: 0.25 },
] as const;

// ── Board Confidence ──
export const CONFIDENCE_WIN_CHANGE = 4;
export const CONFIDENCE_LOSS_CHANGE = -5;
export const CONFIDENCE_DRAW_CHANGE = -1;
export const CONFIDENCE_POSITION_BONUS = 2;
export const CONFIDENCE_POSITION_PENALTY = -3;
export const CONFIDENCE_POSITION_PENALTY_THRESHOLD = -3;
export const CONFIDENCE_BUDGET_PENALTY = -2;
export const CONFIDENCE_BUDGET_THRESHOLD = -5_000_000;
export const CONFIDENCE_WIN_STREAK_BONUS = 3;
export const CONFIDENCE_LOSS_STREAK_PENALTY = -5;
export const CONFIDENCE_STREAK_LENGTH = 3;
export const CONFIDENCE_WARNING_THRESHOLD = 25;
export const CONFIDENCE_PLEASED_THRESHOLD = 80;
export const CONFIDENCE_MIN = 10;
export const CONFIDENCE_MAX = 100;

// ── Expected Position by Reputation ──
export const EXPECTED_POSITION_BY_REP: { minRep: number; expectedPos: number }[] = [
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
export const MORALE_DRAW_CHANGE = 0;
export const FORM_WIN_CHANGE = 5;
export const FORM_LOSS_CHANGE = -8;
export const FORM_DRAW_CHANGE = -2;

// ── Injury ──
export const MATCH_INJURY_WEEKS_MIN = 1;
export const MATCH_INJURY_WEEKS_RANGE = 4;
export const TRAINING_INJURY_WEEKS_MIN = 1;
export const TRAINING_INJURY_WEEKS_RANGE = 2;
export const RED_CARD_SUSPENSION_MIN = 1;
export const RED_CARD_SUSPENSION_RANGE = 2;

// ── Physio / Staff ──
export const PHYSIO_RECOVERY_BOOST_THRESHOLD = 7;
export const PHYSIO_INJURY_REDUCTION_PER_QUALITY = 0.05;
export const ASSISTANT_MANAGER_FAMILIARITY_BOOST = 0.3;

// ── Contract Warnings ──
export const CONTRACT_WARNING_WEEKS = [15, 25, 30, 35] as const;
export const CONTRACT_WARNING_OVERALL_THRESHOLD = 60;
export const CONTRACT_MORALE_HIT_WEEK_THRESHOLD = 25;
export const CONTRACT_MORALE_HIT_OVERALL_THRESHOLD = 70;
export const CONTRACT_MORALE_HIT_AMOUNT = -5;
export const CONTRACT_MORALE_MIN = 20;

// ── Income ──
export const MATCHDAY_INCOME_PER_FAN = 50000;
export const COMMERCIAL_INCOME_PER_REP = 200000;
export const STADIUM_INCOME_PER_LEVEL = 20000;
export const POSITION_PRIZE_PER_RANK = 15000;
export const POSITION_PRIZE_MAX_RANK = 21;
export const SPONSORSHIP_REP_MULTIPLIER = 30000;
export const MERCHANDISE_FAN_MULTIPLIER = 10000;
export const SCOUTING_COST_PER_ASSIGNMENT = 25000;
export const FAN_MOOD_BASE = 0.8;
export const FAN_MOOD_SCALE = 0.4;

// ── Facility Upgrade ──
export const FACILITY_COST_PER_LEVEL = 5_000_000;
export const FACILITY_BASE_UPGRADE_WEEKS = 2;
export const FACILITY_MAX_LEVEL = 10;

// ── Initial Facilities ──
export const STADIUM_LEVEL_DIVISOR = 10;
export const MEDICAL_LEVEL_FACTOR = 0.8;

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
export const REPLACEMENT_QUALITY_REP_MULTIPLIER = 10;
export const REPLACEMENT_QUALITY_BASE = 20;
export const REPLACEMENT_QUALITY_VARIANCE = 15;
export const GENERIC_FILL_POSITIONS: Position[] = ['CM', 'CB', 'ST', 'LW', 'RW'];

// ── Transfer Market Listing ──
export const LISTING_PRICE_MIN_MULTIPLIER = 1.1;
export const LISTING_PRICE_RANDOM_RANGE = 0.4;
export const INITIAL_LISTINGS_MIN = 1;
export const INITIAL_LISTINGS_RANGE = 2;

// ── Youth Intake at Season End ──
export const SEASON_YOUTH_INTAKE_MIN = 2;
export const SEASON_YOUTH_INTAKE_RANGE = 3;

// ── Starting Tactical Familiarity ──
export const STARTING_TACTICAL_FAMILIARITY = 30;

// ── Max Messages ──
export const MAX_MESSAGES = 80;

// ── Loan Development ──
export const LOAN_PLAY_CHANCE_HIGH = 0.7;
export const LOAN_PLAY_CHANCE_LOW = 0.4;
export const LOAN_DEV_BASE_CHANCE = 0.03;
export const LOAN_DEV_REP_FACTOR = 0.005;
export const LOAN_QUALITY_FORMULA_REP_MULT = 10;
export const LOAN_QUALITY_FORMULA_BASE = 30;
export const LOAN_FITNESS_DRAIN = 8;
export const LOAN_YOUNG_AGE_THRESHOLD = 24;

// ── AI Loan Offers ──
export const AI_LOAN_OFFER_CHANCE = 0.08;
export const AI_LOAN_DURATIONS = [12, 16, 20, 24] as const;
export const AI_LOAN_WAGE_SPLITS = [50, 60, 75, 100] as const;
export const AI_LOAN_RECALL_CLAUSE_CHANCE = 0.4;

// ── AI Inter-Club Transfers ──
export const AI_TRANSFER_CHANCE = 0.10;
export const AI_TRANSFER_FEE_BASE = 0.9;
export const AI_TRANSFER_FEE_RANGE = 0.3;
export const AI_TRANSFER_MAX_BUDGET_RATIO = 0.4;
export const AI_TRANSFER_MIN_BUDGET = 5_000_000;

// ── Win Streak Bonuses ──
export const STREAK_MORALE_THRESHOLD = 3;
export const STREAK_MORALE_BONUS = 2;
export const STREAK_INCOME_THRESHOLD = 5;
export const STREAK_INCOME_MULTIPLIER = 0.05; // +5% matchday income
export const STREAK_FORM_THRESHOLD = 8;
export const STREAK_FORM_BONUS = 3;

// ── Press Conferences ──
export const PRESS_TRANSFER_RUMOUR_CHANCE = 0.3;
export const PRESS_POOR_FORM_LOSSES = 3;
export const PRESS_GOOD_FORM_WINS = 4;
export const PRESS_BIG_MATCH_REP_GAP = 2;
