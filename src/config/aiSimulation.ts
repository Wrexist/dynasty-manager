/**
 * AI Simulation Configuration
 *
 * Constants governing AI club financial management, transfers, loans,
 * contract renewals, and squad management. These are tuned for moderate
 * market activity (~30-50 transfers per season across all AI clubs).
 */

import type { Position } from '@/types/game';

// ── AI Weekly Income ──
// AI clubs earn a fraction of the player's equivalent income to keep player advantage
export const AI_INCOME_MULTIPLIER = 0.85;
export const AI_STAFF_COST_PER_REP = 15_000;

// ── AI Wage Constraints ──
export const AI_MAX_WAGE_TO_INCOME_RATIO = 0.75;     // Won't buy if wages exceed 75% of weekly income
export const AI_EMERGENCY_SELL_WAGE_RATIO = 0.90;     // Force-sell if wages hit 90% of income
export const AI_WAGE_BUDGET_RESERVE = 0.10;           // Keep 10% of budget as cash reserve

// ── AI Squad Depth Targets (minimum per position for a healthy squad) ──
export const AI_SQUAD_DEPTH_TARGETS: Record<Position, number> = {
  GK: 2, CB: 4, LB: 2, RB: 2,
  CDM: 1, CM: 3, CAM: 1,
  LM: 1, RM: 1, LW: 2, RW: 2,
  ST: 2,
};

// Priority order: positions are ranked by how urgently they need filling
export const AI_POSITION_PRIORITY: Position[] = [
  'GK', 'CB', 'ST', 'CM', 'LB', 'RB', 'LW', 'RW', 'CDM', 'CAM', 'LM', 'RM',
];

// ── AI Transfer Activity ──
export const AI_TRANSFER_WEEKLY_CHANCE = 0.18;        // 18% chance per AI club per week to evaluate transfers
export const AI_TRANSFER_DEADLINE_WEEKS = [7, 8, 23, 24] as const; // Deadline rush weeks
export const AI_TRANSFER_DEADLINE_MULTIPLIER = 2.0;   // Double activity on deadline weeks
export const AI_TRANSFER_MAX_PER_WEEK = 3;            // Max 3 AI-to-AI transfers per week (perf cap)
export const AI_LOAN_MAX_PER_WEEK = 2;                // Max 2 AI-to-AI loans per week

// ── AI Selling Logic ──
export const AI_SELL_AGE_THRESHOLD = 31;              // Consider selling players 31+
export const AI_SELL_DECLINE_OVERALL_DROP = 3;        // Sell if player dropped 3+ from peak
export const AI_SELL_SURPLUS_THRESHOLD = 3;           // Sell if 3+ players in one position
export const AI_SELL_LISTING_CHANCE = 0.12;           // 12% chance to list a sellable player per week
export const AI_SELL_LISTING_PRICE_MIN = 1.15;        // Min asking price multiplier vs value
export const AI_SELL_LISTING_PRICE_RANGE = 0.35;      // Random range added to min

// ── AI Buying Logic ──
export const AI_BUY_MAX_BUDGET_RATIO = 0.50;         // Max 50% of budget on one player
export const AI_BUY_VALUE_PREMIUM = 1.15;            // AI willing to pay up to 115% of value
export const AI_BUY_BIDDING_WAR_CHANCE = 0.20;        // 20% chance a second club counter-bids
export const AI_BUY_BIDDING_INCREMENT = 0.10;         // Counter-bid adds 10% to original bid
export const AI_BUY_FEE_BASE = 0.90;                 // Base offer: 90% of asking price
export const AI_BUY_FEE_RANGE = 0.25;                // Random range: 90-115% of asking

// ── AI Contract Renewal ──
export const AI_RENEW_CHECK_WEEKS_BEFORE = 12;        // Start renewing 12 weeks before expiry
export const AI_RENEW_CHANCE_PER_WEEK = 0.30;         // 30% chance to process a renewal per eligible player
export const AI_RENEW_KEY_PLAYER_OVERALL = 70;        // Always renew players 70+ overall
export const AI_RENEW_YOUNG_AGE = 25;                 // Always renew young talent
export const AI_RENEW_OLD_AGE = 33;                   // Don't renew 33+ unless exceptional
export const AI_RENEW_EXCEPTIONAL_OVERALL = 80;       // 33+ can renew if 80+ overall
export const AI_RENEW_YEARS_YOUNG = 3;                // 3-year contracts for young players
export const AI_RENEW_YEARS_PEAK = 2;                 // 2-year contracts for peak players
export const AI_RENEW_YEARS_OLD = 1;                  // 1-year contracts for veterans

// ── AI Free Agents ──
export const AI_FREE_AGENT_CHANCE = 0.10;             // 10% per club per week
export const AI_FREE_AGENT_MAX_WAGE_RATIO = 0.05;     // Free agent wage can't exceed 5% of budget
export const AI_FREE_AGENT_MIN_OVERALL_GAP = 15;      // Don't sign players 15+ below club avg

// ── AI Inter-Club Loans ──
export const AI_LOAN_WEEKLY_CHANCE = 0.10;            // 10% chance per club per week to loan out surplus
export const AI_LOAN_TARGET_AGE_MAX = 25;             // Only loan out young players
export const AI_LOAN_TARGET_OVERALL_GAP = 5;          // Loan if player is 5+ below squad average
export const AI_LOAN_DURATIONS = [12, 16, 20, 24] as const;
export const AI_LOAN_WAGE_SPLITS = [50, 60, 75, 100] as const;
export const AI_LOAN_RECALL_CHANCE = 0.35;
export const AI_LOAN_OBLIGATORY_BUY_CHANCE = 0.15;
export const AI_LOAN_OBLIGATORY_BUY_MULTIPLIER = 0.85;

// ── Transfer News ──
export const AI_TRANSFER_NEWS_MIN_FEE = 2_000_000;   // Only generate news for £2M+ transfers
export const AI_LOAN_NEWS_MIN_OVERALL = 70;           // Only generate loan news for 70+ overall players

// ── Style-Based Position Priorities ──
// Which positions each manager style prioritises when buying
export const AI_STYLE_PRIORITY_POSITIONS: Record<string, Position[]> = {
  'attacking': ['ST', 'LW', 'RW', 'CAM', 'CM'],
  'defensive': ['CB', 'CDM', 'LB', 'RB', 'GK'],
  'possession': ['CM', 'CAM', 'CDM', 'CB', 'GK'],
  'counter-attack': ['ST', 'LW', 'RW', 'CDM', 'CB'],
  'balanced': ['CM', 'CB', 'ST', 'LW', 'RW'],
  'direct': ['ST', 'CM', 'LW', 'RW', 'CB'],
};
