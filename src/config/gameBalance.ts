/**
 * Game Balance Configuration
 * Season structure, board confidence, player development, finances, and more.
 */

import type { PlayerAttributes, PlayerRarity, Position } from '@/types/game';

// ── Season Structure ──
export const TOTAL_WEEKS = 46;
/** Week boundary between Spring phase and Run-In phase */
export const SPRING_PHASE_END_WEEK = 38;
export const STARTING_BOARD_CONFIDENCE = 50;
export const FRIENDLY_BOARD_CONFIDENCE_MULT = 0.25;
export const LINEUP_SIZE = 11;
export const LOW_FITNESS_THRESHOLD = 65;

// ── First Match Confidence Boost (Season 1 only) ──
export const FIRST_MATCH_ATTACK_BOOST = 0.08;
export const FIRST_MATCH_DEFENSE_BOOST = 0.05;

// ── Player Development: Growth ──
export const GROWTH_AGE_THRESHOLD = 24;
export const MAX_SEASON_GROWTH = 12;
export const GROWTH_BASE_CHANCE = 0.05;
export const GROWTH_POTENTIAL_GAP_FACTOR = 0.01;
// Diminishing returns for natural development (same formula as training)
export const DEV_DIMINISHING_RETURNS_CEILING = 100;
export const DEV_DIMINISHING_RETURNS_DIVISOR = 60;
export const PLAYING_TIME_BONUS_MAX = 0.20;
export const PLAYING_TIME_BONUS_PER_APP = 0.007;

// ── Player Development: Decline ──
export const DECLINE_AGE_THRESHOLD = 31;
export const STEEP_DECLINE_AGE_THRESHOLD = 33;
export const DECLINE_FACTOR_NORMAL = 0.015;
export const DECLINE_FACTOR_STEEP = 0.025;
export const DECLINE_BASE_CHANCE = 0.03;
/** Pace/physical decline 1.5x faster, mental declines 0.5x */
export const DECLINE_ATTR_MULTIPLIERS: Record<keyof PlayerAttributes, number> = {
  pace: 1.5, physical: 1.5, mental: 0.5,
  shooting: 1.0, passing: 1.0, defending: 1.0,
};

// ── Position-Specific Development Bonuses ──
export const POSITION_DEV_BONUS: Record<string, Partial<Record<keyof PlayerAttributes, number>>> = {
  'GK':  { defending: 0.03, mental: 0.02 },
  'CB':  { defending: 0.03, physical: 0.02, mental: 0.01 },
  'LB':  { pace: 0.02, defending: 0.02, physical: 0.01 },
  'RB':  { pace: 0.02, defending: 0.02, physical: 0.01 },
  'CDM': { defending: 0.02, passing: 0.02, mental: 0.01 },
  'CM':  { passing: 0.03, mental: 0.02 },
  'CAM': { passing: 0.02, shooting: 0.02, mental: 0.01 },
  'LM':  { pace: 0.02, passing: 0.02 },
  'RM':  { pace: 0.02, passing: 0.02 },
  'LW':  { pace: 0.03, shooting: 0.02 },
  'RW':  { pace: 0.03, shooting: 0.02 },
  'ST':  { shooting: 0.03, physical: 0.01, pace: 0.01 },
};

// ── Value Age Multipliers (calibrated to real transfer market age curves) ──
// Tightened in v67 rebalance: peak window widened to 24-28 (modern football
// prime), teen prospects nudged up (clubs pay premiums for them), and the
// 32+ cliff steepened to mirror the real market — a 33yo legend keeps shirt
// sales but loses transfer value sharply unless their rarity tier props it up.
export const VALUE_AGE_MULTIPLIERS = [
  { maxAge: 18, multiplier: 0.35 },   // Very young prospect — modern teen premium
  { maxAge: 20, multiplier: 0.58 },   // Young prospect
  { maxAge: 22, multiplier: 0.82 },   // Emerging talent
  { maxAge: 24, multiplier: 0.95 },   // Rising player approaching peak
  { maxAge: 28, multiplier: 1.00 },   // Prime peak (24-28 widened from 25-27)
  { maxAge: 30, multiplier: 0.82 },   // Late prime
  { maxAge: 32, multiplier: 0.55 },   // Declining
  { maxAge: 34, multiplier: 0.28 },   // Veteran
  { maxAge: Infinity, multiplier: 0.10 },  // End of career
] as const;

// ── Player Rarity Tier ──
/** OVR thresholds for rarity classification. Legends are the top ~0.5% of
 *  generated players (cap is 86, so only real-template superstars qualify
 *  without Ballon d'Or hardware). */
export const RARITY_LEGEND_OVR = 90;
export const RARITY_LEGEND_OVR_FLOOR = 93;   // OVR ≥ 93 → legend regardless of awards
export const RARITY_ICON_OVR = 88;
export const RARITY_STAR_OVR = 82;
export const RARITY_RARE_OVR = 75;
/** Ballon d'Or top-3 placements required to upgrade a 90+ player to legend. */
export const RARITY_LEGEND_TOP3_PLACEMENTS = 1;
/** Ballon d'Or top-25 placements required to upgrade a 90+ player to legend. */
export const RARITY_LEGEND_TOP25_PLACEMENTS = 3;

/** Value multipliers by rarity. Legends command a 2.5× premium — captures
 *  the real-world reality that a Ballon d'Or-tier 30yo costs more than a
 *  generic 89-rated 26yo despite the worse age curve. */
export const RARITY_VALUE_MULTIPLIERS: Record<PlayerRarity, number> = {
  legend: 2.50,
  icon: 1.65,
  star: 1.18,
  rare: 1.04,
  common: 1.00,
};

/** Wage multipliers by rarity. Legends earn ~1.7× base wage — they print
 *  shirt sales and commercial rev so clubs pay up to retain them. */
export const RARITY_WAGE_MULTIPLIERS: Record<PlayerRarity, number> = {
  legend: 1.70,
  icon: 1.35,
  star: 1.12,
  rare: 1.02,
  common: 1.00,
};

// ── Board Confidence ──
export const CONFIDENCE_WIN_CHANGE = 4;
export const CONFIDENCE_LOSS_CHANGE = -5;
export const CONFIDENCE_DRAW_CHANGE = 0;
export const CONFIDENCE_POSITION_BONUS = 2;
export const CONFIDENCE_POSITION_PENALTY = -2;
export const CONFIDENCE_POSITION_PENALTY_THRESHOLD = -3;
export const CONFIDENCE_BUDGET_PENALTY = -2;
export const CONFIDENCE_BUDGET_THRESHOLD = -5_000_000;
export const CONFIDENCE_WIN_STREAK_BONUS = 3;
export const CONFIDENCE_LOSS_STREAK_PENALTY = -7;
export const CONFIDENCE_STREAK_LENGTH = 3;
export const CONFIDENCE_WARNING_THRESHOLD = 25;
export const CONFIDENCE_PLEASED_THRESHOLD = 80;
export const CONFIDENCE_MIN = 10;
export const CONFIDENCE_MAX = 100;

// ── Expected Position by Reputation ──
const EXPECTED_POSITION_BY_REP: { minRep: number; expectedPos: number }[] = [
  { minRep: 5, expectedPos: 3 },
  { minRep: 4, expectedPos: 8 },
  { minRep: 3, expectedPos: 12 },
  { minRep: 0, expectedPos: 17 },
];

