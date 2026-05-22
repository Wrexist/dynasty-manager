/**
 * Phase 5a — Cup competition progression & penalty shootout resolution.
 *
 * Extends the basic coverage in cup.test.ts with the bracket-shape, penalty
 * shootout, and bye edge cases that affect end-of-season history reporting.
 *
 * The cup draw seeds a clean power-of-two bracket via a single preliminary
 * round of byes, then runs strictly bye-free. The rounds used are the last
 * `1 + log2(target)` slots of ROUND_ORDER so the decider always lands on 'F'.
 *
 * Bugs here surface as:
 *   - Drawn ties producing two winners or no winner (advance crash)
 *   - Bye-marked ties advancing both clubs
 *   - A non-power-of-two field leaving the Final an unplayed walkover bye
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
  it('seeds large fields (20, 24) into a clean bracket starting at R3', () => {
    // 20 and 24 both reduce to a 16-club power-of-two field via byes.
    expect(generateCupDraw(makeClubIds(20)).currentRound).toBe('R3');
    expect(generateCupDraw(makeClubIds(24)).currentRound).toBe('R3');
  });

  it('starts a 16-team field at R4 with straight pairings and no byes', () => {
    const cup = generateCupDraw(makeClubIds(16));
    expect(cup.currentRound).toBe('R4');
    expect(cup.ties.filter(t => t.awayClubId !== CUP_BYE_MARKER)).toHaveLength(8);
    expect(cup.ties.filter(t => t.awayClubId === CUP_BYE_MARKER)).toHaveLength(0);
  });

  it('starts small fields late (8 → QF, 4 → SF)', () => {
    expect(generateCupDraw(makeClubIds(8)).currentRound).toBe('QF');
    expect(generateCupDraw(makeClubIds(4)).currentRound).toBe('SF');
  });

  it('marks every preliminary-round bye as already played with a home win', () => {
    const cup = generateCupDraw(makeClubIds(21)); // 21 → 16: 5 ties + 11 byes
    const byeTie = cup.ties.find(t => t.awayClubId === CUP_BYE_MARKER);
    expect(byeTie).toBeDefined();
    expect(byeTie!.played).toBe(true);
    expect(byeTie!.homeGoals).toBe(1);
    expect(byeTie!.awayGoals).toBe(0);
  });

  it('places ties in the start round\'s CUP_WEEKS slot', () => {
    const cup20 = generateCupDraw(makeClubIds(20));
    expect(cup20.ties.every(t => t.week === getCupWeek('R3'))).toBe(true);
    const cup16 = generateCupDraw(makeClubIds(16));
    expect(cup16.ties.every(t => t.week === getCupWeek('R4'))).toBe(true);
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
  it('carries preliminary-round bye clubs into the next round', () => {
    // 20 clubs → R3 with 4 contested ties + 12 byes.
    const cup = generateCupDraw(makeClubIds(20));
    const byeClubs = cup.ties
      .filter(t => t.awayClubId === CUP_BYE_MARKER)
      .map(t => t.homeClubId);
    expect(byeClubs).toHaveLength(12);

    const played = playRound(cup, 'R3', 2, 1);
    const advanced = withSeededRandom(1, () => advanceCupRound(played));
    expect(advanced.currentRound).toBe('R4');

    const r4Clubs = new Set(
      advanced.ties.filter(t => t.round === 'R4').flatMap(t => [t.homeClubId, t.awayClubId]),
    );
    for (const c of byeClubs) expect(r4Clubs.has(c)).toBe(true);
  });

  it('returns the same state when called on the Final', () => {
    const cup: CupState = {
      ties: [{ id: 'final', round: 'F', homeClubId: 'a', awayClubId: 'b',
        played: true, homeGoals: 2, awayGoals: 1, week: getCupWeek('F') }],
      currentRound: 'F', eliminated: false, winner: null,
    };
    expect(advanceCupRound(cup).currentRound).toBe('F');
  });

  it('progresses through ROUND_ORDER halving the bracket each round (R4 → QF → SF → F)', () => {
    // 16 clubs start at R4 → 8 → 4 → 2 → 1.
    let cup = generateCupDraw(makeClubIds(16));
    expect(cup.currentRound).toBe('R4');
    expect(cup.ties.filter(t => t.round === 'R4')).toHaveLength(8);

    cup = playRound(cup, 'R4', 2, 1);
    cup = withSeededRandom(1, () => advanceCupRound(cup));
    expect(cup.currentRound).toBe('QF');
    expect(cup.ties.filter(t => t.round === 'QF')).toHaveLength(4);

    cup = playRound(cup, 'QF', 2, 1);
    cup = withSeededRandom(2, () => advanceCupRound(cup));
    expect(cup.currentRound).toBe('SF');
    expect(cup.ties.filter(t => t.round === 'SF')).toHaveLength(2);

    cup = playRound(cup, 'SF', 3, 0);
    cup = withSeededRandom(3, () => advanceCupRound(cup));
    expect(cup.currentRound).toBe('F');
    expect(cup.ties.filter(t => t.round === 'F')).toHaveLength(1);
  });
});

// ── Penalty shootout resolution ───────────────────────────────────────

describe('advanceCupRound — penalty shootouts', () => {
  it('resolves drawn ties via penalties (no double-winner, no missing winner)', () => {
    const cup = generateCupDraw(makeClubIds(20)); // R3: 4 contested ties + 12 byes
    const drawn = playRound(cup, 'R3', 1, 1);
    const advanced = withSeededRandom(42, () => advanceCupRound(drawn));
    expect(advanced.currentRound).toBe('R4');
    // 4 penalty-resolved winners + 12 byes = 16 → 8 R4 ties.
    expect(advanced.ties.filter(t => t.round === 'R4')).toHaveLength(8);

    // Every contested R3 tie records a decisive shootout; byes do not.
    const contested = advanced.ties.filter(t => t.round === 'R3' && t.awayClubId !== CUP_BYE_MARKER);
    expect(contested).toHaveLength(4);
    for (const tie of contested) {
      expect(tie.penaltyShootout).toBeDefined();
      expect(tie.penaltyShootout!.home).not.toBe(tie.penaltyShootout!.away);
    }
  });

  it('does not record a shootout for ties resolved in regulation', () => {
    const cup = generateCupDraw(makeClubIds(20));
    const decided = playRound(cup, 'R3', 3, 1); // home wins outright
    const advanced = withSeededRandom(99, () => advanceCupRound(decided));
    for (const tie of advanced.ties.filter(t => t.round === 'R3')) {
      expect(tie.penaltyShootout).toBeUndefined();
    }
  });

  it('shootout score stays within a sane bound', () => {
    const cup = generateCupDraw(makeClubIds(20));
    const drawn = playRound(cup, 'R3', 0, 0);
    const advanced = withSeededRandom(7, () => advanceCupRound(drawn));
    const contested = advanced.ties.filter(t => t.round === 'R3' && t.awayClubId !== CUP_BYE_MARKER);
    for (const tie of contested) {
      expect(tie.penaltyShootout!.home).toBeGreaterThanOrEqual(0);
      expect(tie.penaltyShootout!.away).toBeGreaterThanOrEqual(0);
      // 5 kicks each minimum, plus optional sudden-death rounds. A generous
      // ceiling so the test fails loudly if the loop ever escapes containment.
      expect(tie.penaltyShootout!.home).toBeLessThan(CUP_PENALTY_KICKS + 50);
      expect(tie.penaltyShootout!.away).toBeLessThan(CUP_PENALTY_KICKS + 50);
    }
  });

  it('terminates even with sudden death (4-club field)', () => {
    const cup = generateCupDraw(makeClubIds(4)); // → SF, 2 ties
    cup.ties.forEach(t => {
      t.played = true; t.homeGoals = 1; t.awayGoals = 1;
    });
    const start = Date.now();
    const advanced = withSeededRandom(1234, () => advanceCupRound(cup));
    expect(Date.now() - start).toBeLessThan(1000); // sanity bound — ms, not seconds
    expect(advanced.currentRound).toBe('F');
    expect(advanced.ties.filter(t => t.round === 'SF').every(t =>
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
  it('a 20-club cup runs R3 → R4 → QF → SF → F and reaches a real, contested Final', () => {
    let cup = generateCupDraw(makeClubIds(20));
    expect(cup.currentRound).toBe('R3');
    const rounds: CupTie['round'][] = ['R3', 'R4', 'QF', 'SF'];
    let seed = 1;
    for (const round of rounds) {
      cup = playRound(cup, round, 2, 0);
      cup = withSeededRandom(seed++, () => advanceCupRound(cup));
    }
    expect(cup.currentRound).toBe('F');
    const finalTies = cup.ties.filter(t => t.round === 'F');
    expect(finalTies).toHaveLength(1);
    // Clean bracket — the Final is always a real contested tie, never a bye.
    expect(finalTies[0].homeClubId).not.toBe(CUP_BYE_MARKER);
    expect(finalTies[0].awayClubId).not.toBe(CUP_BYE_MARKER);
  });
});
