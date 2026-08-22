/**
 * The balance campaign — the statistically useful sweep (§35).
 *
 * 48 managed careers × 5 seasons each — 240 seasons, roughly 3,800 matches —
 * across all thirty-two (personality × tactic) combinations, with invariants
 * validated at every season boundary and the distribution metrics the design
 * cares about asserted at the end:
 *
 *   - clubs survive when managed (fold rate bounded)
 *   - the pyramid is climbable but its top is not a formality
 *   - availability stays a real constraint (never irrelevant, never a lottery)
 *   - injuries happen at a Sunday rate
 *   - morale is alive (not pinned at either end across the population)
 *   - money neither runs away nor collapses for the population
 *   - every tactic and every personality stays inside the playable band
 *
 * WHAT THE WAVE-7 EXPANSION FOUND, recorded because it is the most useful
 * number in the file. The campaign's pilot did not sign anybody: it answered
 * events, took sponsors, fundraised and bought upgrades, but never replaced a
 * retirement. Over three seasons that was invisible. Over FIVE it folded 13 and
 * 14 of 48 clubs — three of them literally unable to register a side — with the
 * mean at 1.18 ppg and every single fold in Division Four. Adding one line of
 * recruitment inside the season cap took the fold rate to 0-1 of 48 and the
 * mean to 1.50. Recruitment is load-bearing, and a manager who never signs
 * anyone is playing a materially harder game. That is a design result, not a
 * test artefact — but it is not what this case is FOR, so the pilot here is now
 * a competent one and the bands are measured against it.
 *
 * SLOW SUITE: 240 seasons of full simulation plus the eight-season economy
 * sweep. Measured 28-31s. Runs in `preflight:full` / CI, not the per-commit
 * gate — see vitest.config.ts.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import { SUNDAY_DIVISIONS, SUNDAY_PERSONALITIES, SUNDAY_TACTICS, SUNDAY_UPGRADES, sundayUpgradeCost } from '@/config/sundayLeague';
import type { SundayClubPersonalityId, SundayTacticId } from '@/types/game';
import { tick } from './helpers/eventLoop';

const SEASONS = 5;

interface CareerResult {
  personality: SundayClubPersonalityId;
  tactic: SundayTacticId;
  seasons: number;
  folded: boolean;
  promotions: number;
  relegations: number;
  ppg: number;
  played: number;
  goalsPerGame: number;
  injuriesSeen: number;
  availabilitySamples: number[];
  finalBalance: number;
  finalMorale: number;
  memoriesWritten: number;
  foldSeason: number;
  foldDivision: string;
  foldReason: string | null;
  finalDivision: string;
}

async function runCareer(seed: number, personality: SundayClubPersonalityId, tactic: SundayTacticId): Promise<CareerResult> {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality, seed });
  await useGameStore.getState().setSundayTactic(tactic);

  let promotions = 0, relegations = 0, points = 0, played = 0, goals = 0, injuriesSeen = 0;
  const availabilitySamples: number[] = [];
  let guard = 0;
  const maxTicks = SEASONS * (sundaySeasonWeeks('sun-prem') + 6);

  while (useGameStore.getState().season <= SEASONS && guard++ < maxTicks) {
    // One macrotask yield per simulated week. Both harnesses in this file are
    // driven from a SINGLE `it()` — 48 careers here, 12 eight-season careers
    // below — so without this the test body runs for minutes without the event
    // loop ever reaching the timer phase, and birpc's hardcoded 60 s
    // `onTaskUpdate` deadline expires mid-test. See `helpers/eventLoop.ts`.
    await tick();
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
      if (after.sunday!.divisionId !== divBefore) {
        const moved = SUNDAY_DIVISIONS.findIndex(d => d.id === after.sunday!.divisionId)
          - SUNDAY_DIVISIONS.findIndex(d => d.id === divBefore);
        if (moved > 0) promotions++; else if (moved < 0) relegations++;
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
    // Sign within the cap. The campaign's pilot used not to recruit AT ALL,
    // which is not "a manager who does not micro-manage", it is a manager who
    // never replaces a retirement: over five seasons the squad thinned out and
    // three of the folds it measured were "not enough players to register a
    // side". A pilot that cannot field eleven is measuring itself, not the
    // mode. Same rule as the stress harness.
    {
      const st = useGameStore.getState().sunday!;
      const r = st.recruits[0];
      if (r && st.squad.length < 18 && st.balance > r.fee + 150) {
        await useGameStore.getState().signSundayRecruit(r.id);
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
    relegations,
    ppg: points / Math.max(1, played),
    played,
    goalsPerGame: goals / Math.max(1, played),
    injuriesSeen,
    availabilitySamples,
    finalBalance: sunday.balance,
    finalMorale: sunday.teamMorale,
    memoriesWritten: sunday.squad.reduce((n, m) => n + m.memories.length, 0),
    foldSeason: sunday.folded ? end.season : 0,
    foldDivision: sunday.folded ? sunday.divisionId : '',
    foldReason: sunday.foldReason ?? null,
    finalDivision: sunday.divisionId,
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
    await tick();
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
  it('holds the design bands across 48 careers', async () => {
    const results: CareerResult[] = [];
    let seed = 500;
    // THE FULL CROSS-PRODUCT, which the 32-career version never sampled.
    // Pairing on `i % 8` and `i % 4` walks only eight of the thirty-two
    // (personality, tactic) combinations and repeats each six times, so a
    // tactic that is a disaster for one particular side was invisible. Stepping
    // the tactic once per block of eight covers all thirty-two, with sixteen
    // careers of extra depth on the first two tactics.
    const personalities = SUNDAY_PERSONALITIES.map(p => p.id);
    const tactics = SUNDAY_TACTICS.map(t => t.id);
    for (let i = 0; i < 48; i++) {
      results.push(await runCareer(
        seed++,
        personalities[i % personalities.length],
        tactics[Math.floor(i / personalities.length) % tactics.length],
      ));
    }

    const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);
    const folded = results.filter(r => r.folded).length;
    const promoted = results.filter(r => r.promotions > 0).length;
    const relegated = results.filter(r => r.relegations > 0).length;
    const goals = avg(results.map(r => r.goalsPerGame));
    const availability = avg(results.flatMap(r => r.availabilitySamples));
    const ppgs = results.map(r => r.ppg);
    const morales = results.map(r => r.finalMorale);
    const balances = results.map(r => r.finalBalance);
    const memories = avg(results.map(r => r.memoriesWritten));
    const byTactic = new Map(tactics.map(t => [t, avg(results.filter(r => r.tactic === t && r.played > 5).map(r => r.ppg))]));
    const byPersonality = new Map(personalities.map(p => [p, avg(results.filter(r => r.personality === p && r.played > 5).map(r => r.ppg))]));
    const summary = `folded=${folded}/48 promoted=${promoted}/48 relegated=${relegated}/48 `
      + `ppg[${Math.min(...ppgs).toFixed(2)}..${Math.max(...ppgs).toFixed(2)} mean ${avg(ppgs).toFixed(2)}] `
      + `goals/g=${goals.toFixed(2)} avail=${availability.toFixed(2)} `
      + `morale[${Math.min(...morales)}..${Math.max(...morales)}] `
      + `bal[${Math.min(...balances)}..${Math.max(...balances)}] memories/club=${memories.toFixed(0)} | `
      + [...byTactic].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ') + ' | '
      + [...byPersonality].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ')
      // Every fold, named: which side, which season, which division and why.
      // A fold-rate regression is unreadable without it, and the wave-7
      // expansion was diagnosed entirely from this line.
      + (folded ? ' | FOLDS ' + results.filter(r => r.folded)
        .map(r => `${r.personality}/${r.tactic} S${r.foldSeason} ${r.foldDivision}: ${r.foldReason}`)
        .join(' ; ') : '');

    // ── MEASURED, 48 careers x 5 seasons (240 seasons, ~3,800 matches),
    //    FIVE runs of this exact case. Every band below is set from these.
    //
    //    folded              0, 0, 0, 1, 1  of 48
    //    promoted at all     46-48 of 48    relegated at all 25-35 of 48
    //    promotions/careers  110-118        relegations 33-40
    //    finished in         Div 4: 7-9  Div 3: 8-18  Div 2: 14-22
    //                        Div 1: 6-8  County Prem: 1-3
    //    ppg                 0.71..2.15, mean 1.49-1.52, median 1.47-1.51
    //    goals per game      3.89-3.95
    //    availability        0.80 on every run
    //    final morale        45..94 across the population
    //    final balance       median £735-£783, p90 £2,082-£2,819,
    //                        min -£261, max £3,741-£9,201
    //    memories per club   166-172
    //    by tactic           route-one 1.52-1.62  park-the-bus 1.45-1.48
    //                        chaos-ball 1.45-1.66  proper-football 1.44-1.48
    //                        (best-to-worst spread 0.10-0.22)
    //    by personality      1.31-1.47 lowest .. 1.62-1.80 highest
    //                        (spread 0.31-0.45; washed and serious lead,
    //                         which is their premise)

    // Survival: a managed club survives five seasons. MEASURED 0-1 folds of 48.
    expect(folded, summary).toBeLessThanOrEqual(6);
    // A club that folded says why it folded — a silent fold is a bug in the
    // fold, not in the balance.
    for (const r of results.filter(x => x.folded)) {
      expect(r.foldReason, `${r.personality}/${r.tactic} folded with no reason`).toBeTruthy();
    }
    // Progression: the pyramid is climbable. MEASURED 46-48 of 48 careers going
    // up at least once over five seasons, and 110-118 promotions in total.
    expect(promoted, summary).toBeGreaterThanOrEqual(30);
    // ...and it pushes back. MEASURED 25-35 careers relegated at least once,
    // 33-40 relegations in total. A pyramid nobody ever falls down is a ladder.
    expect(relegated, summary).toBeGreaterThan(8);
    // THE TOP IS NOT A FORMALITY, which is the real version of "promotion is
    // reachable but not automatic" once careers run long enough that everyone
    // gets promoted once. MEASURED after five seasons: 1-3 of 48 in County
    // Prem, 7-9 still in Division Four, and every division occupied.
    const inTop = results.filter(r => r.finalDivision === SUNDAY_DIVISIONS[SUNDAY_DIVISIONS.length - 1].id).length;
    const inBottom = results.filter(r => r.finalDivision === SUNDAY_DIVISIONS[0].id).length;
    const occupied = new Set(results.map(r => r.finalDivision)).size;
    expect(inTop, `${summary} | top=${inTop} bottom=${inBottom}`).toBeLessThan(results.length / 3);
    expect(inBottom, `${summary} | top=${inTop} bottom=${inBottom}`).toBeGreaterThan(0);
    expect(occupied, `${summary} | divisions occupied ${occupied}`).toBeGreaterThan(2);
    // The football is Sunday football. MEASURED 3.89-3.95 goals a game.
    expect(goals, summary).toBeGreaterThan(2.2);
    expect(goals, summary).toBeLessThan(4.8);
    // Availability is a constraint, not a lottery and not irrelevant.
    // MEASURED 0.80 on all five runs.
    expect(availability, summary).toBeGreaterThan(0.72);
    expect(availability, summary).toBeLessThan(0.99);
    // Morale is alive across the population — neither pinned high nor low.
    // MEASURED a final-morale range of 45 to 94.
    expect(Math.max(...morales), summary).toBeGreaterThan(55);
    expect(Math.min(...morales), summary).toBeLessThan(90);
    // Money: no runaway fortune, no universal collapse.
    //
    // THE MAX IS NOT THE STATISTIC. One career in 240 seasons finished on
    // £9,201 — a club that went up twice, took two sponsors and never had a bad
    // month — and asserting on the maximum turned that into a red build. The
    // population is described by its median and its ninetieth percentile, both
    // of which are stable: MEASURED median £735-£783 and p90 £2,082-£2,819.
    const sorted = [...balances].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    expect(median, `${summary} | median=${median} p90=${p90}`).toBeLessThan(2000);
    expect(p90, `${summary} | median=${median} p90=${p90}`).toBeLessThan(4500);
    expect(avg(balances), summary).toBeGreaterThan(-150);
    // The storytelling spine is actually writing. MEASURED 166-172 memories on
    // the books of a five-season club.
    expect(memories, summary).toBeGreaterThan(80);

    // ── No dominant tactic ───────────────────────────────────────────────
    // MEASURED best-to-worst spread 0.10-0.22 at 12 careers x 5 seasons per
    // arm. This is the campaign's version of the claim `sundayBalance` makes on
    // a much smaller sample, and it is the number to trust: 60 seasons per arm
    // rather than 8.
    for (const [tactic, v] of byTactic) {
      expect(v, `${tactic}: ${summary}`).toBeGreaterThan(0.9);
      expect(v, `${tactic}: ${summary}`).toBeLessThan(2.5);
    }
    const tacticValues = [...byTactic.values()];
    expect(Math.max(...tacticValues) - Math.min(...tacticValues), summary).toBeLessThan(0.45);

    // ── No dominant personality ──────────────────────────────────────────
    // MEASURED 1.31-1.47 for the lowest and 1.62-1.80 for the highest, a
    // spread of 0.31-0.45. That spread is the design intent: the personalities
    // ARE different sides, and the two "we take this seriously" picks are meant
    // to be better at football than the social ones. What must not happen is
    // one of them being unplayable or walking every league it enters.
    for (const [personality, v] of byPersonality) {
      expect(v, `${personality}: ${summary}`).toBeGreaterThan(0.7);
      expect(v, `${personality}: ${summary}`).toBeLessThan(2.6);
    }
  }, 900_000);
});
