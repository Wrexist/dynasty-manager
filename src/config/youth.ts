import type { Position } from '@/types/game';

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
// The preview IS next season's intake (see `generateIntakePreview`): its size
// comes from SEASON_YOUTH_INTAKE_MIN/RANGE and each entry's potential is rolled
// with the same formula the intake uses, so the old preview-only size and
// potential constants are gone.
/** Youth-coach quality assumed when a preview is built without staff context. */
export const YOUTH_PREVIEW_DEFAULT_COACH_QUALITY = 5;

// ── content: need-weighted intake positions ──
/** Depth a squad wants at each position. An intake leans toward the gaps
 *  (first team + academy) instead of rolling all twelve positions uniformly —
 *  which handed a club with four keepers a fifth as often as its only ST cover. */
export const YOUTH_POSITION_TARGET_DEPTH: Record<Position, number> = {
  GK: 3, CB: 4, LB: 2, RB: 2, CDM: 2, CM: 3, CAM: 2, LM: 1, RM: 1, LW: 2, RW: 2, ST: 3,
};
/** Every position keeps this weight, so an intake is still a lottery. */
export const YOUTH_POSITION_BASE_WEIGHT = 1;
/** Extra weight per missing player below the target depth. */
export const YOUTH_POSITION_NEED_WEIGHT = 2;
