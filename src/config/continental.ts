import type { CupRound } from '@/types/game';

// ── Continental Champions Cup ──
export const CHAMPIONS_CUP_GROUPS = 8;
export const CHAMPIONS_CUP_TEAMS_PER_GROUP = 4;

// Qualification spots per league quality tier
// Tier 1 (5 leagues × 4) = 20, Tier 2 (4 leagues × 2) = 8, Tier 3 (top 4 × 1) = 4 → 32 total
export const CHAMPIONS_CUP_SPOTS: Record<number, number> = {
  1: 4,
  2: 2,
  3: 1,
  4: 0,
};
// Max Tier 3 leagues that get a Champions Cup spot
export const CHAMPIONS_CUP_TIER3_MAX = 4;

// ── Continental Shield Cup ──
export const SHIELD_CUP_TOTAL_TEAMS = 32;

// Shield Cup spots: next positions after Champions Cup qualifiers + cup winners
export const SHIELD_CUP_SPOTS: Record<number, number> = {
  1: 3, // positions 5-7 from tier 1
  2: 2, // positions 3-4 from tier 2
  3: 1, // domestic cup winner from tier 3 (remaining 10 leagues)
  4: 1, // domestic cup winner from tier 4
};
// Max Tier 3 Shield slots (remaining T3 leagues not in Champions Cup)
export const SHIELD_CUP_TIER3_MAX = 10;
// Max Tier 4 Shield slots
export const SHIELD_CUP_TIER4_MAX = 7;

// ── Week Schedule ──
// Continental group stage matchdays (6 matchdays)
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
  champions_group: 300_000,       // per match (6 matches = 1.8M potential)
  champions_r16: 500_000,
  champions_qf: 750_000,
  champions_sf: 1_000_000,
  champions_winner: 3_000_000,
  champions_runner_up: 1_500_000,
  shield_group: 150_000,          // per match (6 matches = 900k potential)
  shield_r16: 250_000,
  shield_qf: 400_000,
  shield_sf: 600_000,
  shield_winner: 1_000_000,
  shield_runner_up: 500_000,
  league_cup_winner: 300_000,
  league_cup_runner_up: 100_000,
  domestic_super_cup: 100_000,
  continental_super_cup: 200_000,
} as const;

// ── Reputation Rewards ──
export const REP_CHAMPIONS_CUP_WIN = 80;
export const REP_SHIELD_CUP_WIN = 50;
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
