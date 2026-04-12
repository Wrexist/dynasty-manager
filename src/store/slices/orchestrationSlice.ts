import * as Sentry from '@sentry/react';
import { Club, Player, PlayerAttributes, TransferListing, SeasonHistory, IncomingOffer, IncomingLoanOffer, FacilitiesState, BoardObjective, Position, Message, Match, MatchEvent, LeagueId, SeasonTurnover, LeagueTableEntry, JobVacancy, PenaltyKick } from '@/types/game';
import { calculateReputationTier, generateJobVacancies, generateProactiveOffer, getRetirementAge, calculateLegacyScore, getReputationTierLabel, generateCompetitors } from '@/utils/managerCareer';
import {
  GROWTH_TACTICAL_PER_MATCH, GROWTH_MOTIVATION_PER_MORALE_EVENT, GROWTH_SCOUTING_PER_ASSIGNMENT,
  GROWTH_DISCIPLINE_PER_CLEAN_MATCH, MOD_DISCIPLINE_CARDS, MOD_TACTICAL_FAMILIARITY, MOD_YOUTH_GROWTH,
  MOD_SCOUTING_SPEED, JOB_MARKET_REFRESH_WEEKS, STAT_MAX, MOTM_CHECK_INTERVAL, MOTM_MIN_MATCHES,
  REP_PROMOTION, REP_RELEGATION, REP_OVERACHIEVE_BONUS, REP_UNDERACHIEVE_PENALTY,
  REP_WIN, REP_DRAW, REP_LOSS, REP_TITLE, REP_CUP_WIN, REP_SACKING, REP_MIN, REP_MAX,
  FORCED_RETIREMENT_UNEMPLOYED_WEEKS,
  PROACTIVE_OFFER_CHECK_INTERVAL, PROACTIVE_OFFER_MAX_PENDING,
} from '@/config/managerCareer';
import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, getDerbyIntensity, getDerbyName, clearLeagueTableCache, generateFriendlies } from '@/data/league';
import { FRIENDLY_BOARD_CONFIDENCE_MULT, BOARD_OBJ_XP_CRITICAL, BOARD_OBJ_XP_IMPORTANT, BOARD_OBJ_XP_OPTIONAL, BOARD_OBJ_XP_OVERACHIEVE_MULT, BOARD_OBJ_BUDGET_BOOST, BOARD_OBJ_ALL_COMPLETE_XP, BOARD_OBJ_ALL_COMPLETE_CONFIDENCE, BOARD_REVIEW_RELAX_THRESHOLD, BOARD_REVIEW_RAISE_THRESHOLD, BOARD_REVIEW_ADJUST_POSITIONS, INTERNATIONAL_BREAK_WEEKS, INTERNATIONAL_BREAK_FITNESS_COST, INTERNATIONAL_CALLUP_MIN_OVR, INTERNATIONAL_SNUB_MIN_OVR, CALLUP_SNUB_MORALE_PENALTY, POST_TOURNAMENT_FITNESS_COST_HIGH, POST_TOURNAMENT_FITNESS_COST_LOW } from '@/config/gameBalance';
import { generateSquad, selectBestLineup, generatePlayer, calculateOverall } from '@/utils/playerGen';
import { simulateMatch, simulateHalf, finalizeMatch, generateMatchWeather } from '@/engine/match';
import { generateInitialStaff, generateStaffMarket, getStaffBonus, getTrainingStaffBonus } from '@/utils/staff';
import { GK_COACH_DEV_BONUS_PER_QUALITY, STAFF_MARKET_REFRESH_WEEK } from '@/config/staff';
import { applyWeeklyTraining, getInjuryRisk, updateTacticalFamiliarity, getDominantTrainingFocus, getStreakMultiplier, updateStreaks, generateTrainingReport } from '@/utils/training';
import { INDIVIDUAL_INJURY_RISK_MODIFIER } from '@/config/training';
import { completeAssignment } from '@/utils/scouting';
import { MAX_SCOUT_REPORTS } from '@/config/scouting';
import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../storeTypes';
import { addMsg, getSuffix, pick, shuffle, formatMoney } from '@/utils/helpers';
import { migrateLegacySave, saveSessionSnapshot, readSaveSlot, readSaveSlotBackup, writeSaveSlot, promoteSaveBackup, removeSaveSlot, trimFixturesForSave, trimFixtureArrayForSave } from '@/store/helpers/persistence';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { checkAchievements, ACHIEVEMENTS, getAchievementXP } from '@/utils/achievements';
import { generateCupDraw, advanceCupRound, getCupResultForClub, getRoundName, CUP_BYE_MARKER } from '@/data/cup';
import { getChampionsCupQualifiers, getShieldCupQualifiers, getConferenceCupQualifiers, generateContinentalDraw } from '@/data/continentalDraw';
import { updateCoefficients } from '@/utils/continentalCoefficients';
import { simulateGroupMatchday, getCurrentMatchday, isGroupStageComplete, generateKnockoutFromGroups, simulateKnockoutLeg, isKnockoutRoundComplete, advanceKnockoutRound, getContinentalResultForClub, createEphemeralClub, findPlayerContinentalMatch } from '@/utils/continental';
import { CONTINENTAL_GROUP_WEEKS, CONTINENTAL_R16_WEEKS, CONTINENTAL_QF_WEEKS, CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK, LEAGUE_CUP_WEEKS, DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK, CONTINENTAL_PRIZE_MONEY, REP_CHAMPIONS_CUP_WIN, REP_SHIELD_CUP_WIN, REP_CONFERENCE_CUP_WIN, REP_LEAGUE_CUP_WIN, REP_CONTINENTAL_GROUP, REP_CONTINENTAL_KNOCKOUT } from '@/config/continental';
import { generatePressConference } from '@/data/pressConferences';
import { isPro } from '@/utils/monetization';
import { getMentorBonus } from '@/utils/chemistry';
import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';
import { checkChallengeComplete, checkChallengeFailed, CHALLENGES } from '@/data/challenges';
import { calculateSeasonAwards } from '@/utils/seasonAwards';
import { calculateBallonDOr, getBallonDOrValueBoost } from '@/utils/ballonDor';
import { getLeadershipBonus, wantsTransfer } from '@/utils/personality';
import { buildTransferTalk } from '@/utils/transferTalk';
import { createEmptyRecords, updateRecords, findBiggestWin } from '@/utils/records';
import { getFarewellSummary } from '@/utils/playerNarratives';
import { calculateWeeklyMerchRevenue, getDefaultMerchState } from '@/utils/merchandise';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { MERCH_PRICING_TIERS, MERCH_CAMPAIGN_COOLDOWN_WEEKS } from '@/config/merchandise';
import { getEffectiveStadiumLevel } from '@/utils/facilities';
import { MOTIVATE_ATTACK_BOOST, MOTIVATE_FOUL_BONUS, CALM_DEFENSE_BOOST, CALM_FOUL_REDUCTION, DEMAND_ATTACK_BOOST, DEMAND_DEFENSE_PENALTY, MOTIVATE_FITNESS_DRAIN_MULT, CALM_FITNESS_DRAIN_MULT, DEMAND_FITNESS_DRAIN_MULT } from '@/config/teamTalk';
import {
  TOTAL_WEEKS, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY,
  CONFIDENCE_MIN,
  RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE,
  PHYSIO_RECOVERY_BOOST_THRESHOLD, PHYSIO_RECOVERY_CHANCE, PHYSIO_INJURY_REDUCTION_PER_QUALITY, ASSISTANT_MANAGER_FAMILIARITY_BOOST,
  CONTRACT_WARNING_WEEKS, CONTRACT_WARNING_OVERALL_THRESHOLD, CONTRACT_WARNING_YOUTH_AGE_MAX, CONTRACT_WARNING_YOUTH_POTENTIAL_MIN,
  CONTRACT_MORALE_HIT_WEEK_THRESHOLD, CONTRACT_MORALE_HIT_OVERALL_THRESHOLD, CONTRACT_MORALE_HIT_AMOUNT, CONTRACT_MORALE_MIN,
  MATCHDAY_INCOME_PER_FAN, COMMERCIAL_INCOME_PER_REP, COMMERCIAL_INCOME_BASE, STADIUM_INCOME_PER_LEVEL,
  POSITION_PRIZE_PER_RANK, POSITION_PRIZE_MAX_RANK,
  SCOUTING_COST_PER_ASSIGNMENT,
  FAN_MOOD_BASE, FAN_MOOD_SCALE,
  STADIUM_LEVEL_DIVISOR, MEDICAL_LEVEL_FACTOR, RECOVERY_LEVEL_FACTOR, FACILITY_MAX_LEVEL,
  SEASON_END_CONFIDENCE,
  MIN_SQUAD_SIZE, MAX_SQUAD_SIZE, REPLACEMENT_QUALITY_REP_MULTIPLIER, REPLACEMENT_QUALITY_BASE, REPLACEMENT_QUALITY_VARIANCE,
  GENERIC_FILL_POSITIONS,
  LISTING_PRICE_MIN_MULTIPLIER, LISTING_PRICE_RANDOM_RANGE, INITIAL_LISTINGS_MIN, INITIAL_LISTINGS_RANGE,
  SEASON_YOUTH_INTAKE_MIN, SEASON_YOUTH_INTAKE_RANGE,
  LOAN_PLAY_CHANCE_HIGH, LOAN_PLAY_CHANCE_LOW, LOAN_DEV_BASE_CHANCE, LOAN_DEV_REP_FACTOR,
  LOAN_QUALITY_FORMULA_REP_MULT, LOAN_QUALITY_FORMULA_BASE, LOAN_FITNESS_DRAIN, LOAN_YOUNG_AGE_THRESHOLD,
  AI_LOAN_OFFER_CHANCE, AI_LOAN_DURATIONS, AI_LOAN_WAGE_SPLITS, AI_LOAN_RECALL_CLAUSE_CHANCE, AI_LOAN_OBLIGATORY_BUY_CHANCE, AI_LOAN_OBLIGATORY_BUY_MULTIPLIER,
  getExpectedPosition,
  STREAK_MORALE_THRESHOLD, STREAK_MORALE_BONUS, STREAK_INCOME_THRESHOLD, STREAK_INCOME_MULTIPLIER, STREAK_FORM_THRESHOLD, STREAK_FORM_BONUS,
  BOARD_REVIEW_WEEKS,
  MORALE_BENCH_WEEKLY_LOSS, MORALE_BENCH_MIN,
  CUP_EXTRA_TIME_GOAL_CHANCE, CUP_PENALTY_GK_QUALITY_FACTOR, CUP_PENALTY_KICKS,
  CONGESTED_FIXTURE_INJURY_MULTIPLIER,
  MOTIVATOR_MORALE_BOOST, YOUTH_DEVELOPER_BOOST,
  VALUE_AGE_MULTIPLIERS, TRAINING_GROUND_BOOST, GOLDEN_GEN_MIN_POTENTIAL,
  FFP_WAGE_RATIO_WARNING, FFP_WAGE_RATIO_CRITICAL, FFP_CONFIDENCE_PENALTY, FFP_CRITICAL_CONFIDENCE_PENALTY,
  MANAGER_SALARY_RATIO_WARNING, MANAGER_SALARY_RATIO_CRITICAL, MANAGER_SALARY_CONFIDENCE_PENALTY,
  FREE_AGENT_POOL_MAX,
  UNHAPPY_THRESHOLD, UNHAPPY_WEEKS_TO_REQUEST, UNHAPPY_CONTAGION_WEEKS, UNHAPPY_CONTAGION_MORALE_HIT,
  MEDICAL_REINJURY_REDUCTION_PER_LEVEL,
  MAX_FINANCE_HISTORY, MAX_CAREER_TIMELINE,
  OBJECTIVE_CYCLE_WEEKS,
  FORM_WIN_CHANGE, FORM_LOSS_CHANGE, FORM_DRAW_CHANGE,
} from '@/config/gameBalance';
import {
  SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END,
  AI_OFFER_CHANCE, AI_OFFER_MIN_BUDGET_RATIO, AI_OFFER_POSITION_THRESHOLD,
  URGENCY_NONE, URGENCY_ONE, URGENCY_TWO_PLUS,
  OFFER_FEE_BASE, OFFER_FEE_RANDOM_RANGE, OFFER_MAX_BUDGET_RATIO,
  RUMOR_CHANCE, DEADLINE_DAY_OFFER_MULTIPLIER, DEADLINE_DAY_BID_PREMIUM, DEADLINE_PANIC_OFFER_COUNT, DEADLINE_PANIC_BID_PREMIUM, DEADLINE_BARGAIN_DISCOUNT, DEADLINE_MULTI_BID_CHANCE,
  MARKET_REPLENISH_THRESHOLD, LISTING_EXPIRY_WEEKS, CLUB_LISTING_EXPIRY_WEEKS, LISTING_RELIST_CHANCE, LISTING_RELIST_DISCOUNT,
  FREE_AGENT_SPAWN_CHANCE, OFFER_EXPIRY_WEEKS,
  UNSOLICITED_OFFER_CHANCE, UNSOLICITED_FEE_BASE, UNSOLICITED_FEE_RANGE,
  COMPETING_BID_PREMIUM,
  ASKING_PRICE_BID_ANCHOR,
  INJURY_BID_DISCOUNT, LONG_INJURY_BID_DISCOUNT, LONG_INJURY_WEEKS_THRESHOLD,
  PRE_SEASON_END, PRE_SEASON_OFFER_MULTIPLIER, PRE_SEASON_UNSOLICITED_MULTIPLIER, PRE_SEASON_RUMOR_MULTIPLIER,
} from '@/config/transfers';
import { getPerformanceMultiplier, getContractLengthFactor } from '@/utils/transferOffers';
import { generateInitialMarket, generateInitialFreeAgents, replenishMarket, replenishMarketPreSeason, generatePreSeasonMarket, spawnFreeAgents, processListingExpiry } from '@/utils/transferMarketGen';
import { PENALTY_CONVERSION_RATE, SHOUT_MODIFIERS, SHOUT_CUMULATIVE_SCALE, GOAL_EVENT_TYPES } from '@/config/matchEngine';
import { calculatePlayerValue } from '@/config/playerGeneration';
import {
  VERDICT_EXCELLENT_OFFSET, VERDICT_ACCEPTABLE_OFFSET, BOARD_SACKING_THRESHOLD,
  STORYLINE_CHAIN_TRIGGER_CHANCE, STORYLINE_CHAIN_MIN_WEEK,
} from '@/config/playoffs';
import { applyPlayerDevelopment, resetSeasonGrowth, hydrateSeasonGrowth, seasonGrowthTracker } from '@/store/helpers/development';
import { applySeasonTurnover, generateReplacementClub } from '@/utils/promotionRelegation';
import { generateStorylines } from '@/utils/storylines';
import { STORYLINE_CHAINS, shouldTriggerChain } from '@/data/storylineChains';
import type { ActiveStorylineChain, StorylineEvent } from '@/types/game';
import { getTournamentForSeason, generateTournament, processGroupWeek, generateKnockoutBracket, processKnockoutRound, autoSelectNationalSquad, generateNationalTeamPool } from '@/utils/international';
import { NATIONAL_CALLUP_MORALE_BOOST, INTERNATIONAL_FITNESS_COST, NT_JOB_REHIRE_REPUTATION, NT_JOB_OFFER_DURATION_WEEKS, REP_INTL_TOURNAMENT_WIN, REP_INTL_FINAL, REP_INTL_SEMI, REP_INTL_KNOCKOUT, REP_INTL_GROUP_EXIT, NT_SACK_GROUP_EXIT_THRESHOLD } from '@/config/gameBalance';
import { generateRandomEvents } from '@/utils/randomEvents';
import { getWinStreak, detectMatchDrama } from '@/utils/celebrations';
import { generateCliffhangers } from '@/utils/weekPreview';
import { generateMonthlyObjectives, evaluateObjectives, calculateCompletedXP } from '@/utils/weeklyObjectives';
import type { ObjectiveContext } from '@/utils/weeklyObjectives';
import { generateAIManagerProfile, getAICounterTactics } from '@/config/aiManager';
import { processAIWeekly } from '@/utils/aiSimulation';
import {
  INJURY_TYPES, NON_FOUL_INJURY_TYPE_WEIGHTS,
  INJURY_SEVERITY_WEIGHTS,
} from '@/config/gameBalance';
import type { InjuryType, InjurySeverity, InjuryDetails } from '@/types/game';
import { createMilestone } from '@/utils/milestones';
import { createDefaultProgression, grantXP, XP_REWARDS, MANAGER_PERKS, canUnlockPerk, hasPerk, dynastyMult } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';
import { initializeClubPowerRankings, updateEloRatings, getOpponentQualityBonus } from '@/utils/teamRankings';
import type { CareerMilestone, PerkId, ManagerProgression } from '@/types/game';
import { processMatchResult } from '@/store/helpers/matchProcessing';
import { processSponsorWeek, processSponsorSeasonEnd, generateStarterDeals } from '@/store/slices/sponsorSlice';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;
let lastSaveErrorLogAt = 0;
let lastSaveAt = 0;
const SAVE_DEBOUNCE_MS = 2000; // Minimum 2s between auto-saves

// migrateLegacySave and getSlotSummaries extracted to @/store/helpers/persistence
export { getSlotSummaries } from '@/store/helpers/persistence';



