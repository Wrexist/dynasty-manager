import { describe, it, expect } from 'vitest';
import type { Club, Match, Player, ScoutingState } from '@/types/game';
import { buildDossier } from '@/utils/oppositionDossier';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'Test', lastName: 'Player', age: 25, position: 'ST',
    nationality: 'ENG', clubId: 'opp', overall: 75, potential: 80,
    value: 10_000_000, wage: 50_000, contractYears: 3, fitness: 100, morale: 80,
    injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0,
    yellowCards: 0, redCards: 0, form: 5, rarity: 'gold', traits: [],
    ...overrides,
  } as unknown as Player;
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'opp', name: 'Opponent FC', shortName: 'OPP', color: '#000', secondaryColor: '#FFF',
    budget: 10_000_000, reputation: 3, fanBase: 50, wageBill: 500_000, formation: '4-4-2',
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    facilities: 5, youthRating: 5, boardPatience: 5,
    ...overrides,
  } as Club;
}

const scouting = (maxAssignments: number): ScoutingState => ({
  maxAssignments, assignments: [], reports: [], discoveredPlayers: [],
});

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'm', week: 1, homeClubId: 'opp', awayClubId: 'x', played: true,
    homeGoals: 0, awayGoals: 0, events: [],
    ...overrides,
  } as Match;
}

describe('buildDossier', () => {
  it('picks the top scorer as danger man (ties broken by rating)', () => {
    const players = [
      makePlayer({ id: 'a', lastName: 'Scorer', overall: 78, goals: 12, assists: 3 }),
      makePlayer({ id: 'b', lastName: 'Rated', overall: 88, goals: 4, assists: 1 }),
    ];
    const d = buildDossier({
      opponent: makeClub(), opponentPlayers: players, fixtures: [],
      clubPowerRankings: {}, scouting: scouting(1),
    });
    expect(d.dangerMan?.id).toBe('a');
    expect(d.dangerMan?.isTopScorer).toBe(true);
    expect(d.dangerMan?.goals).toBe(12);
  });

  it('falls back to highest-rated when nobody has scored', () => {
    const players = [
      makePlayer({ id: 'a', overall: 70, goals: 0 }),
      makePlayer({ id: 'b', overall: 84, goals: 0 }),
    ];
    const d = buildDossier({
      opponent: makeClub(), opponentPlayers: players, fixtures: [],
      clubPowerRankings: {}, scouting: scouting(1),
    });
    expect(d.dangerMan?.id).toBe('b');
    expect(d.dangerMan?.isTopScorer).toBe(false);
  });

  it('excludes injured players from danger-man selection when a fit option exists', () => {
    const players = [
      makePlayer({ id: 'inj', overall: 90, goals: 20, injured: true }),
      makePlayer({ id: 'fit', overall: 75, goals: 8, injured: false }),
    ];
    const d = buildDossier({
      opponent: makeClub(), opponentPlayers: players, fixtures: [],
      clubPowerRankings: {}, scouting: scouting(1),
    });
    expect(d.dangerMan?.id).toBe('fit');
  });

  it('derives last-5 form from fixtures in the opponent perspective, oldest-first', () => {
    const fixtures: Match[] = [
      makeMatch({ id: '1', week: 1, homeClubId: 'opp', awayClubId: 'x', homeGoals: 2, awayGoals: 0 }), // W
      makeMatch({ id: '2', week: 2, homeClubId: 'y', awayClubId: 'opp', homeGoals: 3, awayGoals: 1 }), // L (away)
      makeMatch({ id: '3', week: 3, homeClubId: 'opp', awayClubId: 'z', homeGoals: 1, awayGoals: 1 }), // D
      makeMatch({ id: '4', week: 4, homeClubId: 'opp', awayClubId: 'q', homeGoals: 0, awayGoals: 0, played: false }), // ignored
      makeMatch({ id: '5', week: 5, homeClubId: 'other', awayClubId: 'nope', homeGoals: 1, awayGoals: 0 }), // not opp
    ];
    const d = buildDossier({
      opponent: makeClub(), opponentPlayers: [makePlayer()], fixtures,
      clubPowerRankings: {}, scouting: scouting(1),
    });
    expect(d.form).toEqual(['W', 'L', 'D']);
  });

  it('scales strength/weakness bullet count by scouting dept (clamped 1–3)', () => {
    const players = [
      makePlayer({ id: 'gk', position: 'GK', overall: 60 }),
      makePlayer({ id: 'cb', position: 'CB', overall: 62 }),
      makePlayer({ id: 'cm', position: 'CM', overall: 70 }),
      makePlayer({ id: 'st', position: 'ST', overall: 85, goals: 10 }),
      makePlayer({ id: 'st2', position: 'ST', overall: 83, goals: 6 }),
    ];
    const one = buildDossier({
      opponent: makeClub(), opponentPlayers: players, fixtures: [],
      clubPowerRankings: {}, scouting: scouting(1),
    });
    const three = buildDossier({
      opponent: makeClub(), opponentPlayers: players, fixtures: [],
      clubPowerRankings: {}, scouting: scouting(5),
    });
    expect(one.scoutBulletCount).toBe(1);
    expect(three.scoutBulletCount).toBe(3);
    expect(one.strengths.length).toBeLessThanOrEqual(1);
    expect(three.strengths.length).toBeGreaterThanOrEqual(one.strengths.length);
  });

  it('returns a suggested approach sentence and identifies strongest/weakest lines', () => {
    const players = [
      makePlayer({ id: 'gk', position: 'GK', overall: 55 }),
      makePlayer({ id: 'cb', position: 'CB', overall: 57 }),
      makePlayer({ id: 'st', position: 'ST', overall: 85, goals: 10 }),
    ];
    const d = buildDossier({
      opponent: makeClub(), opponentPlayers: players, fixtures: [],
      clubPowerRankings: { opp: 5, me: 1 }, scouting: scouting(3), myClubId: 'me',
    });
    expect(d.strongestLine).toBe('attack');
    expect(d.weakestLine).toBe('defence');
    expect(typeof d.suggestedApproach).toBe('string');
    expect(d.suggestedApproach.length).toBeGreaterThan(0);
  });
});
