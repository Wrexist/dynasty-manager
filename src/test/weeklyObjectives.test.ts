import { describe, it, expect } from 'vitest';
import { computeObjectiveProgress, ObjectiveInstance, ObjectiveContext } from '@/utils/weeklyObjectives';
import { Match, Player } from '@/types/game';

function makeCtx(overrides: Partial<ObjectiveContext> = {}): ObjectiveContext {
  return {
    playerClubId: 'club-1',
    players: {},
    playerIds: [],
    fixtures: [],
    leagueTable: [],
    week: 1,
    season: 1,
    lineup: [],
    ...overrides,
  };
}

function makeObj(id: string, completed = false): ObjectiveInstance {
  return { objectiveId: id, title: '', description: '', icon: '', xpReward: 10, completed };
}

describe('computeObjectiveProgress', () => {
  it('returns progress for score-2-plus', () => {
    const fixture: Match = {
      id: 'm1', week: 1, homeClubId: 'club-1', awayClubId: 'opp',
      played: true, homeGoals: 1, awayGoals: 0, events: [],
    };
    const ctx = makeCtx({ fixtures: [fixture], week: 1 });
    const result = computeObjectiveProgress([makeObj('score-2-plus')], ctx);
    expect(result[0].progress).toEqual({ current: 1, target: 2 });
  });

  it('skips completed objectives', () => {
    const result = computeObjectiveProgress([makeObj('score-2-plus', true)], makeCtx());
    expect(result[0].progress).toBeUndefined();
  });

  it('returns progress for full-fitness', () => {
    const players = {
      'p1': { id: 'p1', injured: false } as Player,
      'p2': { id: 'p2', injured: true } as Player,
      'p3': { id: 'p3', injured: false } as Player,
    };
    const ctx = makeCtx({ players, playerIds: ['p1', 'p2', 'p3'] });
    const result = computeObjectiveProgress([makeObj('full-fitness')], ctx);
    expect(result[0].progress).toEqual({ current: 2, target: 3 });
  });
});
