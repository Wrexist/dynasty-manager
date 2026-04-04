import { Club, Player, PlayerAttributes, TransferListing, SeasonHistory, IncomingOffer, IncomingLoanOffer, FacilitiesState, BoardObjective, Position, Message, Match, MatchEvent, LeagueId, SeasonTurnover, LeagueTableEntry, JobVacancy } from '@/types/game';
import { calculateReputationTier, generateJobVacancies, generateProactiveOffer, getRetirementAge, calculateLegacyScore } from '@/utils/managerCareer';
import {
  GROWTH_TACTICAL_PER_MATCH, GROWTH_MOTIVATION_PER_MORALE_EVENT, GROWTH_SCOUTING_PER_ASSIGNMENT,
  GROWTH_DISCIPLINE_PER_CLEAN_MATCH, MOD_DISCIPLINE_CARDS, MOD_TACTICAL_FAMILIARITY, MOD_YOUTH_GROWTH,
  MOD_SCOUTING_SPEED, JOB_MARKET_REFRESH_WEEKS, STAT_MAX, MOTM_CHECK_INTERVAL, MOTM_MIN_MATCHES,
  REP_PROMOTION, REP_RELEGATION, REP_OVERACHIEVE_BONUS, REP_UNDERACHIEVE_PENALTY,
  REP_WIN, REP_DRAW, REP_LOSS, REP_TITLE, REP_CUP_WIN, REP_SACKING,
  FORCED_RETIREMENT_UNEMPLOYED_WEEKS,
  PROACTIVE_OFFER_CHECK_INTERVAL, PROACTIVE_OFFER_MAX_PENDING,
} from '@/config/managerCareer';
import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, getDerbyIntensity, getDerbyName } from '@/data/league';
import { generateSquad, selectBestLineup, generatePlayer, calculateOverall } from '@/utils/playerGen';
import { simulateMatch, simulateHalf, finalizeMatch } from '@/engine/match';
import { generateInitialStaff, generateStaffMarket, getStaffBonus } from '@/utils/staff';
import { applyWeeklyTraining, getInjuryRisk, updateTacticalFamiliarity, getDominantTrainingFocus, getStreakMultiplier, updateStreaks, generateTrainingReport } from '@/utils/training';
import { completeAssignment } from '@/utils/scouting';
import { MAX_SCOUT_REPORTS } from '@/config/scouting';
import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../storeTypes';
import { addMsg, getSuffix, pick, shuffle } from '@/utils/helpers';
import { migrateLegacySave, saveSessionSnapshot, readSaveSlot, readSaveSlotBackup, writeSaveSlot, promoteSaveBackup, removeSaveSlot, trimFixturesForSave, trimFixtureArrayForSave } from '@/store/helpers/persistence';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { checkAchievements, ACHIEVEMENTS, getAchievementXP } from '@/utils/achievements';
import { generateCupDraw, advanceCupRound, getCupResultForClub, getRoundName, CUP_BYE_MARKER } from '@/data/cup';
import { getChampionsCupQualifiers, getShieldCupQualifiers, generateContinentalDraw } from '@/data/continentalDraw';
import { simulateGroupMatchday, getCurrentMatchday, isGroupStageComplete, generateKnockoutFromGroups, simulateKnockoutLeg, isKnockoutRoundComplete, advanceKnockoutRound, getContinentalResultForClub, createEphemeralClub, findPlayerContinentalMatch } from '@/utils/continental';
import { CONTINENTAL_GROUP_WEEKS, CONTINENTAL_R16_WEEKS, CONTINENTAL_QF_WEEKS, CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK, LEAGUE_CUP_WEEKS, DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK, CONTINENTAL_PRIZE_MONEY, REP_CHAMPIONS_CUP_WIN, REP_SHIELD_CUP_WIN, REP_LEAGUE_CUP_WIN, REP_CONTINENTAL_GROUP, REP_CONTINENTAL_KNOCKOUT } from '@/config/continental';
import { generatePressConference } from '@/data/pressConferences';
import { isPro } from '@/utils/monetization';
import { getMentorBonus } from '@/utils/chemistry';
import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';
import { checkChallengeComplete, checkChallengeFailed, CHALLENGES } from '@/data/challenges';
import { calculateSeasonAwards } from '@/utils/seasonAwards';
import { getLeadershipBonus, wantsTransfer } from '@/utils/personality';
import { buildTransferTalk } from '@/utils/transferTalk';
import { createEmptyRecords, updateRecords, findBiggestWin } from '@/utils/records';
import { getFarewellSummary } from '@/utils/playerNarratives';
import { calculateWeeklyMerchRevenue, getDefaultMerchState } from '@/utils/merchandise';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { MERCH_PRICING_TIERS, MERCH_CAMPAIGN_COOLDOWN_WEEKS } from '@/config/merchandise';
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
  MARKET_REPLENISH_THRESHOLD, LISTING_EXPIRY_WEEKS, LISTING_RELIST_CHANCE, LISTING_RELIST_DISCOUNT,
  FREE_AGENT_SPAWN_CHANCE,
} from '@/config/transfers';
import { generateInitialMarket, generateInitialFreeAgents, replenishMarket, spawnFreeAgents, processListingExpiry } from '@/utils/transferMarketGen';
import { PENALTY_CONVERSION_RATE } from '@/config/matchEngine';
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
import { getTournamentForSeason, generateTournament, processGroupWeek, generateKnockoutBracket, processKnockoutRound, autoSelectNationalSquad } from '@/utils/international';
import { NATIONAL_CALLUP_MORALE_BOOST, INTERNATIONAL_FITNESS_COST } from '@/config/gameBalance';
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
) {
  for (const ev of events) {
    if (ev.type === 'goal' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
    }
    if (ev.type === 'goal' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
      newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
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
}

function generateObjectives(club: Club, leagueId?: LeagueId): BoardObjective[] {
  const objectives: BoardObjective[] = [];
  const lid = leagueId || club.divisionId;
  const league = LEAGUES.find(l => l.id === lid);
  const teamCount = league?.teamCount || 20;
  const replacedSlots = league?.replacedSlots || 0;
  const safePos = teamCount - replacedSlots;

  // League objectives based on reputation
  if (club.reputation >= 5) {
    objectives.push({ id: '1', description: 'Win the League', priority: 'critical', completed: false });
    objectives.push({ id: '2', description: 'Finish in Top 3', priority: 'important', completed: false });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '1', description: 'Finish in Top 6', priority: 'critical', completed: false });
    objectives.push({ id: '2', description: 'Reach Top Half', priority: 'important', completed: false });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '1', description: 'Reach Top Half', priority: 'critical', completed: false });
  } else {
    objectives.push({ id: '1', description: replacedSlots > 0 ? `Avoid Replacement (Top ${safePos})` : 'Finish in Top Half', priority: 'critical', completed: false });
  }
  // Cup objectives based on reputation
  if (club.reputation >= 5) {
    objectives.push({ id: '4', description: 'Win the Cup', priority: 'important', completed: false });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '4', description: 'Reach Cup Semi-Final', priority: 'important', completed: false });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '4', description: 'Reach Cup Quarter-Final', priority: 'optional', completed: false });
  }
  objectives.push({ id: '3', description: 'Stay within budget', priority: 'optional', completed: false });
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
      // Player has a match this week — auto-sim it (they manage via the UI later in full version)
      // For now, auto-sim all matches including the player's
      const { homeGoals, awayGoals } = (() => {
        // Simple sim based on ranking
        const isHome = playerMatchThisWeek.homeNation === nationality;
        const homeStr = isHome ? 0.6 : 0.5;
        const awayStr = isHome ? 0.5 : 0.6;
        const hg = Math.floor(Math.random() * 3 * homeStr + Math.random());
        const ag = Math.floor(Math.random() * 3 * awayStr + Math.random());
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

      // Apply fitness cost to called-up players and attribute goals
      const newPlayers = { ...state.players };
      const playerGoals = isHome ? homeGoals : awayGoals;
      const updatedCaps = { ...nt.caps };
      const updatedIntlGoals = { ...nt.internationalGoals };
      for (const pid of nt.squad) {
        if (newPlayers[pid]) {
          newPlayers[pid] = { ...newPlayers[pid], fitness: Math.max(40, newPlayers[pid].fitness - INTERNATIONAL_FITNESS_COST) };
          newPlayers[pid].internationalCaps = (newPlayers[pid].internationalCaps || 0) + 1;
          updatedCaps[pid] = (updatedCaps[pid] || 0) + 1;
        }
      }
      // Distribute goals among lineup players randomly
      const lineupIds = nt.lineup.filter(pid => newPlayers[pid]);
      for (let g = 0; g < playerGoals; g++) {
        const scorerId = lineupIds[Math.floor(Math.random() * lineupIds.length)];
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

    // Handle player's knockout tie (auto-sim for now)
    let finalTies = updatedTies;
    if (playerTie && !playerTie.played) {
      const isHome = playerTie.homeNation === nationality;
      const hg = Math.floor(Math.random() * 2 + Math.random());
      const ag = Math.floor(Math.random() * 2 + Math.random());
      let updatedPlayerTie = { ...playerTie, played: true, homeGoals: hg, awayGoals: ag };
      if (hg === ag) {
        const homeWins = Math.random() > 0.5;
        updatedPlayerTie = { ...updatedPlayerTie, penaltyShootout: { home: homeWins ? 5 : 3, away: homeWins ? 3 : 5 }, winnerId: homeWins ? playerTie.homeNation : playerTie.awayNation };
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

      // Apply fitness cost and attribute goals
      const newPlayers = { ...state.players };
      const playerGoalsKO = isHome ? hg : ag;
      const updatedCapsKO = { ...nt.caps };
      const updatedIntlGoalsKO = { ...nt.internationalGoals };
      for (const pid of nt.squad) {
        if (newPlayers[pid]) {
          newPlayers[pid] = { ...newPlayers[pid], fitness: Math.max(40, newPlayers[pid].fitness - INTERNATIONAL_FITNESS_COST) };
          newPlayers[pid].internationalCaps = (newPlayers[pid].internationalCaps || 0) + 1;
          updatedCapsKO[pid] = (updatedCapsKO[pid] || 0) + 1;
        }
      }
      const lineupIdsKO = nt.lineup.filter(pid => newPlayers[pid]);
      for (let g = 0; g < playerGoalsKO; g++) {
        const scorerId = lineupIdsKO[Math.floor(Math.random() * lineupIdsKO.length)];
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
    set({ messages: newMessages, seasonPhase: 'regular', internationalTournament: null });
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
function isAggregateDecided(state: ReturnType<typeof get>, leg2HomeGoals: number, leg2AwayGoals: number): boolean {
  if (!state.currentContinentalMatchId || !state.currentContinentalCompetition) return false;
  const tourney = state.currentContinentalCompetition === 'champions_cup' ? state.championsCup : state.shieldCup;
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
  state: ReturnType<typeof get>,
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
        if (finalTie) { newCup.winner = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId; newCup.currentRound = null; }
      } else { Object.assign(newCup, advanceCupRound(newCup)); }
    }
    const isHome = result.homeClubId === playerClubId;
    const playerWon = isHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
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
    const compKey = state.currentContinentalCompetition === 'champions_cup' ? 'championsCup' : 'shieldCup';
    const isChampions = state.currentContinentalCompetition === 'champions_cup';
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
          awardPrizeMoney(isChampions ? CONTINENTAL_PRIZE_MONEY.champions_group : CONTINENTAL_PRIZE_MONEY.shield_group);

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
            const prizeMap = isChampions
              ? { R16: CONTINENTAL_PRIZE_MONEY.champions_r16, QF: CONTINENTAL_PRIZE_MONEY.champions_qf, SF: CONTINENTAL_PRIZE_MONEY.champions_sf }
              : { R16: CONTINENTAL_PRIZE_MONEY.shield_r16, QF: CONTINENTAL_PRIZE_MONEY.shield_qf, SF: CONTINENTAL_PRIZE_MONEY.shield_sf };
            if (round === 'F') {
              const winPrize = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_winner : CONTINENTAL_PRIZE_MONEY.shield_winner;
              const losePrize = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_runner_up : CONTINENTAL_PRIZE_MONEY.shield_runner_up;
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
  state: ReturnType<typeof get>,
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
    const compKey = state.currentContinentalCompetition === 'champions_cup' ? 'championsCup' : 'shieldCup';
    const isChampions = state.currentContinentalCompetition === 'champions_cup';
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
        const prizeMap = isChampions
          ? { R16: CONTINENTAL_PRIZE_MONEY.champions_r16, QF: CONTINENTAL_PRIZE_MONEY.champions_qf, SF: CONTINENTAL_PRIZE_MONEY.champions_sf }
          : { R16: CONTINENTAL_PRIZE_MONEY.shield_r16, QF: CONTINENTAL_PRIZE_MONEY.shield_qf, SF: CONTINENTAL_PRIZE_MONEY.shield_sf };
        if (round === 'F') {
          const winPrize = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_winner : CONTINENTAL_PRIZE_MONEY.shield_winner;
          const losePrize = isChampions ? CONTINENTAL_PRIZE_MONEY.champions_runner_up : CONTINENTAL_PRIZE_MONEY.shield_runner_up;
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
  const workingPlayers = { ...players };
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
      loanFromClubId: undefined, loanToClubId: undefined, lowMoraleWeeks: 0, wantsToLeave: false,
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

  // Prune orphaned players: remove players not in any club and not free agents
  const activePlayerIds = new Set<string>();
  for (const club of Object.values(newClubs)) {
    for (const pid of club.playerIds) activePlayerIds.add(pid);
  }
  for (const pid of freeAgentIds) activePlayerIds.add(pid);
  for (const pid of Object.keys(newPlayers)) {
    if (!activePlayerIds.has(pid)) {
      delete newPlayers[pid];
    }
  }

  const leagueClubIds = newDivisionClubs[newPlayerDivision] || [];
  const leagueInfo = LEAGUES.find(l => l.id === newPlayerDivision);
  const leagueTotalWeeks = leagueInfo?.totalWeeks || TOTAL_WEEKS;
  const newDivisionFixtures: Record<string, Match[]> = { [newPlayerDivision]: generateDivisionFixtures(leagueClubIds, leagueTotalWeeks) };
  const newDivisionTables: Record<string, LeagueTableEntry[]> = { [newPlayerDivision]: buildLeagueTable(newDivisionFixtures[newPlayerDivision], leagueClubIds) };
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

  let newChampionsCup: import('@/types/game').ContinentalTournamentState | null = null;
  let newShieldCup: import('@/types/game').ContinentalTournamentState | null = null;

  if (champQ.qualifiers.length >= 8) {
    newChampionsCup = generateContinentalDraw('champions_cup', newSeason, champQ.qualifiers, allVirtualClubs, playerClubId);
  }
  if (shieldQ.qualifiers.length >= 8) {
    newShieldCup = generateContinentalDraw('shield_cup', newSeason, shieldQ.qualifiers, allVirtualClubs, playerClubId);
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
    matchPhase: 'none' as const, pendingPressConference: null,
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
    youthAcademy: { prospects: newYouthProspects, nextIntakePreview: newIntakePreview },
    staff: { ...state.staff, availableHires: newAvailableHires },
    scouting: { ...state.scouting, assignments: [], reports: [], discoveredPlayers: [] },
    cup: newCup,
    leagueCup: newLeagueCup,
    championsCup: newChampionsCup,
    shieldCup: newShieldCup,
    virtualClubs: allVirtualClubs,
    continentalQualification: { champions: champQ.qualifiers, shield: shieldQ.qualifiers },
    domesticSuperCup: newDomesticSuperCup,
    continentalSuperCup: newContinentalSuperCup,
    currentContinentalMatchId: null,
    currentContinentalCompetition: null,
    currentLeagueCupTieId: null,
    clubRecords: updatedRecords,
    activeChallenge: endChallenge,
    activeStorylineChains: [],
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
    activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
    // Reset monthly objectives for new season
    weeklyObjectives: generateMonthlyObjectives(true),
    objectiveStreak: 0,
    objectivesStartWeek: 1,
    // Reset coach checklist so players re-do setup tasks each season
    completedCoachTaskIds: [],
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

  // Check if an international tournament should start this season
  const postState = get();
  const tournamentType = getTournamentForSeason(season);
  if (tournamentType && postState.managerNationality) {
    const tournament = generateTournament(tournamentType, season, postState.managerNationality);
    // Auto-select national squad
    const squad = autoSelectNationalSquad(postState.managerNationality, postState.players);
    const nt = postState.nationalTeam ? { ...postState.nationalTeam, squad } : null;

    // Apply morale boost to called-up players
    const boostedPlayers = { ...postState.players };
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
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_TITLE);
          if (cm.careerHistory.length > 0) {
            cm.careerHistory = cm.careerHistory.map(e =>
              e.endSeason === null ? { ...e, titlesWon: e.titlesWon + 1 } : e
            );
          }
        }

        // Cup win
        if (cs.cup.winner === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_CUP_WIN);
        }

        // League Cup win
        if (cs.leagueCup?.winner === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.leagueCupsWon = (cm.leagueCupsWon || 0) + 1;
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_LEAGUE_CUP_WIN);
        }

        // Champions Cup win / continental progress
        if (cs.championsCup?.winnerId === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.continentalCupsWon = (cm.continentalCupsWon || 0) + 1;
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_CHAMPIONS_CUP_WIN);
        } else if (cs.championsCup && !cs.championsCup.playerEliminated) {
          // Advanced past group stage
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_CONTINENTAL_GROUP);
          // Bonus per knockout round reached
          const knockoutRounds = ['R16', 'QF', 'SF', 'F'];
          const reached = knockoutRounds.indexOf(cs.championsCup.currentRound || '');
          if (reached >= 0) cm.reputationScore = Math.min(1000, cm.reputationScore + (reached + 1) * REP_CONTINENTAL_KNOCKOUT);
        }

        // Shield Cup win / continental progress
        if (cs.shieldCup?.winnerId === cs.playerClubId) {
          cm.cupsWon += 1;
          cm.continentalCupsWon = (cm.continentalCupsWon || 0) + 1;
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_SHIELD_CUP_WIN);
        } else if (cs.shieldCup && !cs.shieldCup.playerEliminated) {
          cm.reputationScore = Math.min(1000, cm.reputationScore + REP_CONTINENTAL_GROUP);
          const knockoutRounds = ['R16', 'QF', 'SF', 'F'];
          const reached = knockoutRounds.indexOf(cs.shieldCup.currentRound || '');
          if (reached >= 0) cm.reputationScore = Math.min(1000, cm.reputationScore + (reached + 1) * REP_CONTINENTAL_KNOCKOUT);
        }

        // Promotion/relegation reputation
        const leagueInfo = LEAGUES.find(l => l.id === cs.playerDivision);
        if (leagueInfo) {
          const teamCount = leagueInfo.teamCount;
          const replacedSlots = leagueInfo.replacedSlots;
          // Promotion: finished in top auto-promotion slots (position <= teamCount - replacedSlots is safe, but top 2-3 = promoted)
          if (replacedSlots > 0 && latestHistory.position <= Math.min(3, replacedSlots)) {
            cm.promotionsWon += 1;
            cm.reputationScore = Math.min(1000, cm.reputationScore + REP_PROMOTION);
          }
          // Relegation: finished in bottom replacedSlots
          if (replacedSlots > 0 && latestHistory.position > teamCount - replacedSlots) {
            cm.reputationScore = Math.max(0, cm.reputationScore + REP_RELEGATION);
          }
        }

        // Overachievement / underachievement
        const expectedPos = getExpectedPosition(cs.clubs[cs.playerClubId]?.reputation || 3);
        if (latestHistory.position < expectedPos) {
          cm.reputationScore = Math.min(1000, cm.reputationScore + (expectedPos - latestHistory.position) * REP_OVERACHIEVE_BONUS);
        } else if (latestHistory.position > expectedPos) {
          cm.reputationScore = Math.max(0, cm.reputationScore + (expectedPos - latestHistory.position) * Math.abs(REP_UNDERACHIEVE_PENALTY));
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
          cm.reputationScore = Math.min(1000, cm.reputationScore + 15);
        }
      }

      // Handle sacking in career mode
      if (latestHistory?.boardVerdict === 'sacked') {
        cm.sackedCount += 1;
        cm.reputationScore = Math.max(0, cm.reputationScore + REP_SACKING);
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

export const createOrchestrationSlice = (set: Set, get: Get) => ({
  initGame: (clubId: string) => {
    resetSeasonGrowth();
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

    // Generate initial free agent pool
    const initialFreeAgents = generateInitialFreeAgents(1);
    Object.assign(allPlayers, initialFreeAgents.players);
    const initialFreeAgentIds = initialFreeAgents.freeAgentIds;

    const initClub = clubs[clubId];
    const objectives = generateObjectives(initClub);

    const messages: Message[] = [
      { id: crypto.randomUUID(), week: 1, season: 1, type: 'board', title: 'Welcome, Manager!', body: `The board of ${initClub.name} welcomes you. We expect great things this season. Check your objectives in the Club tab.`, read: false },
      { id: crypto.randomUUID(), week: 1, season: 1, type: 'general', title: 'Transfer Window Open', body: 'The transfer window is now open. Scout the market and strengthen your squad before it closes in Week 8.', read: false },
    ];

    const pcInit = clubs[clubId];
    const initialStaff = generateInitialStaff(pcInit.reputation);
    const availableHires = generateStaffMarket();
    const youthCoachQuality = getStaffBonus(initialStaff, 'youth-coach');
    const { prospects: youthProspects, players: youthPlayers } = generateYouthProspects(
      clubId, pcInit.youthRating, youthCoachQuality, 1, 3 + Math.floor(Math.random() * 2), pcInit.squadQuality
    );
    youthPlayers.forEach(p => { allPlayers[p.id] = p; });
    const nextIntakePreview = generateIntakePreview(pcInit.youthRating);
    const scoutCount = initialStaff.filter(s => s.role === 'scout').length;

    // Generate cup draws
    const cup = generateCupDraw(leagueClubIds);
    const leagueCup = generateLeagueCupDraw(leagueClubIds);

    set({
      gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: TOTAL_WEEKS,
      gameMode: get().gameMode || 'sandbox',
      transferWindowOpen: true, clubs, players: allPlayers, fixtures, leagueTable,
      divisionFixtures, divisionTables, divisionClubs, playerDivision,
      lastSeasonTurnover: null, derbies: DERBIES,
      activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
      transferMarket, shortlist: [], scoutWatchList: [], freeAgents: initialFreeAgentIds, transferNews: [], boardObjectives: objectives, boardConfidence: STARTING_BOARD_CONFIDENCE,
      currentScreen: 'dashboard', previousScreen: null, currentMatchResult: null, trainingFocus: 'fitness',
      messages, seasonHistory: [], incomingOffers: [], matchSubsUsed: 0, matchPhase: 'none', currentCupTieId: null,
      settings: { matchSpeed: 'normal', showOverallOnPitch: true, autoSave: true, hapticsEnabled: true },
      tactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
      training: {
        schedule: { mon: 'fitness', tue: 'attacking', wed: 'defending', thu: 'mentality', fri: 'tactical' },
        intensity: 'medium', individualPlans: [], tacticalFamiliarity: STARTING_TACTICAL_FAMILIARITY,
      },
      staff: { members: initialStaff, availableHires },
      scouting: { maxAssignments: Math.max(1, scoutCount), assignments: [], reports: [], discoveredPlayers: [] },
      youthAcademy: { prospects: youthProspects, nextIntakePreview },
      facilities: {
        trainingLevel: pcInit.facilities, youthLevel: pcInit.youthRating,
        stadiumLevel: Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.fanBase / STADIUM_LEVEL_DIVISOR)),
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
      virtualClubs: {},
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
      sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
      weeklyDigest: null,
      pendingStoryline: null,
      activeStorylineChains: [],
      pendingFarewell: [],
      sponsorDeals: generateStarterDeals(pcInit.reputation, 1),
      sponsorOffers: [],
      sponsorSlotCooldowns: {},
      merchandise: getDefaultMerchState(),
      fanMood: 50,
      pendingPressConference: null,
      halfTimeState: null,
      preMatchLeaguePosition: 0,
      seasonPhase: 'regular',
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

  advanceWeek: () => {
    const state = get();

    // Career mode: unemployed managers skip gameplay, only process job market
    if (state.gameMode === 'career' && state.careerManager && !state.careerManager.contract) {
      const cm = { ...state.careerManager, attributes: { ...state.careerManager.attributes } };
      cm.unemployedWeeks = (cm.unemployedWeeks || 0) + 1;
      const newWeek = state.week + 1;

      // Forced retirement after extended unemployment
      if (cm.unemployedWeeks >= FORCED_RETIREMENT_UNEMPLOYED_WEEKS) {
        cm.careerHistory = cm.careerHistory.map(e =>
          e.endSeason === null ? { ...e, endSeason: state.season, reason: 'retired' as const } : e
        );
        cm.contract = null;
        set({ week: newWeek, careerManager: cm, currentScreen: 'hall-of-managers' });
        if (state.settings.autoSave) get().saveGame();
        return;
      }

      // Refresh job market on configured weeks
      let vacancies = state.jobVacancies;
      if (JOB_MARKET_REFRESH_WEEKS.includes(newWeek)) {
        vacancies = generateJobVacancies(state.clubs, cm.reputationScore, state.season, newWeek, state.playerClubId);
      }
      // Expire old vacancies
      vacancies = vacancies.filter(v => v.expiresSeason > state.season || (v.expiresSeason === state.season && v.expiresWeek > newWeek));

      // Desperation vacancies
      if (cm.unemployedWeeks >= 12 && vacancies.length === 0) {
        const desperate = Object.values(state.clubs).filter(c => c.id !== state.playerClubId).slice(0, 2);
        vacancies = desperate.map(club => ({
          id: `desperation-${club.id}-${state.season}-${newWeek}`,
          clubId: club.id, clubName: club.name, divisionId: club.divisionId || '',
          minReputation: 0, salary: 1500, contractLength: 1,
          boardExpectations: 'Survive and stabilize the club',
          expiresWeek: newWeek + 8, expiresSeason: state.season, applied: false,
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

    const fitnessCoachBonus = getStaffBonus(staff.members, 'fitness-coach');
    const firstTeamCoachBonus = getStaffBonus(staff.members, 'first-team-coach');
    const physioBonus = getStaffBonus(staff.members, 'physio');
    const assistantManagerBonus = getStaffBonus(staff.members, 'assistant-manager');

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
        p = applyWeeklyTraining(p, training, firstTeamCoachBonus + fitnessCoachBonus * 0.5, facilities.recoveryLevel, streakMult);
        // Physio reduces training injury risk, age-scaled injury risk
        const baseInjuryRisk = getInjuryRisk(training, p.age);
        const physioReduction = 1 - physioBonus * PHYSIO_INJURY_REDUCTION_PER_QUALITY;
        const perkReduction = hasPerk(state.managerProgression, 'fitness_guru') ? 0.8 : 1;
        // Congested fixtures: if player has both a league and cup match this week
        const hasCupThisWeek = state.cup.ties.some(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId));
        const hasLeagueThisWeek = state.fixtures.some(f => f.week === week && !f.played && (f.homeClubId === playerClubId || f.awayClubId === playerClubId));
        const congestionFactor = (hasCupThisWeek && hasLeagueThisWeek) ? CONGESTED_FIXTURE_INJURY_MULTIPLIER : 1;
        const injuryRisk = baseInjuryRisk * physioReduction * perkReduction * congestionFactor;
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
      const trainingPerkBoost = hasPerk(state.managerProgression, 'training_ground') ? TRAINING_GROUND_BOOST : 0;
      p = applyPlayerDevelopment(p, getDominantTrainingFocus(training.schedule), mentorBonusVal, trainingPerkBoost);
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
            week, season, type: 'general',
            title: `${p.lastName} Settled`,
            body: `${p.firstName} ${p.lastName} appears to have settled down and withdrawn the transfer request.`,
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

    // Simulate AI matches for player's division
    const weekMatches = fixtures.filter(m => m.week === week && !m.played);
    const updatedFixtures = [...fixtures];
    const aiMatches = weekMatches.filter(m => m.homeClubId !== playerClubId && m.awayClubId !== playerClubId);

    // Only one league — no other divisions to simulate
    const updatedDivisionFixtures = { ...state.divisionFixtures };
    const playerDiv = state.playerDivision;

    for (const m of aiMatches) {
      const idx = updatedFixtures.findIndex(f => f.id === m.id);
      const hc = clubs[m.homeClubId];
      const ac = clubs[m.awayClubId];
      if (!hc || !ac) continue;
      const hp = hc.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
      const ap = ac.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
      // Forfeit if either team has no available players
      if (hp.length === 0 || ap.length === 0) {
        const forfeit = { ...m, played: true, homeGoals: hp.length === 0 ? 0 : 3, awayGoals: ap.length === 0 ? 0 : 3, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
        updatedFixtures[idx] = forfeit;
        continue;
      }
      const { result } = simulateMatch(m, hc, ac, hp, ap, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season);
      updatedFixtures[idx] = result;
      applyAIMatchEvents(result.events, newPlayers, clubs, week);
    }

    // Simulate cup matches for this week
    let newCup = { ...state.cup, ties: [...state.cup.ties] };
    if (newCup.currentRound) {
      const cupWeekMatches = newCup.ties.filter(t => t.week === week && !t.played && t.round === newCup.currentRound);
      for (const tie of cupWeekMatches) {
        const tieIdx = newCup.ties.findIndex(t => t.id === tie.id);
        const hClub = clubs[tie.homeClubId];
        const aClub = clubs[tie.awayClubId];
        if (!hClub || !aClub) continue;
        const hPlayers = hClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
        const aPlayers = aClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);

        const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
        if (isPlayerMatch) continue; // Player's cup match is played interactively
        // Forfeit if either team has no available players
        if (hPlayers.length === 0 || aPlayers.length === 0) {
          const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
          newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : 3, awayGoals: aPlayers.length === 0 ? 0 : 3, winnerId };
          continue;
        }
        const { result: cupResult } = simulateMatch(
          { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season
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

        applyAIMatchEvents(cupResult.events, newPlayers, clubs, week);

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

    // ── League Cup Simulation ──
    let newLeagueCup = state.leagueCup ? { ...state.leagueCup, ties: [...state.leagueCup.ties] } : null;
    if (newLeagueCup && newLeagueCup.currentRound) {
      const lcWeekMatches = newLeagueCup.ties.filter(t => t.week === week && !t.played && t.round === newLeagueCup!.currentRound);
      for (const tie of lcWeekMatches) {
        const tieIdx = newLeagueCup.ties.findIndex(t => t.id === tie.id);
        const hClub = clubs[tie.homeClubId];
        const aClub = clubs[tie.awayClubId];
        if (!hClub || !aClub) continue;
        const hPlayers = hClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
        const aPlayers = aClub.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);

        const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
        if (isPlayerMatch) continue; // Player's league cup match is played interactively

        if (hPlayers.length === 0 || aPlayers.length === 0) {
          const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
          newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : 3, awayGoals: aPlayers.length === 0 ? 0 : 3, winnerId };
          continue;
        }
        const { result: lcResult } = simulateMatch(
          { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season
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
        applyAIMatchEvents(lcResult.events, newPlayers, clubs, week);
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
        const hPlayers = hClub.playerIds.map(id => newPlayers[id]).filter(Boolean).slice(0, 11);
        const aPlayers = aClub.playerIds.map(id => newPlayers[id]).filter(Boolean).slice(0, 11);
        if (hPlayers.length > 0 && aPlayers.length > 0) {
          const { result: scResult } = simulateMatch(
            { id: 'super-cup', week, homeClubId: newDomesticSuperCup.homeClubId, awayClubId: newDomesticSuperCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
            hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, 0, undefined, season
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
        const hPlayers = (hClub as Club).playerIds ? (hClub as Club).playerIds.map(id => newPlayers[id]).filter(Boolean).slice(0, 11) : [];
        const aPlayers = (aClub as Club).playerIds ? (aClub as Club).playerIds.map(id => newPlayers[id]).filter(Boolean).slice(0, 11) : [];
        if (hPlayers.length > 0 && aPlayers.length > 0) {
          const { result: scResult } = simulateMatch(
            { id: 'continental-super-cup', week, homeClubId: newContinentalSuperCup.homeClubId, awayClubId: newContinentalSuperCup.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
            hClub as Club, aClub as Club, hPlayers, aPlayers, undefined, undefined, undefined, undefined, 0, undefined, season
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
    }

    // Continental knockout rounds
    const allKnockoutWeeks = [...CONTINENTAL_R16_WEEKS, ...CONTINENTAL_QF_WEEKS, ...CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK];
    if (allKnockoutWeeks.includes(week)) {
      for (const [tourney, setTourney] of [[newChampionsCup, (t: typeof newChampionsCup) => { newChampionsCup = t; }], [newShieldCup, (t: typeof newShieldCup) => { newShieldCup = t; }]] as const) {
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
    // Build all division tables
    const divisionTables = buildAllDivisionTables(updatedDivisionFixtures, state.divisionClubs);

    // Transfer rumors — foreshadow potential incoming offers (batched into single message)
    if (transferWindowOpen) {
      const rumorNames: string[] = [];
      const starPlayers = Object.values(newPlayers).filter(p => p.clubId === playerClubId && !p.listedForSale && p.overall >= 70 && !p.onLoan);
      for (const sp of starPlayers) {
        if (Math.random() < RUMOR_CHANCE) {
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

    // Incoming offers — AI clubs only bid for positions they actually need
    const newOffers = [...state.incomingOffers];
    const listedPlayers = Object.values(newPlayers).filter(p => p.listedForSale && p.clubId === playerClubId);
    for (const lp of listedPlayers) {
      const isDeadlineDay = newWeek === SUMMER_WINDOW_END || newWeek === WINTER_WINDOW_END;
      const effectiveOfferChance = isDeadlineDay ? AI_OFFER_CHANCE * DEADLINE_DAY_OFFER_MULTIPLIER : AI_OFFER_CHANCE;
      if (Math.random() < effectiveOfferChance) {
        const buyerClubs = Object.values(clubs).filter(c => {
          if (c.id === playerClubId) return false;
          if (c.budget < lp.value * AI_OFFER_MIN_BUDGET_RATIO) return false;
          if (newOffers.some(o => o.buyerClubId === c.id && o.playerId === lp.id)) return false;
          // Squad need check: does this club need this position?
          const squadPositions = c.playerIds.map(id => newPlayers[id]?.position).filter(Boolean);
          const posCount = squadPositions.filter(pos => pos === lp.position).length;
          // Only interested if they have fewer than 2 players in this position
          return posCount < AI_OFFER_POSITION_THRESHOLD;
        });
        if (buyerClubs.length > 0) {
          const buyer = pick(buyerClubs);
          // Offer fee: factor in buyer urgency (fewer players at position = higher bid)
          const buyerSquad = buyer.playerIds.map(id => newPlayers[id]?.position).filter(Boolean);
          const posCount = buyerSquad.filter(pos => pos === lp.position).length;
          const urgencyMult = posCount === 0 ? URGENCY_NONE : posCount === 1 ? URGENCY_ONE : URGENCY_TWO_PLUS;
          const deadlinePremium = isDeadlineDay ? 1 + DEADLINE_DAY_BID_PREMIUM : 1;
          const baseFee = lp.value * (OFFER_FEE_BASE + Math.random() * OFFER_FEE_RANDOM_RANGE) * urgencyMult * deadlinePremium;
          const offerFee = Math.round(baseFee);
          if (buyer.budget >= offerFee && offerFee <= buyer.budget * OFFER_MAX_BUDGET_RATIO) {
            const offer: IncomingOffer = { id: crypto.randomUUID(), playerId: lp.id, buyerClubId: buyer.id, fee: offerFee, week: newWeek };
            newOffers.push(offer);
            newMessages = addMsg(newMessages, {
              week: newWeek, season, type: 'transfer',
              title: `Bid for ${lp.lastName}`,
              body: `${buyer.name} have made a £${(offerFee / 1e6).toFixed(1)}M offer for ${lp.firstName} ${lp.lastName}.`,
            });
          }
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
    const updatedChains: ActiveStorylineChain[] = (state.activeStorylineChains || []).reduce<ActiveStorylineChain[]>((kept, chain) => {
      const chainDef = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
      if (!chainDef) return kept; // Remove chains with no definition

      const nextStepIdx = chain.currentStep + 1;
      if (nextStepIdx >= chainDef.steps.length) return kept; // Chain complete — remove

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
          pendingStorylineEvent = {
            id: `chain-${chain.chainId}-step-${nextStepIdx}`,
            title: nextStep.title,
            body: nextStep.body,
            icon: nextStep.icon,
            options: nextStep.options,
          };
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
      const completedChainIds = new Set<string>(); // could track in state later
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
          const firstStep = chainDef.steps[0];
          if (!pendingStorylineEvent) {
            pendingStorylineEvent = {
              id: `chain-${chainDef.id}-step-0`,
              title: firstStep.title,
              body: firstStep.body,
              icon: firstStep.icon,
              options: firstStep.options,
            };
          }
          updatedChains.push({
            chainId: chainDef.id,
            startWeek: newWeek,
            currentStep: 0,
            choices: [],
          });
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
    if (newWeek === SUMMER_WINDOW_END) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Window Closing', body: 'The transfer window closes this week. Make your final moves!' });
    if (newWeek === WINTER_WINDOW_START) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'January Window Opens', body: 'The winter transfer window is now open until Week 24.' });
    if (newWeek === WINTER_WINDOW_END - 1) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'Winter Deadline Approaching', body: 'The winter transfer window closes next week. Last chance for January deals!' });
    if (newWeek === WINTER_WINDOW_END) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Winter Window Closed', body: 'The January transfer window has closed. No more transfers until next season.' });

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
        const key = `${upgrade.type}Level` as keyof Pick<FacilitiesState, 'trainingLevel' | 'youthLevel' | 'stadiumLevel' | 'medicalLevel' | 'recoveryLevel'>;
        newFacilities = { ...newFacilities, [key]: (newFacilities[key] as number) + 1, upgradeInProgress: null };
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: `Upgrade Complete`, body: `Your ${upgrade.type} facility has been upgraded to level ${(newFacilities[key] as number)}!` });
      } else {
        newFacilities.upgradeInProgress = upgrade;
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
          const devGain = hasPerk(state.managerProgression, 'youth_developer') ? baseDevGain * (1 + YOUTH_DEVELOPER_BOOST + careerYouthMod) : baseDevGain * (1 + careerYouthMod);
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
    const fanFavMult = hasPerk(state.managerProgression, 'fan_favourite') ? 1.15 : 1;
    const stadiumIncome = Math.round(newFacilities.stadiumLevel * STADIUM_INCOME_PER_LEVEL * fanFavMult);
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
    const totalExpenses = playerClub.wageBill + staffWages + scoutingCosts;
    newClubs[playerClubId] = { ...playerClub, budget: playerClub.budget + weeklyIncome - totalExpenses };

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
    const merchFanMood = Math.max(0, Math.min(100, state.fanMood + pricingMoodDelta));

    // Process sponsorship system (offers, satisfaction, new deals)
    const sponsorUpdates = processSponsorWeek({ ...state, week: newWeek, clubs: newClubs, messages: newMessages, currentMatchResult: thisWeekMatch ? state.currentMatchResult : null });
    if (sponsorUpdates.messages) newMessages = sponsorUpdates.messages;

    // Evaluate board objectives based on current league position
    const playerPos = playerTableIdx >= 0 ? playerTableIdx + 1 : 20;
    const updatedObjectives = state.boardObjectives.map(obj => {
      const o = { ...obj };
      if (obj.description === 'Win the League') o.completed = playerPos === 1;
      else if (obj.description === 'Finish in Top 3') o.completed = playerPos <= 3;
      else if (obj.description === 'Finish in Top 6') o.completed = playerPos <= 6;
      else if (obj.description === 'Reach Top Half' || obj.description === 'Finish in Top Half') o.completed = playerPos <= 10;
      else if (obj.description.startsWith('Avoid Replacement')) {
        const posMatch = obj.description.match(/Top (\d+)/);
        const safePos = posMatch ? parseInt(posMatch[1]) : 17;
        o.completed = playerPos <= safePos;
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
          const devChance = LOAN_DEV_BASE_CHANCE + (loanClub.reputation * LOAN_DEV_REP_FACTOR); // better clubs = slightly better development
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
      const diff = expectedPos - actualPos;
      if (diff >= 3) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Board Review: Impressive', body: `The board acknowledges your excellent work. Finishing ${actualPos}${getSuffix(actualPos)} exceeds expectations. Keep it up!` });
      } else if (diff >= 0) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Board Review: On Track', body: `The board is satisfied with progress. Current position of ${actualPos}${getSuffix(actualPos)} meets expectations.` });
      } else if (diff >= -3) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Board Review: Concerns', body: `The board notes the team is underperforming. A position of ${actualPos}${getSuffix(actualPos)} is below expectations. Improvement is needed.` });
      } else {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Board Review: Serious Concerns', body: `The board is deeply unhappy. Current position of ${actualPos}${getSuffix(actualPos)} is well below the expected ${expectedPos}${getSuffix(expectedPos)}. Results must improve immediately.` });
      }
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

    set({
      week: newWeek, fixtures: updatedFixtures, players: newPlayers,
      leagueTable, transferWindowOpen, currentMatchResult: null,
      matchPhase: 'none' as const, pendingPressConference: null,
      messages: newMessages, incomingOffers: newOffers, clubs: newClubs,
      matchSubsUsed: 0, boardConfidence: newBoardConfidence, boardObjectives: updatedObjectives,
      training: { ...training, tacticalFamiliarity: newTacticalFamiliarity, streaks: newStreaks, lastReport: trainingReport },
      scouting: newScouting, facilities: newFacilities, youthAcademy: newYouthAcademy,
      pendingGemReveal: gemReveals.length > 0 ? gemReveals[0] : null,
      financeHistory: newFinanceHistory,
      unlockedAchievements: allUnlocked,
      pendingAchievementIds: newAchievements,
      cup: newCup,
      leagueCup: newLeagueCup || state.leagueCup,
      championsCup: newChampionsCup,
      shieldCup: newShieldCup,
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
      ...(sponsorUpdates.sponsorDeals ? { sponsorDeals: sponsorUpdates.sponsorDeals } : {}),
      ...(sponsorUpdates.sponsorOffers ? { sponsorOffers: sponsorUpdates.sponsorOffers } : {}),
      ...(sponsorUpdates.sponsorSlotCooldowns ? { sponsorSlotCooldowns: sponsorUpdates.sponsorSlotCooldowns } : {}),
      merchandise: newMerch,
      fanMood: merchFanMood,
      seasonGrowthTracker: { ...seasonGrowthTracker },
      weeklyDigest: {
        incomeEarned: weeklyIncome,
        expensesPaid: totalExpenses,
        injuriesThisWeek: digestInjuries,
        recoveriesThisWeek: digestRecoveries,
        offersReceived: Math.max(0, digestOffersReceived),
        moraleChange: newAvgMorale - prevMorale,
      },
    });

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
          if (p && !p.listedForSale && !p.wantsToLeave && !p.onLoan && wantsTransfer(p, trClub.reputation)) {
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
        transferMarket: aiResult.transferMarket,
        freeAgents: aiResult.freeAgents,
        activeLoans: aiResult.activeLoans,
        transferNews: aiResult.transferNews,
      });
    }

    // Transfer market maintenance: replenish thin market, expire stale listings, spawn free agents
    {
      const mktState = get();

      // Process listing expiry for external players (reduces stale listings)
      const expiryResult = processListingExpiry(mktState.transferMarket, newWeek, season, TOTAL_WEEKS, LISTING_EXPIRY_WEEKS, LISTING_RELIST_CHANCE, LISTING_RELIST_DISCOUNT);
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

      if (updatedMarket.length < MARKET_REPLENISH_THRESHOLD) {
        const fresh = replenishMarket(season, newWeek);
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
          updatedVacancies = generateJobVacancies(careerState.clubs, cm.reputationScore, season, newWeek, playerClubId);
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
              cm.reputationScore = Math.min(1000, cm.reputationScore + 5);
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
          const tierLabels = { unknown: 'Unknown', regional: 'Regional', national: 'National', continental: 'Continental', world_class: 'World Class', legendary: 'Legendary' };
          careerMessages = addMsg(careerMessages, {
            week: newWeek, season, type: 'general',
            title: 'Reputation Changed!',
            body: `Your reputation has ${cm.reputationScore > (careerState.careerManager?.reputationScore || 0) ? 'grown' : 'declined'} to ${tierLabels[cm.reputationTier]}.`,
          });
        }

        set({ careerManager: cm, messages: careerMessages });
      }
    }

    // Auto-save after advancing week
    if (get().settings.autoSave) get().saveGame();
  },

  playCurrentMatch: () => {
    const state = get();
    // Career mode: block match play when unemployed
    if (state.gameMode === 'career' && !state.careerManager?.contract) return null;
    const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;
    const match = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    if (!match) return null;

    const hc = clubs[match.homeClubId];
    const ac = clubs[match.awayClubId];
    if (!hc || !ac) return null;
    const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
    const backfillFromSubs = (lineup: Player[], club: typeof hc) => {
      const availableSubs = (club.subs || []).map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p) && !p.injured);
      const ids = new Set(lineup.map(p => p.id));
      for (const sub of availableSubs) {
        if (lineup.length >= 11) break;
        if (!ids.has(sub.id)) { lineup.push(sub); ids.add(sub.id); }
      }
      return lineup;
    };
    let hp = backfillFromSubs((hc.lineup || []).map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p)), hc);
    let ap = backfillFromSubs((ac.lineup || []).map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p)), ac);

    // Need minimum players to simulate a match
    if (hp.length < 7 || ap.length < 7) return null;

    // Motivator perk: boost player team morale before match
    if (hasPerk(state.managerProgression, 'motivator')) {
      const boostPlayers = (ps: typeof hp, clubId: string) =>
        clubId === playerClubId ? ps.map(p => ({ ...p, morale: Math.min(100, p.morale + MOTIVATOR_MORALE_BOOST) })) : ps;
      hp = boostPlayers(hp, match.homeClubId);
      ap = boostPlayers(ap, match.awayClubId);
    }

    const isPlayerHome = match.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;
    // Store pre-match league position
    const preEntry = state.leagueTable.find(e => e.clubId === playerClubId);
    const prePos = preEntry ? state.leagueTable.indexOf(preEntry) + 1 : 10;

    try {
    const matchDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
    const careerDisciplineMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const { result, playerRatings, matchInjuries } = simulateMatch(match, hc, ac, hp, ap, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, matchDerbyIntensity, hasDisciplinarian, season, careerDisciplineMod);

    const processed = processMatchResult(state, match, result, playerRatings, () => get().week, matchInjuries);

    // Simulate AI matches for the same week so league table position is accurate in PostMatchPopup
    const aiWeekMatches = processed.updatedFixtures.filter(
      m => m.week === week && !m.played && m.homeClubId !== playerClubId && m.awayClubId !== playerClubId
    );
    const fullFixtures = [...processed.updatedFixtures];
    const playersWithAI = { ...processed.newPlayers };
    for (const m of aiWeekMatches) {
      const idx = fullFixtures.findIndex(f => f.id === m.id);
      const hc2 = clubs[m.homeClubId];
      const ac2 = clubs[m.awayClubId];
      if (!hc2 || !ac2) continue;
      const hp2 = hc2.playerIds.map(id => playersWithAI[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
      const ap2 = ac2.playerIds.map(id => playersWithAI[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
      if (hp2.length === 0 || ap2.length === 0) {
        fullFixtures[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : 3, awayGoals: ap2.length === 0 ? 0 : 3, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
        continue;
      }
      const { result: aiResult } = simulateMatch(m, hc2, ac2, hp2, ap2, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season);
      fullFixtures[idx] = aiResult;
      applyAIMatchEvents(aiResult.events, playersWithAI, clubs, week);
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
      sessionStats,
    });

    // Career mode: update reputation after match
    {
      const postMatch = get();
      if (postMatch.gameMode === 'career' && postMatch.careerManager) {
        const cm = { ...postMatch.careerManager };
        const repDelta = processed.won ? REP_WIN : processed.lost ? REP_LOSS : REP_DRAW;
        cm.reputationScore = Math.max(0, Math.min(1000, cm.reputationScore + repDelta));

        cm.reputationTier = calculateReputationTier(cm.reputationScore);
        set({ careerManager: cm });
      }
    }

    // Auto-save after match completes
    if (get().settings.autoSave) get().saveGame();

    return result;
    } catch (err) {
      console.error('[playCurrentMatch] Match simulation failed:', err);
      set({ matchPhase: 'none' as const });
      return null;
    }
  },

  playFirstHalf: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;
    const leagueMatch = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));

    // Check for cup tie if no league match
    const cupTie = !leagueMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;

    // Check continental matches
    const champMatch = !leagueMatch && !cupTie ? findPlayerContinentalMatch(state.championsCup, week, playerClubId) : null;
    const shieldMatch = !leagueMatch && !cupTie && !champMatch ? findPlayerContinentalMatch(state.shieldCup, week, playerClubId) : null;
    const continentalMatch = champMatch || shieldMatch;
    const continentalComp = champMatch ? 'champions_cup' as const : shieldMatch ? 'shield_cup' as const : null;
    const continentalTourney = champMatch ? state.championsCup : shieldMatch ? state.shieldCup : null;

    // Check league cup
    const leagueCupTie = !leagueMatch && !cupTie && !continentalMatch ? state.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;

    // Check super cups
    const superCup = !leagueMatch && !cupTie && !continentalMatch && !leagueCupTie
      ? (state.domesticSuperCup && !state.domesticSuperCup.played && state.domesticSuperCup.week === week && (state.domesticSuperCup.homeClubId === playerClubId || state.domesticSuperCup.awayClubId === playerClubId) ? state.domesticSuperCup : null)
        || (state.continentalSuperCup && !state.continentalSuperCup.played && state.continentalSuperCup.week === week && (state.continentalSuperCup.homeClubId === playerClubId || state.continentalSuperCup.awayClubId === playerClubId) ? state.continentalSuperCup : null)
      : null;

    // Build match object from the detected source
    let match: Match | null = null;
    let ephemeralClub: { club: Club; players: Record<string, Player> } | null = null;
    let effectiveClubs = clubs;
    let effectivePlayers = players;

    if (leagueMatch) {
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
        clubId === playerClubId ? ps.map(p => ({ ...p, morale: Math.min(100, p.morale + MOTIVATOR_MORALE_BOOST) })) : ps;
      hp = boostPlayers(hp, match.homeClubId);
      ap = boostPlayers(ap, match.awayClubId);
    }

    const isPlayerHome = match.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;

    // Store pre-match league position for post-match popup
    const preMatchEntry = state.leagueTable.find(e => e.clubId === playerClubId);
    const preMatchPos = preMatchEntry ? state.leagueTable.indexOf(preMatchEntry) + 1 : 10;

    const halfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
    const halfCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const halfState = simulateHalf(hc, ac, hp, ap, 1, 45, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, undefined, halfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, halfCareerMod);

    // Determine which cup tracking IDs to set
    const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCup;
    const matchCompetition = cupTie ? `Dynasty Cup — ${cupTie.round}`
      : leagueCupTie ? `League Cup — ${leagueCupTie.round}`
      : champMatch && continentalTourney ? getContinentalMatchLabel('Champions Cup', champMatch, continentalTourney)
      : shieldMatch && continentalTourney ? getContinentalMatchLabel('Shield Cup', shieldMatch, continentalTourney)
      : superCup ? (superCup.type === 'domestic' ? 'Super Cup' : 'Continental Super Cup')
      : null;
    set({
      halfTimeState: halfState, matchPhase: 'half_time', matchSubsUsed: 0, preMatchLeaguePosition: preMatchPos,
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
    const { week, fixtures, clubs, players, playerClubId, tactics, training, halfTimeState, season } = state;
    if (!halfTimeState) return null;

    try {
    // Find league match or cup/tournament match
    const leagueMatch = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const isRealCupTie = state.currentCupTieId && state.currentCupTieId !== '__tournament__';
    const cupTie = isRealCupTie ? state.cup.ties.find(t => t.id === state.currentCupTieId) : null;
    const isTournamentMatch = state.currentCupTieId === '__tournament__';

    // Reconstruct tournament match
    let tournamentMatch: Match | null = null;
    if (isTournamentMatch) {
      if (state.currentContinentalMatchId && state.currentContinentalCompetition) {
        const tourney = state.currentContinentalCompetition === 'champions_cup' ? state.championsCup : state.shieldCup;
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

    const match = leagueMatch || (cupTie ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null) || tournamentMatch;
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
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;

    // Simulate second half, carrying forward first half state
    const secondHalfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
    const secondHalfCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const fullState = simulateHalf(hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, secondHalfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, secondHalfCareerMod);
    const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, fullState);

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
    for (const m of aiWeekMatches2) {
      const idx = fullFixtures2.findIndex(f => f.id === m.id);
      const hc2 = clubs[m.homeClubId];
      const ac2 = clubs[m.awayClubId];
      if (!hc2 || !ac2) continue;
      const hp2 = hc2.playerIds.map(id => playersWithAI2[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
      const ap2 = ac2.playerIds.map(id => playersWithAI2[id]).filter(Boolean).filter(p => !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week)).slice(0, 11);
      if (hp2.length === 0 || ap2.length === 0) {
        fullFixtures2[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : 3, awayGoals: ap2.length === 0 ? 0 : 3, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
        continue;
      }
      const { result: aiResult } = simulateMatch(m, hc2, ac2, hp2, ap2, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season);
      fullFixtures2[idx] = aiResult;
      applyAIMatchEvents(aiResult.events, playersWithAI2, clubs, week);
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
    });
    return result;
    } catch (err) {
      console.error('[playSecondHalf] Match simulation failed:', err);
      // Clear half-time state so the match can be cleaned up
      set({ halfTimeState: null, matchPhase: 'none' as const });
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
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;
    const derbyInt = getDerbyIntensity(currentMatchResult.homeClubId, currentMatchResult.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');

    // Simulate extra time as one 30-minute block (91-120)
    const etCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const etState = simulateHalf(hc, ac, hp, ap, 91, 120, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, derbyInt, hasDisciplinarian, hc.facilities, ac.facilities, season, etCareerMod);

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
        const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
        if (allPlayed) {
          if (newCup.currentRound === 'F') {
            const finalTie = newCup.ties.find(t => t.round === 'F' && t.played);
            if (finalTie) { newCup.winner = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId; newCup.currentRound = null; }
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
    const { clubs, players, playerClubId, currentMatchResult, halfTimeState, currentCupTieId } = state;
    if (!currentMatchResult || !currentCupTieId) return null;

    const hc = clubs[currentMatchResult.homeClubId];
    const ac = clubs[currentMatchResult.awayClubId];
    if (!hc || !ac) return null;
    const hp = (hc.lineup || []).map(id => players[id]).filter(Boolean);
    const ap = (ac.lineup || []).map(id => players[id]).filter(Boolean);

    // Penalty shootout
    const homeGK = hp.find(p => p.position === 'GK');
    const awayGK = ap.find(p => p.position === 'GK');
    const homeGKQuality = homeGK ? (homeGK.attributes.defending + homeGK.attributes.mental) / 200 : 0.5;
    const awayGKQuality = awayGK ? (awayGK.attributes.defending + awayGK.attributes.mental) / 200 : 0.5;

    let penHome = 0, penAway = 0;
    const penEvents: MatchEvent[] = [];
    for (let i = 0; i < CUP_PENALTY_KICKS; i++) {
      const hScores = Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (hScores) penHome++;
      penEvents.push({ minute: 121 + i, type: 'penalty_shootout' as const, clubId: hc.id, description: hScores ? `${hc.shortName} SCORE! (${penHome}-${penAway})` : `${hc.shortName} miss! (${penHome}-${penAway})` });

      const aScores = Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (aScores) penAway++;
      penEvents.push({ minute: 121 + i, type: 'penalty_shootout' as const, clubId: ac.id, description: aScores ? `${ac.shortName} SCORE! (${penHome}-${penAway})` : `${ac.shortName} miss! (${penHome}-${penAway})` });
    }
    // Sudden death
    while (penHome === penAway) {
      const hScores = Math.random() > awayGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (hScores) penHome++;
      penEvents.push({ minute: 130, type: 'penalty_shootout' as const, clubId: hc.id, description: hScores ? `${hc.shortName} SCORE! (${penHome}-${penAway})` : `${hc.shortName} miss! (${penHome}-${penAway})` });

      const aScores = Math.random() > homeGKQuality * CUP_PENALTY_GK_QUALITY_FACTOR + (1 - PENALTY_CONVERSION_RATE);
      if (aScores) penAway++;
      penEvents.push({ minute: 130, type: 'penalty_shootout' as const, clubId: ac.id, description: aScores ? `${ac.shortName} SCORE! (${penHome}-${penAway})` : `${ac.shortName} miss! (${penHome}-${penAway})` });

      if (hScores !== aScores) break;
    }

    const winnerId = penHome > penAway ? hc.id : ac.id;
    const penaltyShootout = { home: penHome, away: penAway };

    // Build final result
    const finalResult: Match = {
      ...currentMatchResult,
      events: [...currentMatchResult.events, ...penEvents],
      penaltyShootout,
    };

    // Finalize with extra events
    const { result, playerRatings } = finalizeMatch(finalResult, hc, ac, hp, ap, halfTimeState || { events: [], homeGoals: 0, awayGoals: 0, homeShots: 0, awayShots: 0, homeSoT: 0, awaySoT: 0, homeFouls: 0, awayFouls: 0, homeCorners: 0, awayCorners: 0, sentOff: [], injured: [], playerEvents: {}, momentum: 0, homeXG: 0, awayXG: 0, matchInjuries: {} });

    const processed = processMatchResult(state, finalResult, result, playerRatings, () => get().week, halfTimeState?.matchInjuries || {});
    const penDrama = detectMatchDrama(result, playerClubId, clubs);
    const press = winnerId === playerClubId ? 'post_win' : 'post_loss';

    const isTournament = currentCupTieId === '__tournament__';
    if (isTournament) {
      // Tournament penalty: goals are drawn, use explicit winnerId via processTournamentResultWithWinner
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
        ...tournamentUpdates.stateUpdates,
      });
    } else {
      // Domestic Dynasty Cup
      const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
        t.id === currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, penaltyShootout } : t
      )};
      if (winnerId !== playerClubId) newCup.eliminated = true;
      const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
      if (allPlayed) {
        if (newCup.currentRound === 'F') {
          newCup.winner = winnerId; newCup.currentRound = null;
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
      });
    }
    return { ...result, penaltyShootout };
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
      preMatchLeaguePosition: state.preMatchLeaguePosition,
      lastMatchXPGain: state.lastMatchXPGain,
      weeklyDigest: state.weeklyDigest,
      sponsorDeals: state.sponsorDeals,
      sponsorOffers: state.sponsorOffers,
      sponsorSlotCooldowns: state.sponsorSlotCooldowns,
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
      // Cups & Continental
      leagueCup: state.leagueCup,
      championsCup: state.championsCup,
      shieldCup: state.shieldCup,
      virtualClubs: state.virtualClubs,
      continentalQualification: state.continentalQualification,
      domesticSuperCup: state.domesticSuperCup,
      continentalSuperCup: state.continentalSuperCup,
      currentLeagueCupTieId: state.currentLeagueCupTieId,
      currentContinentalMatchId: state.currentContinentalMatchId,
      currentContinentalCompetition: state.currentContinentalCompetition,
      // Career Mode
      gameMode: state.gameMode,
      careerManager: state.careerManager,
      jobVacancies: state.jobVacancies,
      jobOffers: state.jobOffers,
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
        console.error('[Save] Failed to write save data:', err);
        lastSaveErrorLogAt = errTime;
      }
      // Notify user once per week to keep the inbox readable.
      const hasSaveWarningThisWeek = state.messages.some(
        m => m.title === 'Save Failed' && m.week === state.week && m.season === state.season,
      );
      if (!hasSaveWarningThisWeek) {
        const msgs = addMsg(state.messages, {
          id: `save-fail-${Date.now()}`,
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
    migrateLegacySave();
    const s = slot ?? get().activeSlot;
    let raw = readSaveSlot(s);
    if (!raw) return false;

    // Try to parse primary save; if corrupted, fall back to backup
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[Load] Primary save corrupted, trying backup...');
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
        console.error('[LoadGame] Save migration failed — save data may be corrupt');
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
        currentScreen: 'dashboard', previousScreen: null,
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
        leagueCup: data.leagueCup || { ties: [], currentRound: null, eliminated: false, winner: null },
        championsCup: data.championsCup || null,
        shieldCup: data.shieldCup || null,
        virtualClubs: data.virtualClubs || {},
        continentalQualification: data.continentalQualification || null,
        domesticSuperCup: data.domesticSuperCup || null,
        continentalSuperCup: data.continentalSuperCup || null,
        currentContinentalMatchId: data.currentContinentalMatchId || null,
        currentContinentalCompetition: data.currentContinentalCompetition || null,
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
        preMatchLeaguePosition: data.preMatchLeaguePosition ?? 10,
        lastMatchXPGain: data.lastMatchXPGain ?? 0,
        scoutWatchList: data.scoutWatchList || [],
        freeAgents: data.freeAgents || [],
        transferNews: data.transferNews || [],
        sponsorDeals: data.sponsorDeals || [],
        sponsorOffers: data.sponsorOffers || [],
        sponsorSlotCooldowns: data.sponsorSlotCooldowns || {},
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
        halfTimeState: null, matchPhase: 'none' as const,
        currentCupTieId: null, currentLeagueCupTieId: null,
        currentContinentalMatchId: null, currentContinentalCompetition: null,
        matchSubsUsed: 0,
      });
    } else {
      // No virtual clubs to clean — just reset match tracking state
      set({
        halfTimeState: null, matchPhase: 'none' as const,
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
      matchPlayerRatings: [], halfTimeState: null, matchPhase: 'none' as const,
      currentMatchResult: null, matchSubsUsed: 0, currentCupTieId: null,
      transferMarket: [], shortlist: [], scoutWatchList: [], transferNews: [],
      activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
      cup: { ties: [], currentRound: null, eliminated: false, winner: null },
      pendingPressConference: null, activeNegotiation: null,
      pendingFarewell: [], pendingStoryline: null,
      activeStorylineChains: [], weeklyObjectives: [],
      objectiveStreak: 0, objectivesStartWeek: 1, completedCoachTaskIds: [],
      weekCliffhangers: [], rivalries: {}, lastMatchDrama: null, lastMatchCompetition: null,
      sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
      weeklyDigest: null, careerTimeline: [],
      gameMode: 'sandbox', careerManager: null, jobVacancies: [], jobOffers: [],
      sponsorDeals: [], sponsorOffers: [], sponsorSlotCooldowns: {},
      merchandise: getDefaultMerchState(),
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
