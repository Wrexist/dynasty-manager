import { describe, it, expect } from 'vitest';
import {
  calculateWeeklyMerchRevenue,
  getPlayerMarketability,
  getStarPlayerMerch,
  isProductLineUnlocked,
  getMerchOperatingCost,
  getDefaultMerchState,
} from '@/utils/merchandise';
import { MERCH_PRODUCT_LINES } from '@/config/merchandise';
import type { Club, Player, MerchState, FacilitiesState, ManagerProgression } from '@/types/game';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'test-club', name: 'Test FC', shortName: 'TST',
    color: '#000', secondaryColor: '#FFF',
    budget: 50_000_000, reputation: 3, fanBase: 50,
    wageBill: 500_000, formation: '4-3-3',
    facilities: 5, youthRating: 5, boardPatience: 5,
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    ...overrides,
  } as Club;
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe',
    age: 24, nationality: 'England', position: 'ST',
    attributes: { pace: 75, shooting: 80, passing: 70, defending: 40, physical: 75, mental: 70 },
    overall: 78, potential: 85, clubId: 'test-club',
    wage: 50_000, value: 10_000_000, contractEnd: 3,
    fitness: 90, morale: 75, form: 70,
    injured: false, injuryWeeks: 0,
    goals: 10, assists: 5, appearances: 20,
    yellowCards: 2, redCards: 0,
    ...overrides,
  } as Player;
}

function makeFacilities(overrides: Partial<FacilitiesState> = {}): FacilitiesState {
  return {
    trainingLevel: 5, youthLevel: 5, stadiumLevel: 5, medicalLevel: 5, recoveryLevel: 1,
    upgradeInProgress: null,
    ...overrides,
  };
}

const defaultProgression: ManagerProgression = { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 };

