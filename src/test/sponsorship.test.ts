/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  getSponsorById,
  isSlotUnlocked,
  getBonusConditionLabel,
  getEligibleSponsors,
  generateSponsorPayment,
  generatePerformanceBonus,
  generateBuyoutCost,
  generateOffer,
  SPONSOR_SLOTS,
  SPONSOR_POOL,
  SPONSOR_SATISFACTION_START,
  SPONSOR_SAT_WIN,
  SPONSOR_SAT_LOSS,
  SPONSOR_SAT_TERMINATE_THRESHOLD,
  SPONSOR_SAT_WARNING_THRESHOLD,
  SPONSOR_OFFER_EXPIRY,
  SPONSOR_SAT_BONUS_MET,
  SPONSOR_SAT_REP_DOWN,
} from '@/config/sponsorship';
import {
  processSponsorWeek,
  processSponsorSeasonEnd,
  generateStarterDeals,
} from '@/store/slices/sponsorSlice';
import type {
  SponsorDeal,
  SponsorOffer,
  SponsorBonusCondition,
  FacilitiesState,
  Match,
  LeagueTableEntry,
  CupState,
} from '@/types/game';

// ── Factory Helpers ──

function makeFacilities(overrides: Partial<FacilitiesState> = {}): FacilitiesState {
  return {
    trainingLevel: 1, youthLevel: 1, stadiumLevel: 1, medicalLevel: 1, recoveryLevel: 1,
    upgradeInProgress: null,
    ...overrides,
  };
}

