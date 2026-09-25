import type { CareerMilestone, Club, Message, Player } from '@/types/game';
import type { GameState } from '../../storeTypes';
import { addMsg } from '@/utils/helpers';
import { DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK, getCompetitionCalendar } from '@/config/continental';
import { CUP_EXTRA_TIME_GOAL_CHANCE, CUP_EXTRA_TIME_REPUTATION_DIVISOR, CUP_PENALTY_GK_QUALITY_FACTOR, CUP_PENALTY_KICKS, FORFEIT_SCORE } from '@/config/gameBalance';
import { PENALTY_CONVERSION_RATE } from '@/config/matchEngine';
import { advanceCupRound, getRoundName } from '@/data/cup';
import { getDerbyIntensity } from '@/data/league';
import { simulateMatch } from '@/engine/match';
import { applyAIMatchEvents, pickAiMatchSquad } from '@/store/slices/orchestration/helpers';
import { advanceLeagueCupRound } from '@/store/slices/orchestration/tournaments';
import { advanceKnockoutRound, generateKnockoutFromGroups, getCurrentMatchday, isGroupStageComplete, isKnockoutRoundComplete, simulateGroupMatchday, simulateKnockoutLeg } from '@/utils/continental';
import type { ContinentalWorld } from '@/utils/continental';
import { createMilestone } from '@/utils/milestones';
import { markSuperCupPlayed } from '@/utils/superCup';
import { updateEloRatings } from '@/utils/teamRankings';

/**
 * One week of every knockout competition that is not a league: the domestic
 * Cup, the League Cup, both Super Cups and the three continental tournaments.
 *
 * Extracted from `advanceWeekImpl` so the UNEMPLOYED week can run it too. That
 * branch returns before the employed game loop, and it used to simulate league
 * fixtures only — so a career manager out of work watched a season in which no
 * cup round, no continental matchday and no Super Cup was ever played. The
 * domestic Cup reached rollover with no winner, the continental tournaments
 * froze in their group stage, and next season's qualification and coefficients
 * were computed off that frozen state (audit 2026-09-25, S5).
 *
 * `playerClubId` is the club the user is managing THIS week, or `''` when they
 * manage nobody. Everything that treats the user's club specially keys off it:
 * the user's own tie in the current week is left for interactive play, and
 * only the user's results produce inbox messages and timeline milestones. With
 * `''` no club is exempt, so every due tie is simulated and nothing is posted.
 *
 * Mutates `players` and `eloRankings` in place, exactly as the inline code did
 * (both are the tick's working copies). Returns the new competition states and
 * the messages / milestones the week produced.
 */
export interface CompetitionWeekInput {
  state: GameState;
  clubs: Record<string, Club>;
  /** Working player map for this tick — updated in place with match events. */
  players: Record<string, Player>;
  week: number;
  season: number;
  /** The managed club, or `''` for an unemployed manager. */
  playerClubId: string;
  /** Working Elo map for this tick — updated in place. */
  eloRankings: Record<string, number>;
  messages: Message[];
}

export interface CompetitionWeekResult {
  cup: GameState['cup'];
  leagueCup: GameState['leagueCup'];
  domesticSuperCup: GameState['domesticSuperCup'];
  continentalSuperCup: GameState['continentalSuperCup'];
  championsCup: GameState['championsCup'];
  shieldCup: GameState['shieldCup'];
  conferenceCup: GameState['conferenceCup'];
  messages: Message[];
  milestones: CareerMilestone[];
}

