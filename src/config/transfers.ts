/**
 * Transfer System Configuration
 * Transfer windows, AI offers, fee calculations, acceptance chances.
 */

// ── Transfer Windows ──
export const SUMMER_WINDOW_END = 8;
export const WINTER_WINDOW_START = 20;
export const WINTER_WINDOW_END = 24;

// ── AI Incoming Offers ──
export const AI_OFFER_CHANCE = 0.2;
export const AI_OFFER_MIN_BUDGET_RATIO = 0.5;
export const AI_OFFER_POSITION_THRESHOLD = 2;

// ── Urgency Multipliers ──
export const URGENCY_NONE = 1.1;
export const URGENCY_ONE = 1.0;
export const URGENCY_TWO_PLUS = 0.85;

// ── Offer Fee Formula ──
export const OFFER_FEE_BASE = 0.85;
export const OFFER_FEE_RANDOM_RANGE = 0.35;
export const OFFER_MAX_BUDGET_RATIO = 0.6;

// ── Offer Acceptance Chances ──
export const ACCEPT_CHANCE_AT_ASKING = 0.85;
export const ACCEPT_CHANCE_AT_80_PERCENT = 0.4;
export const ACCEPT_CHANCE_BELOW = 0.1;
export const ACCEPT_80_PERCENT_THRESHOLD = 0.8;

// ── Listing ──
export const LIST_PRICE_MULTIPLIER = 1.2;

// ── Counter-Offer Negotiation ──
export const COUNTER_OFFER_MIN_THRESHOLD = 0.7;
export const COUNTER_OFFER_MAX_THRESHOLD = 0.95;
export const COUNTER_OFFER_CHANCE = 0.3;

// ── Manager Perks ──
export const TRANSFER_SHARK_DISCOUNT = 0.15;

// ── Transfer Rumors ──
export const RUMOR_CHANCE = 0.15;
export const RUMOR_TO_OFFER_CHANCE = 0.6;

// ── Deadline Day ──
export const DEADLINE_DAY_OFFER_MULTIPLIER = 2.0;
export const DEADLINE_DAY_BID_PREMIUM = 0.15;

// ── Sell-On Clauses ──
export const SELL_ON_HIGH_FEE_THRESHOLD = 10_000_000;
export const SELL_ON_LOW_FEE_THRESHOLD = 5_000_000;
export const SELL_ON_HIGH_BASE_PCT = 10;
export const SELL_ON_HIGH_RANGE_PCT = 11;
export const SELL_ON_LOW_BASE_PCT = 5;
export const SELL_ON_LOW_RANGE_PCT = 6;
export const SELL_ON_EVAL_HIGH_PCT = 15;
export const SELL_ON_EVAL_LOW_PCT = 7;

// ── Counter-Offer Fee Calculation ──
export const COUNTER_OFFER_BASE_RATIO = 0.5;
export const COUNTER_OFFER_RANDOM_RANGE = 0.3;

// ── Record Signing ──
export const RECORD_SIGNING_SPEND_RATIO = 0.4;
export const RECORD_SIGNING_MIN_FEE = 5_000_000;

// ── Contract Renewal ──
export const CONTRACT_MIN_YEARS = 1;
export const CONTRACT_MAX_YEARS = 5;
export const SIGNING_BONUS_WEEKS_PER_YEAR = 2;
export const RENEWAL_MORALE_BOOST = 10;
