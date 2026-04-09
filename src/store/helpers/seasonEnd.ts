/**
 * Season End Logic — extracted from orchestrationSlice.ts
 * Handles end-of-season processing: awards, aging, contracts, promotion/relegation, etc.
 */
import { Club, Player, PlayerAttributes, TransferListing, SeasonHistory, IncomingOffer, IncomingLoanOffer, FacilitiesState, BoardObjective, Position, Message, Match, MatchEvent, LeagueId, SeasonTurnover, LeagueTableEntry, JobVacancy, PenaltyKick } from '@/types/game';
import { calculateReputationTier, generateJobVacancies, generateProactiveOffer, getRetirementAge, calculateLegacyScore, getReputationTierLabel } from '@/utils/managerCareer';
import {
  GROWTH_TACTICAL_PER_MATCH, GROWTH_MOTIVATION_PER_MORALE_EVENT, GROWTH_SCOUTING_PER_ASSIGNMENT,
  GROWTH_DISCIPLINE_PER_CLEAN_MATCH, MOD_DISCIPLINE_CARDS, MOD_TACTICAL_FAMILIARITY, MOD_YOUTH_GROWTH,
  MOD_SCOUTING_SPEED, JOB_MARKET_REFRESH_WEEKS, STAT_MAX, MOTM_CHECK_INTERVAL, MOTM_MIN_MATCHES,
  REP_PROMOTION, REP_RELEGATION, REP_OVERACHIEVE_BONUS, REP_UNDERACHIEVE_PENALTY,
  REP_WIN, REP_DRAW, REP_LOSS, REP_TITLE, REP_CUP_WIN, REP_SACKING, REP_MIN, REP_MAX,
  FORCED_RETIREMENT_UNEMPLOYED_WEEKS,
  PROACTIVE_OFFER_CHECK_INTERVAL, PROACTIVE_OFFER_MAX_PENDING,
} from '@/config/managerCareer';
import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, getDerbyIntensity, getDerbyName, clearLeagueTableCache } from '@/data/league';
import { generateSquad, selectBestLineup, generatePlayer, calculateOverall } from '@/utils/playerGen';
import { simulateMatch, simulateHalf, finalizeMatch } from '@/engine/match';
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
import { getChampionsCupQualifiers, getShieldCupQualifiers, generateContinentalDraw } from '@/data/continentalDraw';
import { updateCoefficients } from '@/utils/continentalCoefficients';
import { simulateGroupMatchday, getCurrentMatchday, isGroupStageComplete, generateKnockoutFromGroups, simulateKnockoutLeg, isKnockoutRoundComplete, advanceKnockoutRound, getContinentalResultForClub, createEphemeralClub, findPlayerContinentalMatch } from '@/utils/continental';
import { CONTINENTAL_GROUP_WEEKS, CONTINENTAL_R16_WEEKS, CONTINENTAL_QF_WEEKS, CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK, LEAGUE_CUP_WEEKS, DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK, CONTINENTAL_PRIZE_MONEY, REP_CHAMPIONS_CUP_WIN, REP_SHIELD_CUP_WIN, REP_LEAGUE_CUP_WIN, REP_CONTINENTAL_GROUP, REP_CONTINENTAL_KNOCKOUT } from '@/config/continental';
import { generatePressConference, getPressContext } from '@/data/pressConferences';
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
import { generateScoutReport } from '@/utils/scoutingReport';
import { calculateWeeklyMerchRevenue, getDefaultMerchState } from '@/utils/merchandise';
import { getEffectiveStadiumLevel } from '@/utils/facilities';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { MERCH_PRICING_TIERS, MERCH_CAMPAIGN_COOLDOWN_WEEKS } from '@/config/merchandise';
import { MOTIVATE_ATTACK_BOOST, MOTIVATE_FOUL_BONUS, CALM_DEFENSE_BOOST, CALM_FOUL_REDUCTION, DEMAND_ATTACK_BOOST, DEMAND_DEFENSE_PENALTY } from '@/config/teamTalk';
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
  MIN_SQUAD_SIZE, REPLACEMENT_QUALITY_REP_MULTIPLIER, REPLACEMENT_QUALITY_BASE, REPLACEMENT_QUALITY_VARIANCE,
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
  FREE_AGENT_POOL_MAX,
  UNHAPPY_THRESHOLD, UNHAPPY_WEEKS_TO_REQUEST, UNHAPPY_CONTAGION_WEEKS, UNHAPPY_CONTAGION_MORALE_HIT,
  MEDICAL_REINJURY_REDUCTION_PER_LEVEL,
  MAX_FINANCE_HISTORY, MAX_CAREER_TIMELINE,
  OBJECTIVE_CYCLE_WEEKS,
} from '@/config/gameBalance';
import {
  SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END,
  AI_OFFER_CHANCE, AI_OFFER_MIN_BUDGET_RATIO, AI_OFFER_POSITION_THRESHOLD,
  URGENCY_NONE, URGENCY_ONE, URGENCY_TWO_PLUS,
  OFFER_FEE_BASE, OFFER_FEE_RANDOM_RANGE, OFFER_MAX_BUDGET_RATIO,
  RUMOR_CHANCE, DEADLINE_DAY_OFFER_MULTIPLIER, DEADLINE_DAY_BID_PREMIUM,
  MARKET_REPLENISH_THRESHOLD, LISTING_EXPIRY_WEEKS, CLUB_LISTING_EXPIRY_WEEKS, LISTING_RELIST_CHANCE, LISTING_RELIST_DISCOUNT,
  FREE_AGENT_SPAWN_CHANCE, OFFER_EXPIRY_WEEKS,
  UNSOLICITED_OFFER_CHANCE, UNSOLICITED_FEE_BASE, UNSOLICITED_FEE_RANGE,
  COMPETING_BID_PREMIUM,
  ASKING_PRICE_BID_ANCHOR,
  INJURY_BID_DISCOUNT, LONG_INJURY_BID_DISCOUNT, LONG_INJURY_WEEKS_THRESHOLD,
} from '@/config/transfers';
import { getPerformanceMultiplier, getContractLengthFactor } from '@/utils/transferOffers';
import { generateInitialMarket, generateInitialFreeAgents, replenishMarket, spawnFreeAgents, processListingExpiry } from '@/utils/transferMarketGen';
import { PENALTY_CONVERSION_RATE, SHOUT_MODIFIERS, SHOUT_CUMULATIVE_SCALE } from '@/config/matchEngine';
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
import { NATIONAL_CALLUP_MORALE_BOOST, INTERNATIONAL_FITNESS_COST, NT_JOB_MIN_REPUTATION, NT_JOB_REHIRE_REPUTATION, NT_JOB_OFFER_DURATION_WEEKS, REP_INTL_TOURNAMENT_WIN, REP_INTL_FINAL, REP_INTL_SEMI, REP_INTL_KNOCKOUT, REP_INTL_GROUP_EXIT, NT_SACK_GROUP_EXIT_THRESHOLD } from '@/config/gameBalance';
import { generateRandomEvents } from '@/utils/randomEvents';
import { getWinStreak, detectMatchDrama } from '@/utils/celebrations';
import { generateCliffhangers } from '@/utils/weekPreview';
import { generateMonthlyObjectives, evaluateObjectives, calculateCompletedXP } from '@/utils/weeklyObjectives';
import type { ObjectiveContext } from '@/utils/weeklyObjectives';
import { generateAIManagerProfile } from '@/config/aiManager';
import { processAIWeekly } from '@/utils/aiSimulation';
import {
  INJURY_TYPES, NON_FOUL_INJURY_TYPE_WEIGHTS,
  INJURY_SEVERITY_WEIGHTS,
} from '@/config/gameBalance';
import type { InjuryType, InjurySeverity, InjuryDetails } from '@/types/game';
import { createMilestone } from '@/utils/milestones';
import { createDefaultProgression, grantXP, XP_REWARDS, MANAGER_PERKS, canUnlockPerk, hasPerk } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';
import type { CareerMilestone, PerkId, ManagerProgression } from '@/types/game';
import { processMatchResult } from '@/store/helpers/matchProcessing';
import { processSponsorWeek, processSponsorSeasonEnd } from '@/store/slices/sponsorSlice';
import { generateObjectives, generateLeagueCupDraw } from '@/store/helpers/gameInit';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;
const lastSaveErrorLogAt = 0;
const lastSaveAt = 0;
const SAVE_DEBOUNCE_MS = 2000; // Minimum 2s between auto-saves

