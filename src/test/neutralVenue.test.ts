/**
 * Neutral venues (simfinish item 1).
 *
 * HOME_ADVANTAGE went 1.15 -> 1.35 in the calibration work, and there was no
 * neutral-venue concept: the club listed "home" for a Cup Final, a League Cup
 * Final, either Super Cup, a continental final, the promotion-playoff final or a
 * World Cup tie took the full league edge for a match nobody hosts. `Match.neutral`
 * is now set where those fixtures are built, and every path that applies a home
 * advantage honours it.
 *
 * The engine is checked exactly (a neutral match is symmetric); the construction
 * sites are checked by recording what reaches `simulateMatch` / `simulateHalf`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Club, ContinentalTournamentState, CupTie, Match, Player } from '@/types/game';

const captured = vi.hoisted(() => ({
  matches: [] as Match[],
  /** The `neutral` argument of every EXTERNAL simulateHalf call (the engine's
   *  own simulateMatch -> simulateHalf calls use the module-internal binding). */
  halfNeutral: [] as (boolean | undefined)[],
}));

vi.mock('@/engine/match', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/engine/match')>();
  return {
    ...mod,
    simulateMatch: (...args: Parameters<typeof mod.simulateMatch>) => {
      captured.matches.push(args[0]);
      return mod.simulateMatch(...args);
    },
    simulateHalf: (...args: Parameters<typeof mod.simulateHalf>) => {
      captured.halfNeutral.push(args[22]);
      return mod.simulateHalf(...args);
    },
  };
});

import { useGameStore } from '@/store/gameStore';
import { computeStrengths, homeAdvantageFactor } from '@/engine/match/helpers';
import { HOME_ADVANTAGE, NEUTRAL_VENUE_ADVANTAGE } from '@/config/matchEngine';
import { pickAiMatchSquad, resolveCatchUpFixture } from '@/store/slices/orchestration/helpers';
import { progressCompetitionsWeek } from '@/store/slices/orchestration/competitionWeek';
import { recordPlayerPlayoffResult } from '@/store/slices/orchestration/playoff';
import { isNeutralCupRound } from '@/data/cup';
import { simulateContinentalMatch } from '@/utils/continental';
import { processGroupWeek } from '@/utils/international';
import { getCompetitionCalendar } from '@/config/continental';

const CLUB = 'arsenal';

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

const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

beforeEach(() => {
  captured.matches.length = 0;
  captured.halfNeutral.length = 0;
});

/** Two AI clubs of the player's division, with the XIs the AI would field. */
function twoAiSides(): { a: Club; b: Club; pa: Player[]; pb: Player[] } {
  const s = useGameStore.getState();
  const [ida, idb] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
  const a = s.clubs[ida];
  const b = s.clubs[idb];
  return { a, b, pa: pickAiMatchSquad(a, s.players, s.week).xi, pb: pickAiMatchSquad(b, s.players, s.week).xi };
}

function initWorld(): void {
  Math.random = mulberry32(0x4E07);
  useGameStore.getState().resetGame();
  useGameStore.getState().initGame(CLUB);
  useGameStore.setState({ settings: { ...useGameStore.getState().settings, autoSave: false } });
}

const cupTie = (id: string, round: CupTie['round'], home: string, away: string, week: number): CupTie =>
  ({ id, round, homeClubId: home, awayClubId: away, played: false, homeGoals: 0, awayGoals: 0, week });

describe('the engine at a neutral venue', () => {
  beforeEach(initWorld);

  it('uses the away side\'s 1.0 instead of HOME_ADVANTAGE', () => {
    expect(NEUTRAL_VENUE_ADVANTAGE).toBe(1);
    expect(homeAdvantageFactor(true)).toBe(NEUTRAL_VENUE_ADVANTAGE);
    expect(homeAdvantageFactor(false)).toBe(HOME_ADVANTAGE);
    expect(homeAdvantageFactor(undefined)).toBe(HOME_ADVANTAGE);
  });

  it('is symmetric: swapping the sides mirrors the expected strengths', () => {
    const { a, b, pa, pb } = twoAiSides();
    const ab = computeStrengths(a, b, pa, pb, undefined, undefined, undefined, undefined, 1, true);
    const ba = computeStrengths(b, a, pb, pa, undefined, undefined, undefined, undefined, 1, true);
    expect(ab.homeStr).toBeCloseTo(ba.awayStr, 12);
    expect(ab.awayStr).toBeCloseTo(ba.homeStr, 12);
  });

  it('keeps home advantage for a normal league match', () => {
    const { a, b, pa, pb } = twoAiSides();
    const home = computeStrengths(a, b, pa, pb, undefined, undefined, undefined, undefined, 1);
    const away = computeStrengths(b, a, pb, pa, undefined, undefined, undefined, undefined, 1);
    // The same club is stronger at its own ground than at the opponent's.
    expect(home.homeStr).toBeGreaterThan(away.awayStr);
    const neutral = computeStrengths(a, b, pa, pb, undefined, undefined, undefined, undefined, 1, true);
    expect(home.homeStr / home.awayStr).toBeGreaterThan(neutral.homeStr / neutral.awayStr);
  });

  it('the catch-up resolver gives a neutral fixture no home edge', () => {
    const { pa } = twoAiSides();
    const base: Match = { id: 'x', week: 1, homeClubId: 'h', awayClubId: 'a', played: false, homeGoals: 0, awayGoals: 0, events: [] };
    const run = (neutral: boolean) => {
      Math.random = mulberry32(0xC47C);
      let home = 0, away = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) {
        const r = resolveCatchUpFixture({ ...base, ...(neutral ? { neutral: true } : {}) }, pa, pa);
        home += r.homeGoals; away += r.awayGoals;
      }
      return { home: home / n, away: away / n };
    };
    const neutral = run(true);
    expect(Math.abs(neutral.home - neutral.away)).toBeLessThan(0.1);
    const league = run(false);
    expect(league.home - league.away).toBeGreaterThan(0.25);
  });
});

