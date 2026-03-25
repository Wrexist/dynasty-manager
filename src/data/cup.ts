import { CupTie, CupRound, CupState } from '@/types/game';
import { shuffle } from '@/utils/helpers';

export const CUP_BYE_MARKER = '__BYE__';

const CUP_WEEKS: Record<CupRound, number> = {
  R1: 4,
  R2: 8,
  R3: 14,
  R4: 20,
  QF: 28,
  SF: 36,
  F: 42,
};

const ROUND_ORDER: CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];

/**
 * Generate a domestic cup draw for all clubs in the player's league.
 * Simple knockout bracket — all clubs enter at R1.
 * For leagues with 10-20 teams, the bracket naturally fits within the available rounds.
 */
export function generateCupDraw(clubIds: string[]): CupState {
  const ties: CupTie[] = [];
  const shuffled = shuffle([...clubIds]);

  // Determine the starting round based on the number of clubs
  // We want the final to happen in the later rounds
  // For 20 teams: R1 (20→10), R2 (10→...), etc.
  // For 10 teams: Start at R2 so the final lands at QF/SF
  let startRound: CupRound = 'R1';
  if (shuffled.length <= 8) startRound = 'R3';
  else if (shuffled.length <= 16) startRound = 'R2';

  // Pair up clubs
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    ties.push({
      id: crypto.randomUUID(),
      round: startRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: CUP_WEEKS[startRound],
    });
  }

  // Handle odd number: last club gets a bye
  if (shuffled.length % 2 === 1) {
    ties.push({
      id: crypto.randomUUID(),
      round: startRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: CUP_BYE_MARKER,
      played: true,
      homeGoals: 1,
      awayGoals: 0,
      week: CUP_WEEKS[startRound],
    });
  }

  return {
    ties,
    currentRound: startRound,
    eliminated: false,
    winner: null,
  };
}

export function advanceCupRound(cup: CupState): CupState {
  const currentRound = cup.currentRound;
  if (!currentRound || currentRound === 'F') return cup;

  const roundIdx = ROUND_ORDER.indexOf(currentRound);
  const nextRound = ROUND_ORDER[roundIdx + 1];
  if (!nextRound) return cup;

  // Get winners from current round
  const currentTies = cup.ties.filter(t => t.round === currentRound && t.played);
  const winners = currentTies.map(t => {
    if (t.awayClubId === CUP_BYE_MARKER) return t.homeClubId;
    return t.homeGoals > t.awayGoals ? t.homeClubId :
      t.awayGoals > t.homeGoals ? t.awayClubId :
      Math.random() < 0.5 ? t.homeClubId : t.awayClubId;
  });

  const shuffled = shuffle([...winners]);

  const newTies: CupTie[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    newTies.push({
      id: crypto.randomUUID(),
      round: nextRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: CUP_WEEKS[nextRound],
    });
  }
  if (shuffled.length % 2 === 1) {
    newTies.push({
      id: crypto.randomUUID(),
      round: nextRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: CUP_BYE_MARKER,
      played: true,
      homeGoals: 1,
      awayGoals: 0,
      week: CUP_WEEKS[nextRound],
    });
  }

  return {
    ...cup,
    ties: [...cup.ties, ...newTies],
    currentRound: nextRound,
  };
}

export function getCupWeek(round: CupRound): number {
  return CUP_WEEKS[round];
}

export function getRoundName(round: CupRound): string {
  switch (round) {
    case 'R1': return 'Round 1';
    case 'R2': return 'Round 2';
    case 'R3': return 'Round 3';
    case 'R4': return 'Round of 16';
    case 'QF': return 'Quarter-Finals';
    case 'SF': return 'Semi-Finals';
    case 'F': return 'Final';
  }
}

export function getCupResultForClub(cup: CupState, clubId: string): string {
  if (cup.winner === clubId) return 'Winner';
  const clubTies = cup.ties.filter(t =>
    t.played && (t.homeClubId === clubId || t.awayClubId === clubId) && t.awayClubId !== CUP_BYE_MARKER
  );
  if (clubTies.length === 0) return 'Did not enter';
  const lastTie = clubTies[clubTies.length - 1];
  return getRoundName(lastTie.round);
}

export { CUP_WEEKS, ROUND_ORDER };