describe('merchandise', () => {
  describe('getPlayerMarketability', () => {
    it('returns 0 for players with fewer than 3 appearances', () => {
      const player = makePlayer({ appearances: 2 });
      expect(getPlayerMarketability(player)).toBe(0);
    });

    it('gives bonus to young players (18-25)', () => {
      const young = makePlayer({ age: 22, overall: 78, goals: 10, assists: 5, appearances: 20 });
      const old = makePlayer({ age: 30, overall: 78, goals: 10, assists: 5, appearances: 20 });
      expect(getPlayerMarketability(young)).toBeGreaterThan(getPlayerMarketability(old));
    });

    it('values goals and assists', () => {
      const scorer = makePlayer({ goals: 20, assists: 10, appearances: 30 });
      const benchwarmer = makePlayer({ goals: 1, assists: 0, appearances: 10 });
      expect(getPlayerMarketability(scorer)).toBeGreaterThan(getPlayerMarketability(benchwarmer));
    });
  });

  describe('getStarPlayerMerch', () => {
    it('returns top 3 most marketable players', () => {
      const players: Record<string, Player> = {
        p1: makePlayer({ id: 'p1', goals: 20, overall: 85 }),
        p2: makePlayer({ id: 'p2', goals: 10, overall: 75 }),
        p3: makePlayer({ id: 'p3', goals: 5, overall: 70 }),
        p4: makePlayer({ id: 'p4', goals: 1, overall: 60, appearances: 5 }),
      };
      const club = makeClub({ playerIds: ['p1', 'p2', 'p3', 'p4'] });
      const stars = getStarPlayerMerch(club, players);
      expect(stars.length).toBeLessThanOrEqual(3);
      expect(stars[0].playerId).toBe('p1');
    });

    it('filters out players with zero marketability', () => {
      const players: Record<string, Player> = {
        p1: makePlayer({ id: 'p1', appearances: 1 }),
      };
      const club = makeClub({ playerIds: ['p1'] });
      const stars = getStarPlayerMerch(club, players);
      expect(stars.length).toBe(0);
    });
  });

  describe('isProductLineUnlocked', () => {
    it('matchday_essentials is always unlocked', () => {
      const club = makeClub({ reputation: 1 });
      expect(isProductLineUnlocked('matchday_essentials', club, 'eng', makeFacilities())).toBe(true);
    });

    it('replica_kits requires rep 2', () => {
      const lowClub = makeClub({ reputation: 1 });
      expect(isProductLineUnlocked('replica_kits', lowClub, 'eng', makeFacilities())).toBe(false);

      const repClub = makeClub({ reputation: 2 });
      expect(isProductLineUnlocked('replica_kits', repClub, 'eng', makeFacilities())).toBe(true);
    });

    it('digital_global requires rep 4 and stadium level 6', () => {
      const club = makeClub({ reputation: 4 });
      expect(isProductLineUnlocked('digital_global', club, 'eng', makeFacilities({ stadiumLevel: 5 }))).toBe(false);
      expect(isProductLineUnlocked('digital_global', club, 'eng', makeFacilities({ stadiumLevel: 6 }))).toBe(true);
    });
  });

  describe('getMerchOperatingCost', () => {
    it('sums operating costs of active product lines', () => {
      const cost = getMerchOperatingCost(['matchday_essentials', 'replica_kits']);
      expect(cost).toBe(
        MERCH_PRODUCT_LINES.matchday_essentials.weeklyOperatingCost +
        MERCH_PRODUCT_LINES.replica_kits.weeklyOperatingCost
      );
    });

    it('returns 0 for empty product lines', () => {
      expect(getMerchOperatingCost([])).toBe(0);
    });
  });

  describe('calculateWeeklyMerchRevenue', () => {
    it('returns 0 when no product lines are active', () => {
      const merch: MerchState = { ...getDefaultMerchState(), activeProductLines: [] };
      const club = makeClub({ fanBase: 50 });
      const result = calculateWeeklyMerchRevenue(merch, club, {}, 'eng', defaultProgression);
      expect(result).toBe(0);
    });

    it('returns positive revenue with default state', () => {
      const merch = getDefaultMerchState();
      const club = makeClub({ fanBase: 50, playerIds: [] });
      const result = calculateWeeklyMerchRevenue(merch, club, {}, 'eng', defaultProgression);
      expect(result).toBeGreaterThan(0);
    });

    it('premium pricing increases revenue', () => {
      const standardMerch = { ...getDefaultMerchState(), pricingTier: 'standard' as const };
      const premiumMerch = { ...getDefaultMerchState(), pricingTier: 'premium' as const };
      const club = makeClub({ fanBase: 50, playerIds: [] });

      const standardRev = calculateWeeklyMerchRevenue(standardMerch, club, {}, 'eng', defaultProgression);
      const premiumRev = calculateWeeklyMerchRevenue(premiumMerch, club, {}, 'eng', defaultProgression);
      expect(premiumRev).toBeGreaterThan(standardRev);
    });

    it.skip('lower quality leagues earn less (TODO: fix MERCH_DIVISION_SCALE to use qualityTier lookup)', () => {
      const merch = getDefaultMerchState();
      const club = makeClub({ fanBase: 50, playerIds: [] });
      const eng = calculateWeeklyMerchRevenue(merch, club, {}, 'eng', defaultProgression);
      const cyp = calculateWeeklyMerchRevenue(merch, club, {}, 'cyp', defaultProgression);
      expect(eng).toBeGreaterThan(cyp);
    });

    it('campaigns boost revenue', () => {
      const baseMerch = getDefaultMerchState();
      const campaignMerch: MerchState = {
        ...baseMerch,
        activeCampaign: { type: 'kit_launch', weeksRemaining: 4, totalWeeks: 6, revenueBoost: 0.8 },
      };
      const club = makeClub({ fanBase: 50, playerIds: [] });
      const base = calculateWeeklyMerchRevenue(baseMerch, club, {}, 'eng', defaultProgression);
      const boosted = calculateWeeklyMerchRevenue(campaignMerch, club, {}, 'eng', defaultProgression);
      expect(boosted).toBeGreaterThan(base);
    });

    it('more product lines increase revenue', () => {
      const merch1: MerchState = { ...getDefaultMerchState(), activeProductLines: ['matchday_essentials'] };
      const merch3: MerchState = { ...getDefaultMerchState(), activeProductLines: ['matchday_essentials', 'replica_kits', 'lifestyle_apparel'] };
      const club = makeClub({ fanBase: 50, playerIds: [] });
      const rev1 = calculateWeeklyMerchRevenue(merch1, club, {}, 'eng', defaultProgression);
      const rev3 = calculateWeeklyMerchRevenue(merch3, club, {}, 'eng', defaultProgression);
      expect(rev3).toBeGreaterThan(rev1);
    });
  });

  describe('getDefaultMerchState', () => {
    it('starts with matchday_essentials active', () => {
      const state = getDefaultMerchState();
      expect(state.activeProductLines).toEqual(['matchday_essentials']);
      expect(state.pricingTier).toBe('standard');
      expect(state.activeCampaign).toBeNull();
    });
  });
});
