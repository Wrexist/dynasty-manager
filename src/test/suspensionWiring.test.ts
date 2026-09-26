/**
 * Every AI match path bans for MATCHES, not weeks (audit S11, finish).
 *
 * `applyAIMatchEvents` has taken the fixture calendar since the S11 fix, but
 * only the other-divisions loop passed it: the player's own division (employed
 * and unemployed ticks, and the AI round played alongside the player's match),
 * the domestic cups and continental football all fell back to "one match a
 * week" — so a red card before an idle stretch was served by the idle weeks.
 *
 * The engine is replaced by a stub that sends off the first home player of
 * every simulated match, and the victim club's calendar gets an idle stretch
 * after the ban week. A calendar-aware ban ends after the next REAL fixture; the
 * week-based fallback ends inside the idle stretch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Match, Player } from '@/types/game';

const sentOff = vi.hoisted(() => new Map<string, string>());

vi.mock('@/engine/match', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/engine/match')>();
  return {
    ...mod,
    // AI matches only (the player's live halves use simulateHalf): the first
    // home player is sent off and the home side wins 1-0, so no cup tie needs
    // extra time or a shootout.
    simulateMatch: (match: Match, _hc: unknown, _ac: unknown, homePlayers: Player[]) => {
      const victim = homePlayers[0];
      if (victim) sentOff.set(match.id, victim.id);
      return {
        result: {
          ...match, played: true, homeGoals: 1, awayGoals: 0,
          events: victim ? [{ minute: 30, type: 'red_card' as const, playerId: victim.id, clubId: match.homeClubId, description: '' }] : [],
        },
        playerRatings: [],
        matchInjuries: {},
      };
    },
  };
});

import { useGameStore } from '@/store/gameStore';
import { progressCompetitionsWeek } from '@/store/slices/orchestration/competitionWeek';
import { suspensionEndWeek, suspensionMatchesRemaining, playerBanMatchesRemaining } from '@/store/slices/orchestration/helpers';
import { createDefaultManager } from '@/utils/managerCareer';
import { RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE } from '@/config/gameBalance';
import { getCompetitionCalendar } from '@/config/continental';
import type { ContinentalTournamentState, CupTie } from '@/types/game';

const CLUB = 'arsenal';
/** Idle weeks inserted into the victim club's calendar after the ban week. */
const BREAK = 3;
const MAX_BAN = RED_CARD_SUSPENSION_MIN + RED_CARD_SUSPENSION_RANGE - 1;

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

beforeEach(() => {
  sentOff.clear();
  Math.random = mulberry32(0x5B11);
  useGameStore.getState().resetGame();
  useGameStore.getState().initGame(CLUB);
  useGameStore.setState({ settings: { ...useGameStore.getState().settings, autoSave: false } });
});
afterEach(() => { Math.random = realRandom; });

const involves = (clubId: string) => (m: { homeClubId: string; awayClubId: string }) =>
  m.homeClubId === clubId || m.awayClubId === clubId;

/** Slide `clubId`'s league fixtures after `afterWeek` back by BREAK weeks (an
 *  idle stretch — an international break or a postponement), everywhere the
 *  calendar is read. Returns the club's next real fixture week. */
function idleStretchAfter(clubId: string, afterWeek: number): number {
  const s = useGameStore.getState();
  const shift = (ms: Match[]) => ms.map(m => (involves(clubId)(m) && m.week > afterWeek ? { ...m, week: m.week + BREAK } : m));
  const divisionFixtures = Object.fromEntries(Object.entries(s.divisionFixtures).map(([id, ms]) => [id, shift(ms)]));
  // Keep the club's cup ties out of the stretch too.
  const cupOut = (ties: CupTie[]) => ties.map(t => (involves(clubId)(t) ? { ...t, week: 999 } : t));
  useGameStore.setState({
    divisionFixtures,
    fixtures: divisionFixtures[s.playerDivision],
    cup: { ...s.cup, ties: cupOut(s.cup.ties) },
    leagueCup: s.leagueCup ? { ...s.leagueCup, ties: cupOut(s.leagueCup.ties) } : s.leagueCup,
    friendlies: [],
  });
  return Math.min(...divisionFixtures[s.playerDivision].filter(m => involves(clubId)(m) && m.week > afterWeek).map(m => m.week));
}

