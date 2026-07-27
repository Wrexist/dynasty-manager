/**
 * Continental tournament logic: match simulation, group advancement, knockout resolution.
 */
import type { ContinentalTournamentState, ContinentalKnockoutTie, VirtualClub, Club, Player, FormationType, Match } from '@/types/game';
import {
  getCompetitionCalendar,
  CONTINENTAL_EXTRA_TIME_GOAL_CHANCE,
  CONTINENTAL_PENALTY_KICKS, CONTINENTAL_PENALTY_CONVERSION,
} from '@/config/continental';
import { generateSquad } from '@/utils/playerGen';
import { shuffle, safeRandomUUID } from '@/utils/helpers';
import { simulateMatch } from '@/engine/match';
import { pickAiMatchSquad } from '@/store/slices/orchestration/helpers';

// ── The living world: real-engine continental football ──

/**
 * The instantiated world, if the caller has one. When BOTH sides of a
 * continental fixture are real clubs (living-world foreign leagues + the
 * player's own pyramid), the tie is resolved by the actual match engine
 * instead of the reputation coin flip below — same engine, same tactics,
 * same squad quality that decides every other match in the game.
 *
 * Genuinely virtual filler (a qualifier from a league nobody instantiated)
 * still falls back to the reputation model. That is the ONLY thing the
 * reputation path is for now.
 */
export interface ContinentalWorld {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  week: number;
  season?: number;
  /** Called for every fixture resolved by the real engine, with the XIs that
   *  played. Callers should feed this to `applyAIMatchEvents` so foreign
   *  players accumulate goals/assists/ratings from continental football too. */
  onEngineMatch?: (info: { result: Match; homeXI: Player[]; awayXI: Player[] }) => void;
}

/**
 * Resolve one continental fixture. Prefers the real engine when both clubs are
 * instantiated; otherwise falls back to reputation.
 */
