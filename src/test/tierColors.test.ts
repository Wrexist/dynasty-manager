import { describe, it, expect } from 'vitest';
import { PLAYER_TIER_THRESHOLDS } from '@/config/ui';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

describe('PLAYER_TIER_THRESHOLDS palette separation', () => {
  const MIN_DISTANCE = 80;

  it('every tier has a mid-gradient color distinct from its neighbours', () => {
    for (let i = 0; i < PLAYER_TIER_THRESHOLDS.length - 1; i++) {
      const a = PLAYER_TIER_THRESHOLDS[i];
      const b = PLAYER_TIER_THRESHOLDS[i + 1];
      const d = rgbDistance(a.gradientVia, b.gradientVia);
      expect(
        d,
        `Tiers "${a.label}" (${a.gradientVia}) and "${b.label}" (${b.gradientVia}) are too similar (distance ${d.toFixed(1)} < ${MIN_DISTANCE})`,
      ).toBeGreaterThanOrEqual(MIN_DISTANCE);
    }
  });

  it('Legendary is clearly distinct from Gold (user-reported regression)', () => {
    const legendary = PLAYER_TIER_THRESHOLDS.find(t => t.key === 'legendary');
    const gold = PLAYER_TIER_THRESHOLDS.find(t => t.key === 'gold');
    expect(legendary).toBeDefined();
    expect(gold).toBeDefined();
    expect(rgbDistance(legendary!.gradientVia, gold!.gradientVia)).toBeGreaterThanOrEqual(100);
  });

  it('thresholds are ordered from highest to lowest and cover the full range', () => {
    const mins = PLAYER_TIER_THRESHOLDS.map(t => t.min);
    for (let i = 0; i < mins.length - 1; i++) {
      expect(mins[i]).toBeGreaterThan(mins[i + 1]);
    }
    expect(mins[mins.length - 1]).toBe(0);
  });
});
