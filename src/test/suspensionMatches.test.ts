/**
 * Suspensions are served in MATCHES, not calendar weeks (audit S11).
 *
 * A ban used to be `suspendedUntilWeek = week + 1 + n`. `suspendedUntilWeek >
 * week` is the "is suspended" test everywhere, so any week the club had no
 * fixture — an international break, a cup week it was not in, the gaps a
 * 38-match league leaves in a 46-week season — silently served a match of the
 * ban. The ban now runs through the week of the club's n-th upcoming fixture.
 * No persisted field changes: only the number written into
 * `suspendedUntilWeek` does.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  applyAIMatchEvents,
  buildFixtureWeeksByClub,
  getYellowAccumulationBanWeek,
  suspensionEndWeek,
} from '@/store/slices/orchestration/helpers';
import { processMatchResult } from '@/store/helpers/matchProcessing';
import { useGameStore } from '@/store/gameStore';
import { YELLOW_ACCUMULATION_THRESHOLDS } from '@/config/gameBalance';
import type { Club, ContinentalTournamentState, CupTie, Match, Player } from '@/types/game';

const originalRandom = Math.random;
afterEach(() => { Math.random = originalRandom; });

const fx = (id: string, week: number, home: string, away: string, played = false): Match =>
  ({ id, week, homeClubId: home, awayClubId: away, played, homeGoals: 0, awayGoals: 0, events: [] });

describe('suspensionEndWeek', () => {
  it('runs through the week of the n-th upcoming fixture', () => {
    // Next fixture the following week: identical to the old rule.
    expect(suspensionEndWeek(10, 1, [11, 12])).toBe(12);
    // An international break (11-13) no longer serves the ban.
    expect(suspensionEndWeek(10, 1, [14, 15])).toBe(15);
    expect(suspensionEndWeek(10, 2, [12, 13, 20])).toBe(14);
    // Past weeks and duplicates (two competitions in one week) are ignored.
    expect(suspensionEndWeek(10, 2, [8, 10, 12, 12, 16])).toBe(17);
  });

  it('assumes one match a week past the fixtures it can see', () => {
    // Undrawn cup rounds, the end of the season.
    expect(suspensionEndWeek(10, 3, [12])).toBe(15);
    // No calendar at all is the old rule exactly.
    expect(suspensionEndWeek(10, 2)).toBe(13);
    expect(suspensionEndWeek(10, 2, [])).toBe(13);
  });

  it('carries through to the yellow-accumulation ban', () => {
    const t = YELLOW_ACCUMULATION_THRESHOLDS[0];
    expect(getYellowAccumulationBanWeek(t - 1, t, 10, [13, 14])).toBe(14);
    expect(getYellowAccumulationBanWeek(t - 2, t - 1, 10, [13, 14])).toBeNull();
  });
});

describe('buildFixtureWeeksByClub', () => {
  it('collects unplayed league, cup and continental weeks after the ban week', () => {
    const tie = (id: string, week: number, home: string, away: string, played = false): CupTie =>
      ({ id, round: 'R3', homeClubId: home, awayClubId: away, played, homeGoals: 0, awayGoals: 0, week } as CupTie);
    const continental = {
      groups: [{ id: 'A', clubIds: ['a', 'x'], standings: [], matches: [
        { id: 'g1', matchday: 1, week: 9, homeClubId: 'a', awayClubId: 'x', played: false, homeGoals: 0, awayGoals: 0 },
      ] }],
      knockoutTies: [
        { id: 'k1', round: 'QF', homeClubId: 'a', awayClubId: 'y', leg1Played: true, leg1HomeGoals: 0, leg1AwayGoals: 0, leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0, week1: 20, week2: 22, winnerId: null },
        { id: 'k2', round: 'F', homeClubId: 'a', awayClubId: 'z', leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0, leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0, week1: 30, week2: 31, winnerId: null },
      ],
    } as unknown as ContinentalTournamentState;
    const map = buildFixtureWeeksByClub({
      fixtures: [fx('l1', 4, 'a', 'b', true), fx('l2', 6, 'a', 'c'), fx('l3', 8, 'd', 'a')],
      divisionFixtures: { other: [fx('o1', 6, 'p', 'q')] },
      cup: { ties: [tie('c1', 7, 'a', 'e'), tie('c0', 3, 'a', 'f', true)] } as never,
      leagueCup: { ties: [tie('lc1', 8, 'g', 'a')], currentRound: null, eliminated: false, winner: null },
      championsCup: continental,
    }, 5);
    // Played (4, 3) and not-after-the-ban-week weeks dropped; week 8 appears
    // once though two competitions sit on it; the final is one leg (30 only).
    expect(map.a).toEqual([6, 7, 8, 9, 22, 30]);
    expect(map.p).toEqual([6]);
  });
});

describe('AI clubs serve bans in matches (applyAIMatchEvents)', () => {
  it('a red card before an international break still costs the next real match', () => {
    // floor(rand * RED_CARD_SUSPENSION_RANGE) = 0 -> a one-match ban.
    Math.random = () => 0;
    const p = { id: 'p1', clubId: 'club-a', yellowCards: 0, redCards: 0 } as Player;
    const players: Record<string, Player> = { p1: p };
    applyAIMatchEvents(
      [{ minute: 60, type: 'red_card', playerId: 'p1', clubId: 'club-a', description: '' }],
      players, { 'club-a': { id: 'club-a', facilities: 5 } as Club }, 10,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      { 'club-a': [14, 15] },
    );
    // Old rule: 12 — free again by week 12, so he played the week-14 fixture.
    expect(players.p1.suspendedUntilWeek).toBe(15);
    expect(players.p1.redCards).toBe(1);
  });

  it('never shortens a longer ban already in force', () => {
    Math.random = () => 0;
    const players: Record<string, Player> = { p1: { id: 'p1', clubId: 'club-a', yellowCards: 0, redCards: 0, suspendedUntilWeek: 30 } as Player };
    applyAIMatchEvents(
      [{ minute: 60, type: 'red_card', playerId: 'p1', clubId: 'club-a', description: '' }],
      players, { 'club-a': { id: 'club-a', facilities: 5 } as Club }, 10,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      { 'club-a': [11, 12] },
    );
    expect(players.p1.suspendedUntilWeek).toBe(30);
  });
});

describe('the player\'s club serves bans in matches (processMatchResult, real save)', () => {
  // Today's league calendars are compact (every club has a league fixture every
  // week of its own league's season), so the gap is made here: the club's
  // fixtures after the ban week slide back two weeks, which is exactly what an
  // international break or a postponement looks like. Everything else — the
  // save, the club, its cup ties, the post-match path — is real.
  it('a red card before an idle fortnight is served at the next real fixture', async () => {
    await useGameStore.getState().initGame('arsenal');
    const state = useGameStore.getState();
    const clubId = state.playerClubId;
    const mine = (m: { homeClubId: string; awayClubId: string }) => m.homeClubId === clubId || m.awayClubId === clubId;
    const cupWeeks = new Set([
      ...(state.cup?.ties ?? []).filter(mine).map(t => t.week),
      ...(state.leagueCup?.ties ?? []).filter(mine).map(t => t.week),
    ]);
    // A league week with no cup tie in the three weeks after it.
    const league = state.fixtures
      .filter(m => mine(m) && m.week >= 5)
      .sort((a, b) => a.week - b.week)
      .find(m => ![1, 2, 3].some(d => cupWeeks.has(m.week + d)));
    expect(league, 'a league week clear of cup ties').toBeDefined();
    const banWeek = league!.week;
    const BREAK = 2;
    const fixtures = state.fixtures.map(m => (mine(m) && m.week > banWeek ? { ...m, week: m.week + BREAK } : m));
    const nextFixture = Math.min(...fixtures.filter(m => mine(m) && m.week > banWeek).map(m => m.week));
    expect(nextFixture).toBe(banWeek + 1 + BREAK);

    const victim = state.clubs[clubId].lineup.map(id => state.players[id]).find(Boolean)!;
    Math.random = () => 0; // one-match ban
    const result: Match = {
      ...league!, played: true, homeGoals: 1, awayGoals: 1,
      events: [{ minute: 70, type: 'red_card', playerId: victim.id, clubId, description: '' }],
    };
    const { newPlayers } = processMatchResult(
      { ...state, week: banWeek, fixtures, divisionFixtures: { ...state.divisionFixtures, [state.playerDivision]: fixtures } },
      league!, result, [], () => banWeek,
    );
    // Old rule: banWeek + 2 — free again during the break and back for the next
    // fixture, the ban served by nothing.
    expect(newPlayers[victim.id].suspendedUntilWeek).toBe(nextFixture + 1);
  }, 120_000);
});