describe('the reputation and international models at a neutral venue', () => {
  const mean = (fn: () => { homeGoals: number; awayGoals: number }) => {
    Math.random = mulberry32(0x1A7E);
    let home = 0, away = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) { const r = fn(); home += r.homeGoals; away += r.awayGoals; }
    return { home: home / n, away: away / n };
  };

  it('a virtual continental final has no home bonus', () => {
    const neutral = mean(() => simulateContinentalMatch(3, 3, true));
    expect(Math.abs(neutral.home - neutral.away)).toBeLessThan(0.1);
    const home = mean(() => simulateContinentalMatch(3, 3));
    expect(home.home - home.away).toBeGreaterThan(0.1);
  });

  it('an AI World Cup group match gives the nation listed first no edge', () => {
    // The same nation on both sides, so any gap is the venue and nothing else.
    const fixtures = Array.from({ length: 3000 }, (_, i) => ({
      id: `f${i}`, homeNation: 'France', awayNation: 'France', played: false, homeGoals: 0, awayGoals: 0, week: 47,
    }));
    Math.random = mulberry32(0x3C09);
    const { groups } = processGroupWeek([{ name: 'Group A', teams: ['France'], fixtures, table: [] }], 47, 'Brazil');
    const played = groups[0].fixtures;
    const home = played.reduce((s, f) => s + f.homeGoals, 0) / played.length;
    const away = played.reduce((s, f) => s + f.awayGoals, 0) / played.length;
    expect(Math.abs(home - away)).toBeLessThan(0.1);
  });
});

