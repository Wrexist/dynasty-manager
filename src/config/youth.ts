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

// ── Youth Age ──
export const YOUTH_BASE_AGE = 16;
export const YOUTH_AGE_RANGE = 2;

// ── Youth Potential ──
export const YOUTH_POTENTIAL_BASE_BONUS = 10;
export const YOUTH_POTENTIAL_MAX = 99;

// ── Promotion Threshold ──
export const YOUTH_READY_OVERALL_THRESHOLD = 55;
export const YOUTH_READY_DEV_SCORE_THRESHOLD = 80;

// ── Development Score ──
export const YOUTH_DEV_SCORE_BASE = 10;
export const YOUTH_DEV_SCORE_RANGE = 30;

// ── Intake Preview ──
export const INTAKE_PREVIEW_MIN = 2;
export const INTAKE_PREVIEW_RANGE = 2;
export const INTAKE_PREVIEW_POTENTIAL_BASE = 55;
export const INTAKE_PREVIEW_POTENTIAL_RANGE = 15;

// ── Stagnation ──
export const STAGNATION_CHANCE_LOW_POTENTIAL = 0.08;
export const STAGNATION_CHANCE_MED_POTENTIAL = 0.05;
export const STAGNATION_CHANCE_HIGH_POTENTIAL = 0.01;
export const STAGNATION_POTENTIAL_LOW = 50;
export const STAGNATION_POTENTIAL_MED = 60;

// ── Bust Risk ──
export const BUST_CHANCE_LOW_POTENTIAL = 0.01;
export const BUST_CHANCE_MED_POTENTIAL = 0.005;
export const BUST_POTENTIAL_LOW = 55;
export const BUST_POTENTIAL_MED = 65;
export const BUST_DROP_BASE = 3;
export const BUST_DROP_RANGE = 3;
