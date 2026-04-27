/**
 * Staff Configuration
 * Wage formulas, quality generation, and staff thresholds.
 */

// ── Staff Wage ──
export const STAFF_WAGE_PER_QUALITY = 5000;
export const STAFF_WAGE_RANDOM_RANGE = 3000;
export const STAFF_QUALITY_MIN = 1;
export const STAFF_QUALITY_MAX = 10;

// ── Initial Staff Generation ──
export const INITIAL_BASE_QUALITY_BONUS = 2;
export const INITIAL_BASE_QUALITY_CAP = 8;
export const ASSISTANT_MANAGER_VARIANCE = 2;
export const FITNESS_COACH_OFFSET = -1;
export const FITNESS_COACH_VARIANCE = 2;
export const SCOUT_MIN_REPUTATION = 3;
export const SCOUT_OFFSET = -1;
export const SCOUT_VARIANCE = 2;
export const YOUTH_COACH_MIN_REPUTATION = 4;
export const YOUTH_COACH_OFFSET = -2;
export const YOUTH_COACH_VARIANCE = 3;

// ── Staff Market ──
export const MARKET_QUALITY_BASE = 3;
export const MARKET_QUALITY_RANGE = 5;

// ── GK Coach ──
/** Per-quality bonus added to GK position development chance */
export const GK_COACH_DEV_BONUS_PER_QUALITY = 0.005;

// ── Staff Market Refresh ──
/** Week at which mid-season staff market refreshes */
export const STAFF_MARKET_REFRESH_WEEK = 23;

// ── Staff Hiring ──
/** Weeks of salary charged as upfront hiring fee */
export const STAFF_HIRING_FEE_WEEKS = 4;

// ── Staff Morale ──
/** Default morale on hire. */
export const STAFF_DEFAULT_MORALE = 70;
/** Morale weekly drift toward 50 (passive equilibrium). */
export const STAFF_MORALE_WEEKLY_DRIFT = 1;
/** Morale gained by praising. Veterans/motivators get a bonus. */
export const STAFF_PRAISE_GAIN = 8;
/** Morale lost when criticised. */
export const STAFF_CRITICIZE_LOSS = 6;
/** Cooldown (weeks) between praise/criticize for a single staff member. */
export const STAFF_INTERACTION_COOLDOWN = 4;
/** Effective-quality multiplier curve: at 0 morale = floor, at 100 = ceiling. */
export const STAFF_MORALE_FLOOR_MULT = 0.6;
export const STAFF_MORALE_CEILING_MULT = 1.2;
/** Morale boost on team wins (per match). */
export const STAFF_MORALE_WIN_BONUS = 1;
/** Morale loss on team losses (per match). */
export const STAFF_MORALE_LOSS_PENALTY = 2;

// ── Contracts ──
/** Years on initial / market contracts. */
export const STAFF_CONTRACT_YEARS = 2;
/** Renewal cost expressed in weeks of salary. */
export const STAFF_RENEWAL_FEE_WEEKS = 6;
/** Wage rise applied on contract renewal (proportional). */
export const STAFF_RENEWAL_WAGE_RAISE = 0.1;
/** Cooldown (weeks) after renewing before another renewal is allowed. */
export const STAFF_RENEWAL_COOLDOWN = 12;

// ── Market Refresh (manual) ──
/** Cost to manually scout a fresh batch of staff candidates. */
export const STAFF_MARKET_REFRESH_FEE = 50_000;
/** Cooldown (weeks) between manual refreshes. */
export const STAFF_MARKET_REFRESH_COOLDOWN = 6;

// ── Traits ──
/** Probability of getting a single trait at generation. */
export const STAFF_TRAIT_CHANCE_ONE = 0.65;
/** Probability of getting a second trait at generation. */
export const STAFF_TRAIT_CHANCE_TWO = 0.2;
