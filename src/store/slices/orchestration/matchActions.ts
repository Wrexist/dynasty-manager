import * as Sentry from '@sentry/react';
import { Club, Player, Match, PenaltyKick } from '@/types/game';
import { calculateReputationTier } from '@/utils/managerCareer';
import {
  REP_MIN, REP_MAX,
} from '@/config/managerCareer';
import { buildLeagueTable } from '@/data/league';

import type { GameState } from '../../storeTypes';
import { addMsg } from '@/utils/helpers';

import { hasPerk } from '@/utils/managerPerks';

import { getAICounterTactics } from '@/config/aiManager';
import { CONTINENTAL_PRIZE_MONEY } from '@/config/continental';
import { CUP_EXTRA_TIME_GOAL_CHANCE, CUP_EXTRA_TIME_REPUTATION_DIVISOR, CUP_PENALTY_KICKS, FORFEIT_SCORE, FRIENDLY_BOARD_CONFIDENCE_MULT, LINEUP_SIZE, MAX_CAREER_TIMELINE, MOTIVATOR_MORALE_BOOST, PEN_AIM } from '@/config/gameBalance';
import { MOD_DISCIPLINE_CARDS, REP_DRAW, REP_LOSS, REP_WIN } from '@/config/managerCareer';
import { SHOUT_CUMULATIVE_SCALE, SHOUT_MODIFIERS } from '@/config/matchEngine';
import { CALM_DEFENSE_BOOST, CALM_FITNESS_DRAIN_MULT, CALM_FOUL_REDUCTION, DEMAND_ATTACK_BOOST, DEMAND_DEFENSE_PENALTY, DEMAND_FITNESS_DRAIN_MULT, MOTIVATE_ATTACK_BOOST, MOTIVATE_FITNESS_DRAIN_MULT, MOTIVATE_FOUL_BONUS, teamTalkModifiers } from '@/config/teamTalk';
import { advanceCupRound, getRoundName } from '@/data/cup';
import { getDerbyIntensity } from '@/data/league';
import { generatePostMatchPress } from '@/data/pressConferences';
import { HalfState, finalizeMatch, generateMatchWeather, simulateHalf, simulateMatch } from '@/engine/match';
import { processMatchResult } from '@/store/helpers/matchProcessing';
import { applyAIMatchEvents } from '@/store/slices/orchestration/helpers';
import { advanceLeagueCupRound, getContinentalMatchLabel, isAggregateDecided, isContinentalDrawValid } from '@/store/slices/orchestration/tournaments';
import type { MatchEvent } from '@/types/game';
import { completeShootout, getClubGKQuality, getPenaltyTakerQuality, getShootoutProgress, pickAiAim, pickAiPower, resolveAimedKick, simulatePenaltyShootout } from '@/utils/penaltyShootout';
import { detectMatchDrama } from '@/utils/celebrations';
import { advanceKnockoutRound, createEphemeralClub, findPlayerContinentalMatch, generateKnockoutFromGroups, isGroupStageComplete, isKnockoutRoundComplete } from '@/utils/continental';
import { branchMult } from '@/utils/managerPerks';
import { isPro } from '@/utils/monetization';
import { updateEloRatings } from '@/utils/teamRankings';
/**
 * Match-action pipeline extracted from orchestrationSlice.ts.
 *
 * Each `*Impl(set, get)` matches a slice action that orchestrates a
 * single match phase: starting the match, playing each half / extra
 * time, and revealing penalties. Three private helpers
 * (`processTournamentResult`, `processTournamentResultWithWinner`,
 * `computeShoutMods`) are kept inside this module — only the match
 * actions reference them.
 */

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

function processTournamentResult(
  state: GameState,
  result: Match,
  playerClubId: string,
  processed: { newPlayers: Record<string, import('@/types/game').Player> },
  season: number,
  week: number,
): { stateUpdates: Record<string, unknown>; cleanedPlayers?: Record<string, import('@/types/game').Player> } {
  const updates: Record<string, unknown> = {};

  // Clean up ephemeral virtual club players (prefixed with 'vc-')
  const realPlayers = { ...processed.newPlayers };
  for (const pid of Object.keys(realPlayers)) {
    if (pid.startsWith('vc-')) delete realPlayers[pid];
  }
  // Also clean ephemeral club from clubs. `state.virtualClubs` may contain real loaded
  // clubs from other divisions (continental qualifiers); a club is ephemeral iff it isn't
  // registered in any loaded `divisionClubs`. A fixture-only guard would wrongly delete
  // real cross-division loaded clubs (e.g. cup winners from a non-player league).
  const loadedClubIds = new Set<string>();
  for (const ids of Object.values(state.divisionClubs || {})) {
    for (const id of ids) loadedClubIds.add(id);
  }
  const realClubs = { ...state.clubs };
  for (const cid of Object.keys(realClubs)) {
    if ((state.virtualClubs || {})[cid] && !loadedClubIds.has(cid)) {
      delete realClubs[cid];
    }
  }
  const cleanedPlayers = realPlayers;

  // Helper to award prize money to player's club
  const awardPrizeMoney = (amount: number) => {
    if (amount > 0 && realClubs[playerClubId]) {
      realClubs[playerClubId] = { ...realClubs[playerClubId], budget: realClubs[playerClubId].budget + amount };
    }
  };
  updates.clubs = realClubs;

  // Domestic cup (not __tournament__)
  if (state.currentCupTieId && state.currentCupTieId !== '__tournament__') {
    const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
      t.id === state.currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals } : t
    )};
    const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
    if (allPlayed) {
      if (newCup.currentRound === 'F') {
        const finalTie = newCup.ties.find(t => t.round === 'F' && t.played);
        if (finalTie) {
          const cupWinnerId = finalTie.winnerId || (finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId);
          newCup.winner = cupWinnerId; newCup.currentRound = null;
          awardPrizeMoney(cupWinnerId === playerClubId ? CONTINENTAL_PRIZE_MONEY.dynasty_cup_winner : CONTINENTAL_PRIZE_MONEY.dynasty_cup_runner_up);
        }
      } else { Object.assign(newCup, advanceCupRound(newCup, state.clubs, state.players, state.totalWeeks)); }
    }
    const isHome = result.homeClubId === playerClubId;
    const playerWon = isHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
    // Award round prize money for winning
    if (playerWon && newCup.currentRound !== null) {
      const cupRoundPrize: Record<string, number> = { R1: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r1, R2: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r2, R3: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r3, R4: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r4, QF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_qf, SF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_sf };
      const round = state.cup.currentRound;
      if (round) awardPrizeMoney(cupRoundPrize[round] || 0);
    }
    if (!playerWon) newCup.eliminated = true;
    updates.cup = newCup;
    return { stateUpdates: updates, cleanedPlayers };
  }

  // League Cup
  if (state.currentLeagueCupTieId && state.leagueCup) {
    const newLC = { ...state.leagueCup, ties: [...state.leagueCup.ties] };
    const tieIdx = newLC.ties.findIndex(t => t.id === state.currentLeagueCupTieId);
    if (tieIdx >= 0) {
      const winnerId = result.homeGoals > result.awayGoals ? result.homeClubId : result.awayGoals > result.homeGoals ? result.awayClubId : null;
      newLC.ties[tieIdx] = { ...newLC.ties[tieIdx], played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId };
      if (winnerId && winnerId !== playerClubId) newLC.eliminated = true;
      const lcRoundTies = newLC.ties.filter(t => t.round === newLC.currentRound);
      if (lcRoundTies.every(t => t.played)) {
        if (newLC.currentRound === 'F') {
          newLC.winner = winnerId; newLC.currentRound = null;
          // Award League Cup final prize money
          if (winnerId === playerClubId) awardPrizeMoney(CONTINENTAL_PRIZE_MONEY.league_cup_winner);
          else awardPrizeMoney(CONTINENTAL_PRIZE_MONEY.league_cup_runner_up);
        } else {
          Object.assign(newLC, advanceLeagueCupRound(newLC, state.totalWeeks));
        }
      }
    }
    updates.leagueCup = newLC;
    return { stateUpdates: updates, cleanedPlayers };
  }

  // Continental match
  if (state.currentContinentalMatchId && state.currentContinentalCompetition) {
    const compKey = state.currentContinentalCompetition === 'champions_cup' ? 'championsCup' : state.currentContinentalCompetition === 'shield_cup' ? 'shieldCup' : 'conferenceCup';
    const isChampions = state.currentContinentalCompetition === 'champions_cup';
    const isShield = state.currentContinentalCompetition === 'shield_cup';
    const prizeGroup = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_group : isShield ? CONTINENTAL_PRIZE_MONEY.shield_group : CONTINENTAL_PRIZE_MONEY.conference_group;
    const prizeR16 = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_r16 : isShield ? CONTINENTAL_PRIZE_MONEY.shield_r16 : CONTINENTAL_PRIZE_MONEY.conference_r16;
    const prizeQF = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_qf : isShield ? CONTINENTAL_PRIZE_MONEY.shield_qf : CONTINENTAL_PRIZE_MONEY.conference_qf;
    const prizeSF = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_sf : isShield ? CONTINENTAL_PRIZE_MONEY.shield_sf : CONTINENTAL_PRIZE_MONEY.conference_sf;
    const prizeWinner = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_winner : isShield ? CONTINENTAL_PRIZE_MONEY.shield_winner : CONTINENTAL_PRIZE_MONEY.conference_winner;
    const prizeRunnerUp = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_runner_up : isShield ? CONTINENTAL_PRIZE_MONEY.shield_runner_up : CONTINENTAL_PRIZE_MONEY.conference_runner_up;
    const tourney = state[compKey];
    if (tourney) {
      const matchInfo = findPlayerContinentalMatch(tourney, week, playerClubId);
      if (matchInfo) {
        const newTourney = { ...tourney, groups: [...tourney.groups], knockoutTies: [...tourney.knockoutTies] };
        if (matchInfo.type === 'group') {
          const newGroup = { ...newTourney.groups[matchInfo.groupIdx], matches: [...newTourney.groups[matchInfo.groupIdx].matches] };
          newGroup.matches[matchInfo.matchIdx] = { ...newGroup.matches[matchInfo.matchIdx], played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals };
          // Recalculate standings
          const stats: Record<string, { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }> = {};
          for (const cid of newGroup.clubIds) stats[cid] = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
          for (const m of newGroup.matches) {
            if (!m.played) continue;
            stats[m.homeClubId].played++; stats[m.awayClubId].played++;
            stats[m.homeClubId].goalsFor += m.homeGoals; stats[m.homeClubId].goalsAgainst += m.awayGoals;
            stats[m.awayClubId].goalsFor += m.awayGoals; stats[m.awayClubId].goalsAgainst += m.homeGoals;
            if (m.homeGoals > m.awayGoals) { stats[m.homeClubId].won++; stats[m.homeClubId].points += 3; stats[m.awayClubId].lost++; }
            else if (m.awayGoals > m.homeGoals) { stats[m.awayClubId].won++; stats[m.awayClubId].points += 3; stats[m.homeClubId].lost++; }
            else { stats[m.homeClubId].drawn++; stats[m.homeClubId].points++; stats[m.awayClubId].drawn++; stats[m.awayClubId].points++; }
          }
          newGroup.standings = newGroup.clubIds.map(cid => ({ clubId: cid, ...stats[cid] }))
            .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor);
          newTourney.groups[matchInfo.groupIdx] = newGroup;

          // Award group stage match prize money
          awardPrizeMoney(prizeGroup);

          // Check if all groups complete → generate knockout
          if (isGroupStageComplete(newTourney)) {
            const advanced = generateKnockoutFromGroups(newTourney, playerClubId, state.totalWeeks);
            Object.assign(newTourney, advanced);
          }
        } else {
          // Knockout: record leg result
          const tie = { ...newTourney.knockoutTies[matchInfo.tieIdx] };
          if (matchInfo.leg === 1 || tie.round === 'F') {
            tie.leg1Played = true; tie.leg1HomeGoals = result.homeGoals; tie.leg1AwayGoals = result.awayGoals;
            // For finals (single leg), resolve immediately if not drawn
            if (tie.round === 'F' && result.homeGoals !== result.awayGoals) {
              tie.winnerId = result.homeGoals > result.awayGoals ? tie.homeClubId : tie.awayClubId;
            }
          } else {
            tie.leg2Played = true; tie.leg2HomeGoals = result.homeGoals; tie.leg2AwayGoals = result.awayGoals;
            // Resolve 2-leg tie
            const homeAgg = tie.leg1HomeGoals + tie.leg2AwayGoals;
            const awayAgg = tie.leg1AwayGoals + tie.leg2HomeGoals;
            if (homeAgg !== awayAgg) {
              tie.winnerId = homeAgg > awayAgg ? tie.homeClubId : tie.awayClubId;
            }
          }
          newTourney.knockoutTies[matchInfo.tieIdx] = tie;
          // Check if knockout round complete
          if (tie.winnerId) {
            const round = tie.round;
            if (tie.winnerId !== playerClubId) newTourney.playerEliminated = true;
            // Award knockout round advancement / final prize money
            const prizeMap =
              { R16: prizeR16, QF: prizeQF, SF: prizeSF };
            if (round === 'F') {
              const winPrize = prizeWinner;
              const losePrize = prizeRunnerUp;
              awardPrizeMoney(tie.winnerId === playerClubId ? winPrize : losePrize);
            } else if (tie.winnerId === playerClubId) {
              awardPrizeMoney(prizeMap[round as keyof typeof prizeMap] || 0);
            }
            if (isKnockoutRoundComplete(newTourney, round)) {
              if (round === 'F') {
                newTourney.winnerId = tie.winnerId; newTourney.currentPhase = 'complete';
              } else {
                const advanced = advanceKnockoutRound(newTourney, playerClubId, state.totalWeeks);
                Object.assign(newTourney, advanced);
              }
            }
          }
        }
        updates[compKey] = newTourney;
      }
    }
    return { stateUpdates: updates, cleanedPlayers };
  }

  // Super Cup
  const dsc = state.domesticSuperCup;
  const csc = state.continentalSuperCup;
  if (dsc && !dsc.played && dsc.week === week && (dsc.homeClubId === playerClubId || dsc.awayClubId === playerClubId)) {
    const winnerId = result.homeGoals > result.awayGoals ? dsc.homeClubId : result.awayGoals > result.homeGoals ? dsc.awayClubId : (Math.random() < 0.5 ? dsc.homeClubId : dsc.awayClubId);
    updates.domesticSuperCup = { ...dsc, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId };
    if (winnerId === playerClubId) awardPrizeMoney(CONTINENTAL_PRIZE_MONEY.domestic_super_cup);
  } else if (csc && !csc.played && csc.week === week && (csc.homeClubId === playerClubId || csc.awayClubId === playerClubId)) {
    const winnerId = result.homeGoals > result.awayGoals ? csc.homeClubId : result.awayGoals > result.homeGoals ? csc.awayClubId : (Math.random() < 0.5 ? csc.homeClubId : csc.awayClubId);
    updates.continentalSuperCup = { ...csc, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId };
    if (winnerId === playerClubId) awardPrizeMoney(CONTINENTAL_PRIZE_MONEY.continental_super_cup);
  }

  return { stateUpdates: updates, cleanedPlayers };
}

