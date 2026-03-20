import { describe, it, expect } from 'vitest';
import { pick, clamp, getSuffix } from '@/utils/helpers';

describe('helpers', () => {
  describe('pick', () => {
    it('returns an element from the array', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = pick(arr);
      expect(arr).toContain(result);
    });
  });

  describe('clamp', () => {
    it('clamps values within default range', () => {
      expect(clamp(50)).toBe(50);
      expect(clamp(0)).toBe(1);
      expect(clamp(100)).toBe(99);
      expect(clamp(-10)).toBe(1);
    });

    it('clamps with custom range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('getSuffix', () => {
    it('returns correct ordinal suffixes', () => {
      expect(getSuffix(1)).toBe('st');
      expect(getSuffix(2)).toBe('nd');
      expect(getSuffix(3)).toBe('rd');
      expect(getSuffix(4)).toBe('th');
      expect(getSuffix(11)).toBe('th');
      expect(getSuffix(12)).toBe('th');
      expect(getSuffix(13)).toBe('th');
      expect(getSuffix(21)).toBe('st');
      expect(getSuffix(22)).toBe('nd');
      expect(getSuffix(23)).toBe('rd');
    });
  });
});
