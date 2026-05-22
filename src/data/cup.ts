import { CupTie, CupRound, CupState, Club, Player } from '@/types/game';
import { shuffle } from '@/utils/helpers';
import { getClubGKQuality, simulatePenaltyShootout } from '@/utils/penaltyShootout';

export const CUP_BYE_MARKER = '__BYE__';

// Cup round weeks. The Final sits at week 43 specifically to dodge the
// continental SF second leg (weeks 41-42) and the continental Final
// (week 44): the player's continental knockout ties are NOT auto-simulated
// by weekAdvance (simulateKnockoutLeg skips the player's own tie, expecting
// interactive play), and `playCurrentMatchImpl` resolves a cup tie BEFORE a
// continental match on the same week — so a cup-final/continental-SF week
// collision would strand the continental tie unresolved and hang the
// tournament. Week 43 is also clear of the League Cup Final (week 40).
const CUP_WEEKS: Record<CupRound, number> = {
  R1: 4,
  R2: 8,
  R3: 14,
  R4: 20,
  QF: 28,
  SF: 36,
  F: 43,
};

const ROUND_ORDER: CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];

/**
 * Generate a domestic cup draw for all clubs in the player's league.
 *
 * A clean knockout needs a power-of-two field. We reduce the entrant count
 * to the largest power of two <= N with a single preliminary round of byes,
 * then run a strictly bye-free bracket. The rounds used are the LAST
 * `1 + log2(target)` entries of ROUND_ORDER so the decider always lands on
 * the 'F' slot — earlier round slots simply go unused for small fields.
 *
 * This replaces the old approach, which paired a non-power-of-two field
 * (e.g. a 24-club division) at R1 and let byes accumulate deep in the
 * bracket — that could leave the Final itself an unplayed walkover bye and
 * hand a club the trophy without a final being contested.
 */
export function generateCupDraw(clubIds: string[]): CupState {
  const shuffled = shuffle([...clubIds]);
  const n = shuffled.length;

  const mkTie = (round: CupRound, home: string, away: string, isBye: boolean): CupTie => ({
    id: crypto.randomUUID(),
    round,
    homeClubId: home,
    awayClubId: away,
    played: isBye,
    homeGoals: isBye ? 1 : 0,
    awayGoals: 0,
    week: CUP_WEEKS[round],
  });

  // Degenerate field — nothing to contest.
  if (n < 2) {
    return { ties: [], currentRound: null, eliminated: false, winner: null };
  }

  // Largest power of two <= n.
  let target = 1;
  while (target * 2 <= n) target *= 2;

  const needsPrelim = n > target;
  const cleanRounds = Math.max(1, Math.round(Math.log2(target)));
  const totalRounds = cleanRounds + (needsPrelim ? 1 : 0);
  const startIdx = Math.max(0, ROUND_ORDER.length - totalRounds);
  const startRound = ROUND_ORDER[startIdx];

  const ties: CupTie[] = [];
  if (needsPrelim) {
    // (n - target) ties are played; the remaining clubs get a bye, leaving
    // exactly `target` clubs (a power of two) for the next round.
    const tieCount = n - target;
    for (let i = 0; i < tieCount; i++) {
      ties.push(mkTie(startRound, shuffled[i * 2], shuffled[i * 2 + 1], false));
    }
    for (let i = tieCount * 2; i < n; i++) {
      ties.push(mkTie(startRound, shuffled[i], CUP_BYE_MARKER, true));
    }
  } else {
    // n is already a power of two — straight pairings, no byes anywhere.
    for (let i = 0; i + 1 < n; i += 2) {
      ties.push(mkTie(startRound, shuffled[i], shuffled[i + 1], false));
    }
  }

  return { ties, currentRound: startRound, eliminated: false, winner: null };
}

export function advanceCupRound(
  cup: CupState,
  clubs: Record<string, Club> = {},
  players: Record<string, Player> = {},
): CupState {
  const currentRound = cup.currentRound;
  if (!currentRound || currentRound === 'F') return cup;

  const roundIdx = ROUND_ORDER.indexOf(currentRound);
  const nextRound = ROUND_ORDER[roundIdx + 1];
  if (!nextRound) return cup;

  // Get winners from current round
  const currentTies = cup.ties.filter(t => t.round === currentRound && t.played);
  // Resolve drawn ties with penalty shootout simulation
  const updatedTies = [...cup.ties];
  const winners = currentTies.map(t => {
    if (t.awayClubId === CUP_BYE_MARKER) return t.homeClubId;
    if (t.homeGoals > t.awayGoals) return t.homeClubId;
    if (t.awayGoals > t.homeGoals) return t.awayClubId;
    // Penalty shootout for drawn matches — routes through the shared helper
    // so AI cup ties use the same GK-quality-weighted formula and early-
    // termination logic as user-facing shootouts. Empty clubs/players maps
    // fall back to neutral 0.5 GK quality, which preserves the legacy
    // behaviour for callers that haven't yet wired the context through.
    const homeClub = clubs[t.homeClubId];
    const awayClub = clubs[t.awayClubId];
    const so = simulatePenaltyShootout({
      homeName: homeClub?.shortName || t.homeClubId,
      awayName: awayClub?.shortName || t.awayClubId,
      homeGKQuality: getClubGKQuality(homeClub, players),
      awayGKQuality: getClubGKQuality(awayClub, players),
    });
    const tieIdx = updatedTies.findIndex(ut => ut.id === t.id);
    if (tieIdx >= 0) {
      updatedTies[tieIdx] = { ...updatedTies[tieIdx], penaltyShootout: { home: so.homeScore, away: so.awayScore } };
    }
    return so.winner === 'home' ? t.homeClubId : t.awayClubId;
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
    ties: [...updatedTies, ...newTies],
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
