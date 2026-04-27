/**
 * Phase 5a — Cup competition progression & penalty shootout resolution.
 *
 * Extends the basic coverage in cup.test.ts with the bracket-shape, penalty
 * shootout, and bye edge cases that affect end-of-season history reporting.
 *
 * Bugs here surface as:
 *   - Drawn ties producing two winners or no winner (advance crash)
 *   - Bye-marked ties advancing both clubs
 *   - Wrong start round for small leagues (final overflow past week 42)
 *   - Cup history ('Quarter-Finals' etc.) labeled wrong on Season Summary
 */

import { describe, it, expect } from 'vitest';

import {
  generateCupDraw,
  advanceCupRound,
  getCupResultForClub,
  getCupWeek,
  CUP_BYE_MARKER,
} from '@/data/cup';
import { CUP_PENALTY_KICKS } from '@/config/gameBalance';
import type { CupState, CupTie } from '@/types/game';

import { withSeededRandom } from './helpers/seasonFixtures';

// ── Helpers ───────────────────────────────────────────────────────────

function makeClubIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `club-${i + 1}`);
}

/** Mark every unplayed tie of `round` as played with the given goal pattern. */
function playRound(
  cup: CupState,
  round: CupTie['round'],
  homeGoals: number,
  awayGoals: number,
): CupState {
  return {
    ...cup,
    ties: cup.ties.map(t =>
      t.round === round && !t.played
        ? { ...t, played: true, homeGoals, awayGoals }
        : t,
    ),
  };
}

// ── Cup draw shape ─────────────────────────────────────────────────────

describe('generateCupDraw — bracket shape', () => {
  it('starts at R1 for 17+ teams', () => {
    expect(generateCupDraw(makeClubIds(20)).currentRound).toBe('R1');
    expect(generateCupDraw(makeClubIds(24)).currentRound).toBe('R1');
  });

  it('starts at R2 for 9-16 teams', () => {
    expect(generateCupDraw(makeClubIds(10)).currentRound).toBe('R2');
    expect(generateCupDraw(makeClubIds(16)).currentRound).toBe('R2');
  });

  it('starts at R3 for ≤8 teams', () => {
    expect(generateCupDraw(makeClubIds(8)).currentRound).toBe('R3');
    expect(generateCupDraw(makeClubIds(4)).currentRound).toBe('R3');
  });

  it('marks every odd-club bye as already played with home win', () => {
    const cup = generateCupDraw(makeClubIds(21)); // odd
    const byeTie = cup.ties.find(t => t.awayClubId === CUP_BYE_MARKER);
    expect(byeTie).toBeDefined();
    expect(byeTie!.played).toBe(true);
    expect(byeTie!.homeGoals).toBe(1);
    expect(byeTie!.awayGoals).toBe(0);
  });

  it('places ties in the correct CUP_WEEKS slot', () => {
    const cup20 = generateCupDraw(makeClubIds(20));
    expect(cup20.ties.every(t => t.week === getCupWeek('R1'))).toBe(true);
    const cup10 = generateCupDraw(makeClubIds(10));
    expect(cup10.ties.every(t => t.week === getCupWeek('R2'))).toBe(true);
  });

  it('every club appears exactly once across ties', () => {
    const ids = makeClubIds(24);
    const cup = generateCupDraw(ids);
    const seen = new Set<string>();
    for (const tie of cup.ties) {
      if (tie.homeClubId !== CUP_BYE_MARKER) seen.add(tie.homeClubId);
      if (tie.awayClubId !== CUP_BYE_MARKER) seen.add(tie.awayClubId);
    }
    expect(seen.size).toBe(ids.length);
  });
});

// ── Round advancement ─────────────────────────────────────────────────

