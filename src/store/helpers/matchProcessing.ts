import type { Match, PlayerMatchRating, CareerMilestone, InjuryDetails, PlayerMatchRecord } from '@/types/game';
import { buildLeagueTable } from '@/data/league';
import { addMsg } from '@/utils/helpers';
import { awardFestivalMatchWin } from '@/utils/liveEvents';
import { signalFirstWinForNotifications } from '@/utils/notifications';
import { GOAL_EVENT_TYPES } from '@/config/matchEngine';
import { getPlayerNarratives, getNarrativeBonus } from '@/utils/playerNarratives';
import {
  FITNESS_DRAIN_PER_MATCH, FITNESS_MIN_POST_MATCH,
  MORALE_WIN_CHANGE, MORALE_LOSS_CHANGE, NARRATIVE_MORALE_LOSS_REDUCTION_CAP,
  FORM_WIN_CHANGE, FORM_LOSS_CHANGE, FORM_DRAW_CHANGE,
  MATCH_INJURY_WEEKS_MIN, MATCH_INJURY_WEEKS_RANGE,
  RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE,
  CONFIDENCE_WIN_CHANGE, CONFIDENCE_LOSS_CHANGE, CONFIDENCE_DRAW_CHANGE,
  CONFIDENCE_POSITION_BONUS, CONFIDENCE_POSITION_PENALTY, CONFIDENCE_POSITION_PENALTY_THRESHOLD,
  CONFIDENCE_BUDGET_PENALTY, CONFIDENCE_BUDGET_THRESHOLD,
  CONFIDENCE_WIN_STREAK_BONUS, CONFIDENCE_LOSS_STREAK_PENALTY, CONFIDENCE_STREAK_LENGTH,
  CONFIDENCE_WARNING_THRESHOLD, CONFIDENCE_PLEASED_THRESHOLD, CONFIDENCE_MIN, CONFIDENCE_MAX,
  MORALE_APPEARANCE_BOOST, INJURY_TYPES,
  getExpectedPosition,
  MAX_PLAYER_MATCH_HISTORY,
  RATING_MORALE_BASELINE, MORALE_PER_RATING_POINT, MORALE_RATING_ADJ_CAP,
  FORM_PER_RATING_POINT, FORM_RATING_ADJ_CAP,
  MATCH_FITNESS_CARRY_ENABLED, MATCH_FITNESS_CARRY_SCALE,
} from '@/config/gameBalance';
import {
  computeMinutesPlayed,
  extractFinalMatchFitness,
  getYellowAccumulationBanWeek,
} from '@/store/slices/orchestration/helpers';
import { DEMAND_MORALE_WIN_BONUS, DEMAND_MORALE_LOSS_PENALTY, MOTIVATE_FATIGUE_MULTIPLIER, CALM_FATIGUE_MULTIPLIER, DEMAND_FATIGUE_MULTIPLIER } from '@/config/teamTalk';
import { createMilestone, checkMatchMilestones } from '@/utils/milestones';
import { grantXP, XP_REWARDS, hasPerk } from '@/utils/managerPerks';
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
  matchInjuries?: Record<string, InjuryDetails>,
  /** Winner of a penalty shootout the player's club was part of. Cup results
   *  keep their REAL drawn scoreline (no phantom +1 goal), so won/lost —
   *  morale, board confidence, manager W/D/L, press context — must be
   *  classified from the shootout outcome instead of the goals. */
  shootoutWinnerId?: string | null,
) {
  const { clubs, players, playerClubId, messages, season } = state;
  const week = state.week;
  const newPlayers = { ...players };
  const hc = clubs[match.homeClubId];
  const ac = clubs[match.awayClubId];

  // Guard against ephemeral/virtual clubs being cleaned up before processing
  // (continental, super-cup, friendly opponents). Returning a safe shape lets
  // the caller persist the fixture result without crashing.
  if (!hc || !ac) {
    return {
      newPlayers,
      updatedFixtures: state.fixtures.map(f => f.id === match.id ? result : f),
      leagueTable: [],
      confidence: state.boardConfidence || 50,
      newMessages: messages,
      managerStats: state.managerStats,
      playerRatings,
      won: false,
      lost: false,
      newMilestones: [] as CareerMilestone[],
      managerProgression: state.managerProgression,
      pairFamiliarity: state.pairFamiliarity || {},
    };
  }

  // Process events: goals, assists, injuries, cards
  result.events.forEach(ev => {
    const isGoalEv = (GOAL_EVENT_TYPES as readonly string[]).includes(ev.type);
    if (isGoalEv && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
    }
    if (isGoalEv && ev.type !== 'penalty_scored' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
      newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
    }
    if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
      const details = matchInjuries?.[ev.playerId];
      const weeks = details ? details.weeksRemaining : (MATCH_INJURY_WEEKS_MIN + Math.floor(Math.random() * MATCH_INJURY_WEEKS_RANGE));
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: weeks, injuryDetails: details };
    }
    if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
      const prevYellows = newPlayers[ev.playerId].yellowCards;
      const nextYellows = prevYellows + 1;
      // Yellow-card accumulation ban (5/10/15 by default) — yellows used to be
      // counted and then ignored entirely.
      const banUntil = getYellowAccumulationBanWeek(prevYellows, nextYellows, getWeek() || 1);
      newPlayers[ev.playerId] = {
        ...newPlayers[ev.playerId],
        yellowCards: nextYellows,
        // Never shorten a suspension already in force (e.g. a red in the same match).
        ...(banUntil != null
          ? { suspendedUntilWeek: Math.max(newPlayers[ev.playerId].suspendedUntilWeek ?? 0, banUntil) }
          : {}),
      };
    }
    if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: (getWeek() || 1) + 1 + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
    }
  });

  // Players who took part = current lineup + anyone subbed off during the match.
  // makeMatchSub moves the out-player from lineup → subs, so iterating lineup alone
  // would deny a subbed-off starter their appearance, morale boost and fitness drain.
  // Subbed-off players are recoverable from the 'substitution' events (assistPlayerId = out).
  const subbedOffIds = result.events
    .filter(ev => ev.type === 'substitution' && ev.assistPlayerId)
    .map(ev => ev.assistPlayerId as string);
  // The engine's own definition of "took part" is "has a rating" — it rates the
  // starting XIs, everyone subbed on, and (via `playersById`) starters subbed off
  // at half-time, who appear in neither the second-half lineup nor `subbedIn`.
  // Unioning the rated ids in closes a gap where such a player was rated 7.6,
  // got a match-history record, and was still denied his appearance, morale
  // boost, minutes and fitness drain.
  const participantIds = [...new Set([
    ...hc.lineup, ...ac.lineup, ...subbedOffIds,
    ...playerRatings.map(r => r.playerId),
  ])].filter(pid => !!newPlayers[pid]);

  // Per-player minutes and end-of-match fitness, both recovered from the event
  // stream the engine already produced. Before this, `minutesPlayed` did not
  // exist anywhere in the codebase and every participant took the same flat
  // fitness drain, so an 87th-minute cameo cost exactly what a 90-minute shift
  // at high pressing cost — rotation was not a real decision.
  const minutesByPlayer = computeMinutesPlayed(result.events, participantIds);
  const endFitness = extractFinalMatchFitness(result.events);

  // Track appearances, minutes, and boost morale for playing
  participantIds.forEach(pid => {
    if (newPlayers[pid]) {
      const p = {
        ...newPlayers[pid],
        appearances: newPlayers[pid].appearances + 1,
        minutesPlayed: (newPlayers[pid].minutesPlayed || 0) + (minutesByPlayer[pid] ?? 0),
      };
      p.morale = Math.min(100, p.morale + MORALE_APPEARANCE_BOOST);
      newPlayers[pid] = p;
    }
  });

  // Increment pair familiarity for player's club lineup pairs
  const newPairFamiliarity = { ...(state.pairFamiliarity || {}) };
  const pcLineupIds = clubs[playerClubId]?.lineup.filter(id => newPlayers[id]) || [];
  for (let i = 0; i < pcLineupIds.length; i++) {
    for (let j = i + 1; j < pcLineupIds.length; j++) {
      const fKey = pcLineupIds[i] < pcLineupIds[j]
        ? `${pcLineupIds[i]}-${pcLineupIds[j]}`
        : `${pcLineupIds[j]}-${pcLineupIds[i]}`;
      newPairFamiliarity[fKey] = (newPairFamiliarity[fKey] || 0) + 1;
    }
  }

  // Player club fitness/morale/form
  const isHome = match.homeClubId === playerClubId;
  const drawnOnGoals = result.homeGoals === result.awayGoals;
  const won = shootoutWinnerId && drawnOnGoals
    ? shootoutWinnerId === playerClubId
    : (isHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals);
  const lost = shootoutWinnerId && drawnOnGoals
    ? shootoutWinnerId !== playerClubId
    : (isHome ? result.homeGoals < result.awayGoals : result.awayGoals < result.homeGoals);
  const pc = clubs[playerClubId];
  if (!pc) return { newPlayers, updatedFixtures: state.fixtures.map(f => f.id === match.id ? result : f), leagueTable: [], confidence: state.boardConfidence || 50, newMessages: messages, managerStats: state.managerStats, playerRatings, won, lost, newMilestones: [] as CareerMilestone[], managerProgression: state.managerProgression, pairFamiliarity: newPairFamiliarity };
  const matchParticipants = new Set(participantIds);
  // Compute aggregate narrative bonuses from lineup players (Veteran Leaders reduce morale loss, etc.)
  let narrativeMoraleLossReduction = 0;
  let narrativeTeamMoraleBoost = 0;
  pc.lineup.forEach(lid => {
    const lp = newPlayers[lid];
    if (!lp) return;
    const tags = getPlayerNarratives(lp, state.season, lp.joinedSeason, lp.isFromYouthAcademy);
    const bonus = getNarrativeBonus(tags.map(t => t.tag));
    narrativeMoraleLossReduction += bonus.moraleLossReduction;
    narrativeTeamMoraleBoost += bonus.teamMoraleBoost;
  });
  // Cap the loss-side reduction — mirrors the +5 cap on the win-side boost
  // below; otherwise enough tagged veterans invert the defeat penalty.
  narrativeMoraleLossReduction = Math.min(NARRATIVE_MORALE_LOSS_REDUCTION_CAP, narrativeMoraleLossReduction);

  // Per-player ratings, keyed for the morale/form and no-longer-flat fitness work
  const ratingByPlayer: Record<string, number> = {};
  for (const r of playerRatings) ratingByPlayer[r.playerId] = r.rating;

  pc.playerIds.forEach(pid => {
    if (newPlayers[pid]) {
      const p = { ...newPlayers[pid] };
      // Only drain fitness from players who actually played
      if (matchParticipants.has(pid)) {
        // Preferred path: carry through the fitness the engine actually tracked
        // minute by minute (pressing, tempo and team-talk drains are already
        // folded in there, so there is no double-count with the flat drain).
        const carried = endFitness[pid];
        if (MATCH_FITNESS_CARRY_ENABLED && carried != null) {
          const measuredDrain = (carried - p.fitness) * MATCH_FITNESS_CARRY_SCALE;
          p.fitness = Math.max(FITNESS_MIN_POST_MATCH, Math.round(p.fitness + Math.min(0, measuredDrain)));
        } else {
          // Fallback for participants the engine reported no fitness for
          // (forfeits, quick paths, pre-v75 mid-match saves).
          const fatigueMult = state.matchTeamTalk === 'motivate'
            ? MOTIVATE_FATIGUE_MULTIPLIER
            : state.matchTeamTalk === 'demand'
            ? DEMAND_FATIGUE_MULTIPLIER
            : state.matchTeamTalk === 'calm'
            ? CALM_FATIGUE_MULTIPLIER
            : 1;
          const fitnessDrain = FITNESS_DRAIN_PER_MATCH * fatigueMult;
          p.fitness = Math.max(FITNESS_MIN_POST_MATCH, p.fitness + fitnessDrain);
        }
      }
      let moraleDelta = won ? MORALE_WIN_CHANGE : lost ? MORALE_LOSS_CHANGE + narrativeMoraleLossReduction : 0;
      // Add team morale boost from narrative-tagged players (capped at +5)
      if (won) moraleDelta += Math.min(5, narrativeTeamMoraleBoost);
      // Individual performance layered ON TOP of the team result. Capped below
      // |MORALE_LOSS_CHANGE| so a man-of-the-match in a defeat still loses
      // morale — just far less than the man who was sent off.
      const rating = ratingByPlayer[pid];
      if (rating != null) {
        moraleDelta += Math.max(-MORALE_RATING_ADJ_CAP, Math.min(MORALE_RATING_ADJ_CAP,
          (rating - RATING_MORALE_BASELINE) * MORALE_PER_RATING_POINT));
      }
      // Iron Will perk: no morale penalty from defeats. Clamped rather than
      // zeroed so a good individual game still earns its boost.
      if (lost && hasPerk(state.managerProgression, 'iron_will')) moraleDelta = Math.max(0, moraleDelta);
      // Fortress Mentality perk: home wins give extra morale
      if (won && isHome && hasPerk(state.managerProgression, 'fortress_mentality')) moraleDelta += 3;
      // Team talk morale effects: "demand" is high risk/reward
      if (state.matchTeamTalk === 'demand') {
        moraleDelta += won ? DEMAND_MORALE_WIN_BONUS : lost ? -DEMAND_MORALE_LOSS_PENALTY : 0;
      }
      // Career mode: motivation stat amplifies morale swings
      const motivationMod = (state.gameMode === 'career' && state.careerManager)
        ? 1 + state.careerManager.attributes.motivation * 0.025
        : 1;
      const moraleStability = getMoraleStability(p.personality);
      p.morale = Math.min(100, Math.max(10, p.morale + Math.round(moraleDelta * moraleStability * motivationMod)));
      let formDelta = won ? FORM_WIN_CHANGE : lost ? FORM_LOSS_CHANGE : FORM_DRAW_CHANGE;
      if (rating != null) {
        formDelta += Math.max(-FORM_RATING_ADJ_CAP, Math.min(FORM_RATING_ADJ_CAP,
          (rating - RATING_MORALE_BASELINE) * FORM_PER_RATING_POINT));
      }
      p.form = Math.min(100, Math.max(10, p.form + Math.round(formDelta)));
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
  const oppName = oppClub?.name || 'the opponent';
  const resultText = won ? 'Victory!' : lost ? 'Defeat.' : 'Draw.';
  const score = `${result.homeGoals}-${result.awayGoals}`;
  let newMessages = addMsg(messages, {
    week, season, type: 'match_result',
    title: `${resultText} ${hc.shortName} ${score} ${ac.shortName}`,
    body: won ? `A great result against ${oppName}! The fans are delighted.`
      : lost ? `A disappointing result against ${oppName}. The board will want to see improvement.`
      : `A hard-fought draw against ${oppName}. Onwards.`,
  });

  // Board reaction messages fire only when confidence CROSSES a threshold,
  // not on every match spent parked below/above it — a struggling club used
  // to get an identical "Board Warning" after every single match.
  const prevConfidence = state.boardConfidence || 50;
  if (season === 1 && lost && week <= 10) {
    // First-season encouragement: soften the first early loss, once.
    if (!messages.some(m => m.title === 'The Board Believes in You')) {
      newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'The Board Believes in You', body: 'It\'s early days. The board sees your potential and is giving you time to build. Keep pushing — better results will come.' });
    }
  } else if (confidence < CONFIDENCE_WARNING_THRESHOLD && prevConfidence >= CONFIDENCE_WARNING_THRESHOLD) {
    newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Board Warning', body: 'The board is growing concerned with recent performances. Results must improve soon or your position may be at risk.' });
  } else if (confidence > CONFIDENCE_PLEASED_THRESHOLD && won && prevConfidence <= CONFIDENCE_PLEASED_THRESHOLD) {
    newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Board Pleased', body: 'The board commends your excellent work. Keep this up!' });
  }

  result.events.filter(ev => ev.type === 'injury' && ev.playerId).forEach(ev => {
    const p = newPlayers[ev.playerId!];
    if (p && p.clubId === playerClubId) {
      const injLabel = p.injuryDetails ? `${p.injuryDetails.severity} ${INJURY_TYPES[p.injuryDetails.type].label}` : 'an injury';
      const reinjuryWarning = p.injuryDetails && p.injuryDetails.reinjuryRisk > 0.15 ? ' Take care when bringing them back.' : '';
      newMessages = addMsg(newMessages, { week, season, type: 'injury', title: `${p.lastName} Injured`, body: `${p.firstName} ${p.lastName} suffered ${injLabel} and will be out for ${p.injuryWeeks} week(s).${reinjuryWarning}` });
    }
  });

  // Manager stats
  const ms = { ...state.managerStats };
  if (won) ms.totalWins++;
  else if (lost) ms.totalLosses++;
  else ms.totalDraws++;

  // Live-event hook: a win during an active festival window earns Festival
  // Points (device-global, capped per day). No-op off-window; never throws.
  awardFestivalMatchWin(won);

  // Career milestones
  const newMilestones: CareerMilestone[] = [];
  const totalMatches = ms.totalWins + ms.totalDraws + ms.totalLosses;
  if (won && ms.totalWins === 1) {
    newMilestones.push(createMilestone('first_win', 'First Victory', `Won ${result.homeGoals}-${result.awayGoals} against ${oppName}.`, season, week, 'trophy'));
    // First win is the emotional peak to ask for notification permission —
    // flag the one-time value-framed prompt (routed through the presentation
    // queue by NotifPermissionModal). Side-effect only; never throws.
    signalFirstWinForNotifications();
  }
  const matchMilestone = checkMatchMilestones(totalMatches, state.careerTimeline, season, week);
  if (matchMilestone) newMilestones.push(matchMilestone);
  // Biggest win milestone (5+ goal margin)
  const margin = won ? Math.abs(result.homeGoals - result.awayGoals) : 0;
  if (margin >= 5) {
    newMilestones.push(createMilestone('biggest_win', 'Thrashing!', `${result.homeGoals}-${result.awayGoals} against ${oppName}.`, season, week, 'circle'));
  }

  // XP for match result
  const xpGain = won ? XP_REWARDS.win : !lost ? XP_REWARDS.draw : 0;
  const updatedProgression = xpGain > 0 ? grantXP(state.managerProgression, xpGain) : state.managerProgression;

  // Record match history for player club's lineup participants
  const pcLineupForHistory = [...(pc.lineup || []), ...(pc.subs || [])];
  const pcIsHome = match.homeClubId === playerClubId;
  const pcOppId = pcIsHome ? match.awayClubId : match.homeClubId;
  const pcOppClub = clubs[pcOppId];
  const pcOppName = pcOppClub?.shortName || pcOppClub?.name || 'Unknown';
  for (const pid of pcLineupForHistory) {
    const player = newPlayers[pid];
    if (!player) continue;
    const rating = playerRatings.find(r => r.playerId === pid);
    if (!rating) continue; // only record players who got rated (i.e. played)
    const record: PlayerMatchRecord = {
      week,
      season,
      opponentName: pcOppName,
      isHome: pcIsHome,
      goalsFor: pcIsHome ? result.homeGoals : result.awayGoals,
      goalsAgainst: pcIsHome ? result.awayGoals : result.homeGoals,
      rating: rating.rating,
      goals: rating.goals,
      assists: rating.assists,
      yellowCards: rating.yellowCards,
      redCards: rating.redCards,
    };
    const history = [...(player.matchHistory || []), record].slice(-MAX_PLAYER_MATCH_HISTORY);
    newPlayers[pid] = {
      ...player,
      matchHistory: history,
      seasonRatingTotal: (player.seasonRatingTotal || 0) + rating.rating,
      seasonRatedMatches: (player.seasonRatedMatches || 0) + 1,
    };
  }

  // Update head-to-head rivalry records (oppId already declared above)
  const prevRecord = state.rivalries?.[oppId] || { wins: 0, draws: 0, losses: 0, lastResult: null, grudgeLevel: 0 };
  const updatedRivalry = { ...prevRecord };
  if (won) {
    updatedRivalry.wins++;
    updatedRivalry.lastResult = 'W' as const;
    updatedRivalry.grudgeLevel = Math.max(0, updatedRivalry.grudgeLevel - 1);
  } else if (lost) {
    updatedRivalry.losses++;
    updatedRivalry.lastResult = 'L' as const;
    updatedRivalry.grudgeLevel = Math.min(5, updatedRivalry.grudgeLevel + 1);
  } else {
    updatedRivalry.draws++;
    updatedRivalry.lastResult = 'D' as const;
  }
  const updatedRivalries = { ...(state.rivalries || {}), [oppId]: updatedRivalry };

  return { newPlayers, updatedFixtures, leagueTable, confidence, newMessages, managerStats: ms, playerRatings, won, lost, newMilestones, managerProgression: updatedProgression, xpGain, leaguePosition: pos, updatedRivalries, pairFamiliarity: newPairFamiliarity };
}