describe('fixtures are built neutral where nobody hosts', () => {
  beforeEach(initWorld);

  it('only the final of a domestic cup is neutral', () => {
    expect(isNeutralCupRound('F')).toBe(true);
    for (const r of ['R1', 'R2', 'R3', 'R4', 'QF', 'SF'] as const) expect(isNeutralCupRound(r)).toBe(false);
  });

  it('AI Cup / League Cup finals and both Super Cups are simulated neutral; earlier rounds are not', () => {
    const s = useGameStore.getState();
    const others = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const [a, b, c, d, e, f, g, h] = others;
    const week = s.week;
    const state = {
      ...s,
      cup: { ties: [cupTie('cup-f', 'F', a, b, week)], currentRound: 'F' as const, eliminated: false, winner: null },
      leagueCup: {
        ties: [cupTie('lc-sf1', 'SF', c, d, week), cupTie('lc-sf2', 'SF', e, f, week)],
        currentRound: 'SF' as const, eliminated: false, winner: null,
      },
      domesticSuperCup: { type: 'domestic' as const, homeClubId: g, awayClubId: h, played: false, homeGoals: 0, awayGoals: 0, week: 1, winnerId: null },
      continentalSuperCup: { type: 'continental' as const, homeClubId: a, awayClubId: c, played: false, homeGoals: 0, awayGoals: 0, week: 1, winnerId: null },
      championsCup: null, shieldCup: null, conferenceCup: null,
    };
    progressCompetitionsWeek({
      state, clubs: s.clubs, players: { ...s.players }, week: Math.max(week, 2), season: s.season,
      playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    const byId = new Map(captured.matches.map(m => [m.id, m]));
    expect(byId.get('cup-f')?.neutral).toBe(true);
    expect(byId.get('super-cup')?.neutral).toBe(true);
    expect(byId.get('continental-super-cup')?.neutral).toBe(true);
    expect(byId.get('lc-sf1')).toBeDefined();
    expect(byId.get('lc-sf1')?.neutral).toBeUndefined();
  });

  it('a continental final between two real clubs is simulated neutral', () => {
    const s = useGameStore.getState();
    const [a, b] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const cal = getCompetitionCalendar(s.totalWeeks);
    const finalTie = {
      id: 'ucl-f', round: 'F' as const, homeClubId: a, awayClubId: b,
      leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0, leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
      week1: cal.finalWeek, week2: cal.finalWeek, winnerId: null,
    };
    const championsCup: ContinentalTournamentState = {
      competition: 'champions_cup', season: s.season, groups: [], knockoutTies: [finalTie],
      currentPhase: 'knockout', currentRound: 'F', playerEliminated: true, playerGroupId: null, winnerId: null,
    };
    progressCompetitionsWeek({
      state: { ...s, championsCup, cup: { ...s.cup, currentRound: null }, leagueCup: null, domesticSuperCup: null, continentalSuperCup: null },
      clubs: s.clubs, players: { ...s.players }, week: cal.finalWeek, season: s.season,
      playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    const final = captured.matches.find(m => m.id === 'ucl-f-f');
    expect(final?.neutral).toBe(true);
  });

  it('the promotion-playoff final is neutral; a semi-final is hosted', () => {
    const s = useGameStore.getState();
    const [b, c, d] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const semi: Match = { id: 'po-semi', week: s.week, homeClubId: CLUB, awayClubId: d, played: false, homeGoals: 0, awayGoals: 0, events: [] };
    useGameStore.setState({
      seasonPhase: 'playoff',
      playoffState: { leagueId: s.playerDivision, candidates: [CLUB, b, c, d], resolved: [], pendingMatch: semi, teamsInRound: 4 },
    });
    recordPlayerPlayoffResult(useGameStore.setState, useGameStore.getState, { ...semi, played: true, homeGoals: 2, awayGoals: 0 });
    const ps = useGameStore.getState().playoffState!;
    expect(ps.teamsInRound).toBe(2);
    expect(ps.pendingMatch?.neutral).toBe(true);
    // The other semi (b v c) was simulated by the bracket at b's ground.
    const otherSemi = captured.matches.find(m => m.homeClubId === b && m.awayClubId === c);
    expect(otherSemi).toBeDefined();
    expect(otherSemi?.neutral).toBeUndefined();
  });

  it('an AI playoff final is simulated neutral', () => {
    const s = useGameStore.getState();
    const [b, c, d] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const semi: Match = { id: 'po-semi', week: s.week, homeClubId: CLUB, awayClubId: d, played: false, homeGoals: 0, awayGoals: 0, events: [] };
    useGameStore.setState({
      seasonPhase: 'playoff',
      playoffState: { leagueId: s.playerDivision, candidates: [CLUB, b, c, d], resolved: [], pendingMatch: semi, teamsInRound: 4 },
    });
    // The player loses the semi, so the bracket plays the final without them.
    recordPlayerPlayoffResult(useGameStore.setState, useGameStore.getState, { ...semi, played: true, homeGoals: 0, awayGoals: 2 });
    const aiFinal = captured.matches.find(m => m.homeClubId !== CLUB && m.awayClubId !== CLUB
      && [m.homeClubId, m.awayClubId].includes(d));
    expect(aiFinal?.neutral).toBe(true);
  });

  it('the player\'s own Cup Final is neutral in every segment; a league match is not', () => {
    const s = useGameStore.getState();
    const opp = s.divisionClubs[s.playerDivision].find(id => id !== CLUB)!;
    useGameStore.setState({ cup: { ties: [cupTie('my-final', 'F', CLUB, opp, s.week)], currentRound: 'F', eliminated: false, winner: null } });
    expect(useGameStore.getState().playFirstHalf()).not.toBeNull();
    useGameStore.getState().playSecondHalf();
    expect(captured.halfNeutral.length).toBeGreaterThanOrEqual(2);
    expect(captured.halfNeutral.every(n => n === true)).toBe(true);
    expect(useGameStore.getState().currentMatchResult?.neutral).toBe(true);
  });

  it('the player\'s league match keeps home advantage', () => {
    // No cup tie this week: the league fixture is the match.
    const s = useGameStore.getState();
    useGameStore.setState({ cup: { ...s.cup, ties: s.cup.ties.map(t => ({ ...t, week: 999 })) } });
    expect(useGameStore.getState().playFirstHalf()).not.toBeNull();
    expect(captured.halfNeutral).toEqual([undefined]);
  });

  it('an instant-simmed Super Cup reaches the engine neutral', () => {
    const s = useGameStore.getState();
    const opp = s.divisionClubs[s.playerDivision].find(id => id !== CLUB)!;
    useGameStore.setState({
      cup: { ...s.cup, ties: s.cup.ties.map(t => ({ ...t, week: 999 })) },
      domesticSuperCup: { type: 'domestic', homeClubId: CLUB, awayClubId: opp, played: false, homeGoals: 0, awayGoals: 0, week: 1, winnerId: null },
    });
    useGameStore.getState().playCurrentMatch();
    const sc = captured.matches.find(m => m.id === 'super-cup-domestic');
    expect(sc?.neutral).toBe(true);
  });
});

describe('World Cup matches', () => {
  beforeEach(() => {
    Math.random = mulberry32(0x3C0A);
    useGameStore.getState().initGame('celtic');
    useGameStore.getState().startWorldCup('Brazil');
  });

  it('every segment of a live World Cup match is neutral', () => {
    expect(useGameStore.getState().playWorldCupFirstHalf()).not.toBeNull();
    useGameStore.getState().playWorldCupSecondHalf();
    expect(captured.halfNeutral.length).toBeGreaterThanOrEqual(2);
    expect(captured.halfNeutral.every(n => n === true)).toBe(true);
    expect(useGameStore.getState().currentMatchResult?.neutral).toBe(true);
  });
});
