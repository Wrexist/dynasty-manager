import { describe, it, expect } from 'vitest';
import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';

describe('Youth Academy', () => {
  describe('generateYouthProspects', () => {
    it('should generate the correct number of prospects', () => {
      const { prospects, players } = generateYouthProspects('club-1', 5, 5, 1, 3);
      expect(prospects).toHaveLength(3);
      expect(players).toHaveLength(3);
    });

    it('should generate young players (16-18)', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 5);
      for (const p of players) {
        expect(p.age).toBeGreaterThanOrEqual(16);
        expect(p.age).toBeLessThanOrEqual(18);
      }
    });

    it('should mark all players as youth academy products', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 5);
      for (const p of players) {
        expect(p.isFromYouthAcademy).toBe(true);
      }
    });

    it('should generate higher quality with better youth rating and coach', () => {
      const lowQuality = generateYouthProspects('club-1', 1, 0, 1, 20);
      const highQuality = generateYouthProspects('club-1', 10, 10, 1, 20);

      const avgLow = lowQuality.players.reduce((s, p) => s + p.overall, 0) / lowQuality.players.length;
      const avgHigh = highQuality.players.reduce((s, p) => s + p.overall, 0) / highQuality.players.length;

      expect(avgHigh).toBeGreaterThan(avgLow);
    });

    it('should ensure potential >= overall for youth players', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 10);
      for (const p of players) {
        expect(p.potential).toBeGreaterThanOrEqual(p.overall);
      }
    });

    it('should assign valid positions', () => {
      const validPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 10);
      for (const p of players) {
        expect(validPositions).toContain(p.position);
      }
    });
  });

  describe('generateIntakePreview', () => {
    it('should generate at least 1 preview', () => {
      const previews = generateIntakePreview(5);
      expect(previews.length).toBeGreaterThanOrEqual(1);
    });

    it('should have valid positions and potential values', () => {
      const validPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
      const previews = generateIntakePreview(5);
      for (const p of previews) {
        expect(validPositions).toContain(p.position);
        expect(p.estimatedPotential).toBeGreaterThan(0);
      }
    });
  });
});
