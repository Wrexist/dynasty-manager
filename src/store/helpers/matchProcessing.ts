import type { Match, PlayerMatchRating, CareerMilestone } from '@/types/game';
import { buildLeagueTable } from '@/data/league';
import { addMsg } from '@/utils/helpers';
import {
  FITNESS_DRAIN_PER_MATCH, FITNESS_MIN_POST_MATCH,
  MORALE_WIN_CHANGE, MORALE_LOSS_CHANGE,
  FORM_WIN_CHANGE, FORM_LOSS_CHANGE, FORM_DRAW_CHANGE,
  MATCH_INJURY_WEEKS_MIN, MATCH_INJURY_WEEKS_RANGE,
  RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE,
  CONFIDENCE_WIN_CHANGE, CONFIDENCE_LOSS_CHANGE, CONFIDENCE_DRAW_CHANGE,
  CONFIDENCE_POSITION_BONUS, CONFIDENCE_POSITION_PENALTY, CONFIDENCE_POSITION_PENALTY_THRESHOLD,
  CONFIDENCE_BUDGET_PENALTY, CONFIDENCE_BUDGET_THRESHOLD,
  CONFIDENCE_WIN_STREAK_BONUS, CONFIDENCE_LOSS_STREAK_PENALTY, CONFIDENCE_STREAK_LENGTH,
  CONFIDENCE_WARNING_THRESHOLD, CONFIDENCE_PLEASED_THRESHOLD, CONFIDENCE_MIN, CONFIDENCE_MAX,
  MORALE_APPEARANCE_BOOST,
  getExpectedPosition,
} from '@/config/gameBalance';
import { createMilestone, checkMatchMilestones } from '@/utils/milestones';
import { grantXP, XP_REWARDS } from '@/utils/managerPerks';
import { getMoraleStability } from '@/utils/personality';
import type { GameState } from '@/store/storeTypes';

/** Shared helper: process match events and build post-match state updates.
 *  Used by both playCurrentMatch() and playSecondHalf() to avoid duplication. */
