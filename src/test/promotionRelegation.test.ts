import { describe, it, expect } from 'vitest';
import { determineZones, determineProRelZones, generateReplacementClub, applySeasonTurnover, simulatePlayoff } from '@/utils/promotionRelegation';
import { LEAGUES } from '@/data/league';
import type { LeagueTableEntry, LeagueInfo, Club } from '@/types/game';

function makeTable(count: number): LeagueTableEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    clubId: `club-${i + 1}`,
    played: 46,
    won: 20 - i,
    drawn: 10,
    lost: 16 + i,
    goalsFor: 50 - i,
    goalsAgainst: 30 + i,
    goalDifference: 20 - 2 * i,
    points: 70 - i * 3,
    form: [],
    cleanSheets: 0,
  }));
}

function makeLeague(overrides: Partial<LeagueInfo> = {}): LeagueInfo {
  return {
    id: 'test',
    name: 'Test League',
    shortName: 'TST',
    country: 'Testland',
    countryCode: 'TS',
    teamCount: 20,
    totalWeeks: 46,
    replacedSlots: 0,
    description: 'A test league',
    difficulty: 'Medium',
    colorClass: 'text-blue-400',
    prizeMoney: 1_000_000,
    averageWage: 50_000,
    qualityTier: 2,
    tier: 1,
    countryId: 'test',
    promotionSpots: 0,
    relegationSpots: 3,
    playoffSpots: 0,
    ...overrides,
  } as LeagueInfo;
}

describe('Season Turnover', () => {
  describe('determineProRelZones', () => {
    it('should determine promotion and relegation zones', () => {
      const league = makeLeague({ promotionSpots: 2, relegationSpots: 3, playoffSpots: 4, teamCount: 20 });
      const table = makeTable(20);
      const zones = determineProRelZones(table, league);

      expect(zones.promoted).toHaveLength(2);
      expect(zones.playoffCandidates).toHaveLength(4);
      expect(zones.relegated).toHaveLength(3);
      expect(zones.safe).toHaveLength(11); // 20 - 2 - 4 - 3
      expect(zones.promoted).toEqual(['club-1', 'club-2']);
      expect(zones.relegated).toEqual(['club-18', 'club-19', 'club-20']);
    });

    it('should handle top-tier league (no promotion)', () => {
      const league = makeLeague({ promotionSpots: 0, relegationSpots: 3, playoffSpots: 0 });
      const table = makeTable(20);
      const zones = determineProRelZones(table, league);

      expect(zones.promoted).toHaveLength(0);
      expect(zones.playoffCandidates).toHaveLength(0);
      expect(zones.relegated).toHaveLength(3);
      expect(zones.safe).toHaveLength(17);
    });

    it('should handle bottom-tier league (no relegation)', () => {
      const league = makeLeague({ promotionSpots: 3, relegationSpots: 0, playoffSpots: 4 });
      const table = makeTable(20);
      const zones = determineProRelZones(table, league);

      expect(zones.promoted).toHaveLength(3);
      expect(zones.playoffCandidates).toHaveLength(4);
      expect(zones.relegated).toHaveLength(0);
      expect(zones.safe).toHaveLength(13);
    });

    it('should place all clubs in exactly one zone', () => {
      const league = makeLeague({ promotionSpots: 2, relegationSpots: 3, playoffSpots: 4 });
      const table = makeTable(20);
      const zones = determineProRelZones(table, league);
      const allIds = [...zones.promoted, ...zones.playoffCandidates, ...zones.safe, ...zones.relegated];
      expect(allIds).toHaveLength(20);
      expect(new Set(allIds).size).toBe(20);
    });

    it('works with every configured league', () => {
      for (const league of LEAGUES) {
        const table = makeTable(league.teamCount);
        const zones = determineProRelZones(table, league);
        expect(zones.promoted).toHaveLength(league.promotionSpots);
        expect(zones.playoffCandidates).toHaveLength(league.playoffSpots);
        expect(zones.relegated).toHaveLength(league.relegationSpots);
        const total = zones.promoted.length + zones.playoffCandidates.length + zones.safe.length + zones.relegated.length;
        expect(total).toBe(league.teamCount);
      }
    });
  });

  describe('determineZones (backward compat)', () => {
    it('should determine zones for eng (20 teams, 3 relegated)', () => {
      const eng = LEAGUES.find(l => l.id === 'eng')!;
      const table = makeTable(eng.teamCount);
      const zones = determineZones(table, eng);

      expect(zones.replaced).toHaveLength(eng.relegationSpots);
      expect(zones.safe).toHaveLength(eng.teamCount - eng.relegationSpots);
    });
  });

  describe('simulatePlayoff', () => {
    it('returns null for empty candidates', () => {
      expect(simulatePlayoff([])).toBeNull();
    });

    it('returns the single candidate for single-entry', () => {
      expect(simulatePlayoff(['club-1'])).toBe('club-1');
    });

    it('returns a valid candidate from the list', () => {
      const candidates = ['club-3', 'club-4', 'club-5', 'club-6'];
      const winner = simulatePlayoff(candidates);
      expect(candidates).toContain(winner);
    });
  });

  describe('generateReplacementClub', () => {
    it('generates a valid replacement club for eng-4 (bottom tier)', () => {
      const { clubData, clubId } = generateReplacementClub(2, 'eng-4');
      expect(clubId).toContain('replaced-eng-4-2-');
      expect(clubData.name).toBeTruthy();
      expect(clubData.shortName).toBeTruthy();
      expect(clubData.budget).toBeGreaterThan(0);
      expect(clubData.squadQuality).toBeGreaterThan(0);
      expect(clubData.divisionId).toBe('eng-4');
    });

    it('generates unique IDs for successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const { clubId } = generateReplacementClub(1, 'esp-2');
        expect(ids.has(clubId)).toBe(false);
        ids.add(clubId);
      }
    });
  });

  describe('applySeasonTurnover (legacy)', () => {
    it('removes bottom clubs from the league', () => {
      const leagueId = 'eng';
      const league = LEAGUES.find(l => l.id === leagueId)!;
      const table = makeTable(league.teamCount);
      const leagueClubs = table.map(e => e.clubId);

      const clubs: Record<string, Club> = {};
      for (const clubId of leagueClubs) {
        clubs[clubId] = {
          id: clubId, name: clubId, shortName: clubId.slice(0, 3).toUpperCase(),
          color: '#fff', secondaryColor: '#000',
          budget: 10_000_000, wageBill: 100_000,
          reputation: 3, facilities: 5, youthRating: 5, fanBase: 30, boardPatience: 60,
          playerIds: [], formation: '4-3-3', lineup: [], subs: [],
          divisionId: leagueId,
        } as Club;
      }

      const { turnover, updatedClubs, updatedLeagueClubs } = applySeasonTurnover(
        leagueId, leagueClubs, table, clubs
      );

      expect(turnover.relegatedClubs).toHaveLength(league.relegationSpots);
      expect(turnover.leagueId).toBe(leagueId);

      for (const replacedId of turnover.relegatedClubs) {
        expect(updatedClubs[replacedId]).toBeUndefined();
      }

      expect(updatedLeagueClubs).toHaveLength(league.teamCount - league.relegationSpots);
    });

    it('handles unknown league gracefully', () => {
      const { turnover, updatedLeagueClubs } = applySeasonTurnover(
        'nonexistent', ['a', 'b'], [], {}
      );
      expect(turnover.relegatedClubs).toHaveLength(0);
      expect(updatedLeagueClubs).toEqual(['a', 'b']);
    });
  });
});
