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
/** Minimum players an AI side must field before `isSquadValid` forfeits the
 *  match. `pickAiMatchSquad` backfills up to this from the unavailable pool so an
 *  injury crisis produces an under-strength team rather than a fictional 3-0. */
export const AI_MIN_MATCH_PLAYERS = 7;

/** Calibration of the AI clubs' SYNTHETIC match rating against the real engine's
 *  distribution. AI-vs-AI matches don't produce per-player ratings, so
 *  `applyAIMatchEvents` synthesises them — and it was miscalibrated by +1.14:
 *  synthetic mean 7.43 against a measured engine mean of 6.29 (median 6.2,
 *  p10 5.4, p90 7.4). That only became load-bearing once match ratings started
 *  driving development, at which point AI squads sat ABOVE the development
 *  baseline and the player's own squad sat BELOW it — a systematic growth edge to
 *  the AI, compounding every season. Bases are the result term; the quality term
 *  is now relative to a pivot instead of adding a flat ~1.1 for everyone.
 *  Re-measure both distributions together if the engine's rating spread changes. */
export const AI_RATING_BASE_WIN = 6.75;
export const AI_RATING_BASE_DRAW = 6.15;
export const AI_RATING_BASE_LOSS = 5.55;
export const AI_RATING_OVERALL_PIVOT = 70;
export const AI_RATING_OVERALL_SCALE = 1.5;

export const AI_INCOME_MULTIPLIER = 0.85;

/** How many development passes each non-player-club player gets at season end.
 *
 *  `applyPlayerDevelopment` is a per-week roll, and it was only ever called for
 *  the PLAYER's squad (inside `playerClub.playerIds.forEach`). Every other player
 *  in the game just had `age + 1` applied, so across 756 clubs `potential` was
 *  meaningless: AI wonderkids never became stars, AI 36-year-olds never declined,
 *  and the league drifted DOWNWARD in quality while the player's squad compounded
 *  upward. Measured over 10 seasons the player's top-11 OVR edge went -4.3 -> +5.2
 *  while the league lost ~6 OVR — difficulty decayed monotonically.
 *
 *  This is deliberately fewer than a season's 46 weeks: the player's squad also
 *  gets weekly training on top of development, and better facilities and staff
 *  should still mean faster growth. `MAX_SEASON_GROWTH` caps the total either way,
 *  so this is a rate, not a ceiling.
 *
 *  NO LONGER BATCHED AT SEASON END. The passes are the same; when they run is
 *  not. See `AI_DEVELOPMENT_SLICES` below. */
export const AI_SEASON_DEVELOPMENT_PASSES = 12;

/**
 * How many groups the AI clubs are split into for weekly development.
 *
 * WHY THIS EXISTS. All 12 passes used to run in one lump inside `endSeason`,
 * for every player at 756 clubs. The justification was real — running the full
 * pass weekly is 46x the work — but it only ruled out the NAIVE fix, and the
 * consequence was that the world stood still for a whole season and jumped in
 * June. A rival's 19-year-old never developed while you watched him; he changed
 * number overnight. For a game whose core fantasy is building over time, that is
 * a real loss.
 *
 * Amortising fixes it without paying the naive cost. Each week exactly ONE slice
 * of clubs takes ONE pass, so a club is developed every `slices` weeks and
 * receives `totalWeeks / slices` passes across the season — the same budget,
 * spread out. The weekly cost is a fraction of one pass, which is far BELOW the
 * old season-end spike rather than above it.
 *
 * The slice count is derived per league from its own calendar
 * (`aiDevelopmentSlices`) so a 38-week league and a 46-week league still land on
 * roughly `AI_SEASON_DEVELOPMENT_PASSES` passes, instead of the shorter calendar
 * quietly developing its world less.
 *
 * `MAX_SEASON_GROWTH` still caps the total, and it is enforced through
 * `seasonGrowthTracker`, which is already part of `GameState` and already
 * persisted — the player's own squad has always developed this way. No new
 * persisted state, and no save-schema change.
 */
export function aiDevelopmentSlices(totalWeeks: number): number {
  return Math.max(1, Math.round(totalWeeks / AI_SEASON_DEVELOPMENT_PASSES));
}
export const AI_STAFF_COST_PER_REP = 15_000;

