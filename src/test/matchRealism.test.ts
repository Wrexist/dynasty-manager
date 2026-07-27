/**
 * Match-engine REALISM guardrails.
 *
 * `matchBalance.test.ts` checks that the engine is not broken. This file checks
 * that its output looks like football, and — just as important — that no
 * tactical setting is strictly dominant or a strict trap. Every band below is
 * anchored on a measured value; the comment gives the real-football reference
 * and what the engine actually produced, so a future regression is obvious.
 *
 * All cells use STRICTLY IDENTICAL squads on both sides (one squad, cloned with
 * re-keyed ids). Squad-draw variance is worth ~±0.15 goals/match and ~15% on
 * card rates, which would otherwise swamp the tactical effects being measured.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateMatch } from '@/engine/match';
import { getFormationFitBonus } from '@/engine/match/helpers';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import type { Club, Match, Player, TacticalInstructions, FormationType } from '@/types/game';

// Deterministic PRNG so statistical assertions don't flake.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const BALANCED: TacticalInstructions = {
  mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50,
};
const tactics = (o: Partial<TacticalInstructions>): TacticalInstructions => ({ ...BALANCED, ...o });

function makeClub(id: string, formation: FormationType = '4-3-3'): Club {
  return {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: 70, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation, lineup: [], subs: [],
    divisionId: 'eng',
  } as Club;
}

/** Deep-clone a squad onto a club, re-keying ids so both sides are identical in quality. */
function cloneSquad(squad: Player[], clubId: string): Player[] {
  return squad.map(p => ({
    ...(JSON.parse(JSON.stringify(p)) as Player),
    id: `${clubId}-${p.id}`,
    clubId,
  }));
}

interface Sample {
  n: number;
  goals: number; homeGoals: number; awayGoals: number;
  nils: number; draws: number; homeWins: number; awayWins: number;
  fouls: number; homeFouls: number; awayFouls: number;
  yellows: number; reds: number;
  penalties: number; homePenalties: number; awayPenalties: number; penaltyGoals: number;
  bigMargins: number;
}

interface CellOptions {
  n: number;
  seed: number;
  homeQuality?: number;
  awayQuality?: number;
  homeTactics?: TacticalInstructions;
  awayTactics?: TacticalInstructions;
  mutateAway?: (squad: Player[]) => void;
}

function runCell(opts: CellOptions): Sample {
  Math.random = mulberry32(opts.seed);
  resetRealPlayerClaims();
  const homeQuality = opts.homeQuality ?? 75;
  const awayQuality = opts.awayQuality ?? homeQuality;
  const base = generateSquad('realism-base', homeQuality, 1);
  const homeSquad = cloneSquad(base, 'home');
  const awaySquad = awayQuality === homeQuality
    ? cloneSquad(base, 'away')
    : cloneSquad(generateSquad('realism-away', awayQuality, 1), 'away');
  opts.mutateAway?.(awaySquad);

  const homeClub = makeClub('home');
  const awayClub = makeClub('away');
  const home = selectBestLineup(homeSquad, '4-3-3');
  const away = selectBestLineup(awaySquad, '4-3-3');
  homeClub.playerIds = homeSquad.map(p => p.id);
  awayClub.playerIds = awaySquad.map(p => p.id);
  homeClub.lineup = home.lineup.map(p => p.id);
  awayClub.lineup = away.lineup.map(p => p.id);
  homeClub.subs = home.subs.map(p => p.id);
  awayClub.subs = away.subs.map(p => p.id);

  // Re-seed after squad generation: squad-gen consumes a variable number of
  // random values, so the simulation stream would otherwise drift.
  Math.random = mulberry32(opts.seed ^ 0x5F5F5F5F);

  const s: Sample = {
    n: 0, goals: 0, homeGoals: 0, awayGoals: 0, nils: 0, draws: 0, homeWins: 0, awayWins: 0,
    fouls: 0, homeFouls: 0, awayFouls: 0, yellows: 0, reds: 0,
    penalties: 0, homePenalties: 0, awayPenalties: 0, penaltyGoals: 0, bigMargins: 0,
  };
  for (let i = 0; i < opts.n; i++) {
    const match: Match = {
      id: `realism-${i}`, week: 1, homeClubId: 'home', awayClubId: 'away',
      played: false, homeGoals: 0, awayGoals: 0, events: [],
    };
    const { result } = simulateMatch(
      match, homeClub, awayClub,
      home.lineup.map(p => ({ ...p })), away.lineup.map(p => ({ ...p })),
      opts.homeTactics ?? BALANCED, opts.awayTactics ?? BALANCED,
      undefined, undefined, undefined, undefined, undefined, undefined,
      home.subs.map(p => ({ ...p })), away.subs.map(p => ({ ...p })),
    );
    s.n++;
    const hg = result.homeGoals;
    const ag = result.awayGoals;
    s.goals += hg + ag; s.homeGoals += hg; s.awayGoals += ag;
    if (hg === 0 && ag === 0) s.nils++;
    if (hg === ag) s.draws++; else if (hg > ag) s.homeWins++; else s.awayWins++;
    if (Math.abs(hg - ag) >= 4) s.bigMargins++;
    const st = result.stats!;
    s.fouls += st.homeFouls + st.awayFouls;
    s.homeFouls += st.homeFouls;
    s.awayFouls += st.awayFouls;
    for (const ev of result.events) {
      if (ev.type === 'yellow_card') s.yellows++;
      else if (ev.type === 'red_card') s.reds++;
      else if (ev.type === 'penalty_scored' || ev.type === 'penalty_missed') {
        s.penalties++;
        if (ev.clubId === 'home') s.homePenalties++; else s.awayPenalties++;
        if (ev.type === 'penalty_scored') s.penaltyGoals++;
      }
    }
  }
  return s;
}

