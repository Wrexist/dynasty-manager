/**
 * Week-tick / season-end performance work must not change a single outcome
 * (audit 2026-09-25, S10).
 *
 * Each optimisation replaced a hot loop with an equivalent one:
 *   - `selectBestLineup` ranks the squad once instead of filter+sorting it per
 *     formation slot (13 sorts per call, both sides of every fixture);
 *   - chemistry adjacency is a constant-time lookup instead of a scan of
 *     ADJACENT_PAIRS for each of an XI's 55 slot pairs;
 *   - the real-player picker reads position buckets instead of filtering the
 *     whole ~16k-template pool up to five times per generated player (most of
 *     `endSeason`), and memoises the per-nation pool;
 *   - the AI week shares one working copy of the player map instead of five.
 *
 * Every test below runs the CURRENT code against a verbatim copy of the code it
 * replaced, on seeded inputs, and requires identical results — same players,
 * same order, same random draws. A whole-season fixed-seed comparison was also
 * run while making the change (see docs/perf-baseline.md).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { selectBestLineup } from '@/utils/playerGen';
import { calculateChemistryLinks, getChemistryBonus } from '@/utils/chemistry';
import { pickUnclaimedRealPlayer, resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import { processAIWeekly } from '@/utils/aiSimulation';
import { loadNationalPool, getNationalPoolSync } from '@/data/nationalPlayerPoolAccess';
import { useGameStore } from '@/store/gameStore';
import { FORMATION_POSITIONS, canPlayPosition } from '@/types/game';
import type { Player, Position, FormationType, ChemistryLink, PickRealPlayerOptions } from '@/types/game';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { isAwayOnLoan, pick } from '@/utils/helpers';
import {
  EFFECTIVE_RATING_OVERALL_WEIGHT, EFFECTIVE_RATING_FORM_WEIGHT, EFFECTIVE_RATING_FITNESS_WEIGHT, MAX_SUBS,
} from '@/config/playerGeneration';
import {
  ADJACENT_PAIRS, MENTOR_SENIOR_AGE, MENTOR_JUNIOR_AGE, MENTOR_QUALITY_OVERALL_BASE, MENTOR_QUALITY_DIVISOR,
  MENTOR_MAX_STRENGTH, PARTNERSHIP_FORM_THRESHOLD, PARTNERSHIP_STRENGTH_DIVISOR, PARTNERSHIP_MAX_STRENGTH,
  LOYALTY_SEASONS_THRESHOLD, LOYALTY_MAX_STRENGTH, CHEMISTRY_BONUS_PER_STRENGTH, CHEMISTRY_BONUS_MAX,
} from '@/config/chemistry';
import { buildPlayer } from '@/test/helpers/seasonFixtures';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
const FORMATIONS = Object.keys(FORMATION_POSITIONS) as FormationType[];

/** A seeded squad with the awkward cases in it: equal ratings (so stable
 *  ordering matters), injuries, suspensions, loans, alternate positions and
 *  squads too thin for some formations. */
function randomSquad(rng: () => number, size: number, week: number): Player[] {
  const squad: Player[] = [];
  for (let i = 0; i < size; i++) {
    const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
    const alt = rng() < 0.4 ? [POSITIONS[Math.floor(rng() * POSITIONS.length)]] : undefined;
    const status = rng();
    squad.push(buildPlayer({
      id: `p${i}`,
      clubId: 'club',
      position,
      alternatePositions: alt,
      // Coarse values so ties in the effective rating are common.
      overall: 60 + Math.floor(rng() * 4) * 5,
      form: 50 + Math.floor(rng() * 3) * 10,
      fitness: 70 + Math.floor(rng() * 3) * 10,
      injured: status < 0.1,
      suspendedUntilWeek: status >= 0.1 && status < 0.16 ? week + 1 : undefined,
      onLoan: status >= 0.16 && status < 0.2,
      loanToClubId: status >= 0.16 && status < 0.2 ? 'elsewhere' : undefined,
    }));
  }
  return squad;
}

