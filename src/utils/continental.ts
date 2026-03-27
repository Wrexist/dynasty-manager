/**
 * Continental tournament logic: match simulation, group advancement, knockout resolution.
 */
import type { ContinentalTournamentState, ContinentalKnockoutTie, VirtualClub, ContinentalCompetition, Club, Player, FormationType } from '@/types/game';
import {
  CONTINENTAL_R16_WEEKS, CONTINENTAL_QF_WEEKS, CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK,
  CONTINENTAL_EXTRA_TIME_GOAL_CHANCE,
  CONTINENTAL_PENALTY_KICKS, CONTINENTAL_PENALTY_CONVERSION,
} from '@/config/continental';
import { generateSquad } from '@/utils/playerGen';
import { shuffle } from '@/utils/helpers';

// ── Simplified Match Simulation ──

/**
 * Simulate a continental match using reputation-based scoring.
 * Returns { homeGoals, awayGoals }.
 * Higher reputation → more likely to score.
 */
export function simulateContinentalMatch(
  homeRep: number,
  awayRep: number,
): { homeGoals: number; awayGoals: number } {
  // Base scoring chance scaled by reputation (1-5 scale → 0.3-1.0)
  const homeStrength = 0.2 + (homeRep / 5) * 0.6 + 0.1; // home advantage
  const awayStrength = 0.2 + (awayRep / 5) * 0.6;

  // Poisson-like goal generation: average goals ~ strength * 1.5
  const homeExpected = homeStrength * 1.5;
  const awayExpected = awayStrength * 1.5;

  const homeGoals = poissonRandom(homeExpected);
  const awayGoals = poissonRandom(awayExpected);

  return { homeGoals, awayGoals };
}

/** Simple Poisson random number generator */
function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ── Group Stage ──

/**
 * Simulate all unplayed matches for a given matchday in the tournament.
 * Skips the player's match (that's played interactively).
 */
export function simulateGroupMatchday(
  tournament: ContinentalTournamentState,
  matchday: number,
  virtualClubs: Record<string, VirtualClub>,
  playerClubId: string,
): ContinentalTournamentState {
  const newGroups = tournament.groups.map(group => {
    const newMatches = group.matches.map(m => {
      if (m.matchday !== matchday || m.played) return m;
      // Skip player's match — they play interactively
      if (m.homeClubId === playerClubId || m.awayClubId === playerClubId) return m;

      const homeRep = virtualClubs[m.homeClubId]?.reputation || 3;
      const awayRep = virtualClubs[m.awayClubId]?.reputation || 3;
      const { homeGoals, awayGoals } = simulateContinentalMatch(homeRep, awayRep);

      return { ...m, played: true, homeGoals, awayGoals };
    });

    // Recalculate standings
    const standings = recalculateStandings(group.clubIds, newMatches);

    return { ...group, matches: newMatches, standings };
  });

  return { ...tournament, groups: newGroups };
}

/**
 * Recalculate group standings from all played matches.
 */
