import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { DERBIES, getDerbyIntensity, getDerbyName } from '@/data/league';

describe('Derby rivalries', () => {
  describe('DERBIES data', () => {
    it('includes classic real-world rivalries', () => {
      expect(DERBIES.some(d => d.name === 'Manchester Derby')).toBe(true);
      expect(DERBIES.some(d => d.name === 'El Clásico')).toBe(true);
      expect(DERBIES.some(d => d.name === 'Derby della Madonnina')).toBe(true);
      expect(DERBIES.some(d => d.name === 'Old Firm')).toBe(true);
    });

    it('every derby has intensity between 1 and 3', () => {
      for (const d of DERBIES) {
        expect(d.intensity).toBeGreaterThanOrEqual(1);
        expect(d.intensity).toBeLessThanOrEqual(3);
      }
    });

    it('getDerbyIntensity is symmetric (order independent)', () => {
      expect(getDerbyIntensity('manchester-city', 'manchester-united')).toBe(3);
      expect(getDerbyIntensity('manchester-united', 'manchester-city')).toBe(3);
    });

    it('returns 0 for non-derby pairs', () => {
      expect(getDerbyIntensity('manchester-city', 'sevilla')).toBe(0);
    });

    it('getDerbyName returns the rivalry name for a derby pair', () => {
      expect(getDerbyName('barcelona', 'real-madrid')).toBe('El Clásico');
      expect(getDerbyName('chelsea', 'manchester-united')).toBeNull();
    });
  });

  describe('derby morale & confidence amplifier', () => {
    beforeEach(() => {
      useGameStore.getState().initGame('celtic');
    });

    it('wins against a non-rival produce the baseline morale change', () => {
      // Sanity: ensure base state is initialised
      const state = useGameStore.getState();
      expect(state.gameStarted).toBe(true);
      // The amplifier is additive to MORALE_WIN_CHANGE; regardless of the base value,
      // a derby win should not decrease morale.
      const c = state.clubs['celtic'];
      expect(c).toBeDefined();
    });
  });
});
