import { Club, Player, PlayerAttributes, TransferListing, SeasonHistory, IncomingOffer, IncomingLoanOffer, FacilitiesState, BoardObjective, Position, Message, Match, MatchEvent, LeagueId, SeasonTurnover, LeagueTableEntry, JobVacancy } from '@/types/game';
import { calculateReputationTier, generateJobVacancies, getRetirementAge, calculateLegacyScore } from '@/utils/managerCareer';
import {
  GROWTH_TACTICAL_PER_MATCH, GROWTH_MOTIVATION_PER_MORALE_EVENT, GROWTH_SCOUTING_PER_ASSIGNMENT,
  GROWTH_DISCIPLINE_PER_CLEAN_MATCH, MOD_DISCIPLINE_CARDS, MOD_TACTICAL_FAMILIARITY, MOD_YOUTH_GROWTH,
  MOD_SCOUTING_SPEED, JOB_MARKET_REFRESH_WEEKS, STAT_MAX, MOTM_CHECK_INTERVAL, MOTM_MIN_MATCHES,
  REP_PROMOTION, REP_RELEGATION, REP_OVERACHIEVE_BONUS, REP_UNDERACHIEVE_PENALTY,
  REP_WIN, REP_DRAW, REP_LOSS, REP_TITLE, REP_CUP_WIN, REP_SACKING,
  FORCED_RETIREMENT_UNEMPLOYED_WEEKS,
} from '@/config/managerCareer';
import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, getDerbyIntensity, getDerbyName } from '@/data/league';
import { generateSquad, selectBestLineup, generatePlayer, calculateOverall } from '@/utils/playerGen';
import { simulateMatch, simulateHalf, finalizeMatch } from '@/engine/match';
import { generateInitialStaff, generateStaffMarket, getStaffBonus } from '@/utils/staff';
import { applyWeeklyTraining, getInjuryRisk, updateTacticalFamiliarity, getDominantTrainingFocus, getStreakMultiplier, updateStreaks, generateTrainingReport } from '@/utils/training';
import { completeAssignment } from '@/utils/scouting';
import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../storeTypes';
import { addMsg, getSuffix, pick, shuffle } from '@/utils/helpers';
import { migrateLegacySave, saveSessionSnapshot } from '@/store/helpers/persistence';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { checkAchievements, ACHIEVEMENTS, getAchievementXP } from '@/utils/achievements';
import { generateCupDraw, advanceCupRound, getCupResultForClub, getRoundName } from '@/data/cup';
import { generatePressConference } from '@/data/pressConferences';
import { isPro } from '@/utils/monetization';
import { getMentorBonus } from '@/utils/chemistry';
import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';
import { checkChallengeComplete, checkChallengeFailed, CHALLENGES } from '@/data/challenges';
import { calculateSeasonAwards } from '@/utils/seasonAwards';
import { getLeadershipBonus, wantsTransfer } from '@/utils/personality';
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
} from '@/config/gameBalance';
import {
  SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END,
  AI_OFFER_CHANCE, AI_OFFER_MIN_BUDGET_RATIO, AI_OFFER_POSITION_THRESHOLD,
  URGENCY_NONE, URGENCY_ONE, URGENCY_TWO_PLUS,
  OFFER_FEE_BASE, OFFER_FEE_RANDOM_RANGE, OFFER_MAX_BUDGET_RATIO,
  RUMOR_CHANCE, DEADLINE_DAY_OFFER_MULTIPLIER, DEADLINE_DAY_BID_PREMIUM,
} from '@/config/transfers';
import { PENALTY_CONVERSION_RATE } from '@/config/matchEngine';
import { calculatePlayerValue } from '@/config/playerGeneration';
import {
  VERDICT_EXCELLENT_OFFSET, VERDICT_ACCEPTABLE_OFFSET, BOARD_SACKING_THRESHOLD,
  STORYLINE_CHAIN_TRIGGER_CHANCE, STORYLINE_CHAIN_MIN_WEEK,
} from '@/config/playoffs';
import { applyPlayerDevelopment, resetSeasonGrowth } from '@/store/helpers/development';
import { applySeasonTurnover, generateReplacementClub } from '@/utils/promotionRelegation';
import { generateStorylines } from '@/utils/storylines';
import { STORYLINE_CHAINS, shouldTriggerChain } from '@/data/storylineChains';
import type { ActiveStorylineChain, StorylineEvent } from '@/types/game';
import { getTournamentForSeason, generateTournament, processGroupWeek, generateKnockoutBracket, processKnockoutRound, autoSelectNationalSquad } from '@/utils/international';
import { NATIONAL_CALLUP_MORALE_BOOST, INTERNATIONAL_FITNESS_COST } from '@/config/gameBalance';
import { getWinStreak, detectMatchDrama } from '@/utils/celebrations';
import { generateCliffhangers } from '@/utils/weekPreview';
import { generateWeeklyObjectives, evaluateObjectives } from '@/utils/weeklyObjectives';
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
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: week + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
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
    divisionId: playerDiv,
    awards: seasonAwards,
  };

  const topAssisterForRecords = allPlayersList.filter(p => p.clubId === playerClubId && p.assists > 0).sort((a, b) => b.assists - a.assists)[0];
  const topScorerForRecords = allPlayersList.filter(p => p.clubId === playerClubId && p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const biggestWin = findBiggestWin(state.fixtures, playerClubId);
  const updatedRecords = updateRecords(
    state.clubRecords || createEmptyRecords(),
    season, pos, playerEntry?.points || 0,
    playerEntry?.goalsFor || 0, playerEntry?.goalsAgainst || 0,
    topScorerForRecords ? { name: `${topScorerForRecords.firstName} ${topScorerForRecords.lastName}`, goals: topScorerForRecords.goals } : null,
    topAssisterForRecords ? { name: `${topAssisterForRecords.firstName} ${topAssisterForRecords.lastName}`, assists: topAssisterForRecords.assists } : null,
    biggestWin,
    state.cup.winner === playerClubId,
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
  set({ activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [] });

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
      suspendedUntilWeek: undefined, growthDelta: 0, onLoan: false,
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
      // Route to free agent pool instead of deleting (up to max pool size)
      if (aged.age <= 34 && aged.overall >= 55 && freeAgentIds.length < FREE_AGENT_POOL_MAX) {
        aged.clubId = '';
        aged.listedForSale = false;
        aged.wage = Math.round(aged.wage * 0.8); // Free agents accept lower wages
        newPlayers[aged.id] = aged;
        freeAgentIds.push(aged.id);
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
    // Clean up stale playerIds — remove any IDs that no longer exist in newPlayers
    const updatedClub = { ...newClubs[club.id] };
    updatedClub.playerIds = updatedClub.playerIds.filter(id => newPlayers[id]);
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
      const quality = (club.reputation * REPLACEMENT_QUALITY_REP_MULTIPLIER) + REPLACEMENT_QUALITY_BASE + Math.floor(Math.random() * REPLACEMENT_QUALITY_VARIANCE);
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
        const emergencyPlayer = generatePlayer(pick(GENERIC_FILL_POSITIONS), Math.max(35, (club.reputation * 10) + 20), club.id, newSeason, club.divisionId);
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

  const transferMarket: TransferListing[] = [];
  Object.values(newClubs).forEach(c => {
    const clubPlayers = c.playerIds.map(id => newPlayers[id]).filter(Boolean);
    const benched = clubPlayers.filter(p => !c.lineup.includes(p.id));
    if (benched.length > 2) {
      const listed = shuffle(benched).slice(0, INITIAL_LISTINGS_MIN + Math.floor(Math.random() * INITIAL_LISTINGS_RANGE));
      listed.forEach(p => {
        transferMarket.push({ playerId: p.id, askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)), sellerClubId: c.id });
      });
    }
  });

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

  const youthCoachQ = getStaffBonus(state.staff.members, 'youth-coach');
  const pcForYouth = newClubs[playerClubId];
  const { prospects: newYouthProspects, players: youthPlayers } = generateYouthProspects(
    playerClubId, pcForYouth.youthRating, youthCoachQ, newSeason, SEASON_YOUTH_INTAKE_MIN + Math.floor(Math.random() * SEASON_YOUTH_INTAKE_RANGE)
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
    scouting: { ...state.scouting, assignments: [], reports: [] },
    cup: newCup,
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
      return milestones;
    })(),
    managerProgression: grantXP(state.managerProgression, XP_REWARDS.seasonEnd + (history.position === 1 ? XP_REWARDS.titleWin : 0) + (state.cup.winner === playerClubId ? XP_REWARDS.cupWin : 0)),
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
            const bonusMsg = addMsg(get().messages, {
              week: TOTAL_WEEKS, season, type: 'general',
              title: 'Contract Bonuses Earned!',
              body: `You earned £${(bonusPayout / 1000).toFixed(0)}k in performance bonuses this season.`,
            });
            set({ messages: bonusMsg });
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

        const vacancies = generateJobVacancies(cs.clubs, cm.reputationScore, cs.season + 1, 1);

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
            careerUpdate.jobVacancies = generateJobVacancies(cs.clubs, cm.reputationScore, cs.season + 1, 1);
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
    Object.values(clubs).forEach(c => {
      const clubPlayers = c.playerIds.map(id => allPlayers[id]).filter(Boolean);
      const benched = clubPlayers.filter(p => !c.lineup.includes(p.id));
      if (benched.length > 2) {
        const listed = shuffle(benched).slice(0, INITIAL_LISTINGS_MIN + Math.floor(Math.random() * INITIAL_LISTINGS_RANGE));
        listed.forEach(p => {
          transferMarket.push({ playerId: p.id, askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)), sellerClubId: c.id });
        });
      }
    });

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
      clubId, pcInit.youthRating, youthCoachQuality, 1, 3 + Math.floor(Math.random() * 2)
    );
    youthPlayers.forEach(p => { allPlayers[p.id] = p; });
    const nextIntakePreview = generateIntakePreview(pcInit.youthRating);
    const scoutCount = initialStaff.filter(s => s.role === 'scout').length;

    // Generate cup draw
    const cup = generateCupDraw(leagueClubIds);

    set({
      gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: TOTAL_WEEKS,
      gameMode: get().gameMode || 'sandbox',
      transferWindowOpen: true, clubs, players: allPlayers, fixtures, leagueTable,
      divisionFixtures, divisionTables, divisionClubs, playerDivision,
      lastSeasonTurnover: null, derbies: DERBIES,
      activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
      transferMarket, shortlist: [], scoutWatchList: [], freeAgents: [], transferNews: [], boardObjectives: objectives, boardConfidence: STARTING_BOARD_CONFIDENCE,
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
      weeklyObjectives: generateWeeklyObjectives(true),
      objectiveStreak: 0,
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
      selectedPlayerId: null,
      lastMatchXPGain: 0,
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
        vacancies = generateJobVacancies(state.clubs, cm.reputationScore, state.season, newWeek);
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

      // Benched players gradually lose morale
      if (!playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid) && !p.injured) {
        p.morale = Math.max(MORALE_BENCH_MIN, p.morale - MORALE_BENCH_WEEKLY_LOSS);
      }

      // Track consecutive low morale weeks and escalate unhappiness
      if (p.morale < UNHAPPY_THRESHOLD) {
        p.lowMoraleWeeks = (p.lowMoraleWeeks || 0) + 1;
        if (p.lowMoraleWeeks === UNHAPPY_WEEKS_TO_REQUEST && !p.wantsToLeave) {
          p.wantsToLeave = true;
          p.listedForSale = true;
          newMessages = addMsg(newMessages, {
            week, season, type: 'transfer',
            title: `${p.lastName} Wants Out!`,
            body: `${p.firstName} ${p.lastName} has submitted a transfer request after weeks of low morale. The player wants to leave the club.`,
          });
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
        const hasLeagueMatch = updatedFixtures.some(f => f.week === week && (f.homeClubId === playerClubId || f.awayClubId === playerClubId));
        if (isPlayerMatch && !hasLeagueMatch) continue; // Player's cup match is played interactively only when no league match
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
        scoutedPlayers.forEach(p => {
          newPlayers[p.id] = p;
          newScouting.discoveredPlayers.push(p.id);
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
    }];

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
      else if (obj.description === 'Avoid Relegation (Top 17)') o.completed = playerPos <= 17;
      else if (obj.description === 'Stay within budget') o.completed = newClubs[playerClubId].budget >= 0;
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

    // Evaluate weekly objectives from the previous week with streak tracking
    const objCtx: ObjectiveContext = {
      playerClubId, players: newPlayers, playerIds: playerClub.playerIds,
      fixtures: updatedFixtures, leagueTable, week, season, lineup: playerClub.lineup,
    };
    const currentStreak = state.objectiveStreak || 0;
    const { updated: evalObjectives, xpEarned: objXP, allCompleted: objAllCompleted, newStreak } = evaluateObjectives(state.weeklyObjectives, objCtx, currentStreak);
    let updatedProgression = state.managerProgression;
    if (achievementXPTotal > 0) {
      updatedProgression = grantXP(updatedProgression, achievementXPTotal);
    }
    if (objXP > 0) {
      updatedProgression = grantXP(updatedProgression, objXP);
      const completedCount = evalObjectives.filter(o => o.completed).length;
      let objMsg = `You earned ${objXP} XP from this week's objectives!`;
      if (objAllCompleted) objMsg += ' PERFECT WEEK — all objectives complete!';
      if (newStreak >= 3) objMsg += ` Streak x${newStreak} — bonus multiplier active!`;
      newMessages = addMsg(newMessages, {
        week: newWeek, season, type: 'general',
        title: `Weekly Objectives: ${completedCount}/${evalObjectives.length} Complete`,
        body: objMsg,
      });
    }
    const nextWeekHasMatch = updatedFixtures.some(m => !m.played && m.week === newWeek && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const newObjectives = generateWeeklyObjectives(nextWeekHasMatch);

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
    const sessionStats = {
      ...prevSession,
      weeksPlayed: prevSession.weeksPlayed + 1,
      xpEarned: prevSession.xpEarned + objXP,
      objectivesCompleted: prevSession.objectivesCompleted + evalObjectives.filter(o => o.completed).length,
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
      activeChallenge: updatedChallenge,
      divisionFixtures: updatedDivisionFixtures, divisionTables,
      careerTimeline: [...state.careerTimeline, ...newTimeline],
      weeklyObjectives: newObjectives,
      objectiveStreak: newStreak,
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
        for (const pid of trClub.playerIds) {
          const p = trPlayers[pid];
          if (p && !p.listedForSale && !p.onLoan && wantsTransfer(p, trClub.reputation)) {
            trPlayers[pid] = { ...p, listedForSale: true };
            trMessages = addMsg(trMessages, { week: newWeek, season, type: 'transfer', title: `${p.lastName} Wants to Leave`, body: `${p.firstName} ${p.lastName} feels he has outgrown the club and has requested a transfer.` });
            changed = true;
          }
        }
        if (changed) set({ players: trPlayers, messages: trMessages });
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

        // --- Job Market Refresh ---
        if (JOB_MARKET_REFRESH_WEEKS.includes(newWeek)) {
          const vacancies = generateJobVacancies(careerState.clubs, cm.reputationScore, season, newWeek);
          set({ jobVacancies: vacancies });
        }

        // Expire old vacancies
        const activeVacancies = careerState.jobVacancies.filter(v =>
          v.expiresSeason > season || (v.expiresSeason === season && v.expiresWeek > newWeek)
        );
        if (activeVacancies.length !== careerState.jobVacancies.length) {
          set({ jobVacancies: activeVacancies });
        }

        // --- Unemployed tracking ---
        if (!cm.contract) {
          cm.unemployedWeeks = (cm.unemployedWeeks || 0) + 1;

          // Desperation vacancies after 12 unemployed weeks
          if (cm.unemployedWeeks >= 12 && get().jobVacancies.length === 0) {
            const allClubs = Object.values(careerState.clubs);
            const desperate = allClubs.filter(c => c.id !== careerState.playerClubId).slice(0, 2);
            const desVacancies: JobVacancy[] = desperate.map(club => ({
              id: `desperation-${club.id}-${season}-${newWeek}`,
              clubId: club.id, clubName: club.name, divisionId: club.divisionId || '',
              minReputation: 0, salary: 1500, contractLength: 1,
              boardExpectations: 'Survive and stabilize the club',
              expiresWeek: newWeek + 8, expiresSeason: season, applied: false,
            }));
            set({ jobVacancies: desVacancies });
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
    const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
    const backfillFromSubs = (lineup: Player[], club: typeof hc) => {
      const availableSubs = club.subs.map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p) && !p.injured);
      const ids = new Set(lineup.map(p => p.id));
      for (const sub of availableSubs) {
        if (lineup.length >= 11) break;
        if (!ids.has(sub.id)) { lineup.push(sub); ids.add(sub.id); }
      }
      return lineup;
    };
    let hp = backfillFromSubs(hc.lineup.map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p)), hc);
    let ap = backfillFromSubs(ac.lineup.map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p)), ac);

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

    const matchDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
    const careerDisciplineMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const { result, playerRatings, matchInjuries } = simulateMatch(match, hc, ac, hp, ap, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, matchDerbyIntensity, hasDisciplinarian, season, careerDisciplineMod);

    const processed = processMatchResult(state, match, result, playerRatings, () => get().week, matchInjuries);

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

    const syncedDivFixtures = { ...state.divisionFixtures, [state.playerDivision]: processed.updatedFixtures };
    set({
      fixtures: processed.updatedFixtures, players: processed.newPlayers, leagueTable: processed.leagueTable,
      currentMatchResult: result, boardConfidence: processed.confidence, messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      matchPhase: 'full_time' as const,
      pendingPressConference: press,
      divisionFixtures: syncedDivFixtures,
      divisionTables: { ...state.divisionTables, [state.playerDivision]: processed.leagueTable },
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
  },

  playFirstHalf: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training, season } = state;
    const leagueMatch = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));

    // Check for cup tie if no league match
    const cupTie = !leagueMatch ? state.cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
    const match = leagueMatch || (cupTie ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null);
    if (!match) return null;

    const hc = clubs[match.homeClubId];
    const ac = clubs[match.awayClubId];
    const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
    const backfillFromSubs = (lineup: Player[], club: typeof hc) => {
      const availableSubs = club.subs.map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p) && !p.injured);
      const ids = new Set(lineup.map(p => p.id));
      for (const sub of availableSubs) {
        if (lineup.length >= 11) break;
        if (!ids.has(sub.id)) { lineup.push(sub); ids.add(sub.id); }
      }
      return lineup;
    };
    let hp = backfillFromSubs(hc.lineup.map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p)), hc);
    let ap = backfillFromSubs(ac.lineup.map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p)), ac);

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

    set({ halfTimeState: halfState, matchPhase: 'half_time', matchSubsUsed: 0, preMatchLeaguePosition: preMatchPos, currentCupTieId: cupTie ? cupTie.id : null });
    return halfState;
  },

  playSecondHalf: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training, halfTimeState, season } = state;
    if (!halfTimeState) return null;

    // Find league match or cup match
    const leagueMatch = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const cupTie = state.currentCupTieId ? state.cup.ties.find(t => t.id === state.currentCupTieId) : null;
    const match = leagueMatch || (cupTie ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null);
    if (!match) return null;

    const hc = clubs[match.homeClubId];
    const ac = clubs[match.awayClubId];
    // Use current lineup (may have been changed by subs at half-time)
    const hp = hc.lineup.map(id => players[id]).filter(Boolean);
    const ap = ac.lineup.map(id => players[id]).filter(Boolean);

    const isPlayerHome = match.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;

    // Simulate second half, carrying forward first half state
    const secondHalfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const hasDisciplinarian = hasPerk(state.managerProgression, 'disciplinarian');
    const secondHalfCareerMod = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.discipline * MOD_DISCIPLINE_CARDS : 0;
    const fullState = simulateHalf(hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, secondHalfDerbyIntensity, hasDisciplinarian, hc.facilities, ac.facilities, season, secondHalfCareerMod);
    const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, fullState);

    // Cup match ended in draw — need extra time
    if (state.currentCupTieId && result.homeGoals === result.awayGoals) {
      set({
        currentMatchResult: result,
        halfTimeState: fullState, // carry forward for extra time continuation
        matchPhase: 'extra_time',
        matchSubsUsed: 0,
        matchPlayerRatings: playerRatings,
      });
      return result;
    }

    // Cup match decided in 90 mins — process cup result
    if (state.currentCupTieId) {
      const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
        t.id === state.currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals } : t
      )};
      const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
      if (allPlayed) {
        if (newCup.currentRound === 'F') {
          const finalTie = newCup.ties.find(t => t.round === 'F' && t.played);
          if (finalTie) {
            newCup.winner = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId;
            newCup.currentRound = null;
          }
        } else {
          const advanced = advanceCupRound(newCup);
          Object.assign(newCup, advanced);
        }
      }

      // Check if player was eliminated
      const isHome = result.homeClubId === playerClubId;
      const playerWon = isHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
      if (!playerWon) newCup.eliminated = true;

      const processed = processMatchResult(state, match, result, playerRatings, () => get().week, fullState.matchInjuries);
      const cupDrama = detectMatchDrama(result, playerClubId, clubs);
      const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
      set({
        currentMatchResult: result, players: processed.newPlayers,
        boardConfidence: processed.confidence, messages: processed.newMessages,
        matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
        halfTimeState: null, matchPhase: 'full_time', currentCupTieId: null,
        cup: newCup,
        pendingPressConference: generatePressConference(pressContext, isPro(get().monetization)),
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
        managerProgression: processed.managerProgression,
        lastMatchXPGain: processed.xpGain,
        lastMatchDrama: cupDrama,
        rivalries: processed.updatedRivalries,
        pairFamiliarity: processed.pairFamiliarity,
      });
      return result;
    }

    // League match — process as normal
    const processed = processMatchResult(state, match, result, playerRatings, () => get().week, fullState.matchInjuries);
    const leagueDrama = detectMatchDrama(result, playerClubId, clubs);

    // Generate post-match press conference
    const pressContext2 = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
    const press2 = generatePressConference(pressContext2, isPro(get().monetization));

    const syncedDivFixtures2 = { ...state.divisionFixtures, [state.playerDivision]: processed.updatedFixtures };
    set({
      fixtures: processed.updatedFixtures, players: processed.newPlayers, leagueTable: processed.leagueTable,
      currentMatchResult: result, boardConfidence: processed.confidence, messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      halfTimeState: null, matchPhase: 'full_time',
      pendingPressConference: press2,
      divisionFixtures: syncedDivFixtures2,
      divisionTables: { ...state.divisionTables, [state.playerDivision]: processed.leagueTable },
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
      managerProgression: processed.managerProgression,
      lastMatchXPGain: processed.xpGain,
      lastMatchDrama: leagueDrama,
      rivalries: processed.updatedRivalries,
      pairFamiliarity: processed.pairFamiliarity,
    });
    return result;
  },

  playExtraTime: () => {
    const state = get();
    const { clubs, players, playerClubId, tactics, training, currentMatchResult, halfTimeState, currentCupTieId, season } = state;
    if (!currentMatchResult || !halfTimeState || !currentCupTieId) return null;

    const hc = clubs[currentMatchResult.homeClubId];
    const ac = clubs[currentMatchResult.awayClubId];
    const hp = hc.lineup.map(id => players[id]).filter(Boolean);
    const ap = ac.lineup.map(id => players[id]).filter(Boolean);

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

    if (etState.homeGoals !== etState.awayGoals) {
      // Extra time decided the match — finalize
      const { result, playerRatings } = finalizeMatch(etResult, hc, ac, hp, ap, etState);

      // Update cup tie
      const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
        t.id === currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals } : t
      )};

      // Check if player was eliminated
      const playerWon = isPlayerHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
      if (!playerWon) newCup.eliminated = true;

      // Check if all cup ties for this round are done, advance if so
      const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
      if (allPlayed) {
        if (newCup.currentRound === 'F') {
          const finalTie = newCup.ties.find(t => t.round === 'F' && t.played);
          if (finalTie) {
            newCup.winner = finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId;
            newCup.currentRound = null;
          }
        } else {
          const advanced = advanceCupRound(newCup);
          Object.assign(newCup, advanced);
        }
      }

      const processed = processMatchResult(state, etResult, result, playerRatings, () => get().week, etState.matchInjuries);
      const etDrama = detectMatchDrama(result, playerClubId, clubs);
      const press = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';

      set({
        currentMatchResult: result,
        halfTimeState: null,
        matchPhase: 'full_time',
        matchSubsUsed: 0,
        matchPlayerRatings: processed.playerRatings,
        currentCupTieId: null,
        cup: newCup,
        players: processed.newPlayers,
        messages: processed.newMessages,
        boardConfidence: processed.confidence,
        managerStats: processed.managerStats,
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
        managerProgression: processed.managerProgression,
        lastMatchXPGain: processed.xpGain,
        pendingPressConference: generatePressConference(press, isPro(get().monetization)),
        lastMatchDrama: etDrama,
        rivalries: processed.updatedRivalries,
        pairFamiliarity: processed.pairFamiliarity,
      });
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
    const hp = hc.lineup.map(id => players[id]).filter(Boolean);
    const ap = ac.lineup.map(id => players[id]).filter(Boolean);

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

    // Update cup tie
    const newCup = { ...state.cup, ties: state.cup.ties.map(t =>
      t.id === currentCupTieId ? { ...t, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, penaltyShootout } : t
    )};

    // Check if player was eliminated
    if (winnerId !== playerClubId) newCup.eliminated = true;

    const allPlayed = newCup.ties.filter(t => t.round === newCup.currentRound).every(t => t.played);
    if (allPlayed) {
      if (newCup.currentRound === 'F') {
        const finalTie = newCup.ties.find(t => t.round === 'F' && t.played);
        if (finalTie) {
          newCup.winner = winnerId;
          newCup.currentRound = null;
        }
      } else {
        const advanced = advanceCupRound(newCup);
        Object.assign(newCup, advanced);
      }
    }

    const processed = processMatchResult(state, finalResult, result, playerRatings, () => get().week, halfTimeState?.matchInjuries || {});
    const penDrama = detectMatchDrama(result, playerClubId, clubs);
    const press = winnerId === playerClubId ? 'post_win' : 'post_loss';

    set({
      currentMatchResult: { ...result, penaltyShootout },
      halfTimeState: null,
      matchPhase: 'full_time',
      matchSubsUsed: 0,
      matchPlayerRatings: processed.playerRatings,
      currentCupTieId: null,
      cup: newCup,
      players: processed.newPlayers,
      messages: processed.newMessages,
      boardConfidence: processed.confidence,
      managerStats: processed.managerStats,
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
      managerProgression: processed.managerProgression,
      lastMatchXPGain: processed.xpGain,
      pendingPressConference: generatePressConference(press, isPro(get().monetization)),
      lastMatchDrama: penDrama,
      rivalries: processed.updatedRivalries,
      pairFamiliarity: processed.pairFamiliarity,
    });
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
    const state = get();
    const s = slot ?? state.activeSlot;
    const saveData = {
      version: CURRENT_VERSION,
      activeSlot: s,
      playerClubId: state.playerClubId, season: state.season, week: state.week,
      clubs: state.clubs, players: state.players, fixtures: state.fixtures,
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
      divisionFixtures: state.divisionFixtures,
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
      // Career Mode
      gameMode: state.gameMode,
      careerManager: state.careerManager,
      jobVacancies: state.jobVacancies,
      jobOffers: state.jobOffers,
    };
    const json = JSON.stringify(saveData);
    try {
      // Write backup before overwriting primary save
      const existing = localStorage.getItem(`dynasty-save-${s}`);
      if (existing) {
        localStorage.setItem(`dynasty-save-${s}-backup`, existing);
      }
      localStorage.setItem(`dynasty-save-${s}`, json);
    } catch (err) {
      console.error('[Save] Failed to write save data:', err);
      // Notify user via in-game message
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
    let raw = localStorage.getItem(`dynasty-save-${s}`);
    if (!raw) return false;

    // Try to parse primary save; if corrupted, fall back to backup
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[Load] Primary save corrupted, trying backup...');
      raw = localStorage.getItem(`dynasty-save-${s}-backup`);
      if (!raw) return false;
      try {
        parsed = JSON.parse(raw);
        // Restore backup as primary
        localStorage.setItem(`dynasty-save-${s}`, raw);
      } catch { return false; }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = migrateSaveData(parsed) as Record<string, any>;
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
        weekCliffhangers: data.weekCliffhangers || [],
        lastMatchDrama: data.lastMatchDrama || null,
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
        careerManager: data.careerManager || null,
        jobVacancies: data.jobVacancies || [],
        jobOffers: data.jobOffers || [],
      });
      return true;
    } catch { return false; }
  },

  resetGame: (slot?: number) => {
    const s = slot ?? get().activeSlot;
    localStorage.removeItem(`dynasty-save-${s}`);
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
      objectiveStreak: 0, weekCliffhangers: [], rivalries: {}, lastMatchDrama: null,
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