function recalculateStandings(
  clubIds: string[],
  matches: ContinentalTournamentState['groups'][0]['matches'],
) {
  const stats: Record<string, { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }> = {};
  for (const cid of clubIds) {
    stats[cid] = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
  }

  for (const m of matches) {
    if (!m.played) continue;
    const h = stats[m.homeClubId];
    const a = stats[m.awayClubId];
    if (!h || !a) continue;

    h.played++; a.played++;
    h.goalsFor += m.homeGoals; h.goalsAgainst += m.awayGoals;
    a.goalsFor += m.awayGoals; a.goalsAgainst += m.homeGoals;

    if (m.homeGoals > m.awayGoals) {
      h.won++; h.points += 3;
      a.lost++;
    } else if (m.homeGoals < m.awayGoals) {
      a.won++; a.points += 3;
      h.lost++;
    } else {
      h.drawn++; h.points += 1;
      a.drawn++; a.points += 1;
    }
  }

  return clubIds
    .map(cid => ({ clubId: cid, ...stats[cid] }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
}

/**
 * Check if all group stage matches are complete (all 6 matchdays played).
 */
export function isGroupStageComplete(tournament: ContinentalTournamentState): boolean {
  return tournament.groups.every(g => g.matches.every(m => m.played));
}

/**
 * Check if a specific matchday is complete across all groups.
 */
export function isMatchdayComplete(tournament: ContinentalTournamentState, matchday: number): boolean {
  return tournament.groups.every(g =>
    g.matches.filter(m => m.matchday === matchday).every(m => m.played)
  );
}

/**
 * Get the current matchday number (first incomplete matchday).
 */
export function getCurrentMatchday(tournament: ContinentalTournamentState): number {
  for (let md = 1; md <= 6; md++) {
    if (!isMatchdayComplete(tournament, md)) return md;
  }
  return 6;
}

// ── Knockout Stage ──

/**
 * Generate Round of 16 ties from group stage results.
 * Group winners face group runners-up (no same-group or same-league matchups where possible).
 */
export function generateKnockoutFromGroups(
  tournament: ContinentalTournamentState,
  playerClubId: string,
): ContinentalTournamentState {
  const winners: string[] = [];
  const runnersUp: string[] = [];

  for (const group of tournament.groups) {
    if (group.standings.length >= 2) {
      winners.push(group.standings[0].clubId);
      runnersUp.push(group.standings[1].clubId);
    }
  }

  // Match winners vs runners-up, avoiding same-group matchups
  const shuffledRunners = shuffle([...runnersUp]);
  const ties: ContinentalKnockoutTie[] = [];

  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    // Find a runner-up not from the same group
    let matchedIdx = shuffledRunners.findIndex(ru => {
      const winnerGroup = tournament.groups.find(g => g.clubIds.includes(winner));
      const ruGroup = tournament.groups.find(g => g.clubIds.includes(ru));
      return winnerGroup?.id !== ruGroup?.id;
    });
    if (matchedIdx === -1) matchedIdx = 0; // fallback

    const runnerUp = shuffledRunners.splice(matchedIdx, 1)[0];
    ties.push({
      id: crypto.randomUUID(),
      round: 'R16',
      homeClubId: winner,
      awayClubId: runnerUp,
      leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0,
      leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
      week1: CONTINENTAL_R16_WEEKS[0],
      week2: CONTINENTAL_R16_WEEKS[1],
      winnerId: null,
    });
  }

  // Check if player is eliminated (finished 3rd or 4th in group)
  const playerInKnockout = ties.some(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId);

  return {
    ...tournament,
    knockoutTies: ties,
    currentPhase: 'knockout',
    currentRound: 'R16',
    playerEliminated: !playerInKnockout,
  };
}

/**
 * Simulate all non-player knockout ties for the current round and given leg.
 */
export function simulateKnockoutLeg(
  tournament: ContinentalTournamentState,
  round: 'R16' | 'QF' | 'SF' | 'F',
  leg: 1 | 2,
  virtualClubs: Record<string, VirtualClub>,
  playerClubId: string,
): ContinentalTournamentState {
  const newTies = tournament.knockoutTies.map(tie => {
    if (tie.round !== round) return tie;
    const isPlayerTie = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
    if (isPlayerTie) return tie; // Player plays interactively

    if (leg === 1 && !tie.leg1Played) {
      const homeRep = virtualClubs[tie.homeClubId]?.reputation || 3;
      const awayRep = virtualClubs[tie.awayClubId]?.reputation || 3;
      const { homeGoals, awayGoals } = simulateContinentalMatch(homeRep, awayRep);
      return { ...tie, leg1Played: true, leg1HomeGoals: homeGoals, leg1AwayGoals: awayGoals };
    }

    if (leg === 2 && tie.leg1Played && !tie.leg2Played) {
      const homeRep = virtualClubs[tie.awayClubId]?.reputation || 3; // leg 2 reverses home/away
      const awayRep = virtualClubs[tie.homeClubId]?.reputation || 3;
      const { homeGoals, awayGoals } = simulateContinentalMatch(homeRep, awayRep);

      const newTie = { ...tie, leg2Played: true, leg2HomeGoals: homeGoals, leg2AwayGoals: awayGoals };
      // Resolve the tie
      return resolveKnockoutTie(newTie, virtualClubs);
    }

    // For finals (single leg)
    if (round === 'F' && leg === 1 && !tie.leg1Played) {
      const homeRep = virtualClubs[tie.homeClubId]?.reputation || 3;
      const awayRep = virtualClubs[tie.awayClubId]?.reputation || 3;
      const { homeGoals, awayGoals } = simulateContinentalMatch(homeRep, awayRep);
      let newTie = { ...tie, leg1Played: true, leg1HomeGoals: homeGoals, leg1AwayGoals: awayGoals };
      // Resolve immediately for finals
      if (homeGoals !== awayGoals) {
        newTie.winnerId = homeGoals > awayGoals ? tie.homeClubId : tie.awayClubId;
      } else {
        // Extra time + penalties for final
        newTie = resolveDrawnFinal(newTie, virtualClubs);
      }
      return newTie;
    }

    return tie;
  });

  return { ...tournament, knockoutTies: newTies };
}

/**
 * Resolve a 2-leg knockout tie after both legs are played.
 * Uses aggregate score, then extra time simulation, then penalties.
 */
function resolveKnockoutTie(
  tie: ContinentalKnockoutTie,
  virtualClubs: Record<string, VirtualClub>,
): ContinentalKnockoutTie {
  // Aggregate: home team goals = leg1Home + leg2Away, away team goals = leg1Away + leg2Home
  const homeAgg = tie.leg1HomeGoals + tie.leg2AwayGoals;
  const awayAgg = tie.leg1AwayGoals + tie.leg2HomeGoals;

  if (homeAgg !== awayAgg) {
    return { ...tie, winnerId: homeAgg > awayAgg ? tie.homeClubId : tie.awayClubId };
  }

  // Away goals rule (traditional)
  const homeAwayGoals = tie.leg2AwayGoals; // home team scored these away
  const awayAwayGoals = tie.leg1AwayGoals; // away team scored these away
  if (homeAwayGoals !== awayAwayGoals) {
    return { ...tie, winnerId: homeAwayGoals > awayAwayGoals ? tie.homeClubId : tie.awayClubId };
  }

  // Extra time simulation (simplified)
  const homeRep = virtualClubs[tie.awayClubId]?.reputation || 3; // leg 2 is at away team's home
  const awayRep = virtualClubs[tie.homeClubId]?.reputation || 3;
  let extraHome = 0, extraAway = 0;
  if (Math.random() < CONTINENTAL_EXTRA_TIME_GOAL_CHANCE * (awayRep / 5)) extraAway++;
  if (Math.random() < CONTINENTAL_EXTRA_TIME_GOAL_CHANCE * (homeRep / 5)) extraHome++;

  if (extraHome !== extraAway) {
    // extraHome = goals by leg2 home team (= original away team)
    // extraAway = goals by leg2 away team (= original home team)
    const winnerId = extraAway > extraHome ? tie.homeClubId : tie.awayClubId;
    return { ...tie, winnerId };
  }

  // Penalties
  const penResult = simulatePenalties();
  return {
    ...tie,
    winnerId: penResult.home > penResult.away ? tie.awayClubId : tie.homeClubId, // leg2 home is original away
    penaltyShootout: penResult,
  };
}

/**
 * Resolve a drawn final (single leg) with extra time + penalties.
 */
function resolveDrawnFinal(
  tie: ContinentalKnockoutTie,
  virtualClubs: Record<string, VirtualClub>,
): ContinentalKnockoutTie {
  const homeRep = virtualClubs[tie.homeClubId]?.reputation || 3;
  const awayRep = virtualClubs[tie.awayClubId]?.reputation || 3;

  let extraHome = 0, extraAway = 0;
  if (Math.random() < CONTINENTAL_EXTRA_TIME_GOAL_CHANCE * (homeRep / 5)) extraHome++;
  if (Math.random() < CONTINENTAL_EXTRA_TIME_GOAL_CHANCE * (awayRep / 5)) extraAway++;

  if (extraHome !== extraAway) {
    return {
      ...tie,
      leg1HomeGoals: tie.leg1HomeGoals + extraHome,
      leg1AwayGoals: tie.leg1AwayGoals + extraAway,
      winnerId: (tie.leg1HomeGoals + extraHome) > (tie.leg1AwayGoals + extraAway) ? tie.homeClubId : tie.awayClubId,
    };
  }

  const penResult = simulatePenalties();
  return {
    ...tie,
    winnerId: penResult.home > penResult.away ? tie.homeClubId : tie.awayClubId,
    penaltyShootout: penResult,
  };
}

/**
 * Simulate a penalty shootout. Returns { home, away } scores.
 */
function simulatePenalties(): { home: number; away: number } {
  let home = 0, away = 0;
  for (let i = 0; i < CONTINENTAL_PENALTY_KICKS; i++) {
    if (Math.random() < CONTINENTAL_PENALTY_CONVERSION) home++;
    if (Math.random() < CONTINENTAL_PENALTY_CONVERSION) away++;
  }
  // Sudden death
  while (home === away) {
    if (Math.random() < CONTINENTAL_PENALTY_CONVERSION) home++; else home += 0;
    if (Math.random() < CONTINENTAL_PENALTY_CONVERSION) away++; else away += 0;
    // If both score or both miss, continue
    if (home === away) continue;
  }
  return { home, away };
}

/**
 * Check if a knockout round is complete (all ties resolved).
 */
export function isKnockoutRoundComplete(tournament: ContinentalTournamentState, round: 'R16' | 'QF' | 'SF' | 'F'): boolean {
  const roundTies = tournament.knockoutTies.filter(t => t.round === round);
  if (roundTies.length === 0) return false;
  if (round === 'F') {
    return roundTies.every(t => t.winnerId !== null);
  }
  return roundTies.every(t => t.winnerId !== null);
}

/**
 * Advance to the next knockout round by creating new ties from winners.
 */
export function advanceKnockoutRound(
  tournament: ContinentalTournamentState,
  playerClubId: string,
): ContinentalTournamentState {
  const currentRound = tournament.currentRound as 'R16' | 'QF' | 'SF' | 'F';
  const currentTies = tournament.knockoutTies.filter(t => t.round === currentRound);
  const winners = currentTies.map(t => t.winnerId!).filter(Boolean);

  if (currentRound === 'F') {
    // Tournament complete
    return {
      ...tournament,
      currentPhase: 'complete',
      currentRound: null,
      winnerId: winners[0] || null,
    };
  }

  const nextRoundMap: Record<string, 'QF' | 'SF' | 'F'> = { R16: 'QF', QF: 'SF', SF: 'F' };
  const nextRound = nextRoundMap[currentRound];
  const weekMap: Record<string, readonly [number, number] | number> = {
    QF: CONTINENTAL_QF_WEEKS,
    SF: CONTINENTAL_SF_WEEKS,
    F: CONTINENTAL_FINAL_WEEK,
  };
  const weeks = weekMap[nextRound];

  const newTies: ContinentalKnockoutTie[] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    const isFinal = nextRound === 'F';
    newTies.push({
      id: crypto.randomUUID(),
      round: nextRound,
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0,
      leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
      week1: typeof weeks === 'number' ? weeks : weeks[0],
      week2: typeof weeks === 'number' ? weeks : (isFinal ? weeks as unknown as number : (weeks as readonly number[])[1]),
      winnerId: null,
    });
  }

  const playerInKnockout = newTies.some(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId);

  return {
    ...tournament,
    knockoutTies: [...tournament.knockoutTies, ...newTies],
    currentRound: nextRound,
    playerEliminated: tournament.playerEliminated || !playerInKnockout,
  };
}

