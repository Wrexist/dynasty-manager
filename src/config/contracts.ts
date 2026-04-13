/**
 * Contract Negotiation Configuration
 * All constants for wage demands, agent fees, willingness, and negotiation rounds.
 */

// ── Age Factor Brackets ──
// Each bracket defines a max age (exclusive) and its wage demand multiplier.
export const CONTRACT_AGE_BRACKETS = [
  { maxAge: 22, factor: 0.8 },
  { maxAge: 26, factor: 1.0 },
  { maxAge: 30, factor: 1.15 },  // 26-29 inclusive (peak earners)
  { maxAge: 33, factor: 0.95 },  // 30-32 inclusive
] as const;
export const CONTRACT_DEFAULT_AGE_FACTOR = 0.75;

// ── Quality & Reputation Factors ──
export const CONTRACT_QUALITY_BASE_OVERALL = 60;
export const CONTRACT_QUALITY_SCALE = 0.015;
export const CONTRACT_FORM_HIGH = 70;
export const CONTRACT_FORM_LOW = 40;
export const CONTRACT_FORM_HIGH_FACTOR = 1.1;
export const CONTRACT_FORM_LOW_FACTOR = 0.9;
export const CONTRACT_MORALE_LOW = 30;
export const CONTRACT_MORALE_HIGH = 80;
export const CONTRACT_MORALE_LOW_FACTOR = 0.85;
export const CONTRACT_MORALE_HIGH_FACTOR = 1.05;
export const CONTRACT_REP_MULTIPLIER = 0.03;
export const CONTRACT_MINIMUM_WAGE = 500;

// ── Agent Fees ──
export const CONTRACT_AGENT_FEE_BASE = 0.05;
export const CONTRACT_AGENT_FEE_RANGE = 0.1;
export const CONTRACT_WAGE_WEEKS_PER_YEAR = 38;

// ── Willingness ──
export const CONTRACT_WILLINGNESS_BASE = 50;
export const CONTRACT_WILLINGNESS_MORALE_FACTOR = 0.3;
export const CONTRACT_WILLINGNESS_FORM_FACTOR = 0.2;
export const CONTRACT_WILLINGNESS_REP_FACTOR = 5;
export const CONTRACT_WILLINGNESS_LOW_CONTRACT_PENALTY = 15;
export const CONTRACT_WILLINGNESS_YOUNG_BONUS = 10;
export const CONTRACT_WILLINGNESS_STAR_PENALTY = 15;
export const CONTRACT_WILLINGNESS_LOW_CONTRACT_THRESHOLD = 1;
export const CONTRACT_WILLINGNESS_YOUNG_AGE = 22;
export const CONTRACT_WILLINGNESS_STAR_OVERALL = 80;
export const CONTRACT_WILLINGNESS_MIN = 5;
export const CONTRACT_WILLINGNESS_MAX = 95;

// ── Contract Years by Age ──
// Aligned with CONTRACT_PREFERRED_YEARS_BRACKETS so initial offers match player preferences.
export const CONTRACT_YEARS_BRACKETS = [
  { maxAge: 24, years: 4 },
  { maxAge: 28, years: 3 },
  { maxAge: 32, years: 2 },
] as const;
export const CONTRACT_DEFAULT_YEARS = 1;

// ── Initial Offer ──
export const CONTRACT_INITIAL_OFFER_MULTIPLIER = 0.85;
export const CONTRACT_LOYALTY_BONUS_RATE = 0.05;

// ── Negotiation Rounds ──
export const CONTRACT_MAX_ROUNDS = 3;

// ── Acceptance Thresholds (offer/demand ratio) ──
export const CONTRACT_GAP_ACCEPT = 1.0;
export const CONTRACT_GAP_MOOD_ACCEPT = 0.92;
export const CONTRACT_GAP_HIGH_MOOD_ACCEPT = 0.85;
export const CONTRACT_MOOD_ACCEPT_THRESHOLD = 60;
export const CONTRACT_HIGH_MOOD_THRESHOLD = 80;

// ── Compromise ──
export const CONTRACT_COMPROMISE_BASE = 0.03;
export const CONTRACT_COMPROMISE_MOOD_SCALE = 0.07;

// ── Contract Years Range ──
export const CONTRACT_MIN_YEARS = 1;
export const CONTRACT_MAX_YEARS = 5;

// Preferred years by age (player's ideal contract length)
export const CONTRACT_PREFERRED_YEARS_BRACKETS = [
  { maxAge: 24, preferredYears: 4 },  // Young players want long-term security
  { maxAge: 28, preferredYears: 3 },  // Prime players want medium
  { maxAge: 32, preferredYears: 2 },  // Aging players prefer shorter
] as const;
export const CONTRACT_PREFERRED_YEARS_DEFAULT = 1; // 32+ prefer 1-year deals

// How much each year of deviation from preferred impacts the effective gap
export const CONTRACT_YEARS_ACCEPTANCE_BONUS = 0.05;   // +5% per year over preferred
export const CONTRACT_YEARS_ACCEPTANCE_PENALTY = 0.12;  // -12% per year under preferred (players really care about length)

// Years deviation also affects player mood during negotiation
export const CONTRACT_YEARS_MOOD_PENALTY = 8;   // -8 mood per year under preferred
export const CONTRACT_YEARS_MOOD_BONUS = 3;     // +3 mood per year over preferred

// ── Mood Penalties (from lowballing) ──
export const CONTRACT_LOWBALL_GAP = 0.7;
export const CONTRACT_MODERATE_GAP = 0.85;
export const CONTRACT_MOOD_HIT_LOWBALL = -20;
export const CONTRACT_MOOD_HIT_MODERATE = -8;
export const CONTRACT_MOOD_HIT_CLOSE = -3;
export const CONTRACT_MOOD_FLOOR = 5;

// ── Contract Negotiation Strikes ──
/** Max failed negotiation attempts before cooldown locks the player */
export const CONTRACT_MAX_STRIKES = 3;
/** Weeks the player is locked out after max strikes */
export const CONTRACT_STRIKE_COOLDOWN_WEEKS = 8;

// ── Contract Expiry Visibility ──
/** How many seasons ahead to flag a contract as "near expiry" on squad views */
export const CONTRACT_NEAR_EXPIRY_SEASONS = 1;
