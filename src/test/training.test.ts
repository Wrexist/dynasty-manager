import { describe, it, expect } from 'vitest';
import { getInjuryRisk, updateTacticalFamiliarity } from '@/utils/training';
import {
  INTENSITY_INJURY_RISK,
  TRAINING_INJURY_AGE_THRESHOLD,
  TACTICAL_FAMILIARITY_GAIN_PER_DAY,
  TACTICAL_FAMILIARITY_DECAY,
  TACTICAL_FAMILIARITY_MAX,
  TACTICAL_FAMILIARITY_MIN,
} from '@/config/training';
import type { TrainingState } from '@/types/game';

function makeTraining(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    intensity: 'medium',
    schedule: {
      mon: 'fitness',
      tue: 'attacking',
      wed: 'defending',
      thu: 'mentality',
      fri: 'fitness',
    },
    individualPlans: [],
    ...overrides,
  } as TrainingState;
}

describe('training', () => {
  describe('getInjuryRisk', () => {
    it('returns base risk for young players', () => {
      const training = makeTraining({ intensity: 'medium' });
      const risk = getInjuryRisk(training, 22);
      expect(risk).toBe(INTENSITY_INJURY_RISK.medium);
    });

    it('increases risk for older players', () => {
      const training = makeTraining({ intensity: 'medium' });
      const youngRisk = getInjuryRisk(training, 22);
      const oldRisk = getInjuryRisk(training, 33);
      expect(oldRisk).toBeGreaterThan(youngRisk);
    });

    it('scales with intensity', () => {
      const lightRisk = getInjuryRisk(makeTraining({ intensity: 'light' }), 25);
      const heavyRisk = getInjuryRisk(makeTraining({ intensity: 'heavy' }), 25);
      expect(heavyRisk).toBeGreaterThan(lightRisk);
    });

    it('returns base risk when no age provided', () => {
      const training = makeTraining({ intensity: 'heavy' });
      expect(getInjuryRisk(training)).toBe(INTENSITY_INJURY_RISK.heavy);
    });

    it('age factor only applies above threshold', () => {
      const training = makeTraining({ intensity: 'medium' });
      const atThreshold = getInjuryRisk(training, TRAINING_INJURY_AGE_THRESHOLD);
      const belowThreshold = getInjuryRisk(training, TRAINING_INJURY_AGE_THRESHOLD - 1);
      expect(atThreshold).toBe(belowThreshold);
    });
  });

  describe('updateTacticalFamiliarity', () => {
    it('increases familiarity with tactical training days', () => {
      const training = makeTraining({
        schedule: { mon: 'tactical', tue: 'tactical', wed: 'tactical', thu: 'fitness', fri: 'fitness' },
      });
      const result = updateTacticalFamiliarity(training, 50);
      const expected = 50 + 3 * TACTICAL_FAMILIARITY_GAIN_PER_DAY - TACTICAL_FAMILIARITY_DECAY;
      expect(result).toBe(expected);
    });

    it('decays when no tactical days', () => {
      const training = makeTraining({
        schedule: { mon: 'fitness', tue: 'attacking', wed: 'defending', thu: 'mentality', fri: 'fitness' },
      });
      const result = updateTacticalFamiliarity(training, 50);
      expect(result).toBe(50 - TACTICAL_FAMILIARITY_DECAY);
    });

    it('caps at maximum', () => {
      const training = makeTraining({
        schedule: { mon: 'tactical', tue: 'tactical', wed: 'tactical', thu: 'tactical', fri: 'tactical' },
      });
      const result = updateTacticalFamiliarity(training, 95);
      expect(result).toBeLessThanOrEqual(TACTICAL_FAMILIARITY_MAX);
    });

    it('does not go below minimum', () => {
      const training = makeTraining({
        schedule: { mon: 'fitness', tue: 'fitness', wed: 'fitness', thu: 'fitness', fri: 'fitness' },
      });
      const result = updateTacticalFamiliarity(training, 0);
      expect(result).toBeGreaterThanOrEqual(TACTICAL_FAMILIARITY_MIN);
    });
  });
});