export function progressCompetitionsWeek(input: CompetitionWeekInput): CompetitionWeekResult {
  const { state, clubs, week, season, playerClubId, eloRankings } = input;
  const newPlayers = input.players;
  let newMessages = input.messages;
  const newTimeline: CareerMilestone[] = [];

  // Simulate cup matches for this week (and any orphaned ties from past weeks)
  let newCup = { ...state.cup, ties: [...state.cup.ties] };
  if (newCup.currentRound) {
    const cupWeekMatches = newCup.ties.filter(t => t.week <= week && !t.played && t.round === newCup.currentRound);
    for (const tie of cupWeekMatches) {
      const tieIdx = newCup.ties.findIndex(t => t.id === tie.id);
      const hClub = clubs[tie.homeClubId];
      const aClub = clubs[tie.awayClubId];
      if (!hClub || !aClub) continue;
      const hCupSquad = pickAiMatchSquad(hClub, newPlayers, week);
      const aCupSquad = pickAiMatchSquad(aClub, newPlayers, week);
      const hPlayers = hCupSquad.xi;
      const aPlayers = aCupSquad.xi;

      const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
      if (isPlayerMatch && tie.week === week) continue; // Player's current-week cup match is played interactively
      // Forfeit if either team has no available players
      if (hPlayers.length === 0 || aPlayers.length === 0) {
        const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
        newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: aPlayers.length === 0 ? 0 : FORFEIT_SCORE, winnerId };
        continue;
      }
      const { result: cupResult } = simulateMatch(
        { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
        hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season, undefined, hCupSquad.bench, aCupSquad.bench
      );

      // Resolve draws via extra time then penalties
      let hGoals = cupResult.homeGoals;
      let aGoals = cupResult.awayGoals;
      let penaltyShootout: { home: number; away: number } | undefined;
      const cupEvents = [...cupResult.events];
      if (hGoals === aGoals) {
        // Extra time: each side has a chance to score based on team strength
        const homeStr = hClub.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
        const awayStr = aClub.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
        if (Math.random() < CUP_EXTRA_TIME_GOAL_CHANCE * homeStr) {
          hGoals++;
          cupEvents.push({ minute: 105, type: 'extra_time_goal', clubId: tie.homeClubId, description: `${hClub.shortName} score in extra time!` });
        }
        if (Math.random() < CUP_EXTRA_TIME_GOAL_CHANCE * awayStr) {
          aGoals++;
          cupEvents.push({ minute: 115, type: 'extra_time_goal', clubId: tie.awayClubId, description: `${aClub.shortName} score in extra time!` });
        }
        // If still level, penalty shootout
        if (hGoals === aGoals) {
          const homeGK = hPlayers.find(p => p.position === 'GK');
          const awayGK = aPlayers.find(p => p.position === 'GK');
          const homeGKQuality = homeGK ? (homeGK.attributes.defending + homeGK.attributes.mental) / 200 : 0.5;
          const awayGKQuality = awayGK ? (awayGK.attributes.defending + awayGK.attributes.mental) / 200 : 0.5;
          let penHome = 0, penAway = 0;
          for (let i = 0; i < CUP_PENALTY_KICKS; i++) {
            if (Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penHome++;
            if (Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penAway++;
          }
          // Sudden death if tied after 5 — loop exits when scores diverge
          while (penHome === penAway) {
            if (Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penHome++;
            if (Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penAway++;
          }
          penaltyShootout = { home: penHome, away: penAway };
          // Penalties decide the winner but must NOT change the drawn scoreline —
          // the old hGoals++/aGoals++ corrupted cup history and disagreed with the
          // interactive path. The winner is recorded via winnerId below.
          cupEvents.push({ minute: 120, type: 'penalty_shootout', clubId: penHome > penAway ? tie.homeClubId : tie.awayClubId, description: `${penHome > penAway ? hClub.shortName : aClub.shortName} win on penalties (${penHome}-${penAway})!` });
        }
      }

      const cupWinnerId = penaltyShootout
        ? (penaltyShootout.home > penaltyShootout.away ? tie.homeClubId : tie.awayClubId)
        : (hGoals > aGoals ? tie.homeClubId : tie.awayClubId);
      newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals, penaltyShootout, winnerId: cupWinnerId };

      applyAIMatchEvents(cupResult.events, newPlayers, clubs, week, hPlayers, aPlayers, cupResult.homeGoals, cupResult.awayGoals, eloRankings, tie.homeClubId, tie.awayClubId);
      updateEloRatings(eloRankings, tie.homeClubId, tie.awayClubId, cupResult.homeGoals, cupResult.awayGoals, 'cup');

      // Cup match result message for player
      if (isPlayerMatch) {
        const isHome = tie.homeClubId === playerClubId;
        const won = cupWinnerId === playerClubId;
        const oppName = clubs[isHome ? tie.awayClubId : tie.homeClubId]?.name || 'Unknown';
        const roundName = getRoundName(tie.round);
        if (won) {
          newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: `Cup: ${roundName} Won!`, body: `You beat ${oppName} ${hGoals}-${aGoals} to advance in the cup!` });
        } else {
          newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: `Cup: Eliminated`, body: `You were knocked out by ${oppName} ${hGoals}-${aGoals} in the ${roundName}.` });
          newCup.eliminated = true;
        }
      }
    }

    // Check if all ties in current round are played → advance
    const roundTies = newCup.ties.filter(t => t.round === newCup.currentRound);
    const allPlayed = roundTies.length > 0 && roundTies.every(t => t.played);
    if (allPlayed) {
      if (newCup.currentRound === 'F') {
        // Final played — determine winner
        const finalTie = roundTies[0];
        const winnerId = finalTie.winnerId || (finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId);
        newCup.winner = winnerId;
        newCup.currentRound = null;
        if (winnerId === playerClubId) {
          newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Cup Winners!', body: 'Congratulations! You have won the cup! The board and fans are ecstatic!' });
          newTimeline.push(createMilestone('cup_win', 'Cup Winners!', `Won the cup in Season ${season}!`, season, week, 'medal'));
        }
      } else {
        // Pass the post-training/development player map so GK quality
        // computation sees the freshest attributes rather than the
        // top-of-week snapshot.
        newCup = advanceCupRound(newCup, clubs, newPlayers, state.totalWeeks);
      }
    }
  }

  // ── League Cup Simulation (includes orphaned ties from past weeks) ──
  let newLeagueCup = state.leagueCup ? { ...state.leagueCup, ties: [...state.leagueCup.ties] } : null;
  if (newLeagueCup && newLeagueCup.currentRound) {
    const lcWeekMatches = newLeagueCup.ties.filter(t => t.week <= week && !t.played && t.round === newLeagueCup!.currentRound);
    for (const tie of lcWeekMatches) {
      const tieIdx = newLeagueCup.ties.findIndex(t => t.id === tie.id);
      const hClub = clubs[tie.homeClubId];
      const aClub = clubs[tie.awayClubId];
      if (!hClub || !aClub) continue;
      const hLcSquad = pickAiMatchSquad(hClub, newPlayers, week);
      const aLcSquad = pickAiMatchSquad(aClub, newPlayers, week);
      const hPlayers = hLcSquad.xi;
      const aPlayers = aLcSquad.xi;

      const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
      if (isPlayerMatch && tie.week === week) continue; // Player's current-week league cup match is played interactively

      if (hPlayers.length === 0 || aPlayers.length === 0) {
        const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
        newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: aPlayers.length === 0 ? 0 : FORFEIT_SCORE, winnerId };
        continue;
      }
      const { result: lcResult } = simulateMatch(
        { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
        hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season, undefined, hLcSquad.bench, aLcSquad.bench
      );

      // League Cup: straight to penalties if drawn (no extra time in early rounds)
      const hGoals = lcResult.homeGoals;
      const aGoals = lcResult.awayGoals;
      let penaltyShootout: { home: number; away: number } | undefined;
      if (hGoals === aGoals) {
        const homeGK = hPlayers.find(p => p.position === 'GK');
        const awayGK = aPlayers.find(p => p.position === 'GK');
        const homeGKQ = homeGK ? (homeGK.attributes.defending + homeGK.attributes.mental) / 200 : 0.5;
        const awayGKQ = awayGK ? (awayGK.attributes.defending + awayGK.attributes.mental) / 200 : 0.5;
        let penHome = 0, penAway = 0;
        for (let i = 0; i < CUP_PENALTY_KICKS; i++) {
          if (Math.random() > awayGKQ * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penHome++;
          if (Math.random() > homeGKQ * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penAway++;
        }
        while (penHome === penAway) {
          if (Math.random() > awayGKQ * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penHome++;
          if (Math.random() > homeGKQ * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE)) penAway++;
        }
        penaltyShootout = { home: penHome, away: penAway };
        // Penalties decide the winner without changing the drawn scoreline.
      }

      const lcWinnerId = penaltyShootout
        ? (penaltyShootout.home > penaltyShootout.away ? tie.homeClubId : tie.awayClubId)
        : (hGoals > aGoals ? tie.homeClubId : tie.awayClubId);
      newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals, penaltyShootout, winnerId: lcWinnerId };
      applyAIMatchEvents(lcResult.events, newPlayers, clubs, week, hPlayers, aPlayers, lcResult.homeGoals, lcResult.awayGoals, eloRankings, tie.homeClubId, tie.awayClubId);
      updateEloRatings(eloRankings, tie.homeClubId, tie.awayClubId, lcResult.homeGoals, lcResult.awayGoals, 'cup');

      // League Cup match result message for player (orphaned past-week matches)
      if (isPlayerMatch) {
        const isHome = tie.homeClubId === playerClubId;
        const won = lcWinnerId === playerClubId;
        const oppName = clubs[isHome ? tie.awayClubId : tie.homeClubId]?.name || 'Unknown';
        const roundName = getRoundName(tie.round);
        if (won) {
          newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: `League Cup: ${roundName} Won!`, body: `You beat ${oppName} ${hGoals}-${aGoals} to advance in the League Cup!` });
        } else {
          newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: `League Cup: Eliminated`, body: `You were knocked out by ${oppName} ${hGoals}-${aGoals} in the ${roundName}.` });
          newLeagueCup.eliminated = true;
        }
      }
    }

    // Check if League Cup round is complete → advance
    const lcRoundTies = newLeagueCup.ties.filter(t => t.round === newLeagueCup!.currentRound);
    const lcAllPlayed = lcRoundTies.length > 0 && lcRoundTies.every(t => t.played);
    if (lcAllPlayed) {
      if (newLeagueCup.currentRound === 'F') {
        const finalTie = lcRoundTies[0];
        const winnerId = finalTie.winnerId || (finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId);
        newLeagueCup.winner = winnerId;
        newLeagueCup.currentRound = null;
        if (winnerId === playerClubId) {
          newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'League Cup Winners!', body: 'You have won the League Cup!' });
          newTimeline.push(createMilestone('cup_win', 'League Cup Winners!', `Won the League Cup in Season ${season}!`, season, week, 'medal'));
        }
      } else {
        newLeagueCup = advanceLeagueCupRound(newLeagueCup, state.totalWeeks);
      }
    }
  }

  // ── Domestic Super Cup Simulation ──
  let newDomesticSuperCup = state.domesticSuperCup;
  // `>=`, not `===`. Both Super Cup weeks are raw, unscaled constants (1 and 2)
  // while the cup / League Cup / continental calendars compress into the same
  // weeks in short seasons — and Super Cup is LAST in playCurrentMatchImpl's
  // priority. So in every league with totalWeeks <= 38 a colliding League Cup R1
  // outranked the Continental Super Cup, week 2 passed, `week === 2` was false
  // forever, and the fixture sat unplayed in state for the whole season: no
  // match, no trophy, no prize money. Cup, League Cup and continental all have
  // this catch-up already; the Super Cups were the only competitions without it.
  if (newDomesticSuperCup && !newDomesticSuperCup.played && week >= DOMESTIC_SUPER_CUP_WEEK) {
    const hClub = clubs[newDomesticSuperCup.homeClubId];
    const aClub = clubs[newDomesticSuperCup.awayClubId];
    const isPlayerMatch = newDomesticSuperCup.homeClubId === playerClubId || newDomesticSuperCup.awayClubId === playerClubId;
    if (!isPlayerMatch && hClub && aClub) {
      // AI simulation
      const hScSquad = pickAiMatchSquad(hClub, newPlayers, week);
      const aScSquad = pickAiMatchSquad(aClub, newPlayers, week);
      const hPlayers = hScSquad.xi;
      const hBenchSC = hScSquad.bench;
      const aPlayers = aScSquad.xi;
      const aBenchSC = aScSquad.bench;
      if (hPlayers.length > 0 && aPlayers.length > 0) {
        const { result: scResult } = simulateMatch(
          { id: 'super-cup', week, homeClubId: newDomesticSuperCup.homeClubId, awayClubId: newDomesticSuperCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, 0, undefined, season, undefined, hBenchSC, aBenchSC
        );
        const winnerId = scResult.homeGoals > scResult.awayGoals ? newDomesticSuperCup.homeClubId :
          scResult.awayGoals > scResult.homeGoals ? newDomesticSuperCup.awayClubId :
          Math.random() < 0.5 ? newDomesticSuperCup.homeClubId : newDomesticSuperCup.awayClubId;
        newDomesticSuperCup = markSuperCupPlayed(newDomesticSuperCup, week, scResult, winnerId);
      }
    }
  }

  // ── Continental Super Cup Simulation ──
  let newContinentalSuperCup = state.continentalSuperCup;
  if (newContinentalSuperCup && !newContinentalSuperCup.played && week >= CONTINENTAL_SUPER_CUP_WEEK) {
    const hClub = clubs[newContinentalSuperCup.homeClubId] || (state.virtualClubs || {})[newContinentalSuperCup.homeClubId];
    const aClub = clubs[newContinentalSuperCup.awayClubId] || (state.virtualClubs || {})[newContinentalSuperCup.awayClubId];
    const isPlayerMatch = newContinentalSuperCup.homeClubId === playerClubId || newContinentalSuperCup.awayClubId === playerClubId;
    if (!isPlayerMatch && hClub && aClub) {
      // Continental Super Cup opponents can be virtual clubs with no squad, so
      // guard on `playerIds` before asking the picker for an XI.
      const hCscSquad = (hClub as Club).playerIds ? pickAiMatchSquad(hClub as Club, newPlayers, week) : { xi: [], bench: [] };
      const hPlayers = hCscSquad.xi;
      const hBenchCSC = hCscSquad.bench;
      const aCscSquad = (aClub as Club).playerIds ? pickAiMatchSquad(aClub as Club, newPlayers, week) : { xi: [], bench: [] };
      const aPlayers = aCscSquad.xi;
      const aBenchCSC = aCscSquad.bench;
      if (hPlayers.length > 0 && aPlayers.length > 0) {
        const { result: scResult } = simulateMatch(
          { id: 'continental-super-cup', week, homeClubId: newContinentalSuperCup.homeClubId, awayClubId: newContinentalSuperCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub as Club, aClub as Club, hPlayers, aPlayers, undefined, undefined, undefined, undefined, 0, undefined, season, undefined, hBenchCSC, aBenchCSC
        );
        const winnerId = scResult.homeGoals > scResult.awayGoals ? newContinentalSuperCup.homeClubId :
          scResult.awayGoals > scResult.homeGoals ? newContinentalSuperCup.awayClubId :
          Math.random() < 0.5 ? newContinentalSuperCup.homeClubId : newContinentalSuperCup.awayClubId;
        newContinentalSuperCup = markSuperCupPlayed(newContinentalSuperCup, week, scResult, winnerId);
      } else {
        // Forfeit if virtual clubs without real players — random winner
        const winnerId = Math.random() < 0.5 ? newContinentalSuperCup.homeClubId : newContinentalSuperCup.awayClubId;
        newContinentalSuperCup = markSuperCupPlayed(
          newContinentalSuperCup, week,
          { homeGoals: winnerId === newContinentalSuperCup.homeClubId ? 1 : 0, awayGoals: winnerId === newContinentalSuperCup.awayClubId ? 1 : 0 },
          winnerId,
        );
      }
    }
  }

  // ── Continental Tournament Simulation ──
  let newChampionsCup = state.championsCup;
  let newShieldCup = state.shieldCup;
  let newConferenceCup = state.conferenceCup;
  const virtualClubs = state.virtualClubs || {};

  // Real-engine continental football. `simulateGroupMatchday` used to resolve
  // Real Madrid vs Bayern as a Poisson draw off two integers, while the PLAYER's
  // own tie in the same competition ran the full match engine — two rulebooks in
  // one tournament. Now that the strongest foreign leagues are instantiated as
  // real clubs with real squads (see initGame's living world), club-vs-club ties
  // go through `simulateMatch`, and the callback feeds the results back so foreign
  // players accumulate goals, assists and ratings from continental football and
  // their Elo moves — exactly as the league sim does. Genuinely virtual filler
  // still falls back to the reputation model.
  const continentalWorld: ContinentalWorld = {
    clubs, players: newPlayers, week, season,
    onEngineMatch: ({ result, homeXI, awayXI }) => {
      applyAIMatchEvents(result.events, newPlayers, clubs, week, homeXI, awayXI,
        result.homeGoals, result.awayGoals, eloRankings, result.homeClubId, result.awayClubId);
      updateEloRatings(eloRankings, result.homeClubId, result.awayClubId,
        result.homeGoals, result.awayGoals, 'cup');
    },
  };
  const continentalCalendar = getCompetitionCalendar(state.totalWeeks);
  const groupWeeks = continentalCalendar.groupWeeks;

  const continentalName = (comp: string): string =>
    comp === 'champions_cup' ? 'Champions Cup' : comp === 'shield_cup' ? 'Shield Cup' : 'Conference Cup';

  type ContinentalState = typeof newChampionsCup;

  // Group stage: process every matchday whose scheduled week has arrived.
  // PAST-DUE matchdays (scheduled week already behind us — a skipped week or
  // a same-week fixture collision where the domestic cup took priority) are
  // force-simmed INCLUDING the player's own match: leaving it unplayed
  // freezes getCurrentMatchday and hangs the tournament for the season.
  // The current week's matchday leaves the player's match for interactive play.
  const processContinentalGroupStage = (input: ContinentalState): ContinentalState => {
    if (!input || input.currentPhase !== 'group') return input;
    let t = input;
    let guard = 0;
    while (t && t.currentPhase === 'group' && guard++ < 10) {
      const md = getCurrentMatchday(t);
      const mdWeek = groupWeeks[md - 1];
      if (mdWeek === undefined || mdWeek > week) break;
      const isCurrentWeek = mdWeek === week;
      // '' = no club is exempt → the player's overdue match is auto-simmed.
      t = simulateGroupMatchday(t, md, virtualClubs, isCurrentWeek ? playerClubId : '', continentalWorld);
      if (isGroupStageComplete(t)) {
        t = generateKnockoutFromGroups(t, playerClubId, state.totalWeeks);
        const compName = continentalName(t.competition);
        // Only a club that was actually drawn gets a verdict. `playerEliminated`
        // is also true for a competition the club never entered (the draw sets
        // it from "not in any group"), so every season-2+ manager was told they
        // had been "eliminated from the group stage" of the other two
        // tournaments — and an unemployed one would have been told it three
        // times over.
        const playerWasDrawn = !!playerClubId && t.groups.some(g => g.clubIds.includes(playerClubId));
        if (playerWasDrawn && !t.playerEliminated) {
          newMessages = addMsg(newMessages, { week, season, type: 'board', title: `${compName} Knockout!`, body: `You have qualified for the ${compName} knockout rounds!` });
        } else if (playerWasDrawn) {
          newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: `${compName} Eliminated`, body: `You have been eliminated from the ${compName} group stage.` });
        }
      }
      if (isCurrentWeek) break; // player's match (if any) stays pending for interactive play
    }
    return t;
  };

  newChampionsCup = processContinentalGroupStage(newChampionsCup);
  newShieldCup = processContinentalGroupStage(newShieldCup);
  newConferenceCup = processContinentalGroupStage(newConferenceCup);

  // Knockout rounds — same catch-up principle: any leg whose scheduled week
  // has passed unplayed is force-simmed (player's tie included) so a missed
  // or collided week can delay a tie but never strand it.
  const processContinentalKnockout = (input: ContinentalState): ContinentalState => {
    if (!input || input.currentPhase !== 'knockout') return input;
    let t = input;
    let guard = 0;
    while (t.currentPhase === 'knockout' && t.currentRound && t.currentRound !== 'group' && guard++ < 12) {
      const round = t.currentRound as 'R16' | 'QF' | 'SF' | 'F';

      // Self-heal: a fully decided round that was never advanced (stale save).
      if (isKnockoutRoundComplete(t, round)) {
        t = advanceKnockoutRound(t, playerClubId, state.totalWeeks);
        continue;
      }

      const roundWeeks: readonly number[] =
        round === 'R16' ? continentalCalendar.r16Weeks
        : round === 'QF' ? continentalCalendar.qfWeeks
        : round === 'SF' ? continentalCalendar.sfWeeks
        : [continentalCalendar.finalWeek];
      const roundTies = t.knockoutTies.filter(kt => kt.round === round);
      if (roundTies.length === 0) break;
      const leg: 1 | 2 = round !== 'F' && roundTies.every(kt => kt.leg1Played) ? 2 : 1;
      const legWeek = roundWeeks[leg - 1] ?? roundWeeks[0];
      if (legWeek > week) break;

      const isCurrentWeek = legWeek === week;
      t = simulateKnockoutLeg(t, round, leg, virtualClubs, isCurrentWeek ? playerClubId : '', continentalWorld);

      if (isKnockoutRoundComplete(t, round)) {
        const advanced = advanceKnockoutRound(t, playerClubId, state.totalWeeks);
        if (advanced.currentPhase === 'complete' && advanced.winnerId) {
          const compName = continentalName(t.competition);
          if (advanced.winnerId === playerClubId) {
            newMessages = addMsg(newMessages, { week, season, type: 'board', title: `${compName} Winners!`, body: `Incredible! You have won the ${compName}!` });
            newTimeline.push(createMilestone('cup_win', `${compName} Winners!`, `Won the ${compName} in Season ${season}!`, season, week, 'trophy'));
          }
        }
        t = advanced;
        if (t.currentPhase === 'complete') break;
      } else if (isCurrentWeek) {
        break; // player's tie pending interactive play this week
      }
      // Past-due leg forced: loop again — the next leg/round may also be due.
    }
    return t;
  };

  newChampionsCup = processContinentalKnockout(newChampionsCup);
  newShieldCup = processContinentalKnockout(newShieldCup);
  newConferenceCup = processContinentalKnockout(newConferenceCup);

  return {
    cup: newCup,
    leagueCup: newLeagueCup,
    domesticSuperCup: newDomesticSuperCup,
    continentalSuperCup: newContinentalSuperCup,
    championsCup: newChampionsCup,
    shieldCup: newShieldCup,
    conferenceCup: newConferenceCup,
    messages: newMessages,
    milestones: newTimeline,
  };
}