// ── Verbatim copy of the pre-change selectBestLineup ──
function referenceSelectBestLineup(players: Player[], formation: FormationType, currentWeek?: number) {
  const isAvailable = (p: Player) => !p.injured && !isAwayOnLoan(p) && !(p.suspendedUntilWeek && currentWeek !== undefined && p.suspendedUntilWeek > currentWeek);
  const slots = FORMATION_POSITIONS[formation];
  const used = new Set<string>();
  const effectiveRating = (p: Player) => p.overall * EFFECTIVE_RATING_OVERALL_WEIGHT + (p.form / 100) * EFFECTIVE_RATING_FORM_WEIGHT + (p.fitness / 100) * EFFECTIVE_RATING_FITNESS_WEIGHT;
  const slotted: (Player | null)[] = slots.map(slot => {
    const best = players
      .filter(p => !used.has(p.id) && canPlayPosition(p, slot.pos) && isAvailable(p))
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
    if (best) used.add(best.id);
    return best ?? null;
  });
  const fillers = players
    .filter(p => !used.has(p.id) && isAvailable(p))
    .sort((a, b) => effectiveRating(b) - effectiveRating(a));
  let fillerIdx = 0;
  for (let i = 0; i < slotted.length && fillerIdx < fillers.length; i++) {
    if (slotted[i]) continue;
    const filler = fillers[fillerIdx++];
    slotted[i] = filler;
    used.add(filler.id);
  }
  const selected = slotted.filter(Boolean) as Player[];
  const subs = players
    .filter(p => !used.has(p.id) && isAvailable(p))
    .sort((a, b) => effectiveRating(b) - effectiveRating(a))
    .slice(0, MAX_SUBS);
  return { lineup: selected, subs };
}

// ── Verbatim copy of the pre-change chemistry link scan ──
function referenceChemistryLinks(players: (Player | null)[], formation?: FormationType, currentSeason?: number): ChemistryLink[] {
  const areAdjacent = (posA: string, posB: string) => ADJACENT_PAIRS.some(([p1, p2]) =>
    (posA === p1 && posB === p2) || (posA === p2 && posB === p1));
  const links: ChemistryLink[] = [];
  const slots = formation ? FORMATION_POSITIONS[formation] : null;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (!a || !b) continue;
      const posA = slots && slots[i] ? slots[i].pos : a.position;
      const posB = slots && slots[j] ? slots[j].pos : b.position;
      if (!areAdjacent(posA, posB)) continue;
      if (a.nationality === b.nationality) {
        links.push({ playerIdA: a.id, playerIdB: b.id, type: 'nationality', strength: a.clubId === b.clubId ? 2 : 1 });
      }
      const senior = a.age >= MENTOR_SENIOR_AGE && b.age <= MENTOR_JUNIOR_AGE ? a : b.age >= MENTOR_SENIOR_AGE && a.age <= MENTOR_JUNIOR_AGE ? b : null;
      const junior = senior === a ? b : a;
      if (senior && junior) {
        const mentorQuality = Math.min(MENTOR_MAX_STRENGTH, Math.floor((senior.overall - MENTOR_QUALITY_OVERALL_BASE) / MENTOR_QUALITY_DIVISOR) + 1);
        links.push({ playerIdA: senior.id, playerIdB: junior.id, type: 'mentor', strength: Math.max(1, mentorQuality) });
      }
      if ((a.form + b.form) > PARTNERSHIP_FORM_THRESHOLD) {
        links.push({ playerIdA: a.id, playerIdB: b.id, type: 'partnership', strength: Math.min(PARTNERSHIP_MAX_STRENGTH, Math.floor((a.form + b.form - PARTNERSHIP_FORM_THRESHOLD) / PARTNERSHIP_STRENGTH_DIVISOR) + 1) });
      }
      if (currentSeason !== undefined && a.clubId === b.clubId && a.joinedSeason !== undefined && b.joinedSeason !== undefined) {
        const minTenure = Math.min(currentSeason - a.joinedSeason, currentSeason - b.joinedSeason);
        if (minTenure >= LOYALTY_SEASONS_THRESHOLD) {
          links.push({ playerIdA: a.id, playerIdB: b.id, type: 'loyalty', strength: Math.min(LOYALTY_MAX_STRENGTH, minTenure - LOYALTY_SEASONS_THRESHOLD + 1) });
        }
      }
    }
  }
  return links;
}

