/* eslint-disable no-console -- diagnostic perf reporting */
/**
 * Runtime Perf Baseline
 *
 * Measures the hot paths against the targets documented in
 * docs/perf-baseline.md:
 *   - match sim      target <50 ms
 *   - weekly tick    target <500 ms   (playCurrentMatch + advanceWeek)
 *   - endSeason      target <1000 ms
 *   - initGame       target <3000 ms
 *
 * The season loop is seeded (same world, same fixtures, same results on every
 * run) so before/after numbers compare the same work, and it runs TWO seasons:
 * season 2 is the steady state (continental football, ~5.3k players) and the
 * one the audit numbers describe.
 *
 * Gated behind PERF_AUDIT=1 so normal CI/dev runs stay quiet. Writes numbers
 * to docs/perf-baseline.json on success so docs/perf-baseline.md can be
 * regenerated deterministically.
 *
 *   PERF_AUDIT=1 npm test -- perf.test
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { simulateMatch } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import type { Club, Match } from '@/types/game';
import { tick } from '@/test/helpers/eventLoop';
import fs from 'node:fs';
import path from 'node:path';

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

const RUN = process.env.PERF_AUDIT === '1';
const TARGETS = { matchMs: 50, weeklyMs: 500, endSeasonMs: 1000, initGameMs: 3000 };
const SEASONS = 2;
const CLUB_ID = 'manchester-city';

interface Stats {
  n: number;
  total: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((a, b) => a + b, 0);
  return {
    n: samples.length,
    total,
    mean: total / samples.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    max: sorted[sorted.length - 1],
  };
}

function makeClub(id: string, name: string): Club {
  const club: Club = {
    id,
    name,
    shortName: name.slice(0, 3).toUpperCase(),
    color: '#fff',
    secondaryColor: '#000',
    budget: 50_000_000,
    wageBill: 200_000,
    reputation: 70,
    facilities: 5,
    youthRating: 5,
    fanBase: 5,
    boardPatience: 60,
    playerIds: [],
    formation: '4-3-3',
    lineup: [],
    subs: [],
    divisionId: 'eng',
  };
  return club;
}

function setupStandaloneMatch() {
  const home = makeClub('home', 'Home FC');
  const away = makeClub('away', 'Away FC');
  const homeSquad = generateSquad('home', 70, 1);
  const awaySquad = generateSquad('away', 70, 1);
  homeSquad.forEach(p => home.playerIds.push(p.id));
  awaySquad.forEach(p => away.playerIds.push(p.id));
  const { lineup: homeXI } = selectBestLineup(homeSquad, '4-3-3');
  const { lineup: awayXI } = selectBestLineup(awaySquad, '4-3-3');
  home.lineup = homeXI.map(p => p.id);
  away.lineup = awayXI.map(p => p.id);
  return { home, away, homeXI, awayXI };
}

describe.skipIf(!RUN)('Runtime perf baseline (PERF_AUDIT=1)', () => {
  it(
    'measures initGame / simulateMatch / advanceWeek / endSeason and writes docs/perf-baseline.json',
    { timeout: 600_000 },
    async () => {
      const results: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        targets: TARGETS,
      };

      // ── 1. initGame: 5 samples, fresh store each ───────────────────────
      //    resetGame() clears the full GameState before timing; otherwise
      //    each subsequent initGame runs on top of the prior game's state
      //    and measures a "reinit" rather than a "cold init".
      const initSamples: number[] = [];
      for (let i = 0; i < 5; i++) {
        useGameStore.getState().resetGame();
        const t0 = performance.now();
        await useGameStore.getState().initGame(CLUB_ID);
        initSamples.push(performance.now() - t0);
      }
      const initStats = stats(initSamples);
      results.initGame = initStats;
      console.log('[perf] initGame', initStats);

      // ── 2. simulateMatch standalone: 200 samples ───────────────────────
      //    Measures just the sim, no store side-effects. Squads are
      //    regenerated fresh per sample so player fatigue doesn't drift.
      const matchSamples: number[] = [];
      for (let i = 0; i < 200; i++) {
        const { home, away, homeXI, awayXI } = setupStandaloneMatch();
        const match: Match = {
          id: `perf-${i}`,
          week: 1,
          homeClubId: home.id,
          awayClubId: away.id,
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          events: [],
        };
        const t0 = performance.now();
        simulateMatch(match, home, away, homeXI, awayXI);
        matchSamples.push(performance.now() - t0);
      }
      const matchStats = stats(matchSamples);
      results.simulateMatch = matchStats;
      console.log('[perf] simulateMatch', matchStats);

      // ── 3. playCurrentMatch + advanceWeek, then endSeason: two seasons ──
      //    Uses the real game loop so timings include AI sims, injuries,
      //    transfer offers, training, development, messages, etc.
      //
      //    Order matches real gameplay: user plays their match at week W
      //    via playCurrentMatch(), then clicks "Advance" to sim AI for
      //    week W and move to week W+1. Doing it in the other order
      //    (advance-then-play) would leave the player's week-1 fixture
      //    orphaned as "unplayed" and skew the per-iteration cost.
      //
      //    The season is the club's OWN length (38 weeks for City). This used
      //    to loop 46 times, so the last 8 samples were empty post-season ticks
      //    that pulled the mean down. Autosave is off: the save is measured on
      //    its own path and is not part of the tick.
      const realRandom = Math.random;
      const cryptoApi = crypto as unknown as { randomUUID: () => string };
      const realUUID = cryptoApi.randomUUID;
      let uuidSeq = 0;
      Math.random = mulberry32(0x5EED);
      cryptoApi.randomUUID = () => `00000000-0000-4000-8000-${(uuidSeq++).toString(16).padStart(12, '0')}`;
      const store = useGameStore;
      store.getState().resetGame();
      await store.getState().initGame(CLUB_ID);
      store.setState({ settings: { ...store.getState().settings, autoSave: false } });
      const seasons: Record<string, unknown>[] = [];
      let lastWeek: Stats | null = null;
      let lastEnd = 0;
      try {
        for (let season = 1; season <= SEASONS; season++) {
          const seasonWeeks = store.getState().totalWeeks;
          const tickSamples: number[] = [];
          const advanceSamples: number[] = [];
          for (let w = 0; w < seasonWeeks; w++) {
            const t0 = performance.now();
            store.getState().playCurrentMatch();
            const t1 = performance.now();
            await store.getState().advanceWeek();
            const t2 = performance.now();
            tickSamples.push(t2 - t0);
            advanceSamples.push(t2 - t1);
            await tick();
          }
          const world = { clubs: Object.keys(store.getState().clubs).length, players: Object.keys(store.getState().players).length };
          const e0 = performance.now();
          store.getState().endSeason();
          const endSeasonMs = performance.now() - e0;
          const entry = { season, weeks: seasonWeeks, world, weeklyTick: stats(tickSamples), advanceWeek: stats(advanceSamples), endSeasonMs };
          seasons.push(entry);
          console.log('[perf] season', JSON.stringify(entry));
          lastWeek = entry.weeklyTick;
          lastEnd = endSeasonMs;
          await tick();
        }
      } finally {
        Math.random = realRandom;
        cryptoApi.randomUUID = realUUID;
      }
      results.seasons = seasons;
      const weekStats = lastWeek!;

      // ── Verdict vs. targets ────────────────────────────────────────────
      const verdict = {
        matchMean: matchStats.mean <= TARGETS.matchMs ? 'pass' : matchStats.mean <= TARGETS.matchMs * 2 ? 'warn' : 'fail',
        matchP95: matchStats.p95 <= TARGETS.matchMs * 2 ? 'pass' : 'fail',
        weekMean: weekStats.mean <= TARGETS.weeklyMs ? 'pass' : weekStats.mean <= TARGETS.weeklyMs * 2 ? 'warn' : 'fail',
        weekP95: weekStats.p95 <= TARGETS.weeklyMs * 2 ? 'pass' : 'fail',
        endSeason: lastEnd <= TARGETS.endSeasonMs ? 'pass' : lastEnd <= TARGETS.endSeasonMs * 2 ? 'warn' : 'fail',
        initGameMean: initStats.mean <= TARGETS.initGameMs ? 'pass' : initStats.mean <= TARGETS.initGameMs * 2 ? 'warn' : 'fail',
      };
      results.verdict = verdict;
      console.log('[perf] verdict', verdict);

      // ── Write JSON so docs can be regenerated ──────────────────────────
      const outPath = path.resolve('docs/perf-baseline.json');
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
      console.log(`[perf] wrote ${outPath}`);

      // ── Sanity gates (not strict — this is a baseline harness) ─────────
      expect(initStats.n).toBe(5);
      expect(matchStats.n).toBe(200);
      expect(seasons).toHaveLength(SEASONS);
      expect(weekStats.n).toBeGreaterThan(0);
    },
  );
});
