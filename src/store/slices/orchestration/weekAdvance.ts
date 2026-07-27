import * as Sentry from '@sentry/react';
import { Club, Player, TransferListing, Match } from '@/types/game';
import { calculateReputationTier, generateJobVacancies, generateCompetitors, getRetirementAge } from '@/utils/managerCareer';
import {
  REP_MIN, REP_MAX,
} from '@/config/managerCareer';
import { buildLeagueTable, buildAllDivisionTables, LEAGUES } from '@/data/league';

import { generateStaffMarket, getStaffBonus, ensureStaffFields } from '@/utils/staff';
import {
  STAFF_DEFAULT_MORALE, STAFF_MORALE_WEEKLY_DRIFT,
  STAFF_MORALE_WIN_BONUS, STAFF_MORALE_LOSS_PENALTY,
} from '@/config/staff';

import type { GameState } from '../../storeTypes';
import { addMsg, pick, shuffle, safeRandomUUID } from '@/utils/helpers';

import { DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK } from '@/config/continental';

import { CHALLENGES } from '@/data/challenges';

import {
  TOTAL_WEEKS, CONFIDENCE_MIN, LISTING_PRICE_MIN_MULTIPLIER, LISTING_PRICE_RANDOM_RANGE, getExpectedPosition, FREE_AGENT_POOL_MAX,
} from '@/config/gameBalance';

import { NATIONAL_CALLUP_MORALE_BOOST, NATIONAL_SQUAD_SIZE } from '@/config/gameBalance';

import { generateMonthlyObjectives } from '@/utils/weeklyObjectives';

import { createMilestone } from '@/utils/milestones';
import { grantXP, hasPerk } from '@/utils/managerPerks';

import type { JobVacancy } from '@/types/game';
import { JOB_MARKET_REFRESH_WEEKS, PROACTIVE_OFFER_CHECK_INTERVAL, PROACTIVE_OFFER_MAX_PENDING, MOTM_CHECK_INTERVAL, MOTM_MIN_MATCHES } from '@/config/managerCareer';
import { getAICounterTactics } from '@/config/aiManager';
import { AI_LOAN_DURATIONS, AI_LOAN_OBLIGATORY_BUY_CHANCE, AI_LOAN_OBLIGATORY_BUY_MULTIPLIER, AI_LOAN_WAGE_SPLITS } from '@/config/aiSimulation';
import { getCompetitionCalendar } from '@/config/continental';
import { AI_LOAN_OFFER_CHANCE, AI_LOAN_RECALL_CLAUSE_CHANCE, ASSISTANT_MANAGER_FAMILIARITY_BOOST, BENCH_REST_BONUS, BOARD_REVIEW_ADJUST_POSITIONS, BOARD_REVIEW_RAISE_THRESHOLD, BOARD_REVIEW_RELAX_THRESHOLD, BOARD_REVIEW_WEEKS, CALLUP_SNUB_MORALE_PENALTY, CONGESTED_FIXTURE_INJURY_MULTIPLIER, CONTRACT_MORALE_HIT_AMOUNT, CONTRACT_MORALE_HIT_OVERALL_THRESHOLD, CONTRACT_MORALE_HIT_WEEK_THRESHOLD, CONTRACT_MORALE_MIN, CONTRACT_WARNING_OVERALL_THRESHOLD, CONTRACT_WARNING_WEEKS, CONTRACT_WARNING_YOUTH_AGE_MAX, CONTRACT_WARNING_YOUTH_POTENTIAL_MIN, CUP_EXTRA_TIME_GOAL_CHANCE, CUP_EXTRA_TIME_REPUTATION_DIVISOR, CUP_PENALTY_GK_QUALITY_FACTOR, CUP_PENALTY_KICKS, FACILITY_MAX_LEVEL, FAN_MOOD_BASE, FAN_MOOD_SCALE, FFP_CONFIDENCE_PENALTY, FFP_CRITICAL_CONFIDENCE_PENALTY, FFP_WAGE_RATIO_CRITICAL, FFP_WAGE_RATIO_WARNING, FORFEIT_SCORE, INJURY_TYPES, INTERNATIONAL_BREAK_FITNESS_COST, INTERNATIONAL_BREAK_WEEKS, INTERNATIONAL_CALLUP_MIN_OVR, INTERNATIONAL_FITNESS_COST, INTERNATIONAL_SNUB_MIN_OVR, LEGENDARY_OBJECTIVE_XP_MULTIPLIER, LINEUP_SIZE, LOAN_DEV_BASE_CHANCE, LOAN_DEV_REP_FACTOR, LOAN_FITNESS_DRAIN, LOAN_PLAY_CHANCE_HIGH, LOAN_PLAY_CHANCE_LOW, LOAN_QUALITY_FORMULA_BASE, LOAN_QUALITY_FORMULA_REP_MULT, LOAN_YOUNG_AGE_THRESHOLD, MANAGER_SALARY_CONFIDENCE_PENALTY, MANAGER_SALARY_RATIO_CRITICAL, MANAGER_SALARY_RATIO_WARNING, MAX_CAREER_TIMELINE, MAX_FINANCE_HISTORY, MORALE_BENCH_MIN, MORALE_BENCH_WEEKLY_LOSS, NT_SACK_GROUP_EXIT_THRESHOLD, OBJECTIVE_CYCLE_WEEKS, PHYSIO_INJURY_REDUCTION_PER_QUALITY, PHYSIO_RECOVERY_BOOST_THRESHOLD, PHYSIO_RECOVERY_CHANCE, POST_TOURNAMENT_FITNESS_COST_HIGH, POST_TOURNAMENT_FITNESS_COST_LOW, RARE_OBJECTIVE_XP_MULTIPLIER, REP_INTL_FINAL, REP_INTL_GROUP_EXIT, REP_INTL_KNOCKOUT, REP_INTL_SEMI, REP_INTL_TOURNAMENT_WIN, SCOUTING_COST_PER_ASSIGNMENT, SIM_PENALTY_BASE_WIN_CHANCE, SIM_PENALTY_MENTAL_SCALE, STADIUM_INCOME_PER_LEVEL, STREAK_FORM_BONUS, STREAK_FORM_THRESHOLD, STREAK_INCOME_MULTIPLIER, STREAK_INCOME_THRESHOLD, STREAK_MORALE_BONUS, STREAK_MORALE_THRESHOLD, TRAINING_GROUND_BOOST, ULTIMATUM_CONFIDENCE_THRESHOLD, ULTIMATUM_HORIZON_WEEKS, ULTIMATUM_POSITION_TOLERANCE, ULTIMATUM_SANDBOX_BUDGET_CUT, ULTIMATUM_SANDBOX_CONFIDENCE_FLOOR, ULTIMATUM_SEASON1_GRACE_WEEK, ULTIMATUM_SURVIVE_CONFIDENCE, ULTIMATUM_SURVIVE_CONFIDENCE_BONUS, UNHAPPY_CONTAGION_MORALE_HIT, UNHAPPY_CONTAGION_WEEKS, UNHAPPY_THRESHOLD, UNHAPPY_WEEKS_TO_REQUEST, YOUTH_DEVELOPER_BOOST } from '@/config/gameBalance';
import { FORCED_RETIREMENT_AGE_GRACE_YEARS, FORCED_RETIREMENT_UNEMPLOYED_WEEKS, GROWTH_DISCIPLINE_PER_CLEAN_MATCH, GROWTH_MOTIVATION_PER_MORALE_EVENT, GROWTH_SCOUTING_PER_ASSIGNMENT, GROWTH_TACTICAL_PER_MATCH, MOD_SCOUTING_SPEED, MOD_TACTICAL_FAMILIARITY, MOD_YOUTH_GROWTH, STAT_MAX, UNEMPLOYED_OFFER_CHECK_INTERVAL, UNEMPLOYED_OFFER_MAX_PENDING } from '@/config/managerCareer';
import { NATIONAL_OVR_STR_FLOOR, NATIONAL_OVR_STR_MAX, NATIONAL_OVR_STR_MIN, NATIONAL_OVR_STR_RANGE, PENALTY_CONVERSION_RATE } from '@/config/matchEngine';
import { MERCH_CAMPAIGN_COOLDOWN_WEEKS, MERCH_PRICING_TIERS, SIGNATURE_DROP_COOLDOWN_WEEKS } from '@/config/merchandise';
import { STORYLINE_CHAIN_MIN_WEEK, STORYLINE_CHAIN_TRIGGER_CHANCE, STORYLINE_CHAIN_COOLDOWN_SEASONS } from '@/config/playoffs';
import { MAX_SCOUT_REPORTS } from '@/config/scouting';
import { GK_COACH_DEV_BONUS_PER_QUALITY, STAFF_MARKET_REFRESH_WEEK } from '@/config/staff';
import { INDIVIDUAL_INJURY_RISK_MODIFIER } from '@/config/training';
import { AI_OFFER_CHANCE, AI_OFFER_MIN_BUDGET_RATIO, AI_OFFER_POSITION_THRESHOLD, ASKING_PRICE_BID_ANCHOR, CLUB_LISTING_EXPIRY_WEEKS, COMPETING_BID_PREMIUM, DEADLINE_BARGAIN_DISCOUNT, DEADLINE_DAY_BID_PREMIUM, DEADLINE_DAY_OFFER_MULTIPLIER, DEADLINE_MULTI_BID_CHANCE, DEADLINE_PANIC_BID_PREMIUM, DEADLINE_PANIC_OFFER_COUNT, FREE_AGENT_SPAWN_CHANCE, INJURY_BID_DISCOUNT, LISTING_EXPIRY_WEEKS, LISTING_RELIST_CHANCE, LISTING_RELIST_DISCOUNT, LONG_INJURY_BID_DISCOUNT, LONG_INJURY_WEEKS_THRESHOLD, MARKET_REPLENISH_THRESHOLD, OFFER_EXPIRY_WEEKS, OFFER_FEE_BASE, OFFER_FEE_RANDOM_RANGE, OFFER_MAX_BUDGET_RATIO, PRE_SEASON_END, PRE_SEASON_OFFER_MULTIPLIER, PRE_SEASON_RUMOR_MULTIPLIER, PRE_SEASON_UNSOLICITED_MULTIPLIER, RUMOR_CHANCE, getTransferWindows, isTransferWindowOpen, UNSOLICITED_FEE_BASE, UNSOLICITED_FEE_RANGE, UNSOLICITED_OFFER_CHANCE, URGENCY_NONE, URGENCY_ONE, URGENCY_TWO_PLUS, } from '@/config/transfers';
import { checkChallengeFailed } from '@/data/challenges';
import { advanceCupRound, getRoundName } from '@/data/cup';
import { ALL_CLUBS, getDerbyIntensity, getDerbyName } from '@/data/league';
import { STORYLINE_CHAINS, shouldTriggerChain } from '@/data/storylineChains';
import { simulateMatch } from '@/engine/match';
import { applyPlayerDevelopment, seasonGrowthTracker } from '@/store/helpers/development';
import { applyAIMatchEvents, generateAIInjuryDetails } from '@/store/slices/orchestration/helpers';
import { endSeasonImpl, runPostSeasonTail } from '@/store/slices/orchestration/seasonEnd';
import { advanceLeagueCupRound } from '@/store/slices/orchestration/tournaments';
import { processSponsorWeek } from '@/store/slices/sponsorSlice';
import type { ActiveStorylineChain, CareerMilestone, FacilitiesState, IncomingLoanOffer, IncomingOffer, PlayerAttributes, StorylineEvent } from '@/types/game';
import { ACHIEVEMENTS, checkAchievements, getAchievementXP } from '@/utils/achievements';
import { processAIWeekly } from '@/utils/aiSimulation';
import { getWinStreak } from '@/utils/celebrations';
import { getMentorBonus } from '@/utils/chemistry';
import { advanceKnockoutRound, generateKnockoutFromGroups, getCurrentMatchday, isGroupStageComplete, isKnockoutRoundComplete, simulateGroupMatchday, simulateKnockoutLeg } from '@/utils/continental';
import { getEffectiveStadiumLevel } from '@/utils/facilities';
import { getLeaguePositionPrize, getMatchdayIncome, getCommercialIncome, assessFfp } from '@/utils/financeHelpers';
import { formatMoney, getSuffix } from '@/utils/helpers';
import { generateKnockoutBracket, processGroupWeek, processKnockoutRound, simulateKnockoutToCompletion, autoSelectNationalSquad } from '@/utils/international';
import { generateUnemployedOffer } from '@/utils/managerCareer';
import { dynastyMult } from '@/utils/managerPerks';
import { calculateWeeklyMerchRevenue } from '@/utils/merchandise';
import { getLeadershipBonus, wantsTransfer } from '@/utils/personality';
import { calculateOverall, selectBestLineup } from '@/utils/playerGen';
import { recomputePlayerValueOnly } from '@/utils/playerEconomics';
import { generateRandomEvents } from '@/utils/randomEvents';
import { completeAssignment } from '@/utils/scouting';
import { getTrainingStaffBonus } from '@/utils/staff';
import { generateStorylines } from '@/utils/storylines';
import { updateEloRatings } from '@/utils/teamRankings';
import { applyWeeklyTraining, generateTrainingReport, getDominantTrainingFocus, getInjuryRisk, getStreakMultiplier, updateStreaks, updateTacticalFamiliarity } from '@/utils/training';
import { processListingExpiry, replenishMarket, replenishMarketPreSeason, spawnFreeAgents } from '@/utils/transferMarketGen';
import { getContractLengthFactor, getPerformanceMultiplier } from '@/utils/transferOffers';
import { buildTransferTalk } from '@/utils/transferTalk';
import { generateCliffhangers } from '@/utils/weekPreview';
import { ObjectiveContext, calculateCompletedXP, evaluateObjectives, objectiveClaimXP } from '@/utils/weeklyObjectives';
import { generateProactiveOffer, getReputationTierLabel } from '@/utils/managerCareer';
import { refreshCommunityPackMarket, seedCommunityPackFreeAgents } from './communityPackRuntime';
import { pickAiMatchSquad } from '@/store/slices/orchestration/helpers';