function processTournamentResultWithWinner(
  state: GameState,
  result: Match,
  playerClubId: string,
  processed: { newPlayers: Record<string, import('@/types/game').Player> },
  season: number,
  week: number,
  winnerId: string,
  penaltyShootout: { home: number; away: number },
): { stateUpdates: Record<string, unknown>; cleanedPlayers?: Record<string, import('@/types/game').Player> } {
  const updates: Record<string, unknown> = {};

  // Clean up ephemeral virtual club players
  const realPlayers = { ...processed.newPlayers };
  for (const pid of Object.keys(realPlayers)) {
    if (pid.startsWith('vc-')) delete realPlayers[pid];
  }
  // See processTournamentResult: real loaded clubs from other divisions can appear in
  // `virtualClubs`; only delete clubs that aren't registered in any loaded division.
  const loadedClubIds = new Set<string>();
  for (const ids of Object.values(state.divisionClubs || {})) {
    for (const id of ids) loadedClubIds.add(id);
  }
  const realClubs = { ...state.clubs };
  for (const cid of Object.keys(realClubs)) {
    if ((state.virtualClubs || {})[cid] && !loadedClubIds.has(cid)) {
      delete realClubs[cid];
    }
  }
  const cleanedPlayers = realPlayers;

  // Helper to award prize money to player's club
  const awardPrizeMoney = (amount: number) => {
    if (amount > 0 && realClubs[playerClubId]) {
      realClubs[playerClubId] = { ...realClubs[playerClubId], budget: realClubs[playerClubId].budget + amount };
    }
  };
  updates.clubs = realClubs;

  // Domestic Dynasty Cup decided on penalties. This branch was MISSING: an
  // instant-sim cup tie that went to a shootout was never recorded (the tie
  // stayed unplayed and weekAdvance's orphan recovery re-simulated it with a
  // different result, silently discarding the shootout the player saw).
  if (state.currentCupTieId && state.currentCupTieId !== '__tournament__') {
    const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
      t.id === state.currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId, penaltyShootout } : t
    )};
    const playerWon = winnerId === playerClubId;
    if (playerWon && state.cup.currentRound && state.cup.currentRound !== 'F') {
      const cupRoundPrize: Record<string, number> = { R1: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r1, R2: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r2, R3: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r3, R4: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r4, QF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_qf, SF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_sf };
      awardPrizeMoney(cupRoundPrize[state.cup.currentRound] || 0);
    }
    if (!playerWon) newCup.eliminated = true;
    const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
    if (allPlayed) {
      if (newCup.currentRound === 'F') {
        newCup.winner = winnerId; newCup.currentRound = null;
        awardPrizeMoney(playerWon ? CONTINENTAL_PRIZE_MONEY.dynasty_cup_winner : CONTINENTAL_PRIZE_MONEY.dynasty_cup_runner_up);
      } else { Object.assign(newCup, advanceCupRound(newCup, state.clubs, state.players, state.totalWeeks)); }
    }
    updates.cup = newCup;
    return { stateUpdates: updates, cleanedPlayers };
  }

  // League Cup
  if (state.currentLeagueCupTieId && state.leagueCup) {
    const newLC = { ...state.leagueCup, ties: [...state.leagueCup.ties] };
    const tieIdx = newLC.ties.findIndex(t => t.id === state.currentLeagueCupTieId);
    if (tieIdx >= 0) {
      newLC.ties[tieIdx] = { ...newLC.ties[tieIdx], played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId, penaltyShootout };
      if (winnerId !== playerClubId) newLC.eliminated = true;
      const lcRoundTies = newLC.ties.filter(t => t.round === newLC.currentRound);
      if (lcRoundTies.every(t => t.played)) {
        if (newLC.currentRound === 'F') {
          newLC.winner = winnerId; newLC.currentRound = null;
          awardPrizeMoney(winnerId === playerClubId ? CONTINENTAL_PRIZE_MONEY.league_cup_winner : CONTINENTAL_PRIZE_MONEY.league_cup_runner_up);
        } else { Object.assign(newLC, advanceLeagueCupRound(newLC, state.totalWeeks)); }
      }
    }
    updates.leagueCup = newLC;
    return { stateUpdates: updates, cleanedPlayers };
  }

  // Continental knockout (penalties only happen in knockout/finals)
  if (state.currentContinentalMatchId && state.currentContinentalCompetition) {
    const compKey = state.currentContinentalCompetition === 'champions_cup' ? 'championsCup' : state.currentContinentalCompetition === 'shield_cup' ? 'shieldCup' : 'conferenceCup';
    const isChampions = state.currentContinentalCompetition === 'champions_cup';
    const isShield = state.currentContinentalCompetition === 'shield_cup';
    const prizeR16 = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_r16 : isShield ? CONTINENTAL_PRIZE_MONEY.shield_r16 : CONTINENTAL_PRIZE_MONEY.conference_r16;
    const prizeQF = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_qf : isShield ? CONTINENTAL_PRIZE_MONEY.shield_qf : CONTINENTAL_PRIZE_MONEY.conference_qf;
    const prizeSF = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_sf : isShield ? CONTINENTAL_PRIZE_MONEY.shield_sf : CONTINENTAL_PRIZE_MONEY.conference_sf;
    const prizeWinner = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_winner : isShield ? CONTINENTAL_PRIZE_MONEY.shield_winner : CONTINENTAL_PRIZE_MONEY.conference_winner;
    const prizeRunnerUp = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_runner_up : isShield ? CONTINENTAL_PRIZE_MONEY.shield_runner_up : CONTINENTAL_PRIZE_MONEY.conference_runner_up;
    const tourney = state[compKey];
    if (tourney) {
      const matchInfo = findPlayerContinentalMatch(tourney, week, playerClubId);
      if (matchInfo && matchInfo.type === 'knockout') {
        const newTourney = { ...tourney, groups: [...tourney.groups], knockoutTies: [...tourney.knockoutTies] };
        const tie = { ...newTourney.knockoutTies[matchInfo.tieIdx] };
        if (matchInfo.leg === 1 || tie.round === 'F') {
          tie.leg1Played = true; tie.leg1HomeGoals = result.homeGoals; tie.leg1AwayGoals = result.awayGoals;
        } else {
          tie.leg2Played = true; tie.leg2HomeGoals = result.homeGoals; tie.leg2AwayGoals = result.awayGoals;
        }
        tie.winnerId = winnerId;
        tie.penaltyShootout = penaltyShootout;
        newTourney.knockoutTies[matchInfo.tieIdx] = tie;
        if (winnerId !== playerClubId) newTourney.playerEliminated = true;
        // Award knockout prize money
        const round = tie.round;
        const prizeMap =
              { R16: prizeR16, QF: prizeQF, SF: prizeSF };
        if (round === 'F') {
          const winPrize = prizeWinner;
          const losePrize = prizeRunnerUp;
          awardPrizeMoney(winnerId === playerClubId ? winPrize : losePrize);
        } else if (winnerId === playerClubId) {
          awardPrizeMoney(prizeMap[round as keyof typeof prizeMap] || 0);
        }
        if (isKnockoutRoundComplete(newTourney, round)) {
          if (round === 'F') { newTourney.winnerId = winnerId; newTourney.currentPhase = 'complete'; }
          else { Object.assign(newTourney, advanceKnockoutRound(newTourney, playerClubId, state.totalWeeks)); }
        }
        updates[compKey] = newTourney;
      }
    }
    return { stateUpdates: updates, cleanedPlayers };
  }

  // Super Cup (penalties)
  const dsc = state.domesticSuperCup;
  const csc = state.continentalSuperCup;
  if (dsc && !dsc.played && dsc.week === week && (dsc.homeClubId === playerClubId || dsc.awayClubId === playerClubId)) {
    updates.domesticSuperCup = { ...dsc, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId, penaltyShootout };
    if (winnerId === playerClubId) awardPrizeMoney(CONTINENTAL_PRIZE_MONEY.domestic_super_cup);
  } else if (csc && !csc.played && csc.week === week && (csc.homeClubId === playerClubId || csc.awayClubId === playerClubId)) {
    updates.continentalSuperCup = { ...csc, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId, penaltyShootout };
    if (winnerId === playerClubId) awardPrizeMoney(CONTINENTAL_PRIZE_MONEY.continental_super_cup);
  }

  return { stateUpdates: updates, cleanedPlayers };
}

function computeShoutMods(matchShouts: { type: keyof typeof SHOUT_MODIFIERS }[]) {
  if (matchShouts.length === 0) return { attackMod: 0, defenseMod: 0, foulMod: 0 };
  let aMod = 0, dMod = 0, fMod = 0;
  for (const s of matchShouts) {
    const m = SHOUT_MODIFIERS[s.type];
    if ('attackMod' in m) aMod += m.attackMod;
    if ('defenseMod' in m) dMod += m.defenseMod;
    if ('cardReduction' in m) fMod -= m.cardReduction;
    // time_waste: convert event chance reduction to small defensive bump
    if ('eventChanceReduction' in m) dMod += 0.05;
  }
  const scale = SHOUT_CUMULATIVE_SCALE;
  return { attackMod: aMod * scale, defenseMod: dMod * scale, foulMod: fMod * scale };
}

