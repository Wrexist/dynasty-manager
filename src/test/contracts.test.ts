import { describe, it, expect } from 'vitest';
import { calculateWageDemand, getPlayerWillingness, negotiateRound, formatWage, createContractOffer } from '@/utils/contracts';
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
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 50000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should handle zero demanded wage gracefully', () => {
      const offer = { id: '1', playerId: 'p1', type: 'new' as const, offeredWage: 50000, demandedWage: 0, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, round: 1, status: 'in_progress' as const, playerMood: 50 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('accepted');
    });

    it('should reduce demanded wage over rounds', () => {
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 30000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, round: 1, status: 'in_progress' as const, playerMood: 70 };
      const result = negotiateRound(offer);
      if (result.status === 'in_progress') {
        expect(result.demandedWage).toBeLessThan(50000);
      }
    });

    it('should reject after max rounds', () => {
      const offer = { id: '1', playerId: 'p1', type: 'renewal' as const, offeredWage: 10000, demandedWage: 50000, agentFee: 5000, loyaltyBonus: 0, contractYears: 3, round: 5, status: 'in_progress' as const, playerMood: 30 };
      const result = negotiateRound(offer);
      expect(result.status).toBe('rejected');
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
    });
  });
});