export function getExpectedPosition(reputation: number): number {
  for (const entry of EXPECTED_POSITION_BY_REP) {
    if (reputation >= entry.minRep) return entry.expectedPos;
  }
  return 17;
}

// ── Match Result Impact ──
export const FITNESS_DRAIN_PER_MATCH = -10;
export const FITNESS_MIN_POST_MATCH = 50;
export const MORALE_WIN_CHANGE = 8;
export const MORALE_LOSS_CHANGE = -10;
// Cap on the summed narrative morale-loss reduction (Veteran Leader +2,
// One-Club Man +1, per tagged lineup player). Uncapped, 5-6 tagged players
// made defeats morale-neutral or positive; the win-side narrative boost is
// already capped at +5, so the loss side must be bounded too.
export const NARRATIVE_MORALE_LOSS_REDUCTION_CAP = 6;
export const FORM_WIN_CHANGE = 5;
export const FORM_LOSS_CHANGE = -8;
export const FORM_DRAW_CHANGE = -2;

// ── Injury ──
export const MATCH_INJURY_WEEKS_MIN = 1;
export const MATCH_INJURY_WEEKS_RANGE = 4;
export const RED_CARD_SUSPENSION_MIN = 1;
export const RED_CARD_SUSPENSION_RANGE = 2;

// ── Physio / Staff ──
export const PHYSIO_RECOVERY_BOOST_THRESHOLD = 7;
/** Probability per week that a good physio triggers +1 recovery (instead of guaranteed) */
export const PHYSIO_RECOVERY_CHANCE = 0.4;
export const PHYSIO_INJURY_REDUCTION_PER_QUALITY = 0.05;
export const ASSISTANT_MANAGER_FAMILIARITY_BOOST = 0.5;

// ── Contract Warnings ──
export const CONTRACT_WARNING_WEEKS = [15, 25, 30, 35] as const;
export const CONTRACT_WARNING_OVERALL_THRESHOLD = 60;
/** Warn about high-potential youth even if below overall threshold */
export const CONTRACT_WARNING_YOUTH_AGE_MAX = 23;
export const CONTRACT_WARNING_YOUTH_POTENTIAL_MIN = 70;
export const CONTRACT_MORALE_HIT_WEEK_THRESHOLD = 25;
export const CONTRACT_MORALE_HIT_OVERALL_THRESHOLD = 70;
export const CONTRACT_MORALE_HIT_AMOUNT = -5;
export const CONTRACT_MORALE_MIN = 20;

// ── Income ──
export const MATCHDAY_INCOME_PER_FAN = 50000;
export const COMMERCIAL_INCOME_PER_REP = 200000;
/** Base weekly income floor so lower-league clubs can still compete */
export const COMMERCIAL_INCOME_BASE = 100000;
export const STADIUM_INCOME_PER_LEVEL = 20000;
export const POSITION_PRIZE_PER_RANK = 15000;
/** Fallback max prize rank (20-team baseline) used only when no league table
 *  is available. Live code (getLeaguePositionPrize in utils/financeHelpers.ts —
 *  shared by weekAdvance income and the finance breakdown) derives the max
 *  rank from the actual table size (teamCount + 1) so 18- and 24-team
 *  divisions pay correctly. */
export const POSITION_PRIZE_MAX_RANK = 21;
/** League-position prize scaling by league tier (tier 1 = full prize).
 *  Lower divisions pay proportionally less; unknown tiers use the tier-4 scale. */
export const POSITION_PRIZE_TIER_SCALE: Record<number, number> = { 1: 1.0, 2: 0.35, 3: 0.12, 4: 0.05 };
export const SCOUTING_COST_PER_ASSIGNMENT = 25000;
export const FAN_MOOD_BASE = 0.8;
export const FAN_MOOD_SCALE = 0.4;

// ── Facility Upgrade ──
export const FACILITY_COST_PER_LEVEL = 5_000_000;
export const FACILITY_BASE_UPGRADE_WEEKS = 2;
export const FACILITY_MAX_LEVEL = 10;

// ── Stadium Stand Upgrade ──
export const STAND_COST_PER_LEVEL = 1_500_000;       // £1.5M per stand level
export const STAND_BASE_UPGRADE_WEEKS = 1;            // 1 week base + stand level

// ── Initial Facilities ──
export const STADIUM_LEVEL_DIVISOR = 10;
export const MEDICAL_LEVEL_FACTOR = 0.8;
export const RECOVERY_LEVEL_FACTOR = 0.6;
export const RECOVERY_FITNESS_BONUS_PER_LEVEL = 1.0;

// ── Season-End Confidence by Verdict ──
export const SEASON_END_CONFIDENCE: Record<string, number> = {
  excellent: 80,
  good: 65,
  acceptable: 50,
  poor: 30,
  sacked: 10,
} as const;

// ── Replacement Players ──
export const TARGET_TEMPLATE: Record<string, number> = {
  'GK': 2, 'CB': 5, 'LB': 2, 'RB': 2, 'CDM': 1, 'CM': 5, 'CAM': 1, 'LW': 2, 'RW': 2, 'ST': 3,
};
export const MIN_SQUAD_SIZE = 22;
export const MAX_SQUAD_SIZE = 40;
export const REPLACEMENT_QUALITY_REP_MULTIPLIER = 10;
export const REPLACEMENT_QUALITY_BASE = 20;
export const REPLACEMENT_QUALITY_VARIANCE = 15;
export const GENERIC_FILL_POSITIONS: Position[] = ['CM', 'CB', 'ST', 'LW', 'RW'];

// ── Transfer Market Listing ──
export const LISTING_PRICE_MIN_MULTIPLIER = 1.1;
export const LISTING_PRICE_RANDOM_RANGE = 0.4;
export const INITIAL_LISTINGS_MIN = 2;
export const INITIAL_LISTINGS_RANGE = 3;

// ── Youth Intake at Season End ──
export const SEASON_YOUTH_INTAKE_MIN = 2;
export const SEASON_YOUTH_INTAKE_RANGE = 3;

// ── Starting Tactical Familiarity ──
export const STARTING_TACTICAL_FAMILIARITY = 45;

// ── Max Messages ──
export const MAX_MESSAGES = 200;

// ── State Growth Caps ──
export const MAX_FINANCE_HISTORY = 200;
export const MAX_CAREER_TIMELINE = 100;

// ── Loan Development ──
export const LOAN_PLAY_CHANCE_HIGH = 0.7;
export const LOAN_PLAY_CHANCE_LOW = 0.4;
export const LOAN_DEV_BASE_CHANCE = 0.03;
export const LOAN_DEV_REP_FACTOR = 0.005;
export const LOAN_QUALITY_FORMULA_REP_MULT = 10;
export const LOAN_QUALITY_FORMULA_BASE = 30;
export const LOAN_FITNESS_DRAIN = 8;
export const LOAN_YOUNG_AGE_THRESHOLD = 24;

// ── Congested Fixture Injury Risk ──
export const CONGESTED_FIXTURE_INJURY_MULTIPLIER = 1.3;

