/**
 * Phase 7a — Fixture generation invariants for season rollover.
 *
 * Extends league.test.ts with the per-team balance, week-distribution, and
 * multi-league invariants the season rollover code relies on. Bugs here
 * surface as:
 *   - Some teams playing more home matches than others
 *   - Fixtures clustering into a handful of weeks (or escaping totalWeeks)
 *   - Cache returning stale standings after a new season
 *   - generateFriendlies missing the player or duplicating opponents poorly
 */

import { describe, it, expect } from 'vitest';

import {
  generateFixtures,
  generateDivisionFixtures,
  generateLeagueFixtures,
  generateAllDivisionFixtures,
  generateFriendlies,
  buildAllDivisionTables,
  buildLeagueTable,
  clearLeagueTableCache,
} from '@/data/league';

// ── Helpers ───────────────────────────────────────────────────────────

function makeClubIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `c${i + 1}`);
}

function homeAwayCounts(fixtures: ReturnType<typeof generateFixtures>, clubIds: string[]) {
  const counts: Record<string, { home: number; away: number }> = {};
  clubIds.forEach(id => { counts[id] = { home: 0, away: 0 }; });
  for (const f of fixtures) {
    if (counts[f.homeClubId]) counts[f.homeClubId].home++;
    if (counts[f.awayClubId]) counts[f.awayClubId].away++;
  }
  return counts;
}

// ── Per-team balance invariants ───────────────────────────────────────

