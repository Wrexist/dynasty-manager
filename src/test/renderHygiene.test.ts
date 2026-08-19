/* eslint-disable no-console -- diagnostic render-hygiene reporting */
/**
 * Render Hygiene Audit
 *
 * Measures how often the *page-level* Zustand selectors for the three key
 * screens (Dashboard, LeagueTable, SquadPage) would trigger a React re-render
 * across a full season. Uses `store.subscribe` + the same equality function
 * the page uses (shallow for multi-field shape, `Object.is` for scalars) to
 * count selector "change" events — this is the same signal React uses to
 * decide whether to re-render a component subscribed via `useGameStore`.
 *
 * Gated behind `PERF_AUDIT=1` so normal CI stays fast. Writes results to
 * `docs/render-hygiene.json`.
 *
 *   PERF_AUDIT=1 npx vitest run src/test/renderHygiene.test.ts
 */
import { describe, it, expect } from 'vitest';
import { useGameStore, type GameState } from '@/store/gameStore';
import fs from 'node:fs';
import path from 'node:path';

const RUN = process.env.PERF_AUDIT === '1';
const CLUB_ID = 'manchester-city';

/** Shallow equality on the shape `useShallow` compares. */
function shallow<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

interface Probe<T> {
  name: string;
  selector: (s: GameState) => T;
  eq: (a: T, b: T) => boolean;
  renders: number;
}

/** Mirrors Dashboard.tsx:116-142 — the useShallow hash that drives the
 *  dashboard page's re-render decision. */
function dashboardSelector(s: GameState) {
  return {
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    players: s.players,
    week: s.week,
    season: s.season,
    fixtures: s.fixtures,
    leagueTable: s.leagueTable,
    boardConfidence: s.boardConfidence,
    boardObjectives: s.boardObjectives,
    currentMatchResult: s.currentMatchResult,
    incomingOffers: s.incomingOffers,
    trainingFocus: s.trainingFocus,
    cup: s.cup,
    leagueCup: s.leagueCup,
    championsCup: s.championsCup,
    shieldCup: s.shieldCup,
    conferenceCup: s.conferenceCup,
    virtualClubs: s.virtualClubs,
    domesticSuperCup: s.domesticSuperCup,
    continentalSuperCup: s.continentalSuperCup,
    weekCliffhangers: s.weekCliffhangers,
    objectiveStreak: s.objectiveStreak,
    facilities: s.facilities,
    scouting: s.scouting,
    divisionTables: s.divisionTables,
    playerDivision: s.playerDivision,
    managerProgression: s.managerProgression,
    clubRecords: s.clubRecords,
    transferWindowOpen: s.transferWindowOpen,
    training: s.training,
    weeklyObjectives: s.weeklyObjectives,
    shortlist: s.shortlist,
    seasonPhase: s.seasonPhase,
    totalWeeks: s.totalWeeks,
    objectivesStartWeek: s.objectivesStartWeek,
    completedCoachTaskIds: s.completedCoachTaskIds,
    gameMode: s.gameMode,
    careerManager: s.careerManager,
    jobOffers: s.jobOffers,
    pendingPressConference: s.pendingPressConference,
    pendingStoryline: s.pendingStoryline,
    pendingTransferTalk: s.pendingTransferTalk,
    activeChallenge: s.activeChallenge,
    youthAcademy: s.youthAcademy,
    fanMood: s.fanMood,
    sessionStats: s.sessionStats,
    pendingAchievementIds: s.pendingAchievementIds,
    activeStorylineChains: s.activeStorylineChains,
    unlockedAchievements: s.unlockedAchievements,
    packPityCounter: s.packPityCounter || 0,
  };
}

/** Mirrors LeagueTable.tsx:32-42. */
function leagueTableSelector(s: GameState) {
  return {
    divisionTables: s.divisionTables,
    divisionFixtures: s.divisionFixtures,
    divisionClubs: s.divisionClubs,
    clubs: s.clubs,
    players: s.players,
    playerClubId: s.playerClubId,
    playerDivision: s.playerDivision,
    week: s.week,
    totalWeeks: s.totalWeeks,
  };
}

/** Mirrors SquadPage.tsx:82-85. */
function squadPageSelector(s: GameState) {
  return {
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    players: s.players,
    season: s.season,
    training: s.training,
  };
}

/** Tighter scalar-returning selector shapes (e.g. `usePlayerClub`). */
function playerClubRef(s: GameState) {
  return s.clubs[s.playerClubId];
}
function weekScalar(s: GameState) {
  return s.week;
}

