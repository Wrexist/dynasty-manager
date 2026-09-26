/**
 * Every simulated division plays its whole season inside the user's season
 * (audit 2026-09-25, S9).
 *
 * Measured before the fix on one seeded English save: at the end of the 38-week
 * Premier League season the Championship, League One and League Two each had 96
 * fixtures (their last 8 of 46 rounds) still unplayed — 17% of each season —
 * and `endSeason`'s catch-up resolved them with a strength-weighted random
 * scoreline and no player stats. Now the longer divisions play midweek double
 * rounds (`fitDivisionFixturesToSeason`), so the catch-up has nothing to do.
 *
 * A full season of simulation — listed in SLOW_SUITES (vitest.config.ts).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { catchUpUnplayedFixtures, pickAiMatchSquad } from '@/store/slices/orchestration/helpers';
import { FORFEIT_SCORE } from '@/config/gameBalance';
import { tick } from '@/test/helpers/eventLoop';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const realRandom = Math.random;

describe('a full English season completes every division on the user\'s calendar', () => {
  afterEach(() => { Math.random = realRandom; });

  it('leaves nothing for the season-end catch-up and every table shows a full season', { timeout: 300_000 }, async () => {
    Math.random = mulberry32(12345);
    const store = useGameStore;
    store.getState().resetGame();
    localStorage.clear();
    await store.getState().initGame('manchester-city');
    store.setState({ settings: { ...store.getState().settings, autoSave: false } });

    const totalWeeks = store.getState().totalWeeks;
    expect(totalWeeks).toBe(38);
    // The lower tiers really are scheduled over more weeks than the season has.
    const initial = store.getState();
    expect(Math.max(...initial.divisionFixtures['eng-2'].map(m => m.week))).toBe(46);

    for (let w = 0; w < totalWeeks; w++) {
      store.getState().playCurrentMatch();
      await store.getState().advanceWeek();
      await tick();
    }

    const s = store.getState();
    expect(s.week).toBe(totalWeeks + 1);
    for (const [leagueId, fixtures] of Object.entries(s.divisionFixtures)) {
      const unplayed = fixtures.filter(m => !m.played);
      expect(unplayed.length, `${leagueId}: unplayed fixtures at season end`).toBe(0);
      expect(Math.max(...fixtures.map(m => m.week)), `${leagueId}: scheduled past the season`).toBeLessThanOrEqual(totalWeeks);
    }

    // The catch-up endSeason runs first finds nothing to resolve.
    const settled = catchUpUnplayedFixtures(
      { ...s.divisionFixtures, [s.playerDivision]: s.fixtures },
      s.clubs, s.players, s.week, pickAiMatchSquad, FORFEIT_SCORE,
    );
    expect(settled.mutated).toBe(false);

    // Every club in every division has played a full season.
    for (const [leagueId, table] of Object.entries(s.divisionTables)) {
      // Double round-robin: 2(n-1) games each (an odd league's byes included).
      const full = 2 * (s.divisionClubs[leagueId].length - 1);
      for (const row of table) expect(row.played, `${leagueId} ${row.clubId}`).toBe(full);
    }
    expect(s.divisionTables['eng-2'][0].played).toBe(46);

    // Rollover still works off the completed tables.
    store.getState().endSeason();
    expect(store.getState().season).toBe(2);
  });
});
