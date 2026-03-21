/**
 * Transfer System Configuration
 * Transfer windows, AI offers, fee calculations, acceptance chances.
 */

// ── Transfer Windows ──
export const SUMMER_WINDOW_END = 8;
export const WINTER_WINDOW_START = 20;
export const WINTER_WINDOW_END = 24;
export const WINDOW_CLOSING_WEEK = 8;
export const WINDOW_OPENING_WEEK = 20;

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

// ── Contract Renewal ──
export const CONTRACT_MIN_YEARS = 1;
export const CONTRACT_MAX_YEARS = 5;
export const SIGNING_BONUS_WEEKS_PER_YEAR = 2;
export const RENEWAL_MORALE_BOOST = 10;
