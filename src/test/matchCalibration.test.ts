/* eslint-disable no-console -- the calibration table is the point of this file */
/**
 * Match-engine calibration against REAL SAVES (audit S6).
 *
 * `matchRealism` / `matchBalance` run cloned, freshly generated squads with
 * both sides on `balanced`. They isolate the engine, and they were green while
 * real saves scored 1.4-2.1 goals a match with 28-41% draws and 30-42% home
 * wins, falling season on season. Nothing in those cells can see what the game
 * loop does to the engine's inputs: form, fitness, morale, the AI managers'
 * actual tactics, weather, benches.
 *
 * This runs the real loop — `initGame` for a real club with the community pack
 * (the default for a new save), then three full seasons of `advanceWeek` +
 * `playCurrentMatch` + `endSeason` — and measures every initialised division.
 *
 * Measured with this seed, AI-vs-AI fixtures across all eight divisions
 * (~3,100 a season), seasons 1 / 2 / 3:
 *   before  goals 2.00 / 1.89 / 1.71   draws 33.3 / 34.0 / 36.1%
 *           home 34.8 / 35.9 / 34.2%   0-0 18.9 / 19.6 / 22.9%
 *           AI form 25 / 22 / 19, the player's squad 100 / 91 / 99
 *   after   goals ~2.70-2.80 a season, draws ~24-25%, home ~43-46%, 0-0 ~7-9%,
 *           AI form ~47-51 — the table this prints has the exact run.
 * Every case below fails on the old code.
 *
 * What moved it, in order of size: the weather tax (rain took ~57% of every
 * chance, snow nearly all of it — now a relative multiplier), form ratcheting
 * down (now mean-reverting), AI managers ratcheting defensive (now drift back to
 * their style), home advantage 1.15 -> 1.35, and the other divisions' AI
 * fixtures running without benches.
 *
 * SLOW: ~60 s. Listed in SLOW_SUITES (vitest.config.ts); the per-commit gate
 * runs `matchCalibrationSmoke.test.ts` instead.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { LEAGUES } from '@/data/league';
import { tick } from './helpers/eventLoop';
import { addResult, emptySample, fmtRates, mergeSamples, mulberry32, rates, type ScoringSample, type ScoringRates } from './helpers/matchCalibration';

const CLUB_ID = 'arsenal';
const SEASONS = 3;
const SEED = 0xCA1B;

interface SeasonMeasure {
  season: number;
  byDivision: Record<string, ScoringSample>;
  all: ScoringRates;
  user: ScoringSample;
  /** AI-vs-AI fixtures in the player's division involving one of its top four
   *  AI clubs — the like-for-like comparison for a title-chasing player club. */
  eliteAi: ScoringSample;
  aiFormMean: number;
  userFormMean: number;
}

async function playSeason(): Promise<void> {
  const total = useGameStore.getState().totalWeeks;
  for (let w = 0; w < total + 8; w++) {
    const st = useGameStore.getState();
    if (st.week > total) break;
    await st.advanceWeek();
    useGameStore.getState().playCurrentMatch();
    if (w % 5 === 4) await tick();
  }
}

/** Measure BEFORE `endSeason`: the rollover fast-forwards any fixture the
 *  calendar never reached with a Poisson scoreline (`resolveCatchUpFixture`),
 *  which is not the engine and must not be counted as it. */
function measure(): SeasonMeasure {
  const st = useGameStore.getState();
  const byDivision: Record<string, ScoringSample> = {};
  const user = emptySample();
  const eliteAi = emptySample();
  const elite = new Set((st.divisionTables[st.playerDivision] ?? [])
    .filter(e => e.clubId !== st.playerClubId).slice(0, 4).map(e => e.clubId));
  for (const [div, fixtures] of Object.entries(st.divisionFixtures)) {
    byDivision[div] = emptySample();
    for (const f of fixtures) {
      if (!f.played) continue;
      if (f.homeClubId === st.playerClubId || f.awayClubId === st.playerClubId) { addResult(user, f.homeGoals, f.awayGoals); continue; }
      addResult(byDivision[div], f.homeGoals, f.awayGoals);
      if (div === st.playerDivision && (elite.has(f.homeClubId) || elite.has(f.awayClubId))) addResult(eliteAi, f.homeGoals, f.awayGoals);
    }
  }
  let aiForm = 0; let aiN = 0; let userForm = 0; let userN = 0;
  for (const ids of Object.values(st.divisionClubs)) {
    for (const cid of ids) {
      for (const pid of st.clubs[cid]?.playerIds ?? []) {
        const p = st.players[pid];
        if (!p || !p.appearances) continue;
        if (cid === st.playerClubId) { userForm += p.form; userN++; } else { aiForm += p.form; aiN++; }
      }
    }
  }
  return {
    season: st.season,
    byDivision,
    all: rates(mergeSamples(...Object.values(byDivision))),
    user,
    eliteAi,
    aiFormMean: aiForm / Math.max(1, aiN),
    userFormMean: userForm / Math.max(1, userN),
  };
}

