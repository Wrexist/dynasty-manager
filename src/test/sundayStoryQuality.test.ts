/**
 * The dead-career detector.
 *
 * Every other Sunday suite asks "is this correct". This one asks the question
 * the mode actually lives or dies on: DID ANYTHING HAPPEN. A save can pass the
 * invariant validator, the balance bands, the exploit audit and the save
 * round-trip and still be a spreadsheet — fixtures resolving, numbers moving,
 * and nothing a player would tell anyone about afterwards.
 *
 * So this autoplays a population of careers and measures the STORY:
 *
 *   - every career accumulates memories, and at least one heavy moment
 *   - chains start and always finish (the wave-2 guarantee, over a population
 *     rather than one scripted case)
 *   - relationships form and break somewhere in the population
 *   - records and legends accrue
 *   - and the careers DIVERGE — different seeds must produce different
 *     stories, or the mode has one story and a random number generator
 *
 * The divergence metric is stated and measured rather than asserted on a
 * feeling: see `describe('careers diverge')` below.
 *
 * Wall clock: measured 13s of test time for 24 careers x 4 seasons — in line
 * with `sundayBalance` (12s) and `sundayStress` (12s), so it stays in the
 * per-commit gate. If it ever grows past ~20s it belongs in `SLOW_SUITES`.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import {
  SUNDAY_MEMORY_LEGENDARY_WEIGHT, SUNDAY_PERSONALITIES, SUNDAY_TACTICS,
  SUNDAY_UPGRADES, sundayUpgradeCost,
} from '@/config/sundayLeague';
import type { SundayClubPersonalityId, SundayTacticId } from '@/types/game';

const CAREERS = 24;
const SEASONS = 4;

interface Story {
  seed: number;
  personality: SundayClubPersonalityId;
  seasons: number;
  folded: boolean;
  /** Total memories written across everyone who was ever here. */
  memories: number;
  /** The heaviest single memory anybody carried at the end. */
  heaviest: number;
  /** Memories at or above the "one for the clubhouse wall" weight. */
  heavyMoments: number;
  /** Chain instances seen live, and the ones observed to finish. */
  chainsStarted: string[];
  chainsEnded: string[];
  /** Instances still open when the season ran out and the rollover backstop
   *  swept them — a story that reached no ending the player could see. */
  chainsSweptAtRollover: number;
  /** Rollovers that left a chain behind in the new season. Must be zero: the
   *  backstop is the last line and it is not allowed to leak. */
  chainsLeakedPastRollover: number;
  /** Friendships and feuds that existed at any point. */
  friendshipsSeen: number;
  feudsSeen: number;
  /** Men who left and are remembered by somebody as a former team-mate. */
  formerTeammates: number;
  records: string[];
  legends: string[];
  moments: string[];
  weekLogLines: number;
}

function validateOrThrow(tag: string) {
  const s = useGameStore.getState();
  const r = validateSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
  if (!r.ok) throw new Error(`[${tag}] ${r.problems.join('; ')}`);
}

/**
 * One week of a manager who is present.
 *
 * A passive pilot measures a passive mode: most of the story surface is behind
 * a decision, so the pilot takes decisions — rotating event choices so every
 * branch is exercised across the population rather than always the safe one.
 */
