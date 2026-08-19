/**
 * Sunday League balance — measurement as a gate.
 *
 * Every band here was set by running the sweep in this file's history and
 * reading the numbers, not by intuition. The point of asserting them is that a
 * future "small" tuning change to `config/sundayLeague.ts` (or to the shared
 * engine) that silently turns Sunday football into 1-0 chess, makes one tactic
 * strictly dominant, or bankrupts every managed club, fails HERE with the
 * measurement in the failure message — instead of shipping.
 *
 * Bands are deliberately wide: this is a tripwire for regressions an order of
 * magnitude out, not a lock on the second decimal place.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import type { SundayClubPersonalityId, SundayTacticId } from '@/types/game';

interface SeasonResult {
  ppg: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  leagueGoalsPerGame: number;
  playerGoalsPerGame: number;
  folded: boolean;
  balance: number;
  availabilityShare: number;
}

/** One season on auto-pilot with basic active management. */
async function runSeason(seed: number, personality: SundayClubPersonalityId, tactic: SundayTacticId): Promise<SeasonResult> {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality, seed });
  await useGameStore.getState().setSundayTactic(tactic);
  const total = sundaySeasonWeeks(useGameStore.getState().sunday!.divisionId);

  let availSamples = 0;
  let availSum = 0;
  for (let i = 0; i < total + 2; i++) {
    const s = useGameStore.getState();
    if (s.sunday!.folded || s.sunday!.seasonComplete) break;
    if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
    for (const o of useGameStore.getState().sunday!.sponsorOffers) {
      await useGameStore.getState().acceptSundaySponsor(o.id);
    }
    if (useGameStore.getState().sunday!.balance < 120) await useGameStore.getState().runSundayFundraiser();
    const sq = useGameStore.getState().sunday!.squad;
    availSum += sq.filter(m => m.availability.status !== 'out').length / Math.max(1, sq.length);
    availSamples++;
    await useGameStore.getState().advanceWeek();
  }

  const end = useGameStore.getState();
  const st = end.sunday!.seasonStats;
  const played = Math.max(1, st.played);
  let leagueGoals = 0;
  let leagueMatches = 0;
  for (const m of end.fixtures) {
    if (!m.played) continue;
    leagueGoals += m.homeGoals + m.awayGoals;
    leagueMatches++;
  }
  return {
    ppg: (st.won * 3 + st.drawn) / played,
    goalsForPerGame: st.goalsFor / played,
    goalsAgainstPerGame: st.goalsAgainst / played,
    leagueGoalsPerGame: leagueGoals / Math.max(1, leagueMatches),
    playerGoalsPerGame: (st.goalsFor + st.goalsAgainst) / played,
    folded: end.sunday!.folded,
    balance: end.sunday!.balance,
    availabilityShare: availSum / Math.max(1, availSamples),
  };
}

const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);

