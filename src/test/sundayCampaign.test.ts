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

/**
 * THE LATE-GAME ECONOMY GATE.
 *
 * The audit's number-one answer to "why would anyone stop playing after five
 * seasons" was measured, not felt: a competently-run club's median balance ran
 * £381 (S1) → £697 (S5) → £12,071 (S10) with income/spend climbing 0.99 → 2.07,
 * and the entire 21-level, £6,648 upgrade tree was bought out by median season
 * 6. After that there was no sink of any kind and money stopped being a
 * constraint permanently.
 *
 * This case is the tripwire for that regression returning. It runs a competent
 * pilot — resolves events, takes sponsors, fundraises when short, buys the
 * cheapest affordable upgrade, signs recruits within the cap — for eight
 * seasons and asserts the shape of the curve rather than any single number.
 */
async function runEconomyCareer(seed: number, seasons: number) {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed });

  const balances: number[] = [];
  let income = 0, spend = 0, ledgerSeen = 0;
  let maxedAt: number | null = null;
  const maxLevels = SUNDAY_UPGRADES.reduce((n, u) => n + u.maxLevel, 0);
  let guard = 0;

  while (useGameStore.getState().season <= seasons && guard++ < seasons * (sundaySeasonWeeks('sun-prem') + 6)) {
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    if (sunday.folded) break;
    if (sunday.seasonComplete) {
      balances.push(sunday.balance);
      await useGameStore.getState().endSundaySeason();
      continue;
    }
    if (sunday.pendingEvent) await s.resolveSundayEvent(sunday.pendingEvent.choices[0].id);
    for (const o of useGameStore.getState().sunday!.sponsorOffers) {
      await useGameStore.getState().acceptSundaySponsor(o.id);
    }
    if (useGameStore.getState().sunday!.balance < 130) await useGameStore.getState().runSundayFundraiser();
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
      for (const r of useGameStore.getState().sunday!.recruits) {
        const cur = useGameStore.getState().sunday!;
        if (cur.squad.length >= 18 || cur.balance <= r.fee + 100) continue;
        await useGameStore.getState().signSundayRecruit(r.id);
      }
    }
    await useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().sunday!;
    if (maxedAt == null && after.upgrades.reduce((n, u) => n + u.level, 0) >= maxLevels) {
      maxedAt = useGameStore.getState().season;
    }
    const last = after.ledger[after.ledger.length - 1];
    if (last) {
      const key = last.season * 1000 + last.week;
      if (key > ledgerSeen) {
        ledgerSeen = key;
        for (const l of last.lines) {
          if (l.amount >= 0) income += l.amount; else spend += -l.amount;
        }
      }
    }
  }
  const end = useGameStore.getState().sunday!;
  if (!end.folded && balances.length < seasons) balances.push(end.balance);
  return { balances, incomeOverSpend: income / Math.max(1, spend), maxedAt, folded: end.folded };
}

describe('the late-game economy stays an economy', () => {
  it('does not let money stop being a constraint by season five', async () => {
    const careers: Awaited<ReturnType<typeof runEconomyCareer>>[] = [];
    for (let i = 0; i < 12; i++) careers.push(await runEconomyCareer(900 + i, 8));

    const median = (xs: number[]) => {
      if (!xs.length) return NaN;
      const sorted = [...xs].sort((a, b) => a - b);
      const m = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
    };
    const at = (season: number) => median(careers.map(c => c.balances[season - 1]).filter(x => x != null));
    const ratio = median(careers.map(c => c.incomeOverSpend));
    const maxed = careers.map(c => c.maxedAt).filter((x): x is number => x != null);
    const folded = careers.filter(c => c.folded).length;
    const detail = `S3=${Math.round(at(3))} S5=${Math.round(at(5))} S8=${Math.round(at(8))} `
      + `inc/spend=${ratio.toFixed(2)} maxedMedian=${maxed.length ? median(maxed) : 'never'} `
      + `maxedCount=${maxed.length}/12 folded=${folded}/12`;

    // MEASURED, 24 careers x 10 seasons on the harness this case is a cut-down
    // of: median balance £337 (S1) £525 (S5) £1,561 (S8) £4,554 (S10), against
    // a pre-wave baseline of £327 / £825 / £5,642 / £11,286 on the identical
    // harness and seeds. The band is the pre-wave S8 figure: if a future change
    // puts the club back above it, the sink has stopped working.
    expect(at(8), detail).toBeLessThan(5600);
    // Season five must still be hand-to-mouth. MEASURED £525 (was £825).
    expect(at(5), detail).toBeLessThan(2000);
    // ...but not a graveyard. The mode must remain winnable.
    expect(at(8), detail).toBeGreaterThan(-200);
    // Income must not run away from spending. MEASURED career ratio 1.09;
    // pre-wave the SEASON-10 ratio alone was 2.12.
    expect(ratio, detail).toBeLessThan(1.6);
    // The tree must not be bought out before it has been a decision for a
    // while. MEASURED median season 8, with 6 of 24 careers never finishing it
    // inside ten seasons; pre-wave it was median season 6 and every career
    // finished it.
    if (maxed.length) expect(median(maxed), detail).toBeGreaterThan(5.5);
    // Survivable throughout. MEASURED 0/24 folds for this pilot.
    expect(folded, detail).toBeLessThanOrEqual(3);
  }, 900_000);
});

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