describe('match calibration on a real save (3 seasons, community pack)', () => {
  const seasons: SeasonMeasure[] = [];
  const originalRandom = Math.random;

  beforeAll(async () => {
    Math.random = mulberry32(SEED);
    await useGameStore.getState().initGame(CLUB_ID, { communityPackEnabled: true });
    expect(useGameStore.getState().communityPackEnabled).toBe(true);
    for (let s = 0; s < SEASONS; s++) {
      await playSeason();
      seasons.push(measure());
      useGameStore.getState().endSeason();
      // A deferred promotion playoff parks the save until it is played.
      for (let guard = 0; guard < 6; guard++) {
        const st = useGameStore.getState();
        if (st.seasonPhase !== 'playoff' || !st.playoffState?.pendingMatch) break;
        useGameStore.getState().playCurrentMatch();
      }
      await tick();
    }
    const name = (id: string) => LEAGUES.find(l => l.id === id)?.shortName ?? id;
    for (const m of seasons) {
      console.log(`── season ${m.season}  (form: AI ${m.aiFormMean.toFixed(1)}, player's squad ${m.userFormMean.toFixed(1)})`);
      for (const [div, smp] of Object.entries(m.byDivision)) console.log(`  ${name(div).padEnd(16)} ${fmtRates(rates(smp))}`);
      console.log(`  ${'ALL AI'.padEnd(16)} ${fmtRates(m.all)}`);
      console.log(`  ${'player\'s club'.padEnd(16)} ${fmtRates(rates(m.user))}`);
      console.log(`  ${'top-4 AI (div)'.padEnd(16)} ${fmtRates(rates(m.eliteAi))}`);
    }
  }, 900_000);

  afterAll(() => { Math.random = originalRandom; });

  it('lands in the real-football envelope, over the three seasons and in each', () => {
    // Real league football: ~2.6-2.9 goals, ~24-27% draws, ~43-46% home wins.
    // Measured over several runs of this seed (the loop is not bit-for-bit
    // deterministic — ids and some ordering are not seeded): 2.70-2.80 goals,
    // 23.7-25.3% draws, 42.4-46.5% home, 7.0-8.6% 0-0 per season.
    const total = rates(mergeSamples(...seasons.flatMap(m => Object.values(m.byDivision))));
    const tag = `3 seasons: ${fmtRates(total)}`;
    expect(total.goalsPerMatch, tag).toBeGreaterThanOrEqual(2.5);
    expect(total.goalsPerMatch, tag).toBeLessThanOrEqual(2.9);
    expect(total.drawRate, tag).toBeGreaterThanOrEqual(0.22);
    expect(total.drawRate, tag).toBeLessThanOrEqual(0.28);
    expect(total.homeWinRate, tag).toBeGreaterThanOrEqual(0.42);
    expect(total.homeWinRate, tag).toBeLessThanOrEqual(0.47);
    // Real ~7-8%. The weather tax put this at 15-23%.
    expect(total.nilNilRate, tag).toBeLessThanOrEqual(0.11);

    // A single season is ~3,100 matches (SE ~0.03 goals, ~0.8pp draws/home),
    // so each season gets the same bands plus a sampling margin.
    for (const m of seasons) {
      const st = `season ${m.season}: ${fmtRates(m.all)}`;
      expect(m.all.goalsPerMatch, st).toBeGreaterThanOrEqual(2.45);
      expect(m.all.goalsPerMatch, st).toBeLessThanOrEqual(2.95);
      expect(m.all.drawRate, st).toBeGreaterThanOrEqual(0.21);
      expect(m.all.drawRate, st).toBeLessThanOrEqual(0.29);
      expect(m.all.homeWinRate, st).toBeGreaterThanOrEqual(0.41);
      expect(m.all.homeWinRate, st).toBeLessThanOrEqual(0.48);
    }
  });

  it('keeps every division plausible, not just the average', () => {
    // A single division-season is ~300-450 matches, so the bands are wider
    // (SE ~0.09 goals, ~2.3pp draws). Real leagues genuinely differ: the top
    // flight here runs highest (the widest quality spread and the most
    // attacking managers), as the Bundesliga and Premier League do.
    for (const m of seasons) {
      for (const [div, smp] of Object.entries(m.byDivision)) {
        const r = rates(smp);
        const tag = `season ${m.season} ${div}: ${fmtRates(r)}`;
        expect(r.goalsPerMatch, tag).toBeGreaterThanOrEqual(2.2);
        expect(r.goalsPerMatch, tag).toBeLessThanOrEqual(3.5);
        expect(r.drawRate, tag).toBeGreaterThanOrEqual(0.15);
        expect(r.drawRate, tag).toBeLessThanOrEqual(0.34);
        expect(r.homeWinRate, tag).toBeGreaterThanOrEqual(0.36);
      }
    }
  });

  it('does not drift season on season', () => {
    // Before: 1.99 -> 1.78 goals over three seasons as form and AI tactics
    // ratcheted. Now both are mean-reverting.
    const first = seasons[0].all;
    const last = seasons[seasons.length - 1].all;
    expect(Math.abs(last.goalsPerMatch - first.goalsPerMatch)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(last.drawRate - first.drawRate)).toBeLessThanOrEqual(0.04);
    for (const m of seasons) {
      expect(m.aiFormMean, `season ${m.season} AI form`).toBeGreaterThan(40);
      expect(m.aiFormMean, `season ${m.season} AI form`).toBeLessThan(60);
    }
  });

  it('plays the player\'s own matches by the same rules as the AI\'s', () => {
    // The player's club is Arsenal, a title contender, so the fair comparison
    // is the AI's own title contenders: AI-vs-AI fixtures in the same division
    // involving one of its top four AI clubs. Before, the player's matches ran
    // ~3.0 goals with 11-19% draws while the AI around them scored ~2.2 with a
    // third drawn, and the player's squad form sat pinned near 97 against the
    // AI's 25 — two different sports in one league.
    const user = rates(mergeSamples(...seasons.map(m => m.user)));
    const elite = rates(mergeSamples(...seasons.map(m => m.eliteAi)));
    const tag = `player ${fmtRates(user)} | top-4 AI ${fmtRates(elite)}`;
    expect(Math.abs(user.goalsPerMatch - elite.goalsPerMatch), tag).toBeLessThanOrEqual(0.6);
    expect(Math.abs(user.drawRate - elite.drawRate), tag).toBeLessThanOrEqual(0.12);
  });
});
