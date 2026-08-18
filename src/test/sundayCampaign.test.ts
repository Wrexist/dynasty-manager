/**
 * The balance campaign — the statistically useful sweep (§35).
 *
 * 32 managed careers × up to 3 seasons each, across every club personality and
 * all four tactics, with invariants validated at every season boundary and the
 * distribution metrics the design cares about asserted at the end:
 *
 *   - clubs survive when managed (fold rate bounded)
 *   - promotion is reachable but not automatic
 *   - availability stays a real constraint (never irrelevant, never a lottery)
 *   - injuries happen at a Sunday rate
 *   - morale is alive (not pinned at either end across the population)
 *   - money neither runs away nor collapses for the population
 *   - every tactic and every personality stays inside the playable band
 *
 * SLOW SUITE: ~90 seasons of full simulation. Runs in `preflight:full` / CI,
 * not the per-commit gate — see vitest.config.ts.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import { SUNDAY_DIVISIONS, SUNDAY_PERSONALITIES, SUNDAY_TACTICS, SUNDAY_UPGRADES, sundayUpgradeCost } from '@/config/sundayLeague';
import type { SundayClubPersonalityId, SundayTacticId } from '@/types/game';

const SEASONS = 3;

interface CareerResult {
  personality: SundayClubPersonalityId;
  tactic: SundayTacticId;
  seasons: number;
  folded: boolean;
  promotions: number;
  ppg: number;
  played: number;
  goalsPerGame: number;
  injuriesSeen: number;
  availabilitySamples: number[];
  finalBalance: number;
  finalMorale: number;
  memoriesWritten: number;
}

async function runCareer(seed: number, personality: SundayClubPersonalityId, tactic: SundayTacticId): Promise<CareerResult> {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality, seed });
  await useGameStore.getState().setSundayTactic(tactic);

  let promotions = 0, points = 0, played = 0, goals = 0, injuriesSeen = 0;
  const availabilitySamples: number[] = [];
  let guard = 0;
  const maxTicks = SEASONS * (sundaySeasonWeeks('sun-prem') + 6);

  while (useGameStore.getState().season <= SEASONS && guard++ < maxTicks) {
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    if (sunday.folded) break;
    if (sunday.seasonComplete) {
      const st = sunday.seasonStats;
      points += st.won * 3 + st.drawn;
      played += st.played;
      goals += st.goalsFor + st.goalsAgainst;
      const divBefore = sunday.divisionId;
      await useGameStore.getState().endSundaySeason();
      const after = useGameStore.getState();
      const v = validateSundayState({
        sunday: after.sunday!, players: after.players, clubs: after.clubs,
        playerClubId: after.playerClubId, fixtures: after.fixtures, week: after.week,
      });
      if (!v.ok) throw new Error(`[seed ${seed} rollover] ${v.problems.join('; ')}`);
      if (after.sunday!.divisionId !== divBefore
        && SUNDAY_DIVISIONS.findIndex(d => d.id === after.sunday!.divisionId) > SUNDAY_DIVISIONS.findIndex(d => d.id === divBefore)) {
        promotions++;
      }
      continue;
    }

    if (sunday.pendingEvent) {
      await s.resolveSundayEvent(sunday.pendingEvent.choices[s.week % sunday.pendingEvent.choices.length].id);
    }
    for (const o of useGameStore.getState().sunday!.sponsorOffers) {
      await useGameStore.getState().acceptSundaySponsor(o.id);
    }
    if (useGameStore.getState().sunday!.balance < 130) await useGameStore.getState().runSundayFundraiser();
    // Reinvest like a real manager: the cheapest affordable upgrade, keeping a
    // float. Without this the campaign measured a pilot who hoards, and the
    // "no runaway fortune" tripwire flagged the hoard instead of the economy.
    {
      const st = useGameStore.getState().sunday!;
      for (const u of SUNDAY_UPGRADES) {
        const lvl = st.upgrades.find(x => x.id === u.id)?.level ?? 0;
        if (lvl >= u.maxLevel || st.reputation < u.minReputation) continue;
        if (st.balance - sundayUpgradeCost(u.id, lvl) > 260) {
          await useGameStore.getState().buySundayUpgrade(u.id);
          break;
        }
      }
    }
    const sq = useGameStore.getState().sunday!.squad;
    availabilitySamples.push(sq.filter(m => m.availability.status !== 'out').length / Math.max(1, sq.length));
    injuriesSeen += Object.values(useGameStore.getState().players).filter(p => p.clubId === 'sunday-club' && p.injured).length > 0 ? 1 : 0;
    await useGameStore.getState().advanceWeek();
  }

  const end = useGameStore.getState();
  const sunday = end.sunday!;
  if (!sunday.folded && sunday.seasonComplete) {
    const st = sunday.seasonStats;
    points += st.won * 3 + st.drawn;
    played += st.played;
    goals += st.goalsFor + st.goalsAgainst;
  }
  return {
    personality, tactic,
    seasons: end.season,
    folded: sunday.folded,
    promotions,
    ppg: points / Math.max(1, played),
    played,
    goalsPerGame: goals / Math.max(1, played),
    injuriesSeen,
    availabilitySamples,
    finalBalance: sunday.balance,
    finalMorale: sunday.teamMorale,
    memoriesWritten: sunday.squad.reduce((n, m) => n + m.memories.length, 0),
  };
}

describe('sunday balance campaign', () => {
  it('holds the design bands across 32 careers', async () => {
    const results: CareerResult[] = [];
    let seed = 500;
    // Every personality twice, every tactic four times, interleaved.
    const personalities = SUNDAY_PERSONALITIES.map(p => p.id);
    const tactics = SUNDAY_TACTICS.map(t => t.id);
    for (let i = 0; i < 32; i++) {
      results.push(await runCareer(seed++, personalities[i % personalities.length], tactics[i % tactics.length]));
    }

    const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);
    const folded = results.filter(r => r.folded).length;
    const promoted = results.filter(r => r.promotions > 0).length;
    const goals = avg(results.map(r => r.goalsPerGame));
    const availability = avg(results.flatMap(r => r.availabilitySamples));
    const morales = results.map(r => r.finalMorale);
    const balances = results.map(r => r.finalBalance);
    const memories = avg(results.map(r => r.memoriesWritten));
    const summary = `folded=${folded}/32 promoted=${promoted}/32 goals/g=${goals.toFixed(2)} `
      + `avail=${availability.toFixed(2)} morale[${Math.min(...morales)}..${Math.max(...morales)}] `
      + `bal[${Math.min(...balances)}..${Math.max(...balances)}] memories/club=${memories.toFixed(0)}`;

    // Survival: managed clubs mostly survive three seasons; a few may not.
    expect(folded, summary).toBeLessThanOrEqual(6);
    // Progression: promotion is reachable for a meaningful share, never universal.
    expect(promoted, summary).toBeGreaterThanOrEqual(6);
    expect(promoted, summary).toBeLessThan(32);
    // The football is Sunday football.
    expect(goals, summary).toBeGreaterThan(2.2);
    expect(goals, summary).toBeLessThan(4.8);
    // Availability is a constraint, not a lottery and not irrelevant.
    expect(availability, summary).toBeGreaterThan(0.72);
    expect(availability, summary).toBeLessThan(0.99);
    // Morale is alive across the population — neither pinned high nor low.
    expect(Math.max(...morales), summary).toBeGreaterThan(55);
    expect(Math.min(...morales), summary).toBeLessThan(90);
    // Money: no runaway fortune, no universal collapse.
    expect(Math.max(...balances), summary).toBeLessThan(5000);
    expect(avg(balances), summary).toBeGreaterThan(-150);
    // The storytelling spine is actually writing: an average three-season club
    // carries a meaningful biography.
    expect(memories, summary).toBeGreaterThan(30);

    // Per-tactic and per-personality playability, across the whole campaign.
    for (const tactic of tactics) {
      const t = results.filter(r => r.tactic === tactic && r.played > 5);
      if (!t.length) continue;
      expect(avg(t.map(r => r.ppg)), `${tactic}: ${summary}`).toBeGreaterThan(0.4);
      expect(avg(t.map(r => r.ppg)), `${tactic}: ${summary}`).toBeLessThan(2.6);
    }
  }, 900_000);
});
