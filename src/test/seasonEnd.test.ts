import { describe, it, expect } from 'vitest';
import { TOTAL_WEEKS, SPRING_PHASE_END_WEEK } from '@/config/gameBalance';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { GK_SAVE_BASE, GK_SAVE_RANGE } from '@/config/matchEngine';

describe('Season Config Consistency', () => {
  it('season phases are properly ordered', () => {
    expect(SUMMER_WINDOW_END).toBeLessThan(WINTER_WINDOW_START);
    expect(WINTER_WINDOW_START).toBeLessThan(WINTER_WINDOW_END);
    expect(WINTER_WINDOW_END).toBeLessThan(SPRING_PHASE_END_WEEK);
    expect(SPRING_PHASE_END_WEEK).toBeLessThan(TOTAL_WEEKS);
  });

  it('SPRING_PHASE_END_WEEK is within valid range', () => {
    expect(SPRING_PHASE_END_WEEK).toBeGreaterThan(WINTER_WINDOW_END);
    expect(SPRING_PHASE_END_WEEK).toBeLessThanOrEqual(TOTAL_WEEKS);
  });

  it('GK save config values are reasonable', () => {
    const minSave = GK_SAVE_BASE;
    const maxSave = GK_SAVE_BASE + GK_SAVE_RANGE;
    // GK save is one component — combined with other modifiers determines actual save rate
    expect(minSave).toBeGreaterThanOrEqual(0.15);
    expect(maxSave).toBeLessThanOrEqual(0.90);
    expect(GK_SAVE_RANGE).toBeGreaterThan(0);
  });

  it('TOTAL_WEEKS is set to a valid season length', () => {
    expect(TOTAL_WEEKS).toBeGreaterThanOrEqual(34);
    expect(TOTAL_WEEKS).toBeLessThanOrEqual(52);
  });
});
