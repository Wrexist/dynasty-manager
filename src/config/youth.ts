/**
 * Youth Academy Configuration
 * Quality formulas, age ranges, development thresholds.
 */

// ── Youth Quality Formula ──
export const YOUTH_BASE_QUALITY = 35;
export const YOUTH_RATING_MULTIPLIER = 3;
export const YOUTH_COACH_MULTIPLIER = 1.5;
export const YOUTH_QUALITY_RANDOM_RANGE = 10;
export const YOUTH_QUALITY_MIN = 30;
export const YOUTH_QUALITY_MAX = 65;
// Division quality scaling: youth quality is blended with club's squad quality
export const YOUTH_CLUB_QUALITY_WEIGHT = 0.25;

// ── Youth Age ──
export const YOUTH_BASE_AGE = 16;
export const YOUTH_AGE_RANGE = 2;

// ── Youth Potential ──
export const YOUTH_POTENTIAL_BASE_BONUS = 10;
export const YOUTH_POTENTIAL_MAX = 99;

// ── Promotion Threshold ──
export const YOUTH_READY_OVERALL_THRESHOLD = 55;

// ── Development Score ──
export const YOUTH_DEV_SCORE_BASE = 10;
export const YOUTH_DEV_SCORE_RANGE = 30;

// ── Intake Preview ──
export const INTAKE_PREVIEW_MIN = 2;
export const INTAKE_PREVIEW_RANGE = 2;
export const INTAKE_PREVIEW_POTENTIAL_BASE = 55;
export const INTAKE_PREVIEW_POTENTIAL_RANGE = 15;

// ── Youth Tier Progression ──
/** Development rate multiplier per tier (applied to weekly devGain) */
export const YOUTH_TIER_DEV_MULT = {
  u18: 1.00,    // Baseline — teens finding their feet
  u21: 1.15,    // Peak development window
  bteam: 0.90,  // Near-senior level, slower gains
} as const;

/** Age at which a prospect automatically moves up a tier at season-end */
export const YOUTH_TIER_AGE_PROMOTION = {
  u18_to_u21: 18,
  u21_to_bteam: 20,
} as const;

/** Overall rating threshold that accelerates tier promotion */
export const YOUTH_TIER_OVR_PROMOTION = {
  u18_to_u21: 58,
  u21_to_bteam: 65,
} as const;
