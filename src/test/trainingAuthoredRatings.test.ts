/**
 * Regression: weekly training must not overwrite an authored `overall`.
 *
 * A stored `overall` is not always `calculateOverall(attributes, position)`.
 * Community-pack players carry authored ratings and, measured at game start,
 * 95% of club players sit ABOVE what the formula computes from their
 * attributes — mean +4. `store/helpers/development.ts` documents this at length
 * and applies development as a delta for exactly that reason.
 *
 * `applyWeeklyTraining` did not. It assigned the formula's absolute answer:
 *
 *     updated.overall = calculateOverall(updated.attributes, updated.position);
 *
 * Because training runs only on the PLAYER's squad (`weekAdvance.ts`), the
 * player was the only manager in the world paying for it: measured over one
 * `advanceWeek()` on a fresh save, the player's squad lost a mean 4.58 OVR with
 * 24 of 26 players down, while a rival AI club in the same division moved 0.00.
 * Team strength is a direct function of squad OVR, so this was a permanent
 * handicap applied in week one of every save — and the squad screen showed
 * every player getting *worse* after a training week.
 *
 * The same stored-vs-formula mismatch silently disabled the season growth cap
 * for those players: `teamGrowth` was measured against the stored rating, so it
 * was 0 (clamped) even when attributes improved, and `seasonGrowthTracker`
 * never accumulated.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyWeeklyTraining } from '@/utils/training';
import { calculateOverall } from '@/utils/playerGen';
import { seasonGrowthTracker } from '@/store/helpers/development';
import type { Player, TrainingState } from '@/types/game';

const TRAINING: TrainingState = {
  intensity: 'heavy',
  schedule: { mon: 'attacking', tue: 'attacking', wed: 'fitness', thu: 'attacking', fri: 'fitness' },
  individualPlans: [],
} as TrainingState;

/** A player whose stored rating sits ABOVE the formula's answer — the shape 95%
 *  of the real roster has. */
function authoredPlayer(id: string): Player {
  const attributes = { pace: 70, shooting: 70, passing: 70, defending: 40, physical: 70, mental: 70 };
  const formula = calculateOverall(attributes, 'ST');
  return {
    id, firstName: 'Authored', lastName: 'Player', age: 21, position: 'ST',
    // +8 above the formula, well inside the measured 0..+15 spread.
    overall: formula + 8, potential: 99,
    fitness: 100, morale: 70, form: 50,
    nationality: 'English', clubId: 'c1', wage: 10000, value: 1000000,
    contractEnd: 3, goals: 0, assists: 0, appearances: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
    yellowCards: 0, redCards: 0,
    attributes,
  } as Player;
}

describe('applyWeeklyTraining preserves an authored overall', () => {
  beforeEach(() => {
    for (const k of Object.keys(seasonGrowthTracker)) delete seasonGrowthTracker[k];
  });

  it('never drops a player below their stored rating on a training week', () => {
    // 200 independent players: training gains are probabilistic, so a single
    // draw could pass by luck. A regression drops EVERY one of them by ~8.
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const p = authoredPlayer(`p${i}`);
      const after = applyWeeklyTraining(p, TRAINING, 0, 0, 1);
      worst = Math.min(worst, after.overall - p.overall);
    }
    expect(worst).toBe(0);
  });

  it('reports growthDelta as the change, not the gap to the formula', () => {
    for (let i = 0; i < 100; i++) {
      const p = authoredPlayer(`g${i}`);
      const after = applyWeeklyTraining(p, TRAINING, 0, 0, 1);
      // The delta must equal what actually changed, and never be the ~-8
      // "correction" toward the formula that the bug reported.
      expect(after.growthDelta).toBe(after.overall - p.overall);
      expect(after.growthDelta).toBeGreaterThanOrEqual(0);
    }
  });

  it('still credits real attribute growth against the season cap', () => {
    // With a huge staff bonus every attribute gain lands, so the formula rating
    // rises and the tracker must see it despite the authored baseline.
    let credited = 0;
    for (let i = 0; i < 60; i++) {
      const p = authoredPlayer(`c${i}`);
      applyWeeklyTraining(p, TRAINING, 20, 0, 3);
      credited += seasonGrowthTracker[p.id] || 0;
    }
    expect(credited).toBeGreaterThan(0);
  });

  it('a player whose stored rating equals the formula is unaffected', () => {
    // The 5% case — this must keep behaving exactly as before.
    const attributes = { pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, mental: 60 };
    const p = { ...authoredPlayer('exact'), attributes, overall: calculateOverall(attributes, 'ST') } as Player;
    const after = applyWeeklyTraining(p, TRAINING, 0, 0, 1);
    expect(after.overall).toBe(calculateOverall(after.attributes, after.position));
  });
});
