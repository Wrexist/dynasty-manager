import { describe, it, expect } from 'vitest';
import { getWeeklyIncome, getNetWeeklyIncome, getFinanceBreakdown } from '@/utils/financeHelpers';
import { MATCHDAY_INCOME_PER_FAN, COMMERCIAL_INCOME_PER_REP, COMMERCIAL_INCOME_BASE, POSITION_PRIZE_PER_RANK } from '@/config/gameBalance';
import type { Club, LeagueTableEntry, FacilitiesState, ManagerProgression } from '@/types/game';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'test-club',
    name: 'Test FC',
    shortName: 'TST',
    color: '#000',
    secondaryColor: '#FFF',
    budget: 50_000_000,
    reputation: 3,
    fanBase: 50,
    wageBill: 500_000,
    formation: '4-3-3',
    playerIds: [],
    lineup: [],
    subs: [],
    divisionId: 'eng',
    facilities: 5,
    youthRating: 5,
    boardPatience: 5,
    ...overrides,
  } as Club;
}

describe('financeHelpers', () => {
  describe('getWeeklyIncome', () => {
    it('calculates income from fanBase, reputation, and base income', () => {
      const club = makeClub({ fanBase: 80, reputation: 5 });
      const expected = 80 * MATCHDAY_INCOME_PER_FAN + COMMERCIAL_INCOME_BASE + 5 * COMMERCIAL_INCOME_PER_REP;
      expect(getWeeklyIncome(club)).toBe(expected);
    });

    it('returns base income when fanBase and reputation are 0', () => {
      const club = makeClub({ fanBase: 0, reputation: 0 });
      expect(getWeeklyIncome(club)).toBe(COMMERCIAL_INCOME_BASE);
    });
  });

  describe('getNetWeeklyIncome', () => {
    it('subtracts wageBill from income', () => {
      const club = makeClub({ fanBase: 80, reputation: 5, wageBill: 1_000_000 });
      const income = 80 * MATCHDAY_INCOME_PER_FAN + COMMERCIAL_INCOME_BASE + 5 * COMMERCIAL_INCOME_PER_REP;
      expect(getNetWeeklyIncome(club)).toBe(income - 1_000_000);
    });

    it('can be negative when wages exceed income', () => {
      const club = makeClub({ fanBase: 1, reputation: 1, wageBill: 100_000_000 });
      expect(getNetWeeklyIncome(club)).toBeLessThan(0);
    });
  });

  describe('getFinanceBreakdown — position prize scales with division size', () => {
    function makeTable(teams: number, playerClubId: string, playerPos: number): LeagueTableEntry[] {
      return Array.from({ length: teams }, (_, i) => ({
        clubId: i + 1 === playerPos ? playerClubId : `ai-${i}`,
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
        goalDifference: 0, points: 0, form: [], cleanSheets: 0,
      }));
    }

    function positionPrize(leagueTable: LeagueTableEntry[], club: Club): number {
      const breakdown = getFinanceBreakdown({
        club,
        facilities: { stadiumStands: { north: 0, south: 0, east: 0, west: 0 } } as unknown as FacilitiesState,
        staffMembers: [],
        scoutingAssignmentCount: 0,
        fanMood: 50,
        leagueTable,
        managerProgression: { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 } as ManagerProgression,
      });
      const line = breakdown.income.find(i => i.label === 'League Position');
      return line?.amount ?? -1;
    }

    it('pays positions 21-24 in a 24-team division (was £0)', () => {
      const club = makeClub();
      expect(positionPrize(makeTable(24, club.id, 22), club)).toBe(3 * POSITION_PRIZE_PER_RANK);
      expect(positionPrize(makeTable(24, club.id, 24), club)).toBe(1 * POSITION_PRIZE_PER_RANK);
    });

    it('keeps the 20-team baseline unchanged', () => {
      const club = makeClub();
      expect(positionPrize(makeTable(20, club.id, 1), club)).toBe(20 * POSITION_PRIZE_PER_RANK);
      expect(positionPrize(makeTable(20, club.id, 20), club)).toBe(1 * POSITION_PRIZE_PER_RANK);
    });

    it('pays every position in an 18-team division', () => {
      const club = makeClub();
      expect(positionPrize(makeTable(18, club.id, 18), club)).toBe(1 * POSITION_PRIZE_PER_RANK);
      expect(positionPrize(makeTable(18, club.id, 1), club)).toBe(18 * POSITION_PRIZE_PER_RANK);
    });
  });
});