describe('selectBestLineup ranks once and picks exactly as before', () => {
  it('matches the per-slot sort on 1,000 seeded squads across every formation', () => {
    const rng = mulberry32(0xB00B);
    for (let n = 0; n < 1000; n++) {
      const week = 10;
      const squad = randomSquad(rng, 8 + Math.floor(rng() * 25), week);
      const formation = FORMATIONS[n % FORMATIONS.length];
      const withWeek = n % 3 !== 0;
      const got = selectBestLineup(squad, formation, withWeek ? week : undefined);
      const want = referenceSelectBestLineup(squad, formation, withWeek ? week : undefined);
      expect(got.lineup.map(p => p.id), `case ${n}`).toEqual(want.lineup.map(p => p.id));
      expect(got.subs.map(p => p.id), `case ${n}`).toEqual(want.subs.map(p => p.id));
    }
  });
});

describe('chemistry adjacency lookup', () => {
  it('produces the same links and bonus as the pair-list scan', () => {
    const rng = mulberry32(0xC4E3);
    const nations = ['England', 'Spain', 'France'];
    for (let n = 0; n < 400; n++) {
      const xi: (Player | null)[] = Array.from({ length: 11 }, (_, i) => {
        if (rng() < 0.05) return null; // a hole (sent off / deleted id)
        const p = buildPlayer({
          id: `c${n}-${i}`,
          clubId: rng() < 0.8 ? 'club' : 'other',
          position: POSITIONS[Math.floor(rng() * POSITIONS.length)],
          nationality: nations[Math.floor(rng() * nations.length)],
          age: 17 + Math.floor(rng() * 20),
          form: 40 + Math.floor(rng() * 60),
          overall: 55 + Math.floor(rng() * 35),
          joinedSeason: 1 + Math.floor(rng() * 4),
        });
        return p;
      });
      const formation = n % 2 === 0 ? FORMATIONS[n % FORMATIONS.length] : undefined;
      const season = n % 5 === 0 ? undefined : 6;
      const want = referenceChemistryLinks(xi, formation, season);
      expect(calculateChemistryLinks(xi, formation, season)).toEqual(want);
      const total = want.reduce((s, l) => s + l.strength, 0);
      const wantBonus = want.length === 0 ? 0 : Math.min(CHEMISTRY_BONUS_MAX, total * CHEMISTRY_BONUS_PER_STRENGTH);
      expect(getChemistryBonus(xi, formation, season)).toBe(wantBonus);
    }
  });
});