// ── Cup Draw Resolution ──
export const CUP_EXTRA_TIME_GOAL_CHANCE = 0.35;
/** Divisor applied to club reputation to get the extra-time scoring multiplier.
 *  A reputation-100 side gets 100/5 = 20× the base extra-time chance. */
export const CUP_EXTRA_TIME_REPUTATION_DIVISOR = 5;
export const CUP_PENALTY_WIN_CHANCE = 0.5;
export const CUP_PENALTY_GK_QUALITY_FACTOR = 0.15;
export const CUP_PENALTY_KICKS = 5;

// ── Interactive penalty shootout (tap-to-aim) ──
// Calibrated so an average taker aiming a sensible mid-corner shot converts
// ~PENALTY_CONVERSION_RATE (0.76, config/matchEngine.ts) — the aimed flow must
// not be systematically easier or harder than the old auto-sim, only more
// skill-expressive at the extremes (safe center vs risky corner).
export const PEN_AIM = {
  /** Off-target risk at a dead-center aim (pros basically never miss the frame). */
  OFF_TARGET_BASE: 0.02,
  /** Extra off-target risk at the very edge of the frame for a 0-quality
   *  taker; scaled down by taker quality. Edge aim ≈ base + edge×(1−q·0.8). */
  OFF_TARGET_EDGE: 0.30,
  /** Aim boldness (0 center → 1 extreme corner) beyond which off-target risk
   *  starts accruing. Below this the shot is always on frame. */
  SAFE_BOLDNESS: 0.55,
  /** Chance the keeper reads the correct side at gkQuality 0 / added at 1.
   *  Correct-side odds = SIDE_READ_BASE + SIDE_READ_GK × gkQuality. */
  SIDE_READ_BASE: 0.34,
  SIDE_READ_GK: 0.22,
  /** Save chance when the keeper picked the right side, for a dead-center
   *  shot at gkQuality 0.5 — decays with aim boldness (corners are hard to
   *  reach even when read) and grows with gkQuality. */
  SAVE_REACH_BASE: 0.82,
  SAVE_REACH_BOLDNESS_DECAY: 0.62,
  SAVE_REACH_GK_SPREAD: 0.35,
  /** How much shooter quality dampens the save chance (composure/placement). */
  SAVE_SHOOTER_DAMPEN: 0.25,
  /** Chance the keeper plays mind games before a player kick, and the
   *  effective-quality penalty on the rattled taker when he does. */
  KEEPER_TAUNT_CHANCE: 0.3,
  RATTLE_QUALITY_PENALTY: 0.08,
  /** Shot power (0–1). NEUTRAL is the calibration point — kicks at that power
   *  behave exactly like the pre-power model. Above it: harder to save but
   *  easier to blaze off target; below it: placeable but reachable. */
  POWER_NEUTRAL: 0.6,
  /** Off-target chance scales by (1 + POWER_OFF_TARGET_SCALE × (p − neutral)). */
  POWER_OFF_TARGET_SCALE: 1.1,
  /** Keeper reach scales by (1 − POWER_SAVE_SCALE × (p − neutral)). */
  POWER_SAVE_SCALE: 0.8,
  /** Quick-tap (no charge) shot power, the hold-to-charge ping-pong cycle,
   *  and the press duration below which a press counts as a tap. */
  POWER_TAP_DEFAULT: 0.65,
  CHARGE_CYCLE_MS: 1100,
  TAP_MAX_MS: 160,
  /** Keepers' penalty-taking discount (they step up last for a reason). */
  GK_TAKER_MULT: 0.55,
} as const;
/** Maps a nation's 0–1 ranking strength onto the 0–1 GK-quality scale that
 *  simulatePenaltyShootout expects, so international shootouts run through the
 *  same canonical sim as club cups. Club GKs land ~0.5–0.85 via
 *  getClubGKQuality; this keeps nations on the same band (rank 65 → 0.5,
 *  rank 1 → 0.85). */
export const INTL_PENALTY_GK_BASE = 0.5;
export const INTL_PENALTY_GK_SCALE = 0.35;
/** Walkover score awarded when one side has no available players.
 *  Used by league, cup, and continuation fixture forfeits alike. */
export const FORFEIT_SCORE = 3;

// ── Background-sim penalty shootout (AI-only ties) ──
/** Base probability the player's side wins a simulated penalty shootout when
 *  mental attributes are at zero. Scales up with squad mental composure. */
export const SIM_PENALTY_BASE_WIN_CHANCE = 0.35;
/** How much a 100-mental squad adds on top of the base win chance
 *  (0-mental: 0.35, 100-mental: 0.65). */
export const SIM_PENALTY_MENTAL_SCALE = 0.3;

// ── Morale: Match Appearances ──
export const MORALE_APPEARANCE_BOOST = 2;

// ── AI Loan Offers ──
// Note: AI_LOAN_DURATIONS, AI_LOAN_WAGE_SPLITS, AI_LOAN_OBLIGATORY_BUY_CHANCE,
// and AI_LOAN_OBLIGATORY_BUY_MULTIPLIER live in `config/aiSimulation.ts` and
// are imported from there by both consumers (utils/aiSimulation.ts and
// orchestration/weekAdvance.ts) — single source of truth.
export const AI_LOAN_OFFER_CHANCE = 0.08;
export const AI_LOAN_RECALL_CLAUSE_CHANCE = 0.4;

// ── Win Streak Bonuses ──
export const STREAK_MORALE_THRESHOLD = 3;
export const STREAK_MORALE_BONUS = 3;
export const STREAK_INCOME_THRESHOLD = 5;
export const STREAK_INCOME_MULTIPLIER = 0.05; // +5% matchday income
export const STREAK_FORM_THRESHOLD = 8;
export const STREAK_FORM_BONUS = 3;

// ── Captaincy & the Armband ──
/** Minimum age to be auto-assigned the armband — a "senior" player. Younger
 *  players can still be made captain manually. */
export const CAPTAIN_MIN_AGE = 21;
/** The captain's personal leadership contribution to the weekly squad-morale
 *  leadership pool counts this many times. Kept small (well under
 *  match-deciding) — it only nudges the morale drip, never sim parameters. */
export const CAPTAIN_LEADERSHIP_MULT = 2;
/** Squad-wide morale dip applied once when the captain is sold or released. */
export const CAPTAIN_DEPARTURE_SQUAD_MORALE_HIT = 4;

// ── Morale: Benched Players ──
export const MORALE_BENCH_WEEKLY_LOSS = 2;
export const MORALE_BENCH_MIN = 20;
export const BENCH_REST_BONUS = 5;

// ── Board Mid-Season Review ──
export const BOARD_REVIEW_WEEKS = [15, 30];
export const BOARD_REVIEW_RELAX_THRESHOLD = -5;
export const BOARD_REVIEW_RAISE_THRESHOLD = 5;
export const BOARD_REVIEW_ADJUST_POSITIONS = 2;

// ── Board Mid-Season Ultimatum & Sacking ──
// At a board review (BOARD_REVIEW_WEEKS) with confidence at or below the
// critical threshold, the board issues a short-horizon ULTIMATUM: recover to
// the target league position (or lift confidence out of the danger zone) by
// the deadline, or be sacked mid-season. This gives board pressure real teeth
// instead of a message that never lands a consequence.
/** Confidence at or below this at a review triggers an ultimatum (rock-bottom,
 *  just under the season-end sack threshold of 20). */
