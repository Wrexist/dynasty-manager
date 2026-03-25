import { describe, it, expect } from 'vitest';
import { generateFixtures, buildLeagueTable, CLUBS_DATA, ALL_CLUBS, LEAGUES, getLeague } from '@/data/league';

describe('league', () => {
  describe('generateFixtures', () => {
    it('generates correct number of fixtures for even teams', () => {
      const clubs = ['a', 'b', 'c', 'd'];
      const fixtures = generateFixtures(clubs);
      // 4 teams: each plays 3 others home & away = 4*3 = 12 matches
      expect(fixtures.length).toBe(12);
    });

    it('every team plays every other team home and away', () => {
      const clubs = ['a', 'b', 'c', 'd'];
      const fixtures = generateFixtures(clubs);

      for (const home of clubs) {
        for (const away of clubs) {
          if (home === away) continue;
          const match = fixtures.find(f => f.homeClubId === home && f.awayClubId === away);
          expect(match, `${home} vs ${away} not found`).toBeDefined();
        }
      }
    });

    it('handles 2 teams', () => {
      const fixtures = generateFixtures(['a', 'b']);
      expect(fixtures.length).toBe(2);
    });

    it('handles odd number of teams', () => {
      const clubs = ['a', 'b', 'c'];
      const fixtures = generateFixtures(clubs);
      // 3 teams: each plays 2 others home & away = 3*2 = 6
      expect(fixtures.length).toBe(6);
    });

    it('returns empty for fewer than 2 teams', () => {
      expect(generateFixtures(['a']).length).toBe(0);
      expect(generateFixtures([]).length).toBe(0);
    });
  });

  describe('buildLeagueTable', () => {
    it('builds correct table from played matches', () => {
      const clubs = ['a', 'b', 'c'];
      const fixtures = [
        { id: '1', week: 1, homeClubId: 'a', awayClubId: 'b', played: true, homeGoals: 2, awayGoals: 1, events: [] },
        { id: '2', week: 2, homeClubId: 'b', awayClubId: 'c', played: true, homeGoals: 0, awayGoals: 0, events: [] },
        { id: '3', week: 3, homeClubId: 'a', awayClubId: 'c', played: true, homeGoals: 3, awayGoals: 0, events: [] },
      ];

      const table = buildLeagueTable(fixtures, clubs);

      // Team 'a': 2 wins, 6 pts, GD +4
      const teamA = table.find(t => t.clubId === 'a')!;
      expect(teamA.points).toBe(6);
      expect(teamA.won).toBe(2);
      expect(teamA.goalDifference).toBe(4);

      // Team 'b': 1 draw, 1 loss, 1 pt
      const teamB = table.find(t => t.clubId === 'b')!;
      expect(teamB.points).toBe(1);

      // Team 'c': 1 draw, 1 loss, 1 pt
      const teamC = table.find(t => t.clubId === 'c')!;
      expect(teamC.points).toBe(1);

      // Sorted by points descending
      expect(table[0].clubId).toBe('a');
    });

    it('skips unplayed matches', () => {
      const fixtures = [
        { id: '1', week: 1, homeClubId: 'a', awayClubId: 'b', played: false, homeGoals: 0, awayGoals: 0, events: [] },
      ];
      const table = buildLeagueTable(fixtures, ['a', 'b']);
      expect(table[0].played).toBe(0);
      expect(table[1].played).toBe(0);
    });

    it('keeps only last 5 form entries', () => {
      const fixtures = Array.from({ length: 7 }, (_, i) => ({
        id: `${i}`, week: i + 1, homeClubId: 'a', awayClubId: 'b',
        played: true, homeGoals: 1, awayGoals: 0, events: [],
      }));
      const table = buildLeagueTable(fixtures, ['a', 'b']);
      const teamA = table.find(t => t.clubId === 'a')!;
      expect(teamA.form.length).toBe(5);
    });
  });

  describe('LEAGUES', () => {
    it('has 30 leagues', () => {
      expect(LEAGUES.length).toBe(30);
    });

    it('all league ids are unique', () => {
      const ids = LEAGUES.map(l => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every league has required fields', () => {
      for (const league of LEAGUES) {
        expect(league.id).toBeTruthy();
        expect(league.name).toBeTruthy();
        expect(league.country).toBeTruthy();
        expect(league.teamCount).toBeGreaterThanOrEqual(8);
        expect(league.replacedSlots).toBeGreaterThanOrEqual(0);
        expect(league.replacedSlots).toBeLessThan(league.teamCount);
        expect([1, 2, 3, 4]).toContain(league.qualityTier);
      }
    });
  });

  describe('ALL_CLUBS / CLUBS_DATA', () => {
    it('ALL_CLUBS and CLUBS_DATA reference the same data', () => {
      expect(ALL_CLUBS).toBe(CLUBS_DATA);
    });

    it('all club ids are unique', () => {
      const ids = CLUBS_DATA.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every club belongs to a valid league', () => {
      const leagueIds = new Set(LEAGUES.map(l => l.id));
      for (const club of CLUBS_DATA) {
        expect(leagueIds.has(club.divisionId), `Club ${club.name} has invalid divisionId ${club.divisionId}`).toBe(true);
      }
    });

    it('each league has the correct number of clubs', () => {
      for (const league of LEAGUES) {
        const clubCount = CLUBS_DATA.filter(c => c.divisionId === league.id).length;
        expect(clubCount, `League ${league.name} (${league.id}) has ${clubCount} clubs, expected ${league.teamCount}`).toBe(league.teamCount);
      }
    });
  });

  describe('getLeague', () => {
    it('returns correct league by id', () => {
      const eng = getLeague('eng');
      expect(eng.name).toBe('Premier League');
      expect(eng.teamCount).toBe(20);
      expect(eng.country).toBe('England');
    });

    it('returns correct league for esp', () => {
      const esp = getLeague('esp');
      expect(esp.name).toBeTruthy();
      expect(esp.teamCount).toBeGreaterThanOrEqual(8);
    });
  });
});