/**
 * Get a human-readable result string for a club's continental campaign.
 */
export function getContinentalResultForClub(
  tournament: ContinentalTournamentState | null,
  clubId: string,
): string {
  if (!tournament) return 'Did not qualify';
  if (tournament.winnerId === clubId) return 'Winner';

  // Check knockout ties
  const knockoutRounds: ('F' | 'SF' | 'QF' | 'R16')[] = ['F', 'SF', 'QF', 'R16'];
  for (const round of knockoutRounds) {
    const tie = tournament.knockoutTies.find(t => t.round === round && (t.homeClubId === clubId || t.awayClubId === clubId));
    if (tie) {
      const roundNames: Record<string, string> = { F: 'Final', SF: 'Semi-Finals', QF: 'Quarter-Finals', R16: 'Round of 16' };
      return roundNames[round] || round;
    }
  }

  // Must have been in group stage
  const group = tournament.groups.find(g => g.clubIds.includes(clubId));
  if (group) return 'Group Stage';

  return 'Did not qualify';
}

/**
 * Get the competition display name.
 */
export function getCompetitionName(competition: ContinentalCompetition): string {
  return competition === 'champions_cup' ? 'Champions Cup' : 'Shield Cup';
}

/**
 * Get knockout round display name.
 */
export function getKnockoutRoundName(round: string): string {
  const names: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' };
  return names[round] || round;
}

