/**
 * Pure helpers extracted from orchestrationSlice.ts.
 *
 * Each function in this file:
 *   - Has no dependency on Zustand `set` / `get`.
 *   - Has no module-level mutable state.
 *
 * If you need to reach back into the slice, keep the helper inside
 * orchestrationSlice.ts. This file is for the cleanly-pure subset.
 */
import type {
  Player,
  Club,
  BoardObjective,
  LeagueId,
  InjuryType,
  InjurySeverity,
  InjuryDetails,
} from '@/types/game';
import { LEAGUES } from '@/data/league';
import {
  BOARD_OBJ_XP_CRITICAL,
  BOARD_OBJ_XP_IMPORTANT,
  BOARD_OBJ_XP_OPTIONAL,
  BOARD_OBJ_XP_OVERACHIEVE_MULT,
  BOARD_OBJ_BUDGET_BOOST,
  RED_CARD_SUSPENSION_MIN,
  RED_CARD_SUSPENSION_RANGE,
  MEDICAL_LEVEL_FACTOR,
  FACILITY_MAX_LEVEL,
  MEDICAL_REINJURY_REDUCTION_PER_LEVEL,
  FORM_WIN_CHANGE,
  FORM_LOSS_CHANGE,
  FORM_DRAW_CHANGE,
  INJURY_TYPES,
  NON_FOUL_INJURY_TYPE_WEIGHTS,
  INJURY_SEVERITY_WEIGHTS,
} from '@/config/gameBalance';
import { GOAL_EVENT_TYPES } from '@/config/matchEngine';
import { resetRealPlayerClaims, claimRealPlayer } from '@/utils/realPlayerPicker';
import { getOpponentQualityBonus } from '@/utils/teamRankings';

/**
 * Reset the module-level real-player claim registry and re-claim every
 * persisted FC-backed player. Procedural players carry no `fcId` and
 * must NOT be claimed — claiming a generated "Pieter Jansen" would
 * later block a real FC26 player who happens to share that name and
 * push the picker into procedural fallback unnecessarily.
 */
export function rebuildRealPlayerClaims(players: Record<string, Player>): void {
  resetRealPlayerClaims();
  for (const p of Object.values(players)) {
    if (!p.fcId) continue;
    claimRealPlayer({ fcId: p.fcId, fn: p.firstName, ln: p.lastName });
  }
}

/** Weighted random pick from a record of weights */
export function weightedPickFromRecord<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w as number), 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight as number;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Generate injury details for AI match processing */
export function generateAIInjuryDetails(medicalLevel: number = 5): InjuryDetails {
  const type = weightedPickFromRecord(NON_FOUL_INJURY_TYPE_WEIGHTS) as InjuryType;
  const severity = weightedPickFromRecord(INJURY_SEVERITY_WEIGHTS) as InjurySeverity;
  const config = INJURY_TYPES[type];
  const [minWeeks, maxWeeks] = config.weeks[severity];
  const weeksRaw = Math.max(1, minWeeks + Math.floor(Math.random() * (maxWeeks - minWeeks + 1)));
  const medicalReduction = Math.max(0, Math.floor(medicalLevel / 5));
  const weeks = Math.max(1, weeksRaw - medicalReduction);
  return {
    type, severity, weeksRemaining: weeks, totalWeeks: weeks,
    reinjuryRisk: Math.max(0, config.reinjuryRisk[severity] - medicalLevel * MEDICAL_REINJURY_REDUCTION_PER_LEVEL),
    reinjuryWeeksRemaining: config.reinjuryDuration[severity],
    fitnessOnReturn: config.fitnessOnReturn[severity],
  };
}

