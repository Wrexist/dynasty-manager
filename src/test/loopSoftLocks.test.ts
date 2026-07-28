/**
 * Regression tests for the soft-locks and silent voids found by the
 * 2026-07-26 audit. Each of these had no coverage, and each of them either
 * ended a save outright or quietly cancelled a whole subsystem.
 */
import { describe, it, expect } from 'vitest';
import { resolveKnockoutTie, simulateKnockoutLeg, isKnockoutRoundComplete } from '@/utils/continental';
import { findTournamentMatch } from '@/store/slices/orchestration/helpers';
import { applySeasonTurnover } from '@/utils/promotionRelegation';
import { autoSelectNationalSquad } from '@/utils/international';
import { scaleCompetitionWeek, DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK } from '@/config/continental';
import { NATIONAL_SQUAD_SIZE } from '@/config/gameBalance';
import { buildLeagueTable } from '@/data/league';
import type { ContinentalKnockoutTie, ContinentalTournamentState, Player, VirtualClub } from '@/types/game';

const vc = (id: string, reputation = 3): VirtualClub => ({
  id, name: id, shortName: id.slice(0, 3).toUpperCase(), color: '#fff', secondaryColor: '#000',
  leagueId: 'eng', reputation, country: 'England', countryCode: 'GB',
});

function tie(over: Partial<ContinentalKnockoutTie> = {}): ContinentalKnockoutTie {
  return {
    id: 't1', round: 'R16', homeClubId: 'a', awayClubId: 'b',
    week1: 10, week2: 11,
    leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0,
    leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
    winnerId: null,
    ...over,
  } as ContinentalKnockoutTie;
}

describe('continental two-leg ties always resolve', () => {
  const clubs = { a: vc('a'), b: vc('b') };

  // 1-0 then 1-0 is the most common two-leg pattern in football. The old code
  // gated extra time / penalties on "was this LEG drawn?", so a level aggregate
  // on a non-drawn leg left winnerId null — and such a tie could then be neither
  // resolved nor replayed, hanging the tournament for the rest of the season.
  it.each([
    [1, 0, 1, 0],
    [2, 1, 2, 1],
    [2, 0, 2, 0],
    [0, 0, 0, 0],
  ])('resolves a level aggregate from legs %i-%i / %i-%i', (l1h, l1a, l2h, l2a) => {
    const resolved = resolveKnockoutTie(
      tie({ leg1Played: true, leg1HomeGoals: l1h, leg1AwayGoals: l1a, leg2Played: true, leg2HomeGoals: l2h, leg2AwayGoals: l2a }),
      clubs,
    );
    expect(resolved.winnerId).toBeTruthy();
    expect(['a', 'b']).toContain(resolved.winnerId);
  });

  it('repairs a save already stranded with both legs played and no winner', () => {
    const stuck = {
      competition: 'champions_cup', currentPhase: 'knockout', currentRound: 'R16',
      groups: [], winnerId: null, playerEliminated: false, currentMatchday: 0,
      season: 1, playerGroupId: null,
      knockoutTies: [tie({ leg1Played: true, leg1HomeGoals: 1, leg2Played: true, leg2HomeGoals: 1 })],
    } as unknown as ContinentalTournamentState;

    expect(isKnockoutRoundComplete(stuck, 'R16')).toBe(false);
    // playerClubId '' — the weekAdvance catch-up passes an empty id once the leg
    // week has passed, so the player's own stranded tie is force-resolved too.
    const repaired = simulateKnockoutLeg(stuck, 'R16', 2, clubs, '');
    expect(repaired.knockoutTies[0].winnerId).toBeTruthy();
    expect(isKnockoutRoundComplete(repaired, 'R16')).toBe(true);
  });

  it('never leaves a level aggregate with a winner but no shootout and no extra-time goals', () => {
    // KnockoutBracket renders the aggregate, so a winner on a still-level
    // aggregate is indistinguishable from a corrupt tie.
    for (let i = 0; i < 200; i++) {
      const r = resolveKnockoutTie(
        tie({ leg1Played: true, leg1HomeGoals: 1, leg2Played: true, leg2HomeGoals: 1 }),
        clubs,
      );
      const homeAgg = r.leg1HomeGoals + r.leg2AwayGoals;
      const awayAgg = r.leg1AwayGoals + r.leg2HomeGoals;
      if (homeAgg === awayAgg) expect(r.penaltyShootout).toBeTruthy();
    }
  });
});