async function pilotWeek() {
  const store = useGameStore.getState();
  const sunday = store.sunday!;

  if (sunday.pendingEvent) {
    const pick = sunday.pendingEvent.choices[store.week % sunday.pendingEvent.choices.length];
    await store.resolveSundayEvent(pick.id);
  }
  for (const offer of useGameStore.getState().sunday!.sponsorOffers) {
    await useGameStore.getState().acceptSundaySponsor(offer.id);
  }
  const s1 = useGameStore.getState().sunday!;
  if (s1.recruits.length && s1.squad.length < 18 && s1.balance > s1.recruits[0].fee + 150) {
    await useGameStore.getState().signSundayRecruit(s1.recruits[0].id);
  }
  if (useGameStore.getState().sunday!.balance < 130) await useGameStore.getState().runSundayFundraiser();
  const s2 = useGameStore.getState().sunday!;
  for (const u of SUNDAY_UPGRADES) {
    const lvl = s2.upgrades.find(x => x.id === u.id)?.level ?? 0;
    if (lvl >= u.maxLevel || s2.reputation < u.minReputation) continue;
    if (s2.balance - sundayUpgradeCost(u.id, lvl) > 260) {
      await useGameStore.getState().buySundayUpgrade(u.id);
      break;
    }
  }
  // The Sunday morning, when it offers a decision.
  const arrival = await useGameStore.getState().arriveSundayMatch();
  if (arrival && arrival.optionalRingers > 0 && arrival.ringersHired === null) {
    await useGameStore.getState().hireSundayRingers(
      useGameStore.getState().week % 3 === 0 ? arrival.optionalRingers : 0,
    );
  }
  await useGameStore.getState().advanceWeek();
}

/** Play one whole career and come back with what it left behind. */
async function playCareer(seed: number, personality: SundayClubPersonalityId, tactic: SundayTacticId): Promise<Story> {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality, seed });
  await useGameStore.getState().setSundayTactic(tactic);

  const chainsStarted = new Set<string>();
  const chainsEnded = new Set<string>();
  let live = new Set<string>();
  let chainsSweptAtRollover = 0;
  let chainsLeakedPastRollover = 0;
  const friendships = new Set<string>();
  const feuds = new Set<string>();
  const moments: string[] = [];
  let memories = 0;
  let heaviest = 0;
  let heavyMoments = 0;
  let formerTeammates = 0;

  /** Watch the chain list for instances appearing and disappearing. */
  const sampleChains = () => {
    const now = new Set(
      useGameStore.getState().sunday!.chains.map(c => `${c.id}@${c.startedSeason}:${c.startedWeek}`),
    );
    for (const key of now) chainsStarted.add(key);
    for (const key of live) if (!now.has(key)) chainsEnded.add(key);
    live = now;
  };

  /** Memory and relationship totals have to be sampled AS THEY HAPPEN: a man
   *  who leaves takes his biography with him, so end-state counting would
   *  under-report exactly the careers with the most going on. */
  const sampleSquad = () => {
    const sunday = useGameStore.getState().sunday!;
    for (const m of sunday.squad) {
      for (const mem of m.memories) {
        heaviest = Math.max(heaviest, mem.weight);
      }
      for (const f of m.friends) friendships.add([m.playerId, f].sort().join('|'));
      for (const r of m.rivals) feuds.add(`${m.playerId}>${r}`);
    }
  };

  let guard = 0;
  const maxTicks = SEASONS * (sundaySeasonWeeks('sun-prem') + 6);
  while (useGameStore.getState().season <= SEASONS && guard++ < maxTicks) {
    const s = useGameStore.getState();
    if (s.sunday!.folded) break;
    if (s.sunday!.seasonComplete) {
      sampleChains();
      sampleSquad();
      // THE WAVE-2 GUARANTEE, over a population. Deadlines are clamped clear
      // of the season's end so a story finishes inside the season it started
      // in; `rolloverSundaySeason` clears whatever is left as a backstop. Both
      // halves are counted separately, because "the backstop caught it" and
      // "the story ended" are not the same thing for a player.
      chainsSweptAtRollover += s.sunday!.chains.length;
      memories = Math.max(memories, s.sunday!.squad.reduce((n, m) => n + m.memories.length, 0));
      heavyMoments = Math.max(
        heavyMoments,
        s.sunday!.squad.reduce((n, m) => n + m.memories.filter(x => x.weight >= SUNDAY_MEMORY_LEGENDARY_WEIGHT).length, 0),
      );
      await useGameStore.getState().endSundaySeason();
      validateOrThrow(`seed ${seed} rollover`);
      chainsLeakedPastRollover += useGameStore.getState().sunday!.chains.length;
      live = new Set();
      const last = useGameStore.getState().sunday!.history.slice(-1)[0];
      if (last?.momentOfTheSeason) moments.push(last.momentOfTheSeason);
      continue;
    }
    await pilotWeek();
    sampleChains();
    sampleSquad();
  }
  expect(guard, `seed ${seed} hit the tick guard`).toBeLessThan(maxTicks);

  const end = useGameStore.getState();
  const sunday = end.sunday!;
  sampleChains();
  sampleSquad();
  memories = Math.max(memories, sunday.squad.reduce((n, m) => n + m.memories.length, 0));
  heavyMoments = Math.max(
    heavyMoments,
    sunday.squad.reduce((n, m) => n + m.memories.filter(x => x.weight >= SUNDAY_MEMORY_LEGENDARY_WEIGHT).length, 0),
  );
  formerTeammates = sunday.squad.reduce((n, m) => n + m.formerTeammates.length, 0);

  return {
    seed, personality,
    seasons: end.season,
    folded: sunday.folded,
    memories,
    heaviest,
    heavyMoments,
    chainsStarted: [...chainsStarted],
    chainsEnded: [...chainsEnded],
    chainsSweptAtRollover,
    chainsLeakedPastRollover,
    friendshipsSeen: friendships.size,
    feudsSeen: feuds.size,
    formerTeammates,
    records: sunday.records.map(r => r.id),
    legends: sunday.legends.map(l => l.name),
    moments,
    weekLogLines: sunday.weekLog.length,
  };
}