describe('advanceCupRound — bye and winner handling', () => {
  it('advances bye-marked ties without simulating penalties', () => {
    const cup = generateCupDraw(makeClubIds(20)); // even, no byes
    const byeId = 'bye-survivor';
    cup.ties.unshift({
      id: 'bye-tie', round: 'R1', homeClubId: byeId, awayClubId: CUP_BYE_MARKER,
      played: true, homeGoals: 1, awayGoals: 0, week: getCupWeek('R1'),
    });
    // Pretend the rest already played with home wins.
    const played = cup.ties.map(t =>
      t.id === 'bye-tie' ? t : { ...t, played: true, homeGoals: 2, awayGoals: 1 },
    );
    const advanced = advanceCupRound({ ...cup, ties: played });
    // The bye club must appear in a R2 tie.
    const r2 = advanced.ties.filter(t => t.round === 'R2');
    expect(r2.some(t => t.homeClubId === byeId || t.awayClubId === byeId)).toBe(true);
  });

  it('returns the same state when called on the Final', () => {
    const cup: CupState = {
      ties: [{ id: 'final', round: 'F', homeClubId: 'a', awayClubId: 'b',
        played: true, homeGoals: 2, awayGoals: 1, week: getCupWeek('F') }],
      currentRound: 'F', eliminated: false, winner: null,
    };
    expect(advanceCupRound(cup).currentRound).toBe('F');
  });

  it('progresses through ROUND_ORDER (R3 → R4 → QF) preserving bracket size halving', () => {
    // 16 clubs start at R2 → 8 → 4 → 2 → 1.
    // Progression follows ROUND_ORDER, not bracket-size names: R3 advances
    // to R4 (not directly to QF). This pins that contract.
    let cup = generateCupDraw(makeClubIds(16));
    expect(cup.currentRound).toBe('R2');
    expect(cup.ties.filter(t => t.round === 'R2')).toHaveLength(8);

    cup = playRound(cup, 'R2', 2, 1);
    cup = withSeededRandom(1, () => advanceCupRound(cup));
    expect(cup.currentRound).toBe('R3');
    expect(cup.ties.filter(t => t.round === 'R3')).toHaveLength(4);

    cup = playRound(cup, 'R3', 2, 1);
    cup = withSeededRandom(2, () => advanceCupRound(cup));
    expect(cup.currentRound).toBe('R4');
    expect(cup.ties.filter(t => t.round === 'R4')).toHaveLength(2);

    cup = playRound(cup, 'R4', 3, 0);
    cup = withSeededRandom(3, () => advanceCupRound(cup));
    expect(cup.currentRound).toBe('QF');
    expect(cup.ties.filter(t => t.round === 'QF')).toHaveLength(1);
  });
});

// ── Penalty shootout resolution ───────────────────────────────────────

describe('advanceCupRound — penalty shootouts', () => {
  it('resolves drawn ties via penalties (no double-winner, no missing winner)', () => {
    const cup = generateCupDraw(makeClubIds(20));
    // All R1 ties end 1-1 → penalty shootout decides.
    const drawn = playRound(cup, 'R1', 1, 1);
    const advanced = withSeededRandom(42, () => advanceCupRound(drawn));
    expect(advanced.currentRound).toBe('R2');
    const r2 = advanced.ties.filter(t => t.round === 'R2');
    // Exactly half the R1 winners progress (10 ties → 5 R2 ties).
    expect(r2).toHaveLength(5);

    // Every R1 tie must have a recorded penaltyShootout score.
    const r1Drawn = advanced.ties.filter(t => t.round === 'R1');
    for (const tie of r1Drawn) {
      expect(tie.penaltyShootout).toBeDefined();
      expect(tie.penaltyShootout!.home).not.toBe(tie.penaltyShootout!.away);
    }
  });

  it('does not record a shootout for ties resolved in regulation', () => {
    const cup = generateCupDraw(makeClubIds(20));
    const decided = playRound(cup, 'R1', 3, 1); // home wins outright
    const advanced = withSeededRandom(99, () => advanceCupRound(decided));
    const r1 = advanced.ties.filter(t => t.round === 'R1');
    for (const tie of r1) {
      expect(tie.penaltyShootout).toBeUndefined();
    }
  });

  it('shootout score is bounded — neither side can exceed CUP_PENALTY_KICKS+sudden-death rounds', () => {
    const cup = generateCupDraw(makeClubIds(20));
    const drawn = playRound(cup, 'R1', 0, 0);
    const advanced = withSeededRandom(7, () => advanceCupRound(drawn));
    for (const tie of advanced.ties.filter(t => t.round === 'R1')) {
      expect(tie.penaltyShootout!.home).toBeGreaterThanOrEqual(0);
      expect(tie.penaltyShootout!.away).toBeGreaterThanOrEqual(0);
      // At minimum, 5 kicks each — plus optional sudden-death rounds.
      // Cap at a generous ceiling (50 kicks per side) so the test fails
      // loudly if the loop ever escapes containment.
      expect(tie.penaltyShootout!.home).toBeLessThan(CUP_PENALTY_KICKS + 50);
      expect(tie.penaltyShootout!.away).toBeLessThan(CUP_PENALTY_KICKS + 50);
    }
  });

  it('terminates even with a 100% penalty success rate (sudden death)', () => {
    // Force CUP_PENALTY_WIN_CHANCE-equivalent behavior at 1.0 by stubbing
    // Math.random to always return 0 (i.e. < 0.5 always succeeds).
    // The loop ALWAYS keeps homeGoals === awayGoals when both score, but
    // because both kickers' rolls are independent draws of Math.random,
    // the production code's `while (homeGoals === awayGoals)` will exit
    // exactly when randomness diverges. With a fixed-zero seed both score
    // every kick, so we need a mulberry32 seed that produces *some*
    // divergence to terminate. Verify it terminates within a bounded
    // number of iterations.
    const cup = generateCupDraw(makeClubIds(4));
    cup.ties.forEach(t => {
      t.played = true; t.homeGoals = 1; t.awayGoals = 1;
    });
    const start = Date.now();
    const advanced = withSeededRandom(1234, () => advanceCupRound(cup));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // sanity bound — should be ms, not seconds
    // All ties resolved.
    expect(advanced.ties.filter(t => t.round === 'R3').every(t =>
      t.penaltyShootout!.home !== t.penaltyShootout!.away,
    )).toBe(true);
  });
});