/** Weighted random pick from a record of weights */
function weightedPickFromRecord<T extends string>(weights: Record<T, number>): T {
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
function generateAIInjuryDetails(medicalLevel: number = 5): InjuryDetails {
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
function applyAIMatchEvents(
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

function generateObjectives(club: Club, leagueId?: LeagueId): BoardObjective[] {
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


/** International break week implementation */
function advanceInternationalWeekImpl(set: Set, get: Get) {
  const state = get();
  const tournament = state.internationalTournament;
  if (!tournament || !state.nationalTeam || !state.managerNationality) {
    // No tournament active — finalize season
    endSeasonImpl(set, get);
    return;
  }

  const nationality = state.managerNationality;
  const currentWeek = tournament.currentWeek;

  if (tournament.phase === 'group') {
    // Process group stage
    const { groups, playerMatchThisWeek } = processGroupWeek(
      tournament.groups, currentWeek, nationality
    );

    if (playerMatchThisWeek) {
      // Simulate using squad quality: average overall of lineup/squad affects goal output
      const { homeGoals, awayGoals } = (() => {
        const isHome = playerMatchThisWeek.homeNation === nationality;
        const natTeam = state.nationalTeam;
        const playerSquadIds = natTeam ? (natTeam.lineup.length >= 7 ? natTeam.lineup : natTeam.squad) : [];
        const playerAvgOVR = playerSquadIds.length > 0
          ? playerSquadIds.reduce((sum, id) => sum + (state.players[id]?.overall || 60), 0) / playerSquadIds.length
          : 65;
        // Opponent strength from FIFA ranking (lower = better)
        const opponentNation = isHome ? playerMatchThisWeek.awayNation : playerMatchThisWeek.homeNation;
        const opponentRanking = tournament.groups.flatMap(g => g.table).find(t => t.nationality === opponentNation);
        const opponentStr = opponentRanking ? Math.max(0.3, 0.7 - (opponentRanking.points || 0) * 0.02) : 0.5;
        const playerStr = Math.min(0.85, (playerAvgOVR - 40) / 60 + 0.1); // 0.1 to 0.85 based on OVR 40-90
        const homeBonus = 0.08;
        const hStr = isHome ? playerStr + homeBonus : opponentStr;
        const aStr = isHome ? opponentStr : playerStr + homeBonus;
        const hg = Math.floor(Math.random() * 3 * hStr + Math.random() * 0.5);
        const ag = Math.floor(Math.random() * 3 * aStr + Math.random() * 0.5);
        return { homeGoals: hg, awayGoals: ag };
      })();

      // Mark the player's match as played
      const finalGroups = groups.map(group => ({
        ...group,
        fixtures: group.fixtures.map(f =>
          f.id === playerMatchThisWeek.id
            ? { ...f, played: true, homeGoals, awayGoals }
            : f
        ),
        table: group.table, // Will be rebuilt below
      }));

      // Rebuild tables for groups that had the player match
      const rebuiltGroups = finalGroups.map(group => {
        const allPlayed = group.fixtures.every(f => f.played || f.week > currentWeek);
        if (!allPlayed && group.fixtures.some(f => f.id === playerMatchThisWeek.id)) {
          // Need to rebuild this group's table
          const entries: Record<string, { nationality: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }> = {};
          group.teams.forEach(t => { entries[t] = { nationality: t, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }; });
          group.fixtures.filter(f => f.played).forEach(f => {
            const h = entries[f.homeNation]; const a = entries[f.awayNation];
            if (!h || !a) return;
            h.played++; a.played++;
            h.goalsFor += f.homeGoals; h.goalsAgainst += f.awayGoals;
            a.goalsFor += f.awayGoals; a.goalsAgainst += f.homeGoals;
            if (f.homeGoals > f.awayGoals) { h.won++; h.points += 3; a.lost++; }
            else if (f.homeGoals < f.awayGoals) { a.won++; a.points += 3; h.lost++; }
            else { h.drawn++; h.points += 1; a.drawn++; a.points += 1; }
          });
          return { ...group, table: Object.values(entries).sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor) };
        }
        return group;
      });

      // Record result for player's national team
      const isHome = playerMatchThisWeek.homeNation === nationality;
      const nt = { ...state.nationalTeam };
      nt.results = [...nt.results, {
        season: state.season,
        opponent: isHome ? playerMatchThisWeek.awayNation : playerMatchThisWeek.homeNation,
        goalsFor: isHome ? homeGoals : awayGoals,
        goalsAgainst: isHome ? awayGoals : homeGoals,
        tournament: tournament.name,
        round: 'Group Stage',
      }];

      // Apply fitness recovery between matches (+3), then fitness cost for this match
      const newPlayers = { ...state.players };
      const playerGoals = isHome ? homeGoals : awayGoals;
      const updatedCaps = { ...nt.caps };
      const updatedIntlGoals = { ...nt.internationalGoals };
      for (const pid of nt.squad) {
        if (newPlayers[pid]) {
          const recovered = Math.min(100, newPlayers[pid].fitness + 3);
          newPlayers[pid] = { ...newPlayers[pid], fitness: Math.max(40, recovered - INTERNATIONAL_FITNESS_COST) };
          newPlayers[pid].internationalCaps = (newPlayers[pid].internationalCaps || 0) + 1;
          updatedCaps[pid] = (updatedCaps[pid] || 0) + 1;
        }
      }
      // Distribute goals among lineup players randomly (fall back to full squad if lineup empty)
      const lineupIds = nt.lineup.filter(pid => newPlayers[pid]);
      const scorerPool = lineupIds.length > 0 ? lineupIds : nt.squad.filter(pid => newPlayers[pid]);
      for (let g = 0; g < playerGoals; g++) {
        if (scorerPool.length === 0) break;
        const scorerId = scorerPool[Math.floor(Math.random() * scorerPool.length)];
        if (scorerId && newPlayers[scorerId]) {
          newPlayers[scorerId] = { ...newPlayers[scorerId], internationalGoals: (newPlayers[scorerId].internationalGoals || 0) + 1 };
          updatedIntlGoals[scorerId] = (updatedIntlGoals[scorerId] || 0) + 1;
        }
      }
      nt.caps = updatedCaps;
      nt.internationalGoals = updatedIntlGoals;

      const nextWeek = currentWeek + 1;

      // Check if group stage is complete (all group fixtures played)
      const allGroupFixturesPlayed = rebuiltGroups.every(g => g.fixtures.every(f => f.played));

      if (allGroupFixturesPlayed) {
        // Move to knockout
        const knockoutTies = generateKnockoutBracket(rebuiltGroups);
        const firstRound = knockoutTies.length > 0 ? knockoutTies[0].round : null;
        const eliminated = !rebuiltGroups.some(g => g.table.slice(0, 2).some(e => e.nationality === nationality));

        set({
          internationalTournament: {
            ...tournament,
            groups: rebuiltGroups,
            phase: eliminated ? 'complete' : 'knockout',
            knockoutTies,
            currentRound: firstRound,
            playerEliminated: eliminated,
            currentWeek: nextWeek,
          },
          nationalTeam: nt,
          players: newPlayers,
        });
      } else {
        set({
          internationalTournament: { ...tournament, groups: rebuiltGroups, currentWeek: nextWeek },
          nationalTeam: nt,
          players: newPlayers,
        });
      }
    } else {
      // No player match this week — just advance
      const allGroupFixturesPlayed = groups.every(g => g.fixtures.every(f => f.played));
      if (allGroupFixturesPlayed) {
        const knockoutTies = generateKnockoutBracket(groups);
        const firstRound = knockoutTies.length > 0 ? knockoutTies[0].round : null;
        const eliminated = !groups.some(g => g.table.slice(0, 2).some(e => e.nationality === nationality));
        set({
          internationalTournament: {
            ...tournament, groups, phase: eliminated ? 'complete' : 'knockout',
            knockoutTies, currentRound: firstRound, playerEliminated: eliminated,
            currentWeek: currentWeek + 1,
          },
        });
      } else {
        set({ internationalTournament: { ...tournament, groups, currentWeek: currentWeek + 1 } });
      }
    }

    return;
  }

  if (tournament.phase === 'knockout' && tournament.currentRound) {
    const { updatedTies, nextRoundTies, playerTie, roundComplete, tournamentComplete, winner } = processKnockoutRound(
      tournament.knockoutTies, tournament.currentRound, nationality
    );

    // Handle player's knockout tie — use squad quality for simulation
    let finalTies = updatedTies;
    if (playerTie && !playerTie.played && state.nationalTeam) {
      const isHome = playerTie.homeNation === nationality;
      const natTeam = state.nationalTeam;
      const playerSquadIds = natTeam ? (natTeam.lineup.length >= 7 ? natTeam.lineup : natTeam.squad) : [];
      const playerAvgOVR = playerSquadIds.length > 0
        ? playerSquadIds.reduce((sum, id) => sum + (state.players[id]?.overall || 60), 0) / playerSquadIds.length
        : 65;
      const playerStr = Math.min(0.8, (playerAvgOVR - 40) / 60 + 0.1);
      const opponentStr = 0.45 + Math.random() * 0.2; // 0.45-0.65 — AI opponents
      const hStr = isHome ? playerStr + 0.05 : opponentStr;
      const aStr = isHome ? opponentStr : playerStr + 0.05;
      const hg = Math.floor(Math.random() * 2 * hStr + Math.random() * 0.6);
      const ag = Math.floor(Math.random() * 2 * aStr + Math.random() * 0.6);
      let updatedPlayerTie = { ...playerTie, played: true, homeGoals: hg, awayGoals: ag };
      if (hg === ag) {
        // Penalty shootout weighted by squad mental/composure
        const avgMental = playerSquadIds.length > 0
          ? playerSquadIds.reduce((sum, id) => sum + (state.players[id]?.attributes?.mental || 55), 0) / playerSquadIds.length
          : 55;
        const penWinChance = 0.35 + (Math.min(100, avgMental) / 100) * 0.3; // 0.35 to 0.65 based on mental
        const homeWins = isHome ? Math.random() < penWinChance : Math.random() >= penWinChance;
        const winScore = 4 + Math.floor(Math.random() * 2); // 4 or 5
        const loseScore = winScore - 1 - Math.floor(Math.random() * 2); // 2-4
        updatedPlayerTie = { ...updatedPlayerTie, penaltyShootout: { home: homeWins ? winScore : loseScore, away: homeWins ? loseScore : winScore }, winnerId: homeWins ? playerTie.homeNation : playerTie.awayNation };
      } else {
        updatedPlayerTie.winnerId = hg > ag ? playerTie.homeNation : playerTie.awayNation;
      }
      finalTies = finalTies.map(t => t.id === playerTie.id ? updatedPlayerTie : t);

      // Record result
      const nt = { ...state.nationalTeam! };
      nt.results = [...nt.results, {
        season: state.season,
        opponent: isHome ? playerTie.awayNation : playerTie.homeNation,
        goalsFor: isHome ? hg : ag,
        goalsAgainst: isHome ? ag : hg,
        tournament: tournament.name,
        round: tournament.currentRound,
      }];

      // Apply fitness recovery between matches (+3), then fitness cost
      const newPlayers = { ...state.players };
      const playerGoalsKO = isHome ? hg : ag;
      const updatedCapsKO = { ...nt.caps };
      const updatedIntlGoalsKO = { ...nt.internationalGoals };
      for (const pid of nt.squad) {
        if (newPlayers[pid]) {
          const recovered = Math.min(100, newPlayers[pid].fitness + 3);
          newPlayers[pid] = { ...newPlayers[pid], fitness: Math.max(40, recovered - INTERNATIONAL_FITNESS_COST) };
          newPlayers[pid].internationalCaps = (newPlayers[pid].internationalCaps || 0) + 1;
          updatedCapsKO[pid] = (updatedCapsKO[pid] || 0) + 1;
        }
      }
      const lineupIdsKO = nt.lineup.filter(pid => newPlayers[pid]);
      const scorerPoolKO = lineupIdsKO.length > 0 ? lineupIdsKO : nt.squad.filter(pid => newPlayers[pid]);
      for (let g = 0; g < playerGoalsKO; g++) {
        if (scorerPoolKO.length === 0) break;
        const scorerId = scorerPoolKO[Math.floor(Math.random() * scorerPoolKO.length)];
        if (scorerId && newPlayers[scorerId]) {
          newPlayers[scorerId] = { ...newPlayers[scorerId], internationalGoals: (newPlayers[scorerId].internationalGoals || 0) + 1 };
          updatedIntlGoalsKO[scorerId] = (updatedIntlGoalsKO[scorerId] || 0) + 1;
        }
      }
      nt.caps = updatedCapsKO;
      nt.internationalGoals = updatedIntlGoalsKO;

      const playerEliminated = updatedPlayerTie.winnerId !== nationality;

      // Re-check if round is now complete
      const allRoundPlayed = finalTies.filter(t => t.round === tournament.currentRound).every(t => t.played);

      if (allRoundPlayed) {
        if (tournament.currentRound === 'F') {
          // Final played — tournament over
          const finalMatch = finalTies.find(t => t.round === 'F' && t.played);
          set({
            internationalTournament: {
              ...tournament, knockoutTies: finalTies, phase: 'complete',
              winner: finalMatch?.winnerId || null, playerEliminated,
              currentWeek: currentWeek + 1,
            },
            nationalTeam: nt, players: newPlayers,
          });
        } else {
          // Generate next round
          const roundWinners = finalTies.filter(t => t.round === tournament.currentRound).map(t => t.winnerId!).filter(Boolean);
          const roundOrder = ['R16', 'QF', 'SF', 'F'] as const;
          const curIdx = roundOrder.indexOf(tournament.currentRound as typeof roundOrder[number]);
          const nextRound = curIdx < roundOrder.length - 1 ? roundOrder[curIdx + 1] : null;
          const newKnockoutTies = [...finalTies];
          if (nextRound) {
            for (let i = 0; i < roundWinners.length; i += 2) {
              if (roundWinners[i + 1]) {
                newKnockoutTies.push({
                  id: `intl-ko-${Date.now()}-${i}`,
                  round: nextRound,
                  homeNation: roundWinners[i],
                  awayNation: roundWinners[i + 1],
                  played: false, homeGoals: 0, awayGoals: 0,
                  week: currentWeek + 1,
                });
              }
            }
          }
          set({
            internationalTournament: {
              ...tournament, knockoutTies: newKnockoutTies, currentRound: nextRound || tournament.currentRound,
              playerEliminated, currentWeek: currentWeek + 1,
            },
            nationalTeam: nt, players: newPlayers,
          });
        }
      } else {
        set({
          internationalTournament: { ...tournament, knockoutTies: finalTies, playerEliminated, currentWeek: currentWeek + 1 },
          nationalTeam: nt, players: newPlayers,
        });
      }
    } else if (roundComplete) {
      // All AI matches done, no player match
      const allTies = [...finalTies, ...nextRoundTies];
      if (tournamentComplete) {
        set({
          internationalTournament: { ...tournament, knockoutTies: allTies, phase: 'complete', winner, currentWeek: currentWeek + 1 },
        });
      } else {
        const nextRound = nextRoundTies.length > 0 ? nextRoundTies[0].round : tournament.currentRound;
        set({
          internationalTournament: { ...tournament, knockoutTies: allTies, currentRound: nextRound, currentWeek: currentWeek + 1 },
        });
      }
    } else {
      set({ internationalTournament: { ...tournament, knockoutTies: finalTies, currentWeek: currentWeek + 1 } });
    }

    return;
  }

  // Tournament complete — transition to endSeason
  if (tournament.phase === 'complete') {
    // Add tournament result message
    let newMessages = [...state.messages];
    if (tournament.winner) {
      const isWinner = tournament.winner === nationality;
      newMessages = addMsg(newMessages, {
        week: state.week, season: state.season, type: 'general',
        title: isWinner ? `${tournament.name} Champions!` : `${tournament.name} Complete`,
        body: isWinner
          ? `Congratulations! ${nationality} won the ${tournament.name}! What an achievement!`
          : `${tournament.winner} won the ${tournament.name}. ${state.nationalTeam?.results.length ? 'Your national team gave it their best.' : ''}`,
      });
    }

    // Career mode: apply international reputation rewards and sacking check
    let updatedCareerManager = state.careerManager;
    let clearNationalTeam = false;
    if (state.gameMode === 'career' && state.careerManager && state.nationalTeam) {
      const cm = { ...state.careerManager };
      const isWinner = tournament.winner === nationality;
      const reachedKnockout = tournament.knockoutTies.some(t => t.homeNation === nationality || t.awayNation === nationality);
      const reachedSF = tournament.knockoutTies.some(t => (t.homeNation === nationality || t.awayNation === nationality) && (t.round === 'SF' || t.round === 'F'));
      const reachedFinal = tournament.knockoutTies.some(t => (t.homeNation === nationality || t.awayNation === nationality) && t.round === 'F');

      // Apply reputation
      if (isWinner) cm.reputationScore += REP_INTL_TOURNAMENT_WIN;
      else if (reachedFinal) cm.reputationScore += REP_INTL_FINAL;
      else if (reachedSF) cm.reputationScore += REP_INTL_SEMI;
      else if (reachedKnockout) cm.reputationScore += REP_INTL_KNOCKOUT;
      else cm.reputationScore += REP_INTL_GROUP_EXIT;

      cm.reputationScore = Math.max(REP_MIN, Math.min(REP_MAX, cm.reputationScore));
      cm.reputationTier = calculateReputationTier(cm.reputationScore);

      // Sacking check: consecutive group stage exits
      if (!reachedKnockout && !isWinner) {
        // Count consecutive group exits from results history
        const results = state.nationalTeam.results;
        let consecutiveGroupExits = 1; // this tournament counts as one
        const tournamentSeasons = [...new Set(results.map(r => r.season))].sort((a, b) => b - a);
        for (const ts of tournamentSeasons) {
          if (ts === state.season) continue; // skip current (already counted)
          const tsResults = results.filter(r => r.season === ts);
          // If this tournament's results are all group stage (no knockout rounds)
          const hadKnockout = tsResults.some(r => r.round && (r.round.includes('16') || r.round.includes('Quarter') || r.round.includes('Semi') || r.round.includes('Final')));
          if (!hadKnockout && tsResults.length > 0) consecutiveGroupExits++;
          else break;
        }
        if (consecutiveGroupExits >= NT_SACK_GROUP_EXIT_THRESHOLD) {
          clearNationalTeam = true;
          cm.nationalTeamSacked = true;
          newMessages = addMsg(newMessages, {
            week: state.week, season: state.season, type: 'national_team',
            title: `Sacked as ${nationality} Manager`,
            body: `Following ${consecutiveGroupExits} consecutive group-stage exits, the ${nationality} FA has relieved you of your duties as national team manager.`,
          });
        }
      }

      updatedCareerManager = cm;
    }

    // Post-tournament fatigue: reduce fitness for players who participated
    const postTourneyPlayers = { ...state.players };
    if (state.nationalTeam?.squad) {
      const matchesPlayed = state.nationalTeam.results?.length || 0;
      const fatigueCost = matchesPlayed >= 3 ? POST_TOURNAMENT_FITNESS_COST_HIGH : matchesPlayed >= 1 ? POST_TOURNAMENT_FITNESS_COST_LOW : 0;
      if (fatigueCost > 0) {
        for (const pid of state.nationalTeam.squad) {
          if (postTourneyPlayers[pid]) {
            postTourneyPlayers[pid] = { ...postTourneyPlayers[pid], fitness: Math.max(30, postTourneyPlayers[pid].fitness - fatigueCost) };
          }
        }
      }
    }

    set({
      messages: newMessages,
      players: postTourneyPlayers,
      seasonPhase: 'regular',
      internationalTournament: null,
      ...(updatedCareerManager && { careerManager: updatedCareerManager }),
      ...(clearNationalTeam && { nationalTeam: null }),
    });
    endSeasonImpl(set, get);
  }
}

/**
 * Generate a League Cup (secondary domestic cup) draw.
 * Same structure as the main cup but scheduled on different weeks.
 */
function generateLeagueCupDraw(clubIds: string[]): import('@/types/game').LeagueCupState {
  const ties: import('@/types/game').CupTie[] = [];
  const shuffled = shuffle([...clubIds]);

  let startRound: import('@/types/game').CupRound = 'R1';
  if (shuffled.length <= 8) startRound = 'R3';
  else if (shuffled.length <= 16) startRound = 'R2';

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    ties.push({
      id: crypto.randomUUID(),
      round: startRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: LEAGUE_CUP_WEEKS[startRound],
    });
  }

  if (shuffled.length % 2 === 1) {
    ties.push({
      id: crypto.randomUUID(),
      round: startRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: CUP_BYE_MARKER,
      played: true,
      homeGoals: 1,
      awayGoals: 0,
      week: LEAGUE_CUP_WEEKS[startRound],
    });
  }

  return { ties, currentRound: startRound, eliminated: false, winner: null };
}

/**
 * Advance the League Cup to the next round (mirrors advanceCupRound but uses LEAGUE_CUP_WEEKS).
 */
/**
 * Build a descriptive label for a continental match (e.g. "Champions Cup — Group A MD3").
 */
function getContinentalMatchLabel(
  compName: string,
  matchInfo: { type: 'group'; groupIdx: number; matchIdx: number } | { type: 'knockout'; tieIdx: number; leg: 1 | 2 },
  tourney: import('@/types/game').ContinentalTournamentState,
): string {
  if (matchInfo.type === 'group') {
    return `${compName} — Group ${String.fromCharCode(65 + matchInfo.groupIdx)} MD${matchInfo.matchIdx + 1}`;
  }
  const tie = tourney.knockoutTies[matchInfo.tieIdx];
  const roundNames: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Final', SF: 'Semi-Final', F: 'Final' };
  const roundLabel = roundNames[tie.round] || tie.round;
  if (tie.round === 'F') return `${compName} — ${roundLabel}`;
  return `${compName} — ${roundLabel} Leg ${matchInfo.leg}`;
}

/**
 * Check if a continental knockout leg 2 aggregate is already decided (not tied).
 * Returns true if the aggregate is NOT tied (i.e., extra time is NOT needed).
 * For non-knockout, non-leg-2, or missing data, returns false (allow normal extra time logic).
 */
function isAggregateDecided(state: GameState, leg2HomeGoals: number, leg2AwayGoals: number): boolean {
  if (!state.currentContinentalMatchId || !state.currentContinentalCompetition) return false;
  const tourney = state.currentContinentalCompetition === 'champions_cup' ? state.championsCup : state.currentContinentalCompetition === 'shield_cup' ? state.shieldCup : state.conferenceCup;
  if (!tourney) return false;
  const matchInfo = findPlayerContinentalMatch(tourney, state.week, state.playerClubId);
  if (!matchInfo || matchInfo.type !== 'knockout' || matchInfo.leg !== 2) return false;
  const tie = tourney.knockoutTies[matchInfo.tieIdx];
  // Aggregate: tie.homeClubId's total = leg1Home + leg2Away, tie.awayClubId's total = leg1Away + leg2Home
  // In leg 2, home/away are swapped from the tie's perspective
  const homeAgg = tie.leg1HomeGoals + leg2AwayGoals;
  const awayAgg = tie.leg1AwayGoals + leg2HomeGoals;
  return homeAgg !== awayAgg;
}

/**
 * Process tournament match result: updates the correct tournament state and cleans up ephemeral players.
 * Returns state updates to spread into the set() call.
 */
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
  // Also clean ephemeral club from clubs
  const realClubs = { ...state.clubs };
  for (const cid of Object.keys(realClubs)) {
    if ((state.virtualClubs || {})[cid] && !state.fixtures.some(f => f.homeClubId === cid || f.awayClubId === cid)) {
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
          const cupWinnerId = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId;
          newCup.winner = cupWinnerId; newCup.currentRound = null;
          awardPrizeMoney(cupWinnerId === playerClubId ? CONTINENTAL_PRIZE_MONEY.dynasty_cup_winner : CONTINENTAL_PRIZE_MONEY.dynasty_cup_runner_up);
        }
      } else { Object.assign(newCup, advanceCupRound(newCup)); }
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
          Object.assign(newLC, advanceLeagueCupRound(newLC));
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
            const advanced = generateKnockoutFromGroups(newTourney, playerClubId);
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
                const advanced = advanceKnockoutRound(newTourney, playerClubId);
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

/** Variant of processTournamentResult for penalty shootout results — takes explicit winnerId */
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
  const realClubs = { ...state.clubs };
  for (const cid of Object.keys(realClubs)) {
    if ((state.virtualClubs || {})[cid] && !state.fixtures.some(f => f.homeClubId === cid || f.awayClubId === cid)) {
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
        } else { Object.assign(newLC, advanceLeagueCupRound(newLC)); }
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
    const prizeGroup = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_group : isShield ? CONTINENTAL_PRIZE_MONEY.shield_group : CONTINENTAL_PRIZE_MONEY.conference_group;
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
          else { Object.assign(newTourney, advanceKnockoutRound(newTourney, playerClubId)); }
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

function advanceLeagueCupRound(cup: import('@/types/game').LeagueCupState): import('@/types/game').LeagueCupState {
  const ROUND_ORDER: import('@/types/game').CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];
  const currentRound = cup.currentRound;
  if (!currentRound || currentRound === 'F') return cup;

  const roundIdx = ROUND_ORDER.indexOf(currentRound);
  const nextRound = ROUND_ORDER[roundIdx + 1];
  if (!nextRound) return cup;

  const currentTies = cup.ties.filter(t => t.round === currentRound && t.played);
  const winners = currentTies.map(t => {
    if (t.awayClubId === CUP_BYE_MARKER) return t.homeClubId;
    if (t.winnerId) return t.winnerId;
    return t.homeGoals > t.awayGoals ? t.homeClubId :
      t.awayGoals > t.homeGoals ? t.awayClubId :
      Math.random() < 0.5 ? t.homeClubId : t.awayClubId;
  });

  const shuffled = shuffle([...winners]);
  const newTies: import('@/types/game').CupTie[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    newTies.push({
      id: crypto.randomUUID(),
      round: nextRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: LEAGUE_CUP_WEEKS[nextRound],
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
      week: LEAGUE_CUP_WEEKS[nextRound],
    });
  }

  return { ...cup, ties: [...cup.ties, ...newTies], currentRound: nextRound };
}

/** endSeason implementation — extracted to keep the slice method thin. */
function endSeasonImpl(set: Set, get: Get) {
  const state = get();
  const { season, leagueTable, players, clubs, playerClubId, boardConfidence, messages } = state;
  const playerDiv = state.playerDivision;
  const league = LEAGUES.find(l => l.id === playerDiv);

  const playerEntry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = playerEntry ? leagueTable.indexOf(playerEntry) + 1 : 20;

  const allPlayersList = Object.values(players);
  const topScorer = allPlayersList.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const seasonAwards = calculateSeasonAwards(allPlayersList, clubs, leagueTable, playerClubId);

  // Ballon d'Or ranking — top 25 players of the season
  const ballonDOrRanking = calculateBallonDOr(allPlayersList, clubs, leagueTable, state.divisionTables || {}, state.championsCup, state.shieldCup, state.conferenceCup);

  // Apply Ballon d'Or value boosts and record placements on a shallow copy
  // (avoid mutating the store's `players` reference directly)
  const ballonDOrPlayers: Record<string, Player> = {};
  for (const entry of ballonDOrRanking) {
    const p = players[entry.playerId];
    if (!p) continue;
    const boost = getBallonDOrValueBoost(entry.rank);
    const placement = { season, rank: entry.rank, score: entry.score };
    const existing = p.ballonDOrPlacements || [];
    ballonDOrPlayers[entry.playerId] = {
      ...p,
      value: Math.round(p.value * (1 + boost)),
      ballonDOrPlacements: [...existing, placement],
    };
  }

  // Compute end-of-season squad average OVR for enrichment
  const endPlayers = allPlayersList.filter(p => p.clubId === playerClubId);
  const endAvgOVR = endPlayers.length > 0 ? Math.round(endPlayers.reduce((s, p) => s + p.overall, 0) / endPlayers.length) : 0;

  const pc = clubs[playerClubId];
  const expectedPos = getExpectedPosition(pc.reputation);
  let verdict: SeasonHistory['boardVerdict'] = 'acceptable';
  if (pos <= Math.max(1, expectedPos + VERDICT_EXCELLENT_OFFSET)) verdict = 'excellent';
  else if (pos <= expectedPos) verdict = 'good';
  else if (pos <= expectedPos + VERDICT_ACCEPTABLE_OFFSET) verdict = 'acceptable';
  else if (boardConfidence < BOARD_SACKING_THRESHOLD) verdict = 'sacked';
  else verdict = 'poor';

  const history: SeasonHistory = {
    season, position: pos, points: playerEntry?.points || 0,
    won: playerEntry?.won || 0, drawn: playerEntry?.drawn || 0, lost: playerEntry?.lost || 0,
    goalsFor: playerEntry?.goalsFor || 0, goalsAgainst: playerEntry?.goalsAgainst || 0,
    topScorer: topScorer ? { name: `${topScorer.firstName} ${topScorer.lastName}`, goals: topScorer.goals } : { name: 'N/A', goals: 0 },
    boardVerdict: verdict,
    cupResult: getCupResultForClub(state.cup, playerClubId),
    leagueCupResult: state.leagueCup?.winner ? (state.leagueCup.winner === playerClubId ? 'Winner' : getCupResultForClub(state.leagueCup, playerClubId)) : undefined,
    championsCupResult: getContinentalResultForClub(state.championsCup, playerClubId),
    shieldCupResult: getContinentalResultForClub(state.shieldCup, playerClubId),
    conferenceCupResult: getContinentalResultForClub(state.conferenceCup, playerClubId),
    divisionId: playerDiv,
    awards: seasonAwards,
    ballonDOrRanking,
    financialSummary: {
      totalIncome: state.seasonTotalIncome || 0,
      totalExpenses: state.seasonTotalExpenses || 0,
      netBalance: (state.seasonTotalIncome || 0) - (state.seasonTotalExpenses || 0),
    },
    transferActivity: {
      bought: state.seasonTransfersBought || [],
      sold: state.seasonTransfersSold || [],
    },
    squadStrengthDelta: {
      startAvgOVR: state.seasonStartAvgOVR || 0,
      endAvgOVR,
      delta: endAvgOVR - (state.seasonStartAvgOVR || 0),
    },
  };

  const topAssisterForRecords = allPlayersList.filter(p => p.clubId === playerClubId && p.assists > 0).sort((a, b) => b.assists - a.assists)[0];
  const topScorerForRecords = allPlayersList.filter(p => p.clubId === playerClubId && p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const biggestWin = findBiggestWin(state.fixtures, playerClubId);
  const cupsWonThisSeason =
    (state.cup.winner === playerClubId ? 1 : 0) +
    (state.leagueCup?.winner === playerClubId ? 1 : 0) +
    (state.championsCup?.winnerId === playerClubId ? 1 : 0) +
    (state.shieldCup?.winnerId === playerClubId ? 1 : 0) +
    (state.conferenceCup?.winnerId === playerClubId ? 1 : 0);
  const updatedRecords = updateRecords(
    state.clubRecords || createEmptyRecords(),
    season, pos, playerEntry?.points || 0,
    playerEntry?.goalsFor || 0, playerEntry?.goalsAgainst || 0,
    topScorerForRecords ? { name: `${topScorerForRecords.firstName} ${topScorerForRecords.lastName}`, goals: topScorerForRecords.goals } : null,
    topAssisterForRecords ? { name: `${topAssisterForRecords.firstName} ${topAssisterForRecords.lastName}`, assists: topAssisterForRecords.assists } : null,
    biggestWin,
    cupsWonThisSeason,
  );

  // Apply season turnover: replace bottom N clubs in the player's league
  // (but never replace the player's own club)
  const finalTable = buildLeagueTable(state.divisionFixtures[playerDiv] || [], state.divisionClubs[playerDiv] || []);
  const { turnover, updatedClubs: turnoverClubs, updatedLeagueClubs } = applySeasonTurnover(
    playerDiv,
    state.divisionClubs[playerDiv] || [],
    finalTable,
    clubs,
  );

  // Protect the player's club from being replaced
  if (turnover.replacedClubs.includes(playerClubId)) {
    turnover.replacedClubs = turnover.replacedClubs.filter(id => id !== playerClubId);
  }

  // Remove replaced clubs' players and generate replacement clubs
  const workingClubs = { ...turnoverClubs };
  // Re-add the player's club if it was removed by turnover
  if (!workingClubs[playerClubId] && clubs[playerClubId]) {
    workingClubs[playerClubId] = clubs[playerClubId];
  }
  const workingPlayers = { ...players, ...ballonDOrPlayers };
  // Clean up players from replaced clubs (prefer working copy for freshest playerIds)
  for (const replacedId of turnover.replacedClubs) {
    const rClub = workingClubs[replacedId] || clubs[replacedId];
    if (rClub) {
      rClub.playerIds.forEach(pid => { delete workingPlayers[pid]; });
    }
  }
  // Generate replacement clubs with squads
  const qualityTier = league?.qualityTier || 2;
  const newLeagueClubs = [...updatedLeagueClubs];
  // Ensure the player's club is in the league even if turnover removed it
  if (!newLeagueClubs.includes(playerClubId)) {
    newLeagueClubs.push(playerClubId);
  }
  for (let i = 0; i < turnover.replacedClubs.length; i++) {
    const { clubData, clubId } = generateReplacementClub(season, playerDiv);
    const newClub: Club = {
      id: clubId, name: clubData.name, shortName: clubData.shortName,
      color: clubData.color, secondaryColor: clubData.secondaryColor,
      budget: clubData.budget, wageBill: 0, reputation: clubData.reputation,
      facilities: clubData.facilities, youthRating: clubData.youthRating,
      fanBase: clubData.fanBase, boardPatience: clubData.boardPatience,
      playerIds: [], formation: '4-4-2', lineup: [], subs: [],
      divisionId: playerDiv,
    };
    const squad = generateSquad(clubId, clubData.squadQuality, season, qualityTier);
    let totalWages = 0;
    squad.forEach(p => { workingPlayers[p.id] = p; newClub.playerIds.push(p.id); totalWages += p.wage; });
    newClub.wageBill = totalWages;
    const { lineup, subs } = selectBestLineup(squad, '4-4-2');
    newClub.lineup = lineup.map(p => p.id);
    newClub.subs = subs.map(p => p.id);
    newClub.aiManagerProfile = generateAIManagerProfile(clubId, clubData.reputation);
    workingClubs[clubId] = newClub;
    newLeagueClubs.push(clubId);
    turnover.newClubs.push(clubId);
  }

  // Check if player's club was replaced (bottom of table)
  const wasReplaced = turnover.replacedClubs.includes(playerClubId);
  history.replaced = wasReplaced;

  let newMessages = [...messages];
  const newDivisionClubs = { ...state.divisionClubs, [playerDiv]: newLeagueClubs };

  if (turnover.replacedClubs.length > 0) {
    const replacedNames = turnover.replacedClubs.map(id => clubs[id]?.name || id).join(', ');
    const newNames = turnover.newClubs.map(id => workingClubs[id]?.name || id).join(', ');
    if (replacedNames && newNames) {
      newMessages = addMsg(newMessages, { week: state.week, season, type: 'general', title: 'League Turnover', body: `${replacedNames} departed the league. Newcomers: ${newNames}.` });
    }
  }

  // Announce Ballon d'Or winner via inbox message
  if (ballonDOrRanking.length > 0) {
    const bdWinner = ballonDOrRanking[0];
    const yourRanked = ballonDOrRanking.filter(e => e.clubName === clubs[playerClubId]?.shortName);
    const yourNote = yourRanked.length > 0
      ? ` ${yourRanked.length} of your player${yourRanked.length > 1 ? 's' : ''} made the Top 25.`
      : '';
    newMessages = addMsg(newMessages, {
      week: state.week, season, type: 'general',
      title: "Ballon d'Or Announced",
      body: `${bdWinner.playerName} (${bdWinner.clubName}) has won the Ballon d'Or with a score of ${bdWinner.score.toFixed(1)}.${yourNote}`,
    });
  }

  finalizeSeason(set, get, history, updatedRecords, workingClubs, workingPlayers, turnover, newDivisionClubs, playerDiv, newMessages);
}

/** Standard season-end processing: aging, contracts, squad regen, fixtures, etc. */
function finalizeSeason(
  set: Set, get: Get,
  history: SeasonHistory,
  updatedRecords: ReturnType<typeof createEmptyRecords>,
  inputClubs: Record<string, Club>,
  inputPlayers: Record<string, Player>,
  turnover: SeasonTurnover,
  newDivisionClubs: Record<string, string[]>,
  newPlayerDivision: LeagueId,
  inputMessages: GameState['messages'],
) {
  const state = get();
  const { season, playerClubId } = state;
  const newSeason = season + 1;
  resetSeasonGrowth();

  if (state.activeLoans.length > 0) get().processLoanReturns();
  // Loan cleanup is folded into the main season turnover set() below to avoid an extra re-render

  // Merge loan-return club updates (playerIds, wageBills) into inputClubs
  const postLoanClubs = get().clubs;
  const newPlayers: Record<string, Player> = {};
  const newClubs = { ...inputClubs };
  for (const clubId of Object.keys(newClubs)) {
    if (postLoanClubs[clubId]) {
      newClubs[clubId] = { ...newClubs[clubId], playerIds: postLoanClubs[clubId].playerIds, wageBill: postLoanClubs[clubId].wageBill };
    }
  }
  // Merge loan-return player updates (clubId for obligatory buys) into inputPlayers
  const postLoanPlayers = get().players;
  const mergedPlayers = { ...inputPlayers };
  for (const pid of Object.keys(mergedPlayers)) {
    if (postLoanPlayers[pid]) {
      mergedPlayers[pid] = { ...mergedPlayers[pid], clubId: postLoanPlayers[pid].clubId };
    }
  }
  // Also include players that exist in postLoanPlayers but not inputPlayers
  // (e.g., players added to the store by external transfers during the season)
  for (const pid of Object.keys(postLoanPlayers)) {
    if (!mergedPlayers[pid] && postLoanPlayers[pid]) {
      mergedPlayers[pid] = postLoanPlayers[pid];
    }
  }

  const freeAgentIds: string[] = [];
  const farewells: { playerId: string; playerName: string; seasonsServed: number; stats: { label: string; value: string }[] }[] = [];

  Object.values(mergedPlayers).forEach(p => {
    const aged = {
      ...p, age: p.age + 1,
      // Accumulate career stats before resetting season stats
      careerGoals: (p.careerGoals || 0) + p.goals,
      careerAssists: (p.careerAssists || 0) + p.assists,
      careerAppearances: (p.careerAppearances || 0) + p.appearances,
      goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
      seasonRatingTotal: 0, seasonRatedMatches: 0,
      suspendedUntilWeek: undefined, growthDelta: 0, lastAttributeChanges: undefined, lastTrainingGains: undefined, onLoan: false,
      loanFromClubId: undefined, loanToClubId: undefined, lowMoraleWeeks: 0, wantsToLeave: false, transferCooldownUntilWeek: undefined, lastTransferTalkWeek: undefined,
      listedForSale: false,
    };
    if (aged.contractEnd <= season) {
      const club = newClubs[aged.clubId];
      if (club) {
        const updatedClub = { ...club };
        updatedClub.playerIds = updatedClub.playerIds.filter(id => id !== aged.id);
        updatedClub.lineup = updatedClub.lineup.filter(id => id !== aged.id);
        updatedClub.subs = updatedClub.subs.filter(id => id !== aged.id);
        updatedClub.wageBill = Math.max(0, updatedClub.wageBill - aged.wage);
        newClubs[updatedClub.id] = updatedClub;
        // Track farewells for departing players from user's club
        if (p.clubId === playerClubId) {
          const farewell = getFarewellSummary(p, season, p.joinedSeason);
          if (farewell.shouldShow) {
            farewells.push({ playerId: p.id, playerName: `${p.firstName} ${p.lastName}`, seasonsServed: farewell.seasonsServed, stats: farewell.stats });
          }
        }
      }
      // Route to free agent pool — evict weakest if full to preserve higher-quality players
      if (aged.age <= 34 && aged.overall >= 55) {
        aged.clubId = '';
        aged.listedForSale = false;
        aged.wage = Math.round(aged.wage * 0.8); // Free agents accept lower wages
        if (freeAgentIds.length >= FREE_AGENT_POOL_MAX) {
          // Find the weakest free agent and replace if this player is better
          let weakestIdx = 0;
          let weakestOvr = Infinity;
          for (let i = 0; i < freeAgentIds.length; i++) {
            const fa = newPlayers[freeAgentIds[i]];
            if (fa && fa.overall < weakestOvr) { weakestOvr = fa.overall; weakestIdx = i; }
          }
          if (aged.overall >= weakestOvr) {
            delete newPlayers[freeAgentIds[weakestIdx]];
            freeAgentIds[weakestIdx] = aged.id;
            newPlayers[aged.id] = aged;
          }
          // If not better than anyone in pool, player is simply released (not tracked)
        } else {
          newPlayers[aged.id] = aged;
          freeAgentIds.push(aged.id);
        }
      }
      return;
    }
    newPlayers[aged.id] = aged;
  });

  // Fill squad gaps
  const TARGET_TEMPLATE: Record<string, number> = {
    'GK': 2, 'CB': 5, 'LB': 2, 'RB': 2, 'CDM': 1, 'CM': 5, 'CAM': 1, 'LW': 2, 'RW': 2, 'ST': 3,
  };
  Object.values(newClubs).forEach(club => {
    // Clean up stale playerIds, lineup, and subs — remove any IDs that no longer exist in newPlayers
    const updatedClub = { ...newClubs[club.id] };
    updatedClub.playerIds = updatedClub.playerIds.filter(id => newPlayers[id]);
    updatedClub.lineup = updatedClub.lineup.filter(id => newPlayers[id] && updatedClub.playerIds.includes(id));
    updatedClub.subs = updatedClub.subs.filter(id => newPlayers[id] && updatedClub.playerIds.includes(id));
    newClubs[club.id] = updatedClub;

    const currentSquadIds = updatedClub.playerIds;
    const currentSquad = currentSquadIds.map(id => newPlayers[id]).filter(Boolean);
    const posCounts: Record<string, number> = {};
    currentSquad.forEach(p => { posCounts[p.position] = (posCounts[p.position] || 0) + 1; });
    const gaps: { pos: Position; deficit: number }[] = [];
    for (const [pos, target] of Object.entries(TARGET_TEMPLATE)) {
      const deficit = target - (posCounts[pos] || 0);
      if (deficit > 0) for (let i = 0; i < deficit; i++) gaps.push({ pos: pos as Position, deficit });
    }
    gaps.sort((a, b) => b.deficit - a.deficit);
    const totalNeeded = Math.max(0, MIN_SQUAD_SIZE - currentSquadIds.length);
    const toFill = gaps.length > 0 ? gaps : [];
    while (toFill.length < totalNeeded) toFill.push({ pos: pick(GENERIC_FILL_POSITIONS), deficit: 0 });
    for (const { pos: fillPos } of toFill) {
      const currentClub = newClubs[club.id];
      if (currentClub.playerIds.length >= MAX_SQUAD_SIZE) break;
      const repQuality = (club.reputation * REPLACEMENT_QUALITY_REP_MULTIPLIER) + REPLACEMENT_QUALITY_BASE + Math.floor(Math.random() * REPLACEMENT_QUALITY_VARIANCE);
      const clubSquad = currentClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
      const avgOvr = clubSquad.length > 0 ? clubSquad.reduce((s, p) => s + p.overall, 0) / clubSquad.length : repQuality;
      const quality = Math.round(repQuality * 0.4 + avgOvr * 0.6);
      const newP = generatePlayer(fillPos, quality, club.id, newSeason, club.divisionId);
      newPlayers[newP.id] = newP;
      const fillClub = { ...currentClub };
      fillClub.playerIds = [...fillClub.playerIds, newP.id];
      fillClub.wageBill += newP.wage;
      newClubs[club.id] = fillClub;
    }
  });

  Object.values(newClubs).forEach(club => {
    const squad = club.playerIds.map(id => newPlayers[id]).filter(Boolean);
    const { lineup, subs } = selectBestLineup(squad, club.formation);
    const updatedClub = { ...newClubs[club.id] };
    updatedClub.lineup = lineup.map(p => p.id);
    updatedClub.subs = subs.map(p => p.id);
    newClubs[club.id] = updatedClub;
  });

  // Safety net: ensure every club has at least 11 valid players after gap-fill
  Object.values(newClubs).forEach(club => {
    const validIds = club.playerIds.filter(id => newPlayers[id]);
    if (validIds.length < 11) {
      const deficitCount = 11 - validIds.length;
      const safeClub = { ...newClubs[club.id], playerIds: [...validIds] };
      for (let d = 0; d < deficitCount; d++) {
        if (safeClub.playerIds.length >= MAX_SQUAD_SIZE) break;
        const emergencySquad = safeClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
        const emergencyAvgOvr = emergencySquad.length > 0 ? emergencySquad.reduce((s, p) => s + p.overall, 0) / emergencySquad.length : 50;
        const emergencyQuality = Math.round(Math.max(35, (club.reputation * 10) + 20) * 0.4 + emergencyAvgOvr * 0.6);
        const emergencyPlayer = generatePlayer(pick(GENERIC_FILL_POSITIONS), emergencyQuality, club.id, newSeason, club.divisionId);
        newPlayers[emergencyPlayer.id] = emergencyPlayer;
        safeClub.playerIds.push(emergencyPlayer.id);
        safeClub.wageBill += emergencyPlayer.wage;
      }
      // Re-select lineup for the patched squad
      const patchedSquad = safeClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
      const { lineup, subs } = selectBestLineup(patchedSquad, safeClub.formation);
      safeClub.lineup = lineup.map(p => p.id);
      safeClub.subs = subs.map(p => p.id);
      newClubs[club.id] = safeClub;
    }
  });

  // Recalculate wageBill from actual player wages to fix accumulated rounding errors
  // (loan splits use Math.round which can drift over multiple seasons)
  for (const club of Object.values(newClubs)) {
    const recalcWages = club.playerIds.reduce((sum, pid) => sum + (newPlayers[pid]?.wage || 0), 0);
    if (recalcWages !== club.wageBill) {
      newClubs[club.id] = { ...newClubs[club.id], wageBill: recalcWages };
    }
  }

  // Prune orphaned players: remove players not in any club, not free agents,
  // and not in the national team pool
  const activePlayerIds = new Set<string>();
  for (const club of Object.values(newClubs)) {
    for (const pid of club.playerIds) activePlayerIds.add(pid);
  }
  for (const pid of freeAgentIds) activePlayerIds.add(pid);
  const currentNT = state.nationalTeam;
  const ntPoolIds = new Set(currentNT?.poolPlayerIds || []);
  for (const pid of (currentNT?.squad || [])) ntPoolIds.add(pid);
  for (const pid of Object.keys(newPlayers)) {
    if (!activePlayerIds.has(pid) && !ntPoolIds.has(pid)) {
      delete newPlayers[pid];
    }
  }

  // Clean up aged-out national team pool players (36+) and update poolPlayerIds
  let updatedNTPoolIds = currentNT?.poolPlayerIds || [];
  const retiredNTPlayers: string[] = [];
  if (currentNT && updatedNTPoolIds.length > 0) {
    updatedNTPoolIds = updatedNTPoolIds.filter(pid => {
      const p = newPlayers[pid];
      if (p && p.age > 35) {
        retiredNTPlayers.push(`${p.firstName} ${p.lastName} (${p.age})`);
        return false;
      }
      return p != null;
    });
    if (retiredNTPlayers.length > 0) {
      newMessages = addMsg(newMessages, {
        week: 1, season, type: 'national_team',
        title: 'International Retirements',
        body: `${retiredNTPlayers.length} player${retiredNTPlayers.length > 1 ? 's have' : ' has'} retired from international duty: ${retiredNTPlayers.join(', ')}.`,
      });
    }
  }

  // ── Position-based season rewards: budget bonuses scaled by league prize money ──
  // Higher league position → bigger share of prize pool → more transfer budget next season
  for (const [leagueId, clubIds] of Object.entries(newDivisionClubs)) {
    const lg = LEAGUES.find(l => l.id === leagueId);
    if (!lg || !lg.prizeMoney) continue;
    const table = buildLeagueTable(state.divisionFixtures[leagueId] || [], clubIds);
    const totalClubs = table.length;
    if (totalClubs === 0) continue;
    for (let i = 0; i < table.length; i++) {
      const clubId = table[i].clubId;
      const club = newClubs[clubId];
      if (!club) continue;
      // Winner gets ~30% of prize pool, last place gets ~2%
      const positionRatio = 1 - (i / (totalClubs - 1));
      const share = 0.02 + positionRatio * 0.28; // 2% to 30%
      const bonus = Math.round(lg.prizeMoney * share);
      // Also add a small reputation boost for top half, decline for bottom
      const repDelta = i < totalClubs / 4 ? 1 : i >= totalClubs * 3 / 4 ? -1 : 0;
      newClubs[clubId] = {
        ...club,
        budget: club.budget + bonus,
        reputation: Math.max(1, Math.min(5, club.reputation + repDelta)),
      };
    }
  }

  const leagueClubIds = newDivisionClubs[newPlayerDivision] || [];
  const leagueInfo = LEAGUES.find(l => l.id === newPlayerDivision);
  const leagueTotalWeeks = leagueInfo?.totalWeeks || TOTAL_WEEKS;
  const newDivisionFixtures: Record<string, Match[]> = { [newPlayerDivision]: generateDivisionFixtures(leagueClubIds, leagueTotalWeeks) };

  // Regenerate fixtures for all initialized non-player leagues
  for (const [leagueId, clubIds] of Object.entries(newDivisionClubs)) {
    if (leagueId === newPlayerDivision) continue;
    const otherLeague = LEAGUES.find(l => l.id === leagueId);
    newDivisionFixtures[leagueId] = generateDivisionFixtures(clubIds, otherLeague?.totalWeeks || TOTAL_WEEKS);
  }

  const newDivisionTables: Record<string, LeagueTableEntry[]> = buildAllDivisionTables(newDivisionFixtures, newDivisionClubs);
  const newFixtures = newDivisionFixtures[newPlayerDivision];
  const newLeagueTable = newDivisionTables[newPlayerDivision];
  const newCup = generateCupDraw(leagueClubIds);
  const newLeagueCup = generateLeagueCupDraw(leagueClubIds);
  const newFriendlies = generateFriendlies(state.playerClubId, leagueClubIds);

  // Generate continental tournaments based on previous season's league table
  const prevLeagueTable = state.leagueTable;
  const playerClubMap: Record<string, { name: string; shortName: string; color: string; reputation: number }> = {};
  for (const [id, club] of Object.entries(state.clubs)) {
    playerClubMap[id] = { name: club.name, shortName: club.shortName, color: club.color, reputation: club.reputation };
  }

  // Update continental coefficients from completed tournaments
  let updatedCoefficients = state.continentalCoefficients || {};
  if (state.championsCup) {
    updatedCoefficients = updateCoefficients(updatedCoefficients, state.championsCup, season);
  }
  if (state.shieldCup) {
    updatedCoefficients = updateCoefficients(updatedCoefficients, state.shieldCup, season);
  }
  if (state.conferenceCup) {
    updatedCoefficients = updateCoefficients(updatedCoefficients, state.conferenceCup, season);
  }

  // Cup winner pathways: Shield Cup winner → CL spot, Conference Cup winner → Shield spot
  const prevShieldCupWinner = state.shieldCup?.winnerId || null;
  const prevConferenceCupWinner = state.conferenceCup?.winnerId || null;

  // Rank-based qualification using coefficients
  const champQ = getChampionsCupQualifiers(newPlayerDivision, prevLeagueTable, playerClubMap, updatedCoefficients, prevShieldCupWinner);
  const champIds = new Set(champQ.qualifiers);
  const shieldQ = getShieldCupQualifiers(newPlayerDivision, prevLeagueTable, playerClubMap, champIds, updatedCoefficients, prevConferenceCupWinner);
  const shieldIds = new Set(shieldQ.qualifiers);
  const confQ = getConferenceCupQualifiers(newPlayerDivision, prevLeagueTable, playerClubMap, champIds, shieldIds, updatedCoefficients, state.cup.winner);

  const allVirtualClubs = { ...champQ.virtualClubs, ...shieldQ.virtualClubs, ...confQ.virtualClubs };

  let newChampionsCup: import('@/types/game').ContinentalTournamentState | null = null;
  let newShieldCup: import('@/types/game').ContinentalTournamentState | null = null;
  let newConferenceCup: import('@/types/game').ContinentalTournamentState | null = null;

  if (champQ.qualifiers.length >= 8) {
    newChampionsCup = generateContinentalDraw('champions_cup', newSeason, champQ.qualifiers, allVirtualClubs, playerClubId, updatedCoefficients);
  }
  if (shieldQ.qualifiers.length >= 8) {
    newShieldCup = generateContinentalDraw('shield_cup', newSeason, shieldQ.qualifiers, allVirtualClubs, playerClubId, updatedCoefficients);
  }
  if (confQ.qualifiers.length >= 8) {
    newConferenceCup = generateContinentalDraw('conference_cup', newSeason, confQ.qualifiers, allVirtualClubs, playerClubId, updatedCoefficients);
  }

  // Domestic Super Cup: last season's league winner vs cup winner
  let newDomesticSuperCup: import('@/types/game').SuperCupMatch | null = null;
  const lastLeagueWinner = prevLeagueTable[0]?.clubId;
  const lastCupWinner = state.cup.winner;
  if (lastLeagueWinner && lastCupWinner) {
    const homeId = lastLeagueWinner;
    const awayId = lastCupWinner === lastLeagueWinner
      ? (prevLeagueTable[1]?.clubId || lastCupWinner)
      : lastCupWinner;
    if (homeId !== awayId) {
      newDomesticSuperCup = {
        type: 'domestic', homeClubId: homeId, awayClubId: awayId,
        played: false, homeGoals: 0, awayGoals: 0,
        week: DOMESTIC_SUPER_CUP_WEEK, winnerId: null,
      };
    }
  }

  // Continental Super Cup: previous season's Champions Cup winner vs Shield Cup winner
  let newContinentalSuperCup: import('@/types/game').SuperCupMatch | null = null;
  const prevChampWinner = state.championsCup?.winnerId;
  const prevShieldWinner = state.shieldCup?.winnerId;
  if (prevChampWinner && prevShieldWinner && prevChampWinner !== prevShieldWinner) {
    // Only generate if the player is involved in one of the sides
    const playerInvolved = prevChampWinner === playerClubId || prevShieldWinner === playerClubId;
    if (playerInvolved) {
      newContinentalSuperCup = {
        type: 'continental', homeClubId: prevChampWinner, awayClubId: prevShieldWinner,
        played: false, homeGoals: 0, awayGoals: 0,
        week: CONTINENTAL_SUPER_CUP_WEEK, winnerId: null,
      };
    }
  }

  // Continental messages
  const champQualified = newChampionsCup && !newChampionsCup.playerEliminated;
  const shieldQualified = newShieldCup && !newShieldCup.playerEliminated;
  const confQualified = newConferenceCup && !newConferenceCup.playerEliminated;

  // Clean up old external players (unattached players not in any club or free agent pool)
  const oldFreeAgentSet = new Set(state.freeAgents);
  for (const [pid, p] of Object.entries(newPlayers)) {
    if (p.clubId === '' && !oldFreeAgentSet.has(pid)) {
      delete newPlayers[pid];
    }
  }

  const transferMarket: TransferListing[] = [];
  // Seed market with bench players from all clubs
  Object.values(newClubs).forEach(c => {
    const clubPlayers = c.playerIds.map(id => newPlayers[id]).filter(Boolean);
    const benched = clubPlayers.filter(p => !c.lineup.includes(p.id));
    if (benched.length > 2) {
      const listed = shuffle(benched).slice(0, INITIAL_LISTINGS_MIN + Math.floor(Math.random() * INITIAL_LISTINGS_RANGE));
      listed.forEach(p => {
        transferMarket.push({ playerId: p.id, askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)), sellerClubId: c.id, listedWeek: 1, listedSeason: newSeason, divisionId: c.divisionId });
      });
    }
  });
  // Generate external market players for all divisions (new season market refresh)
  const seasonMarket = generateInitialMarket(newSeason, 1);
  Object.assign(newPlayers, seasonMarket.players);
  transferMarket.push(...seasonMarket.listings);

  // Pre-season bonus: flood market with extra higher-quality players during friendlies
  const preSeasonMarket = generatePreSeasonMarket(newSeason, 1);
  Object.assign(newPlayers, preSeasonMarket.players);
  transferMarket.push(...preSeasonMarket.listings);

  // Board objective end-of-season rewards
  let objectiveXP = 0;
  let objectiveBudgetBoost = 0;
  let objectiveConfidenceBonus = 0;
  for (const obj of state.boardObjectives) {
    if (obj.completed) {
      objectiveXP += obj.overachieved ? (obj.xpRewardOverachieve ?? obj.xpReward ?? 0) : (obj.xpReward ?? 0);
      if (obj.overachieved && obj.budgetBoost) objectiveBudgetBoost += obj.budgetBoost;
    }
  }
  const allObjCompleted = state.boardObjectives.length > 0 && state.boardObjectives.every(o => o.completed);
  if (allObjCompleted) {
    objectiveXP += BOARD_OBJ_ALL_COMPLETE_XP;
    objectiveConfidenceBonus += BOARD_OBJ_ALL_COMPLETE_CONFIDENCE;
  }
  // Apply budget boost to the club entering the new season
  if (objectiveBudgetBoost > 0 && newClubs[playerClubId]) {
    newClubs[playerClubId] = { ...newClubs[playerClubId], budget: newClubs[playerClubId].budget + objectiveBudgetBoost };
  }
  // War Chest prestige perk: +15% starting budget each season
  if (hasPerk(state.managerProgression, 'war_chest') && newClubs[playerClubId]) {
    newClubs[playerClubId] = { ...newClubs[playerClubId], budget: Math.round(newClubs[playerClubId].budget * 1.15) };
  }

  const playerClubForObjectives = newClubs[playerClubId];
  const objectives = playerClubForObjectives ? generateObjectives(playerClubForObjectives, newPlayerDivision) : [];
  const verdict = history.boardVerdict;
  const baseConfidence = SEASON_END_CONFIDENCE[verdict] || CONFIDENCE_MIN;
  const newConfidence = Math.min(100, baseConfidence + objectiveConfidenceBonus);

  let newMessages = addMsg(inputMessages, {
    week: 1, season: newSeason, type: 'board',
    title: `Season ${newSeason} Begins`,
    body: verdict === 'sacked'
      ? `Despite last season's poor results, the board has given you one last chance. Don't waste it.`
      : `Welcome to Season ${newSeason}. Your board confidence stands at ${newConfidence}%. Good luck!`,
  });

  newMessages = addMsg(newMessages, {
    week: 1, season: newSeason, type: 'transfer',
    title: 'Pre-Season Market Surge',
    body: 'The summer window is buzzing! Clubs are reshaping their squads during pre-season. Expect more transfer activity and higher-quality players before league fixtures resume.',
  });

  // Continental qualification messages
  if (champQualified) {
    newMessages = addMsg(newMessages, {
      week: 1, season: newSeason, type: 'board',
      title: 'Champions Cup Qualification!',
      body: `Your club has qualified for the Champions Cup! Group stage begins in Week 6.`,
    });
  }
  if (shieldQualified) {
    newMessages = addMsg(newMessages, {
      week: 1, season: newSeason, type: 'board',
      title: 'Shield Cup Qualification!',
      body: `Your club has qualified for the Shield Cup! Group stage begins in Week 6.`,
    });
  }
  if (confQualified) {
    newMessages = addMsg(newMessages, {
      week: 1, season: newSeason, type: 'board',
      title: 'Conference Cup Qualification!',
      body: `Your club has qualified for the Conference Cup! Group stage begins in Week 6.`,
    });
  }
  if (newDomesticSuperCup) {
    const isPlayer = newDomesticSuperCup.homeClubId === playerClubId || newDomesticSuperCup.awayClubId === playerClubId;
    if (isPlayer) {
      newMessages = addMsg(newMessages, {
        week: 1, season: newSeason, type: 'match_result',
        title: 'Super Cup',
        body: `The season opens with the Super Cup in Week 1!`,
      });
    }
  }

  const youthCoachQ = getStaffBonus(state.staff.members, 'youth-coach');
  const pcForYouth = newClubs[playerClubId];
  const youthSquad = pcForYouth.playerIds.map(id => newPlayers[id]).filter(Boolean);
  const youthSquadQuality = youthSquad.length > 0 ? youthSquad.reduce((s, p) => s + p.overall, 0) / youthSquad.length : undefined;
  const { prospects: newYouthProspects, players: youthPlayers } = generateYouthProspects(
    playerClubId, pcForYouth.youthRating, youthCoachQ, newSeason, SEASON_YOUTH_INTAKE_MIN + Math.floor(Math.random() * SEASON_YOUTH_INTAKE_RANGE), youthSquadQuality
  );
  // Wonder Coach perk: +5 potential on all youth intake
  if (hasPerk(state.managerProgression, 'wonder_coach') && youthPlayers.length > 0) {
    for (let i = 0; i < youthPlayers.length; i++) {
      youthPlayers[i] = { ...youthPlayers[i], potential: Math.min(99, youthPlayers[i].potential + 5) };
    }
  }
  // Golden Generation perk: guarantee at least one high-potential youth
  if (hasPerk(state.managerProgression, 'golden_generation') && youthPlayers.length > 0) {
    const hasHighPotential = youthPlayers.some(p => p.potential >= GOLDEN_GEN_MIN_POTENTIAL);
    if (!hasHighPotential) {
      const luckyIdx = Math.floor(Math.random() * youthPlayers.length);
      youthPlayers[luckyIdx] = { ...youthPlayers[luckyIdx], potential: GOLDEN_GEN_MIN_POTENTIAL + Math.floor(Math.random() * 10) };
    }
  }
  youthPlayers.forEach(p => { newPlayers[p.id] = p; });
  // Prodigy Factory prestige perk: 2 extra youth prospects
  if (hasPerk(state.managerProgression, 'prodigy_factory')) {
    const { prospects: bonusProspects, players: bonusPlayers } = generateYouthProspects(
      playerClubId, pcForYouth.youthRating, youthCoachQ, newSeason, 2, youthSquadQuality
    );
    newYouthProspects.push(...bonusProspects);
    youthPlayers.push(...bonusPlayers);
  }

  const newIntakePreview = generateIntakePreview(pcForYouth.youthRating);

  newMessages = addMsg(newMessages, {
    week: 1, season: newSeason, type: 'general',
    title: 'Youth Intake',
    body: `${newYouthProspects.length} new youth prospects have joined your academy. Check the Youth Academy tab.`,
  });

  const newAvailableHires = generateStaffMarket();

  let endChallenge = state.activeChallenge;
  if (endChallenge && !endChallenge.completed && !endChallenge.failed) {
    const cupWon = state.cup.winner === playerClubId;
    const myEntry = state.leagueTable.find(e => e.clubId === playerClubId);
    const hasLost = myEntry ? myEntry.lost > 0 : false;
    if (checkChallengeComplete(endChallenge.scenarioId, history.position, cupWon, [...state.seasonHistory, history], hasLost)) {
      endChallenge = { ...endChallenge, completed: true };
      const scenario = CHALLENGES.find(c => c.id === endChallenge!.scenarioId);
      newMessages = addMsg(newMessages, { week: 1, season: newSeason, type: 'board', title: 'Challenge Complete!', body: `Congratulations! You completed the "${scenario?.name}" challenge! ${scenario?.icon || ''}` });
    } else {
      endChallenge = { ...endChallenge, seasonsRemaining: endChallenge.seasonsRemaining - 1 };
      if (endChallenge.seasonsRemaining <= 0) {
        endChallenge = { ...endChallenge, failed: true };
        const scenario = CHALLENGES.find(c => c.id === endChallenge!.scenarioId);
        newMessages = addMsg(newMessages, { week: 1, season: newSeason, type: 'board', title: 'Challenge Failed', body: `You ran out of time to complete the "${scenario?.name}" challenge.` });
      }
    }
  }

  // Process sponsor season-end: evaluate bonuses, expire deals
  const sponsorSeasonEnd = processSponsorSeasonEnd(state);
  if (sponsorSeasonEnd.clubs) {
    for (const [id, sponsorClub] of Object.entries(sponsorSeasonEnd.clubs)) {
      // Only merge budget changes from sponsors — don't overwrite the entire club (which would revert gap-fill)
      if (newClubs[id]) {
        newClubs[id] = { ...newClubs[id], budget: sponsorClub.budget };
      }
    }
  }
  if (sponsorSeasonEnd.messages) newMessages = sponsorSeasonEnd.messages;

  // Final cleanup: ensure all club playerIds, lineups, and subs reference existing players
  for (const club of Object.values(newClubs)) {
    const cleanClub = { ...newClubs[club.id] };
    cleanClub.playerIds = cleanClub.playerIds.filter(id => newPlayers[id]);
    cleanClub.lineup = cleanClub.lineup.filter(id => newPlayers[id] && cleanClub.playerIds.includes(id));
    cleanClub.subs = cleanClub.subs.filter(id => newPlayers[id] && cleanClub.playerIds.includes(id));
    newClubs[club.id] = cleanClub;
  }

  set({
    season: newSeason, week: 1, totalWeeks: TOTAL_WEEKS, transferWindowOpen: true,
    seasonPhase: 'regular',
    clubs: newClubs, players: newPlayers, fixtures: newFixtures, leagueTable: newLeagueTable,
    divisionFixtures: newDivisionFixtures, divisionTables: newDivisionTables,
    divisionClubs: newDivisionClubs,
    playerDivision: newPlayerDivision,
    transferMarket, boardObjectives: objectives, boardConfidence: newConfidence,
    seasonHistory: [...state.seasonHistory, history],
    currentMatchResult: null, currentScreen: 'season-summary',
    matchPhase: 'none' as const, matchTeamTalk: 'none', pendingPressConference: null,
    messages: newMessages, incomingOffers: [], matchSubsUsed: 0, galacticoUsedThisSeason: false, invincibleUsedThisSeason: false, preMatchSnapshot: null, shortlist: [], scoutWatchList: [],
    sponsorDeals: sponsorSeasonEnd.sponsorDeals || state.sponsorDeals,
    sponsorOffers: [],
    sponsorSlotCooldowns: {},
    negotiationStrikes: {},
    merchandise: {
      ...state.merchandise,
      lastSeasonRevenue: state.merchandise.currentSeasonRevenue,
      currentSeasonRevenue: 0,
      activeCampaign: null,
      campaignCooldownWeeks: 0,
      kitLaunchUsedThisSeason: false,
    },
    youthAcademy: { prospects: newYouthProspects, nextIntakePreview: newIntakePreview, youthPreviewEnhanced: false },
    staff: { ...state.staff, availableHires: newAvailableHires },
    scouting: { ...state.scouting, assignments: [], reports: [], discoveredPlayers: [] },
    cup: newCup,
    leagueCup: newLeagueCup,
    friendlies: newFriendlies,
    championsCup: newChampionsCup,
    shieldCup: newShieldCup,
    conferenceCup: newConferenceCup,
    continentalCoefficients: updatedCoefficients,
    virtualClubs: allVirtualClubs,
    continentalQualification: { champions: champQ.qualifiers, shield: shieldQ.qualifiers, conference: confQ.qualifiers },
    domesticSuperCup: newDomesticSuperCup,
    continentalSuperCup: newContinentalSuperCup,
    currentContinentalMatchId: null,
    currentContinentalCompetition: null,
    currentLeagueCupTieId: null,
    clubRecords: updatedRecords,
    activeChallenge: endChallenge,
    activeStorylineChains: [],
    completedStorylineChainIds: [],
    pendingStoryline: null,
    freeAgents: freeAgentIds, transferNews: [],
    ...(farewells.length > 0 ? { pendingFarewell: farewells.sort((a, b) => b.seasonsServed - a.seasonsServed) } : {}),
    lastSeasonTurnover: turnover,
    // Career milestones & manager XP at end of season
    careerTimeline: (() => {
      const milestones = [...state.careerTimeline];
      if (history.position === 1) {
        const isFirst = !state.seasonHistory.some(h => h.position === 1);
        milestones.push(createMilestone(isFirst ? 'first_trophy' : 'season_start', isFirst ? 'First League Title!' : 'League Champions!', `Won the league in Season ${season} with ${history.points || 0} points.`, season, TOTAL_WEEKS, isFirst ? 'medal' : 'trophy'));
      }
      if (state.cup.winner === playerClubId) {
        milestones.push(createMilestone('cup_win', 'Cup Winners!', `Won the cup in Season ${season}!`, season, TOTAL_WEEKS, 'medal'));
      }
      if (state.leagueCup?.winner === playerClubId) {
        milestones.push(createMilestone('cup_win', 'League Cup Winners!', `Won the League Cup in Season ${season}!`, season, TOTAL_WEEKS, 'medal'));
      }
      if (state.championsCup?.winnerId === playerClubId) {
        milestones.push(createMilestone('cup_win', 'Champions Cup Winners!', `Won the Champions Cup in Season ${season}!`, season, TOTAL_WEEKS, 'trophy'));
      }
      if (state.shieldCup?.winnerId === playerClubId) {
        milestones.push(createMilestone('cup_win', 'Shield Cup Winners!', `Won the Shield Cup in Season ${season}!`, season, TOTAL_WEEKS, 'medal'));
      }
      if (state.conferenceCup?.winnerId === playerClubId) {
        milestones.push(createMilestone('cup_win', 'Conference Cup Winners!', `Won the Conference Cup in Season ${season}!`, season, TOTAL_WEEKS, 'medal'));
      }
      return milestones;
    })(),
    managerProgression: grantXP(state.managerProgression, (() => {
      let xp = XP_REWARDS.seasonEnd;
      if (history.position === 1) xp += XP_REWARDS.titleWin;
      if (state.cup.winner === playerClubId) xp += XP_REWARDS.cupWin;
      if (state.leagueCup?.winner === playerClubId) xp += XP_REWARDS.leagueCupWin;
      if (state.championsCup?.winnerId === playerClubId) xp += XP_REWARDS.championsCupWin;
      else if (state.championsCup && !state.championsCup.playerEliminated) xp += XP_REWARDS.continentalGroupAdvance;
      if (state.shieldCup?.winnerId === playerClubId) xp += XP_REWARDS.shieldCupWin;
      else if (state.shieldCup && !state.shieldCup.playerEliminated) xp += XP_REWARDS.continentalGroupAdvance;
      if (state.conferenceCup?.winnerId === playerClubId) xp += XP_REWARDS.conferenceCupWin;
      else if (state.conferenceCup && !state.conferenceCup.playerEliminated) xp += XP_REWARDS.continentalGroupAdvance;
      xp += objectiveXP;
      return xp;
    })()),
    seasonGrowthTracker: {},
    // Reset season enrichment tracking for the new season
    seasonStartAvgOVR: history.squadStrengthDelta?.endAvgOVR || 0,
    seasonTransfersBought: [],
    seasonTransfersSold: [],
    seasonTotalIncome: 0,
    seasonTotalExpenses: 0,
    activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
    // Reset monthly objectives for new season
    weeklyObjectives: generateMonthlyObjectives(true),
    objectiveStreak: 0,
    objectivesStartWeek: 1,
    // Reset coach checklist so players re-do setup tasks each season
    completedCoachTaskIds: [],
    // Update national team pool IDs (aged-out players removed)
    ...(currentNT ? {
      nationalTeam: { ...currentNT, poolPlayerIds: updatedNTPoolIds },
    } : {}),
  });

  // Update Hall of Managers cross-save leaderboard
  const finalState = get();
  const playerClubForHall = finalState.clubs[playerClubId];
  if (playerClubForHall) {
    const hallEntry = buildHallEntry(
      `slot-${finalState.activeSlot}`,
      playerClubForHall.name,
      finalState.seasonHistory,
      finalState.managerStats,
      finalState.managerProgression.prestigeLevel || 0,
    );
    saveToHall(hallEntry);
  }

  // Career mode: check if the FA should re-offer the national team job (after sacking)
  {
    const cs = get();
    if (cs.gameMode === 'career' && cs.careerManager && cs.managerNationality
      && !cs.nationalTeam && !cs.nationalTeamOffer
      && cs.careerManager.nationalTeamSacked) {
      const threshold = NT_JOB_REHIRE_REPUTATION;
      const upcomingTournament = getTournamentForSeason(season + 1) || getTournamentForSeason(season + 2);
      if (cs.careerManager.reputationScore >= threshold && upcomingTournament) {
        const expWeek = cs.week + NT_JOB_OFFER_DURATION_WEEKS;
        const expSeason = expWeek > TOTAL_WEEKS ? newSeason + 1 : newSeason;
        const finalExpWeek = expWeek > TOTAL_WEEKS ? expWeek - TOTAL_WEEKS : expWeek;
        const offer = {
          id: crypto.randomUUID(),
          nationality: cs.managerNationality,
          reason: cs.careerManager.nationalTeamSacked ? 'vacancy' as const : 'initial' as const,
          offerSeason: newSeason,
          offerWeek: 1,
          expiresSeason: expSeason,
          expiresWeek: finalExpWeek,
          status: 'pending' as const,
        };
        const offerMsg = addMsg(cs.messages, {
          week: 1, season: newSeason, type: 'national_team',
          title: `${cs.managerNationality} FA: National Team Position`,
          body: `The ${cs.managerNationality} Football Association has been impressed by your achievements in club football. They would like to offer you the position of ${cs.managerNationality} national team manager.`,
        });
        set({ nationalTeamOffer: offer, showNationalTeamOffer: true, messages: offerMsg });
      }
    }
  }

  // Check if an international tournament should start this season
  const postState = get();
  const tournamentType = getTournamentForSeason(season);
  // Sandbox: always participate. Career: only if national team is appointed.
  const canParticipate = postState.managerNationality && (postState.gameMode === 'sandbox' || postState.nationalTeam !== null);
  if (tournamentType && canParticipate) {
    const tournament = generateTournament(tournamentType, season, postState.managerNationality);

    // Top up national team pool before tournament (replenishes aged-out players)
    const topUpPlayers = generateNationalTeamPool(postState.managerNationality, postState.players, season);
    const tournamentPlayers = Object.keys(topUpPlayers).length > 0
      ? { ...postState.players, ...topUpPlayers }
      : postState.players;
    const existingPoolIds = postState.nationalTeam?.poolPlayerIds || [];
    const mergedPoolIds = [...new Set([...existingPoolIds, ...Object.keys(topUpPlayers)])];

    // Auto-select national squad from the full pool
    const squad = autoSelectNationalSquad(postState.managerNationality, tournamentPlayers);
    const nt = postState.nationalTeam
      ? { ...postState.nationalTeam, squad, poolPlayerIds: mergedPoolIds }
      : null;

    // Apply morale boost to called-up players
    const boostedPlayers = { ...tournamentPlayers };
    for (const pid of squad) {
      if (boostedPlayers[pid]) {
        boostedPlayers[pid] = { ...boostedPlayers[pid], morale: Math.min(100, boostedPlayers[pid].morale + NATIONAL_CALLUP_MORALE_BOOST) };
      }
    }

    const tournamentMsg = addMsg(postState.messages, {
      week: 1, season: newSeason, type: 'general',
      title: `${tournament.name} Begins!`,
      body: `The ${tournament.name} is about to start! You'll manage ${postState.managerNationality} through the tournament. ${squad.length} players have been called up.`,
    });

    set({
      seasonPhase: 'international',
      internationalTournament: tournament,
      nationalTeam: nt,
      players: boostedPlayers,
      messages: tournamentMsg,
      currentScreen: 'international-tournament',
    });
    return;
  }

  // Career mode: end-of-season processing (aging, sacking, contract, reputation)
  {
    const cs = get();
    if (cs.gameMode === 'career' && cs.careerManager) {
      const cm = { ...cs.careerManager };
      const cmAttrs = { ...cm.attributes };
      cm.attributes = cmAttrs;

      // Manager ages +1
      cm.age += 1;

      // Update career stats from season history
      const latestHistory = cs.seasonHistory[cs.seasonHistory.length - 1];
      if (latestHistory) {
        cm.totalCareerWins += latestHistory.won;
        cm.totalCareerDraws += latestHistory.drawn;
        cm.totalCareerLosses += latestHistory.lost;
        cm.totalCareerMatches += latestHistory.won + latestHistory.drawn + latestHistory.lost;

        // Update best finish in career history
        const currentEntry = cm.careerHistory.find(e => e.endSeason === null);
        if (currentEntry && (currentEntry.bestFinish === 0 || latestHistory.position < currentEntry.bestFinish)) {
          cm.careerHistory = cm.careerHistory.map(e =>
            e.endSeason === null ? { ...e, bestFinish: latestHistory.position } : e
          );
        }

        // Title won
        if (latestHistory.position === 1) {
          cm.titlesWon += 1;
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_TITLE);
          if (cm.careerHistory.length > 0) {
            cm.careerHistory = cm.careerHistory.map(e =>
              e.endSeason === null ? { ...e, titlesWon: e.titlesWon + 1 } : e
            );
          }
        }

        // Cup win
        if (cs.cup.winner === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_CUP_WIN);
        }

        // League Cup win
        if (cs.leagueCup?.winner === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.leagueCupsWon = (cm.leagueCupsWon || 0) + 1;
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_LEAGUE_CUP_WIN);
        }

        // Champions Cup win / continental progress
        if (cs.championsCup?.winnerId === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.continentalCupsWon = (cm.continentalCupsWon || 0) + 1;
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_CHAMPIONS_CUP_WIN);
        } else if (cs.championsCup && !cs.championsCup.playerEliminated) {
          // Advanced past group stage
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_CONTINENTAL_GROUP);
          // Bonus per knockout round reached
          const knockoutRounds = ['R16', 'QF', 'SF', 'F'];
          const reached = knockoutRounds.indexOf(cs.championsCup.currentRound || '');
          if (reached >= 0) cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + (reached + 1) * REP_CONTINENTAL_KNOCKOUT);
        }

        // Shield Cup win / continental progress
        if (cs.shieldCup?.winnerId === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.continentalCupsWon = (cm.continentalCupsWon || 0) + 1;
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_SHIELD_CUP_WIN);
        } else if (cs.shieldCup && !cs.shieldCup.playerEliminated) {
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_CONTINENTAL_GROUP);
          const knockoutRounds = ['R16', 'QF', 'SF', 'F'];
          const reached = knockoutRounds.indexOf(cs.shieldCup.currentRound || '');
          if (reached >= 0) cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + (reached + 1) * REP_CONTINENTAL_KNOCKOUT);
        }

        // Conference Cup win / continental progress
        if (cs.conferenceCup?.winnerId === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.continentalCupsWon = (cm.continentalCupsWon || 0) + 1;
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_CONFERENCE_CUP_WIN);
        } else if (cs.conferenceCup && !cs.conferenceCup.playerEliminated) {
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_CONTINENTAL_GROUP);
          const knockoutRounds = ['R16', 'QF', 'SF', 'F'];
          const reached = knockoutRounds.indexOf(cs.conferenceCup.currentRound || '');
          if (reached >= 0) cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + (reached + 1) * REP_CONTINENTAL_KNOCKOUT);
        }

        // Promotion/relegation reputation
        const leagueInfo = LEAGUES.find(l => l.id === cs.playerDivision);
        if (leagueInfo) {
          const teamCount = leagueInfo.teamCount;
          const replacedSlots = leagueInfo.replacedSlots;
          // Promotion: finished in top auto-promotion slots (position <= teamCount - replacedSlots is safe, but top 2-3 = promoted)
          if (replacedSlots > 0 && latestHistory.position <= Math.min(3, replacedSlots)) {
            cm.promotionsWon += 1;
            cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + REP_PROMOTION);
          }
          // Relegation: finished in bottom replacedSlots
          if (replacedSlots > 0 && latestHistory.position > teamCount - replacedSlots) {
            cm.reputationScore = Math.max(REP_MIN, cm.reputationScore + REP_RELEGATION);
          }
        }

        // Overachievement / underachievement
        const expectedPos = getExpectedPosition(cs.clubs[cs.playerClubId]?.reputation || 3);
        if (latestHistory.position < expectedPos) {
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + (expectedPos - latestHistory.position) * REP_OVERACHIEVE_BONUS);
        } else if (latestHistory.position > expectedPos) {
          cm.reputationScore = Math.max(REP_MIN, cm.reputationScore + (expectedPos - latestHistory.position) * Math.abs(REP_UNDERACHIEVE_PENALTY));
        }

        // Contract bonus tracking
        if (cm.contract && cm.contract.bonuses.length > 0) {
          let bonusPayout = 0;
          cm.contract = { ...cm.contract, bonuses: cm.contract.bonuses.map(b => {
            if (b.met) return b;
            let met = false;
            if (b.condition === 'title' && latestHistory.position === 1) met = true;
            if (b.condition === 'top_half' && leagueInfo && latestHistory.position <= leagueInfo.teamCount / 2) met = true;
            if (b.condition === 'promotion' && cm.promotionsWon > (cs.careerManager?.promotionsWon || 0)) met = true;
            if (b.condition === 'cup_win' && cs.cup.winner === cs.playerClubId) met = true;
            if (b.condition === 'avoid_relegation' && leagueInfo && latestHistory.position <= leagueInfo.teamCount - leagueInfo.replacedSlots) met = true;
            if (met) bonusPayout += b.amount;
            return met ? { ...b, met: true } : b;
          })};
          if (bonusPayout > 0) {
            cm.personalWealth = (cm.personalWealth || 0) + bonusPayout;
            const bonusState = get();
            const bonusClub = bonusState.clubs[bonusState.playerClubId];
            const bonusMsg = addMsg(bonusState.messages, {
              week: TOTAL_WEEKS, season, type: 'general',
              title: 'Contract Bonuses Paid',
              body: `The club paid £${(bonusPayout / 1000).toFixed(0)}k in manager performance bonuses this season. Your personal wealth is now £${((cm.personalWealth) / 1000).toFixed(0)}k.`,
            });
            set({
              messages: bonusMsg,
              clubs: {
                ...bonusState.clubs,
                [bonusState.playerClubId]: { ...bonusClub, budget: bonusClub.budget - bonusPayout },
              },
            });
          }
        }

        // Manager of the Season (overachievement ≥ 3 positions)
        if (expectedPos - latestHistory.position >= 3) {
          cm.awardsWon = [...cm.awardsWon, { type: 'manager_of_season', season, divisionId: cs.playerDivision }];
          cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + 15);
        }
      }

      // Handle sacking in career mode
      if (latestHistory?.boardVerdict === 'sacked') {
        cm.sackedCount += 1;
        cm.reputationScore = Math.max(REP_MIN, cm.reputationScore + REP_SACKING);
        cm.careerHistory = cm.careerHistory.map(e =>
          e.endSeason === null ? { ...e, endSeason: cs.season, reason: 'sacked' as const } : e
        );
        cm.contract = null;
        cm.unemployedWeeks = 0;

        // Recalculate reputation tier

        cm.reputationTier = calculateReputationTier(cm.reputationScore);

        // Generate job vacancies with competitors

        const vacancies = generateJobVacancies(cs.clubs, cm.reputationScore, cs.season + 1, 1, cs.playerClubId).map(v => {
          const vLeague = LEAGUES.find(l => l.id === v.divisionId);
          return { ...v, competitors: generateCompetitors(v.minReputation, (vLeague?.qualityTier || 4) as 1 | 2 | 3 | 4) };
        });

        set({
          careerManager: cm,
          jobVacancies: vacancies,
          jobOffers: [],
          activeInterview: null,
          currentScreen: 'job-market',
        });
      } else {
        // Not sacked — check retirement, contract expiry
        cm.reputationTier = calculateReputationTier(cm.reputationScore);
        cm.legacyScore = calculateLegacyScore(cm);

        const careerUpdate: Partial<GameState> = {};

        // Check if manager should retire
        const retAge = getRetirementAge(cm);
        if (cm.age >= retAge) {
          cm.careerHistory = cm.careerHistory.map(e =>
            e.endSeason === null ? { ...e, endSeason: cs.season, reason: 'retired' as const } : e
          );
          cm.contract = null;
          careerUpdate.currentScreen = 'hall-of-managers';
        }

        // Check contract expiry
        if (cm.contract && cm.contract.endSeason <= cs.season) {
          if (latestHistory && (latestHistory.boardVerdict === 'excellent' || latestHistory.boardVerdict === 'good')) {
            // Auto-renew with better terms
            cm.contract = {
              ...cm.contract,
              endSeason: cs.season + 2,
              salary: Math.round(cm.contract.salary * 1.15),
            };
          } else {
            // Contract not renewed — enter job market
            cm.careerHistory = cm.careerHistory.map(e =>
              e.endSeason === null ? { ...e, endSeason: cs.season, reason: 'contract_expired' as const } : e
            );
            cm.contract = null;
            cm.unemployedWeeks = 0;
            careerUpdate.jobVacancies = generateJobVacancies(cs.clubs, cm.reputationScore, cs.season + 1, 1, cs.playerClubId).map(v => {
              const vLeague = LEAGUES.find(l => l.id === v.divisionId);
              return { ...v, competitors: generateCompetitors(v.minReputation, (vLeague?.qualityTier || 4) as 1 | 2 | 3 | 4) };
            });
            careerUpdate.jobOffers = [];
            careerUpdate.activeInterview = null;
            careerUpdate.currentScreen = 'job-market';
          }
        }

        // Single consolidated set() call
        set({ ...careerUpdate, careerManager: cm });
      }
    }
  }

  if (get().settings.autoSave) get().saveGame();
}