// ── Ephemeral Club for Interactive Continental Play ──

/**
 * Create a temporary Club + Player[] from a VirtualClub for interactive match simulation.
 * Quality mapping: rep 5 → quality 80, rep 4 → 72, rep 3 → 64, rep 2 → 56, rep 1 → 48
 */
export function createEphemeralClub(
  vc: VirtualClub,
  season: number,
): { club: Club; players: Record<string, Player> } {
  const quality = 32 + vc.reputation * 10; // rep 1→42, 2→52, 3→62, 4→72, 5→82
  const squad = generateSquad(vc.id, quality, season, vc.leagueId);

  const playerMap: Record<string, Player> = {};
  const playerIds: string[] = [];
  const lineup: string[] = [];
  const subs: string[] = [];

  for (const p of squad) {
    // Prefix with 'vc-' to distinguish from real players
    p.id = `vc-${vc.id}-${p.id}`;
    p.clubId = vc.id;
    playerMap[p.id] = p;
    playerIds.push(p.id);
  }

  // Sort by overall descending, pick best 11 for lineup, rest as subs
  const sorted = [...squad].sort((a, b) => b.overall - a.overall);
  for (let i = 0; i < sorted.length; i++) {
    if (i < 11) lineup.push(sorted[i].id);
    else subs.push(sorted[i].id);
  }

  const club: Club = {
    id: vc.id,
    name: vc.name,
    shortName: vc.shortName,
    color: vc.color,
    secondaryColor: vc.secondaryColor,
    budget: 0,
    wageBill: 0,
    reputation: vc.reputation,
    facilities: Math.min(5, Math.max(1, vc.reputation)),
    youthRating: vc.reputation,
    fanBase: vc.reputation * 20,
    boardPatience: 50,
    playerIds,
    formation: '4-3-3' as FormationType,
    lineup,
    subs,
    divisionId: vc.leagueId as Club['divisionId'],
  };

  return { club, players: playerMap };
}