export const ULTIMATUM_CONFIDENCE_THRESHOLD = 18;
/** Weeks the manager gets to turn results around before the deadline bites. */
export const ULTIMATUM_HORIZON_WEEKS = 6;
/** Confidence at or above this by the deadline counts as surviving even if the
 *  league position target wasn't met (a genuine recovery reprieve). */
export const ULTIMATUM_SURVIVE_CONFIDENCE = 25;
/** Small confidence bump when the manager survives an ultimatum. */
export const ULTIMATUM_SURVIVE_CONFIDENCE_BONUS = 10;
/** The demanded league position is the board's expected position plus this
 *  tolerance (mirrors the review copy's "diff <= 3 is tolerable" band). */
export const ULTIMATUM_POSITION_TOLERANCE = 3;
/** Grace window: never issue an ultimatum before this week in SEASON 1, so a
 *  new player gets a fair chance to settle before the board can sack them. */
export const ULTIMATUM_SEASON1_GRACE_WEEK = 25;
/** Sandbox has no job market / sacking, so an ultimatum failure there applies a
 *  budget cut and a confidence floor instead of ending the save. */
export const ULTIMATUM_SANDBOX_BUDGET_CUT = 0.25;
export const ULTIMATUM_SANDBOX_CONFIDENCE_FLOOR = 22;

// ── Pre-Season Friendlies ──
// Friendlies are scheduled ONLY on weeks the player's club is otherwise free
// (no league fixture, no known cup tie), so a new manager never sees two
// matches stacked in the same week — the weeks-1-3 double-booking trust bug.
// Dense leagues (totalWeeks == matchWeeks fills every week) simply start
// straight into the league with no pre-season friendlies.
export const PRESEASON_FRIENDLY_COUNT = 3;
/** Only place friendlies inside this early pre-season window so they never
 *  appear as stray mid-season exhibition matches. */
export const FRIENDLY_PLACEMENT_MAX_WEEK = 10;

// ── Board Objective Rewards ──
export const BOARD_OBJ_XP_CRITICAL = 40;
export const BOARD_OBJ_XP_IMPORTANT = 25;
export const BOARD_OBJ_XP_OPTIONAL = 15;
export const BOARD_OBJ_XP_OVERACHIEVE_MULT = 2;
export const BOARD_OBJ_BUDGET_BOOST = 2_000_000;
export const BOARD_OBJ_ALL_COMPLETE_XP = 50;
export const BOARD_OBJ_ALL_COMPLETE_CONFIDENCE = 8;

/**
 * "Cement the Legacy" prestige path: each time the manager cements their
 * legacy (stays at the club instead of restarting), the board's season
 * expectations tighten permanently by this many league positions. Applied
 * as a simple additive offset to the generated league-position targets —
 * e.g. "Finish in Top 3" becomes "Finish in Top 2". Cumulative across
 * repeated cementings; clamped so a target never drops below 1st.
 */
export const CEMENT_LEGACY_EXPECTATION_OFFSET = 1;

// ── Prestige Perk Costs ──
export const PRESTIGE_PERK_TIER_6_COST = 1000;
export const PRESTIGE_PERK_TIER_7_COST = 1500;

// ── Fan Confidence Formula ──
export const FAN_CONFIDENCE_FAN_WEIGHT = 0.5;
export const FAN_CONFIDENCE_BOARD_WEIGHT = 0.5;

// ── Manager Perks ──
export const MOTIVATOR_MORALE_BOOST = 5;
export const YOUTH_DEVELOPER_BOOST = 0.25;

// ── Press Conferences ──
export const PRESS_TRANSFER_RUMOUR_CHANCE = 0.3;
export const PRESS_POOR_FORM_LOSSES = 3;
export const PRESS_GOOD_FORM_WINS = 4;
export const PRESS_BIG_MATCH_REP_GAP = 2;
export const PRESS_PROMOTION_RACE_TOP_N = 3;       // top N positions to trigger promotion_race
export const PRESS_RELEGATION_BATTLE_BOTTOM_N = 3;  // bottom N positions to trigger relegation_battle
export const PRESS_INJURY_CRISIS_MIN = 3;            // minimum injured players to trigger injury_crisis
export const PRESS_DERBY_PREVIEW_CHANCE = 0.6;       // chance of derby_preview context before derby
export const PRESS_NOTABLE_MARGIN = 3;               // goal margin that makes a routine league match press-worthy
export const PRESS_ROUTINE_CHANCE = 0.15;            // chance of a press conference after a non-notable league match

// ── Injury Types & Severity ──
import type { InjuryType, InjurySeverity } from '@/types/game';

interface InjuryTypeConfig {
  /** Display name */
  label: string;
  /** Weeks range by severity */
  weeks: Record<InjurySeverity, [number, number]>;
  /** Re-injury risk (0-1) by severity */
  reinjuryRisk: Record<InjurySeverity, number>;
  /** Weeks of elevated re-injury risk after return */
  reinjuryDuration: Record<InjurySeverity, number>;
  /** Fitness on return (0-100) by severity */
  fitnessOnReturn: Record<InjurySeverity, number>;
  /** Whether this injury type is caused by fouls (vs non-contact) */
  foulRelated: boolean;
}

export const INJURY_TYPES: Record<InjuryType, InjuryTypeConfig> = {
  knock: {
    label: 'Knock',
    weeks: { minor: [1, 1], moderate: [1, 2], severe: [2, 3] },
    reinjuryRisk: { minor: 0.05, moderate: 0.08, severe: 0.12 },
    reinjuryDuration: { minor: 2, moderate: 3, severe: 4 },
    fitnessOnReturn: { minor: 85, moderate: 75, severe: 65 },
    foulRelated: true,
  },
  muscle_strain: {
    label: 'Muscle Strain',
    weeks: { minor: [1, 2], moderate: [2, 3], severe: [3, 5] },
    reinjuryRisk: { minor: 0.08, moderate: 0.15, severe: 0.22 },
    reinjuryDuration: { minor: 3, moderate: 4, severe: 6 },
    fitnessOnReturn: { minor: 80, moderate: 70, severe: 55 },
    foulRelated: false,
  },
  hamstring: {
    label: 'Hamstring Injury',
    weeks: { minor: [2, 3], moderate: [3, 5], severe: [5, 8] },
    reinjuryRisk: { minor: 0.12, moderate: 0.20, severe: 0.30 },
    reinjuryDuration: { minor: 4, moderate: 6, severe: 8 },
    fitnessOnReturn: { minor: 75, moderate: 60, severe: 50 },
    foulRelated: false,
  },
  ligament: {
    label: 'Ligament Damage',
    weeks: { minor: [3, 5], moderate: [5, 10], severe: [10, 16] },
    reinjuryRisk: { minor: 0.10, moderate: 0.18, severe: 0.25 },
    reinjuryDuration: { minor: 4, moderate: 6, severe: 10 },
    fitnessOnReturn: { minor: 70, moderate: 55, severe: 45 },
    foulRelated: true,
  },
  fracture: {
    label: 'Fracture',
    weeks: { minor: [4, 6], moderate: [6, 10], severe: [10, 16] },
    reinjuryRisk: { minor: 0.05, moderate: 0.08, severe: 0.10 },
    reinjuryDuration: { minor: 3, moderate: 4, severe: 6 },
    fitnessOnReturn: { minor: 65, moderate: 50, severe: 40 },
    foulRelated: true,
  },
  concussion: {
    label: 'Concussion',
    weeks: { minor: [1, 2], moderate: [2, 4], severe: [4, 6] },
    reinjuryRisk: { minor: 0.15, moderate: 0.25, severe: 0.35 },
    reinjuryDuration: { minor: 4, moderate: 6, severe: 8 },
    fitnessOnReturn: { minor: 80, moderate: 70, severe: 60 },
    foulRelated: true,
  },
  acl: {
    label: 'ACL Injury',
    weeks: { minor: [12, 16], moderate: [16, 24], severe: [24, 36] },
    reinjuryRisk: { minor: 0.15, moderate: 0.25, severe: 0.35 },
    reinjuryDuration: { minor: 8, moderate: 12, severe: 16 },
    fitnessOnReturn: { minor: 55, moderate: 40, severe: 30 },
    foulRelated: false,
  },
};

