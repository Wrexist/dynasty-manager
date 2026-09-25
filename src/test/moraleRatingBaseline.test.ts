/**
 * An average match performance is morale-neutral (simfinish item 3).
 *
 * `processMatchResult` adds `(rating - RATING_MORALE_BASELINE) *
 * MORALE_PER_RATING_POINT` to every participant of the player's club. The
 * baseline was 7.0 while the engine's ratings average ~6.24 on real saves, so
 * the average player lost ~1.9 morale a match to that term alone.
 *
 * This measures the mean ENGINE rating over a real save — the real loop, every
 * rated participant of every simulated match (the player's and the AI's) — with
 * a fixed seed, and requires the baseline to sit on it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PlayerMatchRating } from '@/types/game';

const ratings = vi.hoisted(() => [] as number[]);

vi.mock('@/engine/match', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/engine/match')>();
  return {
    ...mod,
    simulateMatch: (...args: Parameters<typeof mod.simulateMatch>) => {
      const r = mod.simulateMatch(...args);
      for (const pr of r.playerRatings as PlayerMatchRating[]) ratings.push(pr.rating);
      return r;
    },
  };
});

import { useGameStore } from '@/store/gameStore';
import { RATING_MORALE_BASELINE } from '@/config/gameBalance';
import { mulberry32 } from './helpers/matchCalibration';
import { tick } from './helpers/eventLoop';

const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

describe('RATING_MORALE_BASELINE', () => {
  it('is the mean engine rating of a real save', async () => {
    Math.random = mulberry32(0x7A7E);
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('arsenal');
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, autoSave: false } });
    for (let w = 0; w < 8; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
      if (w % 4 === 3) await tick();
    }
    expect(ratings.length).toBeGreaterThan(5000);
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    // n > 5,000 at sd ~0.8: the mean is good to ~0.02; 0.1 leaves room for a
    // different week mix, not for a baseline 0.76 off (the old 7.0).
    expect(Math.abs(mean - RATING_MORALE_BASELINE), `measured mean ${mean.toFixed(3)}`).toBeLessThan(0.1);
  }, 300_000);
});
