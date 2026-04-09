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
import { initGameImpl, generateObjectives, generateLeagueCupDraw } from '@/store/helpers/gameInit';
import { endSeasonImpl } from '@/store/helpers/seasonEnd';
import { advanceWeekImpl } from '@/store/helpers/weekAdvancement';

export type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
export type Get = () => GameState;
let lastSaveErrorLogAt = 0;
let lastSaveAt = 0;
const SAVE_DEBOUNCE_MS = 2000; // Minimum 2s between auto-saves

// migrateLegacySave and getSlotSummaries extracted to @/store/helpers/persistence
export { getSlotSummaries } from '@/store/helpers/persistence';



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

// generateObjectives() moved to @/store/helpers/gameInit — imported above


/** International break week implementation */
export function advanceInternationalWeekImpl(set: Set, get: Get) {
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
    if (playerTie && !playerTie.played) {
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
    let sacked = false;
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
          sacked = true;
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

    set({
      messages: newMessages,
      seasonPhase: 'regular',
      internationalTournament: null,
      ...(updatedCareerManager && { careerManager: updatedCareerManager }),
      ...(clearNationalTeam && { nationalTeam: null }),
    });
    endSeasonImpl(set, get);
  }
}

// generateLeagueCupDraw() moved to @/store/helpers/gameInit — imported above

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

export function advanceLeagueCupRound(cup: import('@/types/game').LeagueCupState): import('@/types/game').LeagueCupState {
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

/** endSeason implementation — extracted to @/store/helpers/seasonEnd */
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
  initGame: (clubId: string) => initGameImpl(set, get, clubId),

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

  advanceWeek: () => advanceWeekImpl(set, get),


  advanceToNextMatch: () => {
    const hasMatchThisWeek = (s: GameState): boolean => {
      const { week: w, fixtures, playerClubId: pcId, cup, leagueCup, domesticSuperCup, continentalSuperCup } = s;
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

    // ── Detect match type: league → cup → continental → league cup → super cup ──
    const leagueMatch = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const cupTie = !leagueMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
    const champMatch = !leagueMatch && !cupTie ? findPlayerContinentalMatch(state.championsCup, week, playerClubId) : null;
    const shieldMatch = !leagueMatch && !cupTie && !champMatch ? findPlayerContinentalMatch(state.shieldCup, week, playerClubId) : null;
    const continentalMatch = champMatch || shieldMatch;
    const continentalComp = champMatch ? 'champions_cup' as const : shieldMatch ? 'shield_cup' as const : null;
    const continentalTourney = champMatch ? state.championsCup : shieldMatch ? state.shieldCup : null;
    const leagueCupTie = !leagueMatch && !cupTie && !continentalMatch ? state.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
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
    const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCup;
    const matchCompetition = cupTie ? `Dynasty Cup — ${cupTie.round}`
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
    // Build bench for both teams
    const hpIdSet = new Set(hp.map(p => p.id));
    const apIdSet = new Set(ap.map(p => p.id));
    const hBenchCM = (hc.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !hpIdSet.has(p.id) && !p.injured && !isSuspended(p));
    const aBenchCM = (ac.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !apIdSet.has(p.id) && !p.injured && !isSuspended(p));
    const { result, playerRatings, matchInjuries } = simulateMatch(match, hc, ac, hp, ap, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, matchDerbyIntensity, hasDisciplinarian, season, careerDisciplineMod, hBenchCM, aBenchCM);

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

    // ── League match path ──
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
        cm.reputationScore = Math.max(REP_MIN, Math.min(REP_MAX, cm.reputationScore + repDelta));

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

    // Build bench arrays for AI substitution logic
    const hpIds = new Set(hp.map(p => p.id));
    const apIds = new Set(ap.map(p => p.id));
    const hBench = (hc.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !hpIds.has(p.id) && !p.injured && !isSuspended(p));
    const aBench = (ac.subs || []).map(id => effectivePlayers[id]).filter(Boolean).filter(p => !apIds.has(p.id) && !p.injured && !isSuspended(p));

    const halfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
    const halfCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const halfState = simulateHalf(hc, ac, hp, ap, 1, 45, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, undefined, halfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, halfCareerMod, hBench, aBench);

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

    const fullState = simulateHalf(hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, secondHalfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, secondHalfCareerMod, undefined, undefined, combinedMods);
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
    const etState = simulateHalf(hc, ac, hp, ap, 91, 120, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, derbyInt, hasDisciplinarian, hc.facilities, ac.facilities, season, etCareerMod, undefined, undefined, etMods);

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

    // Finalize with extra events
    const { result, playerRatings } = finalizeMatch(finalResult, hc, ac, hp, ap, halfTimeState || { events: [], homeGoals: 0, awayGoals: 0, homeShots: 0, awayShots: 0, homeSoT: 0, awaySoT: 0, homeFouls: 0, awayFouls: 0, homeCorners: 0, awayCorners: 0, sentOff: [], injured: [], playerEvents: {}, momentum: 0, homeXG: 0, awayXG: 0, matchInjuries: {}, homeSubsUsed: 0, awaySubsUsed: 0, homeBench: [], awayBench: [], homeSubbedIn: [], awaySubbedIn: [] });

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
      virtualClubs: state.virtualClubs,
      continentalQualification: state.continentalQualification,
      continentalCoefficients: state.continentalCoefficients,
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
        continentalCoefficients: data.continentalCoefficients || {},
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
        completedStorylineChainIds: data.completedStorylineChainIds || [],
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
      activeStorylineChains: [], completedStorylineChainIds: [], weeklyObjectives: [],
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
