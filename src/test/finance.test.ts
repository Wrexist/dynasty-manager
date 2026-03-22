import { describe, it, expect } from 'vitest';
import { getWeeklyIncome, getNetWeeklyIncome } from '@/utils/financeHelpers';
import { MATCHDAY_INCOME_PER_FAN, COMMERCIAL_INCOME_PER_REP, COMMERCIAL_INCOME_BASE } from '@/config/gameBalance';
import type { Club } from '@/types/game';

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
    players: [],
    facilities: 5,
    youthRating: 5,
    boardPatience: 5,
    squadQuality: 70,
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
});