/**
 * Week-advancement pipeline extracted from orchestrationSlice.ts.
 *
 * `advanceWeekImpl` is invoked from the slice's `advanceWeek` action;
 * it processes one tick of the simulation (training, AI matches, finance,
 * weekly objectives, etc.) and delegates to `advanceInternationalWeekImpl`
 * during international break weeks. Both take `(set, get)` so they remain
 * stateless w.r.t. module-level state.
 */

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

function advanceInternationalWeekImpl(set: Set, get: Get) {
  const state = get();
  const tournament = state.internationalTournament;
  if (!tournament || !state.nationalTeam || !state.managerNationality) {
    // No runnable tournament (e.g. sandbox manager with a nationality but no
    // national-team squad, or a save stuck in the international phase). The
    // season rollover was already committed when the tournament was
    // scheduled — close the international phase and run the deferred
    // post-season tail. Calling endSeasonImpl here would end the brand-new
    // season a second time (double aging, P/R off an all-zero table).
    set({ seasonPhase: 'regular', internationalTournament: null });
    runPostSeasonTail(set, get, state.season - 1);
    return;
  }

  const nationality = state.managerNationality;
  const currentWeek = tournament.currentWeek;

  // Pre-tournament squad picker: until the manager has confirmed their squad
  // we must not progress the week — the picker is the canonical "first
  // week before the first national game" gate.
  if (!tournament.squadConfirmed) {
    // HARD ESCAPE. Blocking the week on a UI gate is only safe if that gate can
    // always be satisfied, and it could not: the picker's Confirm requires
    // exactly 23 players meeting position quotas, and at end of season — which is
    // when tournaments are scheduled — the eligible pool can come up short
    // (notably on goalkeepers). The result was an unrecoverable save: every
    // Advance Week snapped back to the picker, `seasonPhase` stayed
    // 'international', and there was no skip.
    //
    // The picker and `autoSelectNationalSquad` are both hardened now, so this
    // should never fire — but the game loop must not be one UI regression away
    // from a dead save. If a full squad can be assembled automatically, confirm
    // it and carry on rather than blocking forever.
    if (state.currentScreen !== 'national-squad-picker') {
      const auto = autoSelectNationalSquad(nationality, state.players, tournament.currentWeek);
      if (auto.length >= NATIONAL_SQUAD_SIZE && state.nationalTeam) {
        const squadPlayers = auto.map(id => state.players[id]).filter(Boolean);
        const { lineup, subs } = selectBestLineup(squadPlayers, state.nationalTeam.formation, state.week);
        get().confirmNationalSquad(auto, lineup.map(p => p.id), subs.map(p => p.id));
      } else {
        set({ currentScreen: 'national-squad-picker' });
        return;
      }
    } else {
      return;
    }
  }

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
        // Opponent strength scales UP with their group points (a 9-point
        // group leader sims stronger than a 0-point minnow), clamped to
        // the 0.3..0.7 band. Was inverted (0.7 - points * 0.02), which
        // made tournament leaders the weakest opponents.
        const opponentNation = isHome ? playerMatchThisWeek.awayNation : playerMatchThisWeek.homeNation;
        const opponentRanking = tournament.groups.flatMap(g => g.table).find(t => t.nationality === opponentNation);
        const opponentStr = opponentRanking ? Math.min(0.7, 0.45 + (opponentRanking.points || 0) * 0.02) : 0.5;
        const playerStr = Math.min(
          NATIONAL_OVR_STR_MAX,
          (playerAvgOVR - NATIONAL_OVR_STR_FLOOR) / NATIONAL_OVR_STR_RANGE + NATIONAL_OVR_STR_MIN,
        );
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

      // Rebuild tables for groups that had the player match. We rebuild
      // whenever the group contains the player's just-played fixture —
      // previously an `!allPlayed` guard also gated this, which wrongly
      // SKIPPED the rebuild when the player's match was the group's final
      // fixture, leaving that result out of the standings and mis-seeding
      // the knockout bracket.
      const rebuiltGroups = finalGroups.map(group => {
        if (group.fixtures.some(f => f.id === playerMatchThisWeek.id)) {
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
          newPlayers[pid] = {
            ...newPlayers[pid],
            fitness: Math.max(40, recovered - INTERNATIONAL_FITNESS_COST),
            internationalCaps: (newPlayers[pid].internationalCaps || 0) + 1,
          };
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

        // World Cup mode: if you fail to escape the group, the tournament plays
        // on without you — fast-forward the AI bracket to a champion and land
        // on the result screen, rather than ending with no winner.
        if (state.gameMode === 'world-cup' && eliminated) {
          const { knockoutTies: finishedTies, winner } = simulateKnockoutToCompletion(knockoutTies, firstRound!, nationality);
          set({
            internationalTournament: {
              ...tournament, groups: rebuiltGroups, phase: 'complete',
              knockoutTies: finishedTies, currentRound: 'F', winner,
              playerEliminated: true, currentWeek: nextWeek,
            },
            nationalTeam: nt, players: newPlayers,
            currentScreen: 'world-cup-result',
          });
          return;
        }

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
        if (state.gameMode === 'world-cup' && eliminated) {
          const { knockoutTies: finishedTies, winner } = simulateKnockoutToCompletion(knockoutTies, firstRound!, nationality);
          set({
            internationalTournament: {
              ...tournament, groups, phase: 'complete', knockoutTies: finishedTies,
              currentRound: 'F', winner, playerEliminated: true, currentWeek: currentWeek + 1,
            },
            currentScreen: 'world-cup-result',
          });
          return;
        }
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
        const penWinChance = SIM_PENALTY_BASE_WIN_CHANCE + (Math.min(100, avgMental) / 100) * SIM_PENALTY_MENTAL_SCALE;
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
        // Shootout wins are drawn on goals — stamp the real outcome so
        // achievements/UI can classify the result.
        won: updatedPlayerTie.winnerId === nationality,
      }];

      // Apply fitness recovery between matches (+3), then fitness cost
      const newPlayers = { ...state.players };
      const playerGoalsKO = isHome ? hg : ag;
      const updatedCapsKO = { ...nt.caps };
      const updatedIntlGoalsKO = { ...nt.internationalGoals };
      for (const pid of nt.squad) {
        if (newPlayers[pid]) {
          const recovered = Math.min(100, newPlayers[pid].fitness + 3);
          newPlayers[pid] = {
            ...newPlayers[pid],
            fitness: Math.max(40, recovered - INTERNATIONAL_FITNESS_COST),
            internationalCaps: (newPlayers[pid].internationalCaps || 0) + 1,
          };
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

      // World Cup mode: knocked out in the knockouts → the tournament plays on
      // without you. Fast-forward the remaining AI rounds to a champion and
      // land on the result screen instead of tapping through games you're not
      // in. (Career mode keeps the week-by-week flow — it has a club season to
      // return to and national-team sacking logic that reads the timeline.)
      if (state.gameMode === 'world-cup' && playerEliminated) {
        const { knockoutTies: finishedTies, winner } = simulateKnockoutToCompletion(finalTies, tournament.currentRound, nationality);
        set({
          internationalTournament: {
            ...tournament, knockoutTies: finishedTies, phase: 'complete',
            currentRound: 'F', winner, playerEliminated: true, currentWeek: currentWeek + 1,
          },
          nationalTeam: nt, players: newPlayers,
          currentScreen: 'world-cup-result',
        });
        return;
      }

      // Re-check if round is now complete
      const allRoundPlayed = finalTies.filter(t => t.round === tournament.currentRound).every(t => t.played);

      if (allRoundPlayed) {
        if (tournament.currentRound === 'F') {
          // Final played — tournament over. (Player reached here only by
          // winning the final; an earlier elimination short-circuits above.)
          const finalMatch = finalTies.find(t => t.round === 'F' && t.played);
          set({
            internationalTournament: {
              ...tournament, knockoutTies: finalTies, phase: 'complete',
              winner: finalMatch?.winnerId || null, playerEliminated,
              currentWeek: currentWeek + 1,
            },
            nationalTeam: nt, players: newPlayers,
            // World Cup mode: champions go straight to the trophy lift.
            ...(state.gameMode === 'world-cup' && { currentScreen: 'world-cup-result' }),
          });
        } else {
          // Generate next round
          const roundWinners = finalTies.filter(t => t.round === tournament.currentRound).map(t => t.winnerId!).filter(Boolean);
          const roundOrder = ['R32', 'R16', 'QF', 'SF', 'F'] as const;
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
    // World Cup mode: the tournament IS the whole game. Park on the result
    // screen instead of rolling into a (non-existent) club season.
    if (state.gameMode === 'world-cup') {
      const isWinner = tournament.winner === nationality;
      set({
        internationalTournament: tournament,
        currentScreen: 'world-cup-result',
        messages: addMsg(state.messages, {
          week: state.week, season: state.season, type: 'general',
          title: isWinner ? `${tournament.name} Champions!` : `${tournament.name} Over`,
          body: isWinner
            ? `${nationality} are crowned champions of the ${tournament.name}!`
            : `${tournament.winner} won the ${tournament.name}.`,
        }),
      });
      return;
    }

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
      currentScreen: 'season-summary',
      ...(updatedCareerManager && { careerManager: updatedCareerManager }),
      ...(clearNationalTeam && { nationalTeam: null }),
    });
    // The season rollover was committed before the tournament began
    // (finalizeSeason returns early after scheduling it). Run the deferred
    // post-season tail — career processing + autosave — rather than
    // endSeasonImpl, which would end the new season we're already in.
    runPostSeasonTail(set, get, state.season - 1);
  }
}

export async function advanceWeekImpl(set: Set, get: Get): Promise<void> {
  const state = get();

  // World Cup mode is a pure international tournament — there's no club league
  // season around it, so run the tournament directly and skip ALL the
  // club/league/finance/season processing below (which would corrupt the
  // tournament now that the national team is the player's "club"). Career-mode
  // international breaks still fall through to the normal branch lower down.
  if (state.gameMode === 'world-cup' && state.seasonPhase === 'international') {
    advanceInternationalWeekImpl(set, get);
    return;
  }

  // A retired manager is DONE. Without this guard the retirement path fell
  // straight back into the unemployed branch below: weekly "Between Jobs" spam,
  // every job offer auto-rejected by respondToJobOffer's retirement-age check,
  // and after another 24 weeks the forced-retirement branch fired again and
  // bounced the player to Hall of Managers on every single tick. The career is
  // over — the retirement screen offers a new career instead.
  if (state.gameMode === 'career' && state.careerRetired) {
    set({ currentScreen: 'career-retired' });
    return;
  }

  // Career mode: unemployed managers skip gameplay, only process job market
  if (state.gameMode === 'career' && state.careerManager && !state.careerManager.contract) {
    const cm = { ...state.careerManager, attributes: { ...state.careerManager.attributes } };
    cm.unemployedWeeks = (cm.unemployedWeeks || 0) + 1;
    const newWeek = state.week + 1;

    // Forced retirement after extended unemployment — but only for a manager
    // who is actually near the end of a career. This used to fire on age alone
    // being irrelevant: a 40-year-old who had one bad run was "retired" against
    // his will, and because the branch returned before regenerating vacancies,
    // nothing was ever generated again and the save was unrecoverable in-game.
    // A younger manager out of work this long gets a guaranteed low-tier offer
    // instead (the desperation-vacancy path below).
    const nearEndOfCareer = cm.age >= getRetirementAge(cm) - FORCED_RETIREMENT_AGE_GRACE_YEARS;
    if (cm.unemployedWeeks >= FORCED_RETIREMENT_UNEMPLOYED_WEEKS && nearEndOfCareer) {
      cm.careerHistory = cm.careerHistory.map(e =>
        e.endSeason === null ? { ...e, endSeason: state.season, reason: 'retired' as const } : e
      );
      cm.contract = null;
      set({ week: newWeek, careerManager: cm, activeInterview: null, careerRetired: true, currentScreen: 'career-retired' });
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
      // Weakest clubs first. `.slice(0, 2)` on insertion order handed out the
      // first two clubs in the record, which can be a top-flight giant — offered
      // at a GBP 1,500 salary with "Survive and stabilize the club" expectations.
      const desperate = Object.values(state.clubs)
        .filter(c => c.id !== state.playerClubId)
        .sort((a, b) => (a.reputation || 0) - (b.reputation || 0))
        .slice(0, 2);
      vacancies = desperate.map(club => {
        const league = LEAGUES.find(l => l.id === club.divisionId);
        const clubData = ALL_CLUBS.find(c => c.id === club.id);
        return {
          id: `desperation-${club.id}-${state.season}-${newWeek}`,
          clubId: club.id, clubName: club.name, divisionId: club.divisionId || '',
          minReputation: 0, salary: 1500, contractLength: 1,
          boardExpectations: 'Survive and stabilize the club',
          expiresWeek: newWeek + 8, expiresSeason: state.season, applied: false,
          competitors: generateCompetitors(0, 4).slice(0, 1),
          leagueName: league?.name || '',
          clubColor: clubData?.color || club.color || '#888888',
          reputation: club.reputation,
          budget: club.budget || 0,
          facilities: club.facilities || 5,
          expectedPosition: 'Bottom quarter',
        };
      });
    }

    // Expire old offers
    let offers = state.jobOffers.filter(o =>
      o.expiresSeason > state.season || (o.expiresSeason === state.season && o.expiresWeek > newWeek)
    );

    // Periodic proactive offers from clubs (every UNEMPLOYED_OFFER_CHECK_INTERVAL weeks)
    if (cm.unemployedWeeks > 0 && cm.unemployedWeeks % UNEMPLOYED_OFFER_CHECK_INTERVAL === 0 && offers.length < UNEMPLOYED_OFFER_MAX_PENDING) {
      const existingClubIds = offers.map(o => o.clubId);
      const newOffer = generateUnemployedOffer(cm, state.clubs, state.season, newWeek, existingClubIds, state.playerClubId);
      if (newOffer) offers = [...offers, newOffer];
    }

    let msgs = addMsg(state.messages, {
      week: newWeek, season: state.season, type: 'general',
      title: 'Between Jobs',
      body: `Week ${cm.unemployedWeeks} without a club. Visit the Job Market to find your next opportunity.`,
    });

    // Notify about new offers
    if (offers.length > state.jobOffers.length) {
      const newest = offers[offers.length - 1];
      msgs = addMsg(msgs, {
        week: newWeek, season: state.season, type: 'contract',
        title: `Interest from ${newest.clubName}`,
        body: `${newest.clubName} are impressed by your reputation and want to offer you the manager position. Visit the Job Market to review.`,
      });
    }

    // Simulate league matches for all loaded divisions during unemployment
    const simPlayers = { ...state.players };
    const simClubs = { ...state.clubs };
    const simDivFixtures: Record<string, Match[]> = { ...state.divisionFixtures };
    const eloRankings = { ...(state.clubPowerRankings || {}) };

    for (const [leagueId, clubIds] of Object.entries(state.divisionClubs)) {
      if (!clubIds?.length) continue;
      const leagueFixtures = [...(state.divisionFixtures[leagueId] || [])];
      let changed = false;
      for (let fi = 0; fi < leagueFixtures.length; fi++) {
        const m = leagueFixtures[fi];
        if (m.week !== newWeek || m.played) continue;
        const hc = simClubs[m.homeClubId];
        const ac = simClubs[m.awayClubId];
        if (!hc || !ac) continue;
        const hSquadAI = pickAiMatchSquad(hc, simPlayers, newWeek);
        const aSquadAI = pickAiMatchSquad(ac, simPlayers, newWeek);
        const hp = hSquadAI.xi;
        const ap = aSquadAI.xi;
        if (hp.length === 0 || ap.length === 0) {
          leagueFixtures[fi] = { ...m, played: true, homeGoals: hp.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap.length === 0 ? 0 : FORFEIT_SCORE, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited' }] };
          changed = true;
          continue;
        }
        const hBenchAI = hSquadAI.bench;
        const aBenchAI = aSquadAI.bench;
        const hProfile = hc.aiManagerProfile;
        const aProfile = ac.aiManagerProfile;
        const hTacticsAI = hProfile && aProfile ? getAICounterTactics(hProfile, aProfile.defaultTactics, ac.formation || '4-4-2') : undefined;
        const aTacticsAI = aProfile && hProfile ? getAICounterTactics(aProfile, hProfile.defaultTactics, hc.formation || '4-4-2') : undefined;
        const { result } = simulateMatch(m, hc, ac, hp, ap, hTacticsAI, aTacticsAI, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId), undefined, state.season, undefined, hBenchAI, aBenchAI);
        leagueFixtures[fi] = result;
        applyAIMatchEvents(result.events, simPlayers, simClubs, newWeek, hp, ap, result.homeGoals, result.awayGoals, eloRankings, m.homeClubId, m.awayClubId);
        updateEloRatings(eloRankings, m.homeClubId, m.awayClubId, result.homeGoals, result.awayGoals, 'league');
        changed = true;
      }
      if (changed) simDivFixtures[leagueId] = leagueFixtures;
    }

    // Also update the main fixtures array for the player's division
    const mainFixtures = simDivFixtures[state.playerDivision] || state.fixtures;

    const simDivTables = buildAllDivisionTables(simDivFixtures, state.divisionClubs);

    // Keep the AI world alive during unemployment: process transfers, loans, wages,
    // contracts and free agents. Without this the simulated world froze — AI budgets
    // inflated (no wages paid) and squads never changed, distorting the market on rehire.
    const unempWindowOpen = isTransferWindowOpen(newWeek, state.totalWeeks);
    const unempAI = processAIWeekly(
      simClubs, simPlayers, msgs, state.transferMarket, state.freeAgents,
      state.activeLoans, state.transferNews || [], simDivTables, newWeek, state.season,
      state.playerClubId, unempWindowOpen,
    );

    // Re-enrich vacancies with updated league data
    vacancies = vacancies.map(v => {
      const table = simDivTables[v.divisionId];
      if (!table) return v;
      const idx = table.findIndex(e => e.clubId === v.clubId);
      if (idx < 0) return v;
      return { ...v, currentPosition: idx + 1, currentForm: table[idx].form, currentPoints: table[idx].points, matchesPlayed: table[idx].played };
    });

    set({
      week: newWeek, careerManager: cm, jobVacancies: vacancies, jobOffers: offers,
      messages: unempAI.messages, currentScreen: 'job-market',
      players: unempAI.players, clubs: unempAI.clubs,
      fixtures: mainFixtures, divisionFixtures: simDivFixtures,
      divisionTables: simDivTables, clubPowerRankings: eloRankings,
      transferMarket: unempAI.transferMarket, freeAgents: unempAI.freeAgents,
      activeLoans: unempAI.activeLoans, transferNews: unempAI.transferNews,
    });

    // Season end check — after merging simulated state so AI results persist.
    // Use the player division's actual season length (e.g. the 38-week Premier
    // League) rather than the global 46-week constant, so the season ends the
    // week after the final fixture instead of dragging through empty weeks.
    if (newWeek > (state.totalWeeks || TOTAL_WEEKS)) {
      endSeasonImpl(set, get);
      return;
    }

    if (state.settings.autoSave) get().saveGame();
    return;
  }

  // International phase: separate flow
  if (state.seasonPhase === 'international') {
    advanceInternationalWeekImpl(set, get);
    return;
  }
  const { week, season, fixtures, clubs, players, playerClubId, training, staff, scouting, facilities, messages, boardConfidence } = state;

  // Defensive guard: if playerClubId points at a missing club (corrupted save,
  // mid-flight prestige reset, sacked manager whose club was purged), the
  // entire week tick would crash on `pc.playerIds`. Bail out cleanly instead.
  if (!playerClubId || !clubs[playerClubId]) {
    Sentry.captureMessage('advanceWeek: missing player club', { level: 'warning', tags: { playerClubId: playerClubId || 'empty' } });
    set({ week: state.week + 1 });
    return;
  }

  const newPlayers = { ...players };
  let newMessages = [...messages];
  const newTimeline: CareerMilestone[] = [];

  // Digest tracking
  const digestInjuries: string[] = [];
  const digestRecoveries: string[] = [];
  const prevMorale = (() => {
    const pc = clubs[playerClubId];
    const ids = pc.playerIds || [];
    if (ids.length === 0) return 0;
    return Math.round(ids.reduce((s, id) => s + (players[id]?.morale || 0), 0) / ids.length);
  })();

  const physioBonus = getStaffBonus(staff.members, 'physio');
  const assistantManagerBonus = getStaffBonus(staff.members, 'assistant-manager');
  const gkCoachBonus = getStaffBonus(staff.members, 'goalkeeping-coach');

  const playerClub = { ...clubs[playerClubId] };

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
    // Reset weekly growthDelta at the start of each player's pass so
    // applyPlayerDevelopment's training-delta accumulator can't pick up a
    // stale value from a prior week. Without this, injured players who skip
    // applyWeeklyTraining (which would have zeroed the field) would have
    // last week's gain added to this week's dev delta — silently inflating
    // their displayed growth.
    p.growthDelta = 0;
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
        // Recovery is reported via the WeeklyDigest (recoveriesThisWeek) — no inbox message.
        digestRecoveries.push(p.lastName);
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

    // Compute combined per-attribute changes from training + development
    const attrChanges: Partial<Record<keyof PlayerAttributes, number>> = {};
    for (const attr of Object.keys(attrsBefore) as (keyof PlayerAttributes)[]) {
      const delta = p.attributes[attr] - attrsBefore[attr];
      if (delta !== 0) attrChanges[attr] = delta;
    }
    p.lastAttributeChanges = Object.keys(attrChanges).length > 0 ? attrChanges : undefined;

    // Benched players gradually lose morale but gain extra fitness rest
    if (!playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid) && !p.injured) {
      p.morale = Math.max(MORALE_BENCH_MIN, p.morale - MORALE_BENCH_WEEKLY_LOSS);
      p.fitness = Math.min(100, p.fitness + BENCH_REST_BONUS);
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
      if (p.lowMoraleWeeks === UNHAPPY_CONTAGION_WEEKS) {
        // Morale contagion fires ONCE per unhappiness spell, on the week the
        // counter just crosses the threshold. Previously this fired every
        // week as long as the counter stayed ≥ threshold, so two unhappy
        // stars for 12w produced 24 contagion events and snowballed into a
        // dressing-room collapse with no per-spell cooldown.
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

  // Weekly development ticks and training injuries are reported via the
  // WeeklyDigest (playerDevelopment / injuriesThisWeek) — no inbox duplicates.

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

  // When the user plays a higher-priority match this week (continental, cup,
  // leagueCup, superCup, friendly), the priority chain in playCurrentMatchImpl
  // / playFirstHalfImpl picks that match for interactive play and leaves the
  // user's league fixture un-played. We need to auto-sim it here — otherwise
  // it lingers forever, the player's club ends the season with fewer played
  // matches than the rest of the league, and the table is broken.
  const playerPlayedNonLeagueThisWeek =
    (state.friendlies?.some(m => m.played && m.week === week && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)) ?? false)
    || state.cup.ties.some(t => t.played && t.week === week && (t.homeClubId === playerClubId || t.awayClubId === playerClubId))
    || (state.leagueCup?.ties?.some(t => t.played && t.week === week && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) ?? false)
    || (state.domesticSuperCup?.played === true && state.domesticSuperCup.week === week && (state.domesticSuperCup.homeClubId === playerClubId || state.domesticSuperCup.awayClubId === playerClubId))
    || (state.continentalSuperCup?.played === true && state.continentalSuperCup.week === week && (state.continentalSuperCup.homeClubId === playerClubId || state.continentalSuperCup.awayClubId === playerClubId))
    || [state.championsCup, state.shieldCup, state.conferenceCup].some(t => {
      if (!t) return false;
      const inGroup = t.groups?.some(g => g.matches.some(m => m.played && m.week === week && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))) ?? false;
      const inKO = t.knockoutTies?.some(tie =>
        (tie.homeClubId === playerClubId || tie.awayClubId === playerClubId)
        && ((tie.week1 === week && tie.leg1Played) || (tie.week2 === week && tie.leg2Played)),
      ) ?? false;
      return inGroup || inKO;
    });

  const aiMatches = weekMatches.filter(m => {
    const involvesPlayer = m.homeClubId === playerClubId || m.awayClubId === playerClubId;
    if (!involvesPlayer) return true;
    // Player's league fixture: only auto-sim if they already played a
    // higher-priority match this week (otherwise they're about to play
    // it interactively via MatchDay).
    return playerPlayedNonLeagueThisWeek;
  });

  // Surface a single inbox message after the loop if we auto-simmed the
  // player's league fixture. Captured here so we know which fixture to name.
  const orphanLeagueFixture = playerPlayedNonLeagueThisWeek
    ? weekMatches.find(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId)
    : null;

  const updatedDivisionFixtures = { ...state.divisionFixtures };
  const playerDiv = state.playerDivision;

  // Mutable copy of power rankings — updated after every match this week
  const eloRankings = { ...(state.clubPowerRankings || {}) };

  // When a fixture belongs to the player's club it's only in `aiMatches`
  // because a higher-priority match forced it to be auto-simmed. In that case
  // honour the manager's chosen XI: order available players by lineup → subs →
  // rest-of-roster before slicing, instead of raw roster order (which ignored
  // the saved lineup entirely). Injured/suspended lineup members are already
  // filtered out of `avail`, so they fall through to bench/best-available
  // cover gracefully. AI clubs keep plain roster order.
  const orderByLineup = (club: typeof clubs[string], avail: typeof newPlayers[string][]) => {
    if (club.id !== playerClubId) return avail;
    const availById = new Map(avail.map(p => [p.id, p]));
    const ordered: typeof avail = [];
    const seen = new Set<string>();
    for (const id of [...(club.lineup || []), ...(club.subs || [])]) {
      const p = availById.get(id);
      if (p && !seen.has(id)) { ordered.push(p); seen.add(id); }
    }
    for (const p of avail) {
      if (!seen.has(p.id)) { ordered.push(p); seen.add(p.id); }
    }
    return ordered;
  };

  for (const m of aiMatches) {
    const idx = updatedFixtures.findIndex(f => f.id === m.id);
    const hc = clubs[m.homeClubId];
    const ac = clubs[m.awayClubId];
    if (!hc || !ac) continue;
    const hSquadColl = pickAiMatchSquad(hc, newPlayers, week);
    const aSquadColl = pickAiMatchSquad(ac, newPlayers, week);
    const hp = hSquadColl.xi;
    const ap = aSquadColl.xi;
    const hBenchAI = hSquadColl.bench;
    const aBenchAI = aSquadColl.bench;
    // Forfeit if either team has no available players
    if (hp.length === 0 || ap.length === 0) {
      const forfeit = { ...m, played: true, homeGoals: hp.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap.length === 0 ? 0 : FORFEIT_SCORE, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
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

  // Notify the user that their league fixture was auto-simulated because they
  // had a higher-priority match this week.
  if (orphanLeagueFixture) {
    const simmedIdx = updatedFixtures.findIndex(f => f.id === orphanLeagueFixture.id);
    const simmed = simmedIdx >= 0 ? updatedFixtures[simmedIdx] : null;
    if (simmed?.played) {
      const oppId = simmed.homeClubId === playerClubId ? simmed.awayClubId : simmed.homeClubId;
      const oppName = clubs[oppId]?.shortName || clubs[oppId]?.name || 'Opponent';
      const playerHome = simmed.homeClubId === playerClubId;
      const ourGoals = playerHome ? simmed.homeGoals : simmed.awayGoals;
      const theirGoals = playerHome ? simmed.awayGoals : simmed.homeGoals;
      newMessages = addMsg(newMessages, {
        week, season, type: 'match_result',
        title: 'League Fixture Auto-Simulated',
        body: `Your assistant played the league fixture vs ${oppName} (${ourGoals}-${theirGoals}) while you focused on the higher-stakes match this week.`,
      });
    }
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
      const hCupSquad = pickAiMatchSquad(hClub, newPlayers, week);
      const aCupSquad = pickAiMatchSquad(aClub, newPlayers, week);
      const hPlayers = hCupSquad.xi;
      const aPlayers = aCupSquad.xi;

      const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
      if (isPlayerMatch && tie.week === week) continue; // Player's current-week cup match is played interactively
      // Forfeit if either team has no available players
      if (hPlayers.length === 0 || aPlayers.length === 0) {
        const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
        newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: aPlayers.length === 0 ? 0 : FORFEIT_SCORE, winnerId };
        continue;
      }
      const { result: cupResult } = simulateMatch(
        { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
        hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season, undefined, hCupSquad.bench, aCupSquad.bench
      );

      // Resolve draws via extra time then penalties
      let hGoals = cupResult.homeGoals;
      let aGoals = cupResult.awayGoals;
      let penaltyShootout: { home: number; away: number } | undefined;
      const cupEvents = [...cupResult.events];
      if (hGoals === aGoals) {
        // Extra time: each side has a chance to score based on team strength
        const homeStr = hClub.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
        const awayStr = aClub.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
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
          // Penalties decide the winner but must NOT change the drawn scoreline —
          // the old hGoals++/aGoals++ corrupted cup history and disagreed with the
          // interactive path. The winner is recorded via winnerId below.
          cupEvents.push({ minute: 120, type: 'penalty_shootout', clubId: penHome > penAway ? tie.homeClubId : tie.awayClubId, description: `${penHome > penAway ? hClub.shortName : aClub.shortName} win on penalties (${penHome}-${penAway})!` });
        }
      }

      const cupWinnerId = penaltyShootout
        ? (penaltyShootout.home > penaltyShootout.away ? tie.homeClubId : tie.awayClubId)
        : (hGoals > aGoals ? tie.homeClubId : tie.awayClubId);
      newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals, penaltyShootout, winnerId: cupWinnerId };

      applyAIMatchEvents(cupResult.events, newPlayers, clubs, week, hPlayers, aPlayers, cupResult.homeGoals, cupResult.awayGoals, eloRankings, tie.homeClubId, tie.awayClubId);
      updateEloRatings(eloRankings, tie.homeClubId, tie.awayClubId, cupResult.homeGoals, cupResult.awayGoals, 'cup');

      // Cup match result message for player
      if (isPlayerMatch) {
        const isHome = tie.homeClubId === playerClubId;
        const won = cupWinnerId === playerClubId;
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
        const winnerId = finalTie.winnerId || (finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId);
        newCup.winner = winnerId;
        newCup.currentRound = null;
        if (winnerId === playerClubId) {
          newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'Cup Winners!', body: 'Congratulations! You have won the cup! The board and fans are ecstatic!' });
          newTimeline.push(createMilestone('cup_win', 'Cup Winners!', `Won the cup in Season ${season}!`, season, week, 'medal'));
        }
      } else {
        // Pass the post-training/development player map so GK quality
        // computation sees the freshest attributes rather than the
        // top-of-week snapshot.
        newCup = advanceCupRound(newCup, state.clubs, newPlayers, state.totalWeeks);
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
      const hLcSquad = pickAiMatchSquad(hClub, newPlayers, week);
      const aLcSquad = pickAiMatchSquad(aClub, newPlayers, week);
      const hPlayers = hLcSquad.xi;
      const aPlayers = aLcSquad.xi;

      const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
      if (isPlayerMatch && tie.week === week) continue; // Player's current-week league cup match is played interactively

      if (hPlayers.length === 0 || aPlayers.length === 0) {
        const winnerId = hPlayers.length === 0 ? tie.awayClubId : tie.homeClubId;
        newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hPlayers.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: aPlayers.length === 0 ? 0 : FORFEIT_SCORE, winnerId };
        continue;
      }
      const { result: lcResult } = simulateMatch(
        { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
        hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId), undefined, season, undefined, hLcSquad.bench, aLcSquad.bench
      );

      // League Cup: straight to penalties if drawn (no extra time in early rounds)
      const hGoals = lcResult.homeGoals;
      const aGoals = lcResult.awayGoals;
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
        // Penalties decide the winner without changing the drawn scoreline.
      }

      const lcWinnerId = penaltyShootout
        ? (penaltyShootout.home > penaltyShootout.away ? tie.homeClubId : tie.awayClubId)
        : (hGoals > aGoals ? tie.homeClubId : tie.awayClubId);
      newLeagueCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals, penaltyShootout, winnerId: lcWinnerId };
      applyAIMatchEvents(lcResult.events, newPlayers, clubs, week, hPlayers, aPlayers, lcResult.homeGoals, lcResult.awayGoals, eloRankings, tie.homeClubId, tie.awayClubId);
      updateEloRatings(eloRankings, tie.homeClubId, tie.awayClubId, lcResult.homeGoals, lcResult.awayGoals, 'cup');

      // League Cup match result message for player (orphaned past-week matches)
      if (isPlayerMatch) {
        const isHome = tie.homeClubId === playerClubId;
        const won = lcWinnerId === playerClubId;
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
        const winnerId = finalTie.winnerId || (finalTie.homeGoals > finalTie.awayGoals ? finalTie.homeClubId : finalTie.awayClubId);
        newLeagueCup.winner = winnerId;
        newLeagueCup.currentRound = null;
        if (winnerId === playerClubId) {
          newMessages = addMsg(newMessages, { week, season, type: 'board', title: 'League Cup Winners!', body: 'You have won the League Cup!' });
          newTimeline.push(createMilestone('cup_win', 'League Cup Winners!', `Won the League Cup in Season ${season}!`, season, week, 'medal'));
        }
      } else {
        newLeagueCup = advanceLeagueCupRound(newLeagueCup, state.totalWeeks);
      }
    }
  }

  // ── Domestic Super Cup Simulation ──
  let newDomesticSuperCup = state.domesticSuperCup;
  // `>=`, not `===`. Both Super Cup weeks are raw, unscaled constants (1 and 2)
  // while the cup / League Cup / continental calendars compress into the same
  // weeks in short seasons — and Super Cup is LAST in playCurrentMatchImpl's
  // priority. So in every league with totalWeeks <= 38 a colliding League Cup R1
  // outranked the Continental Super Cup, week 2 passed, `week === 2` was false
  // forever, and the fixture sat unplayed in state for the whole season: no
  // match, no trophy, no prize money. Cup, League Cup and continental all have
  // this catch-up already; the Super Cups were the only competitions without it.
  if (newDomesticSuperCup && !newDomesticSuperCup.played && week >= DOMESTIC_SUPER_CUP_WEEK) {
    const hClub = clubs[newDomesticSuperCup.homeClubId];
    const aClub = clubs[newDomesticSuperCup.awayClubId];
    const isPlayerMatch = newDomesticSuperCup.homeClubId === playerClubId || newDomesticSuperCup.awayClubId === playerClubId;
    if (!isPlayerMatch && hClub && aClub) {
      // AI simulation
      const hScSquad = pickAiMatchSquad(hClub, newPlayers, week);
      const aScSquad = pickAiMatchSquad(aClub, newPlayers, week);
      const hPlayers = hScSquad.xi;
      const hBenchSC = hScSquad.bench;
      const aPlayers = aScSquad.xi;
      const aBenchSC = aScSquad.bench;
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
  if (newContinentalSuperCup && !newContinentalSuperCup.played && week >= CONTINENTAL_SUPER_CUP_WEEK) {
    const hClub = clubs[newContinentalSuperCup.homeClubId] || (state.virtualClubs || {})[newContinentalSuperCup.homeClubId];
    const aClub = clubs[newContinentalSuperCup.awayClubId] || (state.virtualClubs || {})[newContinentalSuperCup.awayClubId];
    const isPlayerMatch = newContinentalSuperCup.homeClubId === playerClubId || newContinentalSuperCup.awayClubId === playerClubId;
    if (!isPlayerMatch && hClub && aClub) {
      // Continental Super Cup opponents can be virtual clubs with no squad, so
      // guard on `playerIds` before asking the picker for an XI.
      const hCscSquad = (hClub as Club).playerIds ? pickAiMatchSquad(hClub as Club, newPlayers, week) : { xi: [], bench: [] };
      const hPlayers = hCscSquad.xi;
      const hBenchCSC = hCscSquad.bench;
      const aCscSquad = (aClub as Club).playerIds ? pickAiMatchSquad(aClub as Club, newPlayers, week) : { xi: [], bench: [] };
      const aPlayers = aCscSquad.xi;
      const aBenchCSC = aCscSquad.bench;
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
  const continentalCalendar = getCompetitionCalendar(state.totalWeeks);
  const groupWeeks = continentalCalendar.groupWeeks;

  const continentalName = (comp: string): string =>
    comp === 'champions_cup' ? 'Champions Cup' : comp === 'shield_cup' ? 'Shield Cup' : 'Conference Cup';

  type ContinentalState = typeof newChampionsCup;

  // Group stage: process every matchday whose scheduled week has arrived.
  // PAST-DUE matchdays (scheduled week already behind us — a skipped week or
  // a same-week fixture collision where the domestic cup took priority) are
  // force-simmed INCLUDING the player's own match: leaving it unplayed
  // freezes getCurrentMatchday and hangs the tournament for the season.
  // The current week's matchday leaves the player's match for interactive play.
  const processContinentalGroupStage = (input: ContinentalState): ContinentalState => {
    if (!input || input.currentPhase !== 'group') return input;
    let t = input;
    let guard = 0;
    while (t && t.currentPhase === 'group' && guard++ < 10) {
      const md = getCurrentMatchday(t);
      const mdWeek = groupWeeks[md - 1];
      if (mdWeek === undefined || mdWeek > week) break;
      const isCurrentWeek = mdWeek === week;
      // '' = no club is exempt → the player's overdue match is auto-simmed.
      t = simulateGroupMatchday(t, md, virtualClubs, isCurrentWeek ? playerClubId : '');
      if (isGroupStageComplete(t)) {
        t = generateKnockoutFromGroups(t, playerClubId, state.totalWeeks);
        const compName = continentalName(t.competition);
        if (!t.playerEliminated) {
          newMessages = addMsg(newMessages, { week, season, type: 'board', title: `${compName} Knockout!`, body: `You have qualified for the ${compName} knockout rounds!` });
        } else {
          newMessages = addMsg(newMessages, { week, season, type: 'match_result', title: `${compName} Eliminated`, body: `You have been eliminated from the ${compName} group stage.` });
        }
      }
      if (isCurrentWeek) break; // player's match (if any) stays pending for interactive play
    }
    return t;
  };

  newChampionsCup = processContinentalGroupStage(newChampionsCup);
  newShieldCup = processContinentalGroupStage(newShieldCup);
  newConferenceCup = processContinentalGroupStage(newConferenceCup);

  // Knockout rounds — same catch-up principle: any leg whose scheduled week
  // has passed unplayed is force-simmed (player's tie included) so a missed
  // or collided week can delay a tie but never strand it.
  const processContinentalKnockout = (input: ContinentalState): ContinentalState => {
    if (!input || input.currentPhase !== 'knockout') return input;
    let t = input;
    let guard = 0;
    while (t.currentPhase === 'knockout' && t.currentRound && t.currentRound !== 'group' && guard++ < 12) {
      const round = t.currentRound as 'R16' | 'QF' | 'SF' | 'F';

      // Self-heal: a fully decided round that was never advanced (stale save).
      if (isKnockoutRoundComplete(t, round)) {
        t = advanceKnockoutRound(t, playerClubId, state.totalWeeks);
        continue;
      }

      const roundWeeks: readonly number[] =
        round === 'R16' ? continentalCalendar.r16Weeks
        : round === 'QF' ? continentalCalendar.qfWeeks
        : round === 'SF' ? continentalCalendar.sfWeeks
        : [continentalCalendar.finalWeek];
      const roundTies = t.knockoutTies.filter(kt => kt.round === round);
      if (roundTies.length === 0) break;
      const leg: 1 | 2 = round !== 'F' && roundTies.every(kt => kt.leg1Played) ? 2 : 1;
      const legWeek = roundWeeks[leg - 1] ?? roundWeeks[0];
      if (legWeek > week) break;

      const isCurrentWeek = legWeek === week;
      t = simulateKnockoutLeg(t, round, leg, virtualClubs, isCurrentWeek ? playerClubId : '');

      if (isKnockoutRoundComplete(t, round)) {
        const advanced = advanceKnockoutRound(t, playerClubId, state.totalWeeks);
        if (advanced.currentPhase === 'complete' && advanced.winnerId) {
          const compName = continentalName(t.competition);
          if (advanced.winnerId === playerClubId) {
            newMessages = addMsg(newMessages, { week, season, type: 'board', title: `${compName} Winners!`, body: `Incredible! You have won the ${compName}!` });
            newTimeline.push(createMilestone('cup_win', `${compName} Winners!`, `Won the ${compName} in Season ${season}!`, season, week, 'trophy'));
          }
        }
        t = advanced;
        if (t.currentPhase === 'complete') break;
      } else if (isCurrentWeek) {
        break; // player's tie pending interactive play this week
      }
      // Past-due leg forced: loop again — the next leg/round may also be due.
    }
    return t;
  };

  newChampionsCup = processContinentalKnockout(newChampionsCup);
  newShieldCup = processContinentalKnockout(newShieldCup);
  newConferenceCup = processContinentalKnockout(newConferenceCup);

  const newWeek = week + 1;
  const clubIds = Object.keys(clubs);
  const leagueTable = buildLeagueTable(updatedFixtures, state.divisionClubs[playerDiv] || clubIds);
  const transferWindows = getTransferWindows(state.totalWeeks);
  const transferWindowOpen = newWeek <= transferWindows.summerEnd || (newWeek >= transferWindows.winterStart && newWeek <= transferWindows.winterEnd);

  // Sync player's division fixtures back into divisionFixtures
  updatedDivisionFixtures[playerDiv] = updatedFixtures;

  // Simulate non-player initialized leagues. Player stats (goals, assists,
  // appearances, ratings) are recorded via applyAIMatchEvents so that
  // BdO/top-scorer/season-history calculations can reference players from
  // every league, not just the user's. Without this, La Liga / Bundesliga
  // / Ligue 1 stars never accumulate season output and BdO becomes a
  // single-league award by accident.
  for (const leagueId of Object.keys(state.divisionClubs)) {
    if (leagueId === playerDiv) continue;
    const leagueFixtures = updatedDivisionFixtures[leagueId];
    if (!leagueFixtures) continue;
    const updatedLeagueFixtures = [...leagueFixtures];
    for (let i = 0; i < updatedLeagueFixtures.length; i++) {
      const m = updatedLeagueFixtures[i];
      // `<= week`, not `=== week`: an AI fixture whose week slipped past
      // unplayed (mid-season collision, a save resumed mid-week) used to be
      // stranded forever, leaving that division's table permanently short.
      // `endSeasonImpl` now also fast-forwards anything still outstanding.
      if (m.week > week || m.played) continue;
      const hc = clubs[m.homeClubId];
      const ac = clubs[m.awayClubId];
      if (!hc || !ac) continue;
      const hp = pickAiMatchSquad(hc, newPlayers, week).xi;
      const ap = pickAiMatchSquad(ac, newPlayers, week).xi;
      if (hp.length === 0 || ap.length === 0) {
        updatedLeagueFixtures[i] = { ...m, played: true, homeGoals: hp.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap.length === 0 ? 0 : FORFEIT_SCORE, events: [] };
        continue;
      }
      const { result } = simulateMatch(m, hc, ac, hp, ap);
      updatedLeagueFixtures[i] = result;
      applyAIMatchEvents(result.events, newPlayers, clubs, week, hp, ap, result.homeGoals, result.awayGoals, eloRankings, m.homeClubId, m.awayClubId);
      updateEloRatings(eloRankings, m.homeClubId, m.awayClubId, result.homeGoals, result.awayGoals, 'league');
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
    const isDeadlineDay = newWeek === transferWindows.summerEnd || newWeek === transferWindows.winterEnd;

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
          const offer: IncomingOffer = { id: safeRandomUUID(), playerId: tp.id, buyerClubId: buyer.id, fee: offerFee, week: newWeek };
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
        // A player listed within the last few weeks cannot anchor AI bids above
        // what he is actually worth. Without this, buying at just under the
        // sell-on threshold and relisting at the UI's 2x cap was a repeatable
        // profit machine across every spare squad slot, every window — and an
        // ancient listing kept its original asking price forever, so AI clubs
        // bid ~8x a declining player's real value for seasons on end.
        const listedRecently = !!listing && listing.listedSeason === season
          && (newWeek - (listing.listedWeek ?? 0)) <= 4;
        const askingFloor = listing && !listedRecently ? listing.askingPrice * ASKING_PRICE_BID_ANCHOR : 0;
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
      // The generic "Next: vs X" preview duplicated the Dashboard next-match
      // card and MatchPrep — only derby fixtures get an inbox preview now.
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
      // Stamp the season so the cooldown in the trigger block below can expire
      // this marker. Bare ids (legacy saves) read as "long ago" and expire at once.
      newCompletedChainIds.push(`${chain.chainId}@${season}`);
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
    // Completion markers are stored as `chainId@season` so they can expire.
    // The field stays a string[] (no schema change); a legacy bare `chainId`
    // has no season and is treated as long past, which lets an existing save
    // whose storyline system had already gone dark start telling stories again.
    const chainCooldownUntil = new Map<string, number>();
    for (const marker of newCompletedChainIds) {
      const at = marker.lastIndexOf('@');
      const id = at >= 0 ? marker.slice(0, at) : marker;
      const doneSeason = at >= 0 ? Number(marker.slice(at + 1)) : Number.NEGATIVE_INFINITY;
      const until = Number.isFinite(doneSeason) ? doneSeason + STORYLINE_CHAIN_COOLDOWN_SEASONS : Number.NEGATIVE_INFINITY;
      // Keep the strictest (latest) cooldown if a chain somehow has two markers.
      chainCooldownUntil.set(id, Math.max(chainCooldownUntil.get(id) ?? Number.NEGATIVE_INFINITY, until));
    }

    // Collect EVERY eligible chain, then pick at random. The loop used to take
    // the first match in `STORYLINE_CHAINS` order, and the trigger predicates
    // overlap heavily (`injury-crisis` needs only `recentLosses >= 1 && week >= 5`,
    // `dressing-room-power-struggle` `>= 2 && week >= 8`), so early array entries
    // systematically won and every save told the same stories in the same order.
    const eligibleChains: typeof STORYLINE_CHAINS[number][] = [];
    for (const chainDef of STORYLINE_CHAINS) {
      if (season < (chainCooldownUntil.get(chainDef.id) ?? Number.NEGATIVE_INFINITY)) continue;
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
      if (triggered) eligibleChains.push(chainDef);
    }

    const chainDef = eligibleChains.length > 0 ? pick(eligibleChains) : null;
    if (chainDef) {
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
  if (newWeek === transferWindows.summerEnd - 1) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'Transfer Deadline Approaching', body: 'The summer transfer window closes next week. Finalise any deals now!' });
  if (newWeek === transferWindows.winterStart) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'January Window Opens', body: `The winter transfer window is now open until Week ${transferWindows.winterEnd}.` });
  if (newWeek === transferWindows.winterEnd - 1) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: 'Winter Deadline Approaching', body: 'The winter transfer window closes next week. Last chance for January deals!' });

  // ── Deadline Day Drama ──
  const deadlineBargains: TransferListing[] = [];
  const isDeadlineDay = newWeek === transferWindows.summerEnd || newWeek === transferWindows.winterEnd;
  if (isDeadlineDay) {
    const windowName = newWeek === transferWindows.summerEnd ? 'summer' : 'winter';

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
      newOffers.push({ id: safeRandomUUID(), playerId: target.id, buyerClubId: bidderId, fee: panicFee, week: newWeek });
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: `URGENT: Bid for ${target.lastName}`, body: `${bidder.name} have made a last-minute bid of £${(panicFee / 1e6).toFixed(1)}M for ${target.firstName} ${target.lastName}! Respond before the window closes.` });
      // Multi-bid: chance of a second club bidding for the same player
      if (Math.random() < DEADLINE_MULTI_BID_CHANCE) {
        const secondBidderId = aiClubIds.filter(id => id !== bidderId)[Math.floor(Math.random() * (aiClubIds.length - 1))];
        const secondBidder = secondBidderId ? clubs[secondBidderId] : null;
        if (secondBidder) {
          const rivalFee = Math.round(panicFee * 1.1); // 10% above first bid
          if (rivalFee <= secondBidder.budget * 0.6) {
            newOffers.push({ id: safeRandomUUID(), playerId: target.id, buyerClubId: secondBidderId, fee: rivalFee, week: newWeek });
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
      // Dedupe against this batch AND the live market — re-listing an
      // already-listed player would create a duplicate listing.
      const alreadyListed = deadlineBargains.some(l => l.playerId === toSell.id)
        || state.transferMarket.some(l => l.playerId === toSell.id);
      if (alreadyListed) continue;
      const bargainPrice = Math.round(toSell.value * (1 - DEADLINE_BARGAIN_DISCOUNT));
      // listedWeek/listedSeason stamps let processListingExpiry retire the
      // listing — unstamped listings live forever with frozen prices.
      deadlineBargains.push({ playerId: toSell.id, askingPrice: Math.max(100000, bargainPrice), sellerClubId: sellerId, listedWeek: newWeek, listedSeason: season });
    }
  }

  // Post-deadline summary (week after window closes)
  if (newWeek === transferWindows.summerEnd + 1 || newWeek === transferWindows.winterEnd + 1) {
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
        // Add scouted player to transfer market so user can sign via standard flow.
        // Stamped so processListingExpiry can retire the listing eventually.
        scoutedListings.push({
          playerId: p.id,
          askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)),
          sellerClubId,
          scoutedPlayer: true,
          listedWeek: newWeek,
          listedSeason: season,
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
  // Count assignments BEFORE dropping the completed ones — they were active this
  // week and must be billed. Filtering first made the final week of every
  // assignment free, and with the `scout_network` perk a 2-week domestic
  // assignment dropped 2 -> 0 on its first tick and completed before it was ever
  // billed: GBP 0, repeatable weekly, per scout, forever.
  const billableAssignmentCount = newScouting.assignments.length;
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
        // Focused prospects get a small dev gain bonus to encourage active management
        const focusBoost = (prospect.trainingFocus && prospect.trainingFocus !== 'balanced') ? 1.1 : 1;
        const devGain = (hasPerk(state.managerProgression, 'youth_developer') ? baseDevGain * (1 + YOUTH_DEVELOPER_BOOST * ydm + careerYouthMod) : baseDevGain * (1 + careerYouthMod)) * focusBoost;
        prospect.developmentScore = Math.min(100, prospect.developmentScore + devGain);
        // Focus biasing — 8% chance per week to nudge a focus-aligned attribute
        const focus = prospect.trainingFocus;
        if (focus && focus !== 'balanced' && Math.random() < 0.08) {
          type AttrKey = keyof PlayerAttributes;
          const attrPool: Record<'technical' | 'physical' | 'mental', AttrKey[]> = {
            technical: ['shooting', 'passing', 'mental'],
            physical: ['pace', 'physical', 'defending'],
            mental: ['mental', 'passing', 'defending'],
          };
          const attrs = attrPool[focus];
          const attr = attrs[Math.floor(Math.random() * attrs.length)];
          const before = yp.attributes[attr] ?? 0;
          if (before < yp.potential) {
            const newAttrs = { ...yp.attributes, [attr]: Math.min(yp.potential, before + 1) };
            // Use the position-weighted overall (not a flat 6-attribute mean) so a
            // prospect's displayed OVR matches what calculateOverall yields on promotion —
            // otherwise GKs were inflated ~7 points and appeared to "drop" once promoted.
            const newOverall = calculateOverall(newAttrs, yp.position);
            newPlayers[prospect.playerId] = { ...yp, attributes: newAttrs, overall: Math.max(yp.overall, newOverall) };
          }
        }
      }
      // Bust risk: low-potential prospects can lose potential permanently (1% per week)
      const bustChance = yp.potential < 55 ? 0.01 : yp.potential < 65 ? 0.005 : 0;
      if (Math.random() < bustChance) {
        const drop = 3 + Math.floor(Math.random() * 3); // lose 3-5 potential
        const ypUpdated = newPlayers[prospect.playerId] || yp;
        const bustedPlayer = { ...ypUpdated, potential: Math.max(ypUpdated.overall, ypUpdated.potential - drop) };
        newPlayers[prospect.playerId] = bustedPlayer;
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'development',
          title: `${yp.lastName} Stalling`,
          body: `Youth prospect ${yp.firstName} ${yp.lastName}'s development ceiling appears to have dropped. Potential now ${bustedPlayer.potential}.`,
        });
      }
      const ypFinal = newPlayers[prospect.playerId] || yp;
      prospect.readyToPromote = ypFinal.overall >= 55 || prospect.developmentScore >= 80;
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

  // Staff morale & weekly performance tick (extends the existing `newStaff`
  // from the mid-season market refresh block above).
  const moraleTickedMembers = newStaff.members.map(m => {
    const ensured = ensureStaffFields(m);
    let morale = ensured.morale ?? STAFF_DEFAULT_MORALE;
    const driftRate = (ensured.traits || []).includes('veteran')
      ? STAFF_MORALE_WEEKLY_DRIFT * 0.5
      : STAFF_MORALE_WEEKLY_DRIFT;
    if (morale > 50) morale = Math.max(50, morale - driftRate);
    else if (morale < 50) morale = Math.min(50, morale + driftRate);
    if ((ensured.traits || []).includes('motivator') && morale < 40) morale = 40;
    if (thisWeekMatch && thisWeekMatch.played) {
      const isHome = thisWeekMatch.homeClubId === playerClubId;
      const myScore = isHome ? thisWeekMatch.homeGoals : thisWeekMatch.awayGoals;
      const oppScore = isHome ? thisWeekMatch.awayGoals : thisWeekMatch.homeGoals;
      if (myScore > oppScore) morale = Math.min(100, morale + STAFF_MORALE_WIN_BONUS);
      else if (myScore < oppScore) morale = Math.max(0, morale - STAFF_MORALE_LOSS_PENALTY);
    }
    const perf = ensured.performance ?? { trainingGains: 0, youthPromotions: 0, scoutFinds: 0, injuriesPrevented: 0, weeksAtClub: 0 };
    return { ...ensured, morale, performance: { ...perf, weeksAtClub: perf.weeksAtClub + 1 } };
  });
  newStaff = { ...newStaff, members: moraleTickedMembers };
  const streakIncomeMult = currentWinStreak >= STREAK_INCOME_THRESHOLD ? 1 + STREAK_INCOME_MULTIPLIER : 1;
  // Matchday is GATE money: paid at 2x on home weeks and nothing otherwise, so
  // the season total is unchanged (every league plays exactly half its fixtures
  // at home) while the money becomes something real. It used to pay every week
  // including away games, byes and post-season. Both figures are also
  // league-tier scaled now — `fanBase` is a 0-100 popularity index, not a
  // headcount, and it only spans 41-54 across the English pyramid while wages
  // span 20x, so a League Two club was clearing more profit per week than
  // Arsenal. Commercial had the same problem: unscaled, it paid a tier-4 club
  // GBP 500k/wk, more than its wage bill.
  // Both live behind helpers shared with the Finance page so the displayed
  // breakdown can never drift from the money actually paid.
  // Home-gate on the SCHEDULE, not on a played league fixture.
  //
  // `thisWeekMatch` requires `m.played` and only scans league fixtures. Keying the
  // gate on it meant matchday income silently became GBP 0 whenever the player's
  // fixture wasn't a played league game — which is every cup and continental week,
  // and every week of an auto-simulated save. Measured over 5 seasons that drove
  // the player's own club to -GBP 242M with its wage bill collapsing from
  // GBP 3.9M to GBP 0.4M as the squad emptied. A gate is owed for being at home,
  // whatever competition you were at home in, and whether or not the fixture has
  // been resolved yet this tick.
  const isHomeFixture =
    updatedFixtures.some(m => m.week === week && m.homeClubId === playerClubId)
    || (newCup?.ties ?? []).some(t => t.week === week && t.homeClubId === playerClubId)
    || (newLeagueCup?.ties ?? []).some(t => t.week === week && t.homeClubId === playerClubId)
    || [newChampionsCup, newShieldCup, newConferenceCup].some(t => {
      if (!t) return false;
      const inGroup = (t.groups ?? []).some(g => (g.matches ?? []).some(m => m.week === week && m.homeClubId === playerClubId));
      if (inGroup) return true;
      return (t.knockoutTies ?? []).some(tie =>
        (tie.week1 === week && tie.homeClubId === playerClubId)
        || (tie.week2 === week && tie.round !== 'F' && tie.awayClubId === playerClubId));
    })
    || (newDomesticSuperCup?.week === week && newDomesticSuperCup.homeClubId === playerClubId)
    || (newContinentalSuperCup?.week === week && newContinentalSuperCup.homeClubId === playerClubId);
  const matchdayIncome = getMatchdayIncome(playerClub, playerDiv, {
    fanMood: fanMoodMult, derby: derbyIncomeBonus, streak: streakIncomeMult, isHomeFixture,
  });
  const commercialIncome = getCommercialIncome(playerClub, playerDiv);
  // League position prize money: higher position = more income, scaled by tier
  const playerTableIdx = leagueTable.findIndex(e => e.clubId === playerClubId);
  const playerTablePos = playerTableIdx >= 0 ? playerTableIdx + 1 : leagueTable.length;
  const playerLeagueInfo = LEAGUES.find(l => l.id === playerDiv);
  // Single shared prize function (also used by the finance breakdown) so the
  // displayed "League Position" line always matches the money paid here.
  const positionPrize = getLeaguePositionPrize(playerTablePos, leagueTable.length, playerLeagueInfo?.tier);
  // Sponsorship: sum of active sponsor deals
  const sponsorIncome = state.sponsorDeals.reduce((sum, d) => sum + d.weeklyPayment, 0);
  // Merchandise: strategic system with product lines, pricing, campaigns, star players
  const merchandiseIncome = calculateWeeklyMerchRevenue(
    state.merchandise, playerClub, state.players, state.playerDivision, state.managerProgression
  );
  const weeklyIncome = matchdayIncome + commercialIncome + stadiumIncome + positionPrize + sponsorIncome + merchandiseIncome;
  const staffWages = staff.members.reduce((sum, s) => sum + s.wage, 0);
  // Scouting costs: each active assignment costs money per week
  const scoutingCosts = billableAssignmentCount * SCOUTING_COST_PER_ASSIGNMENT;
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
  // One shared definition with the Finance page. They used to disagree: the
  // engine measured TOTAL expenses with merch net, the page measured the player
  // wage bill alone with merch gross against hardcoded thresholds — so a player
  // could read "62% - Healthy" while the board docked confidence every week.
  const wageToRevenueRatio = assessFfp(totalExpenses, weeklyIncome).ratio;
  if (wageToRevenueRatio >= FFP_WAGE_RATIO_CRITICAL) {
    newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence - FFP_CRITICAL_CONFIDENCE_PENALTY);
    if (newWeek % 4 === 0) {
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'FFP: Critical Warning!', body: `Your total weekly costs are ${Math.round(wageToRevenueRatio * 100)}% of revenue. The board demands immediate action to reduce spending or face severe consequences.` });
    }
  } else if (wageToRevenueRatio >= FFP_WAGE_RATIO_WARNING) {
    newBoardConfidence = Math.max(CONFIDENCE_MIN, newBoardConfidence - FFP_CONFIDENCE_PENALTY);
    if (newWeek % 8 === 0) {
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'FFP: Spending Warning', body: `Your total weekly costs are ${Math.round(wageToRevenueRatio * 100)}% of revenue. The board urges you to manage finances more carefully.` });
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
  // Decrement signature drop timer
  if (newMerch.signatureDrop && newMerch.signatureDrop.weeksRemaining > 0) {
    const remaining = newMerch.signatureDrop.weeksRemaining - 1;
    if (remaining <= 0) {
      newMessages = addMsg(newMessages, {
        week: newWeek, season, type: 'general',
        title: `Signature Drop Ended`,
        body: `${newMerch.signatureDrop.playerName}'s signature line has finished its run.`,
      });
      newMerch.signatureDrop = null;
      // Apply the standard cooldown after a natural end so back-to-back
      // drops aren't free relative to manual cancellation.
      newMerch.signatureDropCooldownWeeks = SIGNATURE_DROP_COOLDOWN_WEEKS;
    } else {
      newMerch.signatureDrop = { ...newMerch.signatureDrop, weeksRemaining: remaining };
    }
  }
  if ((newMerch.signatureDropCooldownWeeks ?? 0) > 0) {
    newMerch.signatureDropCooldownWeeks = (newMerch.signatureDropCooldownWeeks ?? 0) - 1;
  }
  // Decrement derby buzz
  if ((newMerch.derbyBuzzWeeks ?? 0) > 0) newMerch.derbyBuzzWeeks = (newMerch.derbyBuzzWeeks ?? 0) - 1;
  // Apply derby buzz when player just played a derby
  if (thisWeekMatch && derbyIncomeIntensity > 0) {
    newMerch.derbyBuzzWeeks = Math.max(newMerch.derbyBuzzWeeks ?? 0, 2); // 2 weeks of buzz
  }
  // Update win streak: only fire on player league/cup matches the player participated in
  if (thisWeekMatch && thisWeekMatch.played) {
    const isHome = thisWeekMatch.homeClubId === playerClubId;
    const myScore = isHome ? thisWeekMatch.homeGoals : thisWeekMatch.awayGoals;
    const oppScore = isHome ? thisWeekMatch.awayGoals : thisWeekMatch.homeGoals;
    if (myScore > oppScore) newMerch.winStreak = (newMerch.winStreak ?? 0) + 1;
    else newMerch.winStreak = 0;
  }
  // Apply pricing fan mood impact
  const pricingMoodDelta = MERCH_PRICING_TIERS[newMerch.pricingTier].fanMoodImpact;
  const cultHeroFloor = hasPerk(state.managerProgression, 'cult_hero') ? 40 : 0;
  const merchFanMood = Math.max(cultHeroFloor, Math.min(100, state.fanMood + pricingMoodDelta));

  // Process sponsorship system (offers, satisfaction, new deals)
  // Sponsor satisfaction must react to THIS week's league fixture, not the
  // ambient `currentMatchResult` (which can be a cup tie or a stale result
  // from an earlier week). `thisWeekMatch` is the player's league fixture
  // and carries the same homeClubId/homeGoals/awayGoals shape.
  const sponsorUpdates = processSponsorWeek({ ...state, week: newWeek, clubs: newClubs, messages: newMessages, currentMatchResult: thisWeekMatch && thisWeekMatch.played ? thisWeekMatch : null });
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
      // The celebration modal (pendingAchievementIds) and Trophy Cabinet cover
      // this — no inbox card on top.
    }
  }

  // Challenge mode: check for mid-season failure (e.g., Invincibles losing a match)
  let updatedChallenge = state.activeChallenge;
  if (updatedChallenge && !updatedChallenge.completed && !updatedChallenge.failed) {
    const myEntry = leagueTable.find(e => e.clubId === playerClubId);
    const hasLost = myEntry ? myEntry.lost > 0 : false;
    const homeLost = updatedFixtures.some(m => m.played && m.homeClubId === playerClubId && m.homeGoals < m.awayGoals);
    if (checkChallengeFailed(updatedChallenge.scenarioId, updatedChallenge.seasonsRemaining, playerPos, hasLost, { homeLost })) {
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
    // Weekly playing chance scales with player quality vs loan club level:
    // a player at or above the loan club's level is a guaranteed starter
    // (HIGH chance); one below it fights for minutes (LOW). The comparison
    // was inverted, giving over-qualified loanees the LOW chance.
    const playChance = loanedPlayer.overall >= (loanClub.reputation * LOAN_QUALITY_FORMULA_REP_MULT + LOAN_QUALITY_FORMULA_BASE) ? LOAN_PLAY_CHANCE_HIGH : LOAN_PLAY_CHANCE_LOW;
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
          // Shared helper — same pricing model as training and development.
          recomputePlayerValueOnly(lp);
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

  // ── Board ultimatum (G3): mid-season pressure with real consequences ──
  // Issued at a review week when confidence is critically low; evaluated at
  // the deadline. Failure sacks the manager mid-season in career mode (via
  // the existing job-market machinery) or strips budget in sandbox. World Cup
  // mode has no board. Season 1 has a grace window so new players can settle.
  let newBoardUltimatum = state.boardUltimatum;
  let ultimatumSackPending = false;
  if (state.gameMode !== 'world-cup') {
    // Safety: an ultimatum never crosses seasons (seasonEnd also clears it).
    if (newBoardUltimatum && newBoardUltimatum.issuedSeason !== season) newBoardUltimatum = null;
    const ultimatumPos = playerTableIdx >= 0 ? playerTableIdx + 1 : (leagueTable.length || 20);

    if (!newBoardUltimatum
        && BOARD_REVIEW_WEEKS.includes(newWeek)
        && newBoardConfidence <= ULTIMATUM_CONFIDENCE_THRESHOLD
        && !(season === 1 && newWeek < ULTIMATUM_SEASON1_GRACE_WEEK)) {
      const expected = getExpectedPosition(playerClub.reputation);
      const target = Math.min(leagueTable.length || 20, expected + ULTIMATUM_POSITION_TOLERANCE);
      newBoardUltimatum = {
        issuedSeason: season, issuedWeek: newWeek,
        deadlineWeek: newWeek + ULTIMATUM_HORIZON_WEEKS, targetPosition: target,
      };
      newMessages = addMsg(newMessages, {
        week: newWeek, season, type: 'board', title: 'Board Ultimatum',
        body: `The board has lost patience. Reach ${target}${getSuffix(target)} place (or restore their confidence in you) by week ${newBoardUltimatum.deadlineWeek}, or ${state.gameMode === 'career' ? 'you will be dismissed' : 'face severe consequences'}. Currently ${ultimatumPos}${getSuffix(ultimatumPos)}.`,
      });
    } else if (newBoardUltimatum && newWeek >= newBoardUltimatum.deadlineWeek) {
      const survived = ultimatumPos <= newBoardUltimatum.targetPosition
        || newBoardConfidence >= ULTIMATUM_SURVIVE_CONFIDENCE;
      if (survived) {
        newBoardConfidence = Math.min(100, newBoardConfidence + ULTIMATUM_SURVIVE_CONFIDENCE_BONUS);
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'board', title: 'Ultimatum: Reprieve',
          body: `The board acknowledges the turnaround. Sitting ${ultimatumPos}${getSuffix(ultimatumPos)}, you have bought yourself time — do not waste it.`,
        });
      } else if (state.gameMode === 'career' && state.careerManager?.contract) {
        // Executed after the main set() so the sack acts on committed state.
        ultimatumSackPending = true;
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'board', title: 'Sacked',
          body: `${ultimatumPos}${getSuffix(ultimatumPos)} place was not the recovery the board demanded. Your contract has been terminated with immediate effect.`,
        });
      } else {
        const pc = newClubs[playerClubId];
        newClubs[playerClubId] = { ...pc, budget: Math.round(pc.budget * (1 - ULTIMATUM_SANDBOX_BUDGET_CUT)) };
        newBoardConfidence = Math.max(newBoardConfidence, ULTIMATUM_SANDBOX_CONFIDENCE_FLOOR);
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'board', title: 'Ultimatum: Consequences',
          body: `The board's demands were not met. Transfer funds have been slashed by ${Math.round(ULTIMATUM_SANDBOX_BUDGET_CUT * 100)}% and your position remains under review.`,
        });
      }
      newBoardUltimatum = null;
    }
  }

  // Evaluate monthly objectives — mark completions every week, cycle every OBJECTIVE_CYCLE_WEEKS weeks
  const objCtx: ObjectiveContext = {
    playerClubId, players: newPlayers, playerIds: playerClub.playerIds,
    fixtures: updatedFixtures, leagueTable, week, season, lineup: playerClub.lineup,
    // Include every match source so match-based objectives count
    // pre-season friendlies, cup ties, and continental matches —
    // not just league fixtures. Was a real bug ("Goal Fest 0/3"
    // after a 5-goal friendly because the friendly was invisible).
    friendlies: state.friendlies,
    cupTies: newCup?.ties,
    leagueCupTies: newLeagueCup?.ties,
    championsCup: state.championsCup,
    shieldCup: state.shieldCup,
    conferenceCup: state.conferenceCup,
    domesticSuperCup: state.domesticSuperCup,
    continentalSuperCup: state.continentalSuperCup,
  };
  const currentStreak = state.objectiveStreak || 0;
  const objStartWeek = state.objectivesStartWeek || 1;
  const monthComplete = (newWeek - objStartWeek) >= OBJECTIVE_CYCLE_WEEKS;

  // Evaluate objectives — completion is detected here, but base XP is now
  // CLAIMED by the player on the dashboard (claimObjective), not auto-granted.
  // A newly-completed objective is left { completed: true, claimed: false }.
  const { updated: evalObjectives } = evaluateObjectives(state.weeklyObjectives, objCtx, currentStreak);

  let updatedProgression = state.managerProgression;
  if (achievementXPTotal > 0) {
    updatedProgression = grantXP(updatedProgression, achievementXPTotal);
  }

  let newObjectives = evalObjectives;
  let newObjectivesStartWeek = objStartWeek;
  let finalStreak = currentStreak;
  let monthBonusXP = 0;
  // XP paid out by the month-reset safety net for objectives the player
  // completed but never claimed (tracked for session-stats accounting).
  let objectiveSafetyNetXP = 0;

  if (monthComplete) {
    // Month is over — award bonus XP (all-complete + streak extra). Base XP
    // is paid when the player claims each objective, or by the safety net below.
    const { xpEarned: bonusXP, allCompleted: objAllCompleted, newStreak } = calculateCompletedXP(evalObjectives, currentStreak);
    monthBonusXP = bonusXP;
    if (bonusXP > 0) {
      updatedProgression = grantXP(updatedProgression, bonusXP);
    }
    const completedCount = evalObjectives.filter(o => o.completed).length;
    // Only send an inbox message when there's something notable — bonus XP earned, streak info, or streak broken
    const streakBroken = currentStreak >= 2 && newStreak === 0;
    if (bonusXP > 0 || streakBroken) {
      let objMsg: string;
      if (objAllCompleted) {
        objMsg = `PERFECT MONTH — all ${evalObjectives.length} objectives complete! +${bonusXP} bonus XP earned.`;
        if (newStreak >= 3) objMsg += ` Streak x${newStreak} — bonus multiplier active next month!`;
      } else {
        objMsg = `${completedCount}/${evalObjectives.length} objectives completed. Any unclaimed rewards were paid out automatically.`;
        if (streakBroken) objMsg += ` Your ${currentStreak}-month streak has ended — complete all objectives next month to start a new one.`;
      }
      newMessages = addMsg(newMessages, {
        week: newWeek, season, type: 'general',
        title: `Monthly Objectives: ${completedCount}/${evalObjectives.length} Complete`,
        body: objMsg,
      });
    }
    finalStreak = newStreak;
    // Safety net: pay out any completed objectives the player never claimed
    // before the month resets, so a deferred reward is never silently lost.
    objectiveSafetyNetXP = evalObjectives.reduce(
      (sum, o) => sum + (o.completed && !o.claimed ? objectiveClaimXP(o) : 0), 0,
    );
    if (objectiveSafetyNetXP > 0) {
      updatedProgression = grantXP(updatedProgression, objectiveSafetyNetXP);
    }
    const nextWeekHasMatch = updatedFixtures.some(m => !m.played && m.week === newWeek && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    newObjectives = generateMonthlyObjectives(nextWeekHasMatch);
    newObjectivesStartWeek = newWeek;
  }

  // Generate cliffhangers for "one more week" pull
  const cliffhangers = generateCliffhangers({
    playerClubId, players: newPlayers, clubs: newClubs,
    fixtures: updatedFixtures, leagueTable, week: newWeek, season,
    totalWeeks: state.totalWeeks,
    boardConfidence: newBoardConfidence,
    transferWindowOpen,
    rivalries: state.rivalries,
  });

  // Update session stats
  const prevSession = state.sessionStats || { startWeek: week, startSeason: season, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 };
  const newlyCompleted = evalObjectives.filter(o => o.completed).length - state.weeklyObjectives.filter(o => o.completed).length;
  const sessionStats = {
    ...prevSession,
    weeksPlayed: prevSession.weeksPlayed + 1,
    xpEarned: prevSession.xpEarned + objectiveSafetyNetXP + monthBonusXP + achievementXPTotal,
    objectivesCompleted: prevSession.objectivesCompleted + Math.max(0, newlyCompleted),
  };

  // Compute digest
  const newAvgMorale = (() => {
    const ids = playerClub.playerIds;
    if (ids.length === 0) return 0;
    return Math.round(ids.reduce((s, id) => s + (newPlayers[id]?.morale || 0), 0) / ids.length);
  })();
  const digestOffersReceived = newOffers.length - state.incomingOffers.length;

  // Quiet weeks stay quiet: the WeeklyDigest is the guaranteed weekly beat,
  // so no filler narrative message is manufactured for the inbox anymore.

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

  const digestObjectiveProgress = evalObjectives.map(obj => {
    const rarityMult = obj.rarity === 'legendary' ? LEGENDARY_OBJECTIVE_XP_MULTIPLIER
      : obj.rarity === 'rare' ? RARE_OBJECTIVE_XP_MULTIPLIER : 1;
    return {
      title: obj.title,
      completed: obj.completed,
      xpEarned: obj.completed ? obj.xpReward * rarityMult : 0,
    };
  });

  set({
    week: newWeek, fixtures: updatedFixtures, players: newPlayers,
    leagueTable, transferWindowOpen, currentMatchResult: null,
    matchPhase: 'none' as const, pendingPressConference: null,
    messages: newMessages, incomingOffers: newOffers, clubs: newClubs,
    matchSubsUsed: 0, matchSubbedOffIds: [], matchGamePlan: 'none' as const, boardConfidence: newBoardConfidence, boardUltimatum: newBoardUltimatum, boardObjectives: updatedObjectives,
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

  // Failed board ultimatum in career mode — dismiss via the job-market
  // machinery, acting on the committed post-advance state.
  if (ultimatumSackPending) get().sackManagerMidSeason();

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
                id: safeRandomUUID(),
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

      // Scouting: grows when scout reports were generated this tick. Reports are stamped
      // with newWeek by completeAssignment, so filter on newWeek (was `week`, always 0 → no growth).
      const scoutReports = careerState.scouting.reports.filter(r => r.week === newWeek);
      if (scoutReports.length > 0) {
        cm.attributes.scoutingEye = Math.min(STAT_MAX, cm.attributes.scoutingEye + GROWTH_SCOUTING_PER_ASSIGNMENT * scoutReports.length);
      }

      // Discipline: grows when the last match had no cards for player's team
      const lastMatch = careerState.fixtures.find(m => m.week === week && m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
      if (lastMatch) {
        const playerTeamCards = (lastMatch.events || []).filter(e =>
          (e.type === 'yellow_card' || e.type === 'red_card') && e.clubId === playerClubId
        );
        // Matches the retuned Fair Play objective: no red, at most one booking.
        // The old zero-cards condition fired ~3x less often after cards rose to
        // real-football volume, so the manager's discipline stat grew ~3x slower
        // for no design reason.
        const reds = playerTeamCards.filter(e => e.type === 'red_card').length;
        const yellows = playerTeamCards.length - reds;
        if (reds === 0 && yellows <= 1) {
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

      // NOTE: no unemployed handling here — unemployed career managers
      // (cm.contract == null) take the dedicated early-return path at the
      // top of advanceWeekImpl and never reach this block, and nothing in
      // the main flow nulls the contract mid-tick.

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

  // Community pack market refresh (rotate out 20 stale external listings, draw
  // 20 fresh ones) — extracted to communityPackRuntime.ts to keep the game loop
  // readable. Behaviour-guarded by communityPackRuntime.test.ts.
  await refreshCommunityPackMarket(set, get);

  // CP FA-pool season-start seed (Phase E.7) — extracted to
  // communityPackRuntime.ts. Behaviour-guarded by communityPackFaSeed.test.ts.
  await seedCommunityPackFreeAgents(set, get);

  // Auto-save after advancing week
  if (get().settings.autoSave) get().saveGame();
}
