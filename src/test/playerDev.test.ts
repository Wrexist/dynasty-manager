import { describe, it, expect } from 'vitest';
import { generatePlayer, calculateOverallExport as calculateOverall } from '@/utils/playerGen';

describe('playerDev', () => {
  describe('generatePlayer', () => {
    it('should generate a player with valid attributes', () => {
      const player = generatePlayer('ST', 75, 'club-1', 1);
      expect(player.id).toBeTruthy();
      expect(player.clubId).toBe('club-1');
      expect(player.position).toBe('ST');
      expect(player.overall).toBeGreaterThan(0);
      expect(player.age).toBeGreaterThanOrEqual(17);
      expect(player.age).toBeLessThanOrEqual(36);
    });

    it('should respect target overall approximately', () => {
      const players = Array.from({ length: 20 }, () => generatePlayer('CM', 75, 'c', 1));
      const avgOvr = players.reduce((sum, p) => sum + p.overall, 0) / players.length;
      expect(avgOvr).toBeGreaterThan(60);
      expect(avgOvr).toBeLessThan(90);
    });

    it('should set potential >= overall for young players', () => {
      const player = generatePlayer('CB', 70, 'c', 1);
      expect(player.potential).toBeGreaterThanOrEqual(player.overall);
    });
  });

  describe('calculateOverall', () => {
    it('should return a number between 1 and 99', () => {
      const ovr = calculateOverall({
        pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70,
      }, 'CM');
      expect(ovr).toBeGreaterThanOrEqual(1);
      expect(ovr).toBeLessThanOrEqual(99);
    });

    it('should weight defending higher for CB', () => {
      const attrs = { pace: 50, shooting: 50, passing: 50, defending: 90, physical: 70, mental: 70 };
      const cbOvr = calculateOverall(attrs, 'CB');
      const stOvr = calculateOverall(attrs, 'ST');
      expect(cbOvr).toBeGreaterThan(stOvr);
    });

    it('should weight shooting higher for ST', () => {
      const attrs = { pace: 70, shooting: 90, passing: 50, defending: 50, physical: 70, mental: 70 };
      const stOvr = calculateOverall(attrs, 'ST');
      const cbOvr = calculateOverall(attrs, 'CB');
      expect(stOvr).toBeGreaterThan(cbOvr);
    });
  });
});
