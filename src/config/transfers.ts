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
export const LISTING_PRICE_FLOOR = 25_000;

// ── Counter-Offer Negotiation ──
export const COUNTER_OFFER_MIN_THRESHOLD = 0.7;
export const COUNTER_OFFER_MAX_THRESHOLD = 0.95;
export const COUNTER_OFFER_CHANCE = 0.3;

// ── Manager Perks ──
export const TRANSFER_SHARK_DISCOUNT = 0.15;

// ── Transfer Rumors ──
export const RUMOR_CHANCE = 0.15;

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

// ── Incoming Offer Negotiation (Selling) ──
export const INCOMING_NEGOTIATE_MAX_MULTIPLIER = 1.5;
export const INCOMING_NEGOTIATE_ACCEPT_AT_OFFER = 0.90;
export const INCOMING_NEGOTIATE_ACCEPT_AT_120 = 0.45;
export const INCOMING_NEGOTIATE_ACCEPT_AT_MAX = 0.08;
export const INCOMING_NEGOTIATE_COUNTER_CHANCE = 0.35;
export const INCOMING_NEGOTIATE_COUNTER_BASE = 0.4;
export const INCOMING_NEGOTIATE_COUNTER_RANGE = 0.3;

// ── Contract Renewal ──
export const CONTRACT_MIN_YEARS = 1;
export const CONTRACT_MAX_YEARS = 5;
export const SIGNING_BONUS_WEEKS_PER_YEAR = 2;
export const RENEWAL_MORALE_BOOST = 10;

// ── Outgoing Loan Requests ──
export const LOAN_REQUEST_BASE_ACCEPT = 0.6;
export const LOAN_REQUEST_LINEUP_PENALTY = 0.4;
export const LOAN_REQUEST_WAGE_BONUS = 0.003;  // per % of wage offered
export const LOAN_REQUEST_AGE_BONUS = 0.03;    // per year under 23
export const LOAN_REQUEST_COUNTER_CHANCE = 0.35;
export const LOAN_REQUEST_MIN_DURATION = 4;
export const LOAN_REQUEST_MAX_DURATION = 46;

// ── Transfer Market Population ──
// Target number of listed players on the market at any given time
export const MARKET_TARGET_SIZE = 60;
// Minimum market size before replenishment kicks in
export const MARKET_REPLENISH_THRESHOLD = 25;
// How many external (generated) players to add per replenishment cycle
export const MARKET_REPLENISH_BATCH_MIN = 5;
export const MARKET_REPLENISH_BATCH_RANGE = 6; // 5-10 players per batch

// ── Division Quality Ranges (overall rating) ──
// Used when generating market players to match realistic quality per division
export const DIVISION_QUALITY_RANGES: Record<string, { min: number; max: number; avgPrice: number }> = {
  'div-1': { min: 68, max: 88, avgPrice: 15_000_000 },
  'div-2': { min: 60, max: 78, avgPrice: 5_000_000 },
  'div-3': { min: 52, max: 70, avgPrice: 1_500_000 },
  'div-4': { min: 45, max: 64, avgPrice: 400_000 },
};

// Division weight for how many players from each tier appear on the market
export const DIVISION_MARKET_WEIGHTS: Record<string, number> = {
  'div-1': 0.20,  // 20% of generated players are top flight quality
  'div-2': 0.30,  // 30% Championship quality
  'div-3': 0.30,  // 30% League One quality
  'div-4': 0.20,  // 20% League Two quality
};

// ── Age Distribution for Market Players ──
export const MARKET_AGE_BUCKETS = [
  { min: 17, max: 20, weight: 0.10 }, // Young prospects
  { min: 21, max: 24, weight: 0.25 }, // Rising stars
  { min: 25, max: 28, weight: 0.30 }, // Peak years
  { min: 29, max: 32, weight: 0.25 }, // Experienced
  { min: 33, max: 36, weight: 0.10 }, // Veterans
];

// ── Age-Based Price Multipliers ──
export const AGE_PRICE_MULTIPLIER: Record<string, number> = {
  '17': 0.8, '18': 0.9, '19': 1.0, '20': 1.1, '21': 1.2,
  '22': 1.3, '23': 1.35, '24': 1.4, '25': 1.4, '26': 1.35,
  '27': 1.3, '28': 1.2, '29': 1.0, '30': 0.8, '31': 0.6,
  '32': 0.45, '33': 0.3, '34': 0.2, '35': 0.15, '36': 0.1,
};

// ── Free Agent Generation ──
// Number of free agents to generate at game start
export const INITIAL_FREE_AGENTS_MIN = 25;
export const INITIAL_FREE_AGENTS_RANGE = 16; // 25-40
// Quality range for generated free agents (slightly lower than market)
export const FREE_AGENT_QUALITY_MIN = 45;
export const FREE_AGENT_QUALITY_MAX = 72;
// Weekly chance to spawn new free agents (keeps pool refreshed)
export const FREE_AGENT_SPAWN_CHANCE = 0.25;
export const FREE_AGENT_SPAWN_MIN = 1;
export const FREE_AGENT_SPAWN_RANGE = 3; // 1-3 per spawn event

// ── Initial Market Population ──
// Number of generated players to seed market with at season start
export const INITIAL_MARKET_GEN_MIN = 30;
export const INITIAL_MARKET_GEN_RANGE = 21; // 30-50 players

// ── Market Listing Expiry ──
// Unsold listings are refreshed after this many weeks
export const LISTING_EXPIRY_WEEKS = 12;
// Chance to relist expired listing with reduced price
export const LISTING_RELIST_CHANCE = 0.4;
export const LISTING_RELIST_DISCOUNT = 0.15; // 15% price reduction
