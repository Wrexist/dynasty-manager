/**
 * Merchandise Strategy Configuration
 * Product lines, pricing tiers, campaign definitions, and balance constants.
 */

import type { MerchProductLine, MerchPricingTier, MerchCampaignType } from '@/types/game';

// ── Product Line Definitions ──

interface MerchProductLineDef {
  label: string;
  icon: string;
  baseRevenueFactor: number;
  weeklyOperatingCost: number;
  unlockRequirement: {
    minReputation?: number;
    minStadiumLevel?: number;
  };
}

export const MERCH_PRODUCT_LINES: Record<MerchProductLine, MerchProductLineDef> = {
  matchday_essentials: {
    label: 'Matchday Essentials',
    icon: 'flag',
    baseRevenueFactor: 1.0,
    weeklyOperatingCost: 5_000,
    unlockRequirement: {},
  },
  replica_kits: {
    label: 'Replica Kits',
    icon: 'shirt',
    baseRevenueFactor: 2.5,
    weeklyOperatingCost: 25_000,
    unlockRequirement: { minReputation: 2 },
  },
  lifestyle_apparel: {
    label: 'Lifestyle Apparel',
    icon: 'shopping-bag',
    baseRevenueFactor: 1.8,
    weeklyOperatingCost: 20_000,
    unlockRequirement: { minReputation: 3 },
  },
  memorabilia: {
    label: 'Memorabilia & Collectibles',
    icon: 'gem',
    baseRevenueFactor: 1.5,
    weeklyOperatingCost: 15_000,
    unlockRequirement: { minReputation: 4 },
  },
  digital_global: {
    label: 'Digital & Global',
    icon: 'globe',
    baseRevenueFactor: 2.0,
    weeklyOperatingCost: 30_000,
    unlockRequirement: { minReputation: 4, minStadiumLevel: 6 },
  },
};

// ── Pricing Tier Definitions ──

interface MerchPricingTierDef {
  label: string;
  description: string;
  revenueMultiplier: number;
  fanMoodImpact: number; // per week
}

export const MERCH_PRICING_TIERS: Record<MerchPricingTier, MerchPricingTierDef> = {
  budget: {
    label: 'Fan-Friendly',
    description: 'Low prices, high volume — fans love it',
    revenueMultiplier: 0.7,
    fanMoodImpact: 2,
  },
  standard: {
    label: 'Market Rate',
    description: 'Balanced pricing — no mood impact',
    revenueMultiplier: 1.0,
    fanMoodImpact: 0,
  },
  premium: {
    label: 'Premium',
    description: 'High margins — fans grumble over time',
    revenueMultiplier: 1.4,
    fanMoodImpact: -1,
  },
};

// ── Campaign Definitions ──

interface MerchCampaignDef {
  label: string;
  description: string;
  durationWeeks: number;
  setupCost: number;
  revenueBoost: number; // e.g. 0.8 = +80%
}

export const MERCH_CAMPAIGNS: Record<MerchCampaignType, MerchCampaignDef> = {
  kit_launch: {
    label: 'New Kit Launch',
    description: 'Unveil the new season kit to drive sales',
    durationWeeks: 6,
    setupCost: 500_000,
    revenueBoost: 0.8,
  },
  title_race: {
    label: 'Title Race Push',
    description: 'Capitalise on your title challenge momentum',
    durationWeeks: 4,
    setupCost: 250_000,
    revenueBoost: 0.5,
  },
  cup_run: {
    label: 'Cup Run Special',
    description: 'Ride the wave of cup excitement',
    durationWeeks: 4,
    setupCost: 200_000,
    revenueBoost: 0.4,
  },
  end_of_season_sale: {
    label: 'End of Season Sale',
    description: 'Clear stock with discount promotions',
    durationWeeks: 4,
    setupCost: 100_000,
    revenueBoost: 0.3,
  },
  star_signing: {
    label: 'Star Signing Buzz',
    description: 'Leverage excitement from a marquee signing',
    durationWeeks: 4,
    setupCost: 300_000,
    revenueBoost: 0.6,
  },
  holiday_special: {
    label: 'Holiday Special',
    description: 'Winter promotion to boost gift sales',
    durationWeeks: 4,
    setupCost: 150_000,
    revenueBoost: 0.35,
  },
};

// ── Balance Constants ──