/** Apply AI match events to players: goals, assists, injuries, cards, suspensions. */
export function applyAIMatchEvents(
  events: { type: string; playerId?: string; assistPlayerId?: string; clubId: string }[],
  newPlayers: Record<string, Player>,
  clubs: Record<string, Club>,
  week: number,
  homeLineup?: Player[],
  awayLineup?: Player[],
  homeGoals?: number,
  awayGoals?: number,
  rankings?: Record<string, number>,
  homeClubId?: string,
  awayClubId?: string,
) {
  // Track per-player goal/assist counts from events for synthetic rating
  const playerGoalCounts: Record<string, number> = {};
  const playerAssistCounts: Record<string, number> = {};
  for (const ev of events) {
    const isGoalEv = (GOAL_EVENT_TYPES as readonly string[]).includes(ev.type);
    if (isGoalEv && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
      playerGoalCounts[ev.playerId] = (playerGoalCounts[ev.playerId] || 0) + 1;
    }
    if (isGoalEv && ev.type !== 'penalty_scored' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
      newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
      playerAssistCounts[ev.assistPlayerId] = (playerAssistCounts[ev.assistPlayerId] || 0) + 1;
    }
    if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
      const clubFacilities = clubs[newPlayers[ev.playerId].clubId]?.facilities ?? 5;
      const aiMedicalLevel = Math.min(FACILITY_MAX_LEVEL, Math.round(clubFacilities * MEDICAL_LEVEL_FACTOR));
      const injDetails = generateAIInjuryDetails(aiMedicalLevel);
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: injDetails.weeksRemaining, injuryDetails: injDetails };
    }
    if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], yellowCards: newPlayers[ev.playerId].yellowCards + 1 };
    }
    if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: week + 1 + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
    }
  }

  // Track appearances and synthetic match ratings for AI lineups
  if (homeLineup && awayLineup && homeGoals !== undefined && awayGoals !== undefined) {
    const sides: { lineup: Player[]; won: boolean; lost: boolean; clubId: string; oppClubId: string }[] = [
      { lineup: homeLineup, won: homeGoals > awayGoals, lost: homeGoals < awayGoals, clubId: homeClubId || '', oppClubId: awayClubId || '' },
      { lineup: awayLineup, won: awayGoals > homeGoals, lost: awayGoals < homeGoals, clubId: awayClubId || '', oppClubId: homeClubId || '' },
    ];
    for (const side of sides) {
      // Opponent quality bonus: performing well against strong teams earns higher ratings
      const oppBonus = rankings && side.clubId && side.oppClubId
        ? getOpponentQualityBonus(rankings[side.clubId] || 800, rankings[side.oppClubId] || 800)
        : 0;
      for (const p of side.lineup) {
        if (!newPlayers[p.id]) continue;
        // Synthetic match rating: base from result + quality + contribution + opponent quality
        let rating = side.won ? 7.0 : side.lost ? 5.5 : 6.2;
        rating += (p.overall / 100) * 1.5;
        rating += (playerGoalCounts[p.id] || 0) * 0.5;
        rating += (playerAssistCounts[p.id] || 0) * 0.3;
        rating += oppBonus;
        rating += (Math.random() - 0.5) * 0.6;
        rating = Math.max(3, Math.min(10, Math.round(rating * 10) / 10));

        const prev = newPlayers[p.id];
        const formChange = side.won ? FORM_WIN_CHANGE : side.lost ? FORM_LOSS_CHANGE : FORM_DRAW_CHANGE;
        newPlayers[p.id] = {
          ...prev,
          appearances: prev.appearances + 1,
          form: Math.min(100, Math.max(10, prev.form + formChange)),
          seasonRatingTotal: (prev.seasonRatingTotal || 0) + rating,
          seasonRatedMatches: (prev.seasonRatedMatches || 0) + 1,
        };
      }
    }
  }
}

/** Build the season-start board objectives for a given club. */
export function generateObjectives(club: Club, leagueId?: LeagueId): BoardObjective[] {
  const objectives: BoardObjective[] = [];
  const lid = leagueId || club.divisionId;
  const league = LEAGUES.find(l => l.id === lid);
  const teamCount = league?.teamCount || 20;
  const replacedSlots = league?.replacedSlots || 0;
  const safePos = teamCount - replacedSlots;
  const half = Math.floor(teamCount / 2);

  // League objectives based on reputation
  if (club.reputation >= 5) {
    objectives.push({ id: '1', description: 'Win the League', priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: 1, targetOverachieve: 1,
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL });
    objectives.push({ id: '2', description: 'Finish in Top 3', priority: 'important', completed: false,
      checkType: 'league_position', targetMin: 3, targetOverachieve: 1,
      xpReward: BOARD_OBJ_XP_IMPORTANT, xpRewardOverachieve: BOARD_OBJ_XP_IMPORTANT * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '1', description: 'Finish in Top 6', priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: 6, targetOverachieve: 3,
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
    objectives.push({ id: '2', description: `Reach Top Half`, priority: 'important', completed: false,
      checkType: 'league_position', targetMin: half, targetOverachieve: 6,
      xpReward: BOARD_OBJ_XP_IMPORTANT, xpRewardOverachieve: BOARD_OBJ_XP_IMPORTANT * BOARD_OBJ_XP_OVERACHIEVE_MULT });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '1', description: 'Reach Top Half', priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: half, targetOverachieve: Math.max(1, half - 3),
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
  } else {
    const target = replacedSlots > 0 ? safePos : half;
    const desc = replacedSlots > 0 ? `Avoid Replacement (Top ${safePos})` : 'Finish in Top Half';
    objectives.push({ id: '1', description: desc, priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: target, targetOverachieve: Math.max(1, target - 4),
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
  }

  // Cup objectives based on reputation
  if (club.reputation >= 5) {
    objectives.push({ id: '4', description: 'Win the Cup', priority: 'important', completed: false,
      checkType: 'cup_round', targetMin: 1, xpReward: BOARD_OBJ_XP_IMPORTANT });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '4', description: 'Reach Cup Semi-Final', priority: 'important', completed: false,
      checkType: 'cup_round', targetMin: 2, targetOverachieve: 1,
      xpReward: BOARD_OBJ_XP_IMPORTANT, xpRewardOverachieve: BOARD_OBJ_XP_IMPORTANT * BOARD_OBJ_XP_OVERACHIEVE_MULT });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '4', description: 'Reach Cup Quarter-Final', priority: 'optional', completed: false,
      checkType: 'cup_round', targetMin: 3, targetOverachieve: 2,
      xpReward: BOARD_OBJ_XP_OPTIONAL, xpRewardOverachieve: BOARD_OBJ_XP_OPTIONAL * BOARD_OBJ_XP_OVERACHIEVE_MULT });
  }

  objectives.push({ id: '3', description: 'Stay within budget', priority: 'optional', completed: false,
    checkType: 'budget', targetMin: 0,
    xpReward: BOARD_OBJ_XP_OPTIONAL });

  return objectives;
}