// ── AI Wage Constraints ──
export const AI_MAX_WAGE_TO_INCOME_RATIO = 0.75;     // Won't buy if wages exceed 75% of weekly income
export const AI_EMERGENCY_SELL_WAGE_RATIO = 0.90;     // Force-sell if wages hit 90% of income

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
export const AI_TRANSFER_WEEKLY_CHANCE = 0.30;        // 30% chance per AI club per week to evaluate transfers
export const AI_TRANSFER_DEADLINE_WEEKS = [7, 8, 23, 24] as const; // Deadline rush weeks
export const AI_TRANSFER_DEADLINE_MULTIPLIER = 2.5;   // 2.5x activity on deadline weeks
export const AI_TRANSFER_MAX_PER_WEEK = 10;           // Max 10 AI-to-AI transfers per week
export const AI_LOAN_MAX_PER_WEEK = 4;                // Max 4 AI-to-AI loans per week
// Pre-season (friendlies, weeks 1-3): AI clubs aggressively reshape squads
// PRE_SEASON_END is the canonical constant in @/config/transfers — import it there
export const AI_TRANSFER_PRESEASON_MULTIPLIER = 2.0;  // 2x activity during pre-season

// ── AI Selling Logic ──
export const AI_SELL_AGE_THRESHOLD = 30;              // Consider selling players 30+
export const AI_SELL_DECLINE_OVERALL_DROP = 3;        // Sell if player dropped 3+ from peak
export const AI_SELL_SURPLUS_THRESHOLD = 2;           // Sell if 2+ players in one position
export const AI_SELL_LISTING_CHANCE = 0.75;           // 75% chance to list a sellable player per week
export const AI_SELL_LISTING_PRICE_MIN = 1.10;        // Min asking price multiplier vs value
export const AI_SELL_LISTING_PRICE_RANGE = 0.45;      // Random range: 1.10-1.55x value
export const AI_SELL_BENCH_OVERALL_GAP = 1;           // Bench player must be 1+ below squad avg to list
export const AI_SELL_BENCH_MIN_AGE = 22;              // Don't sell youth bench players
export const AI_SELL_CONTRACT_SEASONS_LEFT = 1;       // Sell if ≤1 season remaining on contract
export const AI_SELL_OVERPAID_WAGE_RATIO = 1.5;       // Sell if wage is 1.5x squad average wage

// ── AI Buying Logic ──
export const AI_BUY_MAX_BUDGET_RATIO = 0.50;         // Max 50% of budget on one player
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
export const AI_FREE_AGENT_CHANCE = 0.15;             // 15% per club per week
export const AI_FREE_AGENT_MAX_WAGE_RATIO = 0.08;     // Free agent wage can't exceed 8% of budget
export const AI_FREE_AGENT_MIN_OVERALL_GAP = 12;      // Don't sign players 12+ below club avg

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
export const AI_LOAN_NEWS_MIN_OVERALL = 70;          // Only generate loan news for 70+ overall players
// FA signings skew sub-70 (most real-world FAs are fringe/released). Keeping
// the loan threshold at 70 but lowering the FA bar means mid-division signings
// surface in the news feed without spamming it with youth-team fillers. The
// Phase E.5 balance sim reported 0 FA news entries across 5 seasons at 70.
export const AI_FA_NEWS_MIN_OVERALL = 60;

// ── Community Pack FA Pool Seeding (Phase E.7) ──
// Front-loads real CP players into the FA pool at game start and tapers over
// the first three seasons. After S3, organic contract expiry is the only
// source of new FAs. Matches how a real football save starts (a handful of
// notable free agents available immediately, then steady year-over-year
// turnover).
//
// Total seed volume across 3 seasons: 85 players out of ~136 marquee (80+
// OVR) CP templates — leaves ~50 for the 4-weekly transfer-market refresh.
export const CP_FA_SEED_COUNT_BY_SEASON: Record<number, number> = {
  1: 50,  // at initGame
  2: 25,  // at advanceWeek of week 1, season 2
  3: 10,  // at advanceWeek of week 1, season 3
};

// Per-wave tier mix. Elite seats are capped tight — real football has 1-2
// Bosman-quality FAs per window, not a weekly Kimmich flood.
export const CP_FA_SEED_ELITE_COUNT = 2;
export const CP_FA_SEED_TOP_COUNT = 8;

// OVR bands. Everything 83+ is elite, 78-82 is top, 68-77 is mid. Anything
// below 68 isn't seeded — low-tier FAs are better left to procedural spawn
// so the CP pool stays reserved for recognizable names.
export const CP_FA_SEED_ELITE_MIN_OVR = 83;
export const CP_FA_SEED_TOP_MIN_OVR = 78;
export const CP_FA_SEED_MID_MIN_OVR = 68;

// Released-veteran archetype. Under 26 is academy/scouting territory; over
// 33 runs up against the FA-admission filter (34+ retires out of the pool).
export const CP_FA_SEED_MIN_AGE = 26;
export const CP_FA_SEED_MAX_AGE = 33;

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
