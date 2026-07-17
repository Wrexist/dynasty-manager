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

// ── Academy Level (Intake Day progression arc) ──
// Academy grows from 1→5 as youth-academy graduates prove themselves (reach
// a first-team OVR/appearance milestone). Each level nudges intake quality.
export const ACADEMY_LEVEL_MIN = 1;
export const ACADEMY_LEVEL_MAX = 5;
// Graduate milestones needed to advance one academy level.
export const ACADEMY_PROGRESS_PER_LEVEL = 3;
// A graduate "proves the academy" once they cross either bar.
export const ACADEMY_GRADUATE_OVR_THRESHOLD = 80;
export const ACADEMY_GRADUATE_APPEARANCE_THRESHOLD = 50; // career appearances
// Per level ABOVE 1, added to intake base quality and potential at generation.
export const ACADEMY_LEVEL_QUALITY_BONUS = 2;
export const ACADEMY_LEVEL_POTENTIAL_BONUS = 2;

// ── Intake Day reveal (view helpers) ──
// Potential → star band (>= threshold[i] earns 5-i stars, floor of 1 star).
export const YOUTH_STAR_THRESHOLDS = [88, 80, 72, 64];
// One-line scout verdicts, banded by potential (best → rawest). One is picked
// deterministically per prospect so the reveal reads the same every time.
export const YOUTH_SCOUT_VERDICTS: Record<'elite' | 'high' | 'decent' | 'raw', string[]> = {
  elite: [
    'A generational talent — the whole academy is buzzing.',
    'Once-in-a-decade ability. Protect this one.',
  ],
  high: [
    'Serious first-team potential if handled right.',
    'The staff are convinced this one has a big future.',
  ],
  decent: [
    'A tidy prospect who could grow into a squad role.',
    'Promising raw materials — needs game time to bloom.',
  ],
  raw: [
    'Rough around the edges, but there is something to work with.',
    'A long-term project. Patience required.',
  ],
};
