/**
 * Fast, seeded smoke check for the real-save match calibration (audit S6).
 *
 * The full check is `matchCalibration.test.ts` — three seasons of the real game
 * loop, ~60 s, in SLOW_SUITES. This one keeps the per-commit gate honest in a
 * few seconds: REAL clubs and squads from a fresh save, the exact inputs
 * `advanceWeek` gives an AI-vs-AI fixture (position-aware XI and bench,
 * counter-tactics, derby intensity, season), and every player at FORM_NEUTRAL —
 * the equilibrium the season now settles at. The cloned 70/75-rated squads in
 * `matchBalance` / `matchRealism` cannot see any of that.
 *
 * Measured on this seed: before 2.07 goals, 29.8% draws, 40.5% home wins,
 * 16.2% 0-0 (the weather tax alone took ~30% of the goals); after 2.58, 25.5%,
 * 44.8%, 9.0%. Both cases fail on the old engine.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { simulateMatch } from '@/engine/match';
import { pickAiMatchSquad } from '@/store/slices/orchestration/helpers';
import { getAICounterTactics } from '@/config/aiManager';
import { getDerbyIntensity } from '@/data/league';
import { FORM_NEUTRAL } from '@/config/gameBalance';
import type { Match, MatchWeather, Player } from '@/types/game';
import { addResult, emptySample, fmtRates, mulberry32, rates } from './helpers/matchCalibration';

const DIVISIONS = ['eng', 'eng-2', 'eng-3', 'eng-4', 'esp'];
const PER_DIVISION = 120;

describe('match calibration smoke (real squads, fresh save)', () => {
  const originalRandom = Math.random;
  let players: Record<string, Player> = {};

  beforeAll(async () => {
    Math.random = mulberry32(0x5EED);
    await useGameStore.getState().initGame('arsenal');
    players = Object.fromEntries(
      Object.entries(useGameStore.getState().players).map(([id, p]) => [id, { ...p, form: FORM_NEUTRAL }]),
    );
  }, 120_000);

  afterAll(() => { Math.random = originalRandom; });

  /** One AI-vs-AI fixture between two random clubs of `div`, with exactly the
   *  inputs `advanceWeek` passes. */
  function playFixture(div: string, i: number, weather?: MatchWeather) {
    const st = useGameStore.getState();
    const ids = st.divisionClubs[div];
    const h = ids[Math.floor(Math.random() * ids.length)];
    let a = ids[Math.floor(Math.random() * ids.length)];
    while (a === h) a = ids[Math.floor(Math.random() * ids.length)];
    const hc = st.clubs[h];
    const ac = st.clubs[a];
    const hs = pickAiMatchSquad(hc, players, 1);
    const as = pickAiMatchSquad(ac, players, 1);
    const hp = hc.aiManagerProfile;
    const ap = ac.aiManagerProfile;
    const ht = hp && ap ? getAICounterTactics(hp, ap.defaultTactics, ac.formation) : undefined;
    const at = hp && ap ? getAICounterTactics(ap, hp.defaultTactics, hc.formation) : undefined;
    const m: Match = { id: `smoke-${div}-${i}`, week: 1, homeClubId: h, awayClubId: a, played: false, homeGoals: 0, awayGoals: 0, events: [] };
    return simulateMatch(m, hc, ac, hs.xi, as.xi, ht, at, undefined, undefined, getDerbyIntensity(h, a), undefined, st.season, undefined, hs.bench, as.bench, weather).result;
  }

  it('scores, draws and favours the home side like league football', () => {
    Math.random = mulberry32(0xC0DE);
    const s = emptySample();
    for (const div of DIVISIONS) {
      for (let i = 0; i < PER_DIVISION; i++) {
        const r = playFixture(div, i);
        addResult(s, r.homeGoals, r.awayGoals);
      }
    }
    const r = rates(s);
    const tag = fmtRates(r);
    // Bands are the real-football envelope plus this sample's noise (n=600:
    // SE ~0.07 goals, ~1.8pp draws, ~2pp home). A fresh save's squads score a
    // little under a running season's (the harness measures ~2.7).
    expect(r.goalsPerMatch, tag).toBeGreaterThanOrEqual(2.4);
    expect(r.goalsPerMatch, tag).toBeLessThanOrEqual(3.1);
    expect(r.drawRate, tag).toBeGreaterThanOrEqual(0.19);
    expect(r.drawRate, tag).toBeLessThanOrEqual(0.30);
    expect(r.homeWinRate, tag).toBeGreaterThanOrEqual(0.39);
    expect(r.homeWinRate, tag).toBeLessThanOrEqual(0.51);
    expect(r.nilNilRate, tag).toBeLessThanOrEqual(0.12);
  });

  it('bad weather trims scoring rather than cancelling it', () => {
    // Snow used to subtract 0.22 from a per-shot chance worth ~0.2, clamping it
    // to the floor: open-play scoring stopped and the match was penalties,
    // corners and keeper errors. It is now a 22% relative tax.
    const run = (weather: MatchWeather) => {
      Math.random = mulberry32(0xF00D);
      const s = emptySample();
      for (let i = 0; i < 240; i++) {
        const r = playFixture(DIVISIONS[i % DIVISIONS.length], i, weather);
        addResult(s, r.homeGoals, r.awayGoals);
      }
      return rates(s).goalsPerMatch;
    };
    const clear = run({ weather: 'clear', pitch: 'good' });
    const snow = run({ weather: 'snow', pitch: 'good' });
    // Measured clear 2.78 / snow 2.53 (0.91). Old engine: 2.83 / 0.79 (0.28).
    expect(snow / clear, `clear ${clear.toFixed(2)} snow ${snow.toFixed(2)}`).toBeGreaterThan(0.65);
    expect(snow).toBeLessThan(clear);
  });
});
