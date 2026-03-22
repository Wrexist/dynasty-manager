import { describe, it, expect } from 'vitest';
import { checkCelebrations, getWinStreak } from '@/utils/celebrations';
import type { Player, Match, LeagueTableEntry } from '@/types/game';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe', age: 25, position: 'ST',
    nationality: 'England', overall: 75, potential: 80, value: 1000000, wage: 10000,
    clubId: 'club-a', contractEnd: 3, goals: 0, assists: 0, appearances: 0,
    fitness: 100, morale: 70, form: 50, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0, suspended: false, suspendedUntil: 0,
    attributes: { pace: 70, shooting: 75, passing: 65, defending: 40, physical: 70, mental: 60 },
    ...overrides,
  } as Player;
}

function makeMatch(week: number, homeId: string, awayId: string, homeGoals: number, awayGoals: number): Match {
  return {
    id: `m-${week}`, week, homeClubId: homeId, awayClubId: awayId,
    homeGoals, awayGoals, played: true, events: [],
  } as Match;
}

describe('celebrations', () => {
  it('should detect exact goal milestone (10 goals)', () => {
    const player = makePlayer({ goals: 10 });
    const result = checkCelebrations('club-a', { p1: player }, ['p1'], [], [], 1);
    expect(result.some(c => c.title.includes('10 Goals'))).toBe(true);
  });

  it('should detect goal milestone when player scores multiple goals past threshold (9 → 11)', () => {
    const player = makePlayer({ goals: 11 });
    const result = checkCelebrations('club-a', { p1: player }, ['p1'], [], [], 1);
    expect(result.some(c => c.title.includes('10 Goals'))).toBe(true);
  });

  it('should detect 10 goal milestone when at 14 (still in 10-14 range before next threshold 15)', () => {
    const player = makePlayer({ goals: 14 });
    const result = checkCelebrations('club-a', { p1: player }, ['p1'], [], [], 1);
    expect(result.some(c => c.title.includes('10 Goals'))).toBe(true);
  });

  it('should detect 15 goal milestone when at 15 (exact)', () => {
    const player = makePlayer({ goals: 15 });
    const result = checkCelebrations('club-a', { p1: player }, ['p1'], [], [], 1);
    expect(result.some(c => c.title.includes('15 Goals'))).toBe(true);
    expect(result.some(c => c.title.includes('10 Goals'))).toBe(false);
  });

  it('should detect assist milestone when crossing threshold', () => {
    const player = makePlayer({ assists: 11 });
    const result = checkCelebrations('club-a', { p1: player }, ['p1'], [], [], 1);
    expect(result.some(c => c.title.includes('10 Assists'))).toBe(true);
  });

  it('should detect win streak milestone', () => {
    const fixtures = [
      makeMatch(1, 'club-a', 'club-b', 2, 1),
      makeMatch(2, 'club-c', 'club-a', 0, 1),
      makeMatch(3, 'club-a', 'club-d', 3, 0),
    ];
    const result = checkCelebrations('club-a', {}, [], fixtures, [], 1);
    expect(result.some(c => c.title.includes('3 Wins in a Row'))).toBe(true);
  });

  it('should detect unbeaten run milestone', () => {
    const fixtures = Array.from({ length: 5 }, (_, i) =>
      makeMatch(i + 1, 'club-a', `club-${i}`, 1, i % 2 === 0 ? 0 : 1)
    );
    const result = checkCelebrations('club-a', {}, [], fixtures, [], 1);
    expect(result.some(c => c.title.includes('Unbeaten Run'))).toBe(true);
  });

  it('should return 999 for position when club not in table (not 0)', () => {
    const result = checkCelebrations('club-missing', {}, [], [], [], 1);
    // Should not crash and should not trigger "Top of the Table"
    expect(result.some(c => c.title.includes('Top of the Table'))).toBe(false);
  });

  it('should detect top of the table', () => {
    const table: LeagueTableEntry[] = [
      { clubId: 'club-a', played: 10, won: 8, drawn: 1, lost: 1, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, points: 25, form: [], cleanSheets: 0 },
      { clubId: 'club-b', played: 10, won: 7, drawn: 2, lost: 1, goalsFor: 18, goalsAgainst: 6, goalDifference: 12, points: 23, form: [], cleanSheets: 0 },
    ] as LeagueTableEntry[];
    const fixtures = Array.from({ length: 6 }, (_, i) =>
      makeMatch(i + 1, 'club-a', `club-${i}`, 2, 0)
    );
    const result = checkCelebrations('club-a', {}, [], fixtures, table, 1);
    expect(result.some(c => c.title.includes('Top of the Table'))).toBe(true);
  });
});

describe('getWinStreak', () => {
  it('should return 0 with no matches', () => {
    expect(getWinStreak('club-a', [])).toBe(0);
  });

  it('should count consecutive wins from most recent', () => {
    const fixtures = [
      makeMatch(1, 'club-a', 'club-b', 0, 1), // loss
      makeMatch(2, 'club-a', 'club-c', 2, 0), // win
      makeMatch(3, 'club-a', 'club-d', 3, 1), // win
    ];
    expect(getWinStreak('club-a', fixtures)).toBe(2);
  });

  it('should break on draw', () => {
    const fixtures = [
      makeMatch(1, 'club-a', 'club-b', 1, 1), // draw
      makeMatch(2, 'club-a', 'club-c', 2, 0), // win
    ];
    expect(getWinStreak('club-a', fixtures)).toBe(1);
  });
});
