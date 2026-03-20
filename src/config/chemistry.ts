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
export const PARTNERSHIP_FORM_THRESHOLD = 130;
export const PARTNERSHIP_STRENGTH_DIVISOR = 20;
export const PARTNERSHIP_MAX_STRENGTH = 3;

// ── Adjacent Position Pairs ──
export const ADJACENT_PAIRS: [string, string][] = [
  ['CB', 'CB'], ['LB', 'LM'], ['RB', 'RM'], ['CM', 'CM'],
  ['CM', 'CAM'], ['CDM', 'CM'], ['LW', 'ST'], ['RW', 'ST'],
  ['CAM', 'ST'], ['LM', 'LW'], ['RM', 'RW'],
];

// ── Chemistry Bonus ──
export const CHEMISTRY_BONUS_PER_STRENGTH = 0.008;
export const CHEMISTRY_BONUS_MAX = 0.08;

// ── Chemistry Labels ──
export const CHEMISTRY_EXCELLENT_THRESHOLD = 0.06;
export const CHEMISTRY_GOOD_THRESHOLD = 0.04;
export const CHEMISTRY_AVERAGE_THRESHOLD = 0.02;

// ── Mentor Growth Bonus ──
export const MENTOR_GROWTH_BONUS_PER_STRENGTH = 0.01;
export const MENTOR_GROWTH_MAX_AGE = 22;
