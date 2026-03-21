import { describe, it, expect } from 'vitest';
import { calculateChemistryLinks, getChemistryBonus, getChemistryLabel, getMentorBonus } from '@/utils/chemistry';
import { generatePlayer } from '@/utils/playerGen';
import type { Position } from '@/types/game';

function makePlayer(pos: string, overrides: Record<string, unknown> = {}) {
  const p = generatePlayer(pos as Position, 75, 'club-1', 1);
  return { ...p, nationality: 'English', form: 70, ...overrides };
}

describe('chemistry', () => {
  describe('calculateChemistryLinks', () => {
    it('should detect nationality links', () => {
      const a = makePlayer('CM', { nationality: 'Spanish' });
      const b = makePlayer('CB', { nationality: 'Spanish' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.some(l => l.type === 'nationality')).toBe(true);
    });

    it('should not create nationality links for different nationalities', () => {
      const a = makePlayer('CM', { nationality: 'Spanish' });
      const b = makePlayer('CB', { nationality: 'French' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.filter(l => l.type === 'nationality')).toHaveLength(0);
    });

    it('should detect mentor links between senior and junior', () => {
      const senior = makePlayer('CB', { age: 30, overall: 80 });
      const junior = makePlayer('CB', { age: 19, overall: 60, nationality: 'French' });
      const links = calculateChemistryLinks([senior, junior]);
      expect(links.some(l => l.type === 'mentor')).toBe(true);
    });

    it('should not create mentor links between same-age players', () => {
      const a = makePlayer('CM', { age: 25, nationality: 'French' });
      const b = makePlayer('CM', { age: 25, nationality: 'German' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.filter(l => l.type === 'mentor')).toHaveLength(0);
    });

    it('should detect partnership links for adjacent positions with high form', () => {
      const a = makePlayer('CM', { form: 85, age: 25, nationality: 'French' });
      const b = makePlayer('CAM', { form: 85, age: 26, nationality: 'German' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.some(l => l.type === 'partnership')).toBe(true);
    });

    it('should allow multiple link types between the same pair', () => {
      const a = makePlayer('CM', { nationality: 'Spanish', form: 85, age: 25 });
      const b = makePlayer('CAM', { nationality: 'Spanish', form: 85, age: 25 });
      const links = calculateChemistryLinks([a, b]);
      expect(links.filter(l => l.type === 'nationality')).toHaveLength(1);
      expect(links.filter(l => l.type === 'partnership')).toHaveLength(1);
    });

    it('should return empty for a single player', () => {
      const links = calculateChemistryLinks([makePlayer('ST')]);
      expect(links).toHaveLength(0);
    });
  });

  describe('getChemistryBonus', () => {
    it('should return 0 for empty lineup', () => {
      expect(getChemistryBonus([])).toBe(0);
    });

    it('should return a positive bonus for linked players', () => {
      const players = [
        makePlayer('CM', { nationality: 'Spanish' }),
        makePlayer('CAM', { nationality: 'Spanish' }),
      ];
      const bonus = getChemistryBonus(players);
      expect(bonus).toBeGreaterThan(0);
    });

    it('should cap at maximum bonus', () => {
      // Create many same-nationality players
      const players = Array.from({ length: 11 }, (_, i) =>
        makePlayer(['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST'][i], { nationality: 'Spanish' })
      );
      const bonus = getChemistryBonus(players);
      expect(bonus).toBeLessThanOrEqual(0.08);
    });
  });

  describe('getChemistryLabel', () => {
    it('should return Excellent for high bonus', () => {
      expect(getChemistryLabel(0.07).label).toBe('Excellent');
    });

    it('should return Low for zero bonus', () => {
      expect(getChemistryLabel(0).label).toBe('Low');
    });
  });

  describe('getMentorBonus', () => {
    it('should return 0 for older players', () => {
      const player = makePlayer('CM', { age: 28 });
      expect(getMentorBonus(player, [player])).toBe(0);
    });

    it('should return positive bonus for young player with senior teammate', () => {
      const junior = makePlayer('CB', { age: 19, overall: 60, clubId: 'club-1', nationality: 'Brazilian' });
      const senior = makePlayer('CB', { age: 30, overall: 82, clubId: 'club-1', nationality: 'French' });
      const bonus = getMentorBonus(junior, [junior, senior]);
      expect(bonus).toBeGreaterThan(0);
    });
  });
});
