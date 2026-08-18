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
    // the whole division.
    expect(league, detail).toBeGreaterThan(2.2);
    expect(league, detail).toBeLessThan(4.8);
    // The player's own (engine-simulated) matches and the AI model's league
    // must describe the same sport, or the table stops being comparable with
    // the club's record.
    expect(Math.abs(own - league), detail).toBeLessThan(1.6);
    // Availability bites without being a lottery.
    expect(availability, detail).toBeGreaterThan(0.72);
    expect(availability, detail).toBeLessThan(0.99);
    // An actively-managed ordinary club survives its first season nearly always.
    expect(folded, detail).toBeLessThanOrEqual(1);
  }, 600_000);

  it('offers four tactics and no strictly dominant one', async () => {
    const tactics: SundayTacticId[] = ['route-one', 'park-the-bus', 'chaos-ball', 'proper-football'];
    const ppgByTactic = new Map<SundayTacticId, number>();
    const varianceByTactic = new Map<SundayTacticId, number>();
    for (const tactic of tactics) {
      const runs: SeasonResult[] = [];
      for (const seed of [21, 22, 23, 24]) {
        runs.push(await runSeason(seed, 'pub', tactic));
      }
      ppgByTactic.set(tactic, avg(runs.map(r => r.ppg)));
      varianceByTactic.set(tactic, avg(runs.map(r => r.goalsForPerGame + r.goalsAgainstPerGame)));
    }
    const values = [...ppgByTactic.values()];
    const detail = [...ppgByTactic.entries()].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');

    // Every tactic must be playable, and none an automatic win.
    for (const v of values) {
      expect(v, detail).toBeGreaterThan(0.55);
      expect(v, detail).toBeLessThan(2.5);
    }
    expect(Math.max(...values) - Math.min(...values), detail).toBeLessThan(1.1);
    // Chaos Ball's identity is variance: it must produce busier scorelines
    // than Park the Bus, or the trade-off it advertises is fiction.
    expect(varianceByTactic.get('chaos-ball')!, detail).toBeGreaterThan(varianceByTactic.get('park-the-bus')!);
  }, 600_000);

  it('separates the personalities without making any unplayable', async () => {
    const picks: SundayClubPersonalityId[] = ['washed', 'family', 'eleven', 'serious'];
    const ppg = new Map<SundayClubPersonalityId, number>();
    const folded: string[] = [];
    for (const p of picks) {
      const runs: SeasonResult[] = [];
      for (const seed of [31, 32, 33]) {
        runs.push(await runSeason(seed, p, 'route-one'));
      }
      ppg.set(p, avg(runs.map(r => r.ppg)));
      folded.push(`${p}=${runs.filter(r => r.folded).length}/3`);
    }
    const detail = [...ppg.entries()].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ') + ' | folded ' + folded.join(' ');

    // Washed Professionals are better at football than the Family Club — that
    // is their entire premise — but nobody is hopeless and nobody walks it.
    expect(ppg.get('washed')!, detail).toBeGreaterThan(ppg.get('family')!);
    for (const v of ppg.values()) {
      expect(v, detail).toBeGreaterThan(0.4);
      expect(v, detail).toBeLessThan(2.6);
    }
    // Hard-mode picks may fold sometimes; a managed club folding EVERY run
    // means the difficulty is a trap, not a challenge.
    for (const f of folded) {
      expect(f, detail).not.toContain('3/3');
    }
  }, 600_000);
});
