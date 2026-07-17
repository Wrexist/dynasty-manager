/**
 * Endless Progression Pack — tiered lifetime achievements.
 *
 * Covers the high-ceiling achievements added to keep long-run careers moving:
 * career wins, league titles, seasons managed, continental hauls, treble
 * variants and pack devotion. All are computed from existing state only.
 */
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS } from '@/utils/achievements';
import type { GameState } from '@/store/storeTypes';
import type { SeasonHistory } from '@/types/game';

function season(overrides: Partial<SeasonHistory>): SeasonHistory {
  return {
    season: 1, position: 10, points: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, topScorer: { name: '', goals: 0 },
    boardVerdict: 'acceptable', ...overrides,
  } as SeasonHistory;
}

function mkState(overrides: Partial<GameState>): GameState {
  return {
    managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
    seasonHistory: [],
    season: 1,
    openedPacks: [],
    ...overrides,
  } as unknown as GameState;
}

function ach(id: string) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) throw new Error(`missing achievement ${id}`);
  return a;
}

describe('endless achievements — career wins', () => {
  it('unlocks at 100/250/500 win thresholds', () => {
    expect(ach('wins-100').check(mkState({ managerStats: { totalWins: 99 } as never }))).toBe(false);
    expect(ach('wins-100').check(mkState({ managerStats: { totalWins: 100 } as never }))).toBe(true);
    expect(ach('wins-250').check(mkState({ managerStats: { totalWins: 250 } as never }))).toBe(true);
    expect(ach('wins-500').check(mkState({ managerStats: { totalWins: 499 } as never }))).toBe(false);
    expect(ach('wins-500').check(mkState({ managerStats: { totalWins: 500 } as never }))).toBe(true);
  });

  it('progress caps at the target', () => {
    const p = ach('wins-250').progress!(mkState({ managerStats: { totalWins: 1000 } as never }));
    expect(p).toEqual({ current: 250, target: 250 });
  });
});

describe('endless achievements — league titles', () => {
  const titles = (n: number) => mkState({ seasonHistory: Array.from({ length: n }, () => season({ position: 1 })) });

  it('counts titles across history for 3/5/10', () => {
    expect(ach('titles-3').check(titles(2))).toBe(false);
    expect(ach('titles-3').check(titles(3))).toBe(true);
    expect(ach('titles-5').check(titles(5))).toBe(true);
    expect(ach('titles-10').check(titles(9))).toBe(false);
    expect(ach('titles-10').check(titles(10))).toBe(true);
  });
});

describe('endless achievements — seasons managed', () => {
  it('counts completed season records for 25/50', () => {
    const seasons = (n: number) => mkState({ seasonHistory: Array.from({ length: n }, () => season({})) });
    expect(ach('seasons-25').check(seasons(24))).toBe(false);
    expect(ach('seasons-25').check(seasons(25))).toBe(true);
    expect(ach('seasons-50').check(seasons(50))).toBe(true);
  });
});

describe('endless achievements — continental & trebles', () => {
  it('champions-cup-3 requires 3 Champions Cup wins', () => {
    const wins = (n: number) => mkState({ seasonHistory: Array.from({ length: n }, () => season({ championsCupResult: 'Winner' })) });
    expect(ach('champions-cup-3').check(wins(2))).toBe(false);
    expect(ach('champions-cup-3').check(wins(3))).toBe(true);
  });

  it('continental-collector requires all three continental cups', () => {
    const partial = mkState({ seasonHistory: [
      season({ championsCupResult: 'Winner' }),
      season({ shieldCupResult: 'Winner' }),
    ] });
    expect(ach('continental-collector').check(partial)).toBe(false);
    const full = mkState({ seasonHistory: [
      season({ championsCupResult: 'Winner' }),
      season({ shieldCupResult: 'Winner' }),
      season({ conferenceCupResult: 'Winner' }),
    ] });
    expect(ach('continental-collector').check(full)).toBe(true);
  });

  it('domestic-treble requires league + cup + league cup in ONE season', () => {
    const split = mkState({ seasonHistory: [
      season({ position: 1, cupResult: 'Winner' }),
      season({ leagueCupResult: 'Winner' }),
    ] });
    expect(ach('domestic-treble').check(split)).toBe(false);
    const oneSeason = mkState({ seasonHistory: [
      season({ position: 1, cupResult: 'Winner', leagueCupResult: 'Winner' }),
    ] });
    expect(ach('domestic-treble').check(oneSeason)).toBe(true);
  });

  it('double-treble requires two continental-treble seasons', () => {
    const one = mkState({ seasonHistory: [season({ position: 1, cupResult: 'Winner', championsCupResult: 'Winner' })] });
    expect(ach('double-treble').check(one)).toBe(false);
    const two = mkState({ seasonHistory: [
      season({ position: 1, cupResult: 'Winner', championsCupResult: 'Winner' }),
      season({ position: 1, cupResult: 'Winner', championsCupResult: 'Winner' }),
    ] });
    expect(ach('double-treble').check(two)).toBe(true);
  });

  it('three-peat requires three CONSECUTIVE titles', () => {
    const broken = mkState({ seasonHistory: [
      season({ position: 1 }), season({ position: 1 }), season({ position: 4 }), season({ position: 1 }),
    ] });
    expect(ach('three-peat').check(broken)).toBe(false);
    const streak = mkState({ seasonHistory: [
      season({ position: 4 }), season({ position: 1 }), season({ position: 1 }), season({ position: 1 }),
    ] });
    expect(ach('three-peat').check(streak)).toBe(true);
  });
});

describe('endless achievements — trophy haul & packs', () => {
  it('trophy-hoarder counts every trophy type', () => {
    // 5 seasons each with a title + domestic cup + champions cup = 15 trophies.
    const fifteen = mkState({ seasonHistory: Array.from({ length: 5 }, () =>
      season({ position: 1, cupResult: 'Winner', championsCupResult: 'Winner' })) });
    expect(ach('trophy-hoarder').check(fifteen)).toBe(false);
    const twenty = mkState({ seasonHistory: Array.from({ length: 5 }, () =>
      season({ position: 1, cupResult: 'Winner', championsCupResult: 'Winner', shieldCupResult: 'Winner' })) });
    expect(ach('trophy-hoarder').check(twenty)).toBe(true);
  });

  it('pack-whale unlocks at 100 packs', () => {
    expect(ach('pack-whale').check(mkState({ openedPacks: new Array(99).fill({}) as never }))).toBe(false);
    expect(ach('pack-whale').check(mkState({ openedPacks: new Array(100).fill({}) as never }))).toBe(true);
  });
});

describe('endless achievements — uniqueness', () => {
  it('every achievement id is unique', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
