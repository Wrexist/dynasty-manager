import { describe, it, expect } from 'vitest';
import { getRecentForm } from '@/utils/formGuide';
import { Match } from '@/types/game';

function makeMatch(week: number, homeId: string, awayId: string, hg: number, ag: number): Match {
  return { id: `m-${week}`, week, homeClubId: homeId, awayClubId: awayId, played: true, homeGoals: hg, awayGoals: ag, events: [] };
}

describe('getRecentForm', () => {
  const clubId = 'club-1';

  it('returns empty array when no played fixtures', () => {
    expect(getRecentForm(clubId, [])).toEqual([]);
  });

  it('returns correct W/D/L results', () => {
    const fixtures = [
      makeMatch(1, clubId, 'opp', 2, 0),  // W
      makeMatch(2, 'opp', clubId, 1, 1),   // D
      makeMatch(3, clubId, 'opp', 0, 1),   // L
    ];
    expect(getRecentForm(clubId, fixtures)).toEqual(['W', 'D', 'L']);
  });

  it('returns only last N results', () => {
    const fixtures = [
      makeMatch(1, clubId, 'opp', 2, 0),
      makeMatch(2, clubId, 'opp', 3, 1),
      makeMatch(3, 'opp', clubId, 1, 1),
      makeMatch(4, clubId, 'opp', 0, 2),
      makeMatch(5, clubId, 'opp', 1, 0),
      makeMatch(6, clubId, 'opp', 4, 0),
    ];
    expect(getRecentForm(clubId, fixtures, 5)).toEqual(['W', 'D', 'L', 'W', 'W']);
  });

  it('ignores unplayed fixtures', () => {
    const fixtures = [
      makeMatch(1, clubId, 'opp', 2, 0),
      { ...makeMatch(2, clubId, 'opp', 0, 0), played: false },
    ];
    expect(getRecentForm(clubId, fixtures)).toEqual(['W']);
  });
});
