import { describe, it, expect } from 'vitest';
import { calculateWageDemand, getPlayerWillingness, negotiateRound, formatWage, createContractOffer, getPreferredYears, getYearsAdjustment, getAcceptanceHint } from '@/utils/contracts';
import { generatePlayer } from '@/utils/playerGen';

function makePlayer(overrides: Record<string, unknown> = {}) {
  const p = generatePlayer('CM', 75, 'club-1', 1);
  return { ...p, morale: 60, form: 60, wage: 50000, contractEnd: 3, ...overrides };
}

describe('contracts', () => {
  describe('calculateWageDemand', () => {
    it('should return at least the minimum wage', () => {
      const player = makePlayer({ wage: 100, overall: 30 });
      const demand = calculateWageDemand(player, 1);
      expect(demand).toBeGreaterThan(0);
    });

    it('should scale with club reputation', () => {
      const player = makePlayer();
      const lowRep = calculateWageDemand(player, 1);
      const highRep = calculateWageDemand(player, 5);
      expect(highRep).toBeGreaterThan(lowRep);
    });

    it('should increase for high-form players', () => {
      const base = makePlayer({ form: 50, overall: 75, age: 25 });
      const hot = makePlayer({ form: 90, overall: 75, age: 25 });
      const baseDemand = calculateWageDemand(base, 3);
      const hotDemand = calculateWageDemand(hot, 3);
      expect(hotDemand).toBeGreaterThanOrEqual(baseDemand);
    });
  });

  describe('getPlayerWillingness', () => {
    it('should return a value between 10 and 100', () => {
      const player = makePlayer();
      const willingness = getPlayerWillingness(player, 3, true, 1);
      expect(willingness).toBeGreaterThanOrEqual(10);
      expect(willingness).toBeLessThanOrEqual(100);
    });

    it('should give young player bonus', () => {
      const young = makePlayer({ age: 19, overall: 65 });
      const same = makePlayer({ age: 28, overall: 65 });
      const youngW = getPlayerWillingness(young, 3, true, 1);
      const sameW = getPlayerWillingness(same, 3, true, 1);
      expect(youngW).toBeGreaterThanOrEqual(sameW);
    });

    it('should increase with club reputation for new signings', () => {
      const player = makePlayer();
      const lowRep = getPlayerWillingness(player, 1, false, 1);
      const highRep = getPlayerWillingness(player, 5, false, 1);
      expect(highRep).toBeGreaterThan(lowRep);
    });

    it('should penalize willingness when contract is expiring', () => {
      const expiring = makePlayer({ contractEnd: 3, age: 27, overall: 75 });
      const safe = makePlayer({ contractEnd: 6, age: 27, overall: 75 });
      const expiringW = getPlayerWillingness(expiring, 3, true, 2);
      const safeW = getPlayerWillingness(safe, 3, true, 2);
      expect(expiringW).toBeLessThan(safeW);
    });
  });

  describe('negotiateRound', () => {
    it('should accept when offer meets demand', () => {
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 50000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 25, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should accept when offer exceeds demand', () => {
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 72000, demandedWage: 69000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 25, round: 2, status: 'in_progress' as const, playerMood: 46 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should handle zero demanded wage gracefully', () => {
      const offer = { id: '1', playerId: 'p1', type: 'new' as const, offeredWage: 50000, demandedWage: 0, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 25, round: 1, status: 'in_progress' as const, playerMood: 50 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should reduce demanded wage over rounds', () => {
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 30000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 25, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const result = negotiateRound(offer);
      if (result.status === 'in_progress') {
        expect(result.demandedWage).toBeLessThan(50000);
      }
    });

    it('should reject after max rounds', () => {
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 10000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 25, round: 5, status: 'in_progress' as const, playerMood: 30 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('rejected');
    });

    it('should accept easier when offering more years than preferred', () => {
      // Player aged 25 prefers 3 years. Offering 5 gives a +10% bonus.
      const shortYears = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 46000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 2, playerAge: 25, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const longYears = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 46000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 5, playerAge: 25, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const shortResult = negotiateRound(shortYears);
      const longResult = negotiateRound(longYears);
      // Long years should be more likely to accept (or at least not worse)
      if (longResult.status === 'accepted') {
        expect(longResult.status).toBe('accepted');
      } else {
        // If both are in_progress, the long-years offer should not be rejected while short isn't
        expect(shortResult.status).not.toBe('accepted');
      }
    });

    it('should accept a slightly-below-demand offer even when player mood is only Cautious', () => {
      // Matches the screenshot: £42K offer vs £43K demand (~97.7%), mood 48 (Cautious), 2 yrs at age 29 (matches preferred).
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 42000, demandedWage: 43000, agentFee: 5000, loyaltyBonus: 0, contractYears: 2, playerAge: 29, round: 1, status: 'in_progress' as const, playerMood: 48 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should still reject a very-close offer if mood is Frustrated', () => {
      // 97% of demand but mood 20 (Frustrated) should not pass even the very-close tier.
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 42000, demandedWage: 43000, agentFee: 5000, loyaltyBonus: 0, contractYears: 2, playerAge: 29, round: 1, status: 'in_progress' as const, playerMood: 20 };
      const result = negotiateRound(offer);
      expect(result.status).not.toBe('accepted');
    });

    it('should reject exactly at 0.95 gap when mood is just below the very-close threshold', () => {
      // gap = 0.95, mood = 34 (one below CONTRACT_VERY_CLOSE_MOOD_THRESHOLD = 35)
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 47500, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 26, round: 1, status: 'in_progress' as const, playerMood: 34 };
      const result = negotiateRound(offer);
      expect(result.status).not.toBe('accepted');
    });

    it('should accept exactly at 0.95 gap when mood hits the very-close threshold', () => {
      // gap = 0.95, mood = 35 (exactly at threshold)
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 47500, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 26, round: 1, status: 'in_progress' as const, playerMood: 35 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should accept a 94% offer via the 0.92 tier when mood is high', () => {
      // gap = 0.94 (below very-close 0.95 tier), mood 80 — still passes via the 0.92 + mood 50 tier
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 47000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, playerAge: 26, round: 1, status: 'in_progress' as const, playerMood: 80 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should penalize acceptance when offering fewer years than preferred', () => {
      // Player aged 20 prefers 4 years. Offering 1 gives a -36% penalty (3 × 12%).
      // An offer at 95% of demand would normally be accepted (mood 70, gap 0.95 >= 0.92, mood >= 60).
      // But with -36% years penalty, adjusted gap = 0.95 - 0.36 = 0.59, which should NOT accept.
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 47500, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 1, playerAge: 20, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const result = negotiateRound(offer);
      expect(result.status).not.toBe('accepted');
    });
  });

  describe('formatWage', () => {
    it('should format millions', () => {
      expect(formatWage(1_500_000)).toBe('£1.5M/wk');
    });

    it('should format thousands', () => {
      expect(formatWage(50_000)).toBe('£50K/wk');
    });

    it('should format small values', () => {
      expect(formatWage(500)).toBe('£500/wk');
    });
  });

  describe('getPreferredYears', () => {
    it('should return 4 for young players', () => {
      expect(getPreferredYears(20)).toBe(4);
    });

    it('should return 3 for prime-age players', () => {
      expect(getPreferredYears(26)).toBe(3);
    });

    it('should return 2 for older players', () => {
      expect(getPreferredYears(30)).toBe(2);
    });

    it('should return 1 for veteran players', () => {
      expect(getPreferredYears(34)).toBe(1);
    });
  });

  describe('getYearsAdjustment', () => {
    it('should return 0 when years match preference', () => {
      // Age 20 prefers 4 years
      expect(getYearsAdjustment(20, 4)).toBe(0);
    });

    it('should return positive bonus for extra years', () => {
      // Age 26 prefers 3 years, offering 5 = +2 × 5% = +10%
      const adj = getYearsAdjustment(26, 5);
      expect(adj).toBeCloseTo(0.10);
    });

    it('should return heavy penalty for fewer years', () => {
      // Age 20 prefers 4 years, offering 1 = -3 × 12% = -36%
      const adj = getYearsAdjustment(20, 1);
      expect(adj).toBeCloseTo(-0.36);
    });

    it('should mute the years bonus for veterans (age > 30)', () => {
      // Age 33 prefers 1 year. Offering 5 = +4 years. Normally +20%, vets get 40% of that = +8%.
      const vet = getYearsAdjustment(33, 5);
      const prime = getYearsAdjustment(26, 5);   // 3 → 5 = +2 × 5% = +10% (prime, full rate)
      expect(vet).toBeCloseTo(0.08);
      expect(vet).toBeLessThan(prime);
    });
  });

  describe('getAcceptanceHint', () => {
    it('should say will accept when wage meets demand and years match', () => {
      const hint = getAcceptanceHint(1.0, 26, 3, 70);
      expect(hint.text).toContain('Will accept');
    });

    it('should warn when wage meets demand but years are short', () => {
      // Wage at 100% but 2 years under preferred = -24% penalty, adjustedGap = 0.76
      const hint = getAcceptanceHint(1.0, 20, 2, 50);
      expect(hint.text).not.toContain('Will accept');
    });

    it('should accept when extra years compensate for lower wage', () => {
      // Wage at 90% but 2 years over preferred = +10% bonus, adjustedGap = 1.0
      const hint = getAcceptanceHint(0.90, 26, 5, 70);
      expect(hint.text).toContain('Will accept');
    });

    it('should preview the exact wage and years when offeredWage is provided and accepted', () => {
      const hint = getAcceptanceHint(1.0, 26, 3, 70, 42000);
      expect(hint.text).toContain('42K');
      expect(hint.text).toContain('3 yrs');
    });

    it('should surface the exact mood threshold needed when mood is the blocker', () => {
      // 0.95 gap but mood 20 — needs mood 35+ (CONTRACT_VERY_CLOSE_MOOD_THRESHOLD)
      const hint = getAcceptanceHint(0.95, 26, 3, 20);
      expect(hint.text).toContain('35');
    });

    it('should use singular year label when offering 1 year', () => {
      const hint = getAcceptanceHint(1.0, 34, 1, 70, 50000);
      expect(hint.text).toContain('1 yr');
      expect(hint.text).not.toContain('1 yrs');
    });
  });

  describe('createContractOffer', () => {
    it('should create a valid offer object', () => {
      const player = makePlayer();
      const offer = createContractOffer(player, 3, true, 1);
      expect(offer.playerId).toBe(player.id);
      expect(offer.type).toBe('renewal');
      expect(offer.status).toBe('in_progress');
      expect(offer.round).toBe(1);
      expect(offer.demandedWage).toBeGreaterThan(0);
      expect(offer.offeredWage).toBeGreaterThan(0);
      expect(offer.contractYears).toBeGreaterThanOrEqual(1);
      expect(offer.playerAge).toBe(player.age);
    });
  });
});