// migrateLegacySave and getSlotSummaries extracted to @/store/helpers/persistence
export { getSlotSummaries } from '@/store/helpers/persistence';

// Re-export generateObjectives and generateLeagueCupDraw used by season end
import { generateObjectives, generateLeagueCupDraw } from '@/store/helpers/gameInit';
export { generateObjectives, generateLeagueCupDraw };

export
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
  const ballonDOrRanking = calculateBallonDOr(allPlayersList, clubs, leagueTable, state.divisionTables || {});

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
    (state.shieldCup?.winnerId === playerClubId ? 1 : 0);
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
  // Clean up players from replaced clubs
  for (const replacedId of turnover.replacedClubs) {
    const rClub = clubs[replacedId];
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
      suspendedUntilWeek: undefined, growthDelta: 0, lastAttributeChanges: undefined, lastTrainingGains: undefined, onLoan: false,
      loanFromClubId: undefined, loanToClubId: undefined, lowMoraleWeeks: 0, wantsToLeave: false, transferCooldownUntilWeek: undefined, lastTransferTalkWeek: undefined,
    };
    if (aged.contractEnd <= season) {
      const club = newClubs[aged.clubId];
      if (club) {
        const updatedClub = { ...club };
        updatedClub.playerIds = updatedClub.playerIds.filter(id => id !== aged.id);
        updatedClub.lineup = updatedClub.lineup.filter(id => id !== aged.id);
        updatedClub.subs = updatedClub.subs.filter(id => id !== aged.id);
        updatedClub.wageBill -= aged.wage;
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

  // Deduplicate players across clubs — if a player ended up in multiple clubs
  // (e.g., due to AI transfer/loan timing), keep the one matching player.clubId
  const seenPlayerClub = new Map<string, string>();
  for (const club of Object.values(newClubs)) {
    for (const pid of club.playerIds) {
      if (seenPlayerClub.has(pid)) {
        const player = newPlayers[pid];
        const correctClubId = player?.clubId || '';
        const prevClubId = seenPlayerClub.get(pid)!;
        // Remove from the wrong club
        const wrongClubId = correctClubId === club.id ? prevClubId : club.id;
        const wrongClub = { ...newClubs[wrongClubId] };
        wrongClub.playerIds = wrongClub.playerIds.filter(id => id !== pid);
        wrongClub.lineup = wrongClub.lineup.filter(id => id !== pid);
        wrongClub.subs = wrongClub.subs.filter(id => id !== pid);
        newClubs[wrongClubId] = wrongClub;
      }
      seenPlayerClub.set(pid, club.id);
    }
  }

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
      const repQuality = (club.reputation * REPLACEMENT_QUALITY_REP_MULTIPLIER) + REPLACEMENT_QUALITY_BASE + Math.floor(Math.random() * REPLACEMENT_QUALITY_VARIANCE);
      const quality = Math.round(repQuality * 0.4 + (club.squadQuality || repQuality) * 0.6);
      const newP = generatePlayer(fillPos, quality, club.id, newSeason, club.divisionId);
      newPlayers[newP.id] = newP;
      const fillClub = { ...newClubs[club.id] };
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
        const emergencyQuality = Math.round(Math.max(35, (club.reputation * 10) + 20) * 0.4 + (club.squadQuality || 50) * 0.6);
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

  // Clean up aged-out national team pool players (35+) and update poolPlayerIds
  let updatedNTPoolIds = currentNT?.poolPlayerIds || [];
  if (currentNT && updatedNTPoolIds.length > 0) {
    updatedNTPoolIds = updatedNTPoolIds.filter(pid => {
      const p = newPlayers[pid];
      return p && p.age <= 35;
    });
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

  // Generate continental tournaments based on previous season's league table
  const prevLeagueTable = state.leagueTable;
  const playerClubMap: Record<string, { name: string; shortName: string; color: string; reputation: number }> = {};
  for (const [id, club] of Object.entries(state.clubs)) {
    playerClubMap[id] = { name: club.name, shortName: club.shortName, color: club.color, reputation: club.reputation };
  }

  const champQ = getChampionsCupQualifiers(newPlayerDivision, prevLeagueTable, playerClubMap);
  const champIds = new Set(champQ.qualifiers);
  const shieldQ = getShieldCupQualifiers(newPlayerDivision, prevLeagueTable, playerClubMap, champIds, state.cup.winner);

  const allVirtualClubs = { ...champQ.virtualClubs, ...shieldQ.virtualClubs };

  // Update continental coefficients from completed tournaments
  let coefficients = state.continentalCoefficients || {};
  if (state.championsCup && state.championsCup.currentPhase === 'complete') {
    coefficients = updateCoefficients(coefficients, state.championsCup, season);
  }
  if (state.shieldCup && state.shieldCup.currentPhase === 'complete') {
    coefficients = updateCoefficients(coefficients, state.shieldCup, season);
  }

  let newChampionsCup: import('@/types/game').ContinentalTournamentState | null = null;
  let newShieldCup: import('@/types/game').ContinentalTournamentState | null = null;

  if (champQ.qualifiers.length >= 8) {
    newChampionsCup = generateContinentalDraw('champions_cup', newSeason, champQ.qualifiers, allVirtualClubs, playerClubId, coefficients);
  }
  if (shieldQ.qualifiers.length >= 8) {
    newShieldCup = generateContinentalDraw('shield_cup', newSeason, shieldQ.qualifiers, allVirtualClubs, playerClubId, coefficients);
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

  const playerClubForObjectives = newClubs[playerClubId];
  const objectives = playerClubForObjectives ? generateObjectives(playerClubForObjectives, newPlayerDivision) : [];
  const verdict = history.boardVerdict;
  const newConfidence = SEASON_END_CONFIDENCE[verdict] || CONFIDENCE_MIN;

  let newMessages = addMsg(inputMessages, {
    week: 1, season: newSeason, type: 'board',
    title: `Season ${newSeason} Begins`,
    body: verdict === 'sacked'
      ? `Despite last season's poor results, the board has given you one last chance. Don't waste it.`
      : `Welcome to Season ${newSeason}. Your board confidence stands at ${newConfidence}%. Good luck!`,
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
  const { prospects: newYouthProspects, players: youthPlayers } = generateYouthProspects(
    playerClubId, pcForYouth.youthRating, youthCoachQ, newSeason, SEASON_YOUTH_INTAKE_MIN + Math.floor(Math.random() * SEASON_YOUTH_INTAKE_RANGE), pcForYouth.squadQuality
  );
  // Golden Generation perk: guarantee at least one high-potential youth
  if (hasPerk(state.managerProgression, 'golden_generation') && youthPlayers.length > 0) {
    const hasHighPotential = youthPlayers.some(p => p.potential >= GOLDEN_GEN_MIN_POTENTIAL);
    if (!hasHighPotential) {
      const luckyIdx = Math.floor(Math.random() * youthPlayers.length);
      youthPlayers[luckyIdx] = { ...youthPlayers[luckyIdx], potential: GOLDEN_GEN_MIN_POTENTIAL + Math.floor(Math.random() * 10) };
    }
  }
  youthPlayers.forEach(p => { newPlayers[p.id] = p; });
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
    messages: newMessages, incomingOffers: [], matchSubsUsed: 0, shortlist: [], scoutWatchList: [],
    sponsorDeals: sponsorSeasonEnd.sponsorDeals || state.sponsorDeals,
    sponsorOffers: [],
    sponsorSlotCooldowns: {},
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
    championsCup: newChampionsCup,
    shieldCup: newShieldCup,
    virtualClubs: allVirtualClubs,
    continentalQualification: { champions: champQ.qualifiers, shield: shieldQ.qualifiers },
    continentalCoefficients: coefficients,
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
    const mergedPoolIds = [...existingPoolIds, ...Object.keys(topUpPlayers)];

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
            const bonusState = get();
            const bonusClub = bonusState.clubs[bonusState.playerClubId];
            const bonusMsg = addMsg(bonusState.messages, {
              week: TOTAL_WEEKS, season, type: 'general',
              title: 'Contract Bonuses Earned!',
              body: `You earned £${(bonusPayout / 1000).toFixed(0)}k in performance bonuses this season.`,
            });
            set({
              messages: bonusMsg,
              clubs: {
                ...bonusState.clubs,
                [bonusState.playerClubId]: { ...bonusClub, budget: bonusClub.budget + bonusPayout },
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

        // Generate job vacancies

        const vacancies = generateJobVacancies(cs.clubs, cm.reputationScore, cs.season + 1, 1, cs.playerClubId);

        set({
          careerManager: cm,
          jobVacancies: vacancies,
          jobOffers: [],
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
            careerUpdate.jobVacancies = generateJobVacancies(cs.clubs, cm.reputationScore, cs.season + 1, 1, cs.playerClubId);
            careerUpdate.jobOffers = [];
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
