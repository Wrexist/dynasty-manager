/**
 * Week Advancement Logic — extracted from orchestrationSlice.ts
 * Handles weekly game loop: training, injuries, finances, transfers, matches, etc.
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

// Shared helpers from other extracted files
import { generateObjectives, generateLeagueCupDraw } from '@/store/helpers/gameInit';
import { advanceInternationalWeekImpl, applyAIMatchEvents, generateAIInjuryDetails, advanceLeagueCupRound } from '@/store/slices/orchestrationSlice';
import { updateEloRatings } from '@/utils/teamRankings';

export function advanceWeekImpl(set: Set, get: Get) {
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
        const baseInjuryRisk = getInjuryRisk(training, p.age);
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
      const trainingPerkBoost = hasPerk(state.managerProgression, 'training_ground') ? TRAINING_GROUND_BOOST : 0;
      const gkBoost = p.position === 'GK' ? gkCoachBonus * GK_COACH_DEV_BONUS_PER_QUALITY : 0;
      p = applyPlayerDevelopment(p, getDominantTrainingFocus(training.schedule), mentorBonusVal, trainingPerkBoost + gkBoost);
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
      const { result } = simulateMatch(m, hc, ac, hp, ap, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, season, undefined, hBenchAI, aBenchAI);
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

      // Listed player offers — anchor bids toward asking price when higher than value
      const listedPlayers = Object.values(newPlayers).filter(p => p.listedForSale && !p.onLoan && p.clubId === playerClubId);
      const currentMarket = state.transferMarket;
      for (const lp of listedPlayers) {
        const effectiveOfferChance = isDeadlineDay ? AI_OFFER_CHANCE * DEADLINE_DAY_OFFER_MULTIPLIER : AI_OFFER_CHANCE;
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
        if (Math.random() < UNSOLICITED_OFFER_CHANCE) {
          tryGenerateOffer(tp, UNSOLICITED_FEE_BASE, UNSOLICITED_FEE_RANGE);
        }
      }
    }

    // Pre-match preview
    let isNextMatchDerby = false;
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
          isNextMatchDerby = true;
          newMessages = addMsg(newMessages, {
            week: newWeek, season, type: 'match_preview',
            title: `Derby Day: ${derbyNm}`,
            body: `This is a rivalry match! The ${derbyNm} is one of the most intense fixtures on the calendar. Expect a heated atmosphere, more fouls, and higher stakes.`,
          });
        }

        // Opposition scouting report — higher chance for big matches/derbies
        const scoutChance = isNextMatchDerby ? 0.8 : (oppClub.reputation >= (clubs[playerClubId]?.reputation || 3) + 1) ? 0.6 : 0.4;
        if (Math.random() < scoutChance) {
          const playerClubRep = clubs[playerClubId]?.reputation || 5;
          const report = generateScoutReport(oppClub, Object.values(newPlayers), playerClubRep);
          const strengthsText = report.strengths.length > 0 ? `Strengths: ${report.strengths.join(', ')}.` : '';
          const weaknessText = report.weaknesses.length > 0 ? ` Weaknesses: ${report.weaknesses.join(', ')}.` : '';
          const keyPlayerText = report.keyPlayer ? ` Key threat: ${report.keyPlayer.name} (${report.keyPlayer.position}, ${report.keyPlayer.overall}).` : '';
          const dangerStars = '★'.repeat(report.dangerRating) + '☆'.repeat(5 - report.dangerRating);
          newMessages = addMsg(newMessages, {
            week: newWeek, season, type: 'general',
            title: `Scout Report: ${oppClub.shortName} ${dangerStars}`,
            body: `${oppClub.name} (${report.formation}) play a ${report.style} style. ${strengthsText}${weaknessText}${keyPlayerText}\n\nTactical advice: ${report.tacticalAdvice}`,
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
    if (newWeek === SUMMER_WINDOW_END) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Window Closing', body: 'The transfer window closes this week. Make your final moves!' });
    if (newWeek === WINTER_WINDOW_START) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'January Window Opens', body: 'The winter transfer window is now open until Week 24.' });
    if (newWeek === WINTER_WINDOW_END - 1) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'Winter Deadline Approaching', body: 'The winter transfer window closes next week. Last chance for January deals!' });
    if (newWeek === WINTER_WINDOW_END) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Winter Window Closed', body: 'The January transfer window has closed. No more transfers until next season.' });

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
    const totalExpenses = playerClub.wageBill + staffWages + scoutingCosts;
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

    // Weekly press conference — context-aware probability (higher for notable situations)
    let weeklyPress = null;
    {
      const playerTableEntry = leagueTable.find(e => e.clubId === playerClubId);
      const weekForm = (playerTableEntry?.form || []) as ('W' | 'D' | 'L')[];
      const injuredCount = Object.values(newPlayers).filter(p => p.clubId === playerClubId && p.injured).length;
      const hasListed = Object.values(newPlayers).some(p => p.clubId === playerClubId && p.listedForSale);
      const totalTeams = (state.divisionClubs[playerDiv] || []).length;
      const last5 = weekForm.slice(-5);
      const wins = last5.filter(r => r === 'W').length;
      const losses = last5.filter(r => r === 'L').length;
      // Smart probability: high-stakes situations get more press attention
      let pressChance = 0.25;
      if (isNextMatchDerby) pressChance = 0.7;
      else if (injuredCount >= 3) pressChance = 0.5;
      else if (playerTableEntry?.position && (playerTableEntry.position <= 3 || playerTableEntry.position > totalTeams - 3)) pressChance = 0.45;
      else if (wins >= 4 || losses >= 3) pressChance = 0.4;
      else if (hasListed) pressChance = 0.35;

      if (Math.random() < pressChance) {
        const weekContext = getPressContext(null, null, weekForm, hasListed, undefined, undefined, {
          leaguePosition: playerTableEntry?.position,
          totalTeams,
          injuredCount,
          isDerby: isNextMatchDerby,
        });
        if (!['post_win', 'post_loss', 'post_draw'].includes(weekContext)) {
          weeklyPress = generatePressConference(weekContext, isPro(get().monetization));
        }
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
      matchPhase: 'none' as const, pendingPressConference: weeklyPress,
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
        transferMarket: aiResult.transferMarket,
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
}
