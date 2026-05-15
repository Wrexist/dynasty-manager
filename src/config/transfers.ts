/**
 * Transfer System Configuration
 * Transfer windows, AI offers, fee calculations, acceptance chances.
 */

// ── Transfer Windows ──
export const SUMMER_WINDOW_END = 8;
export const WINTER_WINDOW_START = 20;
export const WINTER_WINDOW_END = 24;

// ── AI Incoming Offers ──
export const AI_OFFER_CHANCE = 0.50;
export const AI_OFFER_MIN_BUDGET_RATIO = 1.2;
export const AI_OFFER_POSITION_THRESHOLD = 3;

// ── Urgency Multipliers ──
export const URGENCY_NONE = 1.1;
export const URGENCY_ONE = 1.0;
export const URGENCY_TWO_PLUS = 0.85;

// ── Offer Fee Formula ──
export const OFFER_FEE_BASE = 0.85;
export const OFFER_FEE_RANDOM_RANGE = 0.35;
export const OFFER_MAX_BUDGET_RATIO = 0.75;

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

// ── Offer Expiry ──
export const OFFER_EXPIRY_WEEKS = 4;

// ── Unsolicited Bids (unlisted star / unhappy players) ──
export const UNSOLICITED_OFFER_CHANCE = 0.05;
export const UNSOLICITED_FEE_BASE = 0.75;
export const UNSOLICITED_FEE_RANGE = 0.25;

// ── Performance-Based Bid Premium ──
// Season stats boost the bid fee — players in good form attract higher offers
export const PERFORMANCE_GOAL_PREMIUM = 0.012;       // +1.2% per goal scored this season
export const PERFORMANCE_ASSIST_PREMIUM = 0.008;     // +0.8% per assist this season
export const PERFORMANCE_FORM_PREMIUM = 0.002;       // +0.2% per form point above 50
export const PERFORMANCE_APPEARANCE_THRESHOLD = 8;    // Need 8+ appearances for full bonus
export const PERFORMANCE_MAX_MULTIPLIER = 1.45;       // Cap at 45% premium from performance
export const PERFORMANCE_EXPECTED_SEASON_APPEARANCES = 38; // Full-season equivalent for per-game rate normalization
// Position-specific weights for goals (forwards valued more for goals, defenders for appearances)
export const PERFORMANCE_FWD_GOAL_WEIGHT = 1.5;       // ST/LW/RW get 1.5x goal premium
export const PERFORMANCE_MID_GOAL_WEIGHT = 1.2;       // CM/CDM/CAM/LM/RM get 1.2x goal premium
export const PERFORMANCE_DEF_GOAL_WEIGHT = 0.5;       // CB/LB/RB/GK get 0.5x goal premium

// ── Contract Length Bid Factor ──
export const CONTRACT_1YR_BID_FACTOR = 0.75;           // 1 year left — clubs lowball
export const CONTRACT_2YR_BID_FACTOR = 0.90;           // 2 years left — slight discount

// ── Competing Bid Premium ──
export const COMPETING_BID_PREMIUM = 0.05;             // 5% above highest existing offer

// ── Asking Price Anchor ──
export const ASKING_PRICE_BID_ANCHOR = 0.85;           // AI bids anchor at 85% of asking price as floor

// ── Injury Discount ──
export const INJURY_BID_DISCOUNT = 0.80;               // 20% discount for injured players
export const LONG_INJURY_BID_DISCOUNT = 0.65;          // 35% discount for long-term injuries (8+ weeks)
export const LONG_INJURY_WEEKS_THRESHOLD = 8;          // Weeks threshold for deep discount

// ── Deadline Day ──
export const DEADLINE_DAY_OFFER_MULTIPLIER = 2.0;
export const DEADLINE_DAY_BID_PREMIUM = 0.15;
/** Extra incoming panic offers generated for the player's club on deadline day */
export const DEADLINE_PANIC_OFFER_COUNT = 4;
/** Panic buyers bid this much above market value */
export const DEADLINE_PANIC_BID_PREMIUM = 0.30;
/** Surplus players listed at this discount on deadline day */
export const DEADLINE_BARGAIN_DISCOUNT = 0.20;
/** Chance of a competing bid on the same player during deadline frenzy */
export const DEADLINE_MULTI_BID_CHANCE = 0.4;

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
// CONTRACT_MIN_YEARS and CONTRACT_MAX_YEARS are canonical in contracts.ts
export const SIGNING_BONUS_WEEKS_PER_YEAR = 12;
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
// Minimum market size before replenishment kicks in
export const MARKET_REPLENISH_THRESHOLD = 60;
// How many external (generated) players to add per replenishment cycle.
// Kept small so the market is dominated by real players listed by AI clubs.
export const MARKET_REPLENISH_BATCH_MIN = 1;
export const MARKET_REPLENISH_BATCH_RANGE = 2; // 1-2 players per batch