export function processMatchResult(
  state: GameState,
  match: Match,
  result: Match,
  playerRatings: PlayerMatchRating[],
  getWeek: () => number,
) {
  const { clubs, players, playerClubId, messages, season } = state;
  const week = state.week;
  const newPlayers = { ...players };
  const hc = clubs[match.homeClubId];
  const ac = clubs[match.awayClubId];

  // Process events: goals, assists, injuries, cards
  result.events.forEach(ev => {
    if ((ev.type === 'goal' || ev.type === 'penalty_scored') && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
    }
    if (ev.type === 'goal' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
      newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
    }
    if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: MATCH_INJURY_WEEKS_MIN + Math.floor(Math.random() * MATCH_INJURY_WEEKS_RANGE) };
    }
    if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], yellowCards: newPlayers[ev.playerId].yellowCards + 1 };
    }
    if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: (getWeek() || 1) + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
    }
  });

  // Track appearances and boost morale for playing
  [...hc.lineup, ...ac.lineup].forEach(pid => {
    if (newPlayers[pid]) {
      const p = { ...newPlayers[pid], appearances: newPlayers[pid].appearances + 1 };
      p.morale = Math.min(100, p.morale + MORALE_APPEARANCE_BOOST);
      newPlayers[pid] = p;
    }
  });

  // Player club fitness/morale/form
  const isHome = match.homeClubId === playerClubId;
  const won = isHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
  const lost = isHome ? result.homeGoals < result.awayGoals : result.awayGoals < result.homeGoals;
  const pc = clubs[playerClubId];
  if (!pc) return { newPlayers, updatedFixtures: state.fixtures.map(f => f.id === match.id ? result : f), leagueTable: [], confidence: state.boardConfidence || 50, newMessages: messages, managerStats: state.managerStats, playerRatings, won, lost, newMilestones: [] as CareerMilestone[], managerProgression: state.managerProgression };
  pc.playerIds.forEach(pid => {
    if (newPlayers[pid]) {
      const p = { ...newPlayers[pid] };
      p.fitness = Math.max(FITNESS_MIN_POST_MATCH, p.fitness + FITNESS_DRAIN_PER_MATCH);
      const moraleDelta = won ? MORALE_WIN_CHANGE : lost ? MORALE_LOSS_CHANGE : 0;
      const moraleStability = getMoraleStability(p.personality);
      p.morale = Math.min(100, Math.max(10, p.morale + Math.round(moraleDelta * moraleStability)));
      p.form = Math.min(100, Math.max(10, p.form + (won ? FORM_WIN_CHANGE : lost ? FORM_LOSS_CHANGE : FORM_DRAW_CHANGE)));
      newPlayers[pid] = p;
    }
  });

  // League table & confidence
  const updatedFixtures = state.fixtures.map(f => f.id === match.id ? result : f);
  const divClubIds = state.divisionClubs[state.playerDivision] || Object.keys(clubs);
  const leagueTable = buildLeagueTable(updatedFixtures, divClubIds);
  const playerEntry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = playerEntry ? leagueTable.indexOf(playerEntry) + 1 : 10;
  const expectedPos = getExpectedPosition(clubs[playerClubId].reputation);
  // Incremental confidence: modify existing value based on result, position, budget, streaks
  let confChange = won ? CONFIDENCE_WIN_CHANGE : lost ? CONFIDENCE_LOSS_CHANGE : CONFIDENCE_DRAW_CHANGE;
  confChange += (expectedPos - pos) > 0 ? CONFIDENCE_POSITION_BONUS : (expectedPos - pos) < CONFIDENCE_POSITION_PENALTY_THRESHOLD ? CONFIDENCE_POSITION_PENALTY : 0;
  if (clubs[playerClubId].budget < CONFIDENCE_BUDGET_THRESHOLD) confChange += CONFIDENCE_BUDGET_PENALTY;
  const recentForm = (playerEntry?.form || []).slice(-3);
  if (recentForm.length >= CONFIDENCE_STREAK_LENGTH && recentForm.every(r => r === 'W')) confChange += CONFIDENCE_WIN_STREAK_BONUS;
  if (recentForm.length >= CONFIDENCE_STREAK_LENGTH && recentForm.every(r => r === 'L')) confChange += CONFIDENCE_LOSS_STREAK_PENALTY;
  const confidence = Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, (state.boardConfidence || 50) + confChange));

  // Messages
  const oppId = isHome ? match.awayClubId : match.homeClubId;
  const oppClub = clubs[oppId];
  const resultText = won ? 'Victory!' : lost ? 'Defeat.' : 'Draw.';
  const score = `${result.homeGoals}-${result.awayGoals}`;
  let newMessages = addMsg(messages, {
    week, season, type: 'match_result',
    title: `${resultText} ${clubs[match.homeClubId].shortName} ${score} ${clubs[match.awayClubId].shortName}`,
    body: won ? `A great result against ${oppClub.name}! The fans are delighted.`
      : lost ? `A disappointing result against ${oppClub.name}. The board will want to see improvement.`
      : `A hard-fought draw against ${oppClub.name}. Onwards.`,
  });

  if (confidence < CONFIDENCE_WARNING_THRESHOLD) {
    newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Board Warning', body: 'The board is growing concerned with recent performances. Results must improve soon or your position may be at risk.' });
  } else if (confidence > CONFIDENCE_PLEASED_THRESHOLD && won) {
    newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Board Pleased', body: 'The board commends your excellent work. Keep this up!' });
  }

  result.events.filter(ev => ev.type === 'injury' && ev.playerId).forEach(ev => {
    const p = newPlayers[ev.playerId!];
    if (p && p.clubId === playerClubId) {
      newMessages = addMsg(newMessages, { week, season, type: 'injury', title: `${p.lastName} Injured`, body: `${p.firstName} ${p.lastName} suffered an injury and will be out for ${p.injuryWeeks} week(s).` });
    }
  });

  // Manager stats
  const ms = { ...state.managerStats };
  if (won) ms.totalWins++;
  else if (lost) ms.totalLosses++;
  else ms.totalDraws++;

  // Career milestones
  const newMilestones: CareerMilestone[] = [];
  const totalMatches = ms.totalWins + ms.totalDraws + ms.totalLosses;
  if (won && ms.totalWins === 1) {
    newMilestones.push(createMilestone('first_win', 'First Victory', `Won ${result.homeGoals}-${result.awayGoals} against ${clubs[isHome ? match.awayClubId : match.homeClubId].name}.`, season, week, 'trophy'));
  }
  const matchMilestone = checkMatchMilestones(totalMatches, state.careerTimeline, season, week);
  if (matchMilestone) newMilestones.push(matchMilestone);
  // Biggest win milestone (5+ goal margin)
  const margin = won ? Math.abs(result.homeGoals - result.awayGoals) : 0;
  if (margin >= 5) {
    newMilestones.push(createMilestone('biggest_win', 'Thrashing!', `${result.homeGoals}-${result.awayGoals} against ${clubs[isHome ? match.awayClubId : match.homeClubId].name}.`, season, week, 'circle'));
  }

  // XP for match result
  const xpGain = won ? XP_REWARDS.win : !lost ? XP_REWARDS.draw : 0;
  const updatedProgression = xpGain > 0 ? grantXP(state.managerProgression, xpGain) : state.managerProgression;

  return { newPlayers, updatedFixtures, leagueTable, confidence, newMessages, managerStats: ms, playerRatings, won, lost, newMilestones, managerProgression: updatedProgression, xpGain, leaguePosition: pos };
}
