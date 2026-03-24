import { describe, it, expect } from 'vitest';
import { getInjuryRisk, updateTacticalFamiliarity, getDominantTrainingFocus, getTrainingRecommendation } from '@/utils/training';
import {
  INTENSITY_INJURY_RISK,
  TRAINING_INJURY_AGE_THRESHOLD,
  TACTICAL_FAMILIARITY_GAIN_PER_DAY,
  TACTICAL_FAMILIARITY_DECAY,
  TACTICAL_FAMILIARITY_MAX,
  TACTICAL_FAMILIARITY_MIN,
  MODULE_ATTR_MAP,
  TRAINING_PRESETS,
} from '@/config/training';
import type { TrainingState, Player, TrainingModule } from '@/types/game';

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

  describe('getDominantTrainingFocus', () => {
    it('returns the most-scheduled module', () => {
      const schedule = { mon: 'attacking' as const, tue: 'attacking' as const, wed: 'attacking' as const, thu: 'fitness' as const, fri: 'defending' as const };
      expect(getDominantTrainingFocus(schedule)).toBe('attacking');
    });

    it('breaks ties by picking the first occurring module', () => {
      const schedule = { mon: 'defending' as const, tue: 'attacking' as const, wed: 'defending' as const, thu: 'attacking' as const, fri: 'fitness' as const };
      // defending and attacking both have 2 days, defending comes first
      expect(getDominantTrainingFocus(schedule)).toBe('defending');
    });

    it('works with all same module', () => {
      const schedule = { mon: 'tactical' as const, tue: 'tactical' as const, wed: 'tactical' as const, thu: 'tactical' as const, fri: 'tactical' as const };
      expect(getDominantTrainingFocus(schedule)).toBe('tactical');
    });

    it('works with all different modules', () => {
      const schedule = { mon: 'fitness' as const, tue: 'attacking' as const, wed: 'defending' as const, thu: 'mentality' as const, fri: 'tactical' as const };
      // All have count 1, first one wins
      expect(getDominantTrainingFocus(schedule)).toBe('fitness');
    });
  });

  describe('MODULE_ATTR_MAP', () => {
    const allModules: TrainingModule[] = ['fitness', 'attacking', 'defending', 'mentality', 'set-pieces', 'tactical'];
    const validAttrs = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];

    it('contains all 6 training modules', () => {
      for (const mod of allModules) {
        expect(MODULE_ATTR_MAP[mod]).toBeDefined();
        expect(MODULE_ATTR_MAP[mod].length).toBeGreaterThan(0);
      }
    });

    it('maps to valid PlayerAttributes keys', () => {
      for (const mod of allModules) {
        for (const attr of MODULE_ATTR_MAP[mod]) {
          expect(validAttrs).toContain(attr);
        }
      }
    });
  });

  describe('TRAINING_PRESETS', () => {
    const validModules: TrainingModule[] = ['fitness', 'attacking', 'defending', 'mentality', 'set-pieces', 'tactical'];

    it('has at least 3 presets', () => {
      expect(TRAINING_PRESETS.length).toBeGreaterThanOrEqual(3);
    });

    it('each preset has valid modules for all 5 days', () => {
      for (const preset of TRAINING_PRESETS) {
        expect(validModules).toContain(preset.schedule.mon);
        expect(validModules).toContain(preset.schedule.tue);
        expect(validModules).toContain(preset.schedule.wed);
        expect(validModules).toContain(preset.schedule.thu);
        expect(validModules).toContain(preset.schedule.fri);
      }
    });
  });

  describe('getTrainingRecommendation', () => {
    function makePlayer(attrs: Partial<Record<string, number>> = {}): Player {
      return {
        id: '1', firstName: 'Test', lastName: 'Player', age: 22, position: 'ST',
        overall: 70, potential: 80, fitness: 100, morale: 70, form: 50,
        nationality: 'English', clubId: 'c1', wage: 10000, value: 1000000,
        contractEnd: 3, goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        attributes: {
          pace: 12, shooting: 12, passing: 12, defending: 12, physical: 12, mental: 12,
          ...attrs,
        },
      } as Player;
    }

    it('returns null for empty squad', () => {
      expect(getTrainingRecommendation([])).toBeNull();
    });

    it('recommends module for weakest attribute', () => {
      const squad = [
        makePlayer({ defending: 5, physical: 5 }),
        makePlayer({ defending: 6, physical: 6 }),
      ];
      const rec = getTrainingRecommendation(squad);
      expect(rec).not.toBeNull();
      expect(rec!.module).toBe('defending');
    });

    it('recommends fitness when pace is weakest', () => {
      const squad = [makePlayer({ pace: 3 })];
      const rec = getTrainingRecommendation(squad);
      expect(rec!.module).toBe('fitness');
    });
  });
});
