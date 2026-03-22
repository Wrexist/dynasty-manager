/**
 * Chemistry Configuration
 * Mentor/partnership thresholds, bonus formulas, labels.
 */

// ── Mentor Bond ──
export const MENTOR_SENIOR_AGE = 28;
export const MENTOR_JUNIOR_AGE = 22;
export const MENTOR_QUALITY_OVERALL_BASE = 65;
export const MENTOR_QUALITY_DIVISOR = 10;
export const MENTOR_MAX_STRENGTH = 3;

// ── Partnership Bond ──
export const PARTNERSHIP_FORM_THRESHOLD = 100;
export const PARTNERSHIP_STRENGTH_DIVISOR = 20;
export const PARTNERSHIP_MAX_STRENGTH = 3;

// ── Adjacent Position Pairs ──
// Defines which positions are close enough on the pitch to form chemistry links.
// Used by all link types (nationality, mentor, partnership).
export const ADJACENT_PAIRS: [string, string][] = [
  // Goalkeeper to centre-backs
  ['GK', 'CB'],
  // Defensive line
  ['CB', 'CB'], ['CB', 'LB'], ['CB', 'RB'], ['CB', 'CDM'],
  // Fullbacks to wide midfielders/wingers
  ['LB', 'LM'], ['LB', 'LW'], ['RB', 'RM'], ['RB', 'RW'],
  // Defensive midfield
  ['CDM', 'CDM'], ['CDM', 'CM'],
  // Central midfield
  ['CM', 'CM'], ['CM', 'CAM'], ['CM', 'LM'], ['CM', 'RM'],
  // Wide midfield to wingers
  ['LM', 'LW'], ['RM', 'RW'],
  // Attacking connections
  ['CAM', 'ST'], ['CAM', 'LW'], ['CAM', 'RW'],
  // Forward line
  ['ST', 'ST'], ['LW', 'ST'], ['RW', 'ST'],
];

// ── Club Loyalty Bond ──
/** Seasons at club required for loyalty chemistry link */
export const LOYALTY_SEASONS_THRESHOLD = 2;
export const LOYALTY_MAX_STRENGTH = 2;

// ── Chemistry Bonus ──
export const CHEMISTRY_BONUS_PER_STRENGTH = 0.008;
export const CHEMISTRY_BONUS_MAX = 0.12;

// ── Chemistry Labels ──
export const CHEMISTRY_EXCELLENT_THRESHOLD = 0.08;
export const CHEMISTRY_GOOD_THRESHOLD = 0.05;
export const CHEMISTRY_AVERAGE_THRESHOLD = 0.02;

// ── Mentor Growth Bonus ──
export const MENTOR_GROWTH_BONUS_PER_STRENGTH = 0.01;
export const MENTOR_GROWTH_MAX_AGE = 22;
