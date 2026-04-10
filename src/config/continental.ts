import type { CupRound } from '@/types/game';

// ── Continental Tournament Groups ──
export const CONTINENTAL_GROUPS = 8;
export const CONTINENTAL_TEAMS_PER_GROUP = 4;
export const CONTINENTAL_TOTAL_TEAMS = CONTINENTAL_GROUPS * CONTINENTAL_TEAMS_PER_GROUP; // 32

// Keep old exports as aliases for backwards compatibility in imports
export const CHAMPIONS_CUP_GROUPS = CONTINENTAL_GROUPS;
export const CHAMPIONS_CUP_TEAMS_PER_GROUP = CONTINENTAL_TEAMS_PER_GROUP;

// ── Rank-Based Qualification Spots ──
// Leagues are ranked 1-30 based on coefficient + reputation.
// Spots per league rank for each continental competition.

// Champions Cup: 32 teams total
// Rank 1-4: 4 spots, Rank 5: 3, Rank 6-8: 2, Rank 9-15: 1 (champion), 16+: 0
// + 1 reserved for Shield Cup holder (bumps out last slot if needed)
export const CHAMPIONS_CUP_SPOTS_BY_RANK: Record<number, number> = {
  1: 4, 2: 4, 3: 4, 4: 4,
  5: 3,
  6: 2, 7: 2, 8: 2,
  9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
};

// Shield Cup: 32 teams total
// Rank 1-4: 2 spots (positions after CL), Rank 5: 2, Rank 6-8: 1,
// Rank 9-15: 1 (runner-up or cup winner), Rank 16-22: 1 (cup winner)
// + 1 reserved for Conference Cup holder
export const SHIELD_CUP_SPOTS_BY_RANK: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 2,
  6: 1, 7: 1, 8: 1,
  9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
  16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1,
};

// Conference Cup: 32 teams total
// Rank 1-5: 1 spot (next position after Shield), Rank 6-15: 1 spot,
// Rank 16-30: 1 spot (champion or cup winner)
export const CONFERENCE_CUP_SPOTS_BY_RANK: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
  16: 1, 17: 1, 18: 1, 19: 1, 20: 1,
  21: 1, 22: 1, 23: 1, 24: 1, 25: 1,
  26: 1, 27: 1, 28: 1, 29: 1, 30: 1,
};

// ── Legacy tier-based exports (kept for any remaining references) ──
export const CHAMPIONS_CUP_SPOTS: Record<number, number> = { 1: 4, 2: 2, 3: 1, 4: 0 };
export const CHAMPIONS_CUP_TIER3_MAX = 4;
export const SHIELD_CUP_TOTAL_TEAMS = 32;
export const SHIELD_CUP_SPOTS: Record<number, number> = { 1: 3, 2: 2, 3: 1, 4: 1 };
export const SHIELD_CUP_TIER3_MAX = 10;
export const SHIELD_CUP_TIER4_MAX = 7;

// ── Week Schedule ──
// Continental group stage matchdays (6 matchdays) — shared by all 3 competitions
export const CONTINENTAL_GROUP_WEEKS = [6, 10, 16, 22, 26, 30] as const;
// Continental knockout rounds (2-leg ties, except final which is single leg)
export const CONTINENTAL_R16_WEEKS = [34, 35] as const;
export const CONTINENTAL_QF_WEEKS = [38, 39] as const;
export const CONTINENTAL_SF_WEEKS = [41, 42] as const;
export const CONTINENTAL_FINAL_WEEK = 44;

// ── Domestic League Cup ──
export const LEAGUE_CUP_WEEKS: Record<CupRound, number> = {
  R1: 3,
  R2: 7,
  R3: 12,
  R4: 18,
  QF: 24,
  SF: 32,
  F: 40,
};

// ── Super Cups ──
export const DOMESTIC_SUPER_CUP_WEEK = 1;
export const CONTINENTAL_SUPER_CUP_WEEK = 2;