/** Probability weights for injury type selection (foul-related) */
export const FOUL_INJURY_TYPE_WEIGHTS: Record<string, number> = {
  knock: 40, fracture: 20, concussion: 15, ligament: 15, muscle_strain: 10,
};

/** Probability weights for injury type selection (non-foul) */
export const NON_FOUL_INJURY_TYPE_WEIGHTS: Record<string, number> = {
  muscle_strain: 35, hamstring: 30, knock: 15, ligament: 10, acl: 5, concussion: 5,
};

/** Severity distribution */
export const INJURY_SEVERITY_WEIGHTS: Record<InjurySeverity, number> = {
  minor: 50, moderate: 35, severe: 15,
};

/** How much medical facility level reduces match injury probability (per level, 1-10) */
export const MEDICAL_INJURY_PREVENTION_PER_LEVEL = 0.015;

/** How much medical facility level reduces re-injury risk (per level, 1-10) */
export const MEDICAL_REINJURY_REDUCTION_PER_LEVEL = 0.02;

/** Re-injury chance multiplier when a player with active reinjuryRisk plays a match */
export const REINJURY_MATCH_CHECK_CHANCE = 0.5;

// ── Financial Fair Play ──
/** Wage-to-revenue ratio that triggers a warning */
export const FFP_WAGE_RATIO_WARNING = 0.70;
/** Wage-to-revenue ratio that triggers critical penalties */
export const FFP_WAGE_RATIO_CRITICAL = 0.90;
/** Board confidence penalty per week when above warning threshold */
export const FFP_CONFIDENCE_PENALTY = 3;
/** Board confidence penalty per week when above critical threshold */
export const FFP_CRITICAL_CONFIDENCE_PENALTY = 6;

// ── Manager Salary Impact ──
/** Manager salary-to-income ratio that triggers a board warning */
export const MANAGER_SALARY_RATIO_WARNING = 0.15;
/** Manager salary-to-income ratio that triggers critical board concern */
export const MANAGER_SALARY_RATIO_CRITICAL = 0.25;
/** Board confidence penalty per week when manager salary ratio exceeds warning threshold */
export const MANAGER_SALARY_CONFIDENCE_PENALTY = 1;

// ── Training Focus Development ──
// MODULE_ATTR_MAP and TRAINING_FOCUS_BONUS are now in src/config/training.ts (single source of truth)

// ── Player Unhappiness ──
/** Morale threshold below which unhappiness weeks accumulate */
export const UNHAPPY_THRESHOLD = 30;
/** Weeks of low morale before player submits transfer request */
export const UNHAPPY_WEEKS_TO_REQUEST = 4;
/** Weeks of low morale before unhappiness spreads to teammates */
export const UNHAPPY_CONTAGION_WEEKS = 6;
/** Performance penalty for players wanting to leave (0-1) */
export const UNHAPPY_PERFORMANCE_PENALTY = 0.15;
/** Morale hit to random teammates from contagion */
export const UNHAPPY_CONTAGION_MORALE_HIT = 6;
/** Chance (0-1) that listing an unhappy player appeases them (loyalty-weighted) */
export const APPEASE_BASE_CHANCE = 0.12;
/** Morale boost when an unhappy player is appeased by being listed */
export const APPEASE_MORALE_BOOST = 25;

// ── Transfer Talk ──
/** Base chance (0-1) that "convince to stay" succeeds */
export const TRANSFER_TALK_CONVINCE_BASE_CHANCE = 0.42;
/** Bonus to convince chance per point of player loyalty (scaled by 20) */
export const TRANSFER_TALK_CONVINCE_LOYALTY_BONUS = 0.25;
/** Morale penalty when manager refuses transfer request */
export const TRANSFER_TALK_REFUSE_MORALE_PENALTY = 15;
/** Team-wide morale hit when manager refuses a transfer request */
export const TRANSFER_TALK_REFUSE_TEAM_MORALE_HIT = 3;
/** Morale boost when empathizing with player's transfer request */
export const TRANSFER_TALK_EMPATHIZE_MORALE_BOOST = 5;
/** Morale boost when promising to find player a move */
export const TRANSFER_TALK_PROMISE_MORALE_BOOST = 8;
/** Morale boost when convince-to-stay succeeds */
export const TRANSFER_TALK_CONVINCE_SUCCESS_MORALE = 15;
/** Morale penalty when convince-to-stay fails */
export const TRANSFER_TALK_CONVINCE_FAIL_MORALE = 5;

// ── Free Agent Market ──
/**
 * Maximum free agents in the pool at any time. Bumped from 80 → 200 after the
 * Phase E FA-pool diagnostic showed ~140 CP fcIds per season were being
 * silently dropped at the cap during the contract-expiry pass (endSeason in
 * orchestrationSlice.ts). Real top flights carry hundreds of FAs in a window;
 * 200 fits the seasonal inflow without flooring memory or list-render cost.
 */
export const FREE_AGENT_POOL_MAX = 200;

/**
 * Forced retirement age — at season-end any player whose post-aging age
 * reaches this threshold is retired regardless of their remaining contract
 * length. Without this gate a 35-year-old who signs a 5-year contract
 * could play into their 40s indefinitely as long as the club kept renewing.
 * 40 picks the realistic upper bound (real careers end here for ~99% of
 * players) while leaving room for a few veterans (Buffon, Ibrahimović) to
 * play into their 39th year.
 */
export const FORCED_RETIREMENT_AGE = 40;
// ── Cliffhanger System ──
/** Maximum number of cliffhangers shown per week */
export const MAX_CLIFFHANGERS = 3;
/** Points gap to leader that triggers title race cliffhanger */
export const CLIFFHANGER_TITLE_RACE_GAP = 6;
/** Minimum reputation gap for "big match" cliffhanger */
export const CLIFFHANGER_BIG_MATCH_REP_GAP = 2;
/** Board confidence threshold below which board pressure cliffhangers trigger */
export const CLIFFHANGER_BOARD_PRESSURE_THRESHOLD = 35;
/** Youth prospect potential gap that triggers breakthrough cliffhanger */
export const CLIFFHANGER_YOUTH_POTENTIAL_GAP = 8;
/** Weeks before transfer window closes that triggers deadline cliffhanger */
export const CLIFFHANGER_DEADLINE_WEEKS = 2;

