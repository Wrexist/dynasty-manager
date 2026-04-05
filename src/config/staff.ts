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
