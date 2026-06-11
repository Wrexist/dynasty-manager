/**
 * League Cup bracket integrity (S2-H4 regression).
 *
 * The old draw paired the full field at a heuristic start round and let
 * byes cascade — a 20-club league's "Final" was a pre-played walkover bye,
 * so the trophy was crowned without a final and the winner's prize money
 * (paid only when the player plays the F round) was silently skipped.
 * The draw now uses the same power-of-two prelim bracket as the main cup.
 */
import { describe, it, expect } from 'vitest';
import { generateLeagueCupDraw, advanceLeagueCupRound } from '@/store/slices/orchestration/tournaments';
import { CUP_BYE_MARKER } from '@/data/cup';

const makeClubIds = (n: number) => Array.from({ length: n }, (_, i) => `club-${i}`);

function playRound(cup: ReturnType<typeof generateLeagueCupDraw>) {
  return {
    ...cup,
    ties: cup.ties.map(t =>
      t.round === cup.currentRound && !t.played
        ? { ...t, played: true, homeGoals: 1, awayGoals: 0 }
        : t,
    ),
  };
}

describe('generateLeagueCupDraw', () => {
  it.each([[10], [12], [16], [18], [20], [24]])('a %i-club field always reaches a real contested Final', (n) => {
    let cup = generateLeagueCupDraw(makeClubIds(n));
    let guard = 0;
    while (cup.currentRound && cup.currentRound !== 'F' && guard++ < 8) {
      cup = playRound(cup);
      cup = advanceLeagueCupRound(cup);
    }
    expect(cup.currentRound).toBe('F');
    const finals = cup.ties.filter(t => t.round === 'F');
    expect(finals).toHaveLength(1);
    expect(finals[0].awayClubId).not.toBe(CUP_BYE_MARKER);
    expect(finals[0].played).toBe(false); // a real match to contest, not a walkover
  });

  it('byes only ever appear in the preliminary (start) round', () => {
    let cup = generateLeagueCupDraw(makeClubIds(20));
    const startRound = cup.currentRound;
    let guard = 0;
    while (cup.currentRound && cup.currentRound !== 'F' && guard++ < 8) {
      cup = playRound(cup);
      cup = advanceLeagueCupRound(cup);
    }
    for (const tie of cup.ties) {
      if (tie.awayClubId === CUP_BYE_MARKER) {
        expect(tie.round, 'bye outside the prelim round').toBe(startRound);
      }
    }
  });

  it('stamps a winnerId on drawn ties when advancing', () => {
    let cup = generateLeagueCupDraw(makeClubIds(8));
    cup = {
      ...cup,
      ties: cup.ties.map(t => ({ ...t, played: true, homeGoals: 1, awayGoals: 1 })),
    };
    const advanced = advanceLeagueCupRound(cup);
    for (const tie of advanced.ties.filter(t => t.round === cup.currentRound)) {
      expect(tie.winnerId, 'drawn tie must carry its resolved winner').toBeTruthy();
    }
  });
});
