/**
 * Penalty shootout helper tests.
 *
 * Covers the two correctness guarantees the helper enforces:
 *   1. Early termination when the trailing team can no longer catch up.
 *   2. Final score arithmetic — kicks[last].homeTotal / awayTotal match.
 *   3. Sudden death runs until divergence.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { simulatePenaltyShootout, getClubGKQuality } from '@/utils/penaltyShootout';
import { CUP_PENALTY_KICKS } from '@/config/gameBalance';

afterEach(() => { vi.restoreAllMocks(); });

describe('simulatePenaltyShootout', () => {
  it('terminates early when home is mathematically ahead', () => {
    // Force every home kick to score, every away kick to miss.
    let call = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      // The kick formula: Math.random() > (oppGK * 0.15 + (1 - 0.76))
      // We want home to always score and away to always miss.
      // Pattern alternates H, A, H, A, ...
      const isHome = call % 2 === 0;
      call++;
      return isHome ? 0.99 : 0.01; // home: high (scores); away: low (misses)
    });
    const r = simulatePenaltyShootout({
      homeName: 'A', awayName: 'B',
      homeGKQuality: 0.5, awayGKQuality: 0.5,
    });
    // After 3 home goals + 2 away misses (5 kicks total), home leads 3-0 with
    // away holding 3 unused kicks. Still alive. After kick 6 (away miss), home
    // leads 3-0, away has 2 left — still alive (3 > 2 is true but home has 2
    // remaining vs away 2 remaining, lead is 3 > 2 ⇒ DECIDED).
    // Actually math: after 6 kicks, home: 3 kicks, away: 3 kicks taken. Lead 3.
    // Away remaining = 5-3 = 2, 3 > 2 ⇒ done. So 6 kicks total.
    expect(r.kicks.length).toBe(6);
    expect(r.homeScore).toBe(3);
    expect(r.awayScore).toBe(0);
    expect(r.winner).toBe('home');
  });

  it('runs the full 10 kicks when the result needs them', () => {
    // Alternate scored/missed so the score remains close.
    let n = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      n++;
      // 4-4 after regulation, then sudden death decides.
      // Pattern: H-score, A-score, H-miss, A-miss, H-score, A-score, H-score, A-score, H-score, A-score
      // → home 4, away 4 after 10 → sudden death
      if (n <= 2) return 0.99; // both score (1-1)
      if (n <= 4) return 0.01; // both miss (1-1 still after 4)
      if (n <= 10) return 0.99; // both score (4-4 after 10)
      // Sudden death: home scores, away misses
      if (n % 2 === 1) return 0.99; // home scores in SD
      return 0.01; // away misses
    });
    const r = simulatePenaltyShootout({
      homeName: 'A', awayName: 'B',
      homeGKQuality: 0.5, awayGKQuality: 0.5,
    });
    // 10 regulation + 2 sudden death = 12 kicks
    expect(r.kicks.length).toBeGreaterThanOrEqual(10);
    expect(r.winner).toBe('home');
    // Final running totals are consistent
    const last = r.kicks[r.kicks.length - 1];
    expect(last.homeTotal).toBe(r.homeScore);
    expect(last.awayTotal).toBe(r.awayScore);
  });

  it('never produces a tied final score', () => {
    // Loose stochastic check: across 100 runs with real RNG, every result decides.
    for (let i = 0; i < 100; i++) {
      const r = simulatePenaltyShootout({
        homeName: 'A', awayName: 'B',
        homeGKQuality: 0.5, awayGKQuality: 0.5,
      });
      expect(r.homeScore).not.toBe(r.awayScore);
      expect(r.kicks.length).toBeGreaterThan(0);
      // Total scores match the per-kick running totals
      const lastH = r.kicks[r.kicks.length - 1].homeTotal;
      const lastA = r.kicks[r.kicks.length - 1].awayTotal;
      expect(lastH).toBe(r.homeScore);
      expect(lastA).toBe(r.awayScore);
    }
  });

  it('kick.round increments correctly (paired)', () => {
    const r = simulatePenaltyShootout({
      homeName: 'A', awayName: 'B',
      homeGKQuality: 0.5, awayGKQuality: 0.5,
    });
    // Round numbers should be monotonically non-decreasing
    for (let i = 1; i < r.kicks.length; i++) {
      expect(r.kicks[i].round).toBeGreaterThanOrEqual(r.kicks[i - 1].round);
    }
    // Within regulation, each round has exactly two kicks
    const inReg = r.kicks.filter(k => k.round <= CUP_PENALTY_KICKS);
    // Could be fewer if terminated early, but never more than 2 per round
    const perRound: Record<number, number> = {};
    for (const k of inReg) perRound[k.round] = (perRound[k.round] || 0) + 1;
    for (const round of Object.keys(perRound)) {
      expect(perRound[+round]).toBeLessThanOrEqual(2);
    }
  });
});

describe('getClubGKQuality', () => {
  it('returns 0.5 fallback when no club is provided', () => {
    expect(getClubGKQuality(undefined, {})).toBe(0.5);
  });

  it('returns 0.5 fallback when no GK is on the roster', () => {
    const club = { id: 'c', lineup: ['p1'], playerIds: ['p1'] } as never;
    const players = { p1: { id: 'p1', position: 'CB', attributes: { defending: 80, mental: 80 } } } as never;
    expect(getClubGKQuality(club, players)).toBe(0.5);
  });

  it('computes (defending + mental) / 200 for the GK in the lineup', () => {
    const club = { id: 'c', lineup: ['p1', 'p2'], playerIds: ['p1', 'p2'] } as never;
    const players = {
      p1: { id: 'p1', position: 'GK', attributes: { defending: 90, mental: 70 } },
      p2: { id: 'p2', position: 'CB', attributes: { defending: 80, mental: 80 } },
    } as never;
    expect(getClubGKQuality(club, players)).toBe(0.8); // (90+70)/200
  });

  it('falls back to playerIds when the lineup is empty', () => {
    const club = { id: 'c', lineup: [], playerIds: ['p1'] } as never;
    const players = {
      p1: { id: 'p1', position: 'GK', attributes: { defending: 60, mental: 60 } },
    } as never;
    expect(getClubGKQuality(club, players)).toBe(0.6);
  });
});
