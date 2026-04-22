/* eslint-disable no-console -- diagnostic perf reporting */
/**
 * Runtime Perf Baseline
 *
 * Measures three hot paths against the targets documented in
 * docs/perf-baseline.md:
 *   - match sim      target <50 ms
 *   - weekly tick    target <500 ms
 *   - initGame       target <3000 ms
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
import fs from 'node:fs';
import path from 'node:path';

const RUN = process.env.PERF_AUDIT === '1';
const TARGETS = { matchMs: 50, weeklyMs: 500, initGameMs: 3000 };
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
  return {
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
  } as Club;
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
    'measures initGame / simulateMatch / advanceWeek and writes docs/perf-baseline.json',
    { timeout: 300_000 },
    async () => {
      const results: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        targets: TARGETS,
      };

      // ── 1. initGame: 5 samples, fresh store each ───────────────────────
      const initSamples: number[] = [];
      for (let i = 0; i < 5; i++) {
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

      // ── 3. advanceWeek + playCurrentMatch: full season (46 weeks) ──────
      //    Uses the real game loop so timings include AI sims, injuries,
      //    transfer offers, training, development, messages, etc. Fresh
      //    game, fresh state.
      await useGameStore.getState().initGame(CLUB_ID);
      const weekSamples: number[] = [];
      const store = useGameStore;
      for (let w = 0; w < 46; w++) {
        const t0 = performance.now();
        await store.getState().advanceWeek();
        store.getState().playCurrentMatch();
        weekSamples.push(performance.now() - t0);
      }
      const weekStats = stats(weekSamples);
      results.weeklyTick = weekStats;
      console.log('[perf] weeklyTick', weekStats);

      // ── Verdict vs. targets ────────────────────────────────────────────
      const verdict = {
        matchMean: matchStats.mean <= TARGETS.matchMs ? 'pass' : matchStats.mean <= TARGETS.matchMs * 2 ? 'warn' : 'fail',
        matchP95: matchStats.p95 <= TARGETS.matchMs * 2 ? 'pass' : 'fail',
        weekMean: weekStats.mean <= TARGETS.weeklyMs ? 'pass' : weekStats.mean <= TARGETS.weeklyMs * 2 ? 'warn' : 'fail',
        weekP95: weekStats.p95 <= TARGETS.weeklyMs * 2 ? 'pass' : 'fail',
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
      expect(weekStats.n).toBe(46);
    },
  );
});
