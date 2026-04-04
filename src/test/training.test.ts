import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyWeeklyTraining,
  getInjuryRisk, updateTacticalFamiliarity, getDominantTrainingFocus, getTrainingRecommendation,
  getStreakMultiplier, updateStreaks, getStreakTier, generateTrainingReport, getSquadFitnessDistribution, getTrainingEffectivenessPreview,
} from '@/utils/training';
import {
  INTENSITY_INJURY_RISK,
  TRAINING_INJURY_AGE_THRESHOLD,
  TACTICAL_FAMILIARITY_GAIN_PER_DAY,
  TACTICAL_FAMILIARITY_DECAY,
  TACTICAL_FAMILIARITY_MAX,
  TACTICAL_FAMILIARITY_MIN,
  MODULE_ATTR_MAP,
  TRAINING_PRESETS,
  STREAK_THRESHOLDS,
  STREAK_MULTIPLIERS,
  TRAINING_DRILLS,
  DRILLS_BY_MODULE,
  INDIVIDUAL_FITNESS_COST,
} from '@/config/training';
import { seasonGrowthTracker } from '@/store/helpers/development';
import { MAX_SEASON_GROWTH } from '@/config/gameBalance';
import type { TrainingState, Player, TrainingModule, TrainingStreaks } from '@/types/game';

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

  describe('getStreakMultiplier', () => {
    it('returns base multiplier for no streak', () => {
      expect(getStreakMultiplier(undefined, 'attacking')).toBe(STREAK_MULTIPLIERS[0]);
      expect(getStreakMultiplier({}, 'attacking')).toBe(STREAK_MULTIPLIERS[0]);
    });

    it('returns base for streak below first threshold', () => {
      const streaks: TrainingStreaks = { attacking: 1 };
      expect(getStreakMultiplier(streaks, 'attacking')).toBe(STREAK_MULTIPLIERS[0]);
    });

    it('returns tier 1 bonus at first threshold', () => {
      const streaks: TrainingStreaks = { attacking: STREAK_THRESHOLDS[0] };
      expect(getStreakMultiplier(streaks, 'attacking')).toBe(STREAK_MULTIPLIERS[1]);
    });

    it('returns tier 2 bonus at second threshold', () => {
      const streaks: TrainingStreaks = { attacking: STREAK_THRESHOLDS[1] };
      expect(getStreakMultiplier(streaks, 'attacking')).toBe(STREAK_MULTIPLIERS[2]);
    });

    it('returns max bonus at highest threshold', () => {
      const streaks: TrainingStreaks = { attacking: STREAK_THRESHOLDS[2] };
      expect(getStreakMultiplier(streaks, 'attacking')).toBe(STREAK_MULTIPLIERS[3]);
    });

    it('returns base for different module than streak', () => {
      const streaks: TrainingStreaks = { attacking: 5 };
      expect(getStreakMultiplier(streaks, 'defending')).toBe(STREAK_MULTIPLIERS[0]);
    });
  });

  describe('updateStreaks', () => {
    it('increments streak for dominant module', () => {
      const schedule = { mon: 'attacking' as const, tue: 'attacking' as const, wed: 'attacking' as const, thu: 'fitness' as const, fri: 'defending' as const };
      const result = updateStreaks({ attacking: 3 }, schedule);
      expect(result.attacking).toBe(4);
    });

    it('resets other modules when dominant changes', () => {
      const schedule = { mon: 'defending' as const, tue: 'defending' as const, wed: 'defending' as const, thu: 'fitness' as const, fri: 'fitness' as const };
      const result = updateStreaks({ attacking: 5 }, schedule);
      expect(result.defending).toBe(1);
      expect(result.attacking).toBeUndefined();
    });

    it('starts at 1 for new dominant module', () => {
      const schedule = { mon: 'fitness' as const, tue: 'fitness' as const, wed: 'fitness' as const, thu: 'fitness' as const, fri: 'fitness' as const };
      const result = updateStreaks(undefined, schedule);
      expect(result.fitness).toBe(1);
    });
  });

  describe('getStreakTier', () => {
    it('returns tier 0 for no streak', () => {
      expect(getStreakTier(0).tier).toBe(0);
      expect(getStreakTier(1).tier).toBe(0);
    });

    it('returns tier 1 at first threshold', () => {
      expect(getStreakTier(STREAK_THRESHOLDS[0]).tier).toBe(1);
    });

    it('returns correct next threshold', () => {
      const result = getStreakTier(0);
      expect(result.nextThreshold).toBe(STREAK_THRESHOLDS[0]);
    });

    it('returns null next threshold at max tier', () => {
      const result = getStreakTier(STREAK_THRESHOLDS[2]);
      expect(result.nextThreshold).toBeNull();
    });
  });

  describe('getSquadFitnessDistribution', () => {
    function makePlayerWithFitness(fitness: number): Player {
      return {
        id: Math.random().toString(), firstName: 'T', lastName: 'P', age: 25, position: 'CM',
        overall: 70, potential: 80, fitness, morale: 70, form: 50,
        nationality: 'English', clubId: 'c1', wage: 10000, value: 1000000,
        contractEnd: 3, goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 },
      } as Player;
    }

    it('correctly categorizes fitness zones', () => {
      const squad = [
        makePlayerWithFitness(90),  // green
        makePlayerWithFitness(75),  // green
        makePlayerWithFitness(60),  // yellow
        makePlayerWithFitness(40),  // red
      ];
      const dist = getSquadFitnessDistribution(squad);
      expect(dist.green).toBe(2);
      expect(dist.yellow).toBe(1);
      expect(dist.red).toBe(1);
      expect(dist.total).toBe(4);
    });

    it('returns zero for empty squad', () => {
      const dist = getSquadFitnessDistribution([]);
      expect(dist.total).toBe(0);
      expect(dist.avgFitness).toBe(0);
    });

    it('calculates average fitness', () => {
      const squad = [makePlayerWithFitness(80), makePlayerWithFitness(60)];
      const dist = getSquadFitnessDistribution(squad);
      expect(dist.avgFitness).toBe(70);
    });
  });

  describe('generateTrainingReport', () => {
    function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
      return {
        id, firstName: 'T', lastName: `Player${id}`, age: 22, position: 'CM',
        overall: 70, potential: 80, fitness: 80, morale: 70, form: 50,
        nationality: 'English', clubId: 'c1', wage: 10000, value: 1000000,
        contractEnd: 3, goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 },
        ...overrides,
      } as Player;
    }

    it('counts total gains correctly', () => {
      const pre = { p1: makePlayer('p1'), p2: makePlayer('p2') };
      const post = {
        p1: makePlayer('p1', { lastTrainingGains: { shooting: 1 } }),
        p2: makePlayer('p2', { lastTrainingGains: { pace: 1, defending: 1 } }),
      };
      const report = generateTrainingReport(pre, post, ['p1', 'p2'], [], {}, 5, 1);
      expect(report.totalGains).toBe(3);
    });

    it('includes injuries', () => {
      const pre = { p1: makePlayer('p1') };
      const post = { p1: makePlayer('p1') };
      const report = generateTrainingReport(pre, post, ['p1'], ['Player1 (minor knock, 1wk)'], {}, 5, 1);
      expect(report.injuries.length).toBe(1);
    });

    it('limits star performers to 3', () => {
      const pre: Record<string, Player> = {};
      const post: Record<string, Player> = {};
      for (let i = 0; i < 5; i++) {
        pre[`p${i}`] = makePlayer(`p${i}`);
        post[`p${i}`] = makePlayer(`p${i}`, { lastTrainingGains: { shooting: 1 } });
      }
      const report = generateTrainingReport(pre, post, ['p0', 'p1', 'p2', 'p3', 'p4'], [], {}, 5, 1);
      expect(report.starPerformers.length).toBeLessThanOrEqual(3);
    });
  });

  describe('TRAINING_DRILLS', () => {
    const validModules: TrainingModule[] = ['fitness', 'attacking', 'defending', 'mentality', 'set-pieces', 'tactical'];

    it('has 3 drills per module', () => {
      for (const mod of validModules) {
        expect(DRILLS_BY_MODULE[mod].length).toBe(3);
      }
    });

    it('drill weights sum to approximately 1.0', () => {
      for (const drill of TRAINING_DRILLS) {
        const sum = Object.values(drill.attrWeights).reduce((s, w) => s + (w || 0), 0);
        expect(sum).toBeCloseTo(1.0, 1);
      }
    });

    it('each drill has unique id', () => {
      const ids = TRAINING_DRILLS.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('getTrainingEffectivenessPreview', () => {
    function makePlayer(attrs: Partial<Record<string, number>> = {}): Player {
      return {
        id: '1', firstName: 'Test', lastName: 'Player', age: 25, position: 'CM',
        overall: 70, potential: 80, fitness: 80, morale: 70, form: 50,
        nationality: 'English', clubId: 'c1', wage: 10000, value: 1000000,
        contractEnd: 3, goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50, ...attrs },
      } as Player;
    }

    it('returns preview with module gain rates', () => {
      const training = makeTraining();
      const preview = getTrainingEffectivenessPreview(training, 5, [makePlayer()]);
      expect(preview.moduleGainRates.length).toBeGreaterThan(0);
    });

    it('heavy intensity shows higher injury risk', () => {
      const heavy = getTrainingEffectivenessPreview(makeTraining({ intensity: 'heavy' }), 0, [makePlayer()]);
      const light = getTrainingEffectivenessPreview(makeTraining({ intensity: 'light' }), 0, [makePlayer()]);
      expect(heavy.injuryRiskPct).toBeGreaterThan(light.injuryRiskPct);
    });

    it('streak bonus reflects current streak', () => {
      const withStreak = makeTraining({ streaks: { fitness: 5 } });
      const noStreak = makeTraining();
      const previewStreak = getTrainingEffectivenessPreview(withStreak, 0, [makePlayer()]);
      const previewNone = getTrainingEffectivenessPreview(noStreak, 0, [makePlayer()]);
      expect(previewStreak.streakBonus).toBeGreaterThan(previewNone.streakBonus);
    });
  });

  describe('applyWeeklyTraining — individual plans', () => {
    function makeTestPlayer(id = 'p1', overrides: Partial<Player> = {}): Player {
      return {
        id, firstName: 'Test', lastName: 'Player', age: 22, position: 'CM',
        overall: 70, potential: 80, fitness: 80, morale: 70, form: 50,
        nationality: 'English', clubId: 'c1', wage: 10000, value: 1000000,
        contractEnd: 3, goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 },
        ...overrides,
      } as Player;
    }

    beforeEach(() => {
      // Reset season growth tracker
      Object.keys(seasonGrowthTracker).forEach(k => delete seasonGrowthTracker[k]);
    });

    it('grants independent gains for off-schedule individual plan attributes', () => {
      // Team trains fitness all week (physical, pace). Player has attacking plan (shooting, pace).
      // Shooting is NOT in team schedule, so it should get independent individual training.
      const training = makeTraining({
        schedule: { mon: 'fitness', tue: 'fitness', wed: 'fitness', thu: 'fitness', fri: 'fitness' },
        individualPlans: [{ playerId: 'p1', focus: 'attacking' }],
      });

      // Mock random to always succeed — shooting should gain from independent pass
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);
      const player = makeTestPlayer('p1');
      const result = applyWeeklyTraining(player, training, 0);
      mockRandom.mockRestore();

      expect(result.attributes.shooting).toBeGreaterThan(50);
    });

    it('does not grant independent gains for attributes already in team schedule', () => {
      // Team trains fitness (physical, pace). Player has attacking plan (shooting, pace).
      // Pace IS in team schedule, so independent pass should skip it (handled by team training with 1.5x bonus).
      const training = makeTraining({
        schedule: { mon: 'fitness', tue: 'fitness', wed: 'fitness', thu: 'fitness', fri: 'fitness' },
        individualPlans: [{ playerId: 'p1', focus: 'attacking' }],
      });

      // Mock Math.random to always return 0 (guarantees gains)
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);
      const player = makeTestPlayer('p1');
      const result = applyWeeklyTraining(player, training, 0);

      // Pace should gain from team training (with 1.5x individual bonus), not from independent pass.
      // Shooting should gain from independent pass.
      // Both should be > 50 since random always returns 0.
      expect(result.attributes.pace).toBeGreaterThan(50);
      expect(result.attributes.shooting).toBeGreaterThan(50);

      mockRandom.mockRestore();
    });

    it('applies fitness penalty for players with individual plans', () => {
      // Use attacking schedule (no fitness days) to avoid hitting the 100 fitness cap
      const training = makeTraining({
        schedule: { mon: 'attacking', tue: 'attacking', wed: 'attacking', thu: 'attacking', fri: 'attacking' },
      });
      const trainingWithPlan = makeTraining({
        schedule: { mon: 'attacking', tue: 'attacking', wed: 'attacking', thu: 'attacking', fri: 'attacking' },
        individualPlans: [{ playerId: 'p1', focus: 'defending' }],
      });

      // Use high random to prevent attribute gains from affecting the comparison
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const playerNoPlan = applyWeeklyTraining(makeTestPlayer('p1'), training, 0);
      const playerWithPlan = applyWeeklyTraining(makeTestPlayer('p1'), trainingWithPlan, 0);
      mockRandom.mockRestore();

      expect(playerWithPlan.fitness).toBe(playerNoPlan.fitness + INDIVIDUAL_FITNESS_COST);
    });

    it('respects season growth cap for independent individual gains', () => {
      const training = makeTraining({
        schedule: { mon: 'fitness', tue: 'fitness', wed: 'fitness', thu: 'fitness', fri: 'fitness' },
        individualPlans: [{ playerId: 'p1', focus: 'attacking' }],
      });

      // Set growth tracker to max
      seasonGrowthTracker['p1'] = 12;

      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);
      const player = makeTestPlayer('p1');
      const result = applyWeeklyTraining(player, training, 0);
      mockRandom.mockRestore();

      // Shooting should NOT gain because season growth cap is reached
      expect(result.attributes.shooting).toBe(50);
    });

    it('does not exceed season growth cap when both passes gain in same call', () => {
      // Player near cap — both team and independent training try to add gains
      seasonGrowthTracker['p1'] = MAX_SEASON_GROWTH - 1;
      const training = makeTraining({
        schedule: { mon: 'fitness', tue: 'fitness', wed: 'fitness', thu: 'fitness', fri: 'fitness' },
        individualPlans: [{ playerId: 'p1', focus: 'attacking' }],
      });

      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);
      const player = makeTestPlayer('p1');
      applyWeeklyTraining(player, training, 0);
      mockRandom.mockRestore();

      expect(seasonGrowthTracker['p1']).toBeLessThanOrEqual(MAX_SEASON_GROWTH);
    });

    it('tactical module maps to mental and defending', () => {
      expect(MODULE_ATTR_MAP['tactical']).toContain('mental');
      expect(MODULE_ATTR_MAP['tactical']).toContain('defending');
      expect(MODULE_ATTR_MAP['tactical'].length).toBe(2);
    });

    it('tactical individual plan grants independent defending gains when mental is on-schedule', () => {
      // Team trains mentality all week (mental, passing). Player has tactical plan (mental, defending).
      // Mental is on-schedule → gets 1.5x bonus there. Defending is NOT → gets independent pass.
      const training = makeTraining({
        schedule: { mon: 'mentality', tue: 'mentality', wed: 'mentality', thu: 'mentality', fri: 'mentality' },
        individualPlans: [{ playerId: 'p1', focus: 'tactical' }],
      });

      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);
      const player = makeTestPlayer('p1');
      const result = applyWeeklyTraining(player, training, 0);
      mockRandom.mockRestore();

      // Defending should gain from independent pass
      expect(result.attributes.defending).toBeGreaterThan(50);
    });
  });
});