describe('real-player picker position buckets', () => {
  beforeAll(async () => { await loadNationalPool(); });

  it('deals the same templates, in the same order, as the whole-pool filter', () => {
    const POSITION_FALLBACK: Record<Position, Position[]> = {
      GK: [], CB: ['LB', 'RB', 'CDM'], LB: ['CB', 'LM'], RB: ['CB', 'RM'], CDM: ['CM', 'CB'],
      CM: ['CDM', 'CAM'], CAM: ['CM', 'LM', 'RM'], LM: ['LW', 'CAM', 'LB'], RM: ['RW', 'CAM', 'RB'],
      LW: ['LM', 'ST', 'CAM'], RW: ['RM', 'ST', 'CAM'], ST: ['CAM', 'LW', 'RW'],
    };
    // Verbatim pre-change picker with its own claim registry. Nationalities are
    // ones without an alias entry, plus one with no pool (global fallback).
    const nameKey = (fn: string, ln: string) => `${fn.toLowerCase()}|${ln.toLowerCase()}`;
    const fcKey = (id: string) => id.replace(/^fc\d{2}-/, '');
    const claimedIds = new Set<string>();
    const claimedNames = new Set<string>();
    const claim = (t: PlayerTemplate) => { if (t.fcId) claimedIds.add(fcKey(t.fcId)); else claimedNames.add(nameKey(t.fn, t.ln)); };
    const isClaimed = (t: PlayerTemplate) => (t.fcId && claimedIds.has(fcKey(t.fcId))) || claimedNames.has(nameKey(t.fn, t.ln));
    const deduped = (aliases: string[]) => {
      const out: PlayerTemplate[] = [];
      const seen = new Set<string>();
      for (const alias of aliases) {
        for (const t of getNationalPoolSync()[alias] ?? []) {
          const k = t.fcId ? `id:${t.fcId}` : `n:${nameKey(t.fn, t.ln)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(t);
        }
      }
      return out;
    };
    const everyone = deduped(Object.keys(getNationalPoolSync()));
    const inOvr = (t: PlayerTemplate, o?: PickRealPlayerOptions) =>
      !(o?.minOvr !== undefined && t.ovr < o.minOvr) && !(o?.maxOvr !== undefined && t.ovr > o.maxOvr);
    const fromPool = (pool: PlayerTemplate[], position: Position, o?: PickRealPlayerOptions) => {
      if (pool.length === 0) return null;
      const phase = (m: (t: PlayerTemplate) => boolean) => {
        const list = pool.filter(t => m(t) && !isClaimed(t) && inOvr(t, o));
        if (list.length === 0) return null;
        const choice = pick(list);
        claim(choice);
        return choice;
      };
      return phase(t => t.pos === position)
        ?? phase(t => Boolean(t.altPos?.includes(position)))
        ?? (POSITION_FALLBACK[position] ?? []).reduce<PlayerTemplate | null>(
          (found, fb) => found ?? phase(t => t.pos === fb || Boolean(t.altPos?.includes(fb))), null);
    };
    const reference = (nat: string, position: Position, o?: PickRealPlayerOptions) =>
      fromPool(deduped([nat]), position, o) ?? fromPool(everyone, position, o);

    const nats = ['England', 'Spain', 'Brazil', 'France', 'Germany', 'Nigeria', 'Japan', 'Atlantis'];
    const script: [string, Position, PickRealPlayerOptions | undefined][] = [];
    const rng = mulberry32(0x9A11);
    for (let i = 0; i < 600; i++) {
      const lo = 55 + Math.floor(rng() * 35);
      const band = rng() < 0.2 ? undefined : { minOvr: lo, maxOvr: lo + Math.floor(rng() * 8) };
      script.push([nats[Math.floor(rng() * nats.length)], POSITIONS[Math.floor(rng() * POSITIONS.length)], band]);
    }
    const id = (t: PlayerTemplate | null) => (t ? `${t.fcId ?? ''}|${t.fn} ${t.ln}|${t.ovr}` : 'none');

    const realRandom = Math.random;
    try {
      resetRealPlayerClaims();
      Math.random = mulberry32(42);
      const got = script.map(([nat, pos, o]) => id(pickUnclaimedRealPlayer(nat, pos, o)));
      Math.random = mulberry32(42);
      const want = script.map(([nat, pos, o]) => id(reference(nat, pos, o)));
      expect(got.filter(g => g !== 'none').length).toBeGreaterThan(300);
      expect(got).toEqual(want);
    } finally {
      Math.random = realRandom;
      resetRealPlayerClaims();
    }
  });
});

describe('processAIWeekly shares one working copy', () => {
  it('never mutates the player map it is given', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('manchester-city');
    const s = useGameStore.getState();
    const players = { ...s.players };
    const before = new Map(Object.entries(players));
    const out = processAIWeekly(
      s.clubs, players, s.messages, s.transferMarket, s.freeAgents, s.activeLoans, s.transferNews || [],
      s.divisionTables, 2, s.season, s.playerClubId, true,
    );
    expect(out.players).not.toBe(players);
    expect(Object.keys(players)).toHaveLength(before.size);
    for (const [pid, p] of before) expect(players[pid]).toBe(p);
    // Sanity: the week actually did something to the world.
    expect(Object.values(out.players).some(p => before.get(p.id) !== p)).toBe(true);
  });
});
