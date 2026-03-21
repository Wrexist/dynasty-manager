/**
 * Player Generation Configuration
 * All constants used by src/utils/playerGen.ts
 */

import type { Position } from '@/types/game';

// ── Age Ranges ──
export const PLAYER_MIN_AGE = 17;
export const PLAYER_AGE_RANGE = 17; // 17 + random(0..16) = 17–33
export const YOUNG_AGE_THRESHOLD = 23;
export const YOUNG_POTENTIAL_GAP = 15;
export const OLD_POTENTIAL_GAP = 5;

// ── Attribute Generation ──
export const DEFAULT_ATTRIBUTE_VARIANCE = 15;
export const PROFILE_ATTRIBUTE_VARIANCE = 10;

// ── Position Attribute Offsets ──
// Each position profile defines offsets from base quality: [pace, shooting, passing, defending, physical, mental]
export const POSITION_OFFSETS: Record<string, { pace: number; shooting: number; passing: number; defending: number; physical: number; mental: number }> = {
  'GK':  { pace: -15, shooting: -30, passing: -10, defending:  5, physical:  0, mental:  5 },
  'CB':  { pace:  -5, shooting: -20, passing:  -5, defending: 10, physical:  5, mental:  0 },
  'LB':  { pace:   5, shooting: -15, passing:   0, defending:  5, physical:  0, mental: -5 },
  'RB':  { pace:   5, shooting: -15, passing:   0, defending:  5, physical:  0, mental: -5 },
  'CDM': { pace:  -5, shooting: -10, passing:   5, defending:  8, physical:  5, mental:  5 },
  'CM':  { pace:   0, shooting:   0, passing:  10, defending:  0, physical:  0, mental:  5 },
  'CAM': { pace:   0, shooting:   5, passing:  10, defending:-15, physical: -5, mental:  5 },
  'LM':  { pace:   8, shooting:   0, passing:   5, defending: -5, physical:  0, mental:  0 },
  'RM':  { pace:   8, shooting:   0, passing:   5, defending: -5, physical:  0, mental:  0 },
  'LW':  { pace:  10, shooting:   5, passing:   5, defending:-20, physical: -5, mental:  0 },
  'RW':  { pace:  10, shooting:   5, passing:   5, defending:-20, physical: -5, mental:  0 },
  'ST':  { pace:   5, shooting:  12, passing:  -5, defending:-20, physical:  5, mental:  0 },
} as const;

// ── Position Weights for Overall Calculation ──
// Order: [pace, shooting, passing, defending, physical, mental]
export const POSITION_WEIGHTS: Record<string, number[]> = {
  'GK':  [0.05, 0.05, 0.1, 0.3, 0.25, 0.25],
  'CB':  [0.1, 0.05, 0.1, 0.35, 0.25, 0.15],
  'LB':  [0.2, 0.05, 0.15, 0.25, 0.2, 0.15],
  'RB':  [0.2, 0.05, 0.15, 0.25, 0.2, 0.15],
  'CDM': [0.1, 0.05, 0.2, 0.25, 0.2, 0.2],
  'CM':  [0.1, 0.1, 0.25, 0.15, 0.15, 0.25],
  'CAM': [0.1, 0.2, 0.3, 0.05, 0.1, 0.25],
  'LM':  [0.25, 0.15, 0.2, 0.1, 0.15, 0.15],
  'RM':  [0.25, 0.15, 0.2, 0.1, 0.15, 0.15],
  'LW':  [0.25, 0.25, 0.2, 0.02, 0.08, 0.2],
  'RW':  [0.25, 0.25, 0.2, 0.02, 0.08, 0.2],
  'ST':  [0.15, 0.35, 0.1, 0.02, 0.2, 0.18],
} as const;

export const DEFAULT_POSITION_WEIGHTS = [1/6, 1/6, 1/6, 1/6, 1/6, 1/6];

// ── Value & Wage Formulas ──
export const VALUE_OVERALL_MULTIPLIER = 500;
export const VALUE_RANDOM_RANGE = 500000;
export const WAGE_DIVISOR = 520;

// ── Contract ──
export const CONTRACT_BASE_YEARS = 1;
export const CONTRACT_RANDOM_YEARS = 4; // 1 + random(0..3) = 1–4 extra years

// ── Starting Ranges ──
export const FITNESS_BASE = 75;
export const FITNESS_RANGE = 25;
export const MORALE_BASE = 55;
export const MORALE_RANGE = 35;
export const FORM_BASE = 45;
export const FORM_RANGE = 40;

// ── Squad Generation ──
export const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK',
  'CB', 'CB', 'CB', 'CB', 'CB',
  'LB', 'LB', 'RB', 'RB',
  'CDM', 'CM', 'CM', 'CM', 'CM', 'CM',
  'CAM',
  'LW', 'LW', 'RW', 'RW',
  'ST', 'ST', 'ST',
];

export const AGE_BUCKETS: { min: number; max: number; count: number }[] = [
  { min: 17, max: 21, count: 5 },
  { min: 22, max: 29, count: 14 },
  { min: 30, max: 34, count: 6 },
];

// ── Star/Veteran Generation ──
export const STAR_PLAYER_BOOST_MIN = 8;
export const STAR_PLAYER_BOOST_MAX = 12;
export const VETERAN_BOOST_MIN = 5;
export const VETERAN_BOOST_MAX = 8;

export const PEAK_AGE_BUCKET = { min: 22, max: 29 };
export const SQUAD_QUALITY_VARIANCE = 12;
export const SQUAD_QUALITY_MIN = 35;
export const SQUAD_QUALITY_MAX = 95;

/** Young player potential boost: +10 + random(0..14) */
export const YOUNG_POTENTIAL_BOOST_BASE = 10;
export const YOUNG_POTENTIAL_BOOST_RANGE = 15;
export const YOUNG_POTENTIAL_AGE_THRESHOLD = 21;

// ── Lineup Selection ──
export const EFFECTIVE_RATING_OVERALL_WEIGHT = 0.6;
export const EFFECTIVE_RATING_FORM_WEIGHT = 25;
export const EFFECTIVE_RATING_FITNESS_WEIGHT = 15;
export const MAX_SUBS = 7;

// ── Team Strength ──
export const MIN_TEAM_STRENGTH = 30;
export const TEAM_STRENGTH_BASE = 0.7;
export const TEAM_STRENGTH_FITNESS_SCALE = 0.2;
export const TEAM_STRENGTH_MORALE_SCALE = 0.1;