// ── Monthly Objective Cycle ──
/** Number of weeks per monthly objective cycle */
export const OBJECTIVE_CYCLE_WEEKS = 4;

// ── Variable Reward Objectives ──
/** Chance that a rare objective appears (replaces one common objective) */
export const RARE_OBJECTIVE_CHANCE = 0.15;
/** Chance that a legendary objective appears (replaces one common objective) */
export const LEGENDARY_OBJECTIVE_CHANCE = 0.05;
/** XP multiplier for rare objectives */
export const RARE_OBJECTIVE_XP_MULTIPLIER = 2;
/** XP multiplier for legendary objectives */
export const LEGENDARY_OBJECTIVE_XP_MULTIPLIER = 5;
/** Consecutive months with all objectives completed required for streak multiplier */
export const OBJECTIVE_STREAK_THRESHOLD = 3;
/** XP multiplier when on a streak */
export const OBJECTIVE_STREAK_MULTIPLIER = 2;
/** Bonus XP for completing all 3 objectives in a month */
export const ALL_OBJECTIVES_BONUS_XP = 25;

// ── Daily Login Streak Rewards ──
/** Length of one daily-reward cycle. After this many consecutive days the
 *  reward track loops back to day 1, while the streak counter keeps climbing. */
export const DAILY_STREAK_CYCLE = 7;
/** Manager XP granted on each day of the cycle (index 0 = day 1). Escalates
 *  across the week with a milestone payout on the final day to reward an
 *  unbroken streak. Sim-neutral: XP feeds manager progression / perks only,
 *  never match, training, or transfer maths. */
export const DAILY_REWARD_XP = [10, 15, 20, 25, 30, 40, 75] as const;

// ── Coach Checklist XP Rewards ──
export const COACH_TASK_XP: Record<string, number> = {
  'lineup': 5,
  'first-match': 10,
  'objectives': 10,
  'scouting': 5,
  'contracts': 5,
  'transfers': 5,
  'inbox': 5,
};
/** Bonus XP for completing ALL coach checklist tasks */
export const COACH_ALL_TASKS_BONUS_XP = 15;

/**
 * One-off XP payoff for finishing the first-session "Getting Started"
 * checklist (sign a sponsor + send/hire a scout). Turns the tutorial from a
 * card that silently vanishes into a small reward. XP-only by design — it
 * stays off the budget/economy path so it can never affect club finances.
 * Granted once per device, guarded by a persisted flag.
 */
export const ONBOARDING_COMPLETION_XP = 25;

// ── Achievement XP Rewards ──
export const ACHIEVEMENT_XP_BRONZE = 15;
export const ACHIEVEMENT_XP_SILVER = 30;
export const ACHIEVEMENT_XP_GOLD = 50;

// ── Match Drama Detection ──
/** Minute threshold for "late" events */
export const DRAMA_LATE_MINUTE = 85;
/** Goal margin threshold for "thrashing" */
export const DRAMA_THRASHING_MARGIN = 4;
/** Reputation gap for underdog detection */
export const DRAMA_UNDERDOG_REP_GAP = 2;

// ── Celebration Milestones ──
export const GOAL_MILESTONES = [10, 15, 20, 25, 30] as const;
export const ASSIST_MILESTONES = [10, 15, 20] as const;
export const UNBEATEN_MILESTONES = [5, 10, 15, 20] as const;
export const WIN_MILESTONES = [3, 5, 8, 10] as const;
export const CLEAN_SHEET_MILESTONES = [5, 10, 15] as const;
export const CAREER_GOAL_MILESTONES = [50, 100, 200] as const;
export const CAREER_APP_MILESTONES = [100, 200, 500] as const;

// ── Loan Recall ──
export const LOAN_MIN_WEEKS_BEFORE_RECALL = 4;

// ── Manager XP ──
export const MANAGER_XP_BASE = 50;
export const MANAGER_XP_PER_LEVEL = 30;

// ── Talent Tree ──
export const CAPSTONE_MIN_BRANCHES = 2;
export const TRAINING_GROUND_BOOST = 0.2;
export const GOLDEN_GEN_MIN_POTENTIAL = 75;

// ── Mastery Ranks (endless branch progression) ──
// Once all 5 core perks of a branch are unlocked, that branch can be pushed
// into repeatable "Mastery" ranks. Each rank stacks a small multiplicative
// bonus onto that branch's scalable perk effects, hard-capped so it never
// runs away. Cost escalates geometrically so late ranks are a long-run chase.
export const MASTERY_MAX_RANKS = 5;
export const MASTERY_BASE_COST = 1500;
export const MASTERY_COST_GROWTH = 1.5;
/** Stacking bonus to a branch's scaled perk effects, per mastery rank. */
export const MASTERY_BONUS_PER_RANK = 0.02;

// ── Dashboard UI ──
export const CONFIDENCE_CHANGE_DISMISS_THRESHOLD = 5;

// ── International / National Team ──
/** World Cup occurs every N seasons */
export const WORLD_CUP_FREQUENCY = 4;
/** Continental cup occurs every N seasons (offset by 2 from WC) */
export const CONTINENTAL_CUP_FREQUENCY = 4;
/** Number of groups in the World Cup (real 2026 format: 12 groups of 4 = 48). */
export const WORLD_CUP_GROUPS = 12;
/** Teams per group */
export const WORLD_CUP_TEAMS_PER_GROUP = 4;
/** Number of groups in Continental Cup */
export const CONTINENTAL_CUP_GROUPS = 4;
/** National team squad size */
export const NATIONAL_SQUAD_SIZE = 23;
/** Target size for national team candidate pool (generated on job acceptance) */
export const NT_CANDIDATE_POOL_TARGET = 50;
/** Morale boost for players called up to national team */
export const NATIONAL_CALLUP_MORALE_BOOST = 5;
/** Fitness cost per international match */
export const INTERNATIONAL_FITNESS_COST = 8;
/** Weeks during the regular season when international breaks occur */
export const INTERNATIONAL_BREAK_WEEKS = [10, 24, 38];
/** Fitness cost for players returning from an international break */
export const INTERNATIONAL_BREAK_FITNESS_COST = 5;
/** Minimum overall rating to be eligible for international call-up */
export const INTERNATIONAL_CALLUP_MIN_OVR = 70;
/** Minimum overall to feel "snubbed" if not called up */
export const INTERNATIONAL_SNUB_MIN_OVR = 75;
/** Morale penalty for snubbed players */
export const CALLUP_SNUB_MORALE_PENALTY = -3;
/** Fitness cost for players who played 3+ tournament matches */
export const POST_TOURNAMENT_FITNESS_COST_HIGH = 15;
/** Fitness cost for players who played 1-2 tournament matches */
export const POST_TOURNAMENT_FITNESS_COST_LOW = 8;

