import { describe, it, expect } from 'vitest';
import { deriveRivals } from '@/utils/rivalries';
import type { Club, HeadToHeadRecord, Match } from '@/types/game';

function makeClub(id: string, divisionId = 'premier-league'): Club {
  return {
    id,
    name: id.replace(/-/g, ' '),
    shortName: id.slice(0, 3).toUpperCase(),
    color: '#ffffff',
    secondaryColor: '#000000',
    budget: 0,
    wageBill: 0,
    reputation: 50,
    facilities: 3,
    youthRating: 50,
    fanBase: 1000,
    boardPatience: 50,
    playerIds: [],
    formation: '4-4-2',
    lineup: [],
    subs: [],
    divisionId,
  };
}

function rec(partial: Partial<HeadToHeadRecord>): HeadToHeadRecord {
  return { wins: 0, draws: 0, losses: 0, lastResult: null, grudgeLevel: 0, ...partial };
}

function match(week: number, homeId: string, awayId: string, hg: number, ag: number, played = true): Match {
  return { id: `m-${week}-${homeId}`, week, homeClubId: homeId, awayClubId: awayId, played, homeGoals: hg, awayGoals: ag, events: [] };
}

const PLAYER = 'arsenal';

describe('deriveRivals', () => {
  it('returns empty when no derbies and no qualifying records', () => {
    const clubs = { [PLAYER]: makeClub(PLAYER) };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries: {}, fixtures: [], currentWeek: 1 });
    expect(result).toEqual([]);
  });

  it('returns empty when player club is missing', () => {
    const result = deriveRivals({ playerClubId: 'nobody', clubs: {}, rivalries: {}, fixtures: [], currentWeek: 1 });
    expect(result).toEqual([]);
  });

  it('includes a hardcoded derby opponent in the same division', () => {
    const clubs = {
      [PLAYER]: makeClub(PLAYER),
      'tottenham-hotspur': makeClub('tottenham-hotspur'),
    };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries: {}, fixtures: [], currentWeek: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].clubId).toBe('tottenham-hotspur');
    expect(result[0].derbyName).toBe('North London Derby');
    expect(result[0].derbyIntensity).toBe(3);
  });

  it('excludes a derby opponent that is in a different division', () => {
    const clubs = {
      [PLAYER]: makeClub(PLAYER, 'premier-league'),
      'tottenham-hotspur': makeClub('tottenham-hotspur', 'championship'),
    };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries: {}, fixtures: [], currentWeek: 1 });
    expect(result).toEqual([]);
  });

  it('includes a repeat opponent that meets the grudge threshold', () => {
    const clubs = { [PLAYER]: makeClub(PLAYER), 'chelsea': makeClub('chelsea') };
    const rivalries = { 'chelsea': rec({ wins: 1, losses: 2, grudgeLevel: 2 }) };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries, fixtures: [], currentWeek: 1 });
    expect(result.map(r => r.clubId)).toContain('chelsea');
  });

  it('includes a repeat opponent that meets the meetings threshold even with zero grudge', () => {
    const clubs = { [PLAYER]: makeClub(PLAYER), 'chelsea': makeClub('chelsea') };
    const rivalries = { 'chelsea': rec({ wins: 2, draws: 1, losses: 1, grudgeLevel: 0 }) };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries, fixtures: [], currentWeek: 1 });
    expect(result.map(r => r.clubId)).toContain('chelsea');
  });

  it('excludes a low-grudge opponent with too few meetings', () => {
    const clubs = { [PLAYER]: makeClub(PLAYER), 'chelsea': makeClub('chelsea') };
    const rivalries = { 'chelsea': rec({ wins: 1, losses: 1, grudgeLevel: 0 }) };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries, fixtures: [], currentWeek: 1 });
    expect(result).toEqual([]);
  });

  it('computes head-to-head streak from played fixtures', () => {
    const clubs = { [PLAYER]: makeClub(PLAYER), 'chelsea': makeClub('chelsea') };
    const rivalries = { 'chelsea': rec({ wins: 3, losses: 1, grudgeLevel: 1 }) };
    const fixtures = [
      match(2, PLAYER, 'chelsea', 0, 1),      // L
      match(10, 'chelsea', PLAYER, 0, 2),     // W (player away)
      match(20, PLAYER, 'chelsea', 3, 0),     // W
    ];
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries, fixtures, currentWeek: 21 });
    expect(result[0].streak).toEqual({ type: 'W', count: 2 });
  });

  it('finds the next upcoming meeting week and computes dominance', () => {
    const clubs = { [PLAYER]: makeClub(PLAYER), 'chelsea': makeClub('chelsea') };
    const rivalries = { 'chelsea': rec({ wins: 3, losses: 1, grudgeLevel: 1 }) };
    const fixtures = [
      match(5, PLAYER, 'chelsea', 2, 0),            // played
      match(25, 'chelsea', PLAYER, 0, 0, false),    // upcoming
    ];
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries, fixtures, currentWeek: 10 });
    expect(result[0].nextMeetingWeek).toBe(25);
    expect(result[0].dominance).toBeCloseTo(0.75); // 3 wins / (3 wins + 1 loss)
  });

  it('sorts by derby intensity, then grudge, then meetings', () => {
    const clubs = {
      [PLAYER]: makeClub(PLAYER),
      'tottenham-hotspur': makeClub('tottenham-hotspur'), // derby intensity 3
      'chelsea': makeClub('chelsea'),                     // no derby, high grudge
      'manchester-united': makeClub('manchester-united'), // no derby, lower grudge
    };
    const rivalries = {
      'chelsea': rec({ wins: 1, losses: 4, grudgeLevel: 4 }),
      'manchester-united': rec({ wins: 2, losses: 2, grudgeLevel: 1 }),
    };
    const result = deriveRivals({ playerClubId: PLAYER, clubs, rivalries, fixtures: [], currentWeek: 1 });
    expect(result.map(r => r.clubId)).toEqual(['tottenham-hotspur', 'chelsea', 'manchester-united']);
  });
});
