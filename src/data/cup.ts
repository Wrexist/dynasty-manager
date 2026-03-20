import { CupTie, CupRound, CupState, Club } from '@/types/game';

const CUP_WEEKS: Record<CupRound, number> = {
  R1: 4,   // Lower-league clubs enter
  R2: 8,   // 64 → 32
  R3: 14,  // Div-1 clubs typically enter here
  R4: 20,  // Round of 16
  QF: 28,  // Quarter-finals
  SF: 36,  // Semi-finals
  F: 42,   // Final (after regular season)
};

const ROUND_ORDER: CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];

/**
 * Generate a 92-club cup draw with staggered entry.
 * - Div-1 (20 clubs) + top 16 div-2 clubs by reputation get byes to R2 (36 byes).
 * - Remaining 56 clubs play R1 (28 matches), producing 28 winners.
 * - R2: 28 winners + 36 bye clubs = 64 → 32 matches.
 * - R3 onwards: standard knockout.
 *
 * If fewer than 92 clubs, falls back to a simple all-in first round.
 */
export function generateCupDraw(clubIds: string[], clubs?: Record<string, Club>): CupState {
  const ties: CupTie[] = [];

  if (clubs && clubIds.length >= 60) {
    // Categorize clubs by division
    const div1Clubs: string[] = [];
    const div2Clubs: string[] = [];
    const lowerClubs: string[] = [];

    for (const id of clubIds) {
      const c = clubs[id];
      if (!c) continue;
      if (c.divisionId === 'div-1') div1Clubs.push(id);
      else if (c.divisionId === 'div-2') div2Clubs.push(id);
      else lowerClubs.push(id);
    }

    // Top 16 div-2 clubs by reputation get byes
    const div2Sorted = [...div2Clubs].sort((a, b) => (clubs[b]?.reputation || 0) - (clubs[a]?.reputation || 0));
    const div2Byes = div2Sorted.slice(0, 16);
    const div2Playing = div2Sorted.slice(16);

    // Bye clubs: all div-1 + top 16 div-2
    const byeClubs = [...div1Clubs, ...div2Byes].sort(() => Math.random() - 0.5);

    // R1 entrants: remaining div-2 + all div-3/4
    const r1Entrants = [...div2Playing, ...lowerClubs].sort(() => Math.random() - 0.5);

    // Create R1 ties (pair up R1 entrants)
    for (let i = 0; i + 1 < r1Entrants.length; i += 2) {
      ties.push({
        id: crypto.randomUUID(),
        round: 'R1',
        homeClubId: r1Entrants[i],
        awayClubId: r1Entrants[i + 1],
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        week: CUP_WEEKS.R1,
      });
    }
    // If odd number, last club gets a bye (treated as R1 winner)
    const r1OddByeClub = r1Entrants.length % 2 === 1 ? r1Entrants[r1Entrants.length - 1] : null;

    // Store bye clubs for R2 draw generation in advanceCupRound
    // We encode them as "pre-generated" R2 entries with placeholder opponents
    // Actually, we'll generate R2 ties when R1 completes in advanceCupRound
    // Store bye clubs in a special way: create dummy "bye" ties that are auto-played
    for (const id of byeClubs) {
      ties.push({
        id: crypto.randomUUID(),
        round: 'R1',
        homeClubId: id,
        awayClubId: '__BYE__',
        played: true,
        homeGoals: 1,
        awayGoals: 0,
        week: CUP_WEEKS.R1,
      });
    }
    if (r1OddByeClub) {
      ties.push({
        id: crypto.randomUUID(),
        round: 'R1',
        homeClubId: r1OddByeClub,
        awayClubId: '__BYE__',
        played: true,
        homeGoals: 1,
        awayGoals: 0,
        week: CUP_WEEKS.R1,
      });
    }
  } else {
    // Fallback: simple all-in first round (legacy / small club count)
    const shuffled = [...clubIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      ties.push({
        id: crypto.randomUUID(),
        round: 'R1',
        homeClubId: shuffled[i],
        awayClubId: shuffled[i + 1],
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        week: CUP_WEEKS.R1,
      });
    }
  }

  return {
    ties,
    currentRound: 'R1',
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

  // Get winners from current round (draws decided by penalties — random)
  const currentTies = cup.ties.filter(t => t.round === currentRound && t.played);
  const winners = currentTies.map(t => {
    // Bye ties: home club always wins
    if (t.awayClubId === '__BYE__') return t.homeClubId;
    return t.homeGoals > t.awayGoals ? t.homeClubId :
      t.awayGoals > t.homeGoals ? t.awayClubId :
      Math.random() < 0.5 ? t.homeClubId : t.awayClubId;
  });

  // Shuffle winners for next round draw
  const shuffled = [...winners].sort(() => Math.random() - 0.5);

  // Generate next round fixtures
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
  // Handle odd number of winners: last club gets a bye
  if (shuffled.length % 2 === 1) {
    newTies.push({
      id: crypto.randomUUID(),
      round: nextRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: '__BYE__',
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
    t.played && (t.homeClubId === clubId || t.awayClubId === clubId) && t.awayClubId !== '__BYE__'
  );
  if (clubTies.length === 0) return 'Did not enter';
  const lastTie = clubTies[clubTies.length - 1];
  return getRoundName(lastTie.round);
}

export { CUP_WEEKS, ROUND_ORDER };
