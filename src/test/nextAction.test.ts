import { describe, it, expect } from 'vitest';
import { getNextActions, type NextActionContext } from '@/utils/nextAction';
import type { Club, Match, Player } from '@/types/game';

// Fake icons — the helper only passes them through, never invokes them.
const icons = { Trophy: (() => null) as unknown as React.ElementType, Users: (() => null) as unknown as React.ElementType, AlertTriangle: (() => null) as unknown as React.ElementType };

function baseCtx(overrides: Partial<NextActionContext> = {}): NextActionContext {
  return {
    seasonOver: false,
    lineupIncomplete: false,
    nextMatch: null,
    opponent: null,
    expiringPlayers: [],
    week: 20,
    lateSeasonWeekThreshold: 30,
    icons,
    ...overrides,
  };
}

function player(id: string, overall: number, contractEnd = 2): Player {
  return {
    id, firstName: 'Test', lastName: id, age: 26, nationality: 'England',
    position: 'CM', clubId: 'c', wage: 10_000, value: 5_000_000, contractEnd,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70 },
    overall, potential: overall + 3,
    fitness: 100, morale: 70, form: 60,
    injured: false, injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
  };
}

describe('getNextActions', () => {
  it('returns an empty list when nothing is urgent', () => {
    expect(getNextActions(baseCtx())).toEqual([]);
  });

  it('season-over dominates everything else', () => {
    const ctx = baseCtx({
      seasonOver: true,
      lineupIncomplete: true, // would ordinarily fire
      expiringPlayers: [player('p', 80)],
      week: 40,
    });
    const actions = getNextActions(ctx);
    expect(actions[0].key).toBe('season-over');
  });

  it('match-day lineup beats no-match lineup', () => {
    const ctx = baseCtx({
      lineupIncomplete: true,
      nextMatch: { id: 'm', homeClubId: 'home', awayClubId: 'away', week: 20, season: 1, homeGoals: 0, awayGoals: 0, played: false, events: [], homeStats: {} as Match['homeStats'], awayStats: {} as Match['awayStats'] } as unknown as Match,
      opponent: { shortName: 'FC' } as Club,
    });
    const actions = getNextActions(ctx);
    expect(actions[0].key).toBe('lineup-match');
    // And the no-match-variant should not also fire
    expect(actions.find(a => a.key === 'lineup-no-match')).toBeUndefined();
  });

  it('surfaces contract urgency only in late season for OVR-70+ players', () => {
    const early = getNextActions(baseCtx({
      week: 10,
      expiringPlayers: [player('star', 85)],
    }));
    expect(early).toEqual([]);

    const late = getNextActions(baseCtx({
      week: 35,
      expiringPlayers: [player('star', 85)],
    }));
    expect(late[0]?.key).toBe('contract-urgent');
    expect(late[0]?.title).toContain('star');
  });

  it('orders multiple urgent items by descending priority', () => {
    const ctx = baseCtx({
      lineupIncomplete: true,
      nextMatch: null,
      week: 35,
      expiringPlayers: [player('star', 85)],
    });
    const actions = getNextActions(ctx);
    // lineup-no-match (80) should come before contract-urgent (60)
    expect(actions.map(a => a.key)).toEqual(['lineup-no-match', 'contract-urgent']);
  });

  it('ignores expiring role players (OVR < 70)', () => {
    const actions = getNextActions(baseCtx({
      week: 35,
      expiringPlayers: [player('filler', 65)],
    }));
    expect(actions).toEqual([]);
  });
});