// ── National Team Job System (Career Mode) ──
/** Minimum reputation to receive first national team offer */
export const NT_JOB_MIN_REPUTATION = 350;
/** Minimum reputation to be re-offered after being sacked */
export const NT_JOB_REHIRE_REPUTATION = 550;
/** Weeks before the offer expires */
export const NT_JOB_OFFER_DURATION_WEEKS = 8;
/** Reputation bonus for winning an international tournament */
export const REP_INTL_TOURNAMENT_WIN = 100;
/** Reputation bonus for reaching the final */
export const REP_INTL_FINAL = 40;
/** Reputation bonus for reaching the semi-final */
export const REP_INTL_SEMI = 20;
/** Reputation bonus for reaching knockouts */
export const REP_INTL_KNOCKOUT = 10;
/** Reputation penalty for group stage exit */
export const REP_INTL_GROUP_EXIT = -15;
/** Consecutive group-stage exits before sacking */
export const NT_SACK_GROUP_EXIT_THRESHOLD = 2;

// ── Random Mid-Season Events ──
/** Base chance per week that a random event triggers */
export const RANDOM_EVENT_BASE_CHANCE = 0.04;
/** Morale hit from dressing room bust-up */
export const BUSTUP_MORALE_HIT = 10;
/** Fitness penalty from international fatigue */
export const INTL_FATIGUE_FITNESS_LOSS = 15;
/** Morale boost from fan favourite momentum */
export const FAN_RALLY_MORALE_BOOST = 5;
/** Budget bonus multiplier for sponsor windfall (fraction of commercial income) */
export const SPONSOR_BONUS_MULTIPLIER = 0.10;
/** Extra board confidence penalty during media scrutiny */
export const MEDIA_SCRUTINY_CONFIDENCE_HIT = 3;

// ── Player Match History ──
export const MAX_PLAYER_MATCH_HISTORY = 20;

// ── Ballon d'Or ──
export const BALLON_DOR_TOP_N = 25;
/** Minimum appearances to be eligible for the Ballon d'Or ranking. Below
 *  this floor a player's counting stats aren't a meaningful sample. */
export const BALLON_DOR_MIN_APPEARANCES = 8;
/** Soft cap on entries from any single division (e.g. eng-1 / esp-1 /
 *  ger-1). Once a division has BALLON_DOR_MAX_PER_DIVISION players in the
 *  ranking, additional candidates from that division are deferred so the
 *  top 25 features players from multiple leagues — mirrors the real
 *  Ballon d'Or where the EPL/La Liga/Bundesliga/Serie A all coexist. The
 *  cap is "soft" in that if there aren't enough qualifying players from
 *  other divisions to fill the 25, the over-cap leagues backfill. */
export const BALLON_DOR_MAX_PER_DIVISION = 6;
/** Weights for the Ballon d'Or scoring formula. v70: `overall` bumped
 *  again (2.0 → 2.5) so a 90-rated player gets +225 from raw quality —
 *  with the new elite-club bonus this anchors top-flight stars at the
 *  top of the leaderboard. `avgRating` cut (3.0 → 2.0) because match
 *  ratings are volatile and were letting non-elite players catch up
 *  via a few hot streaks. Trophy weights (league/cup/intl) added in
 *  v69 so silverware actually moves the needle.
 *  `eliteClub` weight = 1.0 by design — the per-club bonus values in
 *  BALLON_DOR_ELITE_CLUB_BONUS already encode the strength of each
 *  tier so a multiplier here would compound with no added clarity. */
export const BALLON_DOR_WEIGHTS = {
  overall: 2.5,
  goals: 3.0,
  assists: 2.0,
  appearances: 0.5,
  form: 0.5,
  teamPosition: 1.0,
  cleanSheets: 1.0,
  avgRating: 2.0,
  discipline: 1.0,
  divisionTier: 1.5,
  continentalBonus: 1.0,
  leagueTitle: 1.0,
  domesticCup: 1.0,
  leagueCup: 1.0,
  intlTournament: 1.0,
  eliteClub: 1.0,
} as const;

// ── Ballon d'Or — Trophy Bonuses ──
/** Flat bonus for finishing 1st in your league (top of `leagueTable`).
 *  Layered on top of the existing sqrt team-position curve so champions
 *  pull clear of even the second-place runners-up. */
export const BALLON_DOR_LEAGUE_TITLE_BONUS = 25;

/** Domestic cup (FA-Cup style) bonus — winner only. Runners-up don't
 *  count: a cup final loss is good but the BdO panel rewards trophies. */
export const BALLON_DOR_DOMESTIC_CUP_WIN_BONUS = 22;

/** League Cup (secondary domestic knockout) bonus. Smaller than the main
 *  domestic cup because it's the lesser trophy in real football. */
export const BALLON_DOR_LEAGUE_CUP_WIN_BONUS = 12;

/** International tournament stage bonus, awarded to every player whose
 *  nationality reached that stage (regardless of whether they played for
 *  the user's national team — AI nations carry their best players
 *  implicitly). World Cup winner is the headline of any season's BdO.
 *  Group stage gets nothing — qualification alone isn't worth a vote. */
export const BALLON_DOR_INTL_TOURNAMENT_BONUS = {
  winner: 60,
  F: 30,        // runner-up (reached the final)
  SF: 18,       // semi-final
  QF: 10,
  R16: 5,
  group: 0,     // group-stage exit — no bonus
} as const;

// ── Ballon d'Or — Elite-Club Prestige ──
/**
 * Flat bonus added per BdO score for players at real-world elite clubs.
 * Calibrated against the last five years of actual BdO results: 100% of
 * top-5 finishers (Rodri, Vinicius, Bellingham, Carvajal, Mbappé,
 * Messi, Haaland, De Bruyne, Bernardo Silva, Benzema, Modrić, Salah,
 * Mané, Lewandowski, Jorginho, Kanté, Van Dijk, Ronaldo) played for
 * Real Madrid, Barcelona, Atlético, Man City, Liverpool, Chelsea, PSG,
 * Bayern, Juventus, Inter Miami/PSG.
 *
 * The bonus reflects "you're playing at a club where the cameras are
 * always on" — equally important in real BdO voting as raw output. A
 * 25-goal Vinicius from Real Madrid outranks a 30-goal striker from a
 * mid-table side, mirroring real voting bias.
 *
 * Tier breakdown:
 * - 90: UCL-trophy aristocracy (Real Madrid, Man City, Bayern, PSG, Barcelona, Liverpool)
 * - 65: Permanent UCL contenders (Arsenal, Atlético, Inter, Juventus, Chelsea)
 * - 45: Recent UCL/UEL trophy winners or perennial top-4 (Dortmund, Leverkusen,
 *       Napoli, AC Milan, Atalanta, Tottenham)
 * - 28: Elite-adjacent (Man United — pedigree without recent silverware,
 *       RB Leipzig, Marseille, Roma, Lazio)
 */
