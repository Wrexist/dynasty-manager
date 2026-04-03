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
export const PROFILE_ATTRIBUTE_VARIANCE = 10;

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

// ── Value & Wage Formulas (exponential curves calibrated to Transfermarkt 2024-25) ──
// Value curve: ~£137K at OVR 40  →  ~£130M at OVR 91
// Wage curve:  ~£1.1K/wk at OVR 40  →  ~£390K/wk at OVR 91
export const VALUE_EXP_BASE = 550;
export const VALUE_EXP_RATE = 0.136;
const VALUE_RANDOM_FACTOR = 0.15;
export const WAGE_EXP_BASE = 10;
export const WAGE_EXP_RATE = 0.116;
const WAGE_RANDOM_FACTOR = 0.10;
export const WAGE_FLOOR = 500;

/** Calculate realistic market value from overall rating using an exponential curve. */
export function calculatePlayerValue(overall: number): number {
  return Math.round(VALUE_EXP_BASE * Math.exp(VALUE_EXP_RATE * overall) * (1 + Math.random() * VALUE_RANDOM_FACTOR));
}

/** Calculate realistic weekly wage from overall rating using an exponential curve. */
export function calculatePlayerWage(overall: number): number {
  return Math.max(WAGE_FLOOR, Math.round(WAGE_EXP_BASE * Math.exp(WAGE_EXP_RATE * overall) * (1 + Math.random() * WAGE_RANDOM_FACTOR)));
}

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
export const EFFECTIVE_RATING_FORM_WEIGHT = 10;
export const EFFECTIVE_RATING_FITNESS_WEIGHT = 5;
export const MAX_SUBS = 7;