/** A calendar-aware ban outlasts the idle stretch; the week-based fallback
 *  (`week + 1 + n`, n <= MAX_BAN) ends inside it. */
function expectServedAtRealFixtures(p: Player, banWeek: number, nextFixture: number): void {
  expect(nextFixture).toBe(banWeek + 1 + BREAK);
  expect(banWeek + 1 + MAX_BAN).toBeLessThan(nextFixture);
  expect(p.suspendedUntilWeek).toBeGreaterThanOrEqual(nextFixture + 1);
}

/** A league fixture of the player's club in a week with no cup tie of theirs,
 *  so the league match is the one `playCurrentMatch` / `playFirstHalf` pick. */
function ownLeagueWeek(): Match {
  const s = useGameStore.getState();
  const cupWeeks = new Set([...s.cup.ties, ...(s.leagueCup?.ties ?? [])].filter(involves(CLUB)).map(t => t.week));
  return s.fixtures.filter(involves(CLUB)).sort((a, b) => a.week - b.week)
    .find(f => f.week >= 3 && !cupWeeks.has(f.week))!;
}

describe('the ban label reads matches back', () => {
  it('suspensionMatchesRemaining is the inverse of suspensionEndWeek', () => {
    const calendars = [[], [11], [11, 12, 13], [14, 15], [12, 12, 16], [11, 20, 21]];
    for (const cal of calendars) {
      for (let n = 1; n <= 4; n++) {
        expect(suspensionMatchesRemaining(10, suspensionEndWeek(10, n, cal), cal)).toBe(n);
      }
    }
  });

  it('a one-match red card with the next fixture a week away reads 1, not 2', () => {
    const until = suspensionEndWeek(10, 1, [11, 12]);
    expect(until - 10).toBe(2); // the old label: weeks
    expect(suspensionMatchesRemaining(10, until, [11, 12])).toBe(1);
    expect(suspensionMatchesRemaining(10, until - 1, [11, 12])).toBe(0);
    expect(suspensionMatchesRemaining(10, undefined, [11])).toBe(0);
  });

  it('playerBanMatchesRemaining reads the player\'s own club calendar', () => {
    const fx = (week: number, home: string, away: string): Match =>
      ({ id: `${home}-${week}`, week, homeClubId: home, awayClubId: away, played: false, homeGoals: 0, awayGoals: 0, events: [] });
    const src = { fixtures: [fx(14, 'a', 'b'), fx(15, 'c', 'a'), fx(11, 'x', 'y')] };
    // Two-match ban from week 10 with an idle 11-13: through week 15.
    expect(playerBanMatchesRemaining(src, 10, { clubId: 'a', suspendedUntilWeek: 16 })).toBe(2);
    expect(playerBanMatchesRemaining(src, 10, { clubId: 'a', suspendedUntilWeek: undefined })).toBe(0);
  });
});

