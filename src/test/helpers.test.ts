import { describe, it, expect } from 'vitest';
import { pick, clamp, getSuffix, shuffle } from '@/utils/helpers';

describe('helpers', () => {
  describe('pick', () => {
    it('returns an element from the array', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = pick(arr);
      expect(arr).toContain(result);
    });

    it('throws when called with empty array', () => {
      expect(() => pick([])).toThrow('pick() called with empty array');
    });

    it('returns the only element from single-element array', () => {
      expect(pick([42])).toBe(42);
    });
  });

  describe('shuffle', () => {
    it('returns empty array for empty input', () => {
      expect(shuffle([])).toEqual([]);
    });

    it('returns array with same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffle(arr);
      expect(result).toHaveLength(arr.length);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('does not mutate original array', () => {
      const arr = [1, 2, 3];
      const copy = [...arr];
      shuffle(arr);
      expect(arr).toEqual(copy);
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

    it('handles triple-digit teen numbers', () => {
      expect(getSuffix(111)).toBe('th');
      expect(getSuffix(112)).toBe('th');
      expect(getSuffix(113)).toBe('th');
    });

    it('handles zero', () => {
      expect(getSuffix(0)).toBe('th');
    });

    it('handles large numbers', () => {
      expect(getSuffix(101)).toBe('st');
      expect(getSuffix(102)).toBe('nd');
      expect(getSuffix(103)).toBe('rd');
    });
  });
});
