/**
 * Training Configuration
 * Intensity multipliers, fitness costs, injury risks, attribute gains.
 */

import type { TrainingModule, PlayerAttributes } from '@/types/game';

// ── Module → Attribute Mapping ──
export const MODULE_ATTR_MAP: Record<TrainingModule, (keyof PlayerAttributes)[]> = {
  fitness: ['physical', 'pace'],
  attacking: ['shooting', 'pace'],
  defending: ['defending', 'physical'],
  mentality: ['mental', 'passing'],
  'set-pieces': ['shooting', 'passing'],
  tactical: ['mental'],
};

// ── Intensity Effects ──
export const INTENSITY_MULTIPLIER = { light: 0.5, medium: 1, heavy: 1.5 } as const;
export const INTENSITY_FITNESS_COST = { light: 1, medium: -1, heavy: -5 } as const;
export const INTENSITY_INJURY_RISK = { light: 0.003, medium: 0.015, heavy: 0.04 } as const;

// ── Attribute Gain ──
export const BASE_GAIN_CHANCE = 0.06;
export const INDIVIDUAL_TRAINING_BONUS = 1.5;
export const STAFF_BONUS_MULTIPLIER = 0.05;

// ── Fitness Recovery ──
export const FITNESS_RECOVERY_PER_DAY = 2;
export const FITNESS_RECOVERY_BASE = 2;
export const FITNESS_MIN = 30;

// ── Training Injury Age Scaling ──
export const TRAINING_INJURY_AGE_THRESHOLD = 28;
export const TRAINING_INJURY_AGE_FACTOR = 0.1;

// ── Tactical Familiarity ──
export const TACTICAL_FAMILIARITY_GAIN_PER_DAY = 3;
export const TACTICAL_FAMILIARITY_DECAY = 1;
export const TACTICAL_FAMILIARITY_MAX = 100;
export const TACTICAL_FAMILIARITY_MIN = 0;