// ── Match Simulation ──
export const CONTINENTAL_EXTRA_TIME_GOAL_CHANCE = 0.30;
export const CONTINENTAL_PENALTY_KICKS = 5;
export const CONTINENTAL_PENALTY_CONVERSION = 0.75;

// ── Prize Money ──
export const CONTINENTAL_PRIZE_MONEY = {
  // Champions Cup (elite)
  champions_group: 300_000,       // per match (6 matches = 1.8M potential)
  champions_r16: 500_000,
  champions_qf: 750_000,
  champions_sf: 1_000_000,
  champions_winner: 3_000_000,
  champions_runner_up: 1_500_000,
  // Shield Cup (secondary)
  shield_group: 150_000,          // per match (6 matches = 900k potential)
  shield_r16: 250_000,
  shield_qf: 400_000,
  shield_sf: 600_000,
  shield_winner: 1_000_000,
  shield_runner_up: 500_000,
  // Conference Cup (third tier)
  conference_group: 75_000,       // per match (6 matches = 450k potential)
  conference_r16: 125_000,
  conference_qf: 200_000,
  conference_sf: 300_000,
  conference_winner: 500_000,
  conference_runner_up: 250_000,
  // Domestic cups
  league_cup_winner: 300_000,
  league_cup_runner_up: 100_000,
  domestic_super_cup: 100_000,
  continental_super_cup: 200_000,
  // Domestic Dynasty Cup (main domestic knockout — should feel rewarding)
  dynasty_cup_r1: 25_000,
  dynasty_cup_r2: 50_000,
  dynasty_cup_r3: 100_000,
  dynasty_cup_r4: 175_000,
  dynasty_cup_qf: 300_000,
  dynasty_cup_sf: 500_000,
  dynasty_cup_winner: 1_500_000,
  dynasty_cup_runner_up: 600_000,
} as const;

// ── Continental Coefficient System ──
/** Points awarded per achievement in continental tournaments */
export const COEFF_GROUP_WIN = 2;
export const COEFF_GROUP_DRAW = 1;
export const COEFF_QUALIFY_KNOCKOUT = 4;   // bonus for reaching knockouts
export const COEFF_R16_WIN = 2;
export const COEFF_QF_WIN = 3;
export const COEFF_SF_WIN = 4;
export const COEFF_FINAL_WIN = 5;
export const COEFF_SHIELD_MULTIPLIER = 0.7;     // Shield Cup points are worth 70% of Champions Cup
export const COEFF_CONFERENCE_MULTIPLIER = 0.5;  // Conference Cup points are worth 50% of Champions Cup
/** Number of seasons to include in coefficient calculation */
export const COEFF_SEASON_WINDOW = 5;
/** Weight decay per season (most recent = 1.0, oldest = 0.2) */
export const COEFF_SEASON_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2];
/** Blend ratio: coefficient vs reputation for seeding (0 = all reputation, 1 = all coefficient) */
export const COEFF_SEEDING_BLEND = 0.6;

// ── Reputation Rewards ──
export const REP_CHAMPIONS_CUP_WIN = 80;
export const REP_SHIELD_CUP_WIN = 50;
export const REP_CONFERENCE_CUP_WIN = 30;
export const REP_LEAGUE_CUP_WIN = 25;
export const REP_CONTINENTAL_GROUP = 15;
export const REP_CONTINENTAL_KNOCKOUT = 10; // per round advanced

// ── Group Stage Round-Robin Fixture Template ──
// For a group of 4 teams (indices 0-3), 6 matchdays
// Each tuple: [homeIndex, awayIndex]
export const GROUP_FIXTURE_TEMPLATE: [number, number][][] = [
  [[0, 1], [2, 3]], // MD1
  [[0, 2], [3, 1]], // MD2
  [[1, 2], [3, 0]], // MD3
  [[1, 0], [3, 2]], // MD4 (reverse of MD1)
  [[2, 0], [1, 3]], // MD5 (reverse of MD2)
  [[2, 1], [0, 3]], // MD6 (reverse of MD3)
];