describe('match priority is shared between UI and engine', () => {
  // playCurrentMatchImpl resolves continental BEFORE the domestic cup. When both
  // fall on one week — which is every cup week, since every shipped league has a
  // fixture in every week — findTournamentMatch used to announce the cup tie
  // while the engine kicked off the continental one.
  it('reports the continental tie, not the cup tie, when both fall on the same week', () => {
    const found = findTournamentMatch({
      week: 10,
      playerClubId: 'me',
      cup: { ties: [{ id: 'c1', week: 10, played: false, homeClubId: 'me', awayClubId: 'cupOpp' }], round: 'R1', winner: null } as never,
      leagueCup: null,
      championsCup: {
        competition: 'champions_cup', currentPhase: 'knockout', currentRound: 'R16', groups: [],
        knockoutTies: [tie({ homeClubId: 'me', awayClubId: 'contOpp', week1: 10 })],
        winnerId: null, playerEliminated: false, currentMatchday: 0,
      } as never,
      shieldCup: null, conferenceCup: null,
      domesticSuperCup: null, continentalSuperCup: null,
    });
    expect(found?.competition).toBe('Champions Cup');
    expect(found?.awayClubId).toBe('contOpp');
  });

  it('catches up a Super Cup whose week was outranked', () => {
    // Both Super Cup weeks are raw constants that compressed cup calendars land
    // on in short seasons, and Super Cup is last in the priority chain.
    const found = findTournamentMatch({
      week: CONTINENTAL_SUPER_CUP_WEEK + 3,
      playerClubId: 'me',
      cup: { ties: [], round: 'R1', winner: null } as never,
      leagueCup: null, championsCup: null, shieldCup: null, conferenceCup: null,
      domesticSuperCup: null,
      continentalSuperCup: { week: CONTINENTAL_SUPER_CUP_WEEK, played: false, homeClubId: 'me', awayClubId: 'x', homeGoals: 0, awayGoals: 0, winnerId: null } as never,
    });
    expect(found?.competition).toBe('Continental Super Cup');
  });

  it('keeps the compressed calendar strictly increasing at every season length', () => {
    // Guard for the fix attempt that floored the scaled body above the Super Cup
    // weeks and made 18-week continental milestones collide.
    for (const totalWeeks of [18, 22, 26, 30, 34, 38, 42, 46, 58]) {
      const refs = [4, 8, 14, 20, 28, 36, 43];
      const scaled = refs.map(r => scaleCompetitionWeek(r, totalWeeks));
      for (let i = 1; i < scaled.length; i++) {
        expect(scaled[i], `ref ${refs[i]} @ ${totalWeeks}w`).toBeGreaterThan(scaled[i - 1]);
      }
      expect(scaled[0]).toBeGreaterThanOrEqual(DOMESTIC_SUPER_CUP_WEEK);
    }
  });
});

describe('single-tier relegation spares the player', () => {
  // Brazil (14/4), Argentina (30/2), Saudi (18/3), South Korea (12/1) all reach
  // this path. The player used to land in relegatedClubs, and the caller then
  // deleted every one of their players and generated one replacement too many.
  it('excludes the player club from the relegation zone', () => {
    const clubIds = Array.from({ length: 14 }, (_, i) => `c${i}`);
    const clubs: Record<string, never> = {};
    for (const id of clubIds) clubs[id] = { id, playerIds: [], name: id } as never;

    // Empty fixtures → all clubs level → buildLeagueTable falls back to a
    // deterministic clubId tiebreak, so the bottom of the table is knowable.
    const table = buildLeagueTable([], clubIds);
    const bottom = table[table.length - 1].clubId;

    const res = applySeasonTurnover('bra', clubIds, table, clubs, bottom);
    expect(res.turnover.relegatedClubs).not.toContain(bottom);
    expect(res.updatedClubs[bottom]).toBeDefined();
    expect(res.updatedLeagueClubs).toContain(bottom);
    // League size must be preserved: departures === replacements the caller makes.
    expect(res.updatedLeagueClubs.length + res.turnover.relegatedClubs.length).toBe(clubIds.length);
  });
});

describe('national squad auto-selection always fills a squad', () => {
  // The picker blocks the week until 23 players meeting position quotas are
  // confirmed. autoSelectNationalSquad returning fewer than 23 meant nothing
  // could rescue that state — and end of season, when tournaments are
  // scheduled, is exactly when fitness is lowest.
  function pool(count: number, over: Partial<Player> = {}): Record<string, Player> {
    const out: Record<string, Player> = {};
    const positions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
    for (let i = 0; i < count; i++) {
      out[`p${i}`] = {
        id: `p${i}`, firstName: 'A', lastName: `B${i}`, nationality: 'England',
        position: positions[i % positions.length], age: 25, overall: 60 + (i % 20),
        potential: 80, fitness: 100, injured: false, clubId: 'x',
      } as Player;
    }
    return { ...out, ...(Object.keys(over).length ? {} : {}) };
  }

  it('fills 23 even when the whole pool is below the fitness floor', () => {
    const players = pool(30);
    for (const p of Object.values(players)) p.fitness = 20;
    const squad = autoSelectNationalSquad('England', players, 40);
    expect(squad.length).toBe(NATIONAL_SQUAD_SIZE);
    expect(new Set(squad).size).toBe(NATIONAL_SQUAD_SIZE);
  });

  it('fills 23 even when everyone is suspended', () => {
    const players = pool(30);
    for (const p of Object.values(players)) p.suspendedUntilWeek = 99;
    const squad = autoSelectNationalSquad('England', players, 40);
    expect(squad.length).toBe(NATIONAL_SQUAD_SIZE);
  });

  it('returns what it can when the nation genuinely has too few players', () => {
    const squad = autoSelectNationalSquad('England', pool(12), 40);
    expect(squad.length).toBe(12);
  });
});
