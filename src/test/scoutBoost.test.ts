import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

describe('boostScoutReports', () => {
  function seedStore(reports: Array<{ id: string; playerId: string; knowledgeLevel: number; estimatedOverall: number; recommendation: string; week: number; season: number }>) {
    useGameStore.setState({
      ...useGameStore.getState(),
      scouting: {
        maxAssignments: 2,
        assignments: [],
        reports,
        discoveredPlayers: ['dp1'],
      },
    });
  }

  beforeEach(() => {
    seedStore([]);
  });

  it('boosts knowledge by 30 on all reports', () => {
    seedStore([
      { id: 'r1', playerId: 'p1', knowledgeLevel: 40, estimatedOverall: 70, recommendation: 'sign', week: 1, season: 1 },
      { id: 'r2', playerId: 'p2', knowledgeLevel: 50, estimatedOverall: 65, recommendation: 'watch', week: 2, season: 1 },
    ]);

    useGameStore.getState().boostScoutReports();
    const state = useGameStore.getState();

    expect(state.scouting.reports[0].knowledgeLevel).toBe(70);
    expect(state.scouting.reports[1].knowledgeLevel).toBe(80);
  });

  it('caps knowledge at 100', () => {
    seedStore([
      { id: 'r1', playerId: 'p1', knowledgeLevel: 85, estimatedOverall: 70, recommendation: 'sign', week: 1, season: 1 },
      { id: 'r2', playerId: 'p2', knowledgeLevel: 100, estimatedOverall: 60, recommendation: 'avoid', week: 2, season: 1 },
    ]);

    useGameStore.getState().boostScoutReports();
    const state = useGameStore.getState();

    expect(state.scouting.reports[0].knowledgeLevel).toBe(100);
    expect(state.scouting.reports[1].knowledgeLevel).toBe(100);
  });

  it('does nothing when reports array is empty', () => {
    seedStore([]);

    useGameStore.getState().boostScoutReports();
    const state = useGameStore.getState();

    expect(state.scouting.reports).toHaveLength(0);
  });

  it('preserves other scouting state (assignments, discoveredPlayers, maxAssignments)', () => {
    seedStore([
      { id: 'r1', playerId: 'p1', knowledgeLevel: 20, estimatedOverall: 70, recommendation: 'sign', week: 1, season: 1 },
    ]);

    // Add some assignments and discovered players to verify they survive
    useGameStore.setState({
      ...useGameStore.getState(),
      scouting: {
        ...useGameStore.getState().scouting,
        maxAssignments: 5,
        assignments: [{ id: 'a1', region: 'europe' as const, weeksRemaining: 3, totalWeeks: 6 }],
        discoveredPlayers: ['dp1', 'dp2'],
      },
    });

    useGameStore.getState().boostScoutReports();
    const state = useGameStore.getState();

    expect(state.scouting.maxAssignments).toBe(5);
    expect(state.scouting.assignments).toHaveLength(1);
    expect(state.scouting.discoveredPlayers).toEqual(['dp1', 'dp2']);
    expect(state.scouting.reports[0].knowledgeLevel).toBe(50);
  });
});