/** Compute cumulative shout modifiers from match shouts for use as simulation modifiers */
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

export const createOrchestrationSlice = (set: Set, get: Get) => ({
  initGame: (clubId: string) => {
    resetSeasonGrowth();
    clearLeagueTableCache();
    const allPlayers: Record<string, Player> = {};
    const clubs: Record<string, Club> = {};

    // Find which league the selected club belongs to
    const selectedClubData = ALL_CLUBS.find(c => c.id === clubId);
    const playerDivision = selectedClubData?.divisionId || 'eng';
    const league = LEAGUES.find(l => l.id === playerDivision);

    // Only load clubs for the player's league
    const leagueClubData = ALL_CLUBS.filter(cd => cd.divisionId === playerDivision);

    leagueClubData.forEach(cd => {
      const club: Club = {
        id: cd.id, name: cd.name, shortName: cd.shortName,
        color: cd.color, secondaryColor: cd.secondaryColor,
        budget: cd.budget, wageBill: 0, reputation: cd.reputation,
        facilities: cd.facilities, youthRating: cd.youthRating,
        fanBase: cd.fanBase, boardPatience: cd.boardPatience,
        playerIds: [], formation: '4-3-3', lineup: [], subs: [],
        divisionId: cd.divisionId,
        stadiumName: cd.stadiumName,
        stadiumCapacity: cd.stadiumCapacity,
      };

      const squad = generateSquad(club.id, cd.squadQuality, 1, playerDivision);
      let totalWages = 0;
      squad.forEach(p => {
        allPlayers[p.id] = p;
        club.playerIds.push(p.id);
        totalWages += p.wage;
      });
      club.wageBill = totalWages;

      const { lineup, subs } = selectBestLineup(squad, '4-3-3');
      club.lineup = lineup.map(p => p.id);
      club.subs = subs.map(p => p.id);
      // Assign AI manager profiles to non-player clubs
      if (club.id !== clubId) {
        club.aiManagerProfile = generateAIManagerProfile(club.id, cd.reputation);
      }
      clubs[club.id] = club;
    });

    // Build league structures (single league only)
    const leagueClubIds = leagueClubData.map(cd => cd.id);
    const leagueTotalWeeks = league?.totalWeeks || TOTAL_WEEKS;
    const divisionClubs: Record<string, string[]> = { [playerDivision]: leagueClubIds };
    const divisionFixtures: Record<string, Match[]> = { [playerDivision]: generateDivisionFixtures(leagueClubIds, leagueTotalWeeks) };
    const divisionTables: Record<string, LeagueTableEntry[]> = { [playerDivision]: buildLeagueTable(divisionFixtures[playerDivision], leagueClubIds) };
    const fixtures = divisionFixtures[playerDivision];
    const leagueTable = divisionTables[playerDivision];

    const transferMarket: TransferListing[] = [];
    // Seed market with bench players from all clubs
    Object.values(clubs).forEach(c => {
      const clubPlayers = c.playerIds.map(id => allPlayers[id]).filter(Boolean);
      const benched = clubPlayers.filter(p => !c.lineup.includes(p.id));
      if (benched.length > 2) {
        const listed = shuffle(benched).slice(0, INITIAL_LISTINGS_MIN + Math.floor(Math.random() * INITIAL_LISTINGS_RANGE));
        listed.forEach(p => {
          transferMarket.push({ playerId: p.id, askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)), sellerClubId: c.id, listedWeek: 1, listedSeason: 1, divisionId: c.divisionId });
        });
      }
    });

    // Generate external market players for all divisions (realistic populated market)
    const initialMarket = generateInitialMarket(1, 1);
    Object.assign(allPlayers, initialMarket.players);
    transferMarket.push(...initialMarket.listings);

    // Pre-season bonus: flood market with extra higher-quality players during friendlies
    const preSeasonMarket = generatePreSeasonMarket(1, 1);
    Object.assign(allPlayers, preSeasonMarket.players);
    transferMarket.push(...preSeasonMarket.listings);

    // Generate initial free agent pool
    const initialFreeAgents = generateInitialFreeAgents(1);
    Object.assign(allPlayers, initialFreeAgents.players);
    const initialFreeAgentIds = initialFreeAgents.freeAgentIds;

    const initClub = clubs[clubId];
    const objectives = generateObjectives(initClub);

    // Compute starting average OVR for season enrichment tracking
    const startingPlayers = initClub.playerIds.map(id => allPlayers[id]).filter(Boolean);
    const startAvgOVR = startingPlayers.length > 0
      ? Math.round(startingPlayers.reduce((s, p) => s + p.overall, 0) / startingPlayers.length)
      : 0;

    const messages: Message[] = [
      { id: crypto.randomUUID(), week: 1, season: 1, type: 'board', title: 'Welcome, Manager!', body: `The board of ${initClub.name} welcomes you. We expect great things this season. Check your objectives in the Club tab.`, read: false },
      { id: crypto.randomUUID(), week: 1, season: 1, type: 'general', title: 'Transfer Window Open', body: 'The transfer window is now open. Scout the market and strengthen your squad before it closes in Week 8.', read: false },
      { id: crypto.randomUUID(), week: 1, season: 1, type: 'transfer', title: 'Pre-Season Market Surge', body: 'Clubs are aggressively reshaping their squads during pre-season. Expect more transfer activity and higher-quality players on the market before league fixtures begin in Week 4.', read: false },
    ];

    const pcInit = clubs[clubId];
    const initialStaff = generateInitialStaff(pcInit.reputation);
    const availableHires = generateStaffMarket();
    const youthCoachQuality = getStaffBonus(initialStaff, 'youth-coach');
    const { prospects: youthProspects, players: youthPlayers } = generateYouthProspects(
      clubId, pcInit.youthRating, youthCoachQuality, 1, 3 + Math.floor(Math.random() * 2), selectedClubData?.squadQuality
    );
    youthPlayers.forEach(p => { allPlayers[p.id] = p; });
    const nextIntakePreview = generateIntakePreview(pcInit.youthRating);
    const scoutCount = initialStaff.filter(s => s.role === 'scout').length;

    // Generate cup draws and pre-season friendlies
    const cup = generateCupDraw(leagueClubIds);
    const leagueCup = generateLeagueCupDraw(leagueClubIds);
    const friendlies = generateFriendlies(clubId, leagueClubIds);

    set({
      gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: TOTAL_WEEKS,
      gameMode: get().gameMode || 'sandbox',
      transferWindowOpen: true, clubs, players: allPlayers, fixtures, leagueTable, friendlies,
      divisionFixtures, divisionTables, divisionClubs, playerDivision,
      lastSeasonTurnover: null, derbies: DERBIES,
      activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
      transferMarket, shortlist: [], scoutWatchList: [], freeAgents: initialFreeAgentIds, transferNews: [], boardObjectives: objectives, boardConfidence: STARTING_BOARD_CONFIDENCE,
      currentScreen: 'dashboard', previousScreen: null, currentMatchResult: null, trainingFocus: 'fitness',
      messages, seasonHistory: [], incomingOffers: [], matchSubsUsed: 0, matchPhase: 'none', matchTeamTalk: 'none', currentCupTieId: null,
      settings: { matchSpeed: 600, showOverallOnPitch: true, autoSave: true, hapticsEnabled: true, hidePageHints: false, confirmAllOffers: false, reducedMotion: false },
      tactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
      training: {
        schedule: { mon: 'fitness', tue: 'attacking', wed: 'defending', thu: 'mentality', fri: 'tactical' },
        intensity: 'medium', individualPlans: [], tacticalFamiliarity: STARTING_TACTICAL_FAMILIARITY,
      },
      staff: { members: initialStaff, availableHires },
      scouting: { maxAssignments: scoutCount, assignments: [], reports: [], discoveredPlayers: [] },
      youthAcademy: { prospects: youthProspects, nextIntakePreview, youthPreviewEnhanced: false },
      facilities: {
        trainingLevel: pcInit.facilities, youthLevel: pcInit.youthRating,
        stadiumStands: (() => { const lvl = Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.fanBase / STADIUM_LEVEL_DIVISOR)); return { north: lvl, south: lvl, east: lvl, west: lvl }; })(),
        medicalLevel: Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.facilities * MEDICAL_LEVEL_FACTOR)),
        recoveryLevel: Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.facilities * RECOVERY_LEVEL_FACTOR)),
        upgradeInProgress: null,
      },
      financeHistory: [], matchPlayerRatings: [],
      unlockedAchievements: [], pendingAchievementIds: [],
      managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
      clubRecords: createEmptyRecords(),
      careerTimeline: [createMilestone('season_start', 'Career Begins', `Started managing ${ALL_CLUBS.find(c => c.id === clubId)?.name || 'a club'}.`, 1, 1, 'calendar')],
      managerProgression: createDefaultProgression(),
      cup,
      leagueCup,
      championsCup: null,
      shieldCup: null,
      conferenceCup: null,
      virtualClubs: {},
      continentalCoefficients: {},
      continentalQualification: null,
      domesticSuperCup: null,
      continentalSuperCup: null,
      currentContinentalMatchId: null,
      currentContinentalCompetition: null,
      currentLeagueCupTieId: null,
      weeklyObjectives: generateMonthlyObjectives(true),
      objectiveStreak: 0,
      objectivesStartWeek: 1,
      completedCoachTaskIds: [],
      weekCliffhangers: [],
      rivalries: {},
      pairFamiliarity: (() => {
        const fam: Record<string, number> = {};
        const ids = initClub.lineup.filter(id => allPlayers[id]);
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = ids[i] < ids[j] ? `${ids[i]}-${ids[j]}` : `${ids[j]}-${ids[i]}`;
            fam[key] = INITIAL_FAMILIARITY_SEED;
          }
        }
        return fam;
      })(),
      lastMatchDrama: null,
      lastMatchCompetition: null,
      seasonStartAvgOVR: startAvgOVR,
      seasonTransfersBought: [],
      seasonTransfersSold: [],
      seasonTotalIncome: 0,
      seasonTotalExpenses: 0,
      sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
      weeklyDigest: null,
      pendingStoryline: null,
      activeStorylineChains: [],
      completedStorylineChainIds: [],
      pendingFarewell: [],
      sponsorDeals: generateStarterDeals(pcInit.reputation, 1),
      sponsorOffers: [],
      sponsorSlotCooldowns: {},
      negotiationStrikes: {},
      merchandise: getDefaultMerchState(),
      fanMood: 50,
      pendingPressConference: null,
      halfTimeState: null,
      preMatchLeaguePosition: 0,
      seasonPhase: 'regular',
      clubPowerRankings: initializeClubPowerRankings(clubs, LEAGUES),
      activeNegotiation: null,
      pendingTransferTalk: null,
      pendingGemReveal: null,
      activeChallenge: null,
      selectedPlayerId: null,
      lastMatchXPGain: 0,
      seasonGrowthTracker: {},
      monetization: {
        ...DEFAULT_MONETIZATION_STATE,
        // Preserve purchases and subscription across game init
        entitlements: get().monetization?.entitlements || [],
        firstLaunchTimestamp: get().monetization?.firstLaunchTimestamp || Date.now(),
        subscription: get().monetization?.subscription || null,
      },
    });
  },

  initializeLeague: (leagueId: string) => {
    const state = get();
    // Already initialized — skip
    if (state.divisionClubs[leagueId]?.length) return;

    const league = LEAGUES.find(l => l.id === leagueId);
    if (!league) return;

    const leagueClubData = ALL_CLUBS.filter(cd => cd.divisionId === leagueId);
    if (leagueClubData.length === 0) return;

    const newPlayers: Record<string, Player> = { ...state.players };
    const newClubs: Record<string, Club> = { ...state.clubs };
    const leagueClubIds: string[] = [];

    for (const cd of leagueClubData) {
      const club: Club = {
        id: cd.id, name: cd.name, shortName: cd.shortName,
        color: cd.color, secondaryColor: cd.secondaryColor,
        budget: cd.budget, wageBill: 0, reputation: cd.reputation,
        facilities: cd.facilities, youthRating: cd.youthRating,
        fanBase: cd.fanBase, boardPatience: cd.boardPatience,
        playerIds: [], formation: '4-3-3', lineup: [], subs: [],
        divisionId: cd.divisionId,
        stadiumName: cd.stadiumName,
        stadiumCapacity: cd.stadiumCapacity,
      };

      const squad = generateSquad(club.id, cd.squadQuality, state.season, leagueId);
      let totalWages = 0;
      squad.forEach(p => {
        newPlayers[p.id] = p;
        club.playerIds.push(p.id);
        totalWages += p.wage;
      });
      club.wageBill = totalWages;

      const { lineup, subs } = selectBestLineup(squad, '4-3-3');
      club.lineup = lineup.map(p => p.id);
      club.subs = subs.map(p => p.id);
      club.aiManagerProfile = generateAIManagerProfile(club.id, cd.reputation);
      newClubs[club.id] = club;
      leagueClubIds.push(club.id);
    }

    // Generate fixtures and catch up to current week
    const leagueTotalWeeks = league.totalWeeks || 46;
    const fixtures = generateDivisionFixtures(leagueClubIds, leagueTotalWeeks);

    // Simulate all matches up to the current week to populate the table
    const currentWeek = state.week;
    for (const m of fixtures) {
      if (m.week > currentWeek || m.played) continue;
      const hc = newClubs[m.homeClubId];
      const ac = newClubs[m.awayClubId];
      if (!hc || !ac) continue;
      const hp = hc.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured).slice(0, 11);
      const ap = ac.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured).slice(0, 11);
      if (hp.length === 0 || ap.length === 0) {
        m.played = true;
        m.homeGoals = hp.length === 0 ? 0 : 3;
        m.awayGoals = ap.length === 0 ? 0 : 3;
        continue;
      }
      const { result } = simulateMatch(m, hc, ac, hp, ap);
      Object.assign(m, result);
    }

    const newDivisionClubs = { ...state.divisionClubs, [leagueId]: leagueClubIds };
    const newDivisionFixtures = { ...state.divisionFixtures, [leagueId]: fixtures };
    const newDivisionTables = buildAllDivisionTables(newDivisionFixtures, newDivisionClubs);

    set({
      players: newPlayers,
      clubs: newClubs,
      divisionClubs: newDivisionClubs,
      divisionFixtures: newDivisionFixtures,
      divisionTables: newDivisionTables,
    });
  },

  advanceWeek: () => {
    const state = get();

    // Career mode: unemployed managers skip gameplay, only process job market
    if (state.gameMode === 'career' && state.careerManager && !state.careerManager.contract) {
      const cm = { ...state.careerManager, attributes: { ...state.careerManager.attributes } };
      cm.unemployedWeeks = (cm.unemployedWeeks || 0) + 1;
      const newWeek = state.week + 1;

      // Season end check — advance the world even while unemployed
      if (newWeek > TOTAL_WEEKS) {
        set({ careerManager: cm });
        endSeasonImpl(set, get);
        return;
      }

      // Forced retirement after extended unemployment
      if (cm.unemployedWeeks >= FORCED_RETIREMENT_UNEMPLOYED_WEEKS) {
        cm.careerHistory = cm.careerHistory.map(e =>
          e.endSeason === null ? { ...e, endSeason: state.season, reason: 'retired' as const } : e
        );
        cm.contract = null;
        set({ week: newWeek, careerManager: cm, activeInterview: null, currentScreen: 'hall-of-managers' });
        if (state.settings.autoSave) get().saveGame();
        return;
      }

      // Refresh job market on configured weeks
      let vacancies = state.jobVacancies;
      if (JOB_MARKET_REFRESH_WEEKS.includes(newWeek)) {
        vacancies = generateJobVacancies(state.clubs, cm.reputationScore, state.season, newWeek, state.playerClubId).map(v => {
          const vLeague = LEAGUES.find(l => l.id === v.divisionId);
          return { ...v, competitors: generateCompetitors(v.minReputation, (vLeague?.qualityTier || 4) as 1 | 2 | 3 | 4) };
        });
      }
      // Expire old vacancies
      vacancies = vacancies.filter(v => v.expiresSeason > state.season || (v.expiresSeason === state.season && v.expiresWeek > newWeek));

      // Desperation vacancies (weak or no competitors)
      if (cm.unemployedWeeks >= 12 && vacancies.length === 0) {
        const desperate = Object.values(state.clubs).filter(c => c.id !== state.playerClubId).slice(0, 2);
        vacancies = desperate.map(club => ({
          id: `desperation-${club.id}-${state.season}-${newWeek}`,
          clubId: club.id, clubName: club.name, divisionId: club.divisionId || '',
          minReputation: 0, salary: 1500, contractLength: 1,
          boardExpectations: 'Survive and stabilize the club',
          expiresWeek: newWeek + 8, expiresSeason: state.season, applied: false,
          competitors: generateCompetitors(0, 4).slice(0, 1),
        }));
      }

      const msgs = addMsg(state.messages, {
        week: newWeek, season: state.season, type: 'general',
        title: 'Between Jobs',
        body: `Week ${cm.unemployedWeeks} without a club. Visit the Job Market to find your next opportunity.`,
      });

      set({ week: newWeek, careerManager: cm, jobVacancies: vacancies, messages: msgs, currentScreen: 'job-market' });
      if (state.settings.autoSave) get().saveGame();
      return;
    }

    // International phase: separate flow
    if (state.seasonPhase === 'international') {
      advanceInternationalWeekImpl(set, get);
      return;
    }
    const { week, season, fixtures, clubs, players, playerClubId, training, staff, scouting, facilities, messages, boardConfidence } = state;
    const newPlayers = { ...players };
    let newMessages = [...messages];
    const newTimeline: CareerMilestone[] = [];

    // Digest tracking
    const digestInjuries: string[] = [];
    const digestRecoveries: string[] = [];
    const prevMorale = (() => {
      const pc = clubs[playerClubId];
      const ids = pc.playerIds;
      if (ids.length === 0) return 0;
      return Math.round(ids.reduce((s, id) => s + (players[id]?.morale || 0), 0) / ids.length);
    })();

    const physioBonus = getStaffBonus(staff.members, 'physio');
    const assistantManagerBonus = getStaffBonus(staff.members, 'assistant-manager');
    const gkCoachBonus = getStaffBonus(staff.members, 'goalkeeping-coach');

    const playerClub = { ...clubs[playerClubId] };
    const improvedPlayers: { name: string; overall: number }[] = [];
    const declinedPlayers: { name: string; overall: number }[] = [];

    // Snapshot pre-training state for report generation
    const preTrainingPlayers: Record<string, Player> = {};
    for (const pid of playerClub.playerIds) {
      if (players[pid]) preTrainingPlayers[pid] = players[pid];
    }
    // Compute streak multiplier for dominant training module
    const dominantModule = getDominantTrainingFocus(training.schedule);
    const streakMult = getStreakMultiplier(training.streaks, dominantModule);
    playerClub.playerIds.forEach(pid => {
      if (!newPlayers[pid]) return;
      let p = { ...newPlayers[pid] };
      if (p.injured) {
        const recoveryBoost = physioBonus >= PHYSIO_RECOVERY_BOOST_THRESHOLD && Math.random() < PHYSIO_RECOVERY_CHANCE ? 1 : 0;
        p.injuryWeeks = Math.max(0, p.injuryWeeks - 1 - recoveryBoost);
        if (p.injuryDetails) {
          p.injuryDetails = { ...p.injuryDetails, weeksRemaining: p.injuryWeeks };
        }
        if (p.injuryWeeks === 0) {
          p.injured = false;
          // Set fitness on return based on injury severity
          if (p.injuryDetails) {
            p.fitness = p.injuryDetails.fitnessOnReturn;
            // Keep reinjury risk active for a period after return
            p.injuryDetails = { ...p.injuryDetails, weeksRemaining: 0 };
          }
          digestRecoveries.push(p.lastName);
          const injLabel = p.injuryDetails ? INJURY_TYPES[p.injuryDetails.type].label : 'injury';
          newMessages = addMsg(newMessages, { week, season, type: 'injury', title: `${p.lastName} Returns`, body: `${p.firstName} ${p.lastName} has recovered from ${injLabel} and is available for selection.${p.injuryDetails && p.injuryDetails.reinjuryRisk > 0.1 ? ' Caution: elevated re-injury risk.' : ''}` });
        }
      }
      // Decrement re-injury risk window for recovered players
      if (!p.injured && p.injuryDetails && p.injuryDetails.reinjuryWeeksRemaining > 0) {
        p.injuryDetails = { ...p.injuryDetails, reinjuryWeeksRemaining: p.injuryDetails.reinjuryWeeksRemaining - 1 };
        if (p.injuryDetails.reinjuryWeeksRemaining === 0) {
          p.injuryDetails = undefined;
        }
      }
      if (p.suspendedUntilWeek && p.suspendedUntilWeek <= week) {
        p.suspendedUntilWeek = undefined;
        newMessages = addMsg(newMessages, { week, season, type: 'general', title: `${p.lastName} Available`, body: `${p.firstName} ${p.lastName}'s suspension has ended. Available for selection.` });
      }

      // Snapshot attributes before training + development to track per-attribute changes
      const attrsBefore = { ...p.attributes };

      if (!p.injured) {
        p = applyWeeklyTraining(p, training, getTrainingStaffBonus(staff.members), facilities.recoveryLevel, streakMult);
        // Physio reduces training injury risk, age-scaled injury risk
        const baseInjuryRisk = getInjuryRisk(training, p.age, p.morale);
        const physioReduction = 1 - physioBonus * PHYSIO_INJURY_REDUCTION_PER_QUALITY;
        const perkReduction = hasPerk(state.managerProgression, 'fitness_guru') ? 0.8 : 1;
        // Congested fixtures: if player has both a league and cup match this week
        const hasCupThisWeek = state.cup.ties.some(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId));
        const hasLeagueThisWeek = state.fixtures.some(f => f.week === week && !f.played && (f.homeClubId === playerClubId || f.awayClubId === playerClubId));
        const congestionFactor = (hasCupThisWeek && hasLeagueThisWeek) ? CONGESTED_FIXTURE_INJURY_MULTIPLIER : 1;
        const individualTrainingRisk = (training.individualPlans || []).some(
          plan => plan.playerId === p.id
        ) ? INDIVIDUAL_INJURY_RISK_MODIFIER : 1;
        const injuryRisk = baseInjuryRisk * physioReduction * perkReduction * congestionFactor * individualTrainingRisk;
        if (Math.random() < injuryRisk && !p.injured) {
          const injDetails = generateAIInjuryDetails(facilities.medicalLevel);
          p.injured = true;
          p.injuryWeeks = injDetails.weeksRemaining;
          p.injuryDetails = injDetails;
          digestInjuries.push(`${p.lastName} (${injDetails.severity} ${INJURY_TYPES[injDetails.type].label}, ${p.injuryWeeks}wk)`);
        }
      }

      const allClubPlayers = playerClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
      const mentorBonusVal = getMentorBonus(p, allClubPlayers);
      const dm = dynastyMult(state.managerProgression);
      const trainingPerkBoost = hasPerk(state.managerProgression, 'training_ground') ? TRAINING_GROUND_BOOST * dm : 0;
      const dnaCoachBoost = hasPerk(state.managerProgression, 'dna_coach') && p.age < 24 ? 0.1 : 0;
      const gkBoost = p.position === 'GK' ? gkCoachBonus * GK_COACH_DEV_BONUS_PER_QUALITY : 0;
      p = applyPlayerDevelopment(p, getDominantTrainingFocus(training.schedule), mentorBonusVal, trainingPerkBoost + dnaCoachBoost + gkBoost);
      if (p.growthDelta && p.growthDelta > 0) {
        improvedPlayers.push({ name: p.lastName, overall: p.overall });
      } else if (p.growthDelta && p.growthDelta < 0) {
        declinedPlayers.push({ name: p.lastName, overall: p.overall });
      }

      // Compute combined per-attribute changes from training + development
      const attrChanges: Partial<Record<keyof PlayerAttributes, number>> = {};
      for (const attr of Object.keys(attrsBefore) as (keyof PlayerAttributes)[]) {
        const delta = p.attributes[attr] - attrsBefore[attr];
        if (delta !== 0) attrChanges[attr] = delta;
      }
      p.lastAttributeChanges = Object.keys(attrChanges).length > 0 ? attrChanges : undefined;

      // Benched players gradually lose morale
      if (!playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid) && !p.injured) {
        p.morale = Math.max(MORALE_BENCH_MIN, p.morale - MORALE_BENCH_WEEKLY_LOSS);
      }

      // Track consecutive low morale weeks and escalate unhappiness
      if (p.morale < UNHAPPY_THRESHOLD) {
        p.lowMoraleWeeks = (p.lowMoraleWeeks || 0) + 1;
        if (p.lowMoraleWeeks === UNHAPPY_WEEKS_TO_REQUEST && !p.wantsToLeave) {
          p.wantsToLeave = true;
          newMessages = addMsg(newMessages, {
            week, season, type: 'transfer',
            title: `${p.lastName} Wants Out!`,
            body: `${p.firstName} ${p.lastName} has submitted a transfer request after weeks of low morale. The player wants to leave the club.`,
            playerId: pid,
          });
          // Queue transfer talk dialog (only one at a time — first one wins)
          if (!get().pendingTransferTalk) {
            set({ pendingTransferTalk: buildTransferTalk(p, 'low_morale') });
          }
        }
        if (p.lowMoraleWeeks >= UNHAPPY_CONTAGION_WEEKS) {
          // Morale contagion: affect 2 random teammates
          const teammates = playerClub.playerIds.filter(id => id !== pid);
          const shuffled = shuffle(teammates);
          for (let ti = 0; ti < Math.min(2, shuffled.length); ti++) {
            const tmId = shuffled[ti];
            if (newPlayers[tmId]) {
              newPlayers[tmId] = { ...newPlayers[tmId], morale: Math.max(0, newPlayers[tmId].morale - UNHAPPY_CONTAGION_MORALE_HIT) };
            }
          }
        }
      } else {
        // Reset low morale tracking when morale improves
        if (p.lowMoraleWeeks) p.lowMoraleWeeks = 0;
        if (p.wantsToLeave && p.morale >= 50) {
          p.wantsToLeave = false;
          newMessages = addMsg(newMessages, {
            week, season, type: 'transfer',
            title: `${p.lastName} Settled`,
            body: `${p.firstName} ${p.lastName} appears to have settled down and withdrawn the transfer request.`,
            playerId: pid, actioned: true,
          });
        }
      }

      newPlayers[pid] = p;
    });

    // Batched development messages
    if (improvedPlayers.length > 0) {
      const names = improvedPlayers.map(p => `${p.name} (${p.overall})`).join(', ');
      newMessages = addMsg(newMessages, { week, season, type: 'development', title: `${improvedPlayers.length} Player${improvedPlayers.length > 1 ? 's' : ''} Improved`, body: `Development progress: ${names}.` });
    }
    if (declinedPlayers.length > 0) {
      const names = declinedPlayers.map(p => `${p.name} (${p.overall})`).join(', ');
      newMessages = addMsg(newMessages, { week, season, type: 'development', title: `${declinedPlayers.length} Player${declinedPlayers.length > 1 ? 's' : ''} Declining`, body: `Age catching up: ${names}.` });
    }
    // Batched training injury message
    if (digestInjuries.length > 0) {
      newMessages = addMsg(newMessages, { week, season, type: 'injury', title: `Training Injuries (${digestInjuries.length})`, body: `Injured in training: ${digestInjuries.join(', ')}.` });
    }

    // Update training streaks and generate training report
    const newStreaks = updateStreaks(training.streaks, training.schedule);
    const trainingReport = generateTrainingReport(preTrainingPlayers, newPlayers, playerClub.playerIds, digestInjuries, newStreaks, week, season);

    // Leadership bonus: players with high leadership boost entire squad morale
    const squadForLeadership = playerClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
    const totalLeadershipBonus = squadForLeadership.reduce((sum, p) => sum + getLeadershipBonus(p.personality), 0);
    if (totalLeadershipBonus >= 0.15) {
      playerClub.playerIds.forEach(pid => {
        const p = newPlayers[pid];
        if (p) newPlayers[pid] = { ...p, morale: Math.min(100, p.morale + 1) };
      });
    }

    // Win streak bonuses
    const currentWinStreak = getWinStreak(playerClubId, fixtures);
    if (currentWinStreak >= STREAK_MORALE_THRESHOLD) {
      playerClub.playerIds.forEach(pid => {
        const p = newPlayers[pid];
        if (p) newPlayers[pid] = { ...p, morale: Math.min(100, p.morale + STREAK_MORALE_BONUS) };
      });
    }
    if (currentWinStreak >= STREAK_FORM_THRESHOLD) {
      playerClub.playerIds.forEach(pid => {
        const p = newPlayers[pid];
        if (p) newPlayers[pid] = { ...p, form: Math.min(100, p.form + STREAK_FORM_BONUS) };
      });
    }

    // Assistant manager boosts tactical familiarity gain
    const baseTactFam = updateTacticalFamiliarity(training, training.tacticalFamiliarity);
    const amBoost = assistantManagerBonus > 0 ? Math.round(assistantManagerBonus * ASSISTANT_MANAGER_FAMILIARITY_BOOST) : 0;
    const tactGeniusBoost = hasPerk(state.managerProgression, 'tactical_genius') ? Math.round((baseTactFam - training.tacticalFamiliarity) * 0.3) : 0;
    const careerTactBoost = (state.gameMode === 'career' && state.careerManager) ? Math.round((baseTactFam - training.tacticalFamiliarity) * state.careerManager.attributes.tacticalKnowledge * MOD_TACTICAL_FAMILIARITY) : 0;
    const newTacticalFamiliarity = Math.min(100, baseTactFam + amBoost + tactGeniusBoost + careerTactBoost);

    // International break: call up players, apply fitness cost, send notifications
    if (INTERNATIONAL_BREAK_WEEKS.includes(week)) {
      const playerClub = clubs[playerClubId];
      const calledUp: string[] = [];
      const snubbed: string[] = [];
      for (const pid of playerClub.playerIds) {
        const p = newPlayers[pid];
        if (!p || p.injured) continue;
        // Top nations (rough: any player with nationality matching a known nation and high enough OVR)
        if (p.overall >= INTERNATIONAL_CALLUP_MIN_OVR && p.age >= 17 && p.age <= 36) {
          calledUp.push(pid);
          newPlayers[pid] = {
            ...newPlayers[pid],
            fitness: Math.max(30, newPlayers[pid].fitness - INTERNATIONAL_BREAK_FITNESS_COST),
            morale: Math.min(100, newPlayers[pid].morale + NATIONAL_CALLUP_MORALE_BOOST),
            internationalCaps: (newPlayers[pid].internationalCaps || 0) + 1,
          };
        } else if (p.overall >= INTERNATIONAL_SNUB_MIN_OVR && p.age >= 17 && p.age <= 36) {
          snubbed.push(pid);
          newPlayers[pid] = {
            ...newPlayers[pid],
            morale: Math.max(0, newPlayers[pid].morale + CALLUP_SNUB_MORALE_PENALTY),
          };
        }
      }
      if (calledUp.length > 0) {
        const names = calledUp.slice(0, 5).map(id => newPlayers[id]?.lastName || 'Unknown').join(', ');
        const extra = calledUp.length > 5 ? ` and ${calledUp.length - 5} more` : '';
        newMessages = addMsg(newMessages, {
          week, season, type: 'general',
          title: 'International Break',
          body: `${calledUp.length} player${calledUp.length > 1 ? 's' : ''} called up for international duty: ${names}${extra}. They may return with reduced fitness.`,
        });
      }
    }

    // Simulate AI matches for player's division
    const weekMatches = fixtures.filter(m => m.week === week && !m.played);
    const updatedFixtures = [...fixtures];
    const aiMatches = weekMatches.filter(m => m.homeClubId !== playerClubId && m.awayClubId !== playerClubId);

    const updatedDivisionFixtures = { ...state.divisionFixtures };
    const playerDiv = state.playerDivision;

    // Mutable copy of power rankings — updated after every match this week
    const eloRankings = { ...(state.clubPowerRankings || {}) };

    for (const m of aiMatches) {
      const idx = updatedFixtures.findIndex(f => f.id === m.id);
      const hc = clubs[m.homeClubId];
      const ac = clubs[m.awayClubId];
      if (!hc || !ac) continue;
      const hAvail = hc.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
      const aAvail = ac.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
      const hp = hAvail.slice(0, 11);
      const ap = aAvail.slice(0, 11);
      const hBenchAI = hAvail.slice(11, 18);
      const aBenchAI = aAvail.slice(11, 18);
      // Forfeit if either team has no available players
      if (hp.length === 0 || ap.length === 0) {
        const forfeit = { ...m, played: true, homeGoals: hp.length === 0 ? 0 : 3, awayGoals: ap.length === 0 ? 0 : 3, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
        updatedFixtures[idx] = forfeit;
        continue;
      }
      // AI counter-tactics: each team reads the opponent's default setup
      const hProfile = hc.aiManagerProfile;
      const aProfile = ac.aiManagerProfile;
      const hTacticsAI = hProfile && aProfile ? getAICounterTactics(hProfile, aProfile.defaultTactics, ac.formation || '4-4-2') : undefined;
      const aTacticsAI = aProfile && hProfile ? getAICounterTactics(aProfile, hProfile.defaultTactics, hc.formation || '4-4-2') : undefined;
      const { result } = simulateMatch(m, hc, ac, hp, ap, hTacticsAI, aTacticsAI, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season, undefined, hBenchAI, aBenchAI);
      updatedFixtures[idx] = result;
      applyAIMatchEvents(result.events, newPlayers, clubs, week, hp, ap, result.homeGoals, result.awayGoals, eloRankings, m.homeClubId, m.awayClubId);
      updateEloRatings(eloRankings, m.homeClubId, m.awayClubId, result.homeGoals, result.awayGoals, 'league');
    }

    // Simulate cup matches for this week (and any orphaned ties from past weeks)
    let newCup = { ...state.cup, ties: [...state.cup.ties] };
    if (newCup.currentRound) {
      const cupWeekMatches = newCup.ties.filter(t => t.week <= week && !t.played && t.round === newCup.currentRound);
      for (const tie of cupWeekMatches) {
        const tieIdx = newCup.ties.findIndex(t => t.id === tie.id);
        const hClub = clubs[tie.homeClubId];
        const aClub = clubs[tie.awayClubId];
        if (!hClub || !aClub) continue;
        const hCupAvail = hClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
        const aCupAvail = aClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
        const hPlayers = hCupAvail.slice(0, 11);
        const aPlayers = aCupAvail.slice(0, 11);

        const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
        if (isPlayerMatch && tie.week === week) continue; // Player's current-week cup match is played interactively
        // Forfeit if either team has no available players
        if (hPlayers.length === 0 || aPlayers.length === 0) {
          const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
          newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : 3, awayGoals: aPlayers.length === 0 ? 0 : 3, winnerId };
          continue;
        }
        const { result: cupResult } = simulateMatch(
          { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season, undefined, hCupAvail.slice(11, 18), aCupAvail.slice(11, 18)
        );

        // Resolve draws via extra time then penalties
        let hGoals = cupResult.homeGoals;
        let aGoals = cupResult.awayGoals;
        let penaltyShootout: { home: number; away: number } | undefined;
        const cupEvents = [...cupResult.events];
        if (hGoals === aGoals) {
          // Extra time: each side has a chance to score based on team strength
          const homeStr = hClub.reputation / 5;
          const awayStr = aClub.reputation / 5;
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
            if (penHome > penAway) hGoals++;
            else aGoals++;
            cupEvents.push({ minute: 120, type: 'penalty_shootout', clubId: penHome > penAway ? tie.homeClubId : tie.awayClubId, description: `${penHome > penAway ? hClub.shortName : aClub.shortName} win on penalties (${penHome}-${penAway})!` });
          }
        }

        newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals, penaltyShootout };

        applyAIMatchEvents(cupResult.events, newPlayers, clubs, week, hPlayers, aPlayers, cupResult.homeGoals, cupResult.awayGoals, eloRankings, tie.homeClubId, tie.awayClubId);
        updateEloRatings(eloRankings, tie.homeClubId, tie.awayClubId, cupResult.homeGoals, cupResult.awayGoals, 'cup');

        // Cup match result message for player
        if (isPlayerMatch) {
          const isHome = tie.homeClubId === playerClubId;
          const won = isHome ? hGoals > aGoals : aGoals > hGoals;
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
          const winnerId = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId;
          newCup.winner = winnerId;
          newCup.currentRound = null;
          if (winnerId === playerClubId) {
            newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Cup Winners!', body: 'Congratulations! You have won the cup! The board and fans are ecstatic!' });
            newTimeline.push(createMilestone('cup_win', 'Cup Winners!', `Won the cup in Season ${season}!`, season, week, 'medal'));
          }
        } else {
          newCup = advanceCupRound(newCup);
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
        const hLcAvail = hClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
        const aLcAvail = aClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week));
        const hPlayers = hLcAvail.slice(0, 11);
        const aPlayers = aLcAvail.slice(0, 11);

        const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
        if (isPlayerMatch && tie.week === week) continue; // Player's current-week league cup match is played interactively

        if (hPlayers.length === 0 || aPlayers.length === 0) {
          const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
          newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : 3, awayGoals: aPlayers.length === 0 ? 0 : 3, winnerId };
          continue;
        }
        const { result: lcResult } = simulateMatch(
          { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season, undefined, hLcAvail.slice(11, 18), aLcAvail.slice(11, 18)
        );

        // League Cup: straight to penalties if drawn (no extra time in early rounds)
        let hGoals = lcResult.homeGoals;
        let aGoals = lcResult.awayGoals;
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
          if (penHome > penAway) hGoals++; else aGoals++;
        }

        newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals, penaltyShootout };
        applyAIMatchEvents(lcResult.events, newPlayers, clubs, week, hPlayers, aPlayers, lcResult.homeGoals, lcResult.awayGoals, eloRankings, tie.homeClubId, tie.awayClubId);
        updateEloRatings(eloRankings, tie.homeClubId, tie.awayClubId, lcResult.homeGoals, lcResult.awayGoals, 'cup');

        // League Cup match result message for player (orphaned past-week matches)
        if (isPlayerMatch) {
          const isHome = tie.homeClubId === playerClubId;
          const won = isHome ? hGoals > aGoals : aGoals > hGoals;
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
          const winnerId = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId;
          newLeagueCup.winner = winnerId;
          newLeagueCup.currentRound = null;
          if (winnerId === playerClubId) {
            newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'League Cup Winners!', body: 'You have won the League Cup!' });
            newTimeline.push(createMilestone('cup_win', 'League Cup Winners!', `Won the League Cup in Season ${season}!`, season, week, 'medal'));
          }
        } else {
          newLeagueCup = advanceLeagueCupRound(newLeagueCup);
        }
      }
    }

    // ── Domestic Super Cup Simulation ──
    let newDomesticSuperCup = state.domesticSuperCup;
    if (newDomesticSuperCup && !newDomesticSuperCup.played && week === DOMESTIC_SUPER_CUP_WEEK) {
      const hClub = clubs[newDomesticSuperCup.homeClubId];
      const aClub = clubs[newDomesticSuperCup.awayClubId];
      const isPlayerMatch = newDomesticSuperCup.homeClubId === playerClubId || newDomesticSuperCup.awayClubId === playerClubId;
      if (!isPlayerMatch && hClub && aClub) {
        // AI simulation
        const hAvailSC = hClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured);
        const hPlayers = hAvailSC.slice(0, 11);
        const hBenchSC = hAvailSC.slice(11, 18);
        const aAvailSC = aClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured);
        const aPlayers = aAvailSC.slice(0, 11);
        const aBenchSC = aAvailSC.slice(11, 18);
        if (hPlayers.length > 0 && aPlayers.length > 0) {
          const { result: scResult } = simulateMatch(
            { id: 'super-cup', week, homeClubId: newDomesticSuperCup.homeClubId, awayClubId: newDomesticSuperCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
            hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, 0, undefined, season, undefined, hBenchSC, aBenchSC
          );
          const winnerId = scResult.homeGoals > scResult.awayGoals ? newDomesticSuperCup.homeClubId :
            scResult.awayGoals > scResult.homeGoals ? newDomesticSuperCup.awayClubId :
            Math.random() < 0.5 ? newDomesticSuperCup.homeClubId : newDomesticSuperCup.awayClubId;
          newDomesticSuperCup = { ...newDomesticSuperCup, played: true, homeGoals: scResult.homeGoals, awayGoals: scResult.awayGoals, winnerId };
        }
      }
    }

    // ── Continental Super Cup Simulation ──
    let newContinentalSuperCup = state.continentalSuperCup;
    if (newContinentalSuperCup && !newContinentalSuperCup.played && week === CONTINENTAL_SUPER_CUP_WEEK) {
      const hClub = clubs[newContinentalSuperCup.homeClubId] || (state.virtualClubs || {})[newContinentalSuperCup.homeClubId];
      const aClub = clubs[newContinentalSuperCup.awayClubId] || (state.virtualClubs || {})[newContinentalSuperCup.awayClubId];
      const isPlayerMatch = newContinentalSuperCup.homeClubId === playerClubId || newContinentalSuperCup.awayClubId === playerClubId;
      if (!isPlayerMatch && hClub && aClub) {
        const hAvailCSC = (hClub as Club).playerIds ? (hClub as Club).playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured) : [];
        const hPlayers = hAvailCSC.slice(0, 11);
        const hBenchCSC = hAvailCSC.slice(11, 18);
        const aAvailCSC = (aClub as Club).playerIds ? (aClub as Club).playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured) : [];
        const aPlayers = aAvailCSC.slice(0, 11);
        const aBenchCSC = aAvailCSC.slice(11, 18);
        if (hPlayers.length > 0 && aPlayers.length > 0) {
          const { result: scResult } = simulateMatch(
            { id: 'continental-super-cup', week, homeClubId: newContinentalSuperCup.homeClubId, awayClubId: newContinentalSuperCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
            hClub as Club, aClub as Club, hPlayers, aPlayers, undefined, undefined, undefined, undefined, 0, undefined, season, undefined, hBenchCSC, aBenchCSC
          );
          const winnerId = scResult.homeGoals > scResult.awayGoals ? newContinentalSuperCup.homeClubId :
            scResult.awayGoals > scResult.homeGoals ? newContinentalSuperCup.awayClubId :
            Math.random() < 0.5 ? newContinentalSuperCup.homeClubId : newContinentalSuperCup.awayClubId;
          newContinentalSuperCup = { ...newContinentalSuperCup, played: true, homeGoals: scResult.homeGoals, awayGoals: scResult.awayGoals, winnerId };
        } else {
          // Forfeit if virtual clubs without real players — random winner
          const winnerId = Math.random() < 0.5 ? newContinentalSuperCup.homeClubId : newContinentalSuperCup.awayClubId;
          newContinentalSuperCup = { ...newContinentalSuperCup, played: true, homeGoals: winnerId === newContinentalSuperCup.homeClubId ? 1 : 0, awayGoals: winnerId === newContinentalSuperCup.awayClubId ? 1 : 0, winnerId };
        }
      }
    }

    // ── Continental Tournament Simulation ──
    let newChampionsCup = state.championsCup;
    let newShieldCup = state.shieldCup;
    let newConferenceCup = state.conferenceCup;
    const virtualClubs = state.virtualClubs || {};

    // Continental group stage matchdays
    const groupWeeks = CONTINENTAL_GROUP_WEEKS as readonly number[];
    if (groupWeeks.includes(week)) {
      if (newChampionsCup && newChampionsCup.currentPhase === 'group') {
        const md = getCurrentMatchday(newChampionsCup);
        if (groupWeeks[md - 1] === week) {
          newChampionsCup = simulateGroupMatchday(newChampionsCup, md, virtualClubs, playerClubId);
          // Check if group stage complete
          if (isGroupStageComplete(newChampionsCup)) {
            newChampionsCup = generateKnockoutFromGroups(newChampionsCup, playerClubId);
            if (!newChampionsCup.playerEliminated) {
              newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Champions Cup Knockout!', body: 'You have qualified for the Champions Cup knockout rounds!' });
            } else {
              newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: 'Champions Cup Eliminated', body: 'You have been eliminated from the Champions Cup group stage.' });
            }
          }
        }
      }
      if (newShieldCup && newShieldCup.currentPhase === 'group') {
        const md = getCurrentMatchday(newShieldCup);
        if (groupWeeks[md - 1] === week) {
          newShieldCup = simulateGroupMatchday(newShieldCup, md, virtualClubs, playerClubId);
          if (isGroupStageComplete(newShieldCup)) {
            newShieldCup = generateKnockoutFromGroups(newShieldCup, playerClubId);
            if (!newShieldCup.playerEliminated) {
              newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Shield Cup Knockout!', body: 'You have qualified for the Shield Cup knockout rounds!' });
            } else {
              newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: 'Shield Cup Eliminated', body: 'You have been eliminated from the Shield Cup group stage.' });
            }
          }
        }
      }
      if (newConferenceCup && newConferenceCup.currentPhase === 'group') {
        const md = getCurrentMatchday(newConferenceCup);
        if (groupWeeks[md - 1] === week) {
          newConferenceCup = simulateGroupMatchday(newConferenceCup, md, virtualClubs, playerClubId);
          if (isGroupStageComplete(newConferenceCup)) {
            newConferenceCup = generateKnockoutFromGroups(newConferenceCup, playerClubId);
            if (!newConferenceCup.playerEliminated) {
              newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Conference Cup Knockout!', body: 'You have qualified for the Conference Cup knockout rounds!' });
            } else {
              newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: 'Conference Cup Eliminated', body: 'You have been eliminated from the Conference Cup group stage.' });
            }
          }
        }
      }
    }

    // Continental knockout rounds
    const allKnockoutWeeks = [...CONTINENTAL_R16_WEEKS, ...CONTINENTAL_QF_WEEKS, ...CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK];
    if (allKnockoutWeeks.includes(week)) {
      for (const [tourney, setTourney] of [[newChampionsCup, (t: typeof newChampionsCup) => { newChampionsCup = t; }], [newShieldCup, (t: typeof newShieldCup) => { newShieldCup = t; }], [newConferenceCup, (t: typeof newConferenceCup) => { newConferenceCup = t; }]] as const) {
        if (!tourney || tourney.currentPhase !== 'knockout' || !tourney.currentRound || tourney.currentRound === 'group') continue;
        const round = tourney.currentRound as 'R16' | 'QF' | 'SF' | 'F';

        // Determine which leg this week corresponds to
        const weekArrays: Record<string, readonly number[]> = {
          R16: CONTINENTAL_R16_WEEKS, QF: CONTINENTAL_QF_WEEKS, SF: CONTINENTAL_SF_WEEKS, F: [CONTINENTAL_FINAL_WEEK],
        };
        const roundWeeks = weekArrays[round];
        if (!roundWeeks || !roundWeeks.includes(week)) continue;

        const leg = round === 'F' ? 1 : (week === roundWeeks[0] ? 1 : 2) as 1 | 2;
        const updated = simulateKnockoutLeg(tourney, round, leg, virtualClubs, playerClubId);

        // Check if round is complete
        if (isKnockoutRoundComplete(updated, round)) {
          const advanced = advanceKnockoutRound(updated, playerClubId);
          if (advanced.currentPhase === 'complete' && advanced.winnerId) {
            const compName = tourney.competition === 'champions_cup' ? 'Champions Cup' : 'Shield Cup';
            if (advanced.winnerId === playerClubId) {
              newMessages = addMsg(newMessages, { week, season, type: 'board', title: `${compName} Winners!`, body: `Incredible! You have won the ${compName}!` });
              newTimeline.push(createMilestone('cup_win', `${compName} Winners!`, `Won the ${compName} in Season ${season}!`, season, week, 'trophy'));
            }
          }
          setTourney(advanced);
        } else {
          setTourney(updated);
        }
      }
    }

    const newWeek = week + 1;
    const clubIds = Object.keys(clubs);
    const leagueTable = buildLeagueTable(updatedFixtures, state.divisionClubs[playerDiv] || clubIds);
    const transferWindowOpen = newWeek <= SUMMER_WINDOW_END || (newWeek >= WINTER_WINDOW_START && newWeek <= WINTER_WINDOW_END);

    // Sync player's division fixtures back into divisionFixtures
    updatedDivisionFixtures[playerDiv] = updatedFixtures;

    // Simulate non-player initialized leagues
    for (const leagueId of Object.keys(state.divisionClubs)) {
      if (leagueId === playerDiv) continue;
      const leagueFixtures = updatedDivisionFixtures[leagueId];
      if (!leagueFixtures) continue;
      const updatedLeagueFixtures = [...leagueFixtures];
      for (let i = 0; i < updatedLeagueFixtures.length; i++) {
        const m = updatedLeagueFixtures[i];
        if (m.week !== week || m.played) continue;
        const hc = clubs[m.homeClubId];
        const ac = clubs[m.awayClubId];
        if (!hc || !ac) continue;
        const hp = hc.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured).slice(0, 11);
        const ap = ac.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured).slice(0, 11);
        if (hp.length === 0 || ap.length === 0) {
          updatedLeagueFixtures[i] = { ...m, played: true, homeGoals: hp.length === 0 ? 0 : 3, awayGoals: ap.length === 0 ? 0 : 3, events: [] };
          continue;
        }
        const { result } = simulateMatch(m, hc, ac, hp, ap);
        updatedLeagueFixtures[i] = result;
      }
      updatedDivisionFixtures[leagueId] = updatedLeagueFixtures;
    }

    // Build all division tables
    const divisionTables = buildAllDivisionTables(updatedDivisionFixtures, state.divisionClubs);

    // Pre-season flag — used by rumor boost, offer multipliers, and market replenishment
    const isPreSeason = newWeek <= PRE_SEASON_END;

    // Transfer rumors — foreshadow potential incoming offers (batched into single message)
    if (transferWindowOpen) {
      const effectiveRumorChance = isPreSeason ? RUMOR_CHANCE * PRE_SEASON_RUMOR_MULTIPLIER : RUMOR_CHANCE;
      const rumorNames: string[] = [];
      const starPlayers = Object.values(newPlayers).filter(p => p.clubId === playerClubId && !p.listedForSale && p.overall >= 70 && !p.onLoan);
      for (const sp of starPlayers) {
        if (Math.random() < effectiveRumorChance) {
          const interestedClubs = Object.values(clubs).filter(c => c.id !== playerClubId && c.budget > sp.value * 0.5);
          if (interestedClubs.length > 0) {
            const rumorClub = pick(interestedClubs);
            rumorNames.push(`${sp.lastName} (${rumorClub.shortName})`);
          }
        }
      }
      if (rumorNames.length > 0) {
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'transfer',
          title: `Transfer Rumor${rumorNames.length > 1 ? 's' : ''}: ${rumorNames.length} Player${rumorNames.length > 1 ? 's' : ''}`,
          body: `Clubs are monitoring: ${rumorNames.join(', ')}. No official approaches yet.`,
        });
      }
    }

    // Expire stale offers and notify player
    let newOffers = [...state.incomingOffers];
    const expiredOffers = newOffers.filter(o => newWeek - o.week > OFFER_EXPIRY_WEEKS);
    if (expiredOffers.length > 0) {
      newOffers = newOffers.filter(o => newWeek - o.week <= OFFER_EXPIRY_WEEKS);
      for (const eo of expiredOffers) {
        const ep = newPlayers[eo.playerId];
        const ec = clubs[eo.buyerClubId];
        if (ep && ec) {
          newMessages = addMsg(newMessages, {
            week: newWeek, season, type: 'transfer',
            title: `Bid Expired: ${ep.lastName}`,
            body: `${ec.name}'s ${formatMoney(eo.fee)} offer for ${ep.firstName} ${ep.lastName} has expired.`,
          });
        }
      }
    }

    // Incoming offers — AI clubs only bid during transfer windows for positions they need
    if (transferWindowOpen) {
      const isDeadlineDay = newWeek === SUMMER_WINDOW_END || newWeek === WINTER_WINDOW_END;

      // Helper: attempt to generate an offer for a target player
      // valueOverride allows using asking price as base instead of raw player value
      const tryGenerateOffer = (tp: Player, feeBase: number, feeRange: number, valueOverride?: number) => {
        const effectiveValue = valueOverride ?? tp.value;
        const buyerClubs = Object.values(clubs).filter(c => {
          if (c.id === playerClubId) return false;
          if (c.budget < effectiveValue * AI_OFFER_MIN_BUDGET_RATIO) return false;
          if (newOffers.some(o => o.buyerClubId === c.id && o.playerId === tp.id)) return false;
          const squadPositions = c.playerIds.map(id => newPlayers[id]?.position).filter(Boolean);
          const posCount = squadPositions.filter(pos => pos === tp.position).length;
          return posCount < AI_OFFER_POSITION_THRESHOLD;
        });
        const candidates = shuffle([...buyerClubs]).slice(0, 3);
        const perfMult = getPerformanceMultiplier(tp);
        const contractFactor = getContractLengthFactor(tp.contractEnd, season);
        const injuryFactor = tp.injured
          ? (tp.injuryWeeks >= LONG_INJURY_WEEKS_THRESHOLD ? LONG_INJURY_BID_DISCOUNT : INJURY_BID_DISCOUNT)
          : 1;
        for (const buyer of candidates) {
          const buyerSquad = buyer.playerIds.map(id => newPlayers[id]?.position).filter(Boolean);
          const posCount = buyerSquad.filter(pos => pos === tp.position).length;
          const urgencyMult = posCount === 0 ? URGENCY_NONE : posCount === 1 ? URGENCY_ONE : URGENCY_TWO_PLUS;
          const deadlinePremium = isDeadlineDay ? 1 + DEADLINE_DAY_BID_PREMIUM : 1;
          let baseFee = effectiveValue * (feeBase + Math.random() * feeRange) * urgencyMult * deadlinePremium * perfMult * contractFactor * injuryFactor;
          // Competing bid premium — outbid existing offers for same player
          const existingOffers = newOffers.filter(o => o.playerId === tp.id);
          if (existingOffers.length > 0) {
            const highestExisting = Math.max(...existingOffers.map(o => o.fee));
            baseFee = Math.max(baseFee, highestExisting * (1 + COMPETING_BID_PREMIUM));
          }
          let offerFee = Math.round(baseFee);
          const maxAffordable = Math.round(buyer.budget * OFFER_MAX_BUDGET_RATIO);
          if (offerFee > maxAffordable && maxAffordable >= tp.value * 0.7) {
            offerFee = maxAffordable;
          }
          if (buyer.budget >= offerFee && offerFee <= buyer.budget * OFFER_MAX_BUDGET_RATIO) {
            const offer: IncomingOffer = { id: crypto.randomUUID(), playerId: tp.id, buyerClubId: buyer.id, fee: offerFee, week: newWeek };
            newOffers.push(offer);
            newMessages = addMsg(newMessages, {
              week: newWeek, season, type: 'transfer',
              title: `Bid for ${tp.lastName}`,
              body: `${buyer.name} have made a ${formatMoney(offerFee)} offer for ${tp.firstName} ${tp.lastName}.`,
            });
            return true;
          }
        }
        return false;
      };

      // Pre-season boost: more offers during friendlies period (weeks 1-3)
      const preSeasonOfferMult = isPreSeason ? PRE_SEASON_OFFER_MULTIPLIER : 1;
      const preSeasonUnsolicitedMult = isPreSeason ? PRE_SEASON_UNSOLICITED_MULTIPLIER : 1;

      // Listed player offers — anchor bids toward asking price when higher than value
      const listedPlayers = Object.values(newPlayers).filter(p => p.listedForSale && !p.onLoan && p.clubId === playerClubId);
      const currentMarket = state.transferMarket;
      for (const lp of listedPlayers) {
        const effectiveOfferChance = isDeadlineDay
          ? AI_OFFER_CHANCE * DEADLINE_DAY_OFFER_MULTIPLIER
          : AI_OFFER_CHANCE * preSeasonOfferMult;
        if (Math.random() < effectiveOfferChance) {
          const listing = currentMarket.find(l => l.playerId === lp.id);
          const askingFloor = listing ? listing.askingPrice * ASKING_PRICE_BID_ANCHOR : 0;
          const effectiveValue = Math.max(lp.value, askingFloor);
          tryGenerateOffer(lp, OFFER_FEE_BASE, OFFER_FEE_RANDOM_RANGE, effectiveValue);
        }
      }

      // Unsolicited bids for unhappy or star unlisted players
      const unsolicitedTargets = Object.values(newPlayers).filter(p =>
        p.clubId === playerClubId && !p.listedForSale && !p.onLoan &&
        (p.wantsToLeave || p.overall >= 75)
      );
      for (const tp of unsolicitedTargets) {
        if (Math.random() < UNSOLICITED_OFFER_CHANCE * preSeasonUnsolicitedMult) {
          tryGenerateOffer(tp, UNSOLICITED_FEE_BASE, UNSOLICITED_FEE_RANGE);
        }
      }
    }

    // Pre-match preview
    const nextMatch = updatedFixtures.find(m => m.week === newWeek && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    if (nextMatch) {
      const isHome = nextMatch.homeClubId === playerClubId;
      const oppClub = clubs[isHome ? nextMatch.awayClubId : nextMatch.homeClubId];
      if (oppClub) {
        const oppEntry = leagueTable.find(e => e.clubId === oppClub.id);
        const oppPos = oppEntry ? leagueTable.indexOf(oppEntry) + 1 : '?';
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'match_preview',
          title: `Next: ${isHome ? 'vs' : '@'} ${oppClub.shortName}`,
          body: `Your next match is ${isHome ? 'at home' : 'away'} against ${oppClub.name} (${oppPos}${typeof oppPos === 'number' ? getSuffix(oppPos) : ''} in the table). Prepare your tactics!`,
        });
        // Derby day message
        const derbyInt = getDerbyIntensity(nextMatch.homeClubId, nextMatch.awayClubId);
        const derbyNm = getDerbyName(nextMatch.homeClubId, nextMatch.awayClubId);
        if (derbyInt > 0 && derbyNm) {
          newMessages = addMsg(newMessages, {
            week: newWeek, season, type: 'match_preview',
            title: `Derby Day: ${derbyNm}`,
            body: `This is a rivalry match! The ${derbyNm} is one of the most intense fixtures on the calendar. Expect a heated atmosphere, more fouls, and higher stakes.`,
          });
        }
      }
    }

    // Dynamic storylines — emergent narrative events
    let pendingStorylineEvent: StorylineEvent | null = null;
    const recentMatches = updatedFixtures.filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)).slice(-5);
    const recentResults = { won: 0, drawn: 0, lost: 0 };
    {
      for (const rm of recentMatches) {
        const isH = rm.homeClubId === playerClubId;
        const gf = isH ? rm.homeGoals : rm.awayGoals;
        const ga = isH ? rm.awayGoals : rm.homeGoals;
        if (gf > ga) recentResults.won++;
        else if (gf === ga) recentResults.drawn++;
        else recentResults.lost++;
      }
      const posEntry = leagueTable.find(e => e.clubId === playerClubId);
      const leaguePos = posEntry ? leagueTable.indexOf(posEntry) + 1 : 10;
      const storylineResult = generateStorylines({
        week: newWeek, season, playerClubId, clubs, players: newPlayers,
        recentResults, leaguePosition: leaguePos, boardConfidence, fanMood: state.fanMood,
      });
      for (const s of storylineResult.messages) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: s.type, title: s.title, body: s.body });
      }
      // Store the storyline event for player choice (if any)
      pendingStorylineEvent = storylineResult.event;
    }

    // ── Multi-week Storyline Chains ──
    // Helper: interpolate {playerName} in storyline text using chain's target player
    const interpolatePlayerName = (text: string, chain: ActiveStorylineChain) => {
      if (!chain.targetPlayerId) return text;
      const p = newPlayers[chain.targetPlayerId];
      const name = p ? `${p.firstName} ${p.lastName}` : 'your star player';
      return text.replace(/\{playerName\}/g, name);
    };
    const interpolateEvent = (event: StorylineEvent, chain: ActiveStorylineChain): StorylineEvent => ({
      ...event,
      body: interpolatePlayerName(event.body, chain),
      options: event.options.map(opt => ({
        ...opt,
        text: interpolatePlayerName(opt.text, chain),
        effects: chain.targetPlayerId ? { ...opt.effects, targetPlayerId: chain.targetPlayerId } : opt.effects,
      })),
    });

    const newCompletedChainIds = [...(state.completedStorylineChainIds || [])];
    const updatedChains: ActiveStorylineChain[] = (state.activeStorylineChains || []).reduce<ActiveStorylineChain[]>((kept, chain) => {
      const chainDef = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
      if (!chainDef) return kept; // Remove chains with no definition

      const nextStepIdx = chain.currentStep + 1;
      if (nextStepIdx >= chainDef.steps.length) {
        // Chain complete — add completion summary and track as completed
        newCompletedChainIds.push(chain.chainId);
        const targetPlayer = chain.targetPlayerId ? newPlayers[chain.targetPlayerId] : null;
        const playerLabel = targetPlayer ? `${targetPlayer.firstName} ${targetPlayer.lastName}` : 'Your star player';
        const lastChoice = chain.choices[chain.choices.length - 1];
        const lastStep = chainDef.steps[chainDef.steps.length - 1];
        const chosenOption = lastStep?.options[lastChoice];
        const outcomeText = chosenOption ? `You chose: "${chosenOption.label}".` : '';
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'general',
          title: `${chainDef.name} — Resolved`,
          body: `The ${playerLabel} saga is over. ${outcomeText}`,
        });
        return kept; // Remove completed chain
      }

      const nextStep = chainDef.steps[nextStepIdx];
      const dueWeek = chain.startWeek + nextStep.weekOffset;

      if (newWeek >= dueWeek) {
        // Check if this step requires a specific previous choice
        if (nextStep.requiredPrevChoice !== undefined) {
          const prevChoice = chain.choices[chain.choices.length - 1];
          if (prevChoice !== nextStep.requiredPrevChoice) {
            // Skip this step — try the next one or end the chain
            kept.push({ ...chain, currentStep: nextStepIdx });
            return kept;
          }
        }

        // Trigger this chain step as a storyline event (only if no other event is pending)
        if (!pendingStorylineEvent) {
          const rawEvent: StorylineEvent = {
            id: `chain-${chain.chainId}-step-${nextStepIdx}`,
            title: nextStep.title,
            body: nextStep.body,
            icon: nextStep.icon,
            options: nextStep.options,
          };
          pendingStorylineEvent = interpolateEvent(rawEvent, chain);
          kept.push({ ...chain, currentStep: nextStepIdx });
        } else {
          kept.push(chain);
        }
      } else {
        kept.push(chain);
      }
      return kept;
    }, []);

    // Try to start a new chain (max 1 active, 15% chance per week)
    if (updatedChains.length === 0 && Math.random() < STORYLINE_CHAIN_TRIGGER_CHANCE && newWeek >= STORYLINE_CHAIN_MIN_WEEK) {
      const playerClub = clubs[playerClubId];
      const squadPlayers = Object.values(newPlayers).filter(p => p.clubId === playerClubId);
      const clubsList = Object.values(clubs);
      const avgBudget = clubsList.length > 0 ? clubsList.reduce((s, c) => s + c.budget, 0) / clubsList.length : 0;
      const completedChainIds = new Set<string>(newCompletedChainIds);
      for (const chainDef of STORYLINE_CHAINS) {
        if (completedChainIds.has(chainDef.id)) continue;
        const triggered = shouldTriggerChain(chainDef.id, {
          week: newWeek,
          recentWins: recentResults.won,
          recentLosses: recentResults.lost,
          boardConfidence,
          hasStarPlayer: squadPlayers.some(p => p.overall >= 75),
          hasYouthProspect: squadPlayers.some(p => p.age <= 21 && p.potential >= 75),
          budget: playerClub?.budget || 0,
          averageBudget: avgBudget,
        });
        if (triggered) {
          // Identify the target player for player-specific chains
          let targetPlayerId: string | undefined;
          if (chainDef.id === 'star-player-transfer-saga') {
            const starPlayer = squadPlayers
              .filter(p => p.overall >= 75 && !p.injured && !p.onLoan && !p.wantsToLeave && !p.listedForSale)
              .sort((a, b) => b.overall - a.overall)[0];
            if (starPlayer) targetPlayerId = starPlayer.id;
          }

          const newChain: ActiveStorylineChain = {
            chainId: chainDef.id,
            startWeek: newWeek,
            currentStep: 0,
            choices: [],
            targetPlayerId,
          };

          const firstStep = chainDef.steps[0];
          if (!pendingStorylineEvent) {
            const rawEvent: StorylineEvent = {
              id: `chain-${chainDef.id}-step-0`,
              title: firstStep.title,
              body: firstStep.body,
              icon: firstStep.icon,
              options: firstStep.options,
            };
            pendingStorylineEvent = interpolateEvent(rawEvent, newChain);
          }
          updatedChains.push(newChain);
          break;
        }
      }
    }

    // Contract expiry warnings — escalating urgency + morale impact for unhappy players
    if ((CONTRACT_WARNING_WEEKS as readonly number[]).includes(newWeek)) {
      const expiring = Object.values(newPlayers).filter(ep => ep.clubId === playerClubId && ep.contractEnd <= season && (ep.overall > CONTRACT_WARNING_OVERALL_THRESHOLD || (ep.age <= CONTRACT_WARNING_YOUTH_AGE_MAX && ep.potential >= CONTRACT_WARNING_YOUTH_POTENTIAL_MIN)));
      const urgency = newWeek >= 35 ? 'URGENT: ' : newWeek >= 30 ? '' : 'Reminder: ';
      for (const ep of expiring) {
        const youthNote = ep.overall <= CONTRACT_WARNING_OVERALL_THRESHOLD ? ' This prospect has high potential!' : '';
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'contract', title: `${urgency}${ep.lastName}'s Contract`, body: `${ep.firstName} ${ep.lastName}'s contract expires at the end of this season. ${newWeek >= 35 ? 'This player will leave for free!' : 'Consider renewing or selling.'}${youthNote}` });
        // Players with expiring contracts lose morale after week 25 — they want clarity
        if (newWeek >= CONTRACT_MORALE_HIT_WEEK_THRESHOLD && ep.overall >= CONTRACT_MORALE_HIT_OVERALL_THRESHOLD) {
          newPlayers[ep.id] = { ...newPlayers[ep.id], morale: Math.max(CONTRACT_MORALE_MIN, newPlayers[ep.id].morale + CONTRACT_MORALE_HIT_AMOUNT) };
        }
      }
    }

    // Transfer window messages
    if (newWeek === SUMMER_WINDOW_END - 1) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'Transfer Deadline Approaching', body: 'The summer transfer window closes next week. Finalise any deals now!' });
    if (newWeek === WINTER_WINDOW_START) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'January Window Opens', body: 'The winter transfer window is now open until Week 24.' });
    if (newWeek === WINTER_WINDOW_END - 1) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'Winter Deadline Approaching', body: 'The winter transfer window closes next week. Last chance for January deals!' });

    // ── Deadline Day Drama ──
    const deadlineBargains: { playerId: string; askingPrice: number; sellerClubId: string }[] = [];
    const isDeadlineDay = newWeek === SUMMER_WINDOW_END || newWeek === WINTER_WINDOW_END;
    if (isDeadlineDay) {
      const windowName = newWeek === SUMMER_WINDOW_END ? 'summer' : 'winter';

      // Generate panic incoming offers for player's club
      const playerClub = clubs[playerClubId];
      const playerSquad = playerClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
      const sellableTargets = playerSquad.filter(p => p.overall >= 65 && !p.injured && p.age <= 32);
      const aiClubIds = Object.keys(clubs).filter(id => id !== playerClubId);
      const deadlineBody = sellableTargets.length > 0
        ? `The ${windowName} transfer window slams shut tonight! Clubs are scrambling — expect desperate bids for your best players.`
        : `The ${windowName} transfer window closes tonight. Clubs across the league are finalising last-minute deals.`;
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'DEADLINE DAY', body: deadlineBody });
      for (const target of shuffle(sellableTargets).slice(0, DEADLINE_PANIC_OFFER_COUNT)) {
        const bidderId = aiClubIds[Math.floor(Math.random() * aiClubIds.length)];
        const bidder = clubs[bidderId];
        if (!bidder) continue;
        const panicFee = Math.round(target.value * (1 + DEADLINE_PANIC_BID_PREMIUM));
        if (panicFee > bidder.budget * 0.6) continue; // Don't bid more than 60% of budget
        const existingOffer = newOffers.find(o => o.playerId === target.id && o.buyerClubId === bidderId);
        if (existingOffer) continue;
        newOffers.push({ id: crypto.randomUUID(), playerId: target.id, buyerClubId: bidderId, fee: panicFee, week: newWeek });
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: `URGENT: Bid for ${target.lastName}`, body: `${bidder.name} have made a last-minute bid of £${(panicFee / 1e6).toFixed(1)}M for ${target.firstName} ${target.lastName}! Respond before the window closes.` });
        // Multi-bid: chance of a second club bidding for the same player
        if (Math.random() < DEADLINE_MULTI_BID_CHANCE) {
          const secondBidderId = aiClubIds.filter(id => id !== bidderId)[Math.floor(Math.random() * (aiClubIds.length - 1))];
          const secondBidder = secondBidderId ? clubs[secondBidderId] : null;
          if (secondBidder) {
            const rivalFee = Math.round(panicFee * 1.1); // 10% above first bid
            if (rivalFee <= secondBidder.budget * 0.6) {
              newOffers.push({ id: crypto.randomUUID(), playerId: target.id, buyerClubId: secondBidderId, fee: rivalFee, week: newWeek });
              newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: `BIDDING WAR: ${target.lastName}`, body: `${secondBidder.name} have entered the race for ${target.firstName} ${target.lastName} with a rival bid of £${(rivalFee / 1e6).toFixed(1)}M!` });
            }
          }
        }
      }

      // Add bargain listings from AI clubs dumping surplus players
      const bargainCount = Math.min(3, aiClubIds.length);
      for (let i = 0; i < bargainCount; i++) {
        const sellerId = aiClubIds[Math.floor(Math.random() * aiClubIds.length)];
        const sellerClub = clubs[sellerId];
        if (!sellerClub) continue;
        const surplus = sellerClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => p.overall >= 60 && p.overall <= 75 && p.age >= 27);
        const toSell = surplus[Math.floor(Math.random() * surplus.length)];
        if (!toSell) continue;
        const alreadyListed = deadlineBargains.some(l => l.playerId === toSell.id);
        if (alreadyListed) continue;
        const bargainPrice = Math.round(toSell.value * (1 - DEADLINE_BARGAIN_DISCOUNT));
        deadlineBargains.push({ playerId: toSell.id, askingPrice: Math.max(100000, bargainPrice), sellerClubId: sellerId });
      }
    }

    // Post-deadline summary (week after window closes)
    if (newWeek === SUMMER_WINDOW_END + 1 || newWeek === WINTER_WINDOW_END + 1) {
      const completedDeals = (state.transferNews || []).filter(n => n.week === newWeek - 1 && n.season === season).length;
      const expiredOffers = newOffers.filter(o => o.week <= newWeek - 1).length;
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Transfer Window Closed', body: `The window is shut. ${completedDeals} deals were completed league-wide${expiredOffers > 0 ? ` and ${expiredOffers} offer${expiredOffers > 1 ? 's' : ''} expired` : ''}. No more transfers until the ${newWeek <= 10 ? 'January' : 'summer'} window.` });
    }

    // Mid-season staff market refresh
    let newStaff = staff;
    if (newWeek === STAFF_MARKET_REFRESH_WEEK) {
      const refreshedHires = generateStaffMarket();
      newStaff = { ...staff, availableHires: refreshedHires };
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'New Staff Available', body: 'The mid-season staff market has refreshed. Check the Staff tab for new hiring options.' });
    }

    // Scouting tick
    const newScouting = { ...scouting, assignments: [...scouting.assignments], reports: [...scouting.reports], discoveredPlayers: [...scouting.discoveredPlayers] };
    const scoutQuality = getStaffBonus(staff.members, 'scout');
    const completedAssignments: string[] = [];
    const gemReveals: { playerId: string; region: string }[] = [];
    const scoutedListings: TransferListing[] = [];
    for (let i = 0; i < newScouting.assignments.length; i++) {
      const a = { ...newScouting.assignments[i] };
      const scoutReduction = hasPerk(state.managerProgression, 'scout_network') ? 2 : 1;
      const careerScoutBoost = (state.gameMode === 'career' && state.careerManager) ? Math.floor(state.careerManager.attributes.scoutingEye * MOD_SCOUTING_SPEED) : 0;
      a.weeksRemaining = Math.max(0, a.weeksRemaining - scoutReduction - careerScoutBoost);
      newScouting.assignments[i] = a;
      if (a.weeksRemaining === 0) {
        completedAssignments.push(a.id);
        const { reports: newReports, players: scoutedPlayers } = completeAssignment(a, scoutQuality, season, newWeek);
        newScouting.reports.push(...newReports);
        let gemReveal: { playerId: string; region: string } | null = null;
        // Pick random AI clubs to act as sellers for scouted players
        const aiClubIds = Object.keys(clubs).filter(id => id !== playerClubId);
        scoutedPlayers.forEach(p => {
          // Assign scouted player to a random AI club so the transfer flow works
          const sellerClubId = aiClubIds[Math.floor(Math.random() * aiClubIds.length)];
          p.clubId = sellerClubId;
          newPlayers[p.id] = p;
          newScouting.discoveredPlayers.push(p.id);
          // Add scouted player to transfer market so user can sign via standard flow
          scoutedListings.push({
            playerId: p.id,
            askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)),
            sellerClubId,
            scoutedPlayer: true,
          });
          // Detect hidden gem: potential 80+ player
          if (p.potential >= 80 && !gemReveal) {
            gemReveal = { playerId: p.id, region: a.region };
          }
        });
        if (gemReveal) {
          gemReveals.push(gemReveal);
        }
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'general',
          title: `Scout Report: ${a.region}`,
          body: `Your scout has returned from ${a.region} with ${newReports.length} player report(s). Check the scouting tab.`,
        });
      }
    }
    newScouting.assignments = newScouting.assignments.filter(a => !completedAssignments.includes(a.id));
    // Cap scout reports to prevent unbounded growth
    if (newScouting.reports.length > MAX_SCOUT_REPORTS) {
      newScouting.reports = newScouting.reports.slice(-MAX_SCOUT_REPORTS);
    }
    // Auto-dismiss stale reports for players no longer on the market and not on user's club
    const currentMarketIds = new Set(get().transferMarket.map(l => l.playerId));
    const stalePlayerIds: string[] = [];
    newScouting.reports = newScouting.reports.filter(r => {
      if (currentMarketIds.has(r.playerId)) return true;
      const p = newPlayers[r.playerId];
      if (p && p.clubId === playerClubId) return true;
      stalePlayerIds.push(r.playerId);
      return false;
    });
    // Also clean watch list for auto-dismissed reports
    if (stalePlayerIds.length > 0) {
      const staleSet = new Set(stalePlayerIds);
      const currentWatchList = get().scoutWatchList;
      const cleanedWatchList = currentWatchList.filter(id => !staleSet.has(id));
      if (cleanedWatchList.length < currentWatchList.length) {
        set({ scoutWatchList: cleanedWatchList });
      }
    }
    // Add scouted player listings to the transfer market
    if (scoutedListings.length > 0) {
      const currentMarket = get().transferMarket;
      set({ transferMarket: [...currentMarket, ...scoutedListings] });
    }

    // Facility upgrade tick
    let newFacilities = { ...facilities };
    if (newFacilities.upgradeInProgress) {
      const upgrade = { ...newFacilities.upgradeInProgress };
      upgrade.weeksRemaining = Math.max(0, upgrade.weeksRemaining - 1);
      if (upgrade.weeksRemaining === 0) {
        if (upgrade.type.startsWith('stadium-')) {
          const standName = upgrade.type.replace('stadium-', '');
          const validStands = ['north', 'south', 'east', 'west'] as const;
          if (validStands.includes(standName as typeof validStands[number])) {
            const stand = standName as typeof validStands[number];
            const newLevel = Math.min(FACILITY_MAX_LEVEL, newFacilities.stadiumStands[stand] + 1);
            const newStands = { ...newFacilities.stadiumStands, [stand]: newLevel };
            newFacilities = { ...newFacilities, stadiumStands: newStands, upgradeInProgress: null };
            const standLabel = stand.charAt(0).toUpperCase() + stand.slice(1) + ' Stand';
            newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: `Upgrade Complete`, body: `${standLabel} has been upgraded to level ${newLevel}!` });
          } else {
            newFacilities = { ...newFacilities, upgradeInProgress: null };
          }
        } else {
          const key = `${upgrade.type}Level` as keyof Pick<FacilitiesState, 'trainingLevel' | 'youthLevel' | 'medicalLevel' | 'recoveryLevel'>;
          const newLevel = Math.min(FACILITY_MAX_LEVEL, (newFacilities[key] as number) + 1);
          newFacilities = { ...newFacilities, [key]: newLevel, upgradeInProgress: null };
          newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: `Upgrade Complete`, body: `Your ${upgrade.type} facility has been upgraded to level ${(newFacilities[key] as number)}!` });
        }
      } else {
        newFacilities = { ...newFacilities, upgradeInProgress: upgrade };
      }
    }

    // Youth development tick — stagnation + bust mechanic
    const youthCoachQuality = getStaffBonus(staff.members, 'youth-coach');
    const newYouthAcademy = { ...state.youthAcademy, prospects: [...state.youthAcademy.prospects] };
    for (let i = 0; i < newYouthAcademy.prospects.length; i++) {
      const prospect = { ...newYouthAcademy.prospects[i] };
      const yp = newPlayers[prospect.playerId];
      if (yp) {
        // Stagnation: higher chance for low-potential (8% vs 3%)
        const stagnationChance = yp.potential < 50 ? 0.08 : yp.potential < 60 ? 0.05 : 0.01;
        if (Math.random() < stagnationChance) {
          // No development gain this week — prospect stalled
        } else {
          const baseDevGain = 1 + youthCoachQuality * 0.3 + newFacilities.youthLevel * 0.2;
          const careerYouthMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.youthDevelopment * MOD_YOUTH_GROWTH : 0;
          const ydm = dynastyMult(state.managerProgression);
          const devGain = hasPerk(state.managerProgression, 'youth_developer') ? baseDevGain * (1 + YOUTH_DEVELOPER_BOOST * ydm + careerYouthMod) : baseDevGain * (1 + careerYouthMod);
          prospect.developmentScore = Math.min(100, prospect.developmentScore + devGain);
        }
        // Bust risk: low-potential prospects can lose potential permanently (1% per week)
        const bustChance = yp.potential < 55 ? 0.01 : yp.potential < 65 ? 0.005 : 0;
        if (Math.random() < bustChance) {
          const drop = 3 + Math.floor(Math.random() * 3); // lose 3-5 potential
          const bustedPlayer = { ...yp, potential: Math.max(yp.overall, yp.potential - drop) };
          newPlayers[prospect.playerId] = bustedPlayer;
          newMessages = addMsg(newMessages, {
            week: newWeek, season, type: 'development',
            title: `${yp.lastName} Stalling`,
            body: `Youth prospect ${yp.firstName} ${yp.lastName}'s development ceiling appears to have dropped. Potential now ${bustedPlayer.potential}.`,
          });
        }
        prospect.readyToPromote = yp.overall >= 55 || prospect.developmentScore >= 80;
        newYouthAcademy.prospects[i] = prospect;
      }
    }

    // Weekly income — expanded sources
    const newClubs = { ...clubs };
    const fanFavMult = hasPerk(state.managerProgression, 'fan_favourite') ? 1 + 0.15 * dynastyMult(state.managerProgression) : 1;
    const stadiumIncome = Math.round(getEffectiveStadiumLevel(newFacilities) * STADIUM_INCOME_PER_LEVEL * fanFavMult);
    const fanMoodMult = FAN_MOOD_BASE + (state.fanMood / 100) * FAN_MOOD_SCALE;
    // Derby income bonus: check if this week's played match was a derby
    const thisWeekMatch = updatedFixtures.find(m => m.week === week && m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const derbyIncomeIntensity = thisWeekMatch ? getDerbyIntensity(thisWeekMatch.homeClubId, thisWeekMatch.awayClubId) : 0;
    const derbyIncomeBonus = derbyIncomeIntensity > 0 ? 1 + 0.25 * derbyIncomeIntensity : 1;
    const streakIncomeMult = currentWinStreak >= STREAK_INCOME_THRESHOLD ? 1 + STREAK_INCOME_MULTIPLIER : 1;
    const matchdayIncome = Math.round(playerClub.fanBase * MATCHDAY_INCOME_PER_FAN * fanMoodMult * derbyIncomeBonus * streakIncomeMult);
    const commercialIncome = Math.round(COMMERCIAL_INCOME_BASE + playerClub.reputation * COMMERCIAL_INCOME_PER_REP);
    // League position prize money: higher position = more income
    const playerTableIdx = leagueTable.findIndex(e => e.clubId === playerClubId);
    const playerTablePos = playerTableIdx >= 0 ? playerTableIdx + 1 : leagueTable.length;
    const positionPrize = Math.max(0, (POSITION_PRIZE_MAX_RANK - playerTablePos)) * POSITION_PRIZE_PER_RANK;
    // Sponsorship: sum of active sponsor deals
    const sponsorIncome = state.sponsorDeals.reduce((sum, d) => sum + d.weeklyPayment, 0);
    // Merchandise: strategic system with product lines, pricing, campaigns, star players
    const merchandiseIncome = calculateWeeklyMerchRevenue(
      state.merchandise, playerClub, state.players, state.playerDivision, state.managerProgression
    );
    const weeklyIncome = matchdayIncome + commercialIncome + stadiumIncome + positionPrize + sponsorIncome + merchandiseIncome;
    const staffWages = staff.members.reduce((sum, s) => sum + s.wage, 0);
    // Scouting costs: each active assignment costs money per week
    const scoutingCosts = newScouting.assignments.length * SCOUTING_COST_PER_ASSIGNMENT;
    // Manager salary: deducted weekly from club budget and accumulated as personal wealth
    const managerSalary = state.careerManager?.contract?.salary ?? 0;
    const totalExpenses = playerClub.wageBill + staffWages + scoutingCosts + managerSalary;
    const updatedWealth = (state.careerManager?.personalWealth ?? 0) + managerSalary;
    newClubs[playerClubId] = { ...playerClub, budget: playerClub.budget + weeklyIncome - totalExpenses };

    // Accumulate season-level income/expense totals for SeasonHistory enrichment
    const prevSeasonIncome = state.seasonTotalIncome || 0;
    const prevSeasonExpenses = state.seasonTotalExpenses || 0;

    // Financial Fair Play check: warn/penalise when wages are too high relative to income
    let newBoardConfidence = boardConfidence;
    const wageToRevenueRatio = weeklyIncome > 0 ? totalExpenses / weeklyIncome : 1;
    if (wageToRevenueRatio >= FFP_WAGE_RATIO_CRITICAL) {
      newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence - FFP_CRITICAL_CONFIDENCE_PENALTY);
      if (newWeek % 4 === 0) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'FFP: Critical Warning!', body: `Your wage bill is ${Math.round(wageToRevenueRatio * 100)}% of revenue. The board demands immediate action to reduce spending or face severe consequences.` });
      }
    } else if (wageToRevenueRatio >= FFP_WAGE_RATIO_WARNING) {
      newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence - FFP_CONFIDENCE_PENALTY);
      if (newWeek % 8 === 0) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'FFP: Spending Warning', body: `Your wage bill is ${Math.round(wageToRevenueRatio * 100)}% of revenue. The board urges you to manage finances more carefully.` });
      }
    }

    // Manager salary-to-income ratio check: board concern when manager is overpaid relative to club revenue
    if (managerSalary > 0 && weeklyIncome > 0) {
      const salaryToIncomeRatio = managerSalary / weeklyIncome;
      if (salaryToIncomeRatio >= MANAGER_SALARY_RATIO_CRITICAL) {
        newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence - MANAGER_SALARY_CONFIDENCE_PENALTY);
        if (newWeek % 8 === 0) {
          newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Manager Compensation Concern', body: `The board feels your salary (£${(managerSalary / 1000).toFixed(1)}k/wk) is excessive relative to club revenue. Consider growing the club's income to justify your compensation.` });
        }
      } else if (salaryToIncomeRatio >= MANAGER_SALARY_RATIO_WARNING) {
        newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence - MANAGER_SALARY_CONFIDENCE_PENALTY);
        if (newWeek % 12 === 0) {
          newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Salary Review', body: `The board notes your compensation accounts for ${Math.round(salaryToIncomeRatio * 100)}% of weekly revenue. Growing the club's income would ease financial pressure.` });
        }
      }
    }

    const newFinanceHistory = [...state.financeHistory, {
      week: newWeek, season, income: weeklyIncome, expenses: totalExpenses, transfers: 0, balance: newClubs[playerClubId].budget,
    }].slice(-MAX_FINANCE_HISTORY);

    // ── Merchandise weekly tick ──
    const newMerch = { ...state.merchandise };
    // Track season revenue
    newMerch.currentSeasonRevenue += merchandiseIncome;
    // Decrement campaign timer
    if (newMerch.activeCampaign) {
      const remaining = newMerch.activeCampaign.weeksRemaining - 1;
      if (remaining <= 0) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Campaign Ended', body: `Your ${newMerch.activeCampaign.type.replace(/_/g, ' ')} campaign has finished.` });
        newMerch.activeCampaign = null;
        newMerch.campaignCooldownWeeks = MERCH_CAMPAIGN_COOLDOWN_WEEKS;
      } else {
        newMerch.activeCampaign = { ...newMerch.activeCampaign, weeksRemaining: remaining };
      }
    }
    // Decrement cooldown
    if (newMerch.campaignCooldownWeeks > 0) newMerch.campaignCooldownWeeks -= 1;
    // Decrement star player dip / signing buzz
    if (newMerch.starPlayerDip > 0) newMerch.starPlayerDip -= 1;
    if (newMerch.starSigningBuzz > 0) newMerch.starSigningBuzz -= 1;
    // Apply pricing fan mood impact
    const pricingMoodDelta = MERCH_PRICING_TIERS[newMerch.pricingTier].fanMoodImpact;
    const cultHeroFloor = hasPerk(state.managerProgression, 'cult_hero') ? 40 : 0;
    const merchFanMood = Math.max(cultHeroFloor, Math.min(100, state.fanMood + pricingMoodDelta));

    // Process sponsorship system (offers, satisfaction, new deals)
    const sponsorUpdates = processSponsorWeek({ ...state, week: newWeek, clubs: newClubs, messages: newMessages, currentMatchResult: thisWeekMatch ? state.currentMatchResult : null });
    if (sponsorUpdates.messages) newMessages = sponsorUpdates.messages;

    // Evaluate board objectives based on current league position
    const playerPos = playerTableIdx >= 0 ? playerTableIdx + 1 : 20;
    const updatedObjectives = state.boardObjectives.map(obj => {
      const o = { ...obj };

      // Structured evaluation (new format with checkType)
      if (obj.checkType === 'league_position') {
        o.completed = playerPos <= (obj.targetMin ?? 20);
        o.overachieved = obj.targetOverachieve != null && playerPos <= obj.targetOverachieve;
        o.progressCurrent = playerPos;
      } else if (obj.checkType === 'cup_round') {
        // targetMin: 1=Winner, 2=SF+, 3=QF+
        const cupStage = obj.targetMin ?? 4;
        if (cupStage <= 1) o.completed = newCup.winner === playerClubId;
        else if (cupStage <= 2) { const ok = ['SF', 'F'].includes(newCup.currentRound || '') || newCup.winner != null; o.completed = !newCup.eliminated && ok; }
        else { const ok = ['QF', 'SF', 'F'].includes(newCup.currentRound || '') || newCup.winner != null; o.completed = !newCup.eliminated && ok; }
        // Overachieve check
        if (obj.targetOverachieve != null) {
          if (obj.targetOverachieve <= 1) o.overachieved = newCup.winner === playerClubId;
          else if (obj.targetOverachieve <= 2) { const ok = ['SF', 'F'].includes(newCup.currentRound || '') || newCup.winner != null; o.overachieved = !newCup.eliminated && ok; }
        }
      } else if (obj.checkType === 'budget') {
        o.completed = newClubs[playerClubId].budget >= (obj.targetMin ?? 0);
      } else {
        // Legacy string-matching fallback (backward compat for old saves)
        if (obj.description === 'Win the League') o.completed = playerPos === 1;
        else if (obj.description === 'Finish in Top 3') o.completed = playerPos <= 3;
        else if (obj.description === 'Finish in Top 6') o.completed = playerPos <= 6;
        else if (obj.description === 'Reach Top Half' || obj.description === 'Finish in Top Half') o.completed = playerPos <= 10;
        else if (obj.description.startsWith('Avoid Replacement')) {
          const posMatch = obj.description.match(/Top (\d+)/);
          const sp = posMatch ? parseInt(posMatch[1]) : 17;
          o.completed = playerPos <= sp;
        }
        else if (obj.description === 'Stay within budget') o.completed = newClubs[playerClubId].budget >= 0;
        else if (obj.description === 'Win the Cup') o.completed = newCup.winner === playerClubId;
        else if (obj.description === 'Reach Cup Semi-Final') {
          const sfOrBetter = ['SF', 'F'].includes(newCup.currentRound || '') || newCup.winner != null;
          o.completed = !newCup.eliminated && sfOrBetter;
        }
        else if (obj.description === 'Reach Cup Quarter-Final') {
          const qfOrBetter = ['QF', 'SF', 'F'].includes(newCup.currentRound || '') || newCup.winner != null;
          o.completed = !newCup.eliminated && qfOrBetter;
        }
      }
      return o;
    });

    // Check for new achievements
    const pendingState = { ...state, week: newWeek, clubs: newClubs, players: newPlayers, leagueTable, fixtures: updatedFixtures };
    const newAchievements = checkAchievements(pendingState as GameState, state.unlockedAchievements);
    const allUnlocked = [...state.unlockedAchievements, ...newAchievements];

    // Notify newly unlocked achievements — grant XP + queue for celebration modal
    let achievementXPTotal = 0;
    for (const id of newAchievements) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        const achXP = getAchievementXP(ach.tier);
        achievementXPTotal += achXP;
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'general',
          title: `Achievement Unlocked: ${ach.title}`,
          body: `${ach.description} — Earned ${achXP} XP!`,
        });
      }
    }

    // Challenge mode: check for mid-season failure (e.g., Invincibles losing a match)
    let updatedChallenge = state.activeChallenge;
    if (updatedChallenge && !updatedChallenge.completed && !updatedChallenge.failed) {
      const myEntry = leagueTable.find(e => e.clubId === playerClubId);
      const hasLost = myEntry ? myEntry.lost > 0 : false;
      if (checkChallengeFailed(updatedChallenge.scenarioId, updatedChallenge.seasonsRemaining, playerPos, hasLost)) {
        updatedChallenge = { ...updatedChallenge, failed: true };
        const scenario = CHALLENGES.find(c => c.id === updatedChallenge!.scenarioId);
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'board',
          title: 'Challenge Failed!',
          body: `You have failed the "${scenario?.name || 'challenge'}" challenge. ${scenario?.id === 'invincibles' ? 'You suffered a defeat.' : 'Better luck next time.'}`,
        });
      }
    }

    // Loan development: loaned-out players gain appearances and develop based on loan club quality
    for (const loan of state.activeLoans) {
      const loanedPlayer = newPlayers[loan.playerId];
      if (!loanedPlayer || !loanedPlayer.onLoan) continue;
      const loanClub = clubs[loan.toClubId];
      if (!loanClub) continue;
      // 60% chance of playing each week (based on loan club quality vs player quality)
      const playChance = loanedPlayer.overall <= (loanClub.reputation * LOAN_QUALITY_FORMULA_REP_MULT + LOAN_QUALITY_FORMULA_BASE) ? LOAN_PLAY_CHANCE_HIGH : LOAN_PLAY_CHANCE_LOW;
      if (Math.random() < playChance) {
        const lp = { ...loanedPlayer };
        lp.appearances += 1;
        // Fitness and form fluctuate based on simulated match performance
        lp.fitness = Math.max(50, Math.min(100, lp.fitness - LOAN_FITNESS_DRAIN + Math.floor(Math.random() * 6)));
        lp.form = Math.min(100, Math.max(20, lp.form + Math.floor(Math.random() * 10) - 4));
        lp.morale = Math.min(100, Math.max(30, lp.morale + 2)); // playing regularly boosts morale
        // Development: young players on loan develop from playing time
        if (lp.age < LOAN_YOUNG_AGE_THRESHOLD && lp.overall < lp.potential) {
          const loanMasterMult = hasPerk(state.managerProgression, 'loan_master') ? 1.3 : 1;
          const devChance = (LOAN_DEV_BASE_CHANCE + (loanClub.reputation * LOAN_DEV_REP_FACTOR)) * loanMasterMult;
          if (Math.random() < devChance) {
            const attrs = { ...lp.attributes };
            const attrKeys = Object.keys(attrs) as (keyof PlayerAttributes)[];
            const attr = attrKeys[Math.floor(Math.random() * attrKeys.length)];
            attrs[attr] = Math.min(99, attrs[attr] + 1);
            lp.attributes = attrs;
            lp.overall = calculateOverall(attrs, lp.position);
            // Recalculate value after development
            let ageMult = 0.25;
            for (const tier of VALUE_AGE_MULTIPLIERS) {
              if (lp.age <= tier.maxAge) { ageMult = tier.multiplier; break; }
            }
            lp.value = Math.round(calculatePlayerValue(lp.overall) * ageMult);
          }
        }
        newPlayers[loan.playerId] = lp;
      }
    }

    // Board mid-season review
    if (BOARD_REVIEW_WEEKS.includes(newWeek)) {
      const expectedPos = getExpectedPosition(playerClub.reputation);
      const actualPos = playerTableIdx >= 0 ? playerTableIdx + 1 : 20;
      const diff = actualPos - expectedPos; // positive = underperforming, negative = overperforming
      let reviewBody = '';

      if (diff <= -5) {
        reviewBody = `The board acknowledges your excellent work. Finishing ${actualPos}${getSuffix(actualPos)} exceeds expectations. Keep it up!`;
      } else if (diff <= 0) {
        reviewBody = `The board is satisfied with progress. Current position of ${actualPos}${getSuffix(actualPos)} meets expectations.`;
      } else if (diff <= 3) {
        reviewBody = `The board notes the team is underperforming. A position of ${actualPos}${getSuffix(actualPos)} is below expectations. Improvement is needed.`;
      } else {
        reviewBody = `The board is deeply unhappy. Current position of ${actualPos}${getSuffix(actualPos)} is well below the expected ${expectedPos}${getSuffix(expectedPos)}. Results must improve immediately.`;
      }

      // Adjust league position objectives based on performance
      const lid = state.playerDivision;
      const lge = LEAGUES.find(l => l.id === lid);
      const tc = lge?.teamCount || 20;
      let adjustmentNote = '';
      for (let i = 0; i < updatedObjectives.length; i++) {
        const obj = updatedObjectives[i];
        if (obj.checkType !== 'league_position' || obj.targetMin == null) continue;

        if (diff >= BOARD_REVIEW_RAISE_THRESHOLD && obj.targetMin > 1) {
          // Underperforming badly — relax targets
          const relaxed = Math.min(tc, obj.targetMin + BOARD_REVIEW_ADJUST_POSITIONS);
          updatedObjectives[i] = { ...obj,
            originalDescription: obj.originalDescription || obj.description,
            originalTargetMin: obj.originalTargetMin ?? obj.targetMin,
            targetMin: relaxed,
            description: relaxed === 1 ? 'Win the League' : `Finish in Top ${relaxed}`,
            adjusted: true,
          };
          adjustmentNote = ' The board has relaxed your league target given the circumstances.';
        } else if (diff <= BOARD_REVIEW_RELAX_THRESHOLD && obj.targetMin > 1) {
          // Overperforming — raise expectations
          const raised = Math.max(1, obj.targetMin - BOARD_REVIEW_ADJUST_POSITIONS);
          updatedObjectives[i] = { ...obj,
            originalDescription: obj.originalDescription || obj.description,
            originalTargetMin: obj.originalTargetMin ?? obj.targetMin,
            targetMin: raised,
            description: raised === 1 ? 'Win the League' : `Finish in Top ${raised}`,
            adjusted: true,
          };
          adjustmentNote = ' Impressed by your form, the board has raised expectations.';
        }
      }

      const reviewTitle = diff <= -5 ? 'Board Review: Impressive' : diff <= 0 ? 'Board Review: On Track' : diff <= 3 ? 'Board Review: Concerns' : 'Board Review: Serious Concerns';
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: reviewTitle, body: reviewBody + adjustmentNote });
    }

    // Evaluate monthly objectives — mark completions every week, cycle every OBJECTIVE_CYCLE_WEEKS weeks
    const objCtx: ObjectiveContext = {
      playerClubId, players: newPlayers, playerIds: playerClub.playerIds,
      fixtures: updatedFixtures, leagueTable, week, season, lineup: playerClub.lineup,
    };
    const currentStreak = state.objectiveStreak || 0;
    const objStartWeek = state.objectivesStartWeek || 1;
    const monthComplete = (newWeek - objStartWeek) >= OBJECTIVE_CYCLE_WEEKS;

    // Always evaluate to mark newly-completed objectives (ignore xpEarned — it only counts new completions)
    const { updated: evalObjectives } = evaluateObjectives(state.weeklyObjectives, objCtx, currentStreak);

    let updatedProgression = state.managerProgression;
    if (achievementXPTotal > 0) {
      updatedProgression = grantXP(updatedProgression, achievementXPTotal);
    }

    let newObjectives = evalObjectives;
    let newObjectivesStartWeek = objStartWeek;
    let finalStreak = currentStreak;

    if (monthComplete) {
      // Month is over — calculate XP from ALL completed objectives in this batch
      const { xpEarned: monthXP, allCompleted: objAllCompleted, newStreak } = calculateCompletedXP(evalObjectives, currentStreak);
      if (monthXP > 0) {
        updatedProgression = grantXP(updatedProgression, monthXP);
        const completedCount = evalObjectives.filter(o => o.completed).length;
        let objMsg = `You earned ${monthXP} XP from this month's objectives!`;
        if (objAllCompleted) objMsg += ' PERFECT MONTH — all objectives complete!';
        if (newStreak >= 3) objMsg += ` Streak x${newStreak} — bonus multiplier active!`;
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'general',
          title: `Monthly Objectives: ${completedCount}/${evalObjectives.length} Complete`,
          body: objMsg,
        });
      }
      finalStreak = newStreak;
      const nextWeekHasMatch = updatedFixtures.some(m => !m.played && m.week === newWeek && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
      newObjectives = generateMonthlyObjectives(nextWeekHasMatch);
      newObjectivesStartWeek = newWeek;
    }

    // Generate cliffhangers for "one more week" pull
    const cliffhangers = generateCliffhangers({
      playerClubId, players: newPlayers, clubs: newClubs,
      fixtures: updatedFixtures, leagueTable, week: newWeek, season,
      boardConfidence: newBoardConfidence,
      transferWindowOpen,
      rivalries: state.rivalries,
    });

    // Update session stats
    const prevSession = state.sessionStats || { startWeek: week, startSeason: season, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 };
    const newlyCompleted = evalObjectives.filter(o => o.completed).length - state.weeklyObjectives.filter(o => o.completed).length;
    const monthXPForSession = monthComplete ? calculateCompletedXP(evalObjectives, currentStreak).xpEarned : 0;
    const sessionStats = {
      ...prevSession,
      weeksPlayed: prevSession.weeksPlayed + 1,
      xpEarned: prevSession.xpEarned + monthXPForSession,
      objectivesCompleted: prevSession.objectivesCompleted + Math.max(0, newlyCompleted),
    };

    // Compute digest
    const newAvgMorale = (() => {
      const ids = playerClub.playerIds;
      if (ids.length === 0) return 0;
      return Math.round(ids.reduce((s, id) => s + (newPlayers[id]?.morale || 0), 0) / ids.length);
    })();
    const digestOffersReceived = newOffers.length - state.incomingOffers.length;

    // Guarantee at least one narrative message per week
    const newMessageCount = newMessages.length - messages.length;
    if (newMessageCount <= 1) {
      const myEntry = leagueTable.find(e => e.clubId === playerClubId);
      const myPos = myEntry ? leagueTable.indexOf(myEntry) + 1 : 0;
      const totalTeams = leagueTable.length;
      const posLabel = myPos > 0 ? `${myPos}${getSuffix(myPos)}` : '';
      const narrativePool: { title: string; body: string }[] = [];

      // Morale-based
      if (newAvgMorale >= 75) narrativePool.push({ title: 'Training Ground Buzz', body: 'The mood around the training ground is excellent. Players are focused and spirits are high.' });
      else if (newAvgMorale <= 40) narrativePool.push({ title: 'Low Spirits', body: 'The atmosphere at training feels flat. The squad could use a morale boost — a good result would help.' });
      else narrativePool.push({ title: 'Steady Week', body: 'A solid week of training. The squad is ticking over nicely and working hard on the training pitch.' });

      // Position-based
      if (myPos > 0 && myPos <= 3) narrativePool.push({ title: 'Title Contenders', body: `Sitting in ${posLabel} — the local press are starting to take notice of your title credentials.` });
      else if (myPos > 0 && myPos > totalTeams - 3) narrativePool.push({ title: 'Relegation Watch', body: `Currently ${posLabel} — pundits are questioning whether you can pull clear of the drop zone.` });
      else if (myPos > 0) narrativePool.push({ title: 'Mid-Table Report', body: `The club sits ${posLabel} in the table. Fans are looking for a push toward the upper half.` });

      // Board confidence
      if (newBoardConfidence >= 80) narrativePool.push({ title: 'Board Pleased', body: 'The board are impressed with your work. Keep delivering results and the future looks bright.' });
      else if (newBoardConfidence <= 30) narrativePool.push({ title: 'Board Concerns', body: 'Whispers in the boardroom suggest patience is running thin. Results need to improve soon.' });

      if (narrativePool.length > 0) {
        const chosen = pick(narrativePool);
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: chosen.title, body: chosen.body });
      }
    }

    // Random mid-season events for immersion
    if (newClubs[playerClubId]) {
      const playerTableEntry = leagueTable.find(e => e.clubId === playerClubId);
      const recentForm = (playerTableEntry?.form || []) as ('W' | 'D' | 'L')[];
      const randomEvent = generateRandomEvents(
        newClubs[playerClubId], newPlayers, newMessages, newWeek, season, recentForm, newBoardConfidence,
      );
      newMessages = randomEvent.messages;
      newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence + randomEvent.confidenceDelta);
      for (const [pid, updates] of Object.entries(randomEvent.playerUpdates)) {
        if (newPlayers[pid]) newPlayers[pid] = { ...newPlayers[pid], ...updates };
      }
      if (Object.keys(randomEvent.clubUpdate).length > 0) {
        newClubs[playerClubId] = { ...newClubs[playerClubId], ...randomEvent.clubUpdate };
      }
    }

    // Collect new digest fields from data already computed above
    const digestPlayerDevelopment: { playerName: string; attribute: string; newValue: number }[] = [];
    for (const pid of playerClub.playerIds) {
      const p = newPlayers[pid];
      if (!p || !p.lastAttributeChanges) continue;
      for (const [attr, delta] of Object.entries(p.lastAttributeChanges)) {
        if (delta && delta > 0) {
          digestPlayerDevelopment.push({
            playerName: `${p.firstName} ${p.lastName}`,
            attribute: attr,
            newValue: p.attributes[attr as keyof typeof p.attributes],
          });
        }
      }
    }

    const digestTrainingGains: { playerName: string; attribute: string }[] = trainingReport.starPerformers.map(sp => {
      const p = newPlayers[sp.playerId];
      return p ? { playerName: `${p.firstName} ${p.lastName}`, attribute: sp.attrGained } : null;
    }).filter(Boolean) as { playerName: string; attribute: string }[];

    const digestScoutReportsCompleted = completedAssignments.length;

    const digestContractWarnings: string[] = (CONTRACT_WARNING_WEEKS as readonly number[]).includes(newWeek)
      ? Object.values(newPlayers)
          .filter(ep => ep.clubId === playerClubId && ep.contractEnd <= season && (ep.overall > CONTRACT_WARNING_OVERALL_THRESHOLD || (ep.age <= CONTRACT_WARNING_YOUTH_AGE_MAX && ep.potential >= CONTRACT_WARNING_YOUTH_POTENTIAL_MIN)))
          .map(ep => `${ep.firstName} ${ep.lastName}`)
      : [];

    const digestObjectiveProgress = evalObjectives.map(obj => ({
      title: obj.title,
      completed: obj.completed,
      xpEarned: obj.completed ? obj.xpReward : 0,
    }));

    set({
      week: newWeek, fixtures: updatedFixtures, players: newPlayers,
      leagueTable, transferWindowOpen, currentMatchResult: null,
      matchPhase: 'none' as const, pendingPressConference: null,
      messages: newMessages, incomingOffers: newOffers, clubs: newClubs,
      matchSubsUsed: 0, boardConfidence: newBoardConfidence, boardObjectives: updatedObjectives,
      training: { ...training, tacticalFamiliarity: newTacticalFamiliarity, streaks: newStreaks, lastReport: trainingReport },
      staff: newStaff, scouting: newScouting, facilities: newFacilities, youthAcademy: newYouthAcademy,
      pendingGemReveal: gemReveals.length > 0 ? gemReveals[0] : null,
      financeHistory: newFinanceHistory,
      unlockedAchievements: allUnlocked,
      pendingAchievementIds: newAchievements,
      cup: newCup,
      leagueCup: newLeagueCup || state.leagueCup,
      championsCup: newChampionsCup,
      shieldCup: newShieldCup,
      conferenceCup: newConferenceCup,
      domesticSuperCup: newDomesticSuperCup,
      continentalSuperCup: newContinentalSuperCup,
      activeChallenge: updatedChallenge,
      divisionFixtures: updatedDivisionFixtures, divisionTables,
      careerTimeline: [...state.careerTimeline, ...newTimeline].slice(-MAX_CAREER_TIMELINE),
      weeklyObjectives: newObjectives,
      objectiveStreak: finalStreak,
      objectivesStartWeek: newObjectivesStartWeek,
      weekCliffhangers: cliffhangers,
      sessionStats,
      managerProgression: updatedProgression,
      pendingStoryline: pendingStorylineEvent || null,
      activeStorylineChains: updatedChains,
      completedStorylineChainIds: newCompletedChainIds,
      ...(sponsorUpdates.sponsorDeals ? { sponsorDeals: sponsorUpdates.sponsorDeals } : {}),
      ...(sponsorUpdates.sponsorOffers ? { sponsorOffers: sponsorUpdates.sponsorOffers } : {}),
      ...(sponsorUpdates.sponsorSlotCooldowns ? { sponsorSlotCooldowns: sponsorUpdates.sponsorSlotCooldowns } : {}),
      merchandise: newMerch,
      fanMood: merchFanMood,
      seasonGrowthTracker: { ...seasonGrowthTracker },
      clubPowerRankings: eloRankings,
      ...(state.careerManager && managerSalary > 0 ? { careerManager: { ...state.careerManager, personalWealth: updatedWealth } } : {}),
      seasonTotalIncome: prevSeasonIncome + weeklyIncome,
      seasonTotalExpenses: prevSeasonExpenses + totalExpenses,
      weeklyDigest: {
        incomeEarned: weeklyIncome,
        expensesPaid: totalExpenses,
        injuriesThisWeek: digestInjuries,
        recoveriesThisWeek: digestRecoveries,
        offersReceived: Math.max(0, digestOffersReceived),
        moraleChange: newAvgMorale - prevMorale,
        playerDevelopment: digestPlayerDevelopment,
        trainingGains: digestTrainingGains,
        scoutReportsCompleted: digestScoutReportsCompleted,
        contractWarnings: digestContractWarnings,
        objectiveProgress: digestObjectiveProgress,
      },
    });

    // Clear expired negotiation cooldowns
    get().clearExpiredCooldowns();

    // Process loan returns
    get().processLoanReturns();

    // Generate AI loan offers for fringe players
    const updatedState = get();
    if (updatedState.transferWindowOpen) {
      const pc = updatedState.clubs[playerClubId];
      if (pc) {
        const squad = pc.playerIds.map(id => updatedState.players[id]).filter(Boolean);
        const avgOvr = squad.reduce((s, p) => s + p.overall, 0) / (squad.length || 1);
        const fringePlayers = squad.filter(p =>
          !pc.lineup.includes(p.id) && !p.onLoan && p.age < 25 && p.overall < avgOvr - 5
        );
        let newLoanOffers = updatedState.incomingLoanOffers;
        for (const fp of fringePlayers) {
          if (Math.random() < AI_LOAN_OFFER_CHANCE) {
            const aiClubs = Object.values(updatedState.clubs).filter(c => c.id !== playerClubId && c.reputation <= pc.reputation);
            if (aiClubs.length > 0) {
              const aiClub = pick(aiClubs);
              // Don't send duplicate offers
              if (!newLoanOffers.some(o => o.playerId === fp.id)) {
                const offer: IncomingLoanOffer = {
                  id: crypto.randomUUID(),
                  playerId: fp.id,
                  fromClubId: aiClub.id,
                  durationWeeks: pick([...AI_LOAN_DURATIONS]),
                  wageSplit: pick([...AI_LOAN_WAGE_SPLITS]),
                  recallClause: Math.random() < AI_LOAN_RECALL_CLAUSE_CHANCE,
                  week: newWeek,
                };
                if (Math.random() < AI_LOAN_OBLIGATORY_BUY_CHANCE) {
                  offer.obligatoryBuyFee = Math.round(fp.value * AI_LOAN_OBLIGATORY_BUY_MULTIPLIER);
                }
                newLoanOffers = [...newLoanOffers, offer];
              }
            }
          }
        }
        if (newLoanOffers !== updatedState.incomingLoanOffers) {
          set({ incomingLoanOffers: newLoanOffers });
        }
      }
    }

    // Personality-driven transfer requests during transfer windows
    if (transferWindowOpen) {
      const trState = get();
      const trClub = trState.clubs[playerClubId];
      if (trClub) {
        let trMessages = [...(trState.messages)];
        const trPlayers = { ...trState.players };
        let changed = false;
        let firstTalkPlayer: typeof trPlayers[string] | null = null;
        for (const pid of trClub.playerIds) {
          const p = trPlayers[pid];
          if (p && !p.listedForSale && !p.wantsToLeave && !p.onLoan && !(p.transferCooldownUntilWeek && p.transferCooldownUntilWeek > newWeek) && wantsTransfer(p, trClub.reputation)) {
            trPlayers[pid] = { ...p, wantsToLeave: true };
            trMessages = addMsg(trMessages, { week: newWeek, season, type: 'transfer', title: `${p.lastName} Wants to Leave`, body: `${p.firstName} ${p.lastName} feels he has outgrown the club and has requested a transfer.`, playerId: pid });
            if (!firstTalkPlayer && !trState.pendingTransferTalk) firstTalkPlayer = trPlayers[pid];
            changed = true;
          }
        }
        if (changed) {
          const updates: Partial<GameState> = { players: trPlayers, messages: trMessages };
          if (firstTalkPlayer) updates.pendingTransferTalk = buildTransferTalk(firstTalkPlayer, 'ambition');
          set(updates);
        }
      }
    }

    // Advanced AI simulation: income, contracts, transfers, loans, free agents
    {
      const aiState = get();
      const aiResult = processAIWeekly(
        aiState.clubs,
        aiState.players,
        aiState.messages,
        aiState.transferMarket,
        aiState.freeAgents,
        aiState.activeLoans,
        aiState.transferNews || [],
        aiState.divisionTables,
        newWeek,
        season,
        playerClubId,
        transferWindowOpen,
      );
      set({
        clubs: aiResult.clubs,
        players: aiResult.players,
        messages: aiResult.messages,
        transferMarket: [...aiResult.transferMarket, ...deadlineBargains.filter(b => aiResult.players[b.playerId]?.clubId === b.sellerClubId)],
        freeAgents: aiResult.freeAgents,
        activeLoans: aiResult.activeLoans,
        transferNews: aiResult.transferNews,
      });
    }

    // Transfer market maintenance: replenish thin market, expire stale listings, spawn free agents
    {
      const mktState = get();

      // Process listing expiry for both external and club-listed players
      const expiryResult = processListingExpiry(mktState.transferMarket, newWeek, season, TOTAL_WEEKS, LISTING_EXPIRY_WEEKS, LISTING_RELIST_CHANCE, LISTING_RELIST_DISCOUNT, CLUB_LISTING_EXPIRY_WEEKS);
      let updatedMarket = expiryResult.market;

      // Replenish if market is below threshold (keeps market populated across all divisions)
      const updatedPlayers = { ...mktState.players };

      // Clean up orphaned external players from expired listings
      const freeAgentSet = new Set(mktState.freeAgents);
      for (const pid of expiryResult.expiredPlayerIds) {
        if (updatedPlayers[pid]?.clubId === '' && !freeAgentSet.has(pid)) {
          delete updatedPlayers[pid];
        }
      }

      // Reset listedForSale flag on expired club player listings
      for (const pid of expiryResult.expiredClubPlayerIds) {
        if (updatedPlayers[pid]) {
          updatedPlayers[pid] = { ...updatedPlayers[pid], listedForSale: false };
        }
      }

      if (updatedMarket.length < MARKET_REPLENISH_THRESHOLD) {
        // Use larger, higher-quality batches during pre-season (friendlies weeks 1-3)
        const fresh = newWeek <= PRE_SEASON_END
          ? replenishMarketPreSeason(season, newWeek)
          : replenishMarket(season, newWeek);
        Object.assign(updatedPlayers, fresh.players);
        updatedMarket = [...updatedMarket, ...fresh.listings];
      }

      // Spawn new free agents periodically
      let updatedFreeAgents = [...mktState.freeAgents];
      if (Math.random() < FREE_AGENT_SPAWN_CHANCE) {
        const spawned = spawnFreeAgents(season);
        Object.assign(updatedPlayers, spawned.players);
        // Cap free agents at pool max
        const maxFa = FREE_AGENT_POOL_MAX;
        const combined = [...updatedFreeAgents, ...spawned.freeAgentIds];
        if (combined.length > maxFa) {
          // Evict weakest free agents to stay within cap
          const sorted = combined
            .map(id => ({ id, ovr: updatedPlayers[id]?.overall || 0 }))
            .sort((a, b) => b.ovr - a.ovr);
          updatedFreeAgents = sorted.slice(0, maxFa).map(x => x.id);
          // Clean up evicted players from record
          const kept = new Set(updatedFreeAgents);
          for (const entry of sorted.slice(maxFa)) {
            if (!kept.has(entry.id) && updatedPlayers[entry.id]?.clubId === '') {
              delete updatedPlayers[entry.id];
            }
          }
        } else {
          updatedFreeAgents = combined;
        }
      }

      set({ transferMarket: updatedMarket, players: updatedPlayers, freeAgents: updatedFreeAgents });
    }

    // Career mode: process manager stat growth, reputation, job market
    {
      const careerState = get();
      if (careerState.gameMode === 'career' && careerState.careerManager) {
        const cm = { ...careerState.careerManager };
        cm.attributes = { ...cm.attributes };
        let careerMessages = [...careerState.messages];
        const oldTier = cm.reputationTier;

        // --- Stat Growth ---
        // Tactical: grows each match week
        cm.attributes.tacticalKnowledge = Math.min(STAT_MAX, cm.attributes.tacticalKnowledge + GROWTH_TACTICAL_PER_MATCH);

        // Motivation: grows when morale swing is significant this week
        const avgMorale = (() => {
          const pc = careerState.clubs[playerClubId];
          if (!pc || pc.playerIds.length === 0) return 50;
          return pc.playerIds.reduce((s, id) => s + (careerState.players[id]?.morale || 0), 0) / pc.playerIds.length;
        })();
        if (Math.abs(avgMorale - prevMorale) >= 5) {
          cm.attributes.motivation = Math.min(STAT_MAX, cm.attributes.motivation + GROWTH_MOTIVATION_PER_MORALE_EVENT);
        }

        // Scouting: grows when scout reports were generated this week
        const scoutReports = careerState.scouting.reports.filter(r => r.week === week);
        if (scoutReports.length > 0) {
          cm.attributes.scoutingEye = Math.min(STAT_MAX, cm.attributes.scoutingEye + GROWTH_SCOUTING_PER_ASSIGNMENT * scoutReports.length);
        }

        // Discipline: grows when the last match had no cards for player's team
        const lastMatch = careerState.fixtures.find(m => m.week === week && m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
        if (lastMatch) {
          const playerTeamCards = (lastMatch.events || []).filter(e =>
            (e.type === 'yellow_card' || e.type === 'red_card') && e.clubId === playerClubId
          );
          if (playerTeamCards.length === 0) {
            cm.attributes.discipline = Math.min(STAT_MAX, cm.attributes.discipline + GROWTH_DISCIPLINE_PER_CLEAN_MATCH);
          }
        }

        // --- Job Market Refresh + Expiry + Desperation (batched into single set) ---
        let updatedVacancies: JobVacancy[] | null = null;

        if (JOB_MARKET_REFRESH_WEEKS.includes(newWeek)) {
          updatedVacancies = generateJobVacancies(careerState.clubs, cm.reputationScore, season, newWeek, playerClubId).map(v => {
            const vLeague = LEAGUES.find(l => l.id === v.divisionId);
            return { ...v, competitors: generateCompetitors(v.minReputation, (vLeague?.qualityTier || 4) as 1 | 2 | 3 | 4) };
          });
        }

        // Expire old vacancies (from refreshed list or current list)
        const sourceVacancies = updatedVacancies ?? careerState.jobVacancies;
        const activeVacancies = sourceVacancies.filter(v =>
          v.expiresSeason > season || (v.expiresSeason === season && v.expiresWeek > newWeek)
        );
        if (updatedVacancies || activeVacancies.length !== careerState.jobVacancies.length) {
          updatedVacancies = activeVacancies;
        }

        // --- Unemployed tracking ---
        if (!cm.contract) {
          cm.unemployedWeeks = (cm.unemployedWeeks || 0) + 1;

          // Desperation vacancies after 12 unemployed weeks
          const finalVacancies = updatedVacancies ?? careerState.jobVacancies;
          if (cm.unemployedWeeks >= 12 && finalVacancies.length === 0) {
            const allClubs = Object.values(careerState.clubs);
            const desperate = allClubs.filter(c => c.id !== careerState.playerClubId).slice(0, 2);
            updatedVacancies = desperate.map(club => ({
              id: `desperation-${club.id}-${season}-${newWeek}`,
              clubId: club.id, clubName: club.name, divisionId: club.divisionId || '',
              minReputation: 0, salary: 1500, contractLength: 1,
              boardExpectations: 'Survive and stabilize the club',
              expiresWeek: newWeek + 8, expiresSeason: season, applied: false,
              competitors: generateCompetitors(0, 4).slice(0, 1),
            }));
          }
        }

        if (updatedVacancies) {
          set({ jobVacancies: updatedVacancies });
        }

        // --- Expire old job offers (before generating new ones) ---
        {
          const offerState = get();
          const currentOffers = offerState.jobOffers;
          const activeOffers = currentOffers.filter(o =>
            o.expiresSeason > season || (o.expiresSeason === season && o.expiresWeek > newWeek)
          );
          if (activeOffers.length !== currentOffers.length) {
            set({ jobOffers: activeOffers });
          }
        }

        // --- Proactive job offers for employed managers ---
        if (cm.contract && newWeek > 0 && newWeek % PROACTIVE_OFFER_CHECK_INTERVAL === 0) {
          const offerState = get();
          const currentOffers = offerState.jobOffers;
          if (currentOffers.length < PROACTIVE_OFFER_MAX_PENDING) {
            const existingClubIds = currentOffers.map(o => o.clubId);
            const proactiveOffer = generateProactiveOffer(
              cm, playerClubId, offerState.clubs,
              offerState.leagueTable, offerState.fixtures, season, newWeek,
              existingClubIds
            );
            if (proactiveOffer) {
              set({ jobOffers: [...currentOffers, proactiveOffer] });
              careerMessages = addMsg(careerMessages, {
                week: newWeek, season, type: 'contract',
                title: `Interest from ${proactiveOffer.clubName}`,
                body: `${proactiveOffer.clubName} are impressed by your work and want to offer you the manager position. Visit the Job Market to review.`,
              });
            }
          }
        }

        // --- National team offer expiry ---
        {
          const ntOffer = get().nationalTeamOffer;
          if (ntOffer && ntOffer.status === 'pending') {
            const expired = season > ntOffer.expiresSeason || (season === ntOffer.expiresSeason && newWeek >= ntOffer.expiresWeek);
            if (expired) {
              careerMessages = addMsg(careerMessages, {
                week: newWeek, season, type: 'national_team',
                title: 'National Team Offer Expired',
                body: `The ${ntOffer.nationality} FA has withdrawn their offer after receiving no response. They will appoint another manager.`,
              });
              set({ nationalTeamOffer: null, showNationalTeamOffer: false });
            }
          }
        }

        // --- Contract expiry warning ---
        if (cm.contract && cm.contract.endSeason === season && newWeek >= 40) {
          const alreadyWarned = careerMessages.some(m => m.title === 'Contract Expiring');
          if (!alreadyWarned) {
            careerMessages = addMsg(careerMessages, {
              week: newWeek, season, type: 'general',
              title: 'Contract Expiring',
              body: `Your contract expires at the end of this season. Perform well to earn a renewal.`,
            });
          }
        }

        // --- Manager of the Month check ---
        if (newWeek > 0 && newWeek % MOTM_CHECK_INTERVAL === 0 && cm.contract) {
          const recentMatches = careerState.fixtures.filter(m =>
            m.played && m.week > newWeek - MOTM_CHECK_INTERVAL && m.week <= newWeek &&
            (m.homeClubId === playerClubId || m.awayClubId === playerClubId)
          );
          if (recentMatches.length >= MOTM_MIN_MATCHES) {
            const wins = recentMatches.filter(m => {
              const isHome = m.homeClubId === playerClubId;
              return isHome ? m.homeGoals > m.awayGoals : m.awayGoals > m.homeGoals;
            }).length;
            if (wins / recentMatches.length >= 0.75) {
              cm.awardsWon = [...cm.awardsWon, { type: 'manager_of_month', season, week: newWeek, divisionId: careerState.playerDivision }];
              cm.reputationScore = Math.min(REP_MAX, cm.reputationScore + 5);
              careerMessages = addMsg(careerMessages, {
                week: newWeek, season, type: 'general',
                title: 'Manager of the Month!',
                body: `Congratulations! You have been named Manager of the Month after winning ${wins} of ${recentMatches.length} matches.`,
              });
            }
          }
        }

        // --- Reputation tier change notification ---
        cm.reputationTier = calculateReputationTier(cm.reputationScore);
        if (cm.reputationTier !== oldTier) {
          careerMessages = addMsg(careerMessages, {
            week: newWeek, season, type: 'general',
            title: 'Reputation Changed!',
            body: `Your reputation has ${cm.reputationScore > (careerState.careerManager?.reputationScore || 0) ? 'grown' : 'declined'} to ${getReputationTierLabel(cm.reputationTier)}.`,
          });
        }

        set({ careerManager: cm, messages: careerMessages });
      }
    }

    // Auto-save after advancing week
    if (get().settings.autoSave) get().saveGame();
  },

  advanceToNextMatch: () => {
    const hasMatchThisWeek = (s: GameState): boolean => {
      const { week: w, fixtures, friendlies, playerClubId: pcId, cup, leagueCup, domesticSuperCup, continentalSuperCup } = s;
      if (friendlies?.some(m => m.week === w && !m.played && (m.homeClubId === pcId || m.awayClubId === pcId))) return true;
      if (fixtures.some(m => m.week === w && !m.played && (m.homeClubId === pcId || m.awayClubId === pcId))) return true;
      if (cup?.ties?.some(t => t.week === w && !t.played && (t.homeClubId === pcId || t.awayClubId === pcId))) return true;
      if (leagueCup?.ties?.some(t => t.week === w && !t.played && (t.homeClubId === pcId || t.awayClubId === pcId))) return true;
      if (domesticSuperCup && !domesticSuperCup.played && domesticSuperCup.week === w) return true;
      if (continentalSuperCup && !continentalSuperCup.played && continentalSuperCup.week === w) return true;
      return false;
    };

    const MAX_SKIPS = 5;
    for (let i = 0; i < MAX_SKIPS; i++) {
      const s = get();
      if (s.seasonPhase !== 'regular') break;
      if (s.week >= s.totalWeeks) break;
      if (hasMatchThisWeek(s)) break;
      s.advanceWeek();
      // Suppress the weekly digest for intermediate advances so the modal
      // only shows for the final week (the one with the upcoming match).
      set({ weeklyDigest: null });
    }
  },

  playCurrentMatch: () => {
    const state = get();
    // Career mode: block match play when unemployed
    if (state.gameMode === 'career' && !state.careerManager?.contract) return null;
    const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;

    // ── Detect match type: friendly → league → cup → continental → league cup → super cup ──
    const friendlyMatch = state.friendlies?.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const leagueMatch = !friendlyMatch ? fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)) : null;
    const cupTie = !friendlyMatch && !leagueMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
    const champMatch = !friendlyMatch && !leagueMatch && !cupTie ? findPlayerContinentalMatch(state.championsCup, week, playerClubId) : null;
    const shieldMatch = !friendlyMatch && !leagueMatch && !cupTie && !champMatch ? findPlayerContinentalMatch(state.shieldCup, week, playerClubId) : null;
    const confMatch = !friendlyMatch && !leagueMatch && !cupTie && !champMatch && !shieldMatch ? findPlayerContinentalMatch(state.conferenceCup, week, playerClubId) : null;
    const continentalMatch = champMatch || shieldMatch || confMatch;
    const continentalComp = champMatch ? 'champions_cup' as const : shieldMatch ? 'shield_cup' as const : confMatch ? 'conference_cup' as const : null;
    const continentalTourney = champMatch ? state.championsCup : shieldMatch ? state.shieldCup : confMatch ? state.conferenceCup : null;
    const leagueCupTie = !friendlyMatch && !leagueMatch && !cupTie && !continentalMatch ? state.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
    const superCup = !friendlyMatch && !leagueMatch && !cupTie && !continentalMatch && !leagueCupTie
      ? (state.domesticSuperCup && !state.domesticSuperCup.played && state.domesticSuperCup.week === week && (state.domesticSuperCup.homeClubId === playerClubId || state.domesticSuperCup.awayClubId === playerClubId) ? state.domesticSuperCup : null)
        || (state.continentalSuperCup && !state.continentalSuperCup.played && state.continentalSuperCup.week === week && (state.continentalSuperCup.homeClubId === playerClubId || state.continentalSuperCup.awayClubId === playerClubId) ? state.continentalSuperCup : null)
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
      if (vc) {
        ephemeralClub = createEphemeralClub(vc, season);
        effectiveClubs = { ...clubs, [oppId]: ephemeralClub.club };
        effectivePlayers = { ...players, ...ephemeralClub.players };
      }
      match = { id: matchId, week, homeClubId: homeId, awayClubId: awayId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
    } else if (leagueCupTie) {
      match = { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
    } else if (superCup) {
      const oppId = superCup.homeClubId === playerClubId ? superCup.awayClubId : superCup.homeClubId;
      const vc = (state.virtualClubs || {})[oppId];
      if (vc) {
        ephemeralClub = createEphemeralClub(vc, season);
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
        clubId === playerClubId ? ps.map(p => ({ ...p, morale: Math.min(100, p.morale + Math.round(MOTIVATOR_MORALE_BOOST * dynastyMult(state.managerProgression))) })) : ps;
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
    // Capture pre-match snapshot for Invincible perk (match rewind on loss)
    if (hasPerk(state.managerProgression, 'invincible') && !state.invincibleUsedThisSeason && !isFriendly) {
      set({ preMatchSnapshot: { fixtures: [...state.fixtures], divisionFixtures: { ...state.divisionFixtures }, players: { ...state.players }, boardConfidence: state.boardConfidence, leagueTable: [...state.leagueTable], divisionTables: { ...state.divisionTables } } });
    }

    const spCoachInstant = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * dynastyMult(state.managerProgression) : 0;
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
            const homeStr = hc.reputation / 5;
            const awayStr = ac.reputation / 5;
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
            if (penHome > penAway) hGoals++; else aGoals++;
            cupEvents.push({ minute: 120, type: 'penalty_shootout', clubId: penHome > penAway ? match.homeClubId : match.awayClubId, description: `${penHome > penAway ? hc.shortName : ac.shortName} win on penalties (${penHome}-${penAway})!` });
          }

          finalResult = { ...result, homeGoals: hGoals, awayGoals: aGoals, events: cupEvents, penaltyShootout };
          cupWinnerId = hGoals > aGoals ? match.homeClubId : match.awayClubId;
        }
      }

      // Use effective clubs/players for processMatchResult (ephemeral clubs for continental/super cup opponents)
      const effectiveState = ephemeralClub ? { ...state, clubs: effectiveClubs, players: effectivePlayers } : state;
      const processed = processMatchResult(effectiveState, match, finalResult, playerRatings, () => get().week, matchInjuries);

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
        pendingPressConference: generatePressConference(pressContext, isPro(get().monetization)),
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
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

      const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
      const press = generatePressConference(pressContext, isPro(get().monetization));
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
        pendingPressConference: press,
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
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
      const hp2 = hAvail2.slice(0, 11);
      const ap2 = aAvail2.slice(0, 11);
      if (hp2.length === 0 || ap2.length === 0) {
        fullFixtures[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : 3, awayGoals: ap2.length === 0 ? 0 : 3, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
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

    // Generate post-match press conference
    const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
    const press = generatePressConference(pressContext, isPro(get().monetization));

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
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
      managerProgression: processed.managerProgression,
      preMatchLeaguePosition: prePos,
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
      set({ matchPhase: 'none' as const });
      return null;
    }
  },

  playFirstHalf: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;
    const friendlyMatch = state.friendlies?.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const leagueMatch = !friendlyMatch ? fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)) : null;

    // Check for cup tie if no league/friendly match
    const cupTie = !friendlyMatch && !leagueMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;

    // Check continental matches
    const champMatch = !friendlyMatch && !leagueMatch && !cupTie ? findPlayerContinentalMatch(state.championsCup, week, playerClubId) : null;
    const shieldMatch = !friendlyMatch && !leagueMatch && !cupTie && !champMatch ? findPlayerContinentalMatch(state.shieldCup, week, playerClubId) : null;
    const confMatch = !friendlyMatch && !leagueMatch && !cupTie && !champMatch && !shieldMatch ? findPlayerContinentalMatch(state.conferenceCup, week, playerClubId) : null;
    const continentalMatch = champMatch || shieldMatch || confMatch;
    const continentalComp = champMatch ? 'champions_cup' as const : shieldMatch ? 'shield_cup' as const : confMatch ? 'conference_cup' as const : null;
    const continentalTourney = champMatch ? state.championsCup : shieldMatch ? state.shieldCup : confMatch ? state.conferenceCup : null;

    // Check league cup
    const leagueCupTie = !friendlyMatch && !leagueMatch && !cupTie && !continentalMatch ? state.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;

    // Check super cups
    const superCup = !friendlyMatch && !leagueMatch && !cupTie && !continentalMatch && !leagueCupTie
      ? (state.domesticSuperCup && !state.domesticSuperCup.played && state.domesticSuperCup.week === week && (state.domesticSuperCup.homeClubId === playerClubId || state.domesticSuperCup.awayClubId === playerClubId) ? state.domesticSuperCup : null)
        || (state.continentalSuperCup && !state.continentalSuperCup.played && state.continentalSuperCup.week === week && (state.continentalSuperCup.homeClubId === playerClubId || state.continentalSuperCup.awayClubId === playerClubId) ? state.continentalSuperCup : null)
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
      // Create ephemeral club for the continental opponent
      const oppId = homeId === playerClubId ? awayId : homeId;
      const vc = (state.virtualClubs || {})[oppId];
      if (vc) {
        ephemeralClub = createEphemeralClub(vc, season);
        effectiveClubs = { ...clubs, [oppId]: ephemeralClub.club };
        effectivePlayers = { ...players, ...ephemeralClub.players };
      }
      match = { id: matchId, week, homeClubId: homeId, awayClubId: awayId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
    } else if (leagueCupTie) {
      match = { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
    } else if (superCup) {
      const oppId = superCup.homeClubId === playerClubId ? superCup.awayClubId : superCup.homeClubId;
      const vc = (state.virtualClubs || {})[oppId];
      if (vc) {
        ephemeralClub = createEphemeralClub(vc, season);
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

    // For ephemeral clubs: inject their players and club into state temporarily
    if (ephemeralClub) {
      set({ clubs: effectiveClubs, players: effectivePlayers });
    }

    // Motivator perk: boost player team morale before match
    if (hasPerk(state.managerProgression, 'motivator')) {
      const boostPlayers = (ps: typeof hp, clubId: string) =>
        clubId === playerClubId ? ps.map(p => ({ ...p, morale: Math.min(100, p.morale + Math.round(MOTIVATOR_MORALE_BOOST * dynastyMult(state.managerProgression))) })) : ps;
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
    const spCoachBonus = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * dynastyMult(state.managerProgression) : 0;
    const matchWeather = generateMatchWeather();
    const halfState = simulateHalf(hc, ac, hp, ap, 1, 45, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, undefined, halfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, halfCareerMod, hBench, aBench, undefined, matchWeather, spCoachBonus);

    // Determine which cup tracking IDs to set
    const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCup;
    const matchCompetition = friendlyMatch ? 'Pre-Season Friendly'
      : cupTie ? `Dynasty Cup — ${cupTie.round}`
      : leagueCupTie ? `League Cup — ${leagueCupTie.round}`
      : champMatch && continentalTourney ? getContinentalMatchLabel('Champions Cup', champMatch, continentalTourney)
      : shieldMatch && continentalTourney ? getContinentalMatchLabel('Shield Cup', shieldMatch, continentalTourney)
      : superCup ? (superCup.type === 'domestic' ? 'Super Cup' : 'Continental Super Cup')
      : null;
    set({
      halfTimeState: halfState, currentMatchWeather: matchWeather, matchPhase: 'half_time', matchSubsUsed: 0, preMatchLeaguePosition: preMatchPos,
      currentCupTieId: cupTie ? cupTie.id : isCupMatch ? '__tournament__' : null,
      currentLeagueCupTieId: leagueCupTie ? leagueCupTie.id : null,
      currentContinentalMatchId: continentalMatch ? match.id : null,
      currentContinentalCompetition: continentalComp,
      lastMatchCompetition: matchCompetition,
    });
    return halfState;
  },

  playSecondHalf: () => {
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

    const match = friendlyMatch || leagueMatch || (cupTie ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null) || tournamentMatch;
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

    const spCoachBonus2H = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * dynastyMult(state.managerProgression) : 0;
    const fullState = simulateHalf(hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, secondHalfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, secondHalfCareerMod, undefined, undefined, combinedMods, currentMatchWeather ?? undefined, spCoachBonus2H);
    const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, fullState);
    // Attach weather to the match result
    if (currentMatchWeather) result.weather = currentMatchWeather;

    // Cup match ended in draw — need extra time (unless aggregate is already decided for 2-leg ties)
    if (state.currentCupTieId && result.homeGoals === result.awayGoals && !isAggregateDecided(state, result.homeGoals, result.awayGoals)) {
      set({
        currentMatchResult: result,
        halfTimeState: fullState, // carry forward for extra time continuation
        matchPhase: 'extra_time',
        matchSubsUsed: 0,
        matchPlayerRatings: playerRatings,
      });
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
        pendingPressConference: generatePressConference(pressContext, isPro(get().monetization)),
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
        managerProgression: processed.managerProgression,
        lastMatchXPGain: processed.xpGain,
        lastMatchDrama: cupDrama,
        rivalries: processed.updatedRivalries,
        pairFamiliarity: processed.pairFamiliarity,
        ...tournamentUpdates.stateUpdates,
      });
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
      const hp2 = hAvail3.slice(0, 11);
      const ap2 = aAvail3.slice(0, 11);
      if (hp2.length === 0 || ap2.length === 0) {
        fullFixtures2[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : 3, awayGoals: ap2.length === 0 ? 0 : 3, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
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

    // Generate post-match press conference
    const pressContext2 = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
    const press2 = generatePressConference(pressContext2, isPro(get().monetization));

    const syncedDivFixtures2 = { ...state.divisionFixtures, [state.playerDivision]: fullFixtures2 };
    set({
      fixtures: fullFixtures2, players: playersWithAI2, leagueTable: fullLeagueTable2,
      currentMatchResult: result, boardConfidence: processed.confidence, messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      halfTimeState: null, matchPhase: 'full_time',
      pendingPressConference: press2,
      divisionFixtures: syncedDivFixtures2,
      divisionTables: { ...state.divisionTables, [state.playerDivision]: fullLeagueTable2 },
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
      managerProgression: processed.managerProgression,
      lastMatchXPGain: processed.xpGain,
      lastMatchDrama: leagueDrama,
      rivalries: processed.updatedRivalries,
      pairFamiliarity: processed.pairFamiliarity,
      clubPowerRankings: eloRankings2,
    });
    return result;
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'playSecondHalf' } });
      // Clear half-time state so the match can be cleaned up
      set({ halfTimeState: null, currentMatchWeather: null, matchPhase: 'none' as const });
      return null;
    }
  },

  playExtraTime: () => {
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
    const spCoachBonusET = hasPerk(state.managerProgression, 'set_piece_coach') ? 0.009 * dynastyMult(state.managerProgression) : 0;
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
      const { result, playerRatings } = finalizeMatch(etResult, hc, ac, hp, ap, etState);
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
          pendingPressConference: generatePressConference(press, isPro(get().monetization)),
          careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
          managerProgression: processed.managerProgression,
          lastMatchXPGain: processed.xpGain,
          lastMatchDrama: etDrama,
          rivalries: processed.updatedRivalries,
          pairFamiliarity: processed.pairFamiliarity,
          ...tournamentUpdates.stateUpdates,
        });
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
              const cupWinnerId = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId;
              newCup.winner = cupWinnerId; newCup.currentRound = null;
              const prize = cupWinnerId === playerClubId ? CONTINENTAL_PRIZE_MONEY.dynasty_cup_winner : CONTINENTAL_PRIZE_MONEY.dynasty_cup_runner_up;
              const club = clubs[playerClubId];
              if (club) {
                set({ clubs: { ...clubs, [playerClubId]: { ...club, budget: club.budget + prize } } });
              }
            }
          } else { Object.assign(newCup, advanceCupRound(newCup)); }
        }
        set({
          currentMatchResult: result, halfTimeState: null, matchPhase: 'full_time',
          matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, currentCupTieId: null,
          cup: newCup, players: processed.newPlayers, messages: processed.newMessages,
          boardConfidence: processed.confidence, managerStats: processed.managerStats,
          careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
          managerProgression: processed.managerProgression, lastMatchXPGain: processed.xpGain,
          pendingPressConference: generatePressConference(press, isPro(get().monetization)),
          lastMatchDrama: etDrama, rivalries: processed.updatedRivalries, pairFamiliarity: processed.pairFamiliarity,
        });
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
  },

  playPenalties: () => {
    const state = get();
    const { clubs, players, currentMatchResult, currentCupTieId } = state;
    if (!currentMatchResult || !currentCupTieId) return null;

    const hc = clubs[currentMatchResult.homeClubId];
    const ac = clubs[currentMatchResult.awayClubId];
    if (!hc || !ac) return null;
    const hp = (hc.lineup || []).map(id => players[id]).filter(Boolean);
    const ap = (ac.lineup || []).map(id => players[id]).filter(Boolean);

    // Penalty shootout — pre-compute all kicks for kick-by-kick reveal
    const homeGK = hp.find(p => p.position === 'GK');
    const awayGK = ap.find(p => p.position === 'GK');
    const homeGKQuality = homeGK ? (homeGK.attributes.defending + homeGK.attributes.mental) / 200 : 0.5;
    const awayGKQuality = awayGK ? (awayGK.attributes.defending + awayGK.attributes.mental) / 200 : 0.5;

    let penHome = 0, penAway = 0;
    const kicks: PenaltyKick[] = [];
    for (let i = 0; i < CUP_PENALTY_KICKS; i++) {
      const hScores = Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (hScores) penHome++;
      kicks.push({ round: i + 1, isHome: true, takerName: hc.shortName, scored: hScores, homeTotal: penHome, awayTotal: penAway });

      const aScores = Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (aScores) penAway++;
      kicks.push({ round: i + 1, isHome: false, takerName: ac.shortName, scored: aScores, homeTotal: penHome, awayTotal: penAway });
    }
    // Sudden death
    let sdRound = CUP_PENALTY_KICKS;
    while (penHome === penAway) {
      sdRound++;
      const hScores = Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (hScores) penHome++;
      kicks.push({ round: sdRound, isHome: true, takerName: hc.shortName, scored: hScores, homeTotal: penHome, awayTotal: penAway });

      const aScores = Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (aScores) penAway++;
      kicks.push({ round: sdRound, isHome: false, takerName: ac.shortName, scored: aScores, homeTotal: penHome, awayTotal: penAway });

      if (hScores !== aScores) break;
    }

    // Store kicks for kick-by-kick reveal — finalization happens in revealNextPenaltyKick / skipPenaltyShootout
    set({ penaltyShootoutKicks: kicks, penaltyShootoutRevealIndex: 0 });
    return currentMatchResult;
  },

  revealNextPenaltyKick: () => {
    const state = get();
    const newIndex = state.penaltyShootoutRevealIndex + 1;
    set({ penaltyShootoutRevealIndex: newIndex });
    if (newIndex >= state.penaltyShootoutKicks.length) {
      // All kicks revealed — finalize the match
      get().skipPenaltyShootout();
    }
  },

  skipPenaltyShootout: () => {
    const state = get();
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
    const { result, playerRatings } = finalizeMatch(finalResult, hc, ac, hp, ap, halfTimeState);

    const processed = processMatchResult(state, finalResult, result, playerRatings, () => get().week, halfTimeState?.matchInjuries || {});
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
        pendingPressConference: generatePressConference(press, isPro(get().monetization)),
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
        managerProgression: processed.managerProgression, lastMatchXPGain: processed.xpGain,
        lastMatchDrama: penDrama, rivalries: processed.updatedRivalries, pairFamiliarity: processed.pairFamiliarity,
        penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0,
        ...tournamentUpdates.stateUpdates,
      });
    } else {
      // Domestic Dynasty Cup
      const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
        t.id === currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, penaltyShootout } : t
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
        } else { Object.assign(newCup, advanceCupRound(newCup)); }
      }
      set({
        currentMatchResult: { ...result, penaltyShootout }, halfTimeState: null, matchPhase: 'full_time',
        matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, currentCupTieId: null,
        cup: newCup, players: processed.newPlayers, messages: processed.newMessages,
        boardConfidence: processed.confidence, managerStats: processed.managerStats,
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
        managerProgression: processed.managerProgression, lastMatchXPGain: processed.xpGain,
        pendingPressConference: generatePressConference(press, isPro(get().monetization)),
        lastMatchDrama: penDrama, rivalries: processed.updatedRivalries, pairFamiliarity: processed.pairFamiliarity,
        penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0,
      });
    }
  },

  endSeason: () => {
    endSeasonImpl(set, get);
  },

  unlockPerk: (perkId: PerkId) => {
    const state = get();
    const perk = MANAGER_PERKS.find(p => p.id === perkId);
    if (!perk) return { success: false, message: 'Unknown perk' };
    const check = canUnlockPerk(perk, state.managerProgression);
    if (!check.canUnlock) return { success: false, message: check.reason || 'Cannot unlock' };
    // Deduct XP by adjusting the xp field (subtract cost from total pool)
    const newProg: ManagerProgression = {
      ...state.managerProgression,
      unlockedPerks: [...state.managerProgression.unlockedPerks, perkId],
    };
    set({ managerProgression: newProg });
    return { success: true, message: `${perk.name} unlocked!` };
  },

  saveGame: (slot?: number) => {
    // Debounce: skip if saved very recently (unless explicit slot = manual save)
    const now = Date.now();
    if (slot === undefined && now - lastSaveAt < SAVE_DEBOUNCE_MS) return;
    lastSaveAt = now;

    const state = get();
    const s = slot ?? state.activeSlot;

    // Trim match events/stats from AI-vs-AI fixtures to reduce save size
    const trimmedDivFixtures = state.divisionFixtures
      ? trimFixturesForSave(state.divisionFixtures, state.playerClubId)
      : state.divisionFixtures;
    const trimmedFixtures = state.fixtures
      ? trimFixtureArrayForSave(state.fixtures, state.playerClubId)
      : state.fixtures;

    const saveData = {
      version: CURRENT_VERSION,
      activeSlot: s,
      playerClubId: state.playerClubId, season: state.season, week: state.week,
      clubs: state.clubs, players: state.players, fixtures: trimmedFixtures,
      transferMarket: state.transferMarket, shortlist: state.shortlist, scoutWatchList: state.scoutWatchList,
      boardObjectives: state.boardObjectives, boardConfidence: state.boardConfidence,
      trainingFocus: state.trainingFocus, totalWeeks: state.totalWeeks,
      messages: state.messages, seasonHistory: state.seasonHistory,
      incomingOffers: state.incomingOffers,
      settings: state.settings, tactics: state.tactics, training: state.training,
      staff: state.staff, scouting: state.scouting, youthAcademy: state.youthAcademy,
      facilities: state.facilities, financeHistory: state.financeHistory,
      unlockedAchievements: state.unlockedAchievements, managerStats: state.managerStats,
      activeLoans: state.activeLoans, incomingLoanOffers: state.incomingLoanOffers, outgoingLoanRequests: state.outgoingLoanRequests,
      cup: state.cup,
      friendlies: state.friendlies,
      galacticoUsedThisSeason: state.galacticoUsedThisSeason,
      invincibleUsedThisSeason: state.invincibleUsedThisSeason,
      fanMood: state.fanMood,
      activeChallenge: state.activeChallenge,
      divisionFixtures: trimmedDivFixtures,
      divisionTables: state.divisionTables,
      divisionClubs: state.divisionClubs,
      playerDivision: state.playerDivision,
      derbies: state.derbies,
      seasonPhase: state.seasonPhase,
      lastSeasonTurnover: state.lastSeasonTurnover,
      clubRecords: state.clubRecords,
      careerTimeline: state.careerTimeline,
      managerProgression: state.managerProgression,
      weeklyObjectives: state.weeklyObjectives,
      objectiveStreak: state.objectiveStreak,
      objectivesStartWeek: state.objectivesStartWeek,
      completedCoachTaskIds: state.completedCoachTaskIds,
      weekCliffhangers: state.weekCliffhangers,
      lastMatchDrama: state.lastMatchDrama,
      sessionStats: state.sessionStats,
      pendingStoryline: state.pendingStoryline,
      activeStorylineChains: state.activeStorylineChains,
      completedStorylineChainIds: state.completedStorylineChainIds,
      preMatchLeaguePosition: state.preMatchLeaguePosition,
      lastMatchXPGain: state.lastMatchXPGain,
      weeklyDigest: state.weeklyDigest,
      sponsorDeals: state.sponsorDeals,
      sponsorOffers: state.sponsorOffers,
      sponsorSlotCooldowns: state.sponsorSlotCooldowns,
      negotiationStrikes: state.negotiationStrikes,
      merchandise: state.merchandise,
      pairFamiliarity: state.pairFamiliarity,
      rivalries: state.rivalries,
      lastMatchCompetition: state.lastMatchCompetition,
      seasonGrowthTracker: state.seasonGrowthTracker,
      transferNews: state.transferNews || [],
      halfTimeState: state.halfTimeState,
      matchPhase: state.matchPhase,
      currentCupTieId: state.currentCupTieId,
      pendingFarewell: state.pendingFarewell,
      freeAgents: state.freeAgents,
      monetization: state.monetization,
      nationalTeam: state.nationalTeam,
      internationalTournament: state.internationalTournament,
      managerNationality: state.managerNationality,
      nationalTeamOffer: state.nationalTeamOffer,
      showNationalTeamOffer: state.showNationalTeamOffer,
      // Cups & Continental
      leagueCup: state.leagueCup,
      championsCup: state.championsCup,
      shieldCup: state.shieldCup,
      conferenceCup: state.conferenceCup,
      virtualClubs: state.virtualClubs,
      continentalQualification: state.continentalQualification,
      domesticSuperCup: state.domesticSuperCup,
      continentalSuperCup: state.continentalSuperCup,
      currentLeagueCupTieId: state.currentLeagueCupTieId,
      currentContinentalMatchId: state.currentContinentalMatchId,
      currentContinentalCompetition: state.currentContinentalCompetition,
      continentalCoefficients: state.continentalCoefficients || {},
      // Career Mode
      gameMode: state.gameMode,
      careerManager: state.careerManager,
      jobVacancies: state.jobVacancies,
      jobOffers: state.jobOffers,
      activeInterview: state.activeInterview,
    };
    let json = JSON.stringify(saveData);

    // If the save is very large (>3MB), aggressively strip ALL match events
    if (json.length > 3_000_000) {
      const stripAllEvents = (fixtures: unknown[]): unknown[] =>
        fixtures.map((f: unknown) => {
          const m = f as { played?: boolean; events?: unknown[]; stats?: unknown };
          if (!m.played || !m.events) return m;
          const { events: _e, stats: _s, ...rest } = m as Record<string, unknown>;
          return rest;
        });
      if (saveData.divisionFixtures) {
        const aggressiveTrim: Record<string, unknown[]> = {};
        for (const [div, fx] of Object.entries(saveData.divisionFixtures as Record<string, unknown[]>)) {
          aggressiveTrim[div] = stripAllEvents(fx);
        }
        saveData.divisionFixtures = aggressiveTrim;
      }
      if (saveData.fixtures) {
        saveData.fixtures = stripAllEvents(saveData.fixtures as unknown[]);
      }
      json = JSON.stringify(saveData);
    }

    try {
      writeSaveSlot(s, json);
    } catch (err) {
      const errTime = Date.now();
      // Avoid log spam during repeated autosave attempts.
      if (errTime - lastSaveErrorLogAt > 10000) {
        Sentry.captureException(err, { tags: { context: 'saveGame' } });
        lastSaveErrorLogAt = errTime;
      }
      // Notify user once per week to keep the inbox readable.
      const hasSaveWarningThisWeek = state.messages.some(
        m => m.title === 'Save Failed' && m.week === state.week && m.season === state.season,
      );
      if (!hasSaveWarningThisWeek) {
        const msgs = addMsg(state.messages, {
          type: 'warning',
          title: 'Save Failed',
          body: 'Your game could not be saved — storage may be full. Try freeing up space on your device.',
          week: state.week,
          season: state.season,
        });
        set({ messages: msgs });
      }
    }

    // Save session snapshot for "Welcome back" recap
    const myEntry = state.leagueTable.find(e => e.clubId === state.playerClubId);
    const myPos = myEntry ? state.leagueTable.indexOf(myEntry) + 1 : 0;
    const playerClub = state.clubs[state.playerClubId];
    const injuredCount = playerClub
      ? playerClub.playerIds.filter(id => state.players[id]?.injured).length
      : 0;
    saveSessionSnapshot({
      week: state.week,
      season: state.season,
      leaguePosition: myPos,
      boardConfidence: state.boardConfidence,
      budget: playerClub?.budget || 0,
      injuredCount,
      timestamp: Date.now(),
    });
  },

  loadGame: (slot?: number) => {
    resetSeasonGrowth();
    clearLeagueTableCache();
    migrateLegacySave();
    const s = slot ?? get().activeSlot;
    let raw = readSaveSlot(s);
    if (!raw) return false;

    // Try to parse primary save; if corrupted, fall back to backup
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      Sentry.captureMessage('[Load] Primary save corrupted, trying backup', 'warning');
      raw = readSaveSlotBackup(s);
      if (!raw) return false;
      try {
        parsed = JSON.parse(raw);
        // Restore backup as primary
        promoteSaveBackup(s, raw);
      } catch { return false; }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = migrateSaveData(parsed) as Record<string, any>;
      if (data.migrationError) {
        Sentry.captureMessage('[LoadGame] Save migration failed — save data may be corrupt', 'error');
        return false;
      }
      const clubIds = Object.keys(data.clubs);
      const leagueTable = buildLeagueTable(data.fixtures, clubIds);

      // Ensure division data exists (backward compat for old saves)
      const playerDivision: LeagueId = data.playerDivision || 'eng';
      const divisionClubs: Record<string, string[]> = data.divisionClubs || { [playerDivision]: clubIds };
      const divisionFixtures: Record<string, Match[]> = data.divisionFixtures || { [playerDivision]: data.fixtures };
      const divisionTables = buildAllDivisionTables(divisionFixtures, divisionClubs);

      set({
        gameStarted: true, ...data, leagueTable,
        activeSlot: s,
        // Backfill settings with defaults for fields added after save was created
        settings: {
          matchSpeed: 600, showOverallOnPitch: true, autoSave: true, hapticsEnabled: true,
          hidePageHints: false, confirmAllOffers: false, reducedMotion: false,
          ...(data.settings || {}),
        },
        currentScreen: (data.gameMode === 'career' && data.careerManager && !data.careerManager.contract) ? 'job-market' : 'dashboard',
        previousScreen: null,
        currentMatchResult: null, selectedPlayerId: null,
        transferWindowOpen: data.week <= SUMMER_WINDOW_END || (data.week >= WINTER_WINDOW_START && data.week <= WINTER_WINDOW_END),
        matchSubsUsed: 0,
        matchPlayerRatings: [],
        currentCupTieId: null,
        unlockedAchievements: data.unlockedAchievements || [],
        pendingAchievementIds: [],
        managerStats: data.managerStats || { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
        activeLoans: data.activeLoans || [],
        incomingLoanOffers: data.incomingLoanOffers || [],
        outgoingLoanRequests: data.outgoingLoanRequests || [],
        cup: data.cup || generateCupDraw(clubIds),
        friendlies: data.friendlies || [],
        galacticoUsedThisSeason: data.galacticoUsedThisSeason || false,
        invincibleUsedThisSeason: data.invincibleUsedThisSeason || false,
        preMatchSnapshot: data.preMatchSnapshot || null,
        leagueCup: data.leagueCup || { ties: [], currentRound: null, eliminated: false, winner: null },
        championsCup: data.championsCup || null,
        shieldCup: data.shieldCup || null,
        conferenceCup: data.conferenceCup || null,
        virtualClubs: data.virtualClubs || {},
        continentalQualification: data.continentalQualification || null,
        domesticSuperCup: data.domesticSuperCup || null,
        continentalSuperCup: data.continentalSuperCup || null,
        currentContinentalMatchId: data.currentContinentalMatchId || null,
        currentContinentalCompetition: data.currentContinentalCompetition || null,
        continentalCoefficients: data.continentalCoefficients || {},
        currentLeagueCupTieId: data.currentLeagueCupTieId || null,
        fanMood: data.fanMood ?? 50,
        activeChallenge: data.activeChallenge || null,
        pendingPressConference: null,
        activeNegotiation: null,
        playerDivision,
        divisionClubs,
        divisionFixtures,
        divisionTables,
        derbies: data.derbies || DERBIES,
        seasonPhase: data.seasonPhase || 'regular',
        clubRecords: data.clubRecords || createEmptyRecords(),
        careerTimeline: data.careerTimeline || [],
        managerProgression: data.managerProgression || createDefaultProgression(),
        lastSeasonTurnover: data.lastSeasonTurnover || null,
        weeklyObjectives: data.weeklyObjectives || [],
        objectiveStreak: data.objectiveStreak || 0,
        objectivesStartWeek: data.objectivesStartWeek || data.week || 1,
        completedCoachTaskIds: data.completedCoachTaskIds || [],
        weekCliffhangers: data.weekCliffhangers || [],
        lastMatchDrama: data.lastMatchDrama || null,
        lastMatchCompetition: data.lastMatchCompetition || null,
        sessionStats: data.sessionStats || { startWeek: data.week || 1, startSeason: data.season || 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
        weeklyDigest: data.weeklyDigest || null,
        pendingStoryline: data.pendingStoryline || null,
        activeStorylineChains: data.activeStorylineChains || [],
        completedStorylineChainIds: data.completedStorylineChainIds || [],
        preMatchLeaguePosition: data.preMatchLeaguePosition ?? 10,
        lastMatchXPGain: data.lastMatchXPGain ?? 0,
        scoutWatchList: data.scoutWatchList || [],
        freeAgents: data.freeAgents || [],
        transferNews: data.transferNews || [],
        sponsorDeals: data.sponsorDeals || [],
        sponsorOffers: data.sponsorOffers || [],
        sponsorSlotCooldowns: data.sponsorSlotCooldowns || {},
        negotiationStrikes: data.negotiationStrikes || {},
        merchandise: data.merchandise || getDefaultMerchState(),
        halfTimeState: null,
        matchPhase: 'none' as const,
        pendingFarewell: Array.isArray(data.pendingFarewell) ? data.pendingFarewell : data.pendingFarewell ? [data.pendingFarewell] : [],
        monetization: data.monetization || DEFAULT_MONETIZATION_STATE,
        nationalTeam: data.nationalTeam || null,
        internationalTournament: data.internationalTournament || null,
        managerNationality: data.managerNationality || null,
        // Career Mode
        gameMode: data.gameMode || 'sandbox',
        careerManager: data.careerManager
          ? { ...data.careerManager, unemployedWeeks: data.careerManager.unemployedWeeks ?? 0 }
          : null,
        jobVacancies: data.jobVacancies || [],
        jobOffers: data.jobOffers || [],
        activeInterview: data.activeInterview || null,
        seasonGrowthTracker: data.seasonGrowthTracker || {},
      });
      // Hydrate module-level growth tracker so development functions use persisted data
      hydrateSeasonGrowth(data.seasonGrowthTracker || {});
      return true;
    } catch { return false; }
  },

  cleanupAbandonedMatch: () => {
    const state = get();
    // Only clean up if a match was in progress (halfTimeState or matchPhase indicates mid-match)
    if (state.matchPhase === 'none' && !state.halfTimeState) return;
    // Remove ephemeral (virtual) club players and clubs that were injected for continental matches
    const virtualIds = Object.keys(state.virtualClubs || {});
    if (virtualIds.length > 0) {
      const newClubs = { ...state.clubs };
      const newPlayers = { ...state.players };
      for (const vid of virtualIds) {
        // Only remove clubs that were ephemeral injections (they start with 'virtual-')
        if (vid.startsWith('virtual-') && newClubs[vid]) {
          // Remove ephemeral players belonging to this club
          const club = newClubs[vid];
          if (club.playerIds) {
            for (const pid of club.playerIds) {
              delete newPlayers[pid];
            }
          }
          delete newClubs[vid];
        }
      }
      set({
        clubs: newClubs, players: newPlayers,
        halfTimeState: null, currentMatchWeather: null, matchPhase: 'none' as const,
        currentCupTieId: null, currentLeagueCupTieId: null,
        currentContinentalMatchId: null, currentContinentalCompetition: null,
        matchSubsUsed: 0,
      });
    } else {
      // No virtual clubs to clean — just reset match tracking state
      set({
        halfTimeState: null, currentMatchWeather: null, matchPhase: 'none' as const,
        currentCupTieId: null, currentLeagueCupTieId: null,
        currentContinentalMatchId: null, currentContinentalCompetition: null,
        matchSubsUsed: 0,
      });
    }
  },

  resetGame: (slot?: number) => {
    const s = slot ?? get().activeSlot;
    removeSaveSlot(s);
    set({
      gameStarted: false, playerClubId: '', currentScreen: 'dashboard',
      clubs: {}, players: {}, fixtures: [], leagueTable: [],
      messages: [], seasonHistory: [], incomingOffers: [],
      matchPlayerRatings: [], halfTimeState: null, currentMatchWeather: null, matchPhase: 'none' as const,
      currentMatchResult: null, matchSubsUsed: 0, currentCupTieId: null,
      transferMarket: [], shortlist: [], scoutWatchList: [], transferNews: [],
      activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
      cup: { ties: [], currentRound: null, eliminated: false, winner: null },
      pendingPressConference: null, activeNegotiation: null,
      pendingFarewell: [], pendingStoryline: null,
      activeStorylineChains: [], completedStorylineChainIds: [], weeklyObjectives: [],
      objectiveStreak: 0, objectivesStartWeek: 1, completedCoachTaskIds: [],
      weekCliffhangers: [], rivalries: {}, lastMatchDrama: null, lastMatchCompetition: null,
      sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
      weeklyDigest: null, careerTimeline: [],
      gameMode: 'sandbox', careerManager: null, jobVacancies: [], jobOffers: [],
      sponsorDeals: [], sponsorOffers: [], sponsorSlotCooldowns: {}, negotiationStrikes: {},
      merchandise: getDefaultMerchState(),
      continentalCoefficients: {},
      monetization: {
        ...DEFAULT_MONETIZATION_STATE,
        // Preserve purchases and subscription across save resets
        entitlements: get().monetization.entitlements,
        firstLaunchTimestamp: get().monetization.firstLaunchTimestamp,
        subscription: get().monetization.subscription,
      },
    });
  },

  // ── Prestige ──
  startPrestige: (optionId: 'rival' | 'drop-division' | 'restart-perks') => {
    const state = get();
    const currentProg = state.managerProgression;
    const newPrestigeLevel = (currentProg.prestigeLevel || 0) + 1;

    // Save to Hall of Managers before resetting
    try {
      const club = state.clubs[state.playerClubId];
      const entry = buildHallEntry(
        `prestige-${Date.now()}`,
        club?.name || 'Unknown Club',
        state.seasonHistory,
        state.managerStats,
        newPrestigeLevel,
      );
      saveToHall(entry);
    } catch { /* hall of managers save is best-effort */ }

    // Determine new club based on prestige option
    const currentClubId = state.playerClubId;
    const allClubData = ALL_CLUBS;

    let newClubId: string;
    let budgetMultiplier = 1;
    let preserveProgression = true;

    if (optionId === 'rival') {
      // Pick a random different club in the same league
      const sameLeague = allClubData.filter(c => c.divisionId === state.playerDivision && c.id !== currentClubId);
      newClubId = sameLeague.length > 0 ? sameLeague[Math.floor(Math.random() * sameLeague.length)].id : currentClubId;
    } else if (optionId === 'drop-division') {
      // Pick a random club from a different league (lower quality tier if possible)
      const currentLeague = LEAGUES.find(l => l.id === state.playerDivision);
      const currentTier = currentLeague?.qualityTier || 1;
      const lowerLeagues = LEAGUES.filter(l => l.qualityTier > currentTier);
      const targetLeague = lowerLeagues.length > 0 ? lowerLeagues[Math.floor(Math.random() * lowerLeagues.length)] : currentLeague;
      const targetLeagueId = targetLeague?.id || state.playerDivision;
      const lowerClubs = allClubData.filter(c => c.divisionId === targetLeagueId);
      newClubId = lowerClubs.length > 0 ? lowerClubs[Math.floor(Math.random() * lowerClubs.length)].id : currentClubId;
      budgetMultiplier = 1.5;
    } else {
      // restart-perks: same club, fresh start with perks reset
      newClubId = currentClubId;
      preserveProgression = false;
    }

    // Reinitialize game with new club
    get().initGame(newClubId);

    // Apply prestige bonuses after init
    const freshState = get();
    const updatedProg = preserveProgression
      ? { ...currentProg, prestigeLevel: newPrestigeLevel }
      : { ...freshState.managerProgression, prestigeLevel: newPrestigeLevel };

    const updates: Partial<GameState> = {
      managerProgression: updatedProg,
      currentScreen: 'dashboard' as const,
    };

    // Apply budget multiplier
    if (budgetMultiplier !== 1) {
      const newClubs = { ...freshState.clubs };
      const club = { ...newClubs[newClubId] };
      club.budget = Math.round(club.budget * budgetMultiplier);
      newClubs[newClubId] = club;
      updates.clubs = newClubs;
    }

    // Carry over career timeline and achievements for all prestige modes
    if (preserveProgression) {
      updates.careerTimeline = [...state.careerTimeline, {
        id: crypto.randomUUID(),
        type: 'prestige',
        title: `Prestige ${newPrestigeLevel}`,
        description: `Started a new journey with prestige level ${newPrestigeLevel}.`,
        season: state.season,
        week: state.week,
        icon: 'star',
      }];
      updates.unlockedAchievements = state.unlockedAchievements;
      updates.seasonHistory = state.seasonHistory;
    }

    set(updates);
  },

  // ── Farewell ──
  pendingFarewell: [] as GameState['pendingFarewell'],

  dismissFarewell: () => {
    const remaining = get().pendingFarewell.slice(1);
    set({ pendingFarewell: remaining });
  },
});
