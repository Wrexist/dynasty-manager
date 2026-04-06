import { describe, it, expect } from 'vitest';
import { getPerformanceMultiplier, getContractLengthFactor } from '@/utils/transferOffers';
import { generatePlayer } from '@/utils/playerGen';
import { PERFORMANCE_MAX_MULTIPLIER, PERFORMANCE_APPEARANCE_THRESHOLD } from '@/config/transfers';

function makePlayer(overrides: Record<string, unknown> = {}) {
  const p = generatePlayer('CM', 75, 'club-1', 1);
  return { ...p, goals: 0, assists: 0, form: 50, appearances: 0, ...overrides };
}

describe('getPerformanceMultiplier', () => {
  describe('baseline — no stats', () => {
    it('returns 1.0 for a player with zero appearances', () => {
      const p = makePlayer();
      expect(getPerformanceMultiplier(p, 10)).toBe(1);
    });

    it('returns 1.0 for a player with zero goals/assists and form at 50', () => {
      const p = makePlayer({ appearances: 20 });
      expect(getPerformanceMultiplier(p, 22)).toBe(1);
    });
  });

  describe('position-specific goal weights', () => {
    it('ST should produce higher multiplier than CM for same goals', () => {
      const st = makePlayer({ position: 'ST', goals: 10, appearances: 20, form: 50 });
      const cm = makePlayer({ position: 'CM', goals: 10, appearances: 20, form: 50 });
      expect(getPerformanceMultiplier(st, 22)).toBeGreaterThan(getPerformanceMultiplier(cm, 22));
    });

    it('CM should produce higher multiplier than CB for same goals', () => {
      const cm = makePlayer({ position: 'CM', goals: 10, appearances: 20, form: 50 });
      const cb = makePlayer({ position: 'CB', goals: 10, appearances: 20, form: 50 });
      expect(getPerformanceMultiplier(cm, 22)).toBeGreaterThan(getPerformanceMultiplier(cb, 22));
    });

    it('LW and RW use forward weights', () => {
      const lw = makePlayer({ position: 'LW', goals: 8, appearances: 15, form: 50 });
      const rw = makePlayer({ position: 'RW', goals: 8, appearances: 15, form: 50 });
      const st = makePlayer({ position: 'ST', goals: 8, appearances: 15, form: 50 });
      expect(getPerformanceMultiplier(lw, 20)).toBeCloseTo(getPerformanceMultiplier(st, 20), 5);
      expect(getPerformanceMultiplier(rw, 20)).toBeCloseTo(getPerformanceMultiplier(st, 20), 5);
    });

    it('GK uses defender weights', () => {
      const gk = makePlayer({ position: 'GK', goals: 2, appearances: 20, form: 50 });
      const cb = makePlayer({ position: 'CB', goals: 2, appearances: 20, form: 50 });
      expect(getPerformanceMultiplier(gk, 22)).toBeCloseTo(getPerformanceMultiplier(cb, 22), 5);
    });
  });

  describe('per-game normalization (summer vs winter parity)', () => {
    it('same goals-per-game rate produces similar multiplier regardless of week', () => {
      // 3 goals in 6 games (week 6) vs 15 goals in 30 games (week 32) — same 0.5 GPG
      const summer = makePlayer({ position: 'ST', goals: 3, appearances: 6, form: 50 });
      const winter = makePlayer({ position: 'ST', goals: 15, appearances: 30, form: 50 });
      const summerMult = getPerformanceMultiplier(summer, 6);
      const winterMult = getPerformanceMultiplier(winter, 32);
      // Should be within 10% of each other (slight variance from appearance threshold scaling)
      expect(Math.abs(summerMult - winterMult) / winterMult).toBeLessThan(0.1);
    });

    it('player with same rate but more games should not get disproportionately higher multiplier', () => {
      const few = makePlayer({ position: 'CM', goals: 5, assists: 3, appearances: 10, form: 60 });
      const many = makePlayer({ position: 'CM', goals: 10, assists: 6, appearances: 20, form: 60 });
      const fewMult = getPerformanceMultiplier(few, 12);
      const manyMult = getPerformanceMultiplier(many, 24);
      expect(Math.abs(fewMult - manyMult) / manyMult).toBeLessThan(0.05);
    });
  });

  describe('appearance threshold scaling', () => {
    it('player below threshold gets dampened bonus', () => {
      const below = makePlayer({ position: 'ST', goals: 5, appearances: 4, form: 70 });
      const above = makePlayer({ position: 'ST', goals: 5, appearances: PERFORMANCE_APPEARANCE_THRESHOLD, form: 70 });
      // Same raw stats but below threshold should get smaller multiplier
      // (not exact comparison since per-game rates differ)
      const belowMult = getPerformanceMultiplier(below, 6);
      const aboveMult = getPerformanceMultiplier(above, 10);
      expect(belowMult).toBeLessThan(aboveMult);
    });

    it('0 appearances returns exactly 1.0 even with high form', () => {
      const p = makePlayer({ form: 95, appearances: 0 });
      expect(getPerformanceMultiplier(p, 10)).toBe(1);
    });
  });

  describe('form premium', () => {
    it('form above 50 increases multiplier', () => {
      const base = makePlayer({ appearances: 20, form: 50 });
      const hot = makePlayer({ appearances: 20, form: 85 });
      expect(getPerformanceMultiplier(hot, 22)).toBeGreaterThan(getPerformanceMultiplier(base, 22));
    });

    it('form below 50 gives no bonus', () => {
      const cold = makePlayer({ appearances: 20, form: 30 });
      const neutral = makePlayer({ appearances: 20, form: 50 });
      expect(getPerformanceMultiplier(cold, 22)).toBe(getPerformanceMultiplier(neutral, 22));
    });

    it('form exactly 50 gives no form contribution', () => {
      const p = makePlayer({ appearances: 20, form: 50 });
      expect(getPerformanceMultiplier(p, 22)).toBe(1);
    });
  });

  describe('max multiplier cap', () => {
    it('extreme stats are capped at PERFORMANCE_MAX_MULTIPLIER', () => {
      const monster = makePlayer({
        position: 'ST', goals: 35, assists: 20, appearances: 30, form: 99,
      });
      const mult = getPerformanceMultiplier(monster, 32);
      expect(mult).toBe(PERFORMANCE_MAX_MULTIPLIER);
    });

    it('multiplier never exceeds cap', () => {
      const extreme = makePlayer({
        position: 'ST', goals: 50, assists: 30, appearances: 20, form: 100,
      });
      expect(getPerformanceMultiplier(extreme, 40)).toBeLessThanOrEqual(PERFORMANCE_MAX_MULTIPLIER);
    });
  });
});

describe('getContractLengthFactor', () => {
  it('returns 0.75 for 1 year remaining', () => {
    expect(getContractLengthFactor(2, 1)).toBe(0.75);
  });

  it('returns 0.90 for 2 years remaining', () => {
    expect(getContractLengthFactor(3, 1)).toBe(0.90);
  });

  it('returns 1.0 for 3+ years remaining', () => {
    expect(getContractLengthFactor(4, 1)).toBe(1.0);
    expect(getContractLengthFactor(6, 1)).toBe(1.0);
  });

  it('returns 0.75 for contract ending this season', () => {
    expect(getContractLengthFactor(5, 5)).toBe(0.75);
  });

  it('handles expired contracts (end < current)', () => {
    expect(getContractLengthFactor(1, 3)).toBe(0.75);
  });
});
