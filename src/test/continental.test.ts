import { describe, it, expect } from 'vitest';
import { simulateContinentalMatch, isMatchdayComplete, isGroupStageComplete, getContinentalResultForClub, getKnockoutRoundName } from '@/utils/continental';
import type { ContinentalTournamentState, ContinentalGroup, ContinentalGroupMatch, ContinentalGroupStanding } from '@/types/game';

function makeGroup(id: string, clubIds: string[], allPlayed = false): ContinentalGroup {
  const matches: ContinentalGroupMatch[] = [];
  // Generate 6 matchdays of 2 matches each for 4 teams
  let matchNum = 0;
  for (let md = 1; md <= 6; md++) {
    for (let i = 0; i < 2; i++) {
      matches.push({
        id: `m${matchNum++}`,
        matchday: md,
        week: md * 4,
        homeClubId: clubIds[i * 2 % 4],
        awayClubId: clubIds[(i * 2 + 1) % 4],
        played: allPlayed,
        homeGoals: allPlayed ? 2 : 0,
        awayGoals: allPlayed ? 1 : 0,
      });
    }
  }

  const standings: ContinentalGroupStanding[] = clubIds.map(cid => ({
    clubId: cid, played: allPlayed ? 6 : 0, won: allPlayed ? 3 : 0, drawn: 0, lost: allPlayed ? 3 : 0,
    goalsFor: allPlayed ? 6 : 0, goalsAgainst: allPlayed ? 6 : 0, points: allPlayed ? 9 : 0,
  }));

  return { id, clubIds, matches, standings };
}

function makeTournament(overrides?: Partial<ContinentalTournamentState>): ContinentalTournamentState {
  return {
    competition: 'champions_cup',
    season: 1,
    groups: [
      makeGroup('A', ['c1', 'c2', 'c3', 'c4']),
      makeGroup('B', ['c5', 'c6', 'c7', 'c8']),
    ],
    knockoutTies: [],
    currentPhase: 'group',
    currentRound: 'group',
    playerEliminated: false,
    playerGroupId: 'A',
    winnerId: null,
    ...overrides,
  };
}

describe('continental', () => {
  describe('simulateContinentalMatch', () => {
    it('should return non-negative goals', () => {
      for (let i = 0; i < 50; i++) {
        const { homeGoals, awayGoals } = simulateContinentalMatch(3, 3);
        expect(homeGoals).toBeGreaterThanOrEqual(0);
        expect(awayGoals).toBeGreaterThanOrEqual(0);
      }
    });

    it('should produce reasonable scorelines', () => {
      let totalGoals = 0;
      const runs = 200;
      for (let i = 0; i < runs; i++) {
        const { homeGoals, awayGoals } = simulateContinentalMatch(4, 4);
        totalGoals += homeGoals + awayGoals;
      }
      const avg = totalGoals / runs;
      // Average total goals should be between 1 and 6
      expect(avg).toBeGreaterThan(1);
      expect(avg).toBeLessThan(6);
    });
  });

  describe('isMatchdayComplete', () => {
    it('should return false for unplayed matchday', () => {
      const t = makeTournament();
      expect(isMatchdayComplete(t, 1)).toBe(false);
    });

    it('should return true when all matches in matchday are played', () => {
      const t = makeTournament();
      // Mark all matchday 1 matches as played
      for (const group of t.groups) {
        group.matches = group.matches.map(m =>
          m.matchday === 1 ? { ...m, played: true, homeGoals: 1, awayGoals: 0 } : m
        );
      }
      expect(isMatchdayComplete(t, 1)).toBe(true);
      expect(isMatchdayComplete(t, 2)).toBe(false);
    });
  });

  describe('isGroupStageComplete', () => {
    it('should return false when matches remain', () => {
      const t = makeTournament();
      expect(isGroupStageComplete(t)).toBe(false);
    });

    it('should return true when all matches played', () => {
      const t = makeTournament({
        groups: [
          makeGroup('A', ['c1', 'c2', 'c3', 'c4'], true),
          makeGroup('B', ['c5', 'c6', 'c7', 'c8'], true),
        ],
      });
      expect(isGroupStageComplete(t)).toBe(true);
    });
  });

  describe('getContinentalResultForClub', () => {
    it('should return "Did not qualify" for null tournament', () => {
      expect(getContinentalResultForClub(null, 'c1')).toBe('Did not qualify');
    });

    it('should return "Winner" for winning club', () => {
      const t = makeTournament({ winnerId: 'c1' });
      expect(getContinentalResultForClub(t, 'c1')).toBe('Winner');
    });

    it('should return "Group Stage" for club in group stage', () => {
      const t = makeTournament();
      expect(getContinentalResultForClub(t, 'c1')).toBe('Group Stage');
    });

    it('should return "Did not qualify" for unknown club', () => {
      const t = makeTournament();
      expect(getContinentalResultForClub(t, 'unknown')).toBe('Did not qualify');
    });
  });

  describe('getKnockoutRoundName', () => {
    it('should return correct round names', () => {
      expect(getKnockoutRoundName('R16')).toBe('Round of 16');
      expect(getKnockoutRoundName('QF')).toBe('Quarter-Finals');
      expect(getKnockoutRoundName('SF')).toBe('Semi-Finals');
      expect(getKnockoutRoundName('F')).toBe('Final');
    });
  });
});