describe('generateFixtures — per-team balance', () => {
  it('every team plays exactly (n-1) home and (n-1) away matches (even n)', () => {
    const clubs = makeClubIds(10);
    const fixtures = generateFixtures(clubs);
    const counts = homeAwayCounts(fixtures, clubs);
    for (const id of clubs) {
      expect(counts[id].home).toBe(clubs.length - 1);
      expect(counts[id].away).toBe(clubs.length - 1);
    }
  });

  it('every team plays (n-1) home and (n-1) away matches (odd n)', () => {
    // With odd n, the round-robin uses a bye placeholder. Each real team
    // should still play every other team once at home and once away.
    const clubs = makeClubIds(7);
    const fixtures = generateFixtures(clubs);
    const counts = homeAwayCounts(fixtures, clubs);
    for (const id of clubs) {
      expect(counts[id].home).toBe(clubs.length - 1);
      expect(counts[id].away).toBe(clubs.length - 1);
    }
  });

  it('produces no self-matches', () => {
    const clubs = makeClubIds(8);
    const fixtures = generateFixtures(clubs);
    expect(fixtures.every(f => f.homeClubId !== f.awayClubId)).toBe(true);
  });

  it('every fixture has a unique id', () => {
    const fixtures = generateFixtures(makeClubIds(8));
    const ids = fixtures.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every (home, away) pair appears at most once', () => {
    const fixtures = generateFixtures(makeClubIds(12));
    const seen = new Set<string>();
    for (const f of fixtures) {
      const key = `${f.homeClubId}:${f.awayClubId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Week distribution ─────────────────────────────────────────────────

describe('generateDivisionFixtures — week distribution', () => {
  it('spreads fixtures across the requested totalWeeks (no week beyond cap)', () => {
    const fixtures = generateDivisionFixtures(makeClubIds(20), 46);
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      expect(f.week).toBeGreaterThanOrEqual(1);
      expect(f.week).toBeLessThanOrEqual(46);
    }
  });

  it('no week has more than ceil(teamCount/2) matches', () => {
    const teamCount = 20;
    const fixtures = generateDivisionFixtures(makeClubIds(teamCount), 46);
    const perWeek: Record<number, number> = {};
    for (const f of fixtures) perWeek[f.week] = (perWeek[f.week] ?? 0) + 1;
    const maxPerWeek = Math.max(...Object.values(perWeek));
    // After spreading, each "matchday" still has up to teamCount/2 fixtures.
    expect(maxPerWeek).toBeLessThanOrEqual(Math.ceil(teamCount / 2));
  });

  it('returns the same fixture count as generateFixtures', () => {
    const ids = makeClubIds(14);
    expect(generateDivisionFixtures(ids, 46).length).toBe(generateFixtures(ids).length);
  });

  it('does not throw on small leagues with totalWeeks ≤ matchWeeks', () => {
    // 4 teams → 6 matchweeks; with totalWeeks=4 the spread loop is skipped.
    const fixtures = generateDivisionFixtures(makeClubIds(4), 4);
    expect(fixtures.length).toBe(12);
  });

  it('generateLeagueFixtures is the same function as generateDivisionFixtures', () => {
    expect(generateLeagueFixtures).toBe(generateDivisionFixtures);
  });
});

// ── Multi-league fixture generation ───────────────────────────────────

describe('generateAllDivisionFixtures', () => {
  it('returns fixtures for every supplied league', () => {
    const divisions = {
      'eng': makeClubIds(20),
      'eng-2': makeClubIds(24),
    };
    const result = generateAllDivisionFixtures(divisions);
    expect(Object.keys(result).sort()).toEqual(['eng', 'eng-2']);
    expect(result.eng.length).toBeGreaterThan(0);
    expect(result['eng-2'].length).toBeGreaterThan(0);
  });

  it('omits leagues with fewer than 2 clubs', () => {
    const divisions = {
      'tiny': ['only-club'],
      'real': makeClubIds(10),
    };
    const result = generateAllDivisionFixtures(divisions);
    expect(result.tiny).toBeUndefined();
    expect(result.real.length).toBe(90); // 10 teams → 10*9 = 90 matches
  });

  it('handles empty input', () => {
    expect(generateAllDivisionFixtures({})).toEqual({});
  });
});

// ── Friendlies ────────────────────────────────────────────────────────

describe('generateFriendlies', () => {
  it('generates exactly 3 friendlies for weeks 1-3', () => {
    const playerId = 'me';
    const friendlies = generateFriendlies(playerId, [playerId, ...makeClubIds(8)]);
    expect(friendlies).toHaveLength(3);
    expect(friendlies.map(f => f.week).sort()).toEqual([1, 2, 3]);
  });

  it('always includes the player\'s club in every fixture', () => {
    const playerId = 'me';
    const friendlies = generateFriendlies(playerId, [playerId, ...makeClubIds(5)]);
    for (const f of friendlies) {
      expect(f.homeClubId === playerId || f.awayClubId === playerId).toBe(true);
    }
  });

  it('alternates home/away starting at home', () => {
    const playerId = 'me';
    const friendlies = generateFriendlies(playerId, [playerId, ...makeClubIds(5)])
      .sort((a, b) => a.week - b.week);
    expect(friendlies[0].homeClubId).toBe(playerId); // home
    expect(friendlies[1].awayClubId).toBe(playerId); // away
    expect(friendlies[2].homeClubId).toBe(playerId); // home
  });

  it('handles the case where opponents pool < 3 by reusing opponents', () => {
    const playerId = 'me';
    // Only 1 opponent available — the helper still generates 3 fixtures
    // by cycling.
    const friendlies = generateFriendlies(playerId, [playerId, 'opponent']);
    expect(friendlies).toHaveLength(3);
    for (const f of friendlies) {
      const opponent = f.homeClubId === playerId ? f.awayClubId : f.homeClubId;
      expect(opponent).toBe('opponent');
    }
  });

  it('returns empty when no opponents are available', () => {
    const friendlies = generateFriendlies('me', ['me']);
    expect(friendlies).toEqual([]);
  });

  it('every friendly starts unplayed with goals at 0', () => {
    const friendlies = generateFriendlies('me', ['me', ...makeClubIds(5)]);
    for (const f of friendlies) {
      expect(f.played).toBe(false);
      expect(f.homeGoals).toBe(0);
      expect(f.awayGoals).toBe(0);
      expect(f.events).toEqual([]);
    }
  });
});

// ── buildAllDivisionTables ────────────────────────────────────────────

describe('buildAllDivisionTables', () => {
  it('returns a table for each league supplied', () => {
    const divisionClubs = {
      'eng': makeClubIds(4),
      'eng-2': makeClubIds(6),
    };
    const divisionFixtures = generateAllDivisionFixtures(divisionClubs);
    clearLeagueTableCache(); // Avoid carry-over from prior tests
    const tables = buildAllDivisionTables(divisionFixtures, divisionClubs);
    expect(Object.keys(tables).sort()).toEqual(['eng', 'eng-2']);
    expect(tables.eng.length).toBe(4);
    expect(tables['eng-2'].length).toBe(6);
  });

  it('every table starts with played=0 for unplayed fixtures', () => {
    const divisionClubs = { 'eng': makeClubIds(4) };
    const divisionFixtures = generateAllDivisionFixtures(divisionClubs);
    clearLeagueTableCache();
    const tables = buildAllDivisionTables(divisionFixtures, divisionClubs);
    for (const entry of tables.eng) {
      expect(entry.played).toBe(0);
      expect(entry.points).toBe(0);
    }
  });
});

// ── clearLeagueTableCache ──────────────────────────────────────────────

describe('clearLeagueTableCache', () => {
  it('does not throw and lets a fresh build succeed', () => {
    const ids = makeClubIds(3);
    clearLeagueTableCache();
    const fixtures = [
      { id: 'm1', week: 1, homeClubId: 'c1', awayClubId: 'c2', played: true, homeGoals: 2, awayGoals: 0, events: [] },
    ];
    const before = buildLeagueTable(fixtures, ids);
    clearLeagueTableCache();
    const after = buildLeagueTable(fixtures, ids);
    // Same input → same output even after a clear.
    expect(after.map(e => e.clubId)).toEqual(before.map(e => e.clubId));
  });
});