const pointsPerGame = (s: Sample, side: 'home' | 'away') =>
  side === 'home' ? (s.homeWins * 3 + s.draws) / s.n : (s.awayWins * 3 + s.draws) / s.n;

describe('Match Realism', () => {
  const originalRandom = Math.random;
  beforeEach(() => { resetRealPlayerClaims(); });
  afterEach(() => { Math.random = originalRandom; });

  it('scoring profile matches real football', () => {
    const s = runCell({ n: 500, seed: 0x11A7C4 });

    // Real top-flight football: 2.6-2.9 goals/match. Measured across three
    // independent squad draws: 2.65 / 2.74 / 2.90.
    expect(s.goals / s.n).toBeGreaterThanOrEqual(2.2);
    expect(s.goals / s.n).toBeLessThanOrEqual(3.3);

    // Real ~7-8% of matches finish 0-0. Measured 8.0-12.2% (the engine is
    // slightly over-dispersed vs Poisson because momentum autocorrelates).
    // The band's job is to catch the old engine, which produced 25.5%.
    expect(s.nils / s.n).toBeLessThanOrEqual(0.17);

    // Real ~25% draws. Measured 27-29%. Old engine: 40%.
    expect(s.draws / s.n).toBeGreaterThanOrEqual(0.19);
    expect(s.draws / s.n).toBeLessThanOrEqual(0.35);

    // Real ~4-5% of matches are won by 4+. Measured 3.4-5.1%. Old engine: 1.5%
    // — the goal distribution was far too compressed to produce thrashings.
    expect(s.bigMargins / s.n).toBeGreaterThanOrEqual(0.015);
    expect(s.bigMargins / s.n).toBeLessThanOrEqual(0.10);
  });

  it('penalties are rare and are a small share of goals', () => {
    const s = runCell({ n: 500, seed: 0x22B3D5 });

    // Real ≈ 0.27 penalties/match. Measured 0.278-0.299. Old engine: 0.785 —
    // fouls were charged to the team that won the event roll (i.e. the stronger
    // side), so penalties were both 3x too frequent and awarded backwards.
    expect(s.penalties / s.n).toBeGreaterThanOrEqual(0.15);
    expect(s.penalties / s.n).toBeLessThanOrEqual(0.45);

    // Real ≈ 9% of goals come from the spot. Measured 7.8-8.3%. Old engine:
    // 35-40%, and up to 65% for a weak side in a mismatch.
    expect(s.penaltyGoals / s.goals).toBeLessThanOrEqual(0.15);
  });

  it('fouls and cards are at real-football volume', () => {
    const s = runCell({ n: 400, seed: 0x33C2E6 });

    // Real ≈ 21-22 fouls/match. Measured 21.5-21.8. Old engine: 9.5 — the whole
    // event stream was too thin to carry a realistic foul count.
    expect(s.fouls / s.n).toBeGreaterThanOrEqual(17);
    expect(s.fouls / s.n).toBeLessThanOrEqual(26);

    // Real ≈ 3.5-4 yellows/match. Measured 3.34-3.70. Old engine: 1.47.
    expect(s.yellows / s.n).toBeGreaterThanOrEqual(2.6);
    expect(s.yellows / s.n).toBeLessThanOrEqual(4.6);

    // Real ≈ 0.11 reds/match, i.e. a yellow:red ratio near 30-35:1. Measured
    // 0.107-0.132 at 28-31:1. Old engine: 0.125 reds on only 1.47 yellows (12:1)
    // — proportionally three times too many sendings-off.
    expect(s.reds / s.n).toBeLessThanOrEqual(0.28);
    expect(s.yellows / Math.max(s.reds, 1e-9)).toBeGreaterThanOrEqual(14);
  });

  it('fouls are charged to the defending side, so the better team wins more penalties', () => {
    const s = runCell({ n: 400, seed: 0x44D1F7, homeQuality: 88, awayQuality: 52 });

    // The weaker side defends more, so it fouls more. Measured 8.4 vs 13.2.
    // Old engine had this exactly backwards (fouls followed the event team,
    // which is drawn by strength share).
    expect(s.awayFouls / s.n).toBeGreaterThan(s.homeFouls / s.n);

    // …and therefore the stronger side wins more penalties. Measured
    // 0.163 vs 0.119. Old engine: 0.276 home vs 0.474 away.
    expect(s.homePenalties).toBeGreaterThan(s.awayPenalties);
  });

  it('no mentality is dominant — each trades goals scored against goals conceded', () => {
    const N = 300;
    const mentalities = ['defensive', 'cautious', 'balanced', 'attacking', 'all-out-attack'] as const;
    const cells = mentalities.map((mentality, i) => ({
      mentality,
      sample: runCell({ n: N, seed: 0x55E0A0 + i * 7, homeTactics: tactics({ mentality }) }),
    }));

    const pts = cells.map(c => pointsPerGame(c.sample, 'home'));
    const spread = Math.max(...pts) - Math.min(...pts);
    // Measured spread at n=1500/cell: 0.13 pts/g (defensive 1.46 → attacking
    // 1.54). Old engine: defensive 0.98 → all-out-attack 2.33, a 1.35 spread
    // with all-out-attack scoring 2.9x more AND conceding less.
    expect(spread).toBeLessThanOrEqual(0.35);

    const byMentality = new Map(cells.map(c => [c.mentality, c.sample]));
    const defensive = byMentality.get('defensive')!;
    const allOut = byMentality.get('all-out-attack')!;

    // The trade must run in BOTH directions: aggression buys goals and costs
    // goals. This is the invariant the old engine violated.
    expect(allOut.homeGoals / allOut.n).toBeGreaterThan(defensive.homeGoals / defensive.n);
    expect(allOut.awayGoals / allOut.n).toBeGreaterThan(defensive.awayGoals / defensive.n);
  });

  it('defensive line and pressing are neither dominant nor traps', () => {
    const N = 260;
    const lines = (['deep', 'normal', 'high'] as const).map((defensiveLine, i) =>
      pointsPerGame(runCell({ n: N, seed: 0x66F109 + i * 11, homeTactics: tactics({ defensiveLine }) }), 'home'));
    // Measured (n=1500/cell): deep 1.46 / normal 1.51 / high 1.46. Before the
    // fix `high` was a pure downside (1.18 vs 1.40) because
    // DEFENSIVE_LINE_COUNTER_VULN only ever fed the opponent's conversion.
    expect(Math.max(...lines) - Math.min(...lines)).toBeLessThanOrEqual(0.35);

    const press = [25, 50, 75].map((pressingIntensity, i) =>
      pointsPerGame(runCell({ n: N, seed: 0x77A20B + i * 13, homeTactics: tactics({ pressingIntensity }) }), 'home'));
    // Measured: 1.41 / 1.42 / 1.50. Before, pressing was cost-only (1.40 → 1.32).
    expect(Math.max(...press) - Math.min(...press)).toBeLessThanOrEqual(0.35);
  });

  it('goalkeeper quality measurably changes goals conceded', () => {
    const N = 320;
    const setGK = (defending: number, mental: number, physical: number, overall: number) => (squad: Player[]) => {
      for (const p of squad) {
        if (p.position !== 'GK') continue;
        p.attributes.defending = defending;
        p.attributes.mental = mental;
        p.attributes.physical = physical;
        p.overall = overall;
      }
    };
    const weak = runCell({ n: N, seed: 0x88B30D, mutateAway: setGK(25, 25, 25, 40) });
    const elite = runCell({ n: N, seed: 0x88B30D, mutateAway: setGK(92, 92, 92, 90) });

    const vsWeak = weak.homeGoals / weak.n;
    const vsElite = elite.homeGoals / elite.n;
    // Measured 1.84 vs 1.29 — a 30% swing. The save roll used to resolve AFTER
    // the goal roll, so `oppGKSave` only relabelled an already-decided non-goal
    // as saved vs missed and the same 67-point attribute swing bought under 20%.
    expect(vsElite).toBeLessThan(vsWeak);
    expect(vsElite).toBeLessThanOrEqual(vsWeak * 0.88);
  });

  it('formation fit is an assignment, not a set-cover check', () => {
    Math.random = mulberry32(0x99C40F);
    resetRealPlayerClaims();
    const squad = generateSquad('fit-check', 75, 1);
    const { lineup } = selectBestLineup(squad, '4-3-3');
    const gk = squad.find(p => p.position === 'GK')!;
    const tenCentreBacks: Player[] = Array.from({ length: 10 }, (_, i) => ({
      ...(JSON.parse(JSON.stringify(squad.find(p => p.position === 'CB'))) as Player),
      id: `cb-${i}`,
      position: 'CB',
      alternatePositions: [],
    }));

    const optimal = getFormationFitBonus(lineup, '4-3-3');
    const wrongShape = getFormationFitBonus(lineup, '3-5-2');
    const allCentreBacks = getFormationFitBonus([gk, ...tenCentreBacks], '4-3-3');

    // Measured 0.235 / 0.168 / 0.110. The old set-cover version asked whether
    // ANY player COULD cover each slot without consuming him, so ten centre-backs
    // still scored 0.100 against an optimal XI's 0.250.
    expect(optimal).toBeGreaterThan(wrongShape);
    expect(wrongShape).toBeGreaterThan(allCentreBacks);
    expect(optimal - allCentreBacks).toBeGreaterThanOrEqual(0.06);
  });
});