export const BALLON_DOR_ELITE_CLUB_BONUS: Record<string, number> = {
  // Tier S (90) — UCL aristocracy. Magnitude calibrated so a player at one
  // of these clubs can outscore a non-elite league champion's best player
  // — mirrors how Vinicius/Bellingham still rank top-5 even in seasons
  // when Real Madrid don't win La Liga.
  'real-madrid': 90,
  'manchester-city': 90,
  'bayern-munich': 90,
  'paris-saint-germain': 90,
  'barcelona': 90,
  'liverpool': 90,

  // Tier A (65) — permanent CL contenders
  'arsenal': 65,
  'atletico-madrid': 65,
  'inter-milan': 65,
  'juventus': 65,
  'chelsea': 65,

  // Tier B (45) — recent silverware / top-4 perennials
  'borussia-dortmund': 45,
  'bayer-leverkusen': 45,
  'napoli': 45,
  'ac-milan': 45,
  'atalanta': 45,
  'tottenham-hotspur': 45,

  // Tier C (28) — elite-adjacent / pedigree
  'manchester-united': 28,
  'rb-leipzig': 28,
  'marseille': 28,
  'as-roma': 28,
  'lazio': 28,
};
// v70: Defender goal multipliers nerfed — a CB scoring 7 set-piece goals
// shouldn't outrank a 25-goal striker, which the previous 3.5× weighting
// allowed. Real-world BdO is ~85% attacking output; only Cannavaro 2006
// has ever won it as a CB. Clean-sheet weights also dropped slightly so
// a clean-sheet streak doesn't single-handedly boost a defender past a
// midfielder/forward of comparable raw quality.
export const BALLON_DOR_POSITION_MULTIPLIERS: Record<string, { goals: number; assists: number; cleanSheets: number }> = {
  GK: { goals: 3.5, assists: 1.5, cleanSheets: 1.5 }, CB: { goals: 2.0, assists: 1.2, cleanSheets: 1.2 },
  LB: { goals: 2.0, assists: 1.8, cleanSheets: 1.0 }, RB: { goals: 2.0, assists: 1.8, cleanSheets: 1.0 },
  CDM: { goals: 2.0, assists: 1.8, cleanSheets: 0.4 }, CM: { goals: 1.8, assists: 2.2, cleanSheets: 0 },
  CAM: { goals: 1.4, assists: 2.5, cleanSheets: 0 }, LM: { goals: 1.4, assists: 2.4, cleanSheets: 0 },
  RM: { goals: 1.4, assists: 2.4, cleanSheets: 0 }, LW: { goals: 1.2, assists: 2.0, cleanSheets: 0 },
  RW: { goals: 1.2, assists: 2.0, cleanSheets: 0 }, ST: { goals: 1.0, assists: 1.5, cleanSheets: 0 },
};
export const BALLON_DOR_YELLOW_PENALTY = 0.3;
export const BALLON_DOR_RED_PENALTY = 3.0;
/** Flat division-tier bonus (added to the score, multiplied by the
 *  divisionTier weight). Tier 1 = top-5 leagues only (Premier League,
 *  La Liga, Serie A, Bundesliga, Ligue 1). The gap between top-5 and the
 *  rest was widened in v70 so a Ligue 1 mid-tabler clearly outranks an
 *  Eredivisie / Primeira Liga title contender on raw division strength. */
export const BALLON_DOR_DIVISION_BONUS: Record<number, number> = { 1: 35, 2: 10, 3: 4, 4: 0 };

/**
 * Division tier multiplier applied to **counting-stat scores** (goals,
 * assists, clean sheets) and — at a softer sqrt curve — to the avg-rating
 * score. v70: top-5 keep 1.00 but everything below them takes a much
 * sharper haircut so non-top-5 leagues are realistically Ballon d'Or
 * contenders only via the tightly-weighted overall + avgRating signals,
 * not by stat-padding against weak opposition. A 30-goal striker in a
 * tier-4 league now contributes 30×3.0×1.0×0.10 = 9 from goals vs 90 in
 * tier 1 — the gap that mirrors how the real award is voted.
 */
export const BALLON_DOR_DIVISION_COUNTING_SCALE: Record<number, number> = {
  1: 1.00,   // top-5: eng / esp / ita / ger / fra
  2: 0.40,   // strong leagues outside top-5: ned / por / bel / tur
  3: 0.18,   // mid-tier Europe + South America: scottish / dutch lower / arg / etc.
  4: 0.08,   // smaller European tier-1 leagues + lower divisions
};

/** Milestone descriptions shown on facility cards at key levels */
export const FACILITY_MILESTONES: Record<string, { level: number; label: string }[]> = {
  training: [
    { level: 3, label: 'Advanced drills unlocked' },
    { level: 5, label: '+100% training effectiveness' },
    { level: 7, label: 'Elite coaching methods' },
    { level: 10, label: 'World-class facility' },
  ],
  youth: [
    { level: 3, label: 'Better prospect intake' },
    { level: 5, label: 'Academy sponsor slot' },
    { level: 7, label: 'Elite development rate' },
    { level: 10, label: 'World-class academy' },
  ],
  medical: [
    { level: 3, label: 'Faster recovery times' },
    { level: 5, label: 'Advanced injury prevention' },
    { level: 7, label: 'Elite medical care' },
    { level: 10, label: 'World-class medical' },
  ],
  recovery: [
    { level: 3, label: '+3% weekly fitness' },
    { level: 5, label: '+5% weekly fitness' },
    { level: 7, label: 'Elite recovery protocols' },
    { level: 10, label: 'World-class recovery' },
  ],
};

// ── Ballon d'Or Top-10 Reign ──
/** Top-N rank that earns the special card + stats boost (top 10). */
export const BALLON_DOR_TOP10_RANK = 10;
/** Flat per-attribute boost applied to current top-10 holders. Stays for one
 *  Ballon d'Or cycle — reverted at next season-end if player drops out of
 *  the top 10. Picked to be felt in match sim without dwarfing the rarity
 *  premium or eclipsing the natural 90+ legend tier. */
export const BALLON_DOR_TOP10_ATTR_BOOST = 3;

/** Value multiplier for Ballon d'Or top-25 placements (rank → multiplier).
 *  Bumped at the top in v67 rebalance — the winner now adds +40% on top of
 *  the rarity-tier premium, so a Ballon d'Or hat-trick winner is meaningfully
 *  richer than a "merely" 90-rated star with no hardware. */
export const BALLON_DOR_VALUE_BOOST: Record<number, number> = {
  1: 0.40,   // Winner: +40% value
  2: 0.30,
  3: 0.22,
  4: 0.16,
  5: 0.12,
  10: 0.08,  // Top 10: +8%
  25: 0.04,  // Top 25: +4%
} as const;

// ── Global Team Power Rankings (ELO) ──
export const ELO_K_FACTORS: Record<string, number> = { league: 20, cup: 15, continental: 30 };
export const ELO_INITIAL_TIER_BONUS: Record<number, number> = { 1: 400, 2: 250, 3: 100, 4: 0 };
export const ELO_REPUTATION_MULTIPLIER = 120;

// ── Named Nemesis Rival ──
// grudgeLevel (0-5) is written in store/helpers/matchProcessing.ts: +1 per loss
// to a club, -1 per win. An opponent only becomes your dramatized "nemesis" once
// the grudge crosses this threshold. Heat tiers escalate from here up to 5.
export const NEMESIS_GRUDGE_THRESHOLD = 3;

// ── Ballon d'Or Continental Bonus ──
export const BALLON_DOR_CONTINENTAL_BONUS = {
  champions_cup: { group: 5, R16: 10, QF: 18, SF: 25, F: 30, winner: 40 },
  shield_cup: { group: 2, R16: 5, QF: 8, SF: 12, F: 15, winner: 20 },
  conference_cup: { group: 1, R16: 3, QF: 5, SF: 8, F: 10, winner: 14 },
} as const;
