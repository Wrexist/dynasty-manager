/**
 * A live match is simulated one minute at a time (FIRST/SECOND_HALF_SEGMENTS).
 * The commentary gap-filler — no more than COMMENTARY_GAP_MAX silent minutes —
 * must still work across those one-minute calls: each resumed segment used to
 * restart its silence counter at its own first minute, so the filler could
 * never fire and a live match could go quiet for long stretches.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { COMMENTARY_GAP_MAX, FIRST_HALF_SEGMENTS, SECOND_HALF_SEGMENTS } from '@/config/matchEngine';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;

function longestSilence(minutes: number[], from: number, to: number): number {
  const set = new Set(minutes);
  let run = 0;
  let best = 0;
  for (let m = from; m <= to; m++) {
    if (set.has(m)) run = 0; else { run++; best = Math.max(best, run); }
  }
  return best;
}

describe('commentary gaps across one-minute live segments', () => {
  afterEach(() => { Math.random = realRandom; });
  // The filler fires on the COMMENTARY_GAP_MAX-th quiet minute, so silence
  // tops out around there (a minute whose event roll came to nothing can add
  // one). Before the fix the live path went 5–8 minutes silent. Seeded, so
  // the check is exact rather than probabilistic.
  for (const [club, seed] of [['arsenal', 11], ['liverpool', 22], ['fulham', 33], ['brentford', 44]] as const) {
    it(`${club}: no silence longer than COMMENTARY_GAP_MAX minutes`, { timeout: 60_000 }, () => {
      Math.random = mulberry32(seed);
      useGameStore.getState().resetGame();
      useGameStore.getState().initGame(club);
      for (const m of FIRST_HALF_SEGMENTS) useGameStore.getState().playFirstHalf(m);
      let result = null;
      for (const m of SECOND_HALF_SEGMENTS) result = useGameStore.getState().playSecondHalf(m) ?? result;
      expect(result).toBeTruthy();
      const minutes = result.events.map(e => e.minute);
      expect(longestSilence(minutes, 1, 45)).toBeLessThanOrEqual(COMMENTARY_GAP_MAX);
      expect(longestSilence(minutes, 46, 90)).toBeLessThanOrEqual(COMMENTARY_GAP_MAX);
    });
  }
});