export const MERCH_BASE_INCOME_PER_FAN = 8_000;

/** Scale merch revenue by league quality tier (1=elite, 4=developing) */
export const MERCH_QUALITY_TIER_SCALE: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.6,
  4: 0.4,
};

export const MERCH_CAMPAIGN_COOLDOWN_WEEKS = 4;
/** Revenue-base addend per point of a star's marketability score. Feeds the
 *  multiplicative chain in `calculateWeeklyMerchRevenue` — it is NOT a direct
 *  weekly cash figure. */
export const STAR_PLAYER_MERCH_FACTOR = 3_000;
export const STAR_PLAYER_COUNT = 3;
/** Marketability points per (goal + assist). */
export const MARKETABILITY_PER_CONTRIBUTION = 2;
/** Hard cap on the goals+assists contribution to marketability (= 20 goal
 *  involvements). Uncapped, every extra goal bought permanent weekly revenue. */
export const MARKETABILITY_CONTRIBUTION_CAP = 40;
export const STAR_PLAYER_SALE_DIP_WEEKS = 4;
export const STAR_PLAYER_SALE_DIP_FACTOR = 0.85;
export const STAR_SIGNING_BUZZ_WEEKS = 4;
export const STAR_SIGNING_BUZZ_FACTOR = 1.15;

/** Sum of all product line revenue factors — used to normalise */
export const MERCH_TOTAL_REVENUE_FACTORS = Object.values(MERCH_PRODUCT_LINES).reduce(
  (sum, line) => sum + line.baseRevenueFactor, 0
);

/** Campaign requirements: week ranges and conditions */
export const CAMPAIGN_KIT_LAUNCH_MAX_WEEK = 4;
export const CAMPAIGN_TITLE_RACE_MAX_POSITION = 4;
/**
 * Absolute fallback for the End of Season Sale window (46-week baseline).
 * Prefer `getEndOfSeasonMinWeek(totalWeeks)`: hardcoding 38 made the campaign
 * unreachable in 33 of the 45 leagues, because most seasons are 34 weeks or
 * shorter and the season ends before week 38 ever arrives.
 */
export const CAMPAIGN_END_OF_SEASON_MIN_WEEK = 38;
/** End of Season Sale unlocks at this fraction of the season (38/46). */
export const CAMPAIGN_END_OF_SEASON_WEEK_FRACTION = 38 / 46;
export const CAMPAIGN_STAR_SIGNING_MIN_VALUE = 5_000_000;
export const CAMPAIGN_HOLIDAY_MIN_WEEK = 18;
export const CAMPAIGN_HOLIDAY_MAX_WEEK = 22;

// ── Signature Drops ──
/** Setup cost to launch a player signature drop. */
export const SIGNATURE_DROP_COST = 75_000;
/** Duration in weeks. */
export const SIGNATURE_DROP_WEEKS = 3;
/**
 * Revenue-BASE addend per point of the player's marketability score.
 *
 * Was 18,000 with a doc comment claiming marketability is ">=10 typically".
 * `getPlayerMarketability` actually returns 40-150, so a marketability-116
 * striker produced £6.44M/week of untouchable revenue on a £75k outlay (86x),
 * roughly five times over per season. Re-priced to a base addend that then
 * flows through the tier scale / product lines / pricing / campaigns like every
 * other merch revenue term.
 */
export const SIGNATURE_DROP_BONUS_PER_MARKET = 1_500;
/** Floor base addend regardless of marketability. */
export const SIGNATURE_DROP_BASE_BONUS = 20_000;
/** Cooldown in weeks before another drop can be launched. */
export const SIGNATURE_DROP_COOLDOWN_WEEKS = 6;

// ── Win Streak / Derby Buzz ──
/** Win streak length where the bonus kicks in. */
export const WIN_STREAK_BONUS_THRESHOLD = 3;
/** Per-extra-win revenue multiplier above threshold (capped). */
export const WIN_STREAK_BONUS_PER_WIN = 0.04;
/** Cap on streak revenue multiplier. */
export const WIN_STREAK_BONUS_CAP = 0.20;
/** Weeks of buzz applied automatically after a derby win. */
export const DERBY_BUZZ_WEEKS = 2;
/** Revenue multiplier during derby buzz weeks. */
export const DERBY_BUZZ_FACTOR = 1.15;