/**
 * Find the player's continental match for the current week, if any.
 * Returns match info or null.
 */
export function findPlayerContinentalMatch(
  tournament: ContinentalTournamentState | null,
  week: number,
  playerClubId: string,
): { type: 'group'; groupIdx: number; matchIdx: number } | { type: 'knockout'; tieIdx: number; leg: 1 | 2 } | null {
  if (!tournament || tournament.playerEliminated) return null;

  // Check group stage
  if (tournament.currentPhase === 'group') {
    for (let gi = 0; gi < tournament.groups.length; gi++) {
      const group = tournament.groups[gi];
      for (let mi = 0; mi < group.matches.length; mi++) {
        const m = group.matches[mi];
        if (m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)) {
          return { type: 'group', groupIdx: gi, matchIdx: mi };
        }
      }
    }
  }

  // Check knockout
  if (tournament.currentPhase === 'knockout') {
    for (let ti = 0; ti < tournament.knockoutTies.length; ti++) {
      const tie = tournament.knockoutTies[ti];
      if (tie.homeClubId !== playerClubId && tie.awayClubId !== playerClubId) continue;
      if (tie.winnerId) continue; // already resolved
      if (tie.week1 === week && !tie.leg1Played) return { type: 'knockout', tieIdx: ti, leg: 1 };
      if (tie.week2 === week && !tie.leg2Played && tie.round !== 'F') return { type: 'knockout', tieIdx: ti, leg: 2 };
    }
  }

  return null;
}