// ── Division Quality Ranges (overall rating) ──
// Used when generating market players to match realistic quality per division tier
export const DIVISION_QUALITY_RANGES: Record<number, { min: number; max: number; avgPrice: number }> = {
  1: { min: 65, max: 88, avgPrice: 15_000_000 },
  2: { min: 50, max: 75, avgPrice: 5_000_000 },
  3: { min: 40, max: 65, avgPrice: 1_500_000 },
  4: { min: 30, max: 50, avgPrice: 400_000 },
};

// Division weight for how many players from each tier appear on the market
export const DIVISION_MARKET_WEIGHTS: Record<number, number> = {
  1: 0.30,  // 30% of generated players are top flight quality
  2: 0.30,  // 30% Championship quality
  3: 0.25,  // 25% League One quality
  4: 0.15,  // 15% League Two quality
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
// Number of free agents to generate at game start.
// Kept minimal so the game world feels new and grows organically via weekly
// free-agent spawning and AI-club listings rather than arriving pre-populated.
export const INITIAL_FREE_AGENTS_MIN = 2;
export const INITIAL_FREE_AGENTS_RANGE = 2; // 2-3
// Quality range for generated free agents (slightly lower than market)
export const FREE_AGENT_QUALITY_MIN = 35;
export const FREE_AGENT_QUALITY_MAX = 72;
// Weekly chance to spawn new free agents (keeps pool refreshed)
export const FREE_AGENT_SPAWN_CHANCE = 0.25;
export const FREE_AGENT_SPAWN_MIN = 0;
export const FREE_AGENT_SPAWN_RANGE = 2; // 0-1 per spawn event

// ── Reputation-Gated Free Agent Quality ──
// Max OVR a club can sign as free agent = FREE_AGENT_REP_BASE + club.reputation * FREE_AGENT_REP_SCALE
// rep 1 → 42, rep 2 → 49, rep 3 → 56, rep 4 → 63, rep 5 → 70
export const FREE_AGENT_REP_BASE = 35;
export const FREE_AGENT_REP_SCALE = 7;
// Division bonus to reputation gate: higher divisions can access better free agents
// tier 1: +6, tier 2: +3, tier 3: +0, tier 4: -3
export const FREE_AGENT_DIV_BONUS: Record<number, number> = {
  1: 6, 2: 3, 3: 0, 4: -3,
};

// ── Pre-Season Transfer Boost (Friendlies Period, Weeks 1-3) ──
// Pre-season is the busiest transfer window: more players listed, better quality available
export const PRE_SEASON_END = 3;
// Extra market players generated at season start on top of normal initial market.
// Kept modest — most pre-season market supply should come from real AI-club listings.
export const PRE_SEASON_EXTRA_MARKET_MIN = 3;
export const PRE_SEASON_EXTRA_MARKET_RANGE = 3; // 3-5 extra players
// Quality boost: min quality raised by this amount for pre-season market players
export const PRE_SEASON_QUALITY_BOOST = 5;
// Division weight shift: more top-flight talent available in pre-season
export const PRE_SEASON_DIVISION_WEIGHTS: Record<number, number> = {
  1: 0.40,  // 40% top flight (vs 30% normal)
  2: 0.30,  // 30% Championship
  3: 0.20,  // 20% League One (vs 25% normal)
  4: 0.10,  // 10% League Two (vs 15% normal)
};
// Multiplier on transfer rumors during pre-season (more clubs scouting)
export const PRE_SEASON_RUMOR_MULTIPLIER = 2.0;
// Multiplier on incoming offer chance during pre-season weeks
export const PRE_SEASON_OFFER_MULTIPLIER = 1.75;
// Multiplier on unsolicited bid chance during pre-season
export const PRE_SEASON_UNSOLICITED_MULTIPLIER = 2.5;
// Larger replenishment batches during pre-season weeks (still modest —
// real AI-club listings are the primary market supply).
export const PRE_SEASON_REPLENISH_BATCH_MIN = 2;
export const PRE_SEASON_REPLENISH_BATCH_RANGE = 3; // 2-4 per batch

// ── Initial Market Population ──
// Number of generated (unattached) players to seed market with at season start.
// Kept small so ≥80% of listings come from real AI-club players rather than fake externals.
export const INITIAL_MARKET_GEN_MIN = 2;
export const INITIAL_MARKET_GEN_RANGE = 3; // 2-4 players

// ── Negotiation UI Slider Bounds ──
export const NEGOTIATION_SLIDER_MIN_RATIO = 0.5;    // Min offer = 50% of asking price
export const NEGOTIATION_SLIDER_MAX_RATIO = 1.2;    // Max offer = 120% of asking price
export const LISTING_PRICE_MIN_RATIO = 0.5;          // Min listing = 50% of value
export const LISTING_PRICE_MAX_RATIO = 2.0;          // Max listing = 200% of value
export const UNLISTED_PLAYER_PREMIUM = 1.5;           // Synthetic listing = 150% of value

// ── Loan Defaults ──
export const LOAN_DEFAULT_DURATION = 16;               // Default loan duration in weeks
export const LOAN_DEFAULT_WAGE_SPLIT = 50;             // Default wage split percentage
export const LOAN_BUY_FEE_MULTIPLIER = 1.2;           // Default buy fee = 120% of value
export const LOAN_BUY_FEE_MIN_RATIO = 0.8;            // Min buy fee = 80% of value
export const LOAN_BUY_FEE_MAX_RATIO = 2.0;            // Max buy fee = 200% of value
export const LOAN_TERMINATION_MORALE_PENALTY = 10;     // Morale hit for early loan termination

// ── Free Agent Signing ──
export const FREE_AGENT_DEFAULT_CONTRACT_YEARS = 2;    // Default contract years for signing
export const FREE_AGENT_MIN_WAGE_RATIO = 0.7;          // Min wage offer = 70% of player wage
export const FREE_AGENT_MAX_WAGE_RATIO = 2.0;          // Max wage offer = 200% of player wage

// ── Negotiation Strikes ──
export const NEGOTIATION_MAX_STRIKES = 3;
export const NEGOTIATION_COOLDOWN_WEEKS = 12;  // ~3 months game time
export const NEGOTIATION_STRIKE_PENALTY = 0.05; // -5% acceptance per existing strike

// ── Market Listing Expiry ──
// Unsold listings are refreshed after this many weeks
export const LISTING_EXPIRY_WEEKS = 12;
// Club-listed players expire after more weeks (clubs are stickier than external market)
export const CLUB_LISTING_EXPIRY_WEEKS = 16;
// Chance to relist expired listing with reduced price
export const LISTING_RELIST_CHANCE = 0.4;
export const LISTING_RELIST_DISCOUNT = 0.15; // 15% price reduction

// ── Player Release (contract termination clause) ──
// Releasing a player terminates their contract for a one-off "buyout" fee
// equal to remaining wages × this percentage. 100% would be full severance
// (very expensive on long contracts) — 35% lands closer to real-world
// buyout clauses while still making release a meaningful financial decision.
export const RELEASE_CLAUSE_PERCENTAGE = 0.35;
// Players at/above this OVR are treated as "stars" — releasing them dents
// fan mood and board confidence (fans don't forgive selling icons for free).
export const RELEASE_STAR_OVR_THRESHOLD = 80;
export const RELEASE_STAR_FAN_MOOD_PENALTY = 8;
export const RELEASE_STAR_BOARD_PENALTY = 5;
// Long-serving squad members trigger a smaller dip even if not elite.
export const RELEASE_LEGEND_SEASONS = 5;
export const RELEASE_LEGEND_FAN_MOOD_PENALTY = 5;
export const RELEASE_LEGEND_BOARD_PENALTY = 3;
// High-potential youngsters released without service trigger a wasted-potential dip.
export const RELEASE_WASTED_POTENTIAL_OVR = 80;
export const RELEASE_WASTED_POTENTIAL_AGE = 22;
export const RELEASE_WASTED_POTENTIAL_FAN_MOOD_PENALTY = 4;