// ── Nationality Distribution by League ──
// Weights are relative — they don't need to sum to 100.
// Keyed by league ID string. DEFAULT is used as fallback for unknown leagues.
export const NATIONALITY_DISTRIBUTION: Record<string, { nationality: string; weight: number }[]> = {
  eng: [
    { nationality: 'England', weight: 35 },
    { nationality: 'Scotland', weight: 3 },
    { nationality: 'Wales', weight: 3 },
    { nationality: 'Ireland', weight: 4 },
    { nationality: 'France', weight: 8 },
    { nationality: 'Brazil', weight: 7 },
    { nationality: 'Portugal', weight: 5 },
    { nationality: 'Spain', weight: 4 },
    { nationality: 'Germany', weight: 3 },
    { nationality: 'Italy', weight: 2 },
    { nationality: 'Netherlands', weight: 3 },
    { nationality: 'Belgium', weight: 3 },
    { nationality: 'Argentina', weight: 3 },
    { nationality: 'Uruguay', weight: 2 },
    { nationality: 'Colombia', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Senegal', weight: 2 },
    { nationality: 'Morocco', weight: 2 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'Ivory Coast', weight: 1 },
    { nationality: 'Japan', weight: 1 },
    { nationality: 'South Korea', weight: 1 },
    { nationality: 'USA', weight: 1 },
    { nationality: 'Croatia', weight: 1 },
    { nationality: 'Denmark', weight: 1 },
    { nationality: 'Norway', weight: 1 },
  ],
  esp: [
    { nationality: 'Spain', weight: 45 },
    { nationality: 'Brazil', weight: 8 },
    { nationality: 'Argentina', weight: 6 },
    { nationality: 'France', weight: 5 },
    { nationality: 'Uruguay', weight: 4 },
    { nationality: 'Portugal', weight: 3 },
    { nationality: 'Colombia', weight: 3 },
    { nationality: 'Morocco', weight: 3 },
    { nationality: 'Mexico', weight: 2 },
    { nationality: 'Paraguay', weight: 2 },
    { nationality: 'Chile', weight: 2 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Germany', weight: 1 },
    { nationality: 'Nigeria', weight: 1 },
    { nationality: 'Senegal', weight: 1 },
    { nationality: 'Japan', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
  ],
  ita: [
    { nationality: 'Italy', weight: 45 },
    { nationality: 'Argentina', weight: 5 },
    { nationality: 'Brazil', weight: 5 },
    { nationality: 'France', weight: 4 },
    { nationality: 'Spain', weight: 3 },
    { nationality: 'Portugal', weight: 3 },
    { nationality: 'Croatia', weight: 3 },
    { nationality: 'Serbia', weight: 3 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Ivory Coast', weight: 2 },
    { nationality: 'Germany', weight: 2 },
    { nationality: 'Netherlands', weight: 2 },
    { nationality: 'Bosnia', weight: 2 },
    { nationality: 'Turkey', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'Belgium', weight: 1 },
    { nationality: 'Uruguay', weight: 1 },
  ],
  ger: [
    { nationality: 'Germany', weight: 50 },
    { nationality: 'Austria', weight: 5 },
    { nationality: 'France', weight: 4 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Turkey', weight: 3 },
    { nationality: 'Croatia', weight: 3 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'Netherlands', weight: 2 },
    { nationality: 'Denmark', weight: 2 },
    { nationality: 'Switzerland', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Japan', weight: 2 },
    { nationality: 'USA', weight: 2 },
    { nationality: 'South Korea', weight: 1 },
    { nationality: 'Belgium', weight: 1 },
    { nationality: 'Nigeria', weight: 1 },
    { nationality: 'Czech Republic', weight: 1 },
    { nationality: 'Poland', weight: 1 },
    { nationality: 'Bosnia', weight: 1 },
  ],
  fra: [
    { nationality: 'France', weight: 50 },
    { nationality: 'Senegal', weight: 5 },
    { nationality: 'Morocco', weight: 5 },
    { nationality: 'Cameroon', weight: 4 },
    { nationality: 'Ivory Coast', weight: 4 },
    { nationality: 'Brazil', weight: 4 },
    { nationality: 'Algeria', weight: 3 },
    { nationality: 'Mali', weight: 3 },
    { nationality: 'Portugal', weight: 3 },
    { nationality: 'Argentina', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Guinea', weight: 2 },
    { nationality: 'Belgium', weight: 2 },
    { nationality: 'Tunisia', weight: 2 },
    { nationality: 'Netherlands', weight: 1 },
    { nationality: 'Japan', weight: 1 },
    { nationality: 'Germany', weight: 1 },
  ],
  ned: [
    { nationality: 'Netherlands', weight: 50 },
    { nationality: 'Suriname', weight: 5 },
    { nationality: 'Belgium', weight: 4 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Denmark', weight: 3 },
    { nationality: 'Sweden', weight: 3 },
    { nationality: 'Norway', weight: 3 },
    { nationality: 'France', weight: 2 },
    { nationality: 'Morocco', weight: 2 },
    { nationality: 'Germany', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Japan', weight: 2 },
    { nationality: 'Mexico', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'USA', weight: 1 },
    { nationality: 'Greece', weight: 1 },
  ],
  por: [
    { nationality: 'Portugal', weight: 45 },
    { nationality: 'Brazil', weight: 15 },
    { nationality: 'Angola', weight: 4 },
    { nationality: 'Cape Verde', weight: 3 },
    { nationality: 'Mozambique', weight: 2 },
    { nationality: 'Argentina', weight: 3 },
    { nationality: 'Spain', weight: 3 },
    { nationality: 'France', weight: 2 },
    { nationality: 'Colombia', weight: 2 },
    { nationality: 'Uruguay', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Senegal', weight: 1 },
    { nationality: 'Guinea-Bissau', weight: 1 },
    { nationality: 'Serbia', weight: 1 },
    { nationality: 'Mali', weight: 1 },
  ],
  bel: [
    { nationality: 'Belgium', weight: 40 },
    { nationality: 'France', weight: 8 },
    { nationality: 'Senegal', weight: 4 },
    { nationality: 'DR Congo', weight: 4 },
    { nationality: 'Netherlands', weight: 4 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Morocco', weight: 3 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Japan', weight: 2 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Germany', weight: 2 },
    { nationality: 'Denmark', weight: 1 },
    { nationality: 'Ivory Coast', weight: 1 },
    { nationality: 'Portugal', weight: 1 },
  ],
  tur: [
    { nationality: 'Turkey', weight: 65 },
    { nationality: 'Brazil', weight: 5 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Senegal', weight: 3 },
    { nationality: 'France', weight: 3 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Argentina', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'Germany', weight: 2 },
    { nationality: 'Portugal', weight: 2 },
    { nationality: 'Czech Republic', weight: 1 },
    { nationality: 'Croatia', weight: 1 },
    { nationality: 'Bosnia', weight: 1 },
    { nationality: 'Iran', weight: 1 },
  ],
  cze: [
    { nationality: 'Czech Republic', weight: 70 },
    { nationality: 'Slovakia', weight: 8 },
    { nationality: 'Serbia', weight: 3 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Bosnia', weight: 2 },
    { nationality: 'Montenegro', weight: 1 },
    { nationality: 'Ukraine', weight: 1 },
    { nationality: 'Cameroon', weight: 1 },
  ],
  gre: [
    { nationality: 'Greece', weight: 60 },
    { nationality: 'Nigeria', weight: 4 },
    { nationality: 'Brazil', weight: 4 },
    { nationality: 'Serbia', weight: 3 },
    { nationality: 'Argentina', weight: 3 },
    { nationality: 'Portugal', weight: 2 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Senegal', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'France', weight: 1 },
    { nationality: 'Uruguay', weight: 1 },
  ],
  pol: [
    { nationality: 'Poland', weight: 70 },
    { nationality: 'Czech Republic', weight: 4 },
    { nationality: 'Ukraine', weight: 4 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'Slovakia', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Portugal', weight: 2 },
    { nationality: 'Nigeria', weight: 1 },
    { nationality: 'Iceland', weight: 1 },
  ],
  den: [
    { nationality: 'Denmark', weight: 60 },
    { nationality: 'Sweden', weight: 5 },
    { nationality: 'Norway', weight: 5 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Iceland', weight: 3 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'USA', weight: 2 },
    { nationality: 'Germany', weight: 2 },
    { nationality: 'Finland', weight: 2 },
    { nationality: 'Cameroon', weight: 1 },
    { nationality: 'Croatia', weight: 1 },
  ],
  nor: [
    { nationality: 'Norway', weight: 65 },
    { nationality: 'Sweden', weight: 5 },
    { nationality: 'Denmark', weight: 4 },
    { nationality: 'Iceland', weight: 3 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'Gambia', weight: 2 },
    { nationality: 'Senegal', weight: 2 },
    { nationality: 'Brazil', weight: 1 },
    { nationality: 'USA', weight: 1 },
    { nationality: 'Finland', weight: 1 },
  ],
  che: [
    { nationality: 'Switzerland', weight: 40 },
    { nationality: 'Germany', weight: 6 },
    { nationality: 'France', weight: 5 },
    { nationality: 'Italy', weight: 4 },
    { nationality: 'Brazil', weight: 4 },
    { nationality: 'Portugal', weight: 4 },
    { nationality: 'Austria', weight: 3 },
    { nationality: 'Serbia', weight: 3 },
    { nationality: 'Croatia', weight: 3 },
    { nationality: 'Kosovo', weight: 3 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Turkey', weight: 2 },
    { nationality: 'Albania', weight: 2 },
    { nationality: 'Nigeria', weight: 1 },
    { nationality: 'Spain', weight: 1 },
  ],
  aut: [
    { nationality: 'Austria', weight: 60 },
    { nationality: 'Germany', weight: 6 },
    { nationality: 'Serbia', weight: 4 },
    { nationality: 'Croatia', weight: 3 },
    { nationality: 'Bosnia', weight: 3 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Hungary', weight: 2 },
    { nationality: 'Turkey', weight: 2 },
    { nationality: 'Switzerland', weight: 1 },
    { nationality: 'France', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'Japan', weight: 1 },
  ],
  sco: [
    { nationality: 'Scotland', weight: 55 },
    { nationality: 'England', weight: 8 },
    { nationality: 'Ireland', weight: 5 },
    { nationality: 'Northern Ireland', weight: 3 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'USA', weight: 2 },
    { nationality: 'Australia', weight: 2 },
    { nationality: 'Japan', weight: 2 },
    { nationality: 'France', weight: 2 },
    { nationality: 'South Korea', weight: 1 },
    { nationality: 'Portugal', weight: 1 },
    { nationality: 'Brazil', weight: 1 },
    { nationality: 'Croatia', weight: 1 },
  ],
  swe: [
    { nationality: 'Sweden', weight: 60 },
    { nationality: 'Denmark', weight: 5 },
    { nationality: 'Norway', weight: 5 },
    { nationality: 'Finland', weight: 3 },
    { nationality: 'Iceland', weight: 2 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Gambia', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'Senegal', weight: 1 },
    { nationality: 'USA', weight: 1 },
  ],
  cro: [
    { nationality: 'Croatia', weight: 70 },
    { nationality: 'Bosnia', weight: 6 },
    { nationality: 'Serbia', weight: 4 },
    { nationality: 'Slovenia', weight: 3 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Montenegro', weight: 2 },
    { nationality: 'North Macedonia', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'Cameroon', weight: 1 },
  ],
  hun: [
    { nationality: 'Hungary', weight: 70 },
    { nationality: 'Serbia', weight: 4 },
    { nationality: 'Croatia', weight: 3 },
    { nationality: 'Romania', weight: 3 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Montenegro', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'Slovakia', weight: 1 },
  ],
  srb: [
    { nationality: 'Serbia', weight: 75 },
    { nationality: 'Bosnia', weight: 5 },
    { nationality: 'Montenegro', weight: 4 },
    { nationality: 'North Macedonia', weight: 2 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Ghana', weight: 1 },
    { nationality: 'Hungary', weight: 1 },
  ],
  rou: [
    { nationality: 'Romania', weight: 75 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Serbia', weight: 3 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Portugal', weight: 2 },
    { nationality: 'France', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Cameroon', weight: 1 },
    { nationality: 'Hungary', weight: 1 },
    { nationality: 'Greece', weight: 1 },
  ],
  ukr: [
    { nationality: 'Ukraine', weight: 75 },
    { nationality: 'Brazil', weight: 5 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'Georgia', weight: 2 },
    { nationality: 'Portugal', weight: 1 },
    { nationality: 'Argentina', weight: 1 },
    { nationality: 'Ghana', weight: 1 },
  ],
  bgr: [
    { nationality: 'Bulgaria', weight: 75 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'France', weight: 2 },
    { nationality: 'Portugal', weight: 2 },
    { nationality: 'Cameroon', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'Serbia', weight: 1 },
    { nationality: 'North Macedonia', weight: 1 },
    { nationality: 'Montenegro', weight: 1 },
  ],
  svk: [
    { nationality: 'Slovakia', weight: 70 },
    { nationality: 'Czech Republic', weight: 6 },
    { nationality: 'Hungary', weight: 3 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Ukraine', weight: 1 },
    { nationality: 'Spain', weight: 1 },
  ],
  fin: [
    { nationality: 'Finland', weight: 70 },
    { nationality: 'Sweden', weight: 4 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Denmark', weight: 3 },
    { nationality: 'Estonia', weight: 3 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'Cameroon', weight: 1 },
    { nationality: 'Norway', weight: 1 },
  ],
  isl: [
    { nationality: 'Iceland', weight: 80 },
    { nationality: 'Denmark', weight: 3 },
    { nationality: 'Norway', weight: 3 },
    { nationality: 'Sweden', weight: 3 },
    { nationality: 'England', weight: 2 },
    { nationality: 'Nigeria', weight: 1 },
    { nationality: 'Brazil', weight: 1 },
    { nationality: 'USA', weight: 1 },
  ],
  irl: [
    { nationality: 'Ireland', weight: 60 },
    { nationality: 'England', weight: 8 },
    { nationality: 'Northern Ireland', weight: 5 },
    { nationality: 'Scotland', weight: 3 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Brazil', weight: 2 },
    { nationality: 'France', weight: 2 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'USA', weight: 1 },
    { nationality: 'Poland', weight: 1 },
    { nationality: 'Spain', weight: 1 },
  ],
  isr: [
    { nationality: 'Israel', weight: 65 },
    { nationality: 'Argentina', weight: 5 },
    { nationality: 'Brazil', weight: 3 },
    { nationality: 'Nigeria', weight: 3 },
    { nationality: 'Ghana', weight: 2 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'France', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Croatia', weight: 1 },
    { nationality: 'USA', weight: 1 },
    { nationality: 'Cameroon', weight: 1 },
  ],
  cyp: [
    { nationality: 'Cyprus', weight: 60 },
    { nationality: 'Greece', weight: 8 },
    { nationality: 'Brazil', weight: 4 },
    { nationality: 'Serbia', weight: 3 },
    { nationality: 'Portugal', weight: 3 },
    { nationality: 'Nigeria', weight: 2 },
    { nationality: 'Spain', weight: 2 },
    { nationality: 'Croatia', weight: 2 },
    { nationality: 'Bulgaria', weight: 2 },
    { nationality: 'Argentina', weight: 1 },
    { nationality: 'Bosnia', weight: 1 },
    { nationality: 'France', weight: 1 },
  ],
  DEFAULT: [
    { nationality: 'Brazil', weight: 8 },
    { nationality: 'France', weight: 7 },
    { nationality: 'Argentina', weight: 6 },
    { nationality: 'Spain', weight: 6 },
    { nationality: 'Germany', weight: 6 },
    { nationality: 'England', weight: 5 },
    { nationality: 'Portugal', weight: 5 },
    { nationality: 'Netherlands', weight: 4 },
    { nationality: 'Italy', weight: 4 },
    { nationality: 'Nigeria', weight: 4 },
    { nationality: 'Belgium', weight: 3 },
    { nationality: 'Croatia', weight: 3 },
    { nationality: 'Uruguay', weight: 3 },
    { nationality: 'Colombia', weight: 3 },
    { nationality: 'Senegal', weight: 2 },
    { nationality: 'Morocco', weight: 2 },
    { nationality: 'Serbia', weight: 2 },
    { nationality: 'Japan', weight: 2 },
    { nationality: 'USA', weight: 2 },
    { nationality: 'Ghana', weight: 1 },
  ],
};

// ── Team Strength ──
export const MIN_TEAM_STRENGTH = 30;
export const TEAM_STRENGTH_BASE = 0.7;
export const TEAM_STRENGTH_FITNESS_SCALE = 0.2;
export const TEAM_STRENGTH_MORALE_SCALE = 0.1;