describe.skipIf(!RUN)('Render hygiene (PERF_AUDIT=1)', () => {
  it(
    'counts selector "would re-render" events over a full season',
    { timeout: 300_000 },
    async () => {
      await useGameStore.getState().initGame(CLUB_ID);

      const probes: Probe<unknown>[] = [
        { name: 'Dashboard', selector: dashboardSelector, eq: shallow as (a: unknown, b: unknown) => boolean, renders: 0 },
        { name: 'LeagueTable', selector: leagueTableSelector, eq: shallow as (a: unknown, b: unknown) => boolean, renders: 0 },
        { name: 'SquadPage', selector: squadPageSelector, eq: shallow as (a: unknown, b: unknown) => boolean, renders: 0 },
        { name: 'usePlayerClub (scalar)', selector: playerClubRef, eq: Object.is, renders: 0 },
        { name: 'week (scalar)', selector: weekScalar, eq: Object.is, renders: 0 },
      ];

      const prev: unknown[] = probes.map(p => p.selector(useGameStore.getState()));

      const unsub = useGameStore.subscribe(state => {
        for (let i = 0; i < probes.length; i++) {
          const curr = probes[i].selector(state);
          if (!probes[i].eq(curr, prev[i])) {
            probes[i].renders++;
            prev[i] = curr;
          }
        }
      });

      // Run a full season (46 weeks + match plays)
      const weekRenders: Record<string, number[]> = Object.fromEntries(probes.map(p => [p.name, []]));
      for (let w = 0; w < 46; w++) {
        const before = probes.map(p => p.renders);
        await useGameStore.getState().advanceWeek();
        useGameStore.getState().playCurrentMatch();
        probes.forEach((p, i) => weekRenders[p.name].push(p.renders - before[i]));
      }

      unsub();

      // Summaries
      const results = {
        generatedAt: new Date().toISOString(),
        node: process.version,
        clubId: CLUB_ID,
        weeks: 46,
        perProbe: probes.map(p => {
          const perWeek = weekRenders[p.name];
          const total = p.renders;
          const mean = total / perWeek.length;
          const max = Math.max(...perWeek);
          return { name: p.name, total, mean, maxPerWeek: max };
        }),
      };

      console.log('[render-hygiene]', JSON.stringify(results, null, 2));

      const outPath = path.resolve('docs/render-hygiene.json');
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
      console.log(`[render-hygiene] wrote ${outPath}`);

      // Sanity — at minimum the week scalar must change 46 times.
      const weekProbe = results.perProbe.find(p => p.name === 'week (scalar)');
      expect(weekProbe?.total).toBeGreaterThanOrEqual(46);
    },
  );
});

/**
 * Always-on render-hygiene guards (run in normal CI, unlike the gated audit
 * above). These lock in the two cheap invariants that keep hot pages from
 * re-rendering on unrelated state churn.
 */
describe('Render hygiene — always-on guards', () => {
  // Pages/components that re-render most often and matter most for scroll/tap
  // smoothness. A bare `useGameStore()` or identity selector here would
  // subscribe the component to the ENTIRE store and re-render on every
  // mutation (match minute ticks, AI sims, etc.).
  const HOT_FILES = [
    'src/pages/Dashboard.tsx',
    'src/pages/SquadPage.tsx',
    'src/pages/TransferPage.tsx',
    'src/pages/LeagueTable.tsx',
    'src/components/game/BottomNav.tsx',
    'src/components/game/TopBar.tsx',
    'src/components/game/SubNav.tsx',
    // Sunday League. Its screens sit on the same store as everything else and
    // were never covered here, so the guard had a mode-shaped hole in it. They
    // matter for the same reason the elite pages do — MatchDay ticks a live
    // feed, the Hub is the mode's home, and the Teamsheet is a tap-heavy list —
    // and the immersion work about to land on them adds crests, kits and
    // portraits that re-render with whatever their host subscribes to.
    'src/pages/SundayHub.tsx',
    'src/pages/SundayTeamsheet.tsx',
    'src/pages/SundaySquad.tsx',
    'src/pages/SundayMatchDay.tsx',
    'src/pages/SundayTable.tsx',
    'src/pages/SundayClubhouse.tsx',
    'src/pages/SundayRecruit.tsx',
    'src/pages/SundayHistory.tsx',
  ];

  it('hot pages never subscribe to the whole store', () => {
    const offenders: string[] = [];
    for (const file of HOT_FILES) {
      const src = fs.readFileSync(path.resolve(file), 'utf8');
      // `useGameStore()` with no selector → whole-store subscription.
      if (/useGameStore\(\s*\)/.test(src)) offenders.push(`${file}: useGameStore() with no selector`);
      // Identity selector `useGameStore(s => s)` / `useGameStore((s) => s)` →
      // same trap. (Field selectors like `s => s.week` are fine.)
      if (/useGameStore\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\s*\)/.test(src)) {
        offenders.push(`${file}: identity selector useGameStore(s => s)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('SquadPage / LeagueTable selectors ignore unrelated state changes', async () => {
    await useGameStore.getState().initGame(CLUB_ID);
    const squadBefore = squadPageSelector(useGameStore.getState());
    const leagueBefore = leagueTableSelector(useGameStore.getState());
    const dashBefore = dashboardSelector(useGameStore.getState());

    // fanMood is watched by Dashboard but NOT by Squad/League. Mutating it
    // should re-render Dashboard only.
    useGameStore.setState({ fanMood: (useGameStore.getState().fanMood + 7) % 100 });
    const s = useGameStore.getState();

    expect(shallow(squadPageSelector(s), squadBefore)).toBe(true);
    expect(shallow(leagueTableSelector(s), leagueBefore)).toBe(true);
    expect(shallow(dashboardSelector(s), dashBefore)).toBe(false);
  });
});
