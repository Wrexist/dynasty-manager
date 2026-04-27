/**
 * Phase 5b — Continental tournament result reporting for Season Summary.
 *
 * Complements the existing continental.test.ts with knockout-stage result
 * coverage (currently only group-stage and winner are tested) plus the
 * `isKnockoutRoundComplete` invariant the orchestration slice relies on
 * to advance rounds.
 *
 * These results show up directly on the Season Summary screen ("Champions
 * Cup: Quarter-Finals", "Shield Cup: Final", etc.) — bugs corrupt manager
 * career history.
 */

import { describe, it, expect } from 'vitest';

import {
  getContinentalResultForClub,
  isKnockoutRoundComplete,
  getCurrentMatchday,
} from '@/utils/continental';
import type {
  ContinentalKnockoutTie,
  ContinentalTournamentState,
} from '@/types/game';

// ── Helpers ───────────────────────────────────────────────────────────

function makeKnockoutTie(
  round: ContinentalKnockoutTie['round'],
  home: string,
  away: string,
  winnerId: string | null = null,
): ContinentalKnockoutTie {
  return {
    id: `${round}-${home}-${away}`,
    round,
    homeClubId: home,
    awayClubId: away,
    leg1Played: winnerId !== null,
    leg1HomeGoals: winnerId === home ? 2 : 0,
    leg1AwayGoals: winnerId === away ? 2 : 0,
    leg2Played: round !== 'F' && winnerId !== null,
    leg2HomeGoals: 0,
    leg2AwayGoals: 0,
    week1: 0,
    week2: 0,
    winnerId,
  };
}

function makeKnockoutTournament(ties: ContinentalKnockoutTie[]): ContinentalTournamentState {
  return {
    competition: 'champions_cup',
    season: 1,
    groups: [],
    knockoutTies: ties,
    currentPhase: 'knockout',
    currentRound: 'R16',
    playerEliminated: false,
    playerGroupId: null,
    winnerId: null,
  };
}

// ── getContinentalResultForClub — knockout rounds ─────────────────────

describe('getContinentalResultForClub — knockout-round reporting', () => {
  it('reports "Round of 16" for clubs eliminated in R16', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'b'), // 'a' lost in R16
    ]);
    expect(getContinentalResultForClub(tournament, 'a')).toBe('Round of 16');
  });

  it('reports "Quarter-Finals" for clubs eliminated in QF', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
      makeKnockoutTie('QF', 'a', 'c', 'c'), // 'a' lost in QF
    ]);
    expect(getContinentalResultForClub(tournament, 'a')).toBe('Quarter-Finals');
  });

  it('reports "Semi-Finals" for clubs eliminated in SF', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
      makeKnockoutTie('QF', 'a', 'c', 'a'),
      makeKnockoutTie('SF', 'a', 'd', 'd'), // 'a' lost in SF
    ]);
    expect(getContinentalResultForClub(tournament, 'a')).toBe('Semi-Finals');
  });

  it('reports "Final" for the runner-up', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('F', 'a', 'b', 'b'), // 'b' won
    ]);
    expect(getContinentalResultForClub(tournament, 'a')).toBe('Final');
  });

  it('reports the deepest round when a club appears in multiple', () => {
    // The function checks F → SF → QF → R16, so a club present in F should
    // get 'Final' even if R16/QF/SF entries also exist for them.
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
      makeKnockoutTie('QF', 'a', 'c', 'a'),
      makeKnockoutTie('SF', 'a', 'd', 'a'),
      makeKnockoutTie('F', 'a', 'e', 'e'),
    ]);
    expect(getContinentalResultForClub(tournament, 'a')).toBe('Final');
  });

  it('"Winner" overrides any knockout-round entry', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('F', 'a', 'b', 'a'),
    ]);
    tournament.winnerId = 'a';
    expect(getContinentalResultForClub(tournament, 'a')).toBe('Winner');
  });

  it('falls through to "Did not qualify" when knockout ties don\'t reference the club', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
    ]);
    expect(getContinentalResultForClub(tournament, 'unknown-club')).toBe('Did not qualify');
  });
});

// ── isKnockoutRoundComplete ───────────────────────────────────────────

describe('isKnockoutRoundComplete', () => {
  it('returns false when no ties exist for the requested round', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
    ]);
    expect(isKnockoutRoundComplete(tournament, 'QF')).toBe(false);
  });

  it('returns false when at least one tie has no winner', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
      makeKnockoutTie('R16', 'c', 'd', null), // unresolved
    ]);
    expect(isKnockoutRoundComplete(tournament, 'R16')).toBe(false);
  });

  it('returns true when every tie in the round has a winner', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),
      makeKnockoutTie('R16', 'c', 'd', 'c'),
    ]);
    expect(isKnockoutRoundComplete(tournament, 'R16')).toBe(true);
  });

  it('considers only the round in question (mixed-round tournaments)', () => {
    const tournament = makeKnockoutTournament([
      makeKnockoutTie('R16', 'a', 'b', 'a'),    // resolved
      makeKnockoutTie('QF', 'a', 'c', null),    // unresolved
    ]);
    expect(isKnockoutRoundComplete(tournament, 'R16')).toBe(true);
    expect(isKnockoutRoundComplete(tournament, 'QF')).toBe(false);
  });
});

// ── getCurrentMatchday ────────────────────────────────────────────────

describe('getCurrentMatchday', () => {
  it('returns 1 when no matchday has finished', () => {
    const tournament: ContinentalTournamentState = {
      competition: 'champions_cup',
      season: 1,
      groups: [{
        id: 'A',
        clubIds: ['a', 'b', 'c', 'd'],
        matches: [
          { id: 'm1', matchday: 1, week: 4, homeClubId: 'a', awayClubId: 'b', played: false, homeGoals: 0, awayGoals: 0 },
          { id: 'm2', matchday: 1, week: 4, homeClubId: 'c', awayClubId: 'd', played: false, homeGoals: 0, awayGoals: 0 },
        ],
        standings: [],
      }],
      knockoutTies: [],
      currentPhase: 'group',
      currentRound: 'group',
      playerEliminated: false,
      playerGroupId: 'A',
      winnerId: null,
    };
    expect(getCurrentMatchday(tournament)).toBe(1);
  });

  it('advances to matchday 2 once matchday 1 is fully played', () => {
    const tournament: ContinentalTournamentState = {
      competition: 'champions_cup',
      season: 1,
      groups: [{
        id: 'A',
        clubIds: ['a', 'b', 'c', 'd'],
        matches: [
          { id: 'm1', matchday: 1, week: 4, homeClubId: 'a', awayClubId: 'b', played: true, homeGoals: 1, awayGoals: 0 },
          { id: 'm2', matchday: 1, week: 4, homeClubId: 'c', awayClubId: 'd', played: true, homeGoals: 2, awayGoals: 1 },
          { id: 'm3', matchday: 2, week: 8, homeClubId: 'a', awayClubId: 'c', played: false, homeGoals: 0, awayGoals: 0 },
        ],
        standings: [],
      }],
      knockoutTies: [],
      currentPhase: 'group',
      currentRound: 'group',
      playerEliminated: false,
      playerGroupId: 'A',
      winnerId: null,
    };
    expect(getCurrentMatchday(tournament)).toBe(2);
  });
});