function makeDeal(overrides: Partial<SponsorDeal> = {}): SponsorDeal {
  return {
    id: 'deal-1',
    sponsorId: 'petes_pizza',
    slotId: 'kit_main',
    weeklyPayment: 10_000,
    seasonDuration: 1,
    startSeason: 1,
    performanceBonus: 80_000,
    bonusCondition: 'top_6',
    bonusMet: false,
    satisfaction: SPONSOR_SATISFACTION_START,
    buyoutCost: 40_000,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<SponsorOffer> = {}): SponsorOffer {
  return {
    id: 'offer-1',
    sponsorId: 'petes_pizza',
    slotId: 'digital',
    weeklyPayment: 10_000,
    seasonDuration: 1,
    performanceBonus: 80_000,
    bonusCondition: 'top_6',
    buyoutCost: 40_000,
    expiresWeek: 10,
    ...overrides,
  };
}

function makeTableEntry(clubId: string, overrides: Partial<LeagueTableEntry> = {}): LeagueTableEntry {
  return {
    clubId,
    played: 38,
    won: 15,
    drawn: 10,
    lost: 13,
    goalsFor: 50,
    goalsAgainst: 45,
    goalDifference: 5,
    points: 55,
    form: ['W', 'D', 'L'],
    cleanSheets: 8,
    ...overrides,
  };
}

function makeCupState(overrides: Partial<CupState> = {}): CupState {
  return {
    ties: [],
    currentRound: null,
    eliminated: false,
    winner: null,
    ...overrides,
  };
}

function makeState(overrides: Record<string, any> = {}): any {
  return {
    week: 5,
    season: 1,
    playerClubId: 'test-club',
    playerDivision: 'eng',
    sponsorDeals: [],
    sponsorOffers: [],
    sponsorSlotCooldowns: {},
    facilities: makeFacilities(),
    clubs: {
      'test-club': {
        id: 'test-club',
        name: 'Test FC',
        reputation: 3,
        budget: 1_000_000,
        playerIds: [],
      },
    },
    currentMatchResult: null,
    messages: [],
    divisionTables: {
      eng: [
        makeTableEntry('test-club', { won: 20, goalsFor: 85, goalsAgainst: 40, goalDifference: 45, cleanSheets: 16 }),
        makeTableEntry('other-club'),
      ],
    },
    divisionFixtures: { eng: [] },
    cup: makeCupState(),
    ...overrides,
  };
}

// ── Config Helpers ──

describe('sponsorship config helpers', () => {
  describe('getSponsorById', () => {
    it('returns correct sponsor for valid id', () => {
      const sponsor = getSponsorById('petes_pizza');
      expect(sponsor).toBeDefined();
      expect(sponsor!.name).toBe("Pete's Pizza");
      expect(sponsor!.tier).toBe(1);
    });

    it('returns undefined for invalid id', () => {
      expect(getSponsorById('nonexistent_sponsor')).toBeUndefined();
    });
  });

  describe('isSlotUnlocked', () => {
    it('returns true for slots with no unlock requirement', () => {
      const facilities = makeFacilities();
      expect(isSlotUnlocked('kit_main', facilities)).toBe(true);
      expect(isSlotUnlocked('digital', facilities)).toBe(true);
    });

    it('returns false when facility level is too low', () => {
      const facilities = makeFacilities({ stadiumLevel: 2 });
      // kit_sleeve requires stadium level 3
      expect(isSlotUnlocked('kit_sleeve', facilities)).toBe(false);
    });

    it('returns true when facility level is sufficient', () => {
      const facilities = makeFacilities({ stadiumLevel: 3 });
      expect(isSlotUnlocked('kit_sleeve', facilities)).toBe(true);
    });

    it('returns true when facility level exceeds requirement', () => {
      const facilities = makeFacilities({ stadiumLevel: 6 });
      // match_ball requires stadium level 4
      expect(isSlotUnlocked('match_ball', facilities)).toBe(true);
    });

    it('checks training facility for training_kit slot', () => {
      expect(isSlotUnlocked('training_kit', makeFacilities({ trainingLevel: 3 }))).toBe(false);
      expect(isSlotUnlocked('training_kit', makeFacilities({ trainingLevel: 4 }))).toBe(true);
    });

    it('checks youth facility for academy slot', () => {
      expect(isSlotUnlocked('academy', makeFacilities({ youthLevel: 4 }))).toBe(false);
      expect(isSlotUnlocked('academy', makeFacilities({ youthLevel: 5 }))).toBe(true);
    });
  });

  describe('getBonusConditionLabel', () => {
    const allConditions: [SponsorBonusCondition, string][] = [
      ['win_league', 'Win the league'],
      ['top_2', 'Finish in top 2'],
      ['top_4', 'Finish in top 4'],
      ['top_6', 'Finish in top 6'],
      ['avoid_relegation', 'Avoid relegation'],
      ['win_cup', 'Win the cup'],
      ['cup_final', 'Reach cup final'],
      ['cup_semi', 'Reach cup semi-finals'],
      ['win_20_matches', 'Win 20+ league matches'],
      ['score_80_goals', 'Score 80+ league goals'],
      ['clean_sheets_15', 'Keep 15+ clean sheets'],
      ['goal_diff_30', 'Goal difference of +30'],
      ['promotion', 'Win promotion'],
      ['unbeaten_home_10', '10+ match unbeaten at home'],
    ];

    it.each(allConditions)('returns correct label for %s', (condition, expected) => {
      expect(getBonusConditionLabel(condition)).toBe(expected);
    });
  });

  describe('getEligibleSponsors', () => {
    it('filters sponsors by reputation', () => {
      const eligible = getEligibleSponsors(1, []);
      const allLowTier = eligible.every(s => s.minReputation <= 1);
      expect(allLowTier).toBe(true);
      expect(eligible.length).toBeGreaterThan(0);
    });

    it('includes higher-tier sponsors at higher reputation', () => {
      const rep1 = getEligibleSponsors(1, []);
      const rep5 = getEligibleSponsors(5, []);
      expect(rep5.length).toBeGreaterThan(rep1.length);
    });

    it('excludes active sponsor IDs', () => {
      const eligible = getEligibleSponsors(5, ['petes_pizza', 'apex_tech']);
      const ids = eligible.map(s => s.id);
      expect(ids).not.toContain('petes_pizza');
      expect(ids).not.toContain('apex_tech');
    });

    it('returns all sponsors at max reputation with no exclusions', () => {
      const eligible = getEligibleSponsors(5, []);
      expect(eligible.length).toBe(SPONSOR_POOL.length);
    });
  });

  describe('generateSponsorPayment', () => {
    it('returns value within expected range', () => {
      const sponsor = getSponsorById('petes_pizza')!;
      const slotDef = SPONSOR_SLOTS.find(s => s.id === 'kit_main')!;
      for (let i = 0; i < 20; i++) {
        const payment = generateSponsorPayment(sponsor, slotDef.valueTier);
        const min = Math.round(sponsor.weeklyPaymentRange[0] * slotDef.valueTier);
        const max = Math.round(sponsor.weeklyPaymentRange[1] * slotDef.valueTier);
        expect(payment).toBeGreaterThanOrEqual(min);
        expect(payment).toBeLessThanOrEqual(max);
      }
    });

    it('scales payment by slot value tier', () => {
      const sponsor = getSponsorById('apex_tech')!;
      // kit_main valueTier=1.0, digital valueTier=0.15
      const kitPayments: number[] = [];
      const digitalPayments: number[] = [];
      for (let i = 0; i < 50; i++) {
        kitPayments.push(generateSponsorPayment(sponsor, 1.0));
        digitalPayments.push(generateSponsorPayment(sponsor, 0.15));
      }
      const avgKit = kitPayments.reduce((a, b) => a + b) / kitPayments.length;
      const avgDigital = digitalPayments.reduce((a, b) => a + b) / digitalPayments.length;
      expect(avgKit).toBeGreaterThan(avgDigital);
    });
  });

  describe('generatePerformanceBonus', () => {
    it('returns weeklyPayment multiplied by 8', () => {
      expect(generatePerformanceBonus(10_000)).toBe(80_000);
      expect(generatePerformanceBonus(100_000)).toBe(800_000);
      expect(generatePerformanceBonus(0)).toBe(0);
    });
  });

  describe('generateBuyoutCost', () => {
    it('returns weeklyPayment x 4 x duration', () => {
      expect(generateBuyoutCost(10_000, 1)).toBe(40_000);
      expect(generateBuyoutCost(10_000, 2)).toBe(80_000);
      expect(generateBuyoutCost(50_000, 3)).toBe(600_000);
    });
  });

  describe('generateOffer', () => {
    it('returns a valid offer with correct expiry', () => {
      const offer = generateOffer('kit_main', 3, [], 5, 1);
      expect(offer).not.toBeNull();
      expect(offer!.slotId).toBe('kit_main');
      expect(offer!.expiresWeek).toBe(5 + SPONSOR_OFFER_EXPIRY);
      expect(offer!.weeklyPayment).toBeGreaterThan(0);
      expect(offer!.seasonDuration).toBeGreaterThanOrEqual(1);
      expect(offer!.performanceBonus).toBeGreaterThan(0);
      expect(offer!.buyoutCost).toBeGreaterThan(0);
      expect(offer!.sponsorId).toBeTruthy();
    });

    it('returns null for invalid slot', () => {
      const offer = generateOffer('nonexistent_slot' as any, 3, [], 5, 1);
      expect(offer).toBeNull();
    });

    it('returns null when all sponsors are excluded', () => {
      const allIds = SPONSOR_POOL.map(s => s.id);
      const offer = generateOffer('kit_main', 5, allIds, 5, 1);
      expect(offer).toBeNull();
    });
  });
});

// ── Processing Functions ──

describe('processSponsorWeek', () => {
  it('expires old offers and adds a message', () => {
    // Use an odd week to avoid triggering offer generation (SPONSOR_OFFER_INTERVAL = 2)
    const state = makeState({
      week: 11,
      sponsorOffers: [
        makeOffer({ id: 'exp-1', expiresWeek: 9 }),   // expired
        makeOffer({ id: 'exp-2', expiresWeek: 11 }),   // expired (expiresWeek <= week)
        makeOffer({ id: 'valid', expiresWeek: 15 }),    // still valid
      ],
    });

    const result = processSponsorWeek(state);
    expect(result.sponsorOffers).toHaveLength(1);
    expect(result.sponsorOffers![0].id).toBe('valid');
    // Two expired offers generate two messages
    const expiredMsgs = result.messages!.filter((m: any) => m.title === 'Sponsor Offer Expired');
    expect(expiredMsgs).toHaveLength(2);
  });

  it('updates satisfaction after a win (+2)', () => {
    const deal = makeDeal({ satisfaction: 50 });
    const matchResult: Partial<Match> = {
      homeClubId: 'test-club',
      awayClubId: 'other-club',
      homeGoals: 2,
      awayGoals: 1,
      played: true,
    };
    const state = makeState({
      sponsorDeals: [deal],
      currentMatchResult: matchResult,
    });

    const result = processSponsorWeek(state);
    expect(result.sponsorDeals![0].satisfaction).toBe(50 + SPONSOR_SAT_WIN);
  });

  it('updates satisfaction after a loss (-3)', () => {
    const deal = makeDeal({ satisfaction: 50 });
    const matchResult: Partial<Match> = {
      homeClubId: 'test-club',
      awayClubId: 'other-club',
      homeGoals: 0,
      awayGoals: 2,
      played: true,
    };
    const state = makeState({
      sponsorDeals: [deal],
      currentMatchResult: matchResult,
    });

    const result = processSponsorWeek(state);
    expect(result.sponsorDeals![0].satisfaction).toBe(50 + SPONSOR_SAT_LOSS);
  });

  it('updates satisfaction correctly when player is away team', () => {
    const deal = makeDeal({ satisfaction: 50 });
    const matchResult: Partial<Match> = {
      homeClubId: 'other-club',
      awayClubId: 'test-club',
      homeGoals: 0,
      awayGoals: 3,
      played: true,
    };
    const state = makeState({
      sponsorDeals: [deal],
      currentMatchResult: matchResult,
    });

    const result = processSponsorWeek(state);
    // Away win
    expect(result.sponsorDeals![0].satisfaction).toBe(50 + SPONSOR_SAT_WIN);
  });

  it('terminates deals below satisfaction threshold', () => {
    const deal = makeDeal({
      satisfaction: SPONSOR_SAT_TERMINATE_THRESHOLD - 1,
    });
    const state = makeState({
      sponsorDeals: [deal],
    });

    const result = processSponsorWeek(state);
    expect(result.sponsorDeals).toHaveLength(0);
    const terminationMsg = result.messages!.find((m: any) => m.title === 'Sponsor Pulls Out!');
    expect(terminationMsg).toBeDefined();
  });

  it('sends warning when satisfaction drops below warning threshold', () => {
    // Previous satisfaction above warning, current drops below after a loss
    const prevSatisfaction = SPONSOR_SAT_WARNING_THRESHOLD + 1;
    const deal = makeDeal({ satisfaction: prevSatisfaction });
    const matchResult: Partial<Match> = {
      homeClubId: 'test-club',
      awayClubId: 'other-club',
      homeGoals: 0,
      awayGoals: 1,
      played: true,
    };

    // The function compares updated deal sat to threshold, and checks original deal sat
    const state = makeState({
      sponsorDeals: [deal],
      currentMatchResult: matchResult,
    });

    const result = processSponsorWeek(state);
    // After loss: 31 + (-3) = 28, which is <= 30 and > 15, and prev was 31 > 30
    const warningMsg = result.messages!.find((m: any) => m.title === 'Sponsor Unhappy');
    expect(warningMsg).toBeDefined();
  });

  it('does not warn when satisfaction was already below warning threshold', () => {
    // Already below warning threshold from before
    const deal = makeDeal({ satisfaction: SPONSOR_SAT_WARNING_THRESHOLD - 2 });
    const state = makeState({
      sponsorDeals: [deal],
      // No match result, so satisfaction doesn't change
    });

    const result = processSponsorWeek(state);
    const warningMsg = result.messages!.find((m: any) => m.title === 'Sponsor Unhappy');
    expect(warningMsg).toBeUndefined();
  });

  it('generates new offers for empty unlocked slots on interval weeks', () => {
    // SPONSOR_OFFER_INTERVAL = 2, so week 2 should trigger
    const state = makeState({
      week: 2,
      facilities: makeFacilities(),
      sponsorDeals: [],
      sponsorOffers: [],
      clubs: {
        'test-club': { id: 'test-club', name: 'Test FC', reputation: 3, budget: 1_000_000 },
      },
    });

    const result = processSponsorWeek(state);
    // kit_main and digital are unlocked by default; should generate up to 2 offers
    expect(result.sponsorOffers!.length).toBeGreaterThan(0);
    expect(result.sponsorOffers!.length).toBeLessThanOrEqual(2);

    // Each offer should have a notification message
    const offerMsgs = result.messages!.filter((m: any) => m.title === 'Sponsor Offer Received');
    expect(offerMsgs.length).toBe(result.sponsorOffers!.length);
  });

  it('does not generate offers on non-interval weeks', () => {
    // Week 3 is odd, SPONSOR_OFFER_INTERVAL = 2, so 3 % 2 !== 0
    const state = makeState({
      week: 3,
      sponsorDeals: [],
      sponsorOffers: [],
    });

    const result = processSponsorWeek(state);
    // No new offers should be generated (only expired offer processing etc.)
    const offerMsgs = (result.messages || []).filter((m: any) => m.title === 'Sponsor Offer Received');
    expect(offerMsgs.length).toBe(0);
  });

  it('clamps satisfaction to 100 max', () => {
    const deal = makeDeal({ satisfaction: 99 });
    const matchResult: Partial<Match> = {
      homeClubId: 'test-club',
      awayClubId: 'other-club',
      homeGoals: 5,
      awayGoals: 0,
      played: true,
    };
    const state = makeState({
      sponsorDeals: [deal],
      currentMatchResult: matchResult,
    });

    const result = processSponsorWeek(state);
    expect(result.sponsorDeals![0].satisfaction).toBeLessThanOrEqual(100);
  });
});

describe('processSponsorSeasonEnd', () => {
  it('awards performance bonus when condition is met (win_league, position 1)', () => {
    const deal = makeDeal({
      bonusCondition: 'win_league',
      performanceBonus: 100_000,
      satisfaction: 70,
      startSeason: 1,
      seasonDuration: 2,
    });
    const state = makeState({
      season: 1,
      sponsorDeals: [deal],
      divisionTables: {
        eng: [
          makeTableEntry('test-club'),   // position 1
          makeTableEntry('other-club'),
        ],
      },
    });

    const result = processSponsorSeasonEnd(state);
    const bonusMsg = result.messages!.find((m: any) => m.title === 'Sponsor Bonus Earned!');
    expect(bonusMsg).toBeDefined();
    expect(result.clubs!['test-club'].budget).toBe(1_000_000 + 100_000);
  });

  it('does not award bonus when condition is not met', () => {
    const deal = makeDeal({
      bonusCondition: 'win_league',
      performanceBonus: 100_000,
      startSeason: 1,
      seasonDuration: 2,
    });
    const state = makeState({
      season: 1,
      sponsorDeals: [deal],
      divisionTables: {
        eng: [
          makeTableEntry('other-club'),  // position 1
          makeTableEntry('test-club'),   // position 2
        ],
      },
    });

    const result = processSponsorSeasonEnd(state);
    const bonusMsg = result.messages!.find((m: any) => m.title === 'Sponsor Bonus Earned!');
    expect(bonusMsg).toBeUndefined();
    expect(result.clubs!['test-club'].budget).toBe(1_000_000);
  });

  it('removes expired deals (startSeason + seasonDuration <= nextSeason)', () => {
    const expiredDeal = makeDeal({
      id: 'expired',
      startSeason: 1,
      seasonDuration: 1,
    });
    const activeDeal = makeDeal({
      id: 'active',
      slotId: 'digital',
      startSeason: 1,
      seasonDuration: 2,
    });
    const state = makeState({
      season: 1,
      sponsorDeals: [expiredDeal, activeDeal],
    });

    const result = processSponsorSeasonEnd(state);
    // season=1, nextSeason=2. expired: 1+1=2 <= 2, removed. active: 1+2=3 > 2, kept.
    expect(result.sponsorDeals).toHaveLength(1);
    expect(result.sponsorDeals![0].id).toBe('active');

    const expiredMsg = result.messages!.find((m: any) => m.title === 'Sponsorship Expired');
    expect(expiredMsg).toBeDefined();
  });

  it('resets bonusMet for active deals', () => {
    const deal = makeDeal({
      bonusMet: true,
      bonusCondition: 'top_6',
      startSeason: 1,
      seasonDuration: 3,
    });
    const state = makeState({
      season: 1,
      sponsorDeals: [deal],
      divisionTables: {
        eng: [
          makeTableEntry('test-club'), // position 1, so top_6 is met
          makeTableEntry('other-club'),
        ],
      },
    });

    const result = processSponsorSeasonEnd(state);
    // Active deals have bonusMet reset to false for next season
    expect(result.sponsorDeals![0].bonusMet).toBe(false);
  });

  it('reduces satisfaction on relegation', () => {
    // Position must be in relegation zone.
    // Default LEAGUES 'eng' has replacedSlots. We need the club in a low position.
    // Create 20 teams with test-club at the bottom
    const table: LeagueTableEntry[] = [];
    for (let i = 0; i < 19; i++) {
      table.push(makeTableEntry(`club-${i}`));
    }
    table.push(makeTableEntry('test-club')); // position 20 (last)

    const deal = makeDeal({
      satisfaction: 70,
      startSeason: 1,
      seasonDuration: 3,
      bonusCondition: 'avoid_relegation',
    });

    const state = makeState({
      season: 1,
      sponsorDeals: [deal],
      divisionTables: { eng: table },
    });

    const result = processSponsorSeasonEnd(state);
    // Relegation applies SPONSOR_SAT_REP_DOWN (-10)
    // avoid_relegation is NOT met (relegated), so no bonus met delta
    expect(result.sponsorDeals![0].satisfaction).toBe(70 + SPONSOR_SAT_REP_DOWN);
  });

  it('increases satisfaction when bonus condition is met', () => {
    const deal = makeDeal({
      satisfaction: 60,
      bonusCondition: 'top_4',
      startSeason: 1,
      seasonDuration: 3,
    });
    // Need enough teams so position 1 is safely above relegation zone
    const table: LeagueTableEntry[] = [makeTableEntry('test-club')];
    for (let i = 0; i < 19; i++) {
      table.push(makeTableEntry(`club-${i}`));
    }
    const state = makeState({
      season: 1,
      sponsorDeals: [deal],
      divisionTables: { eng: table },
    });

    const result = processSponsorSeasonEnd(state);
    // Bonus met: +SPONSOR_SAT_BONUS_MET (15), no relegation impact (position 1 is safe)
    expect(result.sponsorDeals![0].satisfaction).toBe(60 + SPONSOR_SAT_BONUS_MET);
  });

  it('evaluates cup-related bonus conditions', () => {
    const deal = makeDeal({
      bonusCondition: 'win_cup',
      performanceBonus: 200_000,
      startSeason: 1,
      seasonDuration: 2,
    });
    const state = makeState({
      season: 1,
      sponsorDeals: [deal],
      cup: makeCupState({ winner: 'test-club' }),
    });

    const result = processSponsorSeasonEnd(state);
    const bonusMsg = result.messages!.find((m: any) => m.title === 'Sponsor Bonus Earned!');
    expect(bonusMsg).toBeDefined();
    expect(result.clubs!['test-club'].budget).toBe(1_000_000 + 200_000);
  });
});

describe('generateStarterDeals', () => {
  it('returns deals with kit_main and digital slots', () => {
    const deals = generateStarterDeals(3, 1);
    expect(deals.length).toBe(2);

    const slotIds = deals.map(d => d.slotId);
    expect(slotIds).toContain('kit_main');
    expect(slotIds).toContain('digital');
  });

  it('deals have correct satisfaction start value (70)', () => {
    const deals = generateStarterDeals(3, 1);
    for (const deal of deals) {
      expect(deal.satisfaction).toBe(SPONSOR_SATISFACTION_START);
    }
  });

  it('deals have bonusMet set to false', () => {
    const deals = generateStarterDeals(3, 1);
    for (const deal of deals) {
      expect(deal.bonusMet).toBe(false);
    }
  });

  it('deals have correct startSeason', () => {
    const deals = generateStarterDeals(2, 5);
    for (const deal of deals) {
      expect(deal.startSeason).toBe(5);
    }
  });

  it('deals have valid sponsor IDs that are different', () => {
    const deals = generateStarterDeals(3, 1);
    expect(deals[0].sponsorId).toBeTruthy();
    expect(deals[1].sponsorId).toBeTruthy();
    expect(deals[0].sponsorId).not.toBe(deals[1].sponsorId);
  });

  it('deals have positive payment and bonus values', () => {
    const deals = generateStarterDeals(3, 1);
    for (const deal of deals) {
      expect(deal.weeklyPayment).toBeGreaterThan(0);
      expect(deal.performanceBonus).toBeGreaterThan(0);
      expect(deal.buyoutCost).toBeGreaterThan(0);
      expect(deal.seasonDuration).toBeGreaterThanOrEqual(1);
    }
  });
});
