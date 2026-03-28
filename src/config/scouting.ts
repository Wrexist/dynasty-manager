/**
 * Scouting Configuration
 * Region settings, knowledge formulas, recommendation thresholds.
 */

import type { ScoutRegion } from '@/types/game';

// ── Assignment Weeks per Region ──
export const REGION_WEEKS: Record<ScoutRegion, number> = {
  domestic: 2,
  europe: 3,
  'south-america': 4,
  africa: 4,
  asia: 5,
};

// ── Quality Ranges per Region ──
export const REGION_QUALITY_RANGE: Record<ScoutRegion, [number, number]> = {
  domestic: [55, 78],
  europe: [60, 85],
  'south-america': [50, 82],
  africa: [48, 80],
  asia: [45, 72],
};

// ── Age Ranges per Region ──
export const REGION_AGE_RANGE: Record<ScoutRegion, [number, number]> = {
  domestic: [18, 30],
  europe: [19, 32],
  'south-america': [17, 25],
  africa: [17, 26],
  asia: [18, 28],
};

// ── Players per Assignment ──
export const PLAYERS_PER_ASSIGNMENT_MIN = 1;
export const PLAYERS_PER_ASSIGNMENT_RANGE = 2;

// ── Knowledge Formula ──
export const KNOWLEDGE_BASE = 30;
export const KNOWLEDGE_PER_QUALITY = 7;
export const KNOWLEDGE_RANDOM_RANGE = 15;
export const KNOWLEDGE_MAX = 100;

// ── Noise by Knowledge Tier ──
export const HIGH_KNOWLEDGE_THRESHOLD = 80;
export const HIGH_KNOWLEDGE_NOISE_RANGE = 3; // -1 to +1
export const MEDIUM_KNOWLEDGE_THRESHOLD = 50;
export const MEDIUM_KNOWLEDGE_BUST_CHANCE = 0.1;
export const MEDIUM_KNOWLEDGE_BUST_RANGE = 5;
export const MEDIUM_KNOWLEDGE_NOISE_RANGE = 6; // -3 to +3
export const LOW_KNOWLEDGE_BUST_CHANCE = 0.2;
export const LOW_KNOWLEDGE_BUST_RANGE = 6;
export const LOW_KNOWLEDGE_NOISE_RANGE = 12; // -6 to +6

// ── Report Limits ──
export const MAX_SCOUT_REPORTS = 20;

// ── Recommendation Thresholds ──
export const SIGN_POTENTIAL_THRESHOLD = 75;
export const SIGN_OVERALL_THRESHOLD = 72;
export const MONITOR_POTENTIAL_THRESHOLD = 65;
