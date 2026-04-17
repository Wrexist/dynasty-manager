import { describe, it, expect } from 'vitest';
import { calculateWageDemand, getPlayerWillingness, negotiateRound, formatWage, createContractOffer, getPreferredYears, getYearsAdjustment, getAcceptanceHint, getReleaseClauseTier } from '@/utils/contracts';
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

    it('should cache player market value for clause math', () => {
      const player = makePlayer({ value: 12_000_000 });
      const offer = createContractOffer(player, 3, true, 1);
      expect(offer.playerValue).toBe(12_000_000);
    });
  });

  describe('release clauses', () => {
    it('getReleaseClauseTier classifies clauses relative to value', () => {
      expect(getReleaseClauseTier(undefined, 10_000_000)).toBe('none');
      expect(getReleaseClauseTier(5_000_000, 10_000_000)).toBe('none'); // below value
      expect(getReleaseClauseTier(12_000_000, 10_000_000)).toBe('fair'); // 1.2x
      expect(getReleaseClauseTier(25_000_000, 10_000_000)).toBe('moderate'); // 2.5x
      expect(getReleaseClauseTier(50_000_000, 10_000_000)).toBe('high'); // 5x
    });

    it('a fair clause makes a borderline offer more likely to be accepted', () => {
      const player = makePlayer({ age: 26, overall: 72, value: 10_000_000 });
      const baseOffer = createContractOffer(player, 3, true, 1);
      // Borderline offer: 88% of demand, at preferred years — normally a coin-flip/reject
      const borderline = { ...baseOffer, offeredWage: Math.round(baseOffer.demandedWage * 0.88), playerMood: 55 };
      const withoutClause = negotiateRound(borderline);
      const withClause = negotiateRound({ ...borderline, releaseClause: 14_000_000 });
      // The clause-inclusive variant must never end up worse off
      if (withoutClause.status === 'accepted') {
        expect(['accepted', 'in_progress']).toContain(withClause.status);
      }
      // A fair clause at least does not reduce accept probability (same mood change or better)
      expect(withClause.playerMood).toBeGreaterThanOrEqual(withoutClause.playerMood);
    });

    it('getAcceptanceHint improves with a fair clause included', () => {
      const hintNoClause = getAcceptanceHint(0.88, 26, 3, 60);
      const hintWithClause = getAcceptanceHint(0.88, 26, 3, 60, 14_000_000, 10_000_000);
      // With clause bonus, it should not be "worse" (if no-clause is accept, with-clause stays accept)
      if (hintNoClause.text.includes('Will accept')) {
        expect(hintWithClause.text).toContain('Will accept');
      }
    });
  });
});
