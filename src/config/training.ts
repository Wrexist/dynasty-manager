/**
 * Training Configuration
 * Intensity multipliers, fitness costs, injury risks, attribute gains.
 */

import type { TrainingModule, TrainingSchedule, PlayerAttributes, TrainingDrill } from '@/types/game';

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
/** Extra growth chance for attributes matching the player's dominant training focus (used by development.ts) */
export const TRAINING_FOCUS_BONUS = 0.08;
export const BASE_GAIN_CHANCE = 0.06;
export const INDIVIDUAL_TRAINING_BONUS = 1.5;
export const STAFF_BONUS_MULTIPLIER = 0.12;

// ── Independent Individual Training ──
/** Base gain chance for attributes trained ONLY via individual plan (not in team schedule) */
export const INDIVIDUAL_BASE_GAIN = 0.03;
/** Fitness cost applied to players who have an active individual training plan */
export const INDIVIDUAL_FITNESS_COST = -2;
/** Additional injury risk multiplier for players on individual plans */
export const INDIVIDUAL_INJURY_RISK_MODIFIER = 1.15;

// ── Fitness Recovery ──
export const FITNESS_RECOVERY_PER_DAY = 3;
export const FITNESS_RECOVERY_BASE = 10;
export const FITNESS_MIN = 30;

// ── Training Injury Age Scaling ──
export const TRAINING_INJURY_AGE_THRESHOLD = 28;
export const TRAINING_INJURY_AGE_FACTOR = 0.1;

// ── Training Presets ──
export const TRAINING_PRESETS: { id: string; label: string; schedule: TrainingSchedule }[] = [
  { id: 'balanced', label: 'Balanced', schedule: { mon: 'fitness', tue: 'attacking', wed: 'defending', thu: 'mentality', fri: 'tactical' } },
  { id: 'attack', label: 'Attack Focus', schedule: { mon: 'attacking', tue: 'attacking', wed: 'set-pieces', thu: 'mentality', fri: 'tactical' } },
  { id: 'defense', label: 'Defense Focus', schedule: { mon: 'defending', tue: 'defending', wed: 'fitness', thu: 'mentality', fri: 'tactical' } },
  { id: 'match-prep', label: 'Match Prep', schedule: { mon: 'tactical', tue: 'tactical', wed: 'set-pieces', thu: 'mentality', fri: 'fitness' } },
  { id: 'recovery', label: 'Recovery', schedule: { mon: 'fitness', tue: 'fitness', wed: 'fitness', thu: 'mentality', fri: 'fitness' } },
];

// ── Tactical Familiarity ──
export const TACTICAL_FAMILIARITY_GAIN_PER_DAY = 3;
export const TACTICAL_FAMILIARITY_DECAY = 1;
export const TACTICAL_FAMILIARITY_MAX = 100;
export const TACTICAL_FAMILIARITY_MIN = 0;

// ── Training Drills ──
export const TRAINING_DRILLS: TrainingDrill[] = [
  // Attacking
  { id: 'atk-finishing', moduleId: 'attacking', name: 'Finishing Practice', description: 'Clinical finishing in the box', attrWeights: { shooting: 0.8, pace: 0.2 } },
  { id: 'atk-counter', moduleId: 'attacking', name: 'Counter-Attack Runs', description: 'Speed and timing on the break', attrWeights: { pace: 0.8, shooting: 0.2 } },
  { id: 'atk-crossing', moduleId: 'attacking', name: 'Crossing & Headers', description: 'Delivery and aerial finishing', attrWeights: { shooting: 0.5, physical: 0.5 } },
  // Defending
  { id: 'def-1v1', moduleId: 'defending', name: '1v1 Defending', description: 'Jockeying and tackling technique', attrWeights: { defending: 0.9, physical: 0.1 } },
  { id: 'def-aerial', moduleId: 'defending', name: 'Aerial Duels', description: 'Heading and positioning from crosses', attrWeights: { defending: 0.5, physical: 0.5 } },
  { id: 'def-pressing', moduleId: 'defending', name: 'Pressing Drills', description: 'High press triggers and recovery runs', attrWeights: { defending: 0.5, pace: 0.5 } },
  // Fitness
  { id: 'fit-endurance', moduleId: 'fitness', name: 'Endurance Runs', description: 'Sustained stamina and recovery', attrWeights: { physical: 0.8, pace: 0.2 } },
  { id: 'fit-sprints', moduleId: 'fitness', name: 'Sprint Training', description: 'Explosive acceleration drills', attrWeights: { pace: 0.8, physical: 0.2 } },
  { id: 'fit-strength', moduleId: 'fitness', name: 'Strength & Core', description: 'Power and resilience', attrWeights: { physical: 0.9, defending: 0.1 } },
  // Mentality
  { id: 'men-vision', moduleId: 'mentality', name: 'Vision Drills', description: 'Passing lanes and awareness', attrWeights: { passing: 0.7, mental: 0.3 } },
  { id: 'men-composure', moduleId: 'mentality', name: 'Composure Under Pressure', description: 'Decisions in tight spaces', attrWeights: { mental: 0.8, passing: 0.2 } },
  { id: 'men-leadership', moduleId: 'mentality', name: 'Leadership Sessions', description: 'Communication and organization', attrWeights: { mental: 0.9, passing: 0.1 } },
  // Set Pieces
  { id: 'sp-freekicks', moduleId: 'set-pieces', name: 'Free Kick Practice', description: 'Dead-ball accuracy and technique', attrWeights: { shooting: 0.6, passing: 0.4 } },
  { id: 'sp-corners', moduleId: 'set-pieces', name: 'Corner Routines', description: 'Delivery and movement patterns', attrWeights: { passing: 0.7, shooting: 0.3 } },
  { id: 'sp-penalties', moduleId: 'set-pieces', name: 'Penalty Practice', description: 'Spot kick technique and composure', attrWeights: { shooting: 0.7, mental: 0.3 } },
  // Tactical
  { id: 'tac-shape', moduleId: 'tactical', name: 'Defensive Shape', description: 'Formation discipline and compactness', attrWeights: { mental: 0.7, defending: 0.3 } },
  { id: 'tac-transitions', moduleId: 'tactical', name: 'Transition Play', description: 'Quick switches between phases', attrWeights: { mental: 0.6, pace: 0.4 } },
  { id: 'tac-buildup', moduleId: 'tactical', name: 'Build-Up Play', description: 'Patient possession and passing patterns', attrWeights: { mental: 0.5, passing: 0.5 } },
];

export const DRILLS_BY_MODULE: Record<TrainingModule, TrainingDrill[]> = {
  attacking: TRAINING_DRILLS.filter(d => d.moduleId === 'attacking'),
  defending: TRAINING_DRILLS.filter(d => d.moduleId === 'defending'),
  fitness: TRAINING_DRILLS.filter(d => d.moduleId === 'fitness'),
  mentality: TRAINING_DRILLS.filter(d => d.moduleId === 'mentality'),
  'set-pieces': TRAINING_DRILLS.filter(d => d.moduleId === 'set-pieces'),
  tactical: TRAINING_DRILLS.filter(d => d.moduleId === 'tactical'),
};

// ── Streak System ──
export const STREAK_THRESHOLDS = [2, 4, 7] as const;
export const STREAK_MULTIPLIERS = [1.0, 1.15, 1.25, 1.4] as const;
export const STREAK_MAX = 10;

// ── Fitness Zones ──
export const FITNESS_ZONE_GREEN = 70;
export const FITNESS_ZONE_YELLOW = 50;