function resolveContinentalFixture(
  homeClubId: string,
  awayClubId: string,
  virtualClubs: Record<string, VirtualClub>,
  world?: ContinentalWorld,
  matchId?: string,
): { homeGoals: number; awayGoals: number } {
  const homeClub = world?.clubs?.[homeClubId];
  const awayClub = world?.clubs?.[awayClubId];
  if (world && homeClub && awayClub) {
    const homeSquad = pickAiMatchSquad(homeClub, world.players, world.week);
    const awaySquad = pickAiMatchSquad(awayClub, world.players, world.week);
    if (homeSquad.xi.length > 0 && awaySquad.xi.length > 0) {
      const match: Match = {
        id: matchId || safeRandomUUID(),
        week: world.week,
        homeClubId, awayClubId,
        played: false, homeGoals: 0, awayGoals: 0, events: [],
      };
      const { result } = simulateMatch(
        match, homeClub, awayClub, homeSquad.xi, awaySquad.xi,
        undefined, undefined, undefined, undefined, 0, undefined, world.season,
        undefined, homeSquad.bench, awaySquad.bench,
      );
      world.onEngineMatch?.({ result, homeXI: homeSquad.xi, awayXI: awaySquad.xi });
      return { homeGoals: result.homeGoals, awayGoals: result.awayGoals };
    }
  }
  const homeRep = virtualClubs[homeClubId]?.reputation || 3;
  const awayRep = virtualClubs[awayClubId]?.reputation || 3;
  return simulateContinentalMatch(homeRep, awayRep);
}

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
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;
  // For very large lambda, Math.exp(-lambda) underflows to 0 and the loop
  // never terminates. Cap iterations to keep the JS thread responsive on iOS.
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
    if (k > 20) break;
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
  /** Pass the instantiated world to resolve real-club ties with the real match
   *  engine. Omit it and every tie falls back to the reputation model. */
  world?: ContinentalWorld,
): ContinentalTournamentState {
  const newGroups = tournament.groups.map(group => {
    const newMatches = group.matches.map(m => {
      if (m.matchday !== matchday || m.played) return m;
      // Skip player's match — they play interactively
      if (m.homeClubId === playerClubId || m.awayClubId === playerClubId) return m;

      const { homeGoals, awayGoals } = resolveContinentalFixture(
        m.homeClubId, m.awayClubId, virtualClubs, world, m.id,
      );

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
  totalWeeks?: number,
): ContinentalTournamentState {
  const calendar = getCompetitionCalendar(totalWeeks);
  const winners: string[] = [];
  const runnersUp: string[] = [];

  for (const group of tournament.groups) {
    if (group.standings.length >= 2) {
      winners.push(group.standings[0].clubId);
      runnersUp.push(group.standings[1].clubId);
    }
  }

  // Pair group winners with runners-up, guaranteeing no same-group tie. Each group
  // contributes exactly one winner and one runner-up at the same index, so pairing
  // winner[order[i]] with runnerUp[order[i+1]] — a cyclic shift over a shuffled group
  // order — is always a valid derangement. The old greedy matched the *first* different-
  // group runner and could strand the last winner with only its own group's runner left,
  // falling back to a same-group tie even when a clean pairing existed.
  const order = shuffle(winners.map((_, i) => i));
  const ties: ContinentalKnockoutTie[] = [];

  for (let i = 0; i < order.length; i++) {
    const winnerIdx = order[i];
    const runnerIdx = order[(i + 1) % order.length];
    ties.push({
      id: safeRandomUUID(),
      round: 'R16',
      homeClubId: winners[winnerIdx],
      awayClubId: runnersUp[runnerIdx],
      leg1Played: false, leg1HomeGoals: 0, leg1AwayGoals: 0,
      leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
      week1: calendar.r16Weeks[0],
      week2: calendar.r16Weeks[1],
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
  /** See `simulateGroupMatchday` — enables real-engine resolution. */
  world?: ContinentalWorld,
): ContinentalTournamentState {
  const newTies = tournament.knockoutTies.map(tie => {
    if (tie.round !== round) return tie;
    const isPlayerTie = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
    if (isPlayerTie) return tie; // Player plays interactively

    // Repair pass for saves stranded by the old resolution bug: both legs played
    // but no winner recorded. Such a tie could previously never be resolved OR
    // replayed, so the tournament stalled for the rest of the season and
    // `advanceWeek` burned its iteration guard every week. Resolving it here lets
    // an affected save recover on the next advance instead of staying dead.
    if (round !== 'F' && tie.leg1Played && tie.leg2Played && !tie.winnerId) {
      return resolveKnockoutTie(tie, virtualClubs);
    }

    // Finals are single-leg — exclude them here so the final-specific branch below
    // (which actually sets winnerId) is reachable. Without this guard the final's
    // leg 1 was played but its winner was never resolved, stalling the tournament.
    if (round !== 'F' && leg === 1 && !tie.leg1Played) {
      const { homeGoals, awayGoals } = resolveContinentalFixture(
        tie.homeClubId, tie.awayClubId, virtualClubs, world, `${tie.id}-l1`,
      );
      return { ...tie, leg1Played: true, leg1HomeGoals: homeGoals, leg1AwayGoals: awayGoals };
    }

    if (leg === 2 && tie.leg1Played && !tie.leg2Played) {
      // Leg 2 reverses home/away.
      const { homeGoals, awayGoals } = resolveContinentalFixture(
        tie.awayClubId, tie.homeClubId, virtualClubs, world, `${tie.id}-l2`,
      );

      const newTie = { ...tie, leg2Played: true, leg2HomeGoals: homeGoals, leg2AwayGoals: awayGoals };
      // Resolve the tie
      return resolveKnockoutTie(newTie, virtualClubs);
    }

    // For finals (single leg)
    if (round === 'F' && leg === 1 && !tie.leg1Played) {
      const { homeGoals, awayGoals } = resolveContinentalFixture(
        tie.homeClubId, tie.awayClubId, virtualClubs, world, `${tie.id}-f`,
      );
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
export function resolveKnockoutTie(
  tie: ContinentalKnockoutTie,
  virtualClubs: Record<string, VirtualClub>,
): ContinentalKnockoutTie {
  // Aggregate: home team goals = leg1Home + leg2Away, away team goals = leg1Away + leg2Home
  const homeAgg = tie.leg1HomeGoals + tie.leg2AwayGoals;
  const awayAgg = tie.leg1AwayGoals + tie.leg2HomeGoals;

  if (homeAgg !== awayAgg) {
    return { ...tie, winnerId: homeAgg > awayAgg ? tie.homeClubId : tie.awayClubId };
  }

  // No away-goals rule. It was abolished in real competition in 2021, and — more
  // importantly here — the player's own tie never applied it
  // (`matchActions.ts` goes level-aggregate → extra time → penalties), so an AI
  // 1-1 aggregate was decided on away goals while an identical player tie went
  // to penalties. Same competition, two rulebooks. Both paths now agree.

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
    // Fold extra-time goals back into the stored leg-2 score, the way
    // `resolveDrawnFinal` already does. Without this, KnockoutBracket renders a
    // level aggregate with a winner highlighted and no shootout badge — visually
    // indistinguishable from an unresolved (corrupt) tie.
    return {
      ...tie,
      leg2HomeGoals: tie.leg2HomeGoals + extraHome,
      leg2AwayGoals: tie.leg2AwayGoals + extraAway,
      winnerId,
    };
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
  // Sudden death (safety limit to prevent theoretical infinite loop)
  let sdRounds = 0;
  while (home === away && sdRounds < 50) {
    if (Math.random() < CONTINENTAL_PENALTY_CONVERSION) home++;
    if (Math.random() < CONTINENTAL_PENALTY_CONVERSION) away++;
    sdRounds++;
  }
  if (home === away) home++; // fallback — astronomically unlikely
  return { home, away };
}

/**
 * Check if a knockout round is complete (all ties resolved).
 */
export function isKnockoutRoundComplete(tournament: ContinentalTournamentState, round: 'R16' | 'QF' | 'SF' | 'F'): boolean {
  const roundTies = tournament.knockoutTies.filter(t => t.round === round);
  if (roundTies.length === 0) return false;
  return roundTies.every(t => t.winnerId !== null);
}

/**
 * Advance to the next knockout round by creating new ties from winners.
 */
export function advanceKnockoutRound(
  tournament: ContinentalTournamentState,
  playerClubId: string,
  totalWeeks?: number,
): ContinentalTournamentState {
  const calendar = getCompetitionCalendar(totalWeeks);
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
    QF: calendar.qfWeeks,
    SF: calendar.sfWeeks,
    F: calendar.finalWeek,
  };
  const weeks = weekMap[nextRound];

  const newTies: ContinentalKnockoutTie[] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    const isFinal = nextRound === 'F';
    newTies.push({
      id: safeRandomUUID(),
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
 * Get knockout round display name.
 */
export function getKnockoutRoundName(round: string): string {
  const names: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' };
  return names[round] || round;
}

// ── Ephemeral Club for Interactive Continental Play ──

/**
 * Create a temporary Club + Player[] from a VirtualClub for interactive match
 * simulation. Quality mapping: rep 5 → quality 82 … rep 1 → 42.
 *
 * Phase 6 narrowed this to GENUINELY virtual opponents. The living world
 * instantiates the strongest foreign top tiers, and `playCurrentMatchImpl`
 * only reaches for an ephemeral club when `clubs[oppId]` is absent — so a
 * Champions Cup tie against Real Madrid now uses Real Madrid's actual,
 * persisted, developing squad. What is left here is the long tail: a qualifier
 * from a league this save never instantiated.
 */
export function createEphemeralClub(
  vc: VirtualClub,
  season: number,
  useRealNames: boolean = true,
): { club: Club; players: Record<string, Player> } {
  const quality = 32 + vc.reputation * 10; // rep 1→42, 2→52, 3→62, 4→72, 5→82
  const squad = generateSquad(vc.id, quality, season, vc.leagueId, /* isInitialSeason */ false, useRealNames);

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