export function playCurrentMatchImpl(set: Set, get: Get): Match | null {
  const state = get();
  // Career mode: block match play when unemployed
  if (state.gameMode === 'career' && !state.careerManager?.contract) return null;
  const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;

  // ── Detect match type ──
  // Priority: friendly → continental → cup → leagueCup → superCup → league.
  // Continental and cup ties must win over league fixtures: when both fall on
  // the same week, the user MUST play the high-stakes tie interactively or it
  // gets silently skipped (continental's group-stage AI sim explicitly skips
  // the player's match in expectation of interactive play — leaving league
  // ahead in priority caused 0-played continental campaigns and the user
  // being eliminated without ever seeing a game). The conflicting league
  // fixture gets AI-simulated by advanceWeek's div-fixture loop instead.
  const friendlyMatch = state.friendlies?.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
  const champMatch = !friendlyMatch ? findPlayerContinentalMatch(state.championsCup, week, playerClubId) : null;
  const shieldMatch = !friendlyMatch && !champMatch ? findPlayerContinentalMatch(state.shieldCup, week, playerClubId) : null;
  const confMatch = !friendlyMatch && !champMatch && !shieldMatch ? findPlayerContinentalMatch(state.conferenceCup, week, playerClubId) : null;
  const continentalMatch = champMatch || shieldMatch || confMatch;
  const continentalComp = champMatch ? 'champions_cup' as const : shieldMatch ? 'shield_cup' as const : confMatch ? 'conference_cup' as const : null;
  const continentalTourney = champMatch ? state.championsCup : shieldMatch ? state.shieldCup : confMatch ? state.conferenceCup : null;
  const cupTie = !friendlyMatch && !continentalMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const leagueCupTie = !friendlyMatch && !continentalMatch && !cupTie ? state.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const superCup = !friendlyMatch && !continentalMatch && !cupTie && !leagueCupTie
    ? (state.domesticSuperCup && !state.domesticSuperCup.played && state.domesticSuperCup.week === week && (state.domesticSuperCup.homeClubId === playerClubId || state.domesticSuperCup.awayClubId === playerClubId) ? state.domesticSuperCup : null)
      || (state.continentalSuperCup && !state.continentalSuperCup.played && state.continentalSuperCup.week === week && (state.continentalSuperCup.homeClubId === playerClubId || state.continentalSuperCup.awayClubId === playerClubId) ? state.continentalSuperCup : null)
    : null;
  const leagueMatch = !friendlyMatch && !continentalMatch && !cupTie && !leagueCupTie && !superCup
    ? fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    : null;

  // Build match object from the detected source
  let match: Match | null = null;
  let ephemeralClub: { club: Club; players: Record<string, Player> } | null = null;
  let effectiveClubs = clubs;
  let effectivePlayers = players;

  if (friendlyMatch) {
    match = friendlyMatch;
  } else if (leagueMatch) {
    match = leagueMatch;
  } else if (cupTie) {
    match = { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  } else if (continentalMatch && continentalTourney) {
    let homeId: string, awayId: string, matchId: string;
    if (continentalMatch.type === 'group') {
      const gm = continentalTourney.groups[continentalMatch.groupIdx].matches[continentalMatch.matchIdx];
      homeId = gm.homeClubId; awayId = gm.awayClubId; matchId = gm.id;
    } else {
      const tie = continentalTourney.knockoutTies[continentalMatch.tieIdx];
      if (continentalMatch.leg === 1 || tie.round === 'F') {
        homeId = tie.homeClubId; awayId = tie.awayClubId;
      } else {
        homeId = tie.awayClubId; awayId = tie.homeClubId;
      }
      matchId = tie.id;
    }
    const oppId = homeId === playerClubId ? awayId : homeId;
    const vc = (state.virtualClubs || {})[oppId];
    // Only create an ephemeral club when the opponent isn't already loaded.
    // When `vc` is the player's own loaded league (cup winner / cross-division
    // qualifier), `clubs[oppId]` is the real club — generating an ephemeral
    // copy would overwrite its real squad/budget on `set({ clubs })` and the
    // post-match `vc-*` player sweep would then strand its `playerIds`.
    if (vc && !clubs[oppId]) {
      ephemeralClub = createEphemeralClub(vc, season, state.communityPackEnabled);
      effectiveClubs = { ...clubs, [oppId]: ephemeralClub.club };
      effectivePlayers = { ...players, ...ephemeralClub.players };
    }
    match = { id: matchId, week, homeClubId: homeId, awayClubId: awayId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  } else if (leagueCupTie) {
    match = { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  } else if (superCup) {
    const oppId = superCup.homeClubId === playerClubId ? superCup.awayClubId : superCup.homeClubId;
    const vc = (state.virtualClubs || {})[oppId];
    if (vc && !clubs[oppId]) {
      ephemeralClub = createEphemeralClub(vc, season, state.communityPackEnabled);
      effectiveClubs = { ...clubs, [oppId]: ephemeralClub.club };
      effectivePlayers = { ...players, ...ephemeralClub.players };
    }
    match = { id: `super-cup-${superCup.type}`, week, homeClubId: superCup.homeClubId, awayClubId: superCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  }

  if (!match) return null;

  // Determine competition metadata
  const isFriendly = !!friendlyMatch;
  const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCup;
  const matchCompetition = isFriendly ? 'Pre-Season Friendly'
    : cupTie ? `Dynasty Cup — ${cupTie.round}`
    : leagueCupTie ? `League Cup — ${leagueCupTie.round}`
    : continentalComp === 'champions_cup' ? 'Champions Cup'
    : continentalComp === 'shield_cup' ? 'Shield Cup'
    : continentalComp === 'conference_cup' ? 'Conference Cup'
    : superCup ? (superCup.type === 'domestic' ? 'Super Cup' : 'Continental Super Cup')
    : null;

  const hc = effectiveClubs[match.homeClubId];
  const ac = effectiveClubs[match.awayClubId];
  if (!hc || !ac) return null;
  const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
  const backfillFromSubs = (lineup: Player[], club: typeof hc) => {
    const availableSubs = (club.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !isSuspended(p) && !p.injured);
    const ids = new Set(lineup.map(p => p.id));
    for (const sub of availableSubs) {
      if (lineup.length >= 11) break;
      if (!ids.has(sub.id)) { lineup.push(sub); ids.add(sub.id); }
    }
    return lineup;
  };
  let hp = backfillFromSubs((hc.lineup || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !isSuspended(p)), hc);
  let ap = backfillFromSubs((ac.lineup || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !isSuspended(p)), ac);

  // Need minimum players to simulate a match
  if (hp.length < 7 || ap.length < 7) return null;

  // For ephemeral clubs: inject their players and club into state temporarily
  if (ephemeralClub) {
    set({ clubs: effectiveClubs, players: effectivePlayers });
  }

  // Motivator perk: boost player team morale before match
  if (hasPerk(state.managerProgression, 'motivator')) {
    const boostPlayers = (ps: typeof hp, clubId: string) =>
      clubId === playerClubId ? ps.map(p => ({ ...p, morale: Math.min(100, p.morale + Math.round(MOTIVATOR_MORALE_BOOST * branchMult(state.managerProgression, 'motivator'))) })) : ps;
    hp = boostPlayers(hp, match.homeClubId);
    ap = boostPlayers(ap, match.awayClubId);
  }

  const isPlayerHome = match.homeClubId === playerClubId;
  // AI counter-tactics: opponent analyzes player's setup
  const opponentClub = isPlayerHome ? ac : hc;
  const opponentProfile = opponentClub.aiManagerProfile;
  const counterReduction = hasPerk(state.managerProgression, 'counter_master') ? 0.25 : 0;
  const aiCounterTactics = opponentProfile ? getAICounterTactics(opponentProfile, tactics, clubs[playerClubId]?.formation || '4-4-2', counterReduction) : undefined;
  const homeTactics = isPlayerHome ? tactics : aiCounterTactics;
  const awayTactics = isPlayerHome ? aiCounterTactics : tactics;
  // Store pre-match league position
  const preEntry = state.leagueTable.find(e => e.clubId === playerClubId);
  const prePos = preEntry ? state.leagueTable.indexOf(preEntry) + 1 : 10;

  try {
  const matchDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
  const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
  const careerDisciplineMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
  // Build bench for both teams
  const hpIdSet = new Set(hp.map(p => p.id));
  const apIdSet = new Set(ap.map(p => p.id));
  const hBenchCM = (hc.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !hpIdSet.has(p.id) && !p.injured && !isSuspended(p));
  const aBenchCM = (ac.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !apIdSet.has(p.id) && !p.injured && !isSuspended(p));
  // Capture pre-match snapshot for Invincible perk (match rewind on loss).
  // Must include EVERYTHING the post-match processing writes — a partial
  // snapshot lets the replay double-count manager stats, XP, rivalries,
  // chemistry, ELO, session stats and keep stale messages/press conferences.
  if (hasPerk(state.managerProgression, 'invincible') && !state.invincibleUsedThisSeason && !isFriendly) {
    set({ preMatchSnapshot: {
      fixtures: [...state.fixtures],
      divisionFixtures: { ...state.divisionFixtures },
      players: { ...state.players },
      boardConfidence: state.boardConfidence,
      leagueTable: [...state.leagueTable],
      divisionTables: { ...state.divisionTables },
      clubs: { ...state.clubs },
      managerStats: { ...state.managerStats },
      managerProgression: state.managerProgression,
      careerTimeline: [...state.careerTimeline],
      rivalries: { ...(state.rivalries || {}) },
      pairFamiliarity: { ...(state.pairFamiliarity || {}) },
      clubPowerRankings: { ...(state.clubPowerRankings || {}) },
      sessionStats: { ...state.sessionStats },
      messages: [...state.messages],
      pendingPressConference: state.pendingPressConference,
    } });
  }

  const spCoachInstant = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * branchMult(state.managerProgression, 'tactician') : 0;
  const { result, playerRatings, matchInjuries } = simulateMatch(match, hc, ac, hp, ap, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, matchDerbyIntensity, hasDisciplinarian, season, careerDisciplineMod, hBenchCM, aBenchCM, undefined, spCoachInstant);

  // ── Cup/Tournament match path ──
  if (isCupMatch) {
    // Resolve draws for cup matches (extra time + penalties)
    let finalResult = result;
    let penaltyShootout: { home: number; away: number } | undefined;
    let cupWinnerId: string | undefined;

    if (result.homeGoals === result.awayGoals) {
      const isContinentalGroup = continentalMatch?.type === 'group';
      // Continental knockout leg 1 (non-final): draws are valid, aggregate decided after leg 2
      const isContinentalLeg1 = continentalMatch?.type === 'knockout' && continentalMatch.leg === 1
        && continentalTourney?.knockoutTies[continentalMatch.tieIdx]?.round !== 'F';
      // Check aggregate for continental knockout leg 2
      let isAggDecided = false;
      if (continentalMatch && continentalMatch.type === 'knockout' && continentalTourney) {
        const tie = continentalTourney.knockoutTies[continentalMatch.tieIdx];
        if (continentalMatch.leg === 2 && tie.round !== 'F') {
          const homeAgg = tie.leg1HomeGoals + result.awayGoals;
          const awayAgg = tie.leg1AwayGoals + result.homeGoals;
          isAggDecided = homeAgg !== awayAgg;
        }
      }

      if (!isContinentalGroup && !isContinentalLeg1 && !isAggDecided) {
        let hGoals = result.homeGoals;
        let aGoals = result.awayGoals;
        const cupEvents = [...result.events];

        // Dynasty Cup: extra time first, then penalties
        if (cupTie) {
          const homeStr = hc.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
          const awayStr = ac.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
          if (Math.random() < CUP_EXTRA_TIME_GOAL_CHANCE * homeStr) {
            hGoals++;
            cupEvents.push({ minute: 105, type: 'extra_time_goal', clubId: match.homeClubId, description: `${hc.shortName} score in extra time!` });
          }
          if (Math.random() < CUP_EXTRA_TIME_GOAL_CHANCE * awayStr) {
            aGoals++;
            cupEvents.push({ minute: 115, type: 'extra_time_goal', clubId: match.awayClubId, description: `${ac.shortName} score in extra time!` });
          }
        }

        // Penalties if still level (League Cup / continental / super cup go straight to pens; Dynasty Cup after ET)
        if (hGoals === aGoals) {
          const homeGK = hp.find(p => p.position === 'GK');
          const awayGK = ap.find(p => p.position === 'GK');
          const homeGKQ = homeGK ? (homeGK.attributes.defending + homeGK.attributes.mental) / 200 : 0.5;
          const awayGKQ = awayGK ? (awayGK.attributes.defending + awayGK.attributes.mental) / 200 : 0.5;
          const so = simulatePenaltyShootout({ homeName: hc.shortName, awayName: ac.shortName, homeGKQuality: homeGKQ, awayGKQuality: awayGKQ });
          penaltyShootout = { home: so.homeScore, away: so.awayScore };
          // The shootout decides the WINNER, not the score — keep the real
          // drawn scoreline (the old +1 phantom goal had no scorer, so team
          // goal totals stopped matching player stats).
          cupWinnerId = so.winner === 'home' ? match.homeClubId : match.awayClubId;
          cupEvents.push({ minute: 120, type: 'penalty_shootout', clubId: so.winner === 'home' ? match.homeClubId : match.awayClubId, description: `${so.winner === 'home' ? hc.shortName : ac.shortName} win on penalties (${so.homeScore}-${so.awayScore})!` });
        }

        finalResult = { ...result, homeGoals: hGoals, awayGoals: aGoals, events: cupEvents, penaltyShootout };
        if (!cupWinnerId) cupWinnerId = hGoals > aGoals ? match.homeClubId : match.awayClubId;
      }
    }

    // Use effective clubs/players for processMatchResult (ephemeral clubs for continental/super cup opponents)
    const effectiveState = ephemeralClub ? { ...state, clubs: effectiveClubs, players: effectivePlayers } : state;
    const processed = processMatchResult(effectiveState, match, finalResult, playerRatings, () => get().week, matchInjuries, penaltyShootout ? cupWinnerId : undefined);

    // Build temporary state with tournament tracking fields for processTournamentResult
    const tempCupTieId = cupTie ? cupTie.id : (leagueCupTie || continentalMatch || superCup) ? '__tournament__' : null;
    const tempState = {
      ...effectiveState,
      players: processed.newPlayers,
      currentCupTieId: tempCupTieId,
      currentLeagueCupTieId: leagueCupTie ? leagueCupTie.id : null,
      currentContinentalMatchId: continentalMatch ? `${continentalComp}-${continentalMatch.type === 'group' ? 'g' : 'k'}-${continentalMatch.type === 'group' ? continentalMatch.groupIdx : continentalMatch.tieIdx}` : null,
      currentContinentalCompetition: continentalComp,
    };

    const tournamentUpdates = (penaltyShootout && cupWinnerId)
      ? processTournamentResultWithWinner(tempState, { ...finalResult, penaltyShootout }, playerClubId, processed, season, week, cupWinnerId, penaltyShootout)
      : processTournamentResult(tempState, finalResult, playerClubId, processed, season, week);

    const cupDrama = detectMatchDrama(finalResult, playerClubId, effectiveClubs);
    const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';

    // Add tournament-specific inbox message (e.g. "Cup: R2 Won!" / "League Cup: Eliminated")
    const oppClub = effectiveClubs[isPlayerHome ? match.awayClubId : match.homeClubId];
    const oppName = oppClub?.name || 'Unknown';
    const fScore = `${finalResult.homeGoals}-${finalResult.awayGoals}`;
    let cupMessages = processed.newMessages;
    if (cupTie) {
      const roundName = getRoundName(cupTie.round);
      if (processed.won) {
        cupMessages = addMsg(cupMessages, { week, season, type: 'match_result', title: `Cup: ${roundName} Won!`, body: `You beat ${oppName} ${fScore} to advance in the cup!` });
      } else if (processed.lost) {
        cupMessages = addMsg(cupMessages, { week, season, type: 'match_result', title: `Cup: Eliminated`, body: `You were knocked out by ${oppName} ${fScore} in the ${roundName}.` });
      }
    } else if (leagueCupTie) {
      const roundName = getRoundName(leagueCupTie.round);
      if (processed.won) {
        cupMessages = addMsg(cupMessages, { week, season, type: 'match_result', title: `League Cup: ${roundName} Won!`, body: `You beat ${oppName} ${fScore} to advance in the League Cup!` });
      } else if (processed.lost) {
        cupMessages = addMsg(cupMessages, { week, season, type: 'match_result', title: `League Cup: Eliminated`, body: `You were knocked out by ${oppName} ${fScore} in the ${roundName}.` });
      }
    } else if (continentalMatch) {
      const compName = continentalComp === 'champions_cup' ? 'Champions Cup' : 'Shield Cup';
      if (processed.won) {
        cupMessages = addMsg(cupMessages, { week, season, type: 'match_result', title: `${compName}: Victory`, body: `A great result against ${oppName} (${fScore}) in the ${compName}!` });
      } else if (processed.lost) {
        cupMessages = addMsg(cupMessages, { week, season, type: 'match_result', title: `${compName}: Defeat`, body: `A tough loss against ${oppName} (${fScore}) in the ${compName}.` });
      }
    }

    // Update session stats
    const prevSession = state.sessionStats || { startWeek: week, startSeason: season, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 };
    const sessionStats = {
      ...prevSession,
      matchesWon: prevSession.matchesWon + (processed.won ? 1 : 0),
      matchesLost: prevSession.matchesLost + (processed.lost ? 1 : 0),
    };

    set({
      currentMatchResult: finalResult,
      players: tournamentUpdates.cleanedPlayers || processed.newPlayers,
      boardConfidence: processed.confidence,
      messages: cupMessages,
      matchSubsUsed: 0,
      matchPlayerRatings: processed.playerRatings,
      managerStats: processed.managerStats,
      matchPhase: 'full_time' as const,
      currentCupTieId: null,
      currentLeagueCupTieId: null,
      currentContinentalMatchId: null,
      currentContinentalCompetition: null,
      lastMatchCompetition: matchCompetition,
      pendingPressConference: generatePostMatchPress(pressContext, isPro(get().monetization), { margin: Math.abs(finalResult.homeGoals - finalResult.awayGoals), hasDrama: !!cupDrama, isCup: true }),
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
      managerProgression: processed.managerProgression,
      preMatchLeaguePosition: prePos,
      lastMatchXPGain: processed.xpGain,
      lastMatchDrama: cupDrama,
      rivalries: processed.updatedRivalries,
      pairFamiliarity: processed.pairFamiliarity,
      sessionStats,
      ...tournamentUpdates.stateUpdates,
    });

    // Career mode: update reputation after match
    {
      const postMatch = get();
      if (postMatch.gameMode === 'career' && postMatch.careerManager) {
        const cm = { ...postMatch.careerManager };
        const repDelta = processed.won ? REP_WIN : processed.lost ? REP_LOSS : REP_DRAW;
        cm.reputationScore = Math.max(REP_MIN, Math.min(REP_MAX, cm.reputationScore + repDelta));
        cm.reputationTier = calculateReputationTier(cm.reputationScore);
        set({ careerManager: cm });
      }
    }

    if (get().settings.autoSave) get().saveGame();
    return finalResult;
  }

  // ── Friendly match path ──
  if (isFriendly) {
    const processed = processMatchResult(state, match, result, playerRatings, () => get().week, matchInjuries);
    // Scale board confidence delta for friendlies (25% impact)
    const confDelta = (processed.confidence - (state.boardConfidence || 50)) * FRIENDLY_BOARD_CONFIDENCE_MULT;
    const friendlyConfidence = Math.max(0, Math.min(100, (state.boardConfidence || 50) + confDelta));

    const drama = detectMatchDrama(result, playerClubId, clubs);
    const prevSession = state.sessionStats || { startWeek: week, startSeason: season, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 };

    set({
      friendlies: state.friendlies.map(f => f.id === match.id ? result : f),
      currentMatchResult: result,
      players: processed.newPlayers,
      boardConfidence: friendlyConfidence,
      messages: processed.newMessages,
      matchSubsUsed: 0,
      matchPlayerRatings: processed.playerRatings,
      managerStats: processed.managerStats,
      matchPhase: 'full_time' as const,
      lastMatchCompetition: 'Pre-Season Friendly',
      pendingPressConference: null,
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
      managerProgression: processed.managerProgression,
      preMatchLeaguePosition: prePos,
      lastMatchXPGain: Math.round((processed.xpGain || 0) * 0.5),
      lastMatchDrama: drama,
      pairFamiliarity: processed.pairFamiliarity,
      sessionStats: {
        ...prevSession,
        matchesWon: prevSession.matchesWon + (processed.won ? 1 : 0),
        matchesLost: prevSession.matchesLost + (processed.lost ? 1 : 0),
      },
    });

    if (get().settings.autoSave) get().saveGame();
    return result;
  }

  // ── League match path ──
  const processed = processMatchResult(state, match, result, playerRatings, () => get().week, matchInjuries);

  // Simulate AI matches for the same week so league table position is accurate in PostMatchPopup
  const aiWeekMatches = processed.updatedFixtures.filter(
    m => m.week === week && !m.played && m.homeClubId !== playerClubId && m.awayClubId !== playerClubId
  );
  const fullFixtures = [...processed.updatedFixtures];
  const playersWithAI = { ...processed.newPlayers };
  const eloRankings = { ...(state.clubPowerRankings || {}) };
  // Update ELO for the player's own match
  updateEloRatings(eloRankings, match.homeClubId, match.awayClubId, result.homeGoals, result.awayGoals, 'league');
  for (const m of aiWeekMatches) {
    const idx = fullFixtures.findIndex(f => f.id === m.id);
    const hc2 = clubs[m.homeClubId];
    const ac2 = clubs[m.awayClubId];
    if (!hc2 || !ac2) continue;
    const hAvail2 = hc2.playerIds.map(id => playersWithAI[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
    const aAvail2 = ac2.playerIds.map(id => playersWithAI[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
    const hp2 = hAvail2.slice(0, LINEUP_SIZE);
    const ap2 = aAvail2.slice(0, LINEUP_SIZE);
    if (hp2.length === 0 || ap2.length === 0) {
      fullFixtures[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap2.length === 0 ? 0 : FORFEIT_SCORE, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
      continue;
    }
    const { result: aiResult } = simulateMatch(m, hc2, ac2, hp2, ap2, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season, undefined, hAvail2.slice(11, 18), aAvail2.slice(11, 18));
    fullFixtures[idx] = aiResult;
    applyAIMatchEvents(aiResult.events, playersWithAI, clubs, week, hp2, ap2, aiResult.homeGoals, aiResult.awayGoals, eloRankings, m.homeClubId, m.awayClubId);
    updateEloRatings(eloRankings, m.homeClubId, m.awayClubId, aiResult.homeGoals, aiResult.awayGoals, 'league');
  }
  const divClubIds = state.divisionClubs[state.playerDivision] || Object.keys(clubs);
  const fullLeagueTable = buildLeagueTable(fullFixtures, divClubIds);

  // Detect match drama for emotional amplification
  const drama = detectMatchDrama(result, playerClubId, clubs);

  // Generate post-match press conference (only when the match was notable)
  const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
  const press = generatePostMatchPress(pressContext, isPro(get().monetization), {
    margin: Math.abs(result.homeGoals - result.awayGoals),
    isDerby: getDerbyIntensity(match.homeClubId, match.awayClubId) > 0,
    hasDrama: !!drama,
  });

  // Update session stats for wins/losses
  const prevSession = state.sessionStats || { startWeek: week, startSeason: season, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 };
  const sessionStats = {
    ...prevSession,
    matchesWon: prevSession.matchesWon + (processed.won ? 1 : 0),
    matchesLost: prevSession.matchesLost + (processed.lost ? 1 : 0),
  };

  const syncedDivFixtures = { ...state.divisionFixtures, [state.playerDivision]: fullFixtures };
  set({
    fixtures: fullFixtures, players: playersWithAI, leagueTable: fullLeagueTable,
    currentMatchResult: result, boardConfidence: processed.confidence, messages: processed.newMessages,
    matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
    matchPhase: 'full_time' as const,
    pendingPressConference: press,
    divisionFixtures: syncedDivFixtures,
    divisionTables: { ...state.divisionTables, [state.playerDivision]: fullLeagueTable },
    careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
    managerProgression: processed.managerProgression,
    preMatchLeaguePosition: prePos,
    lastMatchCompetition: null,
    lastMatchXPGain: processed.xpGain,
    lastMatchDrama: drama,
    rivalries: processed.updatedRivalries,
    pairFamiliarity: processed.pairFamiliarity,
    clubPowerRankings: eloRankings,
    sessionStats,
  });

  // Career mode: update reputation after match
  {
    const postMatch = get();
    if (postMatch.gameMode === 'career' && postMatch.careerManager) {
      const cm = { ...postMatch.careerManager };
      const repDelta = processed.won ? REP_WIN : processed.lost ? REP_LOSS : REP_DRAW;
      cm.reputationScore = Math.max(REP_MIN, Math.min(REP_MAX, cm.reputationScore + repDelta));

      cm.reputationTier = calculateReputationTier(cm.reputationScore);
      set({ careerManager: cm });
    }
  }

  // Auto-save after match completes
  if (get().settings.autoSave) get().saveGame();

  return result;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playCurrentMatch' } });
    try {
      get().cleanupAbandonedMatch();
      // Navigate back to the dashboard — without this, the React tree
      // stays mounted on MatchDay with halfTimeState now null, and the
      // next render reads from a stale slot → crash loop. Forcing a
      // screen change unmounts MatchDay cleanly so the user lands on a
      // safe page with the inbox message explaining what happened.
      set({
        currentScreen: 'dashboard',
        messages: addMsg(get().messages, {
          week: get().week, season: get().season, type: 'general',
          title: 'Match Error',
          body: 'An error occurred during the match simulation. The match has been abandoned.',
        }),
      });
    } catch (cleanupErr) {
      Sentry.captureException(cleanupErr, { tags: { context: 'matchCleanup' } });
    }
    return null;
  }
}

export function playFirstHalfImpl(set: Set, get: Get): HalfState | null {
  const state = get();
  const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;
  const friendlyMatch = state.friendlies?.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));

  // Priority: friendly → continental → cup → leagueCup → superCup → league.
  // Mirrors the order in playCurrentMatchImpl — see the comment there for the
  // reasoning. MatchDay uses THIS function for the interactive flow, so the
  // priority must match or the continental fix gets bypassed for live play.
  const champMatch = !friendlyMatch ? findPlayerContinentalMatch(state.championsCup, week, playerClubId) : null;
  const shieldMatch = !friendlyMatch && !champMatch ? findPlayerContinentalMatch(state.shieldCup, week, playerClubId) : null;
  const confMatch = !friendlyMatch && !champMatch && !shieldMatch ? findPlayerContinentalMatch(state.conferenceCup, week, playerClubId) : null;
  const continentalMatch = champMatch || shieldMatch || confMatch;
  const continentalComp = champMatch ? 'champions_cup' as const : shieldMatch ? 'shield_cup' as const : confMatch ? 'conference_cup' as const : null;
  const continentalTourney = champMatch ? state.championsCup : shieldMatch ? state.shieldCup : confMatch ? state.conferenceCup : null;
  const cupTie = !friendlyMatch && !continentalMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const leagueCupTie = !friendlyMatch && !continentalMatch && !cupTie ? state.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const superCup = !friendlyMatch && !continentalMatch && !cupTie && !leagueCupTie
    ? (state.domesticSuperCup && !state.domesticSuperCup.played && state.domesticSuperCup.week === week && (state.domesticSuperCup.homeClubId === playerClubId || state.domesticSuperCup.awayClubId === playerClubId) ? state.domesticSuperCup : null)
      || (state.continentalSuperCup && !state.continentalSuperCup.played && state.continentalSuperCup.week === week && (state.continentalSuperCup.homeClubId === playerClubId || state.continentalSuperCup.awayClubId === playerClubId) ? state.continentalSuperCup : null)
    : null;
  const leagueMatch = !friendlyMatch && !continentalMatch && !cupTie && !leagueCupTie && !superCup
    ? fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    : null;

  // Build match object from the detected source
  let match: Match | null = null;
  let ephemeralClub: { club: Club; players: Record<string, Player> } | null = null;
  let effectiveClubs = clubs;
  let effectivePlayers = players;

  if (friendlyMatch) {
    match = friendlyMatch;
  } else if (leagueMatch) {
    match = leagueMatch;
  } else if (cupTie) {
    match = { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  } else if (continentalMatch && continentalTourney) {
    let homeId: string, awayId: string, matchId: string;
    if (continentalMatch.type === 'group') {
      const gm = continentalTourney.groups[continentalMatch.groupIdx].matches[continentalMatch.matchIdx];
      homeId = gm.homeClubId; awayId = gm.awayClubId; matchId = gm.id;
    } else {
      const tie = continentalTourney.knockoutTies[continentalMatch.tieIdx];
      // For knockout: leg 1 uses original home/away, leg 2 reverses
      if (continentalMatch.leg === 1 || tie.round === 'F') {
        homeId = tie.homeClubId; awayId = tie.awayClubId;
      } else {
        homeId = tie.awayClubId; awayId = tie.homeClubId; // Leg 2: reversed
      }
      matchId = tie.id;
    }
    // Create ephemeral club for the continental opponent — only when the
    // opponent isn't already a loaded real club (see playCurrentMatchImpl).
    const oppId = homeId === playerClubId ? awayId : homeId;
    const vc = (state.virtualClubs || {})[oppId];
    if (vc && !clubs[oppId]) {
      ephemeralClub = createEphemeralClub(vc, season, state.communityPackEnabled);
      effectiveClubs = { ...clubs, [oppId]: ephemeralClub.club };
      effectivePlayers = { ...players, ...ephemeralClub.players };
    }
    match = { id: matchId, week, homeClubId: homeId, awayClubId: awayId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  } else if (leagueCupTie) {
    match = { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  } else if (superCup) {
    const oppId = superCup.homeClubId === playerClubId ? superCup.awayClubId : superCup.homeClubId;
    const vc = (state.virtualClubs || {})[oppId];
    if (vc && !clubs[oppId]) {
      ephemeralClub = createEphemeralClub(vc, season, state.communityPackEnabled);
      effectiveClubs = { ...clubs, [oppId]: ephemeralClub.club };
      effectivePlayers = { ...players, ...ephemeralClub.players };
    }
    match = { id: `super-cup-${superCup.type}`, week, homeClubId: superCup.homeClubId, awayClubId: superCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
  }

  if (!match) return null;

  const hc = effectiveClubs[match.homeClubId];
  const ac = effectiveClubs[match.awayClubId];
  if (!hc || !ac) return null;
  const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
  const backfillFromSubs = (lineup: Player[], club: typeof hc) => {
    const availableSubs = (club.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !isSuspended(p) && !p.injured);
    const ids = new Set(lineup.map(p => p.id));
    for (const sub of availableSubs) {
      if (lineup.length >= 11) break;
      if (!ids.has(sub.id)) { lineup.push(sub); ids.add(sub.id); }
    }
    return lineup;
  };
  let hp = backfillFromSubs((hc.lineup || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !isSuspended(p)), hc);
  let ap = backfillFromSubs((ac.lineup || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !isSuspended(p)), ac);

  // Need minimum players to simulate a match
  if (hp.length < 7 || ap.length < 7) return null;

  try {
  // For ephemeral clubs: inject their players and club into state temporarily
  if (ephemeralClub) {
    set({ clubs: effectiveClubs, players: effectivePlayers });
  }

  // Motivator perk: boost player team morale before match
  if (hasPerk(state.managerProgression, 'motivator')) {
    const boostPlayers = (ps: typeof hp, clubId: string) =>
      clubId === playerClubId ? ps.map(p => ({ ...p, morale: Math.min(100, p.morale + Math.round(MOTIVATOR_MORALE_BOOST * branchMult(state.managerProgression, 'motivator'))) })) : ps;
    hp = boostPlayers(hp, match.homeClubId);
    ap = boostPlayers(ap, match.awayClubId);
  }

  const isPlayerHome = match.homeClubId === playerClubId;
  const oppClubHalf = isPlayerHome ? ac : hc;
  const oppProfileHalf = oppClubHalf.aiManagerProfile;
  const ctrRedHalf = hasPerk(state.managerProgression, 'counter_master') ? 0.25 : 0;
  const aiCtrHalf = oppProfileHalf ? getAICounterTactics(oppProfileHalf, tactics, clubs[playerClubId]?.formation || '4-4-2', ctrRedHalf) : undefined;
  const homeTactics = isPlayerHome ? tactics : aiCtrHalf;
  const awayTactics = isPlayerHome ? aiCtrHalf : tactics;

  // Store pre-match league position for post-match popup
  const preMatchEntry = state.leagueTable.find(e => e.clubId === playerClubId);
  const preMatchPos = preMatchEntry ? state.leagueTable.indexOf(preMatchEntry) + 1 : 10;

  // Build bench arrays for AI substitution logic
  const hpIds = new Set(hp.map(p => p.id));
  const apIds = new Set(ap.map(p => p.id));
  const hBench = (hc.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !hpIds.has(p.id) && !p.injured && !isSuspended(p));
  const aBench = (ac.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !apIds.has(p.id) && !p.injured && !isSuspended(p));

  const halfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
  const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
  const halfCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
  const spCoachBonus = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * branchMult(state.managerProgression, 'tactician') : 0;
  const matchWeather = generateMatchWeather();
  // Pre-kickoff team talk (G3): on high-stakes matches the player can give a
  // pre-match talk, which sets `matchTeamTalk` before kickoff. Apply it to the
  // FIRST half here, then clear it below so half-time starts fresh — the
  // pre-match and half-time talks are independent one-shots.
  const preMatchTalkMods = teamTalkModifiers(state.matchTeamTalk);
  const halfState = simulateHalf(hc, ac, hp, ap, 1, 45, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, undefined, halfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, halfCareerMod, hBench, aBench, preMatchTalkMods, matchWeather, spCoachBonus);

  // Determine which cup tracking IDs to set
  const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCup;
  const matchCompetition = friendlyMatch ? 'Pre-Season Friendly'
    : cupTie ? `Dynasty Cup — ${cupTie.round}`
    : leagueCupTie ? `League Cup — ${leagueCupTie.round}`
    : champMatch && continentalTourney ? getContinentalMatchLabel('Champions Cup', champMatch, continentalTourney)
    : shieldMatch && continentalTourney ? getContinentalMatchLabel('Shield Cup', shieldMatch, continentalTourney)
    : confMatch && continentalTourney ? getContinentalMatchLabel('Conference Cup', confMatch, continentalTourney)
    : superCup ? (superCup.type === 'domestic' ? 'Super Cup' : 'Continental Super Cup')
    : null;
  set({
    halfTimeState: halfState, currentMatchWeather: matchWeather, matchPhase: 'half_time', matchSubsUsed: 0, matchSubbedOffIds: [], preMatchLeaguePosition: preMatchPos,
    // Clear the pre-match talk so the half-time team-talk sheet opens fresh at
    // 'none' — the pre-match talk affected the first half only (G3).
    matchTeamTalk: 'none',
    currentCupTieId: cupTie ? cupTie.id : isCupMatch ? '__tournament__' : null,
    currentLeagueCupTieId: leagueCupTie ? leagueCupTie.id : null,
    currentContinentalMatchId: continentalMatch ? match.id : null,
    currentContinentalCompetition: continentalComp,
    lastMatchCompetition: matchCompetition,
  });
  return halfState;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playFirstHalf' } });
    try {
      get().cleanupAbandonedMatch();
      set({
        currentScreen: 'dashboard',
        messages: addMsg(get().messages, {
          week: get().week, season: get().season, type: 'general',
          title: 'Match Error',
          body: 'An error occurred during the match simulation. The match has been abandoned.',
        }),
      });
    } catch (cleanupErr) {
      Sentry.captureException(cleanupErr, { tags: { context: 'matchCleanup' } });
    }
    return null;
  }
}

export function playSecondHalfImpl(set: Set, get: Get): Match | null {
  const state = get();
  const { week, fixtures, clubs, players, playerClubId, tactics, training, halfTimeState, currentMatchWeather, season } = state;
  if (!halfTimeState) return null;

  try {
  // Find friendly, league match, or cup/tournament match
  const friendlyMatch = state.friendlies?.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
  const leagueMatch = !friendlyMatch ? fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)) : null;
  const isRealCupTie = state.currentCupTieId && state.currentCupTieId !== '__tournament__';
  const cupTie = isRealCupTie ? state.cup.ties.find(t => t.id === state.currentCupTieId) : null;
  const isTournamentMatch = state.currentCupTieId === '__tournament__';

  // Reconstruct tournament match
  let tournamentMatch: Match | null = null;
  if (isTournamentMatch) {
    if (state.currentContinentalMatchId && state.currentContinentalCompetition) {
      const tourney = state.currentContinentalCompetition === 'champions_cup' ? state.championsCup : state.currentContinentalCompetition === 'shield_cup' ? state.shieldCup : state.conferenceCup;
      const matchInfo = tourney ? findPlayerContinentalMatch(tourney, week, playerClubId) : null;
      if (matchInfo && tourney) {
        if (matchInfo.type === 'group') {
          const gm = tourney.groups[matchInfo.groupIdx].matches[matchInfo.matchIdx];
          tournamentMatch = { id: gm.id, week, homeClubId: gm.homeClubId, awayClubId: gm.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
        } else {
          const tie = tourney.knockoutTies[matchInfo.tieIdx];
          const homeId = matchInfo.leg === 1 || tie.round === 'F' ? tie.homeClubId : tie.awayClubId;
          const awayId = matchInfo.leg === 1 || tie.round === 'F' ? tie.awayClubId : tie.homeClubId;
          tournamentMatch = { id: tie.id, week, homeClubId: homeId, awayClubId: awayId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
        }
      }
    } else if (state.currentLeagueCupTieId) {
      const lcTie = state.leagueCup?.ties.find(t => t.id === state.currentLeagueCupTieId);
      if (lcTie) tournamentMatch = { id: lcTie.id, week, homeClubId: lcTie.homeClubId, awayClubId: lcTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
    } else {
      // Super cup
      const sc = state.domesticSuperCup && !state.domesticSuperCup.played && state.domesticSuperCup.week === week
        ? state.domesticSuperCup
        : state.continentalSuperCup && !state.continentalSuperCup.played && state.continentalSuperCup.week === week
          ? state.continentalSuperCup : null;
      if (sc) tournamentMatch = { id: `super-cup-${sc.type}`, week, homeClubId: sc.homeClubId, awayClubId: sc.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
    }
  }

  // Match selection must honour the in-progress match the FIRST half started.
  // `currentCupTieId === '__tournament__'` marks continental/league-cup/super-cup
  // ties; a real cup id marks a Dynasty Cup tie. Either way, those state IDs
  // win — only fall through to friendly/league when no in-progress tournament
  // or cup tie is set. Previously the chain put `leagueMatch` ahead of the
  // tournament one, so a week with both league + continental fixtures would
  // start in continental for the first half, then silently switch to the
  // league match in the second half (with the half-time state of the wrong
  // game still attached).
  const match: Match | null = isTournamentMatch
    ? tournamentMatch
    : cupTie
      ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match
      : (friendlyMatch || leagueMatch || null);

  // Tournament rebuild can return null if the tournament state mutated
  // between halves (rare — typically requires a save-load or dev action
  // mid-match). Falling back to `leagueMatch` would silently switch
  // competitions; better to abandon cleanly so the user sees a clear
  // error instead of being softlocked at half-time with no resume path.
  if (isTournamentMatch && !match) {
    Sentry.captureMessage('[playSecondHalf] Tournament match rebuild returned null — aborting', 'error');
    get().cleanupAbandonedMatch();
    return null;
  }
  if (!match) return null;

  const hc = clubs[match.homeClubId];
  const ac = clubs[match.awayClubId];
  if (!hc || !ac) return null;
  // Use current lineup (may have been changed by subs/rearrangement at half-time)
  // Deduplicate lineup IDs to prevent bugs from position optimization
  const hLineup = [...new Set(hc.lineup || [])];
  const aLineup = [...new Set(ac.lineup || [])];
  const hp = hLineup.map(id => players[id]).filter(Boolean);
  const ap = aLineup.map(id => players[id]).filter(Boolean);
  // Need minimum players to continue the match
  if (hp.length < 7 || ap.length < 7) return null;

  const isPlayerHome = match.homeClubId === playerClubId;
  const oppClub2H = isPlayerHome ? ac : hc;
  const oppProfile2H = oppClub2H.aiManagerProfile;
  const ctrRed2H = hasPerk(state.managerProgression, 'counter_master') ? 0.25 : 0;
  const aiCtr2H = oppProfile2H ? getAICounterTactics(oppProfile2H, tactics, clubs[playerClubId]?.formation || '4-4-2', ctrRed2H) : undefined;
  const homeTactics = isPlayerHome ? tactics : aiCtr2H;
  const awayTactics = isPlayerHome ? aiCtr2H : tactics;

  // Simulate second half, carrying forward first half state (bench is carried in halfTimeState)
  const secondHalfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
  const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
  const secondHalfCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;

  // Compute team talk modifiers based on the manager's half-time team talk
  const teamTalkMods = (() => {
    const talk = state.matchTeamTalk;
    if (talk === 'none') return undefined;
    if (talk === 'motivate') return { attackMod: MOTIVATE_ATTACK_BOOST, defenseMod: 0, foulMod: MOTIVATE_FOUL_BONUS, fitnessDrainMult: MOTIVATE_FITNESS_DRAIN_MULT };
    if (talk === 'calm') return { attackMod: 0, defenseMod: CALM_DEFENSE_BOOST, foulMod: -CALM_FOUL_REDUCTION, fitnessDrainMult: CALM_FITNESS_DRAIN_MULT };
    // demand: high risk/reward
    return { attackMod: DEMAND_ATTACK_BOOST, defenseMod: -DEMAND_DEFENSE_PENALTY, foulMod: 0, fitnessDrainMult: DEMAND_FITNESS_DRAIN_MULT };
  })();

  // Aggregate first-half shout effects as second-half modifiers
  const shoutMods = computeShoutMods(state.matchShouts);

  // Merge team talk + shout modifiers
  const combinedMods = teamTalkMods
    ? { attackMod: teamTalkMods.attackMod + shoutMods.attackMod, defenseMod: teamTalkMods.defenseMod + shoutMods.defenseMod, foulMod: teamTalkMods.foulMod + shoutMods.foulMod, fitnessDrainMult: teamTalkMods.fitnessDrainMult }
    : (shoutMods.attackMod || shoutMods.defenseMod || shoutMods.foulMod) ? { ...shoutMods, fitnessDrainMult: 1 as number } : undefined;

  const spCoachBonus2H = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * branchMult(state.managerProgression, 'tactician') : 0;
  const fullState = simulateHalf(hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, secondHalfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, secondHalfCareerMod, undefined, undefined, combinedMods, currentMatchWeather ?? undefined, spCoachBonus2H);
  // `players` lookup lets finalizeMatch rate half-time-subbed-out starters
  // (they're missing from hp/ap — the lineup was edited at the break)
  const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, fullState, players);
  // Attach weather to the match result
  if (currentMatchWeather) result.weather = currentMatchWeather;

  // Cup match ended in draw — need extra time (unless aggregate is already decided for 2-leg ties)
  // Continental group matches and knockout leg 1 are LEGITIMATE draws — the
  // instant-sim path has always exempted them (see the isCupMatch block in
  // playCurrentMatchImpl); without the same exemption here, an interactive
  // group draw went to extra time (corrupting standings/aggregates) and a
  // group shootout landed in a knockout-only handler, stranding the match.
  if (state.currentCupTieId && result.homeGoals === result.awayGoals && !isContinentalDrawValid(state) && !isAggregateDecided(state, result.homeGoals, result.awayGoals)) {
    set({
      currentMatchResult: result,
      halfTimeState: fullState, // carry forward for extra time continuation
      matchPhase: 'extra_time',
      matchSubsUsed: 0,
      matchPlayerRatings: playerRatings,
    });
    return result;
  }

  // Friendly match — no league table / fixtures update, no rank change
  if (friendlyMatch) {
    const processed = processMatchResult(state, match, result, playerRatings, () => get().week, fullState.matchInjuries);
    const confDelta = (processed.confidence - (state.boardConfidence || 50)) * FRIENDLY_BOARD_CONFIDENCE_MULT;
    const friendlyConfidence = Math.max(0, Math.min(100, (state.boardConfidence || 50) + confDelta));
    const drama = detectMatchDrama(result, playerClubId, clubs);

    set({
      friendlies: state.friendlies.map(f => f.id === match.id ? result : f),
      currentMatchResult: result,
      players: processed.newPlayers,
      boardConfidence: friendlyConfidence,
      messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      halfTimeState: null, matchPhase: 'full_time',
      lastMatchCompetition: 'Pre-Season Friendly',
      pendingPressConference: null,
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
      managerProgression: processed.managerProgression,
      lastMatchXPGain: Math.round((processed.xpGain || 0) * 0.5),
      lastMatchDrama: drama,
      pairFamiliarity: processed.pairFamiliarity,
    });
    // Persist the played match immediately — autosave otherwise only fires
    // on advanceWeek, so a crash/app-kill after an interactively played
    // match silently discarded the result (the instant-sim paths above
    // already do this).
    if (get().settings.autoSave) get().saveGame();
    return result;
  }

  // Cup/tournament match decided in 90 mins — process result
  if (state.currentCupTieId) {
    const processed = processMatchResult(state, match, result, playerRatings, () => get().week, fullState.matchInjuries);
    const cupDrama = detectMatchDrama(result, playerClubId, clubs);
    const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
    const tournamentUpdates = processTournamentResult(state, result, playerClubId, processed, season, week);

    set({
      currentMatchResult: result, players: tournamentUpdates.cleanedPlayers || processed.newPlayers,
      boardConfidence: processed.confidence, messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      halfTimeState: null, matchPhase: 'full_time', currentCupTieId: null,
      currentLeagueCupTieId: null, currentContinentalMatchId: null, currentContinentalCompetition: null,
      pendingPressConference: generatePostMatchPress(pressContext, isPro(get().monetization), { margin: Math.abs(result.homeGoals - result.awayGoals), hasDrama: !!cupDrama, isCup: true }),
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
      managerProgression: processed.managerProgression,
      lastMatchXPGain: processed.xpGain,
      lastMatchDrama: cupDrama,
      rivalries: processed.updatedRivalries,
      pairFamiliarity: processed.pairFamiliarity,
      ...tournamentUpdates.stateUpdates,
    });
    // Persist the played match immediately — autosave otherwise only fires
    // on advanceWeek, so a crash/app-kill after an interactively played
    // match silently discarded the result (the instant-sim paths above
    // already do this).
    if (get().settings.autoSave) get().saveGame();
    return result;
  }

  // League match — process as normal
  const processed = processMatchResult(state, match, result, playerRatings, () => get().week, fullState.matchInjuries);

  // Simulate AI matches for the same week so league table position is accurate in PostMatchPopup
  const aiWeekMatches2 = processed.updatedFixtures.filter(
    m => m.week === week && !m.played && m.homeClubId !== playerClubId && m.awayClubId !== playerClubId
  );
  const fullFixtures2 = [...processed.updatedFixtures];
  const playersWithAI2 = { ...processed.newPlayers };
  const eloRankings2 = { ...(state.clubPowerRankings || {}) };
  updateEloRatings(eloRankings2, match.homeClubId, match.awayClubId, result.homeGoals, result.awayGoals, 'league');
  for (const m of aiWeekMatches2) {
    const idx = fullFixtures2.findIndex(f => f.id === m.id);
    const hc2 = clubs[m.homeClubId];
    const ac2 = clubs[m.awayClubId];
    if (!hc2 || !ac2) continue;
    const hAvail3 = hc2.playerIds.map(id => playersWithAI2[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
    const aAvail3 = ac2.playerIds.map(id => playersWithAI2[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
    const hp2 = hAvail3.slice(0, LINEUP_SIZE);
    const ap2 = aAvail3.slice(0, LINEUP_SIZE);
    if (hp2.length === 0 || ap2.length === 0) {
      fullFixtures2[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap2.length === 0 ? 0 : FORFEIT_SCORE, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
      continue;
    }
    const { result: aiResult } = simulateMatch(m, hc2, ac2, hp2, ap2, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season, undefined, hAvail3.slice(11, 18), aAvail3.slice(11, 18));
    fullFixtures2[idx] = aiResult;
    applyAIMatchEvents(aiResult.events, playersWithAI2, clubs, week, hp2, ap2, aiResult.homeGoals, aiResult.awayGoals, eloRankings2, m.homeClubId, m.awayClubId);
    updateEloRatings(eloRankings2, m.homeClubId, m.awayClubId, aiResult.homeGoals, aiResult.awayGoals, 'league');
  }
  const divClubIds2 = state.divisionClubs[state.playerDivision] || Object.keys(clubs);
  const fullLeagueTable2 = buildLeagueTable(fullFixtures2, divClubIds2);

  const leagueDrama = detectMatchDrama(result, playerClubId, clubs);

  // Generate post-match press conference (only when the match was notable)
  const pressContext2 = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
  const press2 = generatePostMatchPress(pressContext2, isPro(get().monetization), {
    margin: Math.abs(result.homeGoals - result.awayGoals),
    isDerby: getDerbyIntensity(match.homeClubId, match.awayClubId) > 0,
    hasDrama: !!leagueDrama,
  });

  const syncedDivFixtures2 = { ...state.divisionFixtures, [state.playerDivision]: fullFixtures2 };
  set({
    fixtures: fullFixtures2, players: playersWithAI2, leagueTable: fullLeagueTable2,
    currentMatchResult: result, boardConfidence: processed.confidence, messages: processed.newMessages,
    matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
    halfTimeState: null, matchPhase: 'full_time',
    pendingPressConference: press2,
    divisionFixtures: syncedDivFixtures2,
    divisionTables: { ...state.divisionTables, [state.playerDivision]: fullLeagueTable2 },
    careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
    managerProgression: processed.managerProgression,
    lastMatchCompetition: null,
    lastMatchXPGain: processed.xpGain,
    lastMatchDrama: leagueDrama,
    rivalries: processed.updatedRivalries,
    pairFamiliarity: processed.pairFamiliarity,
    clubPowerRankings: eloRankings2,
  });
  // Persist the played match immediately — autosave otherwise only fires
  // on advanceWeek, so a crash/app-kill after an interactively played
  // match silently discarded the result (the instant-sim paths above
  // already do this).
  if (get().settings.autoSave) get().saveGame();
  return result;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playSecondHalf' } });
    try {
      get().cleanupAbandonedMatch();
      // Same as playCurrentMatch — navigate away from MatchDay so the
      // crash doesn't render-loop on a stale halfTimeState ref.
      set({
        currentScreen: 'dashboard',
        messages: addMsg(get().messages, {
          week: get().week, season: get().season, type: 'general',
          title: 'Match Error',
          body: 'An error occurred during the second half. The match has been abandoned.',
        }),
      });
    } catch (cleanupErr) {
      Sentry.captureException(cleanupErr, { tags: { context: 'secondHalfCleanup' } });
    }
    return null;
  }
}

export function playExtraTimeImpl(set: Set, get: Get): Match | null {
  const state = get();
  const { clubs, players, playerClubId, tactics, training, currentMatchResult, halfTimeState, currentCupTieId, season } = state;
  if (!currentMatchResult || !halfTimeState || !currentCupTieId) return null;

  const hc = clubs[currentMatchResult.homeClubId];
  const ac = clubs[currentMatchResult.awayClubId];
  if (!hc || !ac) return null;
  const hp = (hc.lineup || []).map(id => players[id]).filter(Boolean);
  const ap = (ac.lineup || []).map(id => players[id]).filter(Boolean);
  // Need minimum players to continue into extra time
  if (hp.length < 7 || ap.length < 7) return null;

  try {
  const isPlayerHome = currentMatchResult.homeClubId === playerClubId;
  const oppClubET = isPlayerHome ? ac : hc;
  const oppProfileET = oppClubET.aiManagerProfile;
  const ctrRedET = hasPerk(state.managerProgression, 'counter_master') ? 0.25 : 0;
  const aiCtrET = oppProfileET ? getAICounterTactics(oppProfileET, tactics, clubs[playerClubId]?.formation || '4-4-2', ctrRedET) : undefined;
  const homeTactics = isPlayerHome ? tactics : aiCtrET;
  const awayTactics = isPlayerHome ? aiCtrET : tactics;
  const derbyInt = getDerbyIntensity(currentMatchResult.homeClubId, currentMatchResult.awayClubId);
  const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');

  // Simulate extra time as one 30-minute block (91-120) — bench is carried in halfTimeState
  const etCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
  // Carry team talk + shout effects into extra time (team talk persists from half-time)
  const etTeamTalkMods = (() => {
    const talk = state.matchTeamTalk;
    if (talk === 'none') return undefined;
    if (talk === 'motivate') return { attackMod: MOTIVATE_ATTACK_BOOST, defenseMod: 0, foulMod: MOTIVATE_FOUL_BONUS, fitnessDrainMult: MOTIVATE_FITNESS_DRAIN_MULT };
    if (talk === 'calm') return { attackMod: 0, defenseMod: CALM_DEFENSE_BOOST, foulMod: -CALM_FOUL_REDUCTION, fitnessDrainMult: CALM_FITNESS_DRAIN_MULT };
    return { attackMod: DEMAND_ATTACK_BOOST, defenseMod: -DEMAND_DEFENSE_PENALTY, foulMod: 0, fitnessDrainMult: DEMAND_FITNESS_DRAIN_MULT };
  })();
  const etShoutMods = computeShoutMods(state.matchShouts);
  const etMods = etTeamTalkMods
    ? { attackMod: etTeamTalkMods.attackMod + etShoutMods.attackMod, defenseMod: etTeamTalkMods.defenseMod + etShoutMods.defenseMod, foulMod: etTeamTalkMods.foulMod + etShoutMods.foulMod, fitnessDrainMult: etTeamTalkMods.fitnessDrainMult }
    : (etShoutMods.attackMod || etShoutMods.defenseMod || etShoutMods.foulMod) ? { ...etShoutMods, fitnessDrainMult: 1 as number } : undefined;
  const spCoachBonusET = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * branchMult(state.managerProgression, 'tactician') : 0;
  const etWeather = state.currentMatchWeather;
  const etState = simulateHalf(hc, ac, hp, ap, 91, 120, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, derbyInt, hasDisciplinarian, hc.facilities, ac.facilities, season, etCareerMod, undefined, undefined, etMods, etWeather ?? undefined, spCoachBonusET);

  // Build the extended match result
  const etResult: Match = {
    ...currentMatchResult,
    homeGoals: etState.homeGoals,
    awayGoals: etState.awayGoals,
    events: etState.events,
  };

  if (etState.homeGoals !== etState.awayGoals || isAggregateDecided(state, etState.homeGoals, etState.awayGoals)) {
    // Extra time decided the match (or aggregate decided for 2-leg ties) — finalize
    // (players lookup rates participants subbed out before ET — see playSecondHalfImpl)
    const { result, playerRatings } = finalizeMatch(etResult, hc, ac, hp, ap, etState, players);
    if (etWeather) result.weather = etWeather;
    const processed = processMatchResult(state, etResult, result, playerRatings, () => get().week, etState.matchInjuries);
    const etDrama = detectMatchDrama(result, playerClubId, clubs);
    const press = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';

    const isTournament = currentCupTieId === '__tournament__';
    if (isTournament) {
      // Tournament match (League Cup, Continental, Super Cup)
      const tournamentUpdates = processTournamentResult(state, result, playerClubId, processed, season, state.week);
      set({
        currentMatchResult: result, players: tournamentUpdates.cleanedPlayers || processed.newPlayers,
        boardConfidence: processed.confidence, messages: processed.newMessages,
        matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
        halfTimeState: null, matchPhase: 'full_time', currentCupTieId: null,
        currentLeagueCupTieId: null, currentContinentalMatchId: null, currentContinentalCompetition: null,
        pendingPressConference: generatePostMatchPress(press, isPro(get().monetization), { margin: Math.abs(result.homeGoals - result.awayGoals), hasDrama: !!etDrama, isCup: true }),
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
        managerProgression: processed.managerProgression,
        lastMatchXPGain: processed.xpGain,
        lastMatchDrama: etDrama,
        rivalries: processed.updatedRivalries,
        pairFamiliarity: processed.pairFamiliarity,
        ...tournamentUpdates.stateUpdates,
      });
      // Persist the played match immediately — autosave otherwise only fires
      // on advanceWeek, so a crash/app-kill after an interactively played
      // match silently discarded the result (the instant-sim paths above
      // already do this).
      if (get().settings.autoSave) get().saveGame();
    } else {
      // Domestic Dynasty Cup
      const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
        t.id === currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals } : t
      )};
      const playerWon = (currentMatchResult.homeClubId === playerClubId) ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
      if (!playerWon) newCup.eliminated = true;
      // Award round prize money
      if (playerWon) {
        const cupRoundPrize: Record<string, number> = { R1: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r1, R2: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r2, R3: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r3, R4: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r4, QF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_qf, SF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_sf };
        const round = state.cup.currentRound;
        if (round && round !== 'F') {
          const club = clubs[playerClubId];
          if (club) {
            const newBudget = club.budget + (cupRoundPrize[round] || 0);
            set({ clubs: { ...clubs, [playerClubId]: { ...club, budget: newBudget } } });
          }
        }
      }
      const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
      if (allPlayed) {
        if (newCup.currentRound === 'F') {
          const finalTie = newCup.ties.find(t => t.round === 'F' && t.played);
          if (finalTie) {
            const cupWinnerId = finalTie.winnerId || (finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId);
            newCup.winner = cupWinnerId; newCup.currentRound = null;
            const prize = cupWinnerId === playerClubId ? CONTINENTAL_PRIZE_MONEY.dynasty_cup_winner : CONTINENTAL_PRIZE_MONEY.dynasty_cup_runner_up;
            const club = clubs[playerClubId];
            if (club) {
              set({ clubs: { ...clubs, [playerClubId]: { ...club, budget: club.budget + prize } } });
            }
          }
        } else { Object.assign(newCup, advanceCupRound(newCup, state.clubs, state.players, state.totalWeeks)); }
      }
      set({
        currentMatchResult: result, halfTimeState: null, matchPhase: 'full_time',
        matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, currentCupTieId: null,
        cup: newCup, players: processed.newPlayers, messages: processed.newMessages,
        boardConfidence: processed.confidence, managerStats: processed.managerStats,
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
        managerProgression: processed.managerProgression, lastMatchXPGain: processed.xpGain,
        pendingPressConference: generatePostMatchPress(press, isPro(get().monetization), { margin: Math.abs(result.homeGoals - result.awayGoals), hasDrama: !!etDrama, isCup: true }),
        lastMatchDrama: etDrama, rivalries: processed.updatedRivalries, pairFamiliarity: processed.pairFamiliarity,
      });
      // Persist the played match immediately — autosave otherwise only fires
      // on advanceWeek, so a crash/app-kill after an interactively played
      // match silently discarded the result (the instant-sim paths above
      // already do this).
      if (get().settings.autoSave) get().saveGame();
    }
    return result;
  }

  // Still drawn — go to penalties
  set({
    currentMatchResult: etResult,
    halfTimeState: etState,
    matchPhase: 'penalties',
    matchPlayerRatings: [],
  });
  return etResult;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playExtraTime' } });
    try {
      get().cleanupAbandonedMatch();
      set({
        currentScreen: 'dashboard',
        messages: addMsg(get().messages, {
          week: get().week, season: get().season, type: 'general',
          title: 'Match Error',
          body: 'An error occurred during extra time. The match has been abandoned.',
        }),
      });
    } catch (cleanupErr) {
      Sentry.captureException(cleanupErr, { tags: { context: 'matchCleanup' } });
    }
    return null;
  }
}

export function playPenaltiesImpl(set: Set, get: Get): Match | null {
  const state = get();
  const { currentMatchResult, currentCupTieId } = state;
  if (!currentMatchResult || !currentCupTieId) return null;

  try {
  // Interactive shootout: kicks resolve one at a time as the player aims them
  // (takeAimedPenalty) and the opponent replies (revealOpponentPenalty) —
  // finalization still happens in skipPenaltyShootout once decided.
  return beginInteractiveShootoutImpl(set, get);
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playPenalties' } });
    try {
      get().cleanupAbandonedMatch();
      set({
        currentScreen: 'dashboard',
        messages: addMsg(get().messages, {
          week: get().week, season: get().season, type: 'general',
          title: 'Match Error',
          body: 'An error occurred during the penalty shootout. The match has been abandoned.',
        }),
      });
    } catch (cleanupErr) {
      Sentry.captureException(cleanupErr, { tags: { context: 'matchCleanup' } });
    }
    return null;
  }
}

/** Shared interactive-shootout setup (club cups AND World Cup): resolve both
 *  keepers, reset the kick list, and open the tap-to-aim context. */
export function beginInteractiveShootoutImpl(set: Set, get: Get): Match | null {
  const state = get();
  const { clubs, players, playerClubId, currentMatchResult } = state;
  if (!currentMatchResult) return null;
  const hc = clubs[currentMatchResult.homeClubId];
  const ac = clubs[currentMatchResult.awayClubId];
  if (!hc || !ac) return null;

  const findGK = (club: Club): Player | null =>
    (club.lineup || []).map(id => players[id]).filter(Boolean).find(p => p.position === 'GK') ?? null;
  const homeGK = findGK(hc);
  const awayGK = findGK(ac);

  set({
    penaltyShootoutKicks: [],
    penaltyShootoutRevealIndex: 0,
    penaltyShootoutCtx: {
      playerIsHome: currentMatchResult.homeClubId === playerClubId,
      homeGKId: homeGK?.id ?? null,
      awayGKId: awayGK?.id ?? null,
      homeGKQuality: getClubGKQuality(hc, players),
      awayGKQuality: getClubGKQuality(ac, players),
      usedTakerIds: [],
    },
  });
  return currentMatchResult;
}

/** Roll the keeper's mind games for the player's upcoming kick. Owned by the
 *  store so the sim-affecting draw is reproducible and components only render
 *  it. Idempotent per kick: re-rolling while already rolled keeps the value. */
export function rollKeeperTauntImpl(set: Set, get: Get): boolean {
  const state = get();
  const ctx = state.penaltyShootoutCtx;
  if (!ctx) return false;
  if (ctx.tauntActive !== undefined) return ctx.tauntActive;
  const taunt = Math.random() < PEN_AIM.KEEPER_TAUNT_CHANCE;
  set({ penaltyShootoutCtx: { ...ctx, tauntActive: taunt } });
  return taunt;
}

/** Resolve the player's aimed kick. Null when it isn't the player's turn or
 *  the taker id is invalid — callers treat null as "nothing happened". */
export function takeAimedPenaltyImpl(set: Set, get: Get, takerId: string, aimX: number, aimY: number, opts?: { power?: number; rattled?: boolean }): PenaltyKick | null {
  const state = get();
  const { penaltyShootoutCtx: ctx, penaltyShootoutKicks: kicks, players, clubs, currentMatchResult } = state;
  if (!ctx || !currentMatchResult) return null;
  const prog = getShootoutProgress(kicks);
  if (prog.decided || prog.nextIsHome === null || prog.nextIsHome !== ctx.playerIsHome) return null;
  const taker = players[takerId];
  if (!taker) return null;

  const keeperQuality = ctx.playerIsHome ? ctx.awayGKQuality : ctx.homeGKQuality;
  // Keeper mind games: a rattled taker strikes with slightly less composure.
  // The roll lives in ctx (rollKeeperTaunt); opts.rattled remains as an
  // explicit override for tests.
  const rattled = opts?.rattled ?? ctx.tauntActive ?? false;
  const shooterQuality = Math.max(0, getPenaltyTakerQuality(taker) - (rattled ? PEN_AIM.RATTLE_QUALITY_PENALTY : 0));
  const power = opts?.power;
  const res = resolveAimedKick({ aimX, aimY, shooterQuality, keeperQuality, power });
  const kick: PenaltyKick = {
    round: prog.nextRound,
    isHome: ctx.playerIsHome,
    takerName: taker.lastName || taker.firstName,
    takerId,
    scored: res.scored,
    outcome: res.outcome,
    aimX, aimY, diveX: res.diveX, diveY: res.diveY,
    power,
    homeTotal: prog.homeTotal + (ctx.playerIsHome && res.scored ? 1 : 0),
    awayTotal: prog.awayTotal + (!ctx.playerIsHome && res.scored ? 1 : 0),
  };
  const newKicks = [...kicks, kick];
  // Real shootout rules: nobody kicks twice until the whole eligible pool has
  // gone — reset availability once everyone on the pitch has taken one.
  const playerClub = clubs[ctx.playerIsHome ? currentMatchResult.homeClubId : currentMatchResult.awayClubId];
  const eligibleCount = (playerClub?.lineup ?? []).filter(id => players[id]).length;
  const used = [...ctx.usedTakerIds, takerId];
  set({
    penaltyShootoutKicks: newKicks,
    penaltyShootoutRevealIndex: newKicks.length,
    penaltyShootoutCtx: { ...ctx, usedTakerIds: used.length >= eligibleCount ? [] : used, tauntActive: undefined },
  });
  return kick;
}

/** Resolve the opponent's next kick (auto-aimed, best takers first). Null when
 *  it's the player's turn or the shootout is over. */
export function revealOpponentPenaltyImpl(set: Set, get: Get): PenaltyKick | null {
  const state = get();
  const { penaltyShootoutCtx: ctx, penaltyShootoutKicks: kicks, players, clubs, currentMatchResult } = state;
  if (!ctx || !currentMatchResult) return null;
  const prog = getShootoutProgress(kicks);
  if (prog.decided || prog.nextIsHome === null || prog.nextIsHome === ctx.playerIsHome) return null;

  const oppIsHome = !ctx.playerIsHome;
  const oppClub = clubs[oppIsHome ? currentMatchResult.homeClubId : currentMatchResult.awayClubId];
  const oppTakers = (oppClub?.lineup ?? [])
    .map(id => players[id]).filter(Boolean)
    .filter(p => p.position !== 'GK')
    .sort((a, b) => getPenaltyTakerQuality(b) - getPenaltyTakerQuality(a));
  const oppKicksTaken = kicks.filter(k => k.isHome === oppIsHome).length;
  const taker = oppTakers.length ? oppTakers[oppKicksTaken % oppTakers.length] : undefined;

  const shooterQuality = getPenaltyTakerQuality(taker);
  // The keeper facing an opponent kick is the player's own GK.
  const keeperQuality = oppIsHome ? ctx.awayGKQuality : ctx.homeGKQuality;
  const aim = pickAiAim(shooterQuality);
  const power = pickAiPower();
  const res = resolveAimedKick({ ...aim, shooterQuality, keeperQuality, power });
  const kick: PenaltyKick = {
    round: prog.nextRound,
    isHome: oppIsHome,
    takerName: taker ? (taker.lastName || taker.firstName) : (oppClub?.shortName ?? 'OPP'),
    takerId: taker?.id,
    scored: res.scored,
    outcome: res.outcome,
    aimX: aim.aimX, aimY: aim.aimY, diveX: res.diveX, diveY: res.diveY,
    power,
    homeTotal: prog.homeTotal + (oppIsHome && res.scored ? 1 : 0),
    awayTotal: prog.awayTotal + (!oppIsHome && res.scored ? 1 : 0),
  };
  const newKicks = [...kicks, kick];
  set({ penaltyShootoutKicks: newKicks, penaltyShootoutRevealIndex: newKicks.length });
  return kick;
}

/** Auto-complete any remaining kicks (Skip to Result mid-shootout, or a
 *  legacy call with no kicks yet) so finalization always sees a decided
 *  shootout. No-op when the kick list is already decided. */
function ensureShootoutComplete(set: Set, get: Get): void {
  const state = get();
  const { penaltyShootoutKicks: kicks, penaltyShootoutCtx: ctx, currentMatchResult, clubs, players } = state;
  if (!currentMatchResult) return;
  if (kicks.length > 0 && getShootoutProgress(kicks).decided) {
    if (state.penaltyShootoutRevealIndex < kicks.length) set({ penaltyShootoutRevealIndex: kicks.length });
    return;
  }
  const hc = clubs[currentMatchResult.homeClubId];
  const ac = clubs[currentMatchResult.awayClubId];
  if (!hc || !ac) return;
  const completed = completeShootout(kicks, {
    homeName: hc.shortName,
    awayName: ac.shortName,
    homeGKQuality: ctx?.homeGKQuality ?? getClubGKQuality(hc, players),
    awayGKQuality: ctx?.awayGKQuality ?? getClubGKQuality(ac, players),
  });
  set({ penaltyShootoutKicks: completed, penaltyShootoutRevealIndex: completed.length });
}

export function skipPenaltyShootoutImpl(set: Set, get: Get): void {
  // Interactive shootouts arrive here mid-way (Skip to Result) or already
  // decided (Continue after the winning kick) — auto-complete any remaining
  // kicks first so finalization always sees a decided shootout.
  ensureShootoutComplete(set, get);
  const state = get();
  // World Cup mode finalises through its own tournament writeback (no cup tie).
  if (state.gameMode === 'world-cup') { get().finalizeWorldCupPenalties(); return; }
  const { clubs, players, playerClubId, currentMatchResult, halfTimeState, currentCupTieId, penaltyShootoutKicks } = state;
  if (!currentMatchResult || !currentCupTieId || penaltyShootoutKicks.length === 0) return;

  const hc = clubs[currentMatchResult.homeClubId];
  const ac = clubs[currentMatchResult.awayClubId];
  if (!hc || !ac) return;
  const hp = (hc.lineup || []).map(id => players[id]).filter(Boolean);
  const ap = (ac.lineup || []).map(id => players[id]).filter(Boolean);

  // Reconstruct penEvents and final totals from pre-computed kicks
  const penEvents: MatchEvent[] = penaltyShootoutKicks.map((kick) => {
    const isSuddenDeath = kick.round > CUP_PENALTY_KICKS;
    const minute = isSuddenDeath ? 130 : 121 + (kick.round - 1);
    const clubId = kick.isHome ? hc.id : ac.id;
    const teamName = kick.isHome ? hc.shortName : ac.shortName;
    const score = `(${kick.homeTotal}-${kick.awayTotal})`;
    return {
      minute,
      type: 'penalty_shootout' as const,
      clubId,
      description: kick.scored ? `${teamName} SCORE! ${score}` : `${teamName} miss! ${score}`,
    };
  });

  const lastKick = penaltyShootoutKicks[penaltyShootoutKicks.length - 1];
  const penHome = lastKick.homeTotal;
  const penAway = lastKick.awayTotal;
  const winnerId = penHome > penAway ? hc.id : ac.id;
  const penaltyShootout = { home: penHome, away: penAway };

  // Build final result
  const finalResult: Match = {
    ...currentMatchResult,
    events: [...currentMatchResult.events, ...penEvents],
    penaltyShootout,
  };

  // Finalize with extra events — halfTimeState must exist by this point
  if (!halfTimeState) {
    Sentry.captureMessage('[Penalties] halfTimeState missing — aborting finalization', 'error');
    set({
      matchPhase: 'none',
      penaltyShootoutKicks: [],
      penaltyShootoutRevealIndex: 0,
      penaltyShootoutCtx: null,
      currentMatchResult: null,
      currentCupTieId: null,
      currentLeagueCupTieId: null,
      currentContinentalMatchId: null,
      currentContinentalCompetition: null,
      halfTimeState: null,
      currentMatchWeather: null,
      matchSubsUsed: 0,
    });
    return;
  }
  // players lookup rates participants subbed out earlier in the tie — see playSecondHalfImpl
  const { result, playerRatings } = finalizeMatch(finalResult, hc, ac, hp, ap, halfTimeState, players);

  const processed = processMatchResult(state, finalResult, result, playerRatings, () => get().week, halfTimeState?.matchInjuries || {}, winnerId);
  const penDrama = detectMatchDrama(result, playerClubId, clubs);
  const press = winnerId === playerClubId ? 'post_win' : 'post_loss';

  const isTournament = currentCupTieId === '__tournament__';
  if (isTournament) {
    const tournamentUpdates = processTournamentResultWithWinner(state, { ...result, penaltyShootout }, playerClubId, processed, state.season, state.week, winnerId, penaltyShootout);

    set({
      currentMatchResult: { ...result, penaltyShootout },
      players: tournamentUpdates.cleanedPlayers || processed.newPlayers,
      boardConfidence: processed.confidence, messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      halfTimeState: null, matchPhase: 'full_time', currentCupTieId: null,
      currentLeagueCupTieId: null, currentContinentalMatchId: null, currentContinentalCompetition: null,
      pendingPressConference: generatePostMatchPress(press, isPro(get().monetization), { margin: Math.abs(result.homeGoals - result.awayGoals), hasDrama: !!penDrama, isCup: true }),
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
      managerProgression: processed.managerProgression, lastMatchXPGain: processed.xpGain,
      lastMatchDrama: penDrama, rivalries: processed.updatedRivalries, pairFamiliarity: processed.pairFamiliarity,
      penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0, penaltyShootoutCtx: null,
      ...tournamentUpdates.stateUpdates,
    });
    // Persist the played match immediately — autosave otherwise only fires
    // on advanceWeek, so a crash/app-kill after an interactively played
    // match silently discarded the result (the instant-sim paths above
    // already do this).
    if (get().settings.autoSave) get().saveGame();
  } else {
    // Domestic Dynasty Cup
    const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
      t.id === currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, winnerId, penaltyShootout } : t
    )};
    if (winnerId !== playerClubId) newCup.eliminated = true;
    // Award round prize money on pen win
    if (winnerId === playerClubId) {
      const cupRoundPrize: Record<string, number> = { R1: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r1, R2: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r2, R3: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r3, R4: CONTINENTAL_PRIZE_MONEY.dynasty_cup_r4, QF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_qf, SF: CONTINENTAL_PRIZE_MONEY.dynasty_cup_sf };
      const round = state.cup.currentRound;
      if (round && round !== 'F') {
        const club = clubs[playerClubId];
        if (club) set({ clubs: { ...clubs, [playerClubId]: { ...club, budget: club.budget + (cupRoundPrize[round] || 0) } } });
      }
    }
    const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
    if (allPlayed) {
      if (newCup.currentRound === 'F') {
        newCup.winner = winnerId; newCup.currentRound = null;
        const prize = winnerId === playerClubId ? CONTINENTAL_PRIZE_MONEY.dynasty_cup_winner : CONTINENTAL_PRIZE_MONEY.dynasty_cup_runner_up;
        const club = clubs[playerClubId];
        if (club) set({ clubs: { ...clubs, [playerClubId]: { ...club, budget: club.budget + prize } } });
      } else { Object.assign(newCup, advanceCupRound(newCup, state.clubs, state.players, state.totalWeeks)); }
    }
    set({
      currentMatchResult: { ...result, penaltyShootout }, halfTimeState: null, matchPhase: 'full_time',
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, currentCupTieId: null,
      cup: newCup, players: processed.newPlayers, messages: processed.newMessages,
      boardConfidence: processed.confidence, managerStats: processed.managerStats,
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones].slice(-MAX_CAREER_TIMELINE),
      managerProgression: processed.managerProgression, lastMatchXPGain: processed.xpGain,
      pendingPressConference: generatePostMatchPress(press, isPro(get().monetization), { margin: Math.abs(result.homeGoals - result.awayGoals), hasDrama: !!penDrama, isCup: true }),
      lastMatchDrama: penDrama, rivalries: processed.updatedRivalries, pairFamiliarity: processed.pairFamiliarity,
      penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0, penaltyShootoutCtx: null,
    });
    // Persist the played match immediately — autosave otherwise only fires
    // on advanceWeek, so a crash/app-kill after an interactively played
    // match silently discarded the result (the instant-sim paths above
    // already do this).
    if (get().settings.autoSave) get().saveGame();
  }
}