/** The whole population, played once and shared by every case in the file. */
let population: Story[] | null = null;
async function stories(): Promise<Story[]> {
  if (population) return population;
  const out: Story[] = [];
  const personalities = SUNDAY_PERSONALITIES.map(p => p.id);
  const tactics = SUNDAY_TACTICS.map(t => t.id);
  for (let i = 0; i < CAREERS; i++) {
    out.push(await playCareer(
      3100 + i,
      personalities[i % personalities.length],
      tactics[i % tactics.length],
    ));
  }
  population = out;
  return out;
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
const mean = (xs: number[]) => sum(xs) / Math.max(1, xs.length);

describe('no career is dead', () => {
  it('every one of them accumulates a biography with a real high point', async () => {
    const all = await stories();
    const detail = all
      .map(s => `${s.seed}/${s.personality}: mem=${s.memories} heavy=${s.heavyMoments} max=${s.heaviest} folded=${s.folded}`)
      .join('\n');

    // MEASURED across 24 careers x 4 seasons, three runs: memories held by
    // the current squad 90-199 (mean ~155), memories at the clubhouse-wall
    // weight 23-111, and a heaviest memory of 9 in every single career of
    // every run. The floors below sit far under the measured minimum on
    // purpose — they are set at the level a REGRESSION lives at, a memory
    // system that has quietly stopped writing, not at the level of a quiet
    // seed.
    for (const s of all) {
      expect(s.memories, `a career with almost no biography:\n${detail}`).toBeGreaterThan(20);
      expect(s.heaviest, `a career with no moment worth retelling:\n${detail}`)
        .toBeGreaterThanOrEqual(SUNDAY_MEMORY_LEGENDARY_WEIGHT);
      expect(s.heavyMoments, `a career with no big afternoons:\n${detail}`).toBeGreaterThan(0);
    }
    // And the population as a whole is not scraping the floor.
    expect(mean(all.map(s => s.memories)), detail).toBeGreaterThan(40);
  }, 900_000);

  it('starts stories and finishes them, across the population', async () => {
    const all = await stories();
    const started = sum(all.map(s => s.chainsStarted.length));
    const ended = sum(all.map(s => s.chainsEnded.length));
    const swept = sum(all.map(s => s.chainsSweptAtRollover));
    const leaked = sum(all.map(s => s.chainsLeakedPastRollover));
    const withAChain = all.filter(s => s.chainsStarted.length > 0).length;
    const inSeason = (started - swept) / Math.max(1, started);
    const detail = `started=${started} ended=${ended} sweptAtRollover=${swept} leaked=${leaked} `
      + `resolvedInSeason=${(inSeason * 100).toFixed(0)}% careersWithAChain=${withAChain}/${all.length}`;

    // MEASURED, 24 careers x 4 seasons, three runs: 102-128 chain instances
    // started, all of them accounted for, 24/24 careers telling at least one
    // multi-week story every run, and 86% / 89% / 93% of instances reaching an
    // ENDING inside the season that started them. Nothing ever leaked past a
    // rollover.
    expect(started, detail).toBeGreaterThan(all.length * 2);
    expect(withAChain, detail).toBe(all.length);
    // Nothing is abandoned. Every instance seen alive was later accounted for
    // exactly once: it either reached an ending or the rollover swept it. The
    // flag scheme this replaced dropped about a third of the stories it began
    // with neither, and left the player holding a set-up.
    expect(ended + swept, detail).toBe(started);
    // The rollover backstop is the LAST line, not the usual one. The vast
    // majority of stories must finish on their own deadline; the band is set
    // below the 86% low-water mark measured above with room for a quiet
    // population, and it is the number that would move if the deadline clamp
    // ever stopped working.
    expect(inSeason, detail).toBeGreaterThan(0.75);
    // ...and the backstop itself must not leak: no chain may survive into a
    // new season, where its subject may not even be at the club any more.
    expect(leaked, detail).toBe(0);
  }, 900_000);

  it('makes friends, makes enemies, and loses people', async () => {
    const all = await stories();
    const friendly = all.filter(s => s.friendshipsSeen > 0).length;
    const feuding = all.filter(s => s.feudsSeen > 0).length;
    const bereaved = all.filter(s => s.formerTeammates > 0).length;
    const detail = `friendships in ${friendly}/${all.length}, feuds in ${feuding}/${all.length}, `
      + `former team-mates in ${bereaved}/${all.length}`;

    // MEASURED, three runs: friendships formed in 24/24 careers every run
    // (10-21 links per career), feuds in 24/24 (2-14), and a remembered former
    // team-mate in 20-24 of 24. The bands are majorities rather
    // than totals because the departure paths are genuinely probabilistic —
    // what must never happen is the layer being inert, which is what it was
    // before wave 3 (friends and rivals were dead arrays in every save).
    expect(friendly, detail).toBeGreaterThan(all.length / 2);
    expect(feuding, detail).toBeGreaterThan(all.length / 2);
    expect(bereaved, detail).toBeGreaterThan(all.length / 4);
  }, 900_000);

  it('writes records and puts people on the honours board', async () => {
    const all = await stories();
    const records = mean(all.map(s => s.records.length));
    const withLegends = all.filter(s => s.legends.length > 0).length;
    const legends = sum(all.map(s => s.legends.length));
    const detail = `records/career=${records.toFixed(1)} legends=${legends} in ${withLegends}/${all.length} careers`;

    // MEASURED, three runs: 6.6 records per career (never fewer than five in
    // any career), and 7-15 of 24 careers putting somebody on the honours
    // board over four seasons — 11-16 legends across the population.
    //
    // A LEGEND IS DELIBERATELY RARE — forty appearances or twenty-five goals is
    // most of three seasons of turning up, and a four-season window is only
    // just long enough. What the band catches is the board being UNREACHABLE,
    // which is what it was before wave 3 (retirement was the only door that
    // led to it, so a servant who quit or was released vanished with his
    // biography). Population-level, not per career.
    for (const s of all) {
      expect(s.records.length, `${s.seed} set almost no records — ${detail}`).toBeGreaterThan(2);
    }
    expect(withLegends, detail).toBeGreaterThan(2);
    expect(legends, detail).toBeGreaterThan(2);
  }, 900_000);
});

describe('careers diverge', () => {
  /**
   * THE REPLAYABILITY METRIC, stated once.
   *
   * A career's STORY FINGERPRINT is the set of tokens it would be described
   * with afterwards. It splits in two:
   *
   *   - the SPINE — the records every club sets. A biggest win and a best
   *     finish happen in every career by construction, so the spine is shared
   *     on purpose and is not evidence of anything.
   *   - the NARRATIVE — the chains it told, the men on its honours board and
   *     the moments of its seasons. This is the part that has to differ.
   *
   * Two careers are "the same story" to the extent their narrative tokens
   * overlap, which is Jaccard similarity:
   *
   *     J(a, b) = |A ∩ B| / |A ∪ B|
   *
   * Divergence is reported as the mean pairwise J over the population. A mode
   * with one story and a random seed scores near 1; a mode that genuinely
   * branches scores low. Both bands below are set from the measurement, and
   * both values are printed in the failure message so a regression is legible
   * rather than a mystery.
   */
  function narrative(s: Story): Set<string> {
    return new Set([
      ...s.chainsStarted.map(c => `chain:${c.split('@')[0]}`),
      ...s.legends.map(n => `legend:${n}`),
      ...s.moments.map(m => `moment:${m}`),
    ]);
  }

  function spine(s: Story): Set<string> {
    return new Set(s.records.map(r => `record:${r}`));
  }

  function jaccard(a: Set<string>, b: Set<string>): number {
    let shared = 0;
    for (const k of a) if (b.has(k)) shared++;
    const union = a.size + b.size - shared;
    return union === 0 ? 1 : shared / union;
  }

  function meanPairwise(sets: Set<string>[]): { mean: number; worst: number } {
    let total = 0, pairs = 0, worst = 0;
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const v = jaccard(sets[i], sets[j]);
        total += v; pairs++;
        worst = Math.max(worst, v);
      }
    }
    return { mean: total / Math.max(1, pairs), worst };
  }

  it('no two careers tell the same story', async () => {
    const all = await stories();
    const narratives = all.map(narrative);
    const spines = all.map(spine);
    const keys = narratives.map(p => [...p].sort().join('\u0001'));
    const distinct = new Set(keys).size;
    const n = meanPairwise(narratives);
    const sp = meanPairwise(spines);
    const detail = `distinct=${distinct}/${all.length} narrativeJaccard=${n.mean.toFixed(3)} `
      + `worstPair=${n.worst.toFixed(3)} spineJaccard=${sp.mean.toFixed(3)} `
      + `tokens/career=${mean(narratives.map(p => p.size)).toFixed(1)}`;

    // MEASURED across 24 careers x 4 seasons, three runs of this case:
    //   distinct narratives  24/24 every run
    //   narrative Jaccard    0.152 / 0.160 / 0.163
    //   worst pair           0.308 / 0.333 / 0.333
    //   tokens per career    7.4-7.7
    //   spine Jaccard        0.925 / 0.928 / 0.944  — the control: the records
    //                        everybody sets DO overlap, which is what makes
    //                        the low narrative figure a measurement of the
    //                        mode rather than an artefact of the metric.
    expect(distinct, detail).toBe(all.length);
    expect(n.mean, detail).toBeLessThan(0.35);
    expect(n.worst, detail).toBeLessThan(0.60);
    // The control has to hold too. If the spine ever diverged as much as the
    // narrative, the metric would be measuring the sample size, not the mode.
    expect(sp.mean, detail).toBeGreaterThan(0.70);
  }, 900_000);

  it('the moments of the season are not one sentence with the names changed', async () => {
    const all = await stories();
    const moments = all.flatMap(s => s.moments);
    const distinct = new Set(moments).size;
    // Strip the names and the numbers, leaving the TEMPLATE, so a mode with
    // one line and a name substituted into it is caught even though every
    // rendered string is technically unique.
    const shapes = new Set(moments.map(m => m.replace(/\b[A-Z][a-z]+\b/g, '\u00b7').replace(/\d+/g, '#')));
    const detail = `moments=${moments.length} distinctText=${distinct} distinctShapes=${shapes.size}`;

    // MEASURED, three runs: 96 moments recorded (one per season per career),
    // 91-93 distinct texts, 23-26 distinct templates.
    expect(moments.length, detail).toBeGreaterThan(all.length * 2);
    expect(distinct / moments.length, detail).toBeGreaterThan(0.8);
    expect(shapes.size, detail).toBeGreaterThan(10);
  }, 900_000);
});