describe('sunday balance bands', () => {
  it('produces Sunday scorelines, viable clubs and honest availability', async () => {
    const results: SeasonResult[] = [];
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      results.push(await runSeason(seed, 'pub', 'route-one'));
    }
    const league = avg(results.map(r => r.leagueGoalsPerGame));
    const own = avg(results.map(r => r.playerGoalsPerGame));
    const availability = avg(results.map(r => r.availabilityShare));
    const folded = results.filter(r => r.folded).length;
    const detail = `league=${league.toFixed(2)} own=${own.toFixed(2)} avail=${availability.toFixed(2)} folded=${folded}/6`;

    // Sunday football, not professional chess: ~3 goals a game either side of
    // the whole division. RE-MEASURED after the wave-5 economy pass (6 seasons,
    // pub/Route One): 3.17 and 3.13 on two runs of this exact case — unmoved,
    // which is the point: nothing in the economy may touch the football.
    expect(league, detail).toBeGreaterThan(2.4);
    expect(league, detail).toBeLessThan(4.2);
    // The player's own (engine-simulated) matches and the AI model's league
    // must describe the same sport, or the table stops being comparable with
    // the club's record. RE-MEASURED gap: 0.39 and 0.24.
    expect(Math.abs(own - league), detail).toBeLessThan(1.3);
    // Availability bites without being a lottery. RE-MEASURED: 0.78 and 0.80,
    // after `SUNDAY_AVAIL_PER_HAPPINESS` doubled to 0.004 — the coupling to
    // the dressing room got twice as steep and the POPULATION average barely
    // moved, which is exactly the intended shape: happy squads turn out more,
    // unhappy ones much less, and the mean is unchanged.
    expect(availability, detail).toBeGreaterThan(0.70);
    expect(availability, detail).toBeLessThan(0.92);
    // An actively-managed ordinary club survives its first season nearly always.
    expect(folded, detail).toBeLessThanOrEqual(1);
  }, 600_000);

  it('offers four tactics and no strictly dominant one', async () => {
    const tactics: SundayTacticId[] = ['route-one', 'park-the-bus', 'chaos-ball', 'proper-football'];
    const ppgByTactic = new Map<SundayTacticId, number>();
    const varianceByTactic = new Map<SundayTacticId, number>();
    for (const tactic of tactics) {
      const runs: SeasonResult[] = [];
      for (const seed of [21, 22, 23, 24, 25, 26, 27, 28]) {
        runs.push(await runSeason(seed, 'pub', tactic));
      }
      ppgByTactic.set(tactic, avg(runs.map(r => r.ppg)));
      varianceByTactic.set(tactic, avg(runs.map(r => r.goalsForPerGame + r.goalsAgainstPerGame)));
    }
    const values = [...ppgByTactic.values()];
    const detail = [...ppgByTactic.entries()].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');

    // Every tactic must be playable, and none an automatic win.
    // RE-MEASURED after wave 5 (8 seasons per tactic, two runs of this case):
    //   route-one 1.61 / 1.39 · park-the-bus 1.29 / 1.39
    //   chaos-ball 1.60 / 1.32 · proper-football 1.51 / 1.22
    // The run-to-run spread on a single tactic is up to 0.29, which is what a
    // 14-match season looks like as an estimator; the bands are sized for it.
    for (const v of values) {
      expect(v, detail).toBeGreaterThan(0.7);
      expect(v, detail).toBeLessThan(2.2);
    }
    // Best-to-worst spread. RE-MEASURED 0.32 and 0.17 here; 0.278 in the
    // offline sweep (8 squad shapes x 4 tactics x 1,400 matches), which is the
    // number to trust — a 14-match season is a noisy estimator and the band is
    // sized for that noise, not for the true spread.
    expect(Math.max(...values) - Math.min(...values), detail).toBeLessThan(0.85);
    // PARK THE BUS IS NOT A TRAP. It used to be: hardcoded Route One opposition
    // meant the AI collected an all-out-attack matchup bonus against it that the
    // manager could never answer, and it stacked narrow + slow + a pressing
    // intensity of 25 on top, all of which are volume penalties in the shared
    // engine. The audit measured it 0.24-0.33 ppg behind every other tactic in
    // every squad shape. RE-MEASURED after wave 5: 0.28 behind and 0.08 AHEAD
    // of the mean of the other three on two runs here, 0.185 behind in the
    // offline sweep. The band is 3 SD of
    // this case's own sampling noise (SD ~0.14 on the gap at 8 seasons), so it
    // catches a return to "structural loser" without flagging a quiet week.
    const bus = ppgByTactic.get('park-the-bus')!;
    const pack = [...ppgByTactic.entries()].filter(([k]) => k !== 'park-the-bus').map(([, v]) => v);
    const gap = bus - pack.reduce((a, b) => a + b, 0) / pack.length;
    expect(gap, `${detail} | bus vs pack ${gap.toFixed(2)}`).toBeGreaterThan(-0.55);
    // Chaos Ball's identity is variance, and since `varianceMult` was wired to
    // the level tilt it is a mechanical property rather than a claim on a card:
    // each side's tactic scales its own shooting bonus and marking penalty.
    // RE-MEASURED total goals per match: chaos-ball 5.09 / 4.95 against
    // park-the-bus 2.67 / 3.04 — a gap of 2.42 and 1.91.
    const busy = varianceByTactic.get('chaos-ball')! - varianceByTactic.get('park-the-bus')!;
    expect(busy, `${detail} | chaos-bus goals ${busy.toFixed(2)}`).toBeGreaterThan(0.7);
  }, 600_000);

  it('separates the personalities without making any unplayable', async () => {
    const picks: SundayClubPersonalityId[] = ['washed', 'family', 'eleven', 'serious'];
    const ppg = new Map<SundayClubPersonalityId, number>();
    const folded: string[] = [];
    for (const p of picks) {
      const runs: SeasonResult[] = [];
      for (const seed of [31, 32, 33, 34, 35, 36, 37, 38]) {
        runs.push(await runSeason(seed, p, 'route-one'));
      }
      ppg.set(p, avg(runs.map(r => r.ppg)));
      folded.push(`${p}=${runs.filter(r => r.folded).length}/8`);
    }
    const detail = [...ppg.entries()].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ') + ' | folded ' + folded.join(' ');

    // Washed Professionals are better at football than the Family Club — that
    // is their entire premise — but nobody is hopeless and nobody walks it.
    //
    // THE SAMPLE WAS RAISED FROM FIVE SEASONS TO EIGHT in wave 7, because at
    // five it was a noisy estimator sitting near a band. MEASURED at five
    // seasons over eight runs of this case: washed 1.97-2.47, family 1.39-1.96,
    // eleven 1.33-1.86, serious 2.24-2.47 — a run-to-run range of half a point
    // per game on a single personality. MEASURED at eight seasons over five
    // runs: washed 2.20-2.32, family 1.32-1.58, eleven 1.56-1.82, serious
    // 1.99-2.29. The range on `washed` fell from 0.50 to 0.12, which is what
    // three extra seasons buys and why the extra ~1.5s of wall clock is worth
    // paying.
    //
    // The upper band of 2.75 now sits 0.43 above the highest value observed in
    // thirteen runs; 2.75 ppg is a side winning nine games in ten. The lower
    // band of 0.4 is not a close call and is not meant to be — the lowest
    // personality mean ever measured here is 1.32, and 0.4 is the level at
    // which a personality has stopped being able to win a football match.
    expect(ppg.get('washed')!, detail).toBeGreaterThan(ppg.get('family')!);
    for (const v of ppg.values()) {
      expect(v, detail).toBeGreaterThan(0.4);
      expect(v, detail).toBeLessThan(2.75);
    }
    // Hard-mode picks may fold sometimes; a managed club folding EVERY run
    // means the difficulty is a trap, not a challenge. MEASURED: 0/8 folds for
    // all four personalities on every one of the five runs above.
    for (const f of folded) {
      expect(f, detail).not.toContain('8/8');
    }
  }, 600_000);
});
