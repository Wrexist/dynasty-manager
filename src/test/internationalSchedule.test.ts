/**
 * international.ts tournament-cycle scheduling — the 3-year World Cup /
 * Continental / off-year rotation and the "next tournament" lookahead.
 * (resolveNationalityAliases is covered in nationalTeamPool.test.ts.)
 */
import { describe, it, expect } from 'vitest';
import {
  getTournamentForSeason,
  getUpcomingTournament,
  continentalTournamentName,
} from '@/utils/international';
import { TOTAL_WEEKS } from '@/config/gameBalance';

describe('getTournamentForSeason', () => {
  it('follows the 3-year World Cup → Continental → off cycle', () => {
    expect(getTournamentForSeason(1)).toBe('world-cup');
    expect(getTournamentForSeason(2)).toBe('continental');
    expect(getTournamentForSeason(3)).toBeNull();
    expect(getTournamentForSeason(4)).toBe('world-cup');
    expect(getTournamentForSeason(5)).toBe('continental');
    expect(getTournamentForSeason(6)).toBeNull();
  });

  it('returns null for non-positive seasons', () => {
    expect(getTournamentForSeason(0)).toBeNull();
    expect(getTournamentForSeason(-3)).toBeNull();
  });
});

describe('getUpcomingTournament', () => {
  it('counts down to this season’s tournament before the intl window', () => {
    const info = getUpcomingTournament(1, 10, null);
    expect(info?.type).toBe('world-cup');
    expect(info?.season).toBe(1);
    expect(info?.inProgress).toBe(false);
    expect(info?.weeksAway).toBe(47 - 10);
    expect(info?.name).toBe('World Cup 1');
  });

  it('reports inProgress once the intl window has started (week >= 47)', () => {
    const info = getUpcomingTournament(1, 48, null);
    expect(info?.type).toBe('world-cup');
    expect(info?.inProgress).toBe(true);
    expect(info?.weeksAway).toBe(0);
  });

  it('looks ahead past an off-year to the next tournament season', () => {
    // Season 3 is an off year → next is season 4 (World Cup).
    const info = getUpcomingTournament(3, 10, null);
    expect(info?.type).toBe('world-cup');
    expect(info?.season).toBe(4);
    expect(info?.inProgress).toBe(false);
    expect(info?.weeksAway).toBeGreaterThan(TOTAL_WEEKS - 10);
  });
});

describe('continentalTournamentName', () => {
  it('defaults to "Continental Cup" for missing/unknown nationality', () => {
    expect(continentalTournamentName(null)).toBe('Continental Cup');
    expect(continentalTournamentName(undefined)).toBe('Continental Cup');
    expect(continentalTournamentName('Atlantis')).toBe('Continental Cup');
  });
});