describe('every AI match path passes the fixture calendar', () => {
  it('the player\'s division in the employed week', async () => {
    const s = useGameStore.getState();
    const week = s.week;
    const m = s.fixtures.find(f => f.week === week && !involves(CLUB)(f))!;
    const next = idleStretchAfter(m.homeClubId, week);
    await useGameStore.getState().advanceWeek();
    const victim = useGameStore.getState().players[sentOff.get(m.id)!];
    expectServedAtRealFixtures(victim, week, next);
  });

  it('the AI round played alongside the player\'s instant-simmed league match', () => {
    const s = useGameStore.getState();
    const own = ownLeagueWeek();
    const week = own.week;
    useGameStore.setState({ week });
    const m = s.fixtures.find(f => f.week === week && !involves(CLUB)(f))!;
    const next = idleStretchAfter(m.homeClubId, week);
    useGameStore.getState().playCurrentMatch();
    const victim = useGameStore.getState().players[sentOff.get(m.id)!];
    expectServedAtRealFixtures(victim, week, next);
  });

  it('the AI round played alongside the player\'s live league match', () => {
    const s = useGameStore.getState();
    const own = ownLeagueWeek();
    const week = own.week;
    useGameStore.setState({ week });
    const m = s.fixtures.find(f => f.week === week && !involves(CLUB)(f))!;
    const next = idleStretchAfter(m.homeClubId, week);
    expect(useGameStore.getState().playFirstHalf()).not.toBeNull();
    useGameStore.getState().playSecondHalf();
    const victim = useGameStore.getState().players[sentOff.get(m.id)!];
    expectServedAtRealFixtures(victim, week, next);
  });

  it('the unemployed week', async () => {
    const s = useGameStore.getState();
    useGameStore.setState({
      gameMode: 'career',
      careerManager: { ...createDefaultManager('Test Manager', 'England', 40, []), unemployedWeeks: 1 },
    });
    const newWeek = s.week + 1;
    const m = s.fixtures.find(f => f.week === newWeek && !involves(CLUB)(f))!;
    const next = idleStretchAfter(m.homeClubId, newWeek);
    await useGameStore.getState().advanceWeek();
    const victim = useGameStore.getState().players[sentOff.get(m.id)!];
    expectServedAtRealFixtures(victim, newWeek, next);
  });

  it('an AI domestic cup tie', () => {
    const s = useGameStore.getState();
    const [a, b] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const week = 6;
    const next = idleStretchAfter(a, week);
    const st = useGameStore.getState();
    const tie: CupTie = { id: 'cup-x', round: 'QF', homeClubId: a, awayClubId: b, played: false, homeGoals: 0, awayGoals: 0, week };
    const players = { ...st.players };
    progressCompetitionsWeek({
      state: { ...st, week, cup: { ties: [tie], currentRound: 'QF', eliminated: false, winner: null }, leagueCup: null },
      clubs: st.clubs, players, week, season: st.season, playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    expectServedAtRealFixtures(players[sentOff.get('cup-x')!], week, next);
  });

  it('a continental tie between two real clubs', () => {
    const s = useGameStore.getState();
    const [a, b] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const week = getCompetitionCalendar(s.totalWeeks).qfWeeks[0];
    const next = idleStretchAfter(a, week);
    const st = useGameStore.getState();
    const championsCup: ContinentalTournamentState = {
      competition: 'champions_cup', season: st.season, groups: [], currentPhase: 'knockout', currentRound: 'QF',
      playerEliminated: true, playerGroupId: null, winnerId: null,
      knockoutTies: [{
        id: 'ucl-qf', round: 'QF', homeClubId: a, awayClubId: b,
        leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0, leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
        // The second leg falls after the idle stretch too.
        week1: week, week2: next, winnerId: null,
      }],
    };
    const players = { ...st.players };
    progressCompetitionsWeek({
      state: { ...st, week, championsCup, cup: { ...st.cup, currentRound: null }, leagueCup: null },
      clubs: st.clubs, players, week, season: st.season, playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    expectServedAtRealFixtures(players[sentOff.get('ucl-qf-l1')!], week, next);
  });

  it('an AI League Cup tie', () => {
    const s = useGameStore.getState();
    const [a, b] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB);
    const week = 6;
    const next = idleStretchAfter(a, week);
    const st = useGameStore.getState();
    const tie: CupTie = { id: 'lc-x', round: 'QF', homeClubId: a, awayClubId: b, played: false, homeGoals: 0, awayGoals: 0, week };
    const players = { ...st.players };
    progressCompetitionsWeek({
      state: { ...st, week, cup: { ...st.cup, currentRound: null }, leagueCup: { ties: [tie], currentRound: 'QF', eliminated: false, winner: null } },
      clubs: st.clubs, players, week, season: st.season, playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    expectServedAtRealFixtures(players[sentOff.get('lc-x')!], week, next);
  });
});
