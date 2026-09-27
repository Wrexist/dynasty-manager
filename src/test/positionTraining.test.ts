import { describe, it, expect } from 'vitest';
import {
  canTrainPosition,
  getPositionTrainingEta,
  getTrainablePositions,
  getWeeklyPositionProgress,
  tickPositionTraining,
} from '@/utils/positionTraining';
import { POSITION_TRAINING_BASE_WEEKS, POSITION_TRAINING_MENTAL_PIVOT } from '@/config/training';
import { POSITION_COMPATIBILITY, type Player, type Position } from '@/types/game';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'Test', lastName: 'Player', position: 'LB', age: 27,
    injured: false,
    attributes: { pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, mental: POSITION_TRAINING_MENTAL_PIVOT },
    ...overrides,
  } as Player;
}

describe('getTrainablePositions', () => {
  it('offers only neighbouring positions the player does not already play', () => {
    expect(getTrainablePositions(makePlayer({ position: 'LB' }))).toEqual(['LM']);
    expect(getTrainablePositions(makePlayer({ position: 'ST', alternatePositions: ['CAM'] }))).toEqual(['LW', 'RW']);
  });

  it('offers nothing to a CB or GK (no neighbours in POSITION_COMPATIBILITY)', () => {
    expect(getTrainablePositions(makePlayer({ position: 'CB' }))).toEqual([]);
    expect(getTrainablePositions(makePlayer({ position: 'GK' }))).toEqual([]);
  });

  it('never offers a position outside POSITION_COMPATIBILITY', () => {
    for (const pos of Object.keys(POSITION_COMPATIBILITY) as Position[]) {
      for (const t of getTrainablePositions(makePlayer({ position: pos }))) {
        expect(POSITION_COMPATIBILITY[pos]).toContain(t);
      }
    }
    expect(canTrainPosition(makePlayer({ position: 'LB' }), 'ST')).toBe(false);
  });
});

describe('getWeeklyPositionProgress', () => {
  it('takes the base number of weeks for an average player', () => {
    expect(getWeeklyPositionProgress(makePlayer())).toBeCloseTo(100 / POSITION_TRAINING_BASE_WEEKS);
    expect(getPositionTrainingEta({ progress: 0 }, makePlayer())).toBe(POSITION_TRAINING_BASE_WEEKS);
  });

  it('is faster for young and sharp players, slower for veterans and the injured', () => {
    const base = getWeeklyPositionProgress(makePlayer());
    expect(getWeeklyPositionProgress(makePlayer({ age: 19 }))).toBeGreaterThan(base);
    expect(getWeeklyPositionProgress(makePlayer({ age: 34 }))).toBeLessThan(base);
    expect(getWeeklyPositionProgress(makePlayer({ attributes: { ...makePlayer().attributes, mental: 85 } }))).toBeGreaterThan(base);
    expect(getWeeklyPositionProgress(makePlayer({ injured: true }))).toBeLessThan(base);
  });
});

describe('tickPositionTraining', () => {
  it('advances progress and completes into alternatePositions', () => {
    const player = makePlayer();
    const eligible = new Set(['p1']);
    const mid = tickPositionTraining([{ playerId: 'p1', position: 'LM', progress: 0 }], { p1: player }, eligible);
    expect(mid.learned).toHaveLength(0);
    expect(mid.plans[0].progress).toBeCloseTo(100 / POSITION_TRAINING_BASE_WEEKS);

    const done = tickPositionTraining([{ playerId: 'p1', position: 'LM', progress: 95 }], { p1: player }, eligible);
    expect(done.plans).toHaveLength(0);
    expect(done.learned[0].position).toBe('LM');
    expect(done.learned[0].player.alternatePositions).toEqual(['LM']);
    expect(player.alternatePositions).toBeUndefined(); // input not mutated
  });

  it('drops plans for players who left the club or already know the position', () => {
    const plans = [
      { playerId: 'gone', position: 'LM' as Position, progress: 50 },
      { playerId: 'p1', position: 'LM' as Position, progress: 50 },
    ];
    const r = tickPositionTraining(plans, {
      gone: makePlayer({ id: 'gone' }),
      p1: makePlayer({ alternatePositions: ['LM'] }),
    }, new Set(['p1']));
    expect(r.plans).toEqual([]);
    expect(r.learned).toEqual([]);
  });

  it('tolerates a pre-v95 training state with no plans', () => {
    expect(tickPositionTraining(undefined, {}, new Set())).toEqual({ plans: [], learned: [] });
  });
});

describe('learned positions count as natural when picking players', () => {
  it('getPositionTrainingEta reflects the injury slowdown', () => {
    const healthy = getPositionTrainingEta({ progress: 0 }, makePlayer());
    const injured = getPositionTrainingEta({ progress: 0 }, makePlayer({ injured: true }));
    expect(injured).toBeGreaterThan(healthy);
  });

  it('autofill and sub scoring rank a learned alternate above a mere neighbour', async () => {
    const { scorePlayerForSlot } = await import('@/utils/autoFillLineup');
    const base = makePlayer({
      id: 'lb', position: 'LB', overall: 70, form: 60, fitness: 90, morale: 70,
    } as Partial<Player>);
    const learned = { ...base, id: 'lb2', alternatePositions: ['LM'] as Position[] };
    expect(scorePlayerForSlot(learned as Player, 'LM')).toBeGreaterThan(scorePlayerForSlot(base, 'LM'));
  });
});