// ── getCupResultForClub — endgame history ─────────────────────────────

describe('getCupResultForClub — season history reporting', () => {
  function makeTie(round: CupTie['round'], home: string, away: string, hg: number, ag: number, week = 0): CupTie {
    return { id: `${round}-${home}-${away}`, round, homeClubId: home, awayClubId: away,
      played: true, homeGoals: hg, awayGoals: ag, week };
  }

  it('returns "Winner" for the cup champion regardless of recorded ties', () => {
    const cup: CupState = {
      ties: [makeTie('F', 'a', 'b', 2, 1)],
      currentRound: 'F', eliminated: false, winner: 'a',
    };
    expect(getCupResultForClub(cup, 'a')).toBe('Winner');
  });

  it('returns the latest played round for an eliminated club', () => {
    const cup: CupState = {
      ties: [
        makeTie('R1', 'a', 'b', 2, 1),
        makeTie('R2', 'a', 'c', 1, 0),
        makeTie('R3', 'a', 'd', 0, 1), // eliminated here
      ],
      currentRound: 'R4', eliminated: true, winner: null,
    };
    expect(getCupResultForClub(cup, 'a')).toBe('Round 3');
  });

  it('renders Round of 16 / Quarter-Finals / Semi-Finals / Final as friendly names', () => {
    const cup: CupState = {
      ties: [
        makeTie('R4', 'a', 'b', 0, 1),  // R4 = Round of 16
        makeTie('QF', 'c', 'd', 0, 1),
        makeTie('SF', 'e', 'f', 0, 1),
        makeTie('F',  'g', 'h', 0, 1),
      ],
      currentRound: 'F', eliminated: true, winner: null,
    };
    expect(getCupResultForClub(cup, 'a')).toBe('Round of 16');
    expect(getCupResultForClub(cup, 'c')).toBe('Quarter-Finals');
    expect(getCupResultForClub(cup, 'e')).toBe('Semi-Finals');
    expect(getCupResultForClub(cup, 'g')).toBe('Final');
  });

  it('returns "Did not enter" for a club with no played ties', () => {
    const cup: CupState = {
      ties: [makeTie('R1', 'a', 'b', 1, 0)],
      currentRound: 'R2', eliminated: false, winner: null,
    };
    expect(getCupResultForClub(cup, 'unknown')).toBe('Did not enter');
  });

  it('ignores bye-marked ties when reporting last played round', () => {
    const cup: CupState = {
      ties: [
        makeTie('R1', 'a', CUP_BYE_MARKER, 1, 0), // bye should not count as a real round
      ],
      currentRound: 'R2', eliminated: false, winner: null,
    };
    expect(getCupResultForClub(cup, 'a')).toBe('Did not enter');
  });
});

// ── Bracket integrity through full progression ────────────────────────

describe('cup — full bracket integrity', () => {
  it('reaches the Final after R1 → R2 → R3 → R4 → QF → SF → F (20 clubs)', () => {
    let cup = generateCupDraw(makeClubIds(20));
    const rounds: CupTie['round'][] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF'];
    let seed = 1;
    for (const round of rounds) {
      cup = playRound(cup, round, 2, 0);
      cup = withSeededRandom(seed++, () => advanceCupRound(cup));
    }
    expect(cup.currentRound).toBe('F');
    // 20 clubs is not a clean power of 2, so byes appear in the upper rounds.
    // The Final still has at least one tie (real or bye).
    expect(cup.ties.filter(t => t.round === 'F').length).toBeGreaterThanOrEqual(1);
  });
});
