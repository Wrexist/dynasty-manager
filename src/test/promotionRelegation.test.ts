import { describe, it, expect } from 'vitest';
import { determineZones, generateReplacementClub, applySeasonTurnover } from '@/utils/promotionRelegation';
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
    replacedSlots: 3,
    description: 'A test league',
    difficulty: 'Medium',
    colorClass: 'text-blue-400',
    prizeMoney: 1_000_000,
    averageWage: 50_000,
    qualityTier: 2,
    ...overrides,
  } as LeagueInfo;
}

describe('Season Turnover', () => {
  describe('determineZones', () => {
    it('should determine zones for eng (20 teams, 3 replaced)', () => {
      const eng = LEAGUES.find(l => l.id === 'eng')!;
      const table = makeTable(eng.teamCount);
      const zones = determineZones(table, eng);

      expect(zones.replaced).toHaveLength(eng.replacedSlots);
      expect(zones.safe).toHaveLength(eng.teamCount - eng.replacedSlots);
      // Bottom 3 clubs should be replaced
      expect(zones.replaced).toEqual([`club-${eng.teamCount - 2}`, `club-${eng.teamCount - 1}`, `club-${eng.teamCount}`]);
    });

    it('should determine zones for a league with 2 replaced slots', () => {
      const league = makeLeague({ replacedSlots: 2, teamCount: 18 });
      const table = makeTable(18);
      const zones = determineZones(table, league);

      expect(zones.replaced).toHaveLength(2);
      expect(zones.safe).toHaveLength(16);
      expect(zones.replaced).toEqual(['club-17', 'club-18']);
    });

    it('should handle a league with 0 replaced slots', () => {
      const league = makeLeague({ replacedSlots: 0, teamCount: 12 });
      const table = makeTable(12);
      const zones = determineZones(table, league);

      expect(zones.replaced).toHaveLength(0);
      expect(zones.safe).toHaveLength(12);
    });

    it('should place all clubs in exactly one zone', () => {
      const league = makeLeague({ replacedSlots: 3, teamCount: 20 });
      const table = makeTable(20);
      const zones = determineZones(table, league);
      const allIds = [...zones.safe, ...zones.replaced];
      expect(allIds).toHaveLength(20);
      expect(new Set(allIds).size).toBe(20);
    });

    it('works with every configured league', () => {
      for (const league of LEAGUES) {
        const table = makeTable(league.teamCount);
        const zones = determineZones(table, league);
        expect(zones.replaced).toHaveLength(league.replacedSlots);
        expect(zones.safe).toHaveLength(league.teamCount - league.replacedSlots);
        // No overlap
        const allIds = [...zones.safe, ...zones.replaced];
        expect(new Set(allIds).size).toBe(league.teamCount);
      }
    });
  });

  describe('generateReplacementClub', () => {
    it('generates a valid replacement club for eng', () => {
      const { clubData, clubId } = generateReplacementClub(2, 'eng');
      expect(clubId).toContain('replaced-eng-2-');
      expect(clubData.name).toBeTruthy();
      expect(clubData.shortName).toBeTruthy();
      expect(clubData.budget).toBeGreaterThan(0);
      expect(clubData.squadQuality).toBeGreaterThan(0);
      expect(clubData.divisionId).toBe('eng');
    });

    it('generates a valid replacement club for a non-pool league', () => {
      const { clubData, clubId } = generateReplacementClub(3, 'cyp');
      expect(clubId).toContain('replaced-cyp-3-');
      expect(clubData.name).toBeTruthy();
      expect(clubData.budget).toBeGreaterThan(0);
    });

    it('generates unique IDs for successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const { clubId } = generateReplacementClub(1, 'esp');
        expect(ids.has(clubId)).toBe(false);
        ids.add(clubId);
      }
    });
  });

  describe('applySeasonTurnover', () => {
    it('removes bottom clubs from the league', () => {
      const leagueId = 'eng';
      const league = LEAGUES.find(l => l.id === leagueId)!;
      const table = makeTable(league.teamCount);
      const leagueClubs = table.map(e => e.clubId);

      // Create minimal club records
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

      // Bottom 3 should be replaced
      expect(turnover.replacedClubs).toHaveLength(league.replacedSlots);
      expect(turnover.leagueId).toBe(leagueId);

      // Replaced clubs should be removed from the clubs record
      for (const replacedId of turnover.replacedClubs) {
        expect(updatedClubs[replacedId]).toBeUndefined();
      }

      // Updated league clubs should not contain replaced clubs
      expect(updatedLeagueClubs).toHaveLength(league.teamCount - league.replacedSlots);
      for (const replacedId of turnover.replacedClubs) {
        expect(updatedLeagueClubs).not.toContain(replacedId);
      }
    });

    it('handles unknown league gracefully', () => {
      const { turnover, updatedClubs, updatedLeagueClubs } = applySeasonTurnover(
        'nonexistent', ['a', 'b'], [], {}
      );
      expect(turnover.replacedClubs).toHaveLength(0);
      expect(updatedLeagueClubs).toEqual(['a', 'b']);
    });
  });
});
