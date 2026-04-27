import * as Sentry from '@sentry/react';
import { Club, Player, TransferListing, SeasonHistory, Position, Match, LeagueId, SeasonTurnover, LeagueTableEntry } from '@/types/game';
import { calculateReputationTier, generateJobVacancies, getRetirementAge, calculateLegacyScore, generateCompetitors } from '@/utils/managerCareer';
import {
  REP_PROMOTION, REP_RELEGATION, REP_OVERACHIEVE_BONUS, REP_UNDERACHIEVE_PENALTY, REP_TITLE, REP_CUP_WIN, REP_SACKING, REP_MIN, REP_MAX,
} from '@/config/managerCareer';
import { buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, LEAGUES, generateFriendlies, getLeaguesByCountry } from '@/data/league';
import { BOARD_OBJ_ALL_COMPLETE_XP, BOARD_OBJ_ALL_COMPLETE_CONFIDENCE } from '@/config/gameBalance';
import { generateSquad, selectBestLineup, generatePlayer } from '@/utils/playerGen';

import { generateStaffMarket, getStaffBonus, ensureStaffFields } from '@/utils/staff';

import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../../storeTypes';
import { addMsg, pick, shuffle } from '@/utils/helpers';

import { addGameBreadcrumb } from '@/utils/sentry';
import { track } from '@/utils/analytics';

import { generateCupDraw, getCupResultForClub } from '@/data/cup';
import { getChampionsCupQualifiers, getShieldCupQualifiers, getConferenceCupQualifiers, generateContinentalDraw } from '@/data/continentalDraw';
import { updateCoefficients } from '@/utils/continentalCoefficients';
import { getContinentalResultForClub } from '@/utils/continental';
import { DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK, REP_CHAMPIONS_CUP_WIN, REP_SHIELD_CUP_WIN, REP_CONFERENCE_CUP_WIN, REP_LEAGUE_CUP_WIN, REP_CONTINENTAL_GROUP, REP_CONTINENTAL_KNOCKOUT } from '@/config/continental';

import { checkChallengeComplete, CHALLENGES } from '@/data/challenges';
import { calculateSeasonAwards } from '@/utils/seasonAwards';
import { calculateBallonDOr, getBallonDOrValueBoost } from '@/utils/ballonDor';

import { createEmptyRecords, updateRecords, findBiggestWin } from '@/utils/records';
import { getFarewellSummary } from '@/utils/playerNarratives';

import {
  TOTAL_WEEKS, CONFIDENCE_MIN, SEASON_END_CONFIDENCE, MIN_SQUAD_SIZE, MAX_SQUAD_SIZE, REPLACEMENT_QUALITY_REP_MULTIPLIER, REPLACEMENT_QUALITY_BASE, REPLACEMENT_QUALITY_VARIANCE, GENERIC_FILL_POSITIONS, LISTING_PRICE_MIN_MULTIPLIER, LISTING_PRICE_RANDOM_RANGE, INITIAL_LISTINGS_MIN, INITIAL_LISTINGS_RANGE, SEASON_YOUTH_INTAKE_MIN, SEASON_YOUTH_INTAKE_RANGE, getExpectedPosition, GOLDEN_GEN_MIN_POTENTIAL, FREE_AGENT_POOL_MAX,
} from '@/config/gameBalance';

import { generateInitialMarket, generatePreSeasonMarket } from '@/utils/transferMarketGen';

import {
  VERDICT_EXCELLENT_OFFSET, VERDICT_ACCEPTABLE_OFFSET, BOARD_SACKING_THRESHOLD,
} from '@/config/playoffs';
import { resetSeasonGrowth } from '@/store/helpers/development';
import { applySeasonTurnover, applyPromotionRelegation, generateReplacementClub } from '@/utils/promotionRelegation';

import { getTournamentForSeason, generateTournament, autoSelectNationalSquad, generateNationalTeamPool } from '@/utils/international';
import { NATIONAL_CALLUP_MORALE_BOOST, NT_JOB_REHIRE_REPUTATION, NT_JOB_OFFER_DURATION_WEEKS } from '@/config/gameBalance';

import { generateMonthlyObjectives } from '@/utils/weeklyObjectives';

import { generateAIManagerProfile } from '@/config/aiManager';

import { createMilestone } from '@/utils/milestones';
import { grantXP, XP_REWARDS, hasPerk } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';

import { processSponsorSeasonEnd } from '@/store/slices/sponsorSlice';
import {
  generateObjectives,
} from '@/store/slices/orchestration/helpers';
import {
  generateLeagueCupDraw,
} from '@/store/slices/orchestration/tournaments';

/**
 * Season-end pipeline extracted from orchestrationSlice.ts.
 *
 * `endSeasonImpl` is invoked from the slice's `endSeason` action; it
 * computes the season summary, awards, and Ballon d'Or rankings, then
 * delegates to `finalizeSeason` for the heavy turnover work (squad
 * regeneration, contract churn, fixture roll-over, board reset, etc.).
 * Both functions take `(set, get)` so they remain stateless w.r.t.
 * module-level state.
 */

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export function endSeasonImpl(set: Set, get: Get) {
  const state = get();
  const { season, leagueTable, players, clubs, playerClubId, boardConfidence, messages } = state;
  const playerDiv = state.playerDivision;
  const league = LEAGUES.find(l => l.id === playerDiv);

  const playerEntry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = playerEntry ? leagueTable.indexOf(playerEntry) + 1 : 20;

  addGameBreadcrumb('season_end', 'Season ended', {
    season,
    division: playerDiv,
    finalPosition: pos,
    boardConfidence,
  });
  track('season_completed', { season, finalPosition: pos, division: playerDiv });

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

  // Apply promotion/relegation across all tiers in the player's country
  const countryId = league?.countryId || playerDiv;
  const countryLeagues = getLeaguesByCountry(countryId);
  const hasMultipleTiers = countryLeagues.length > 1;

  // Build final tables for all loaded divisions in this country
  const finalDivisionTables: Record<string, LeagueTableEntry[]> = {};
  for (const cl of countryLeagues) {
    if (state.divisionClubs[cl.id]?.length) {
      finalDivisionTables[cl.id] = buildLeagueTable(
        state.divisionFixtures[cl.id] || [],
        state.divisionClubs[cl.id] || []
      );
    }
  }

  let workingClubs = { ...clubs };
  const workingPlayers = { ...players, ...ballonDOrPlayers };
  let newDivisionClubs = { ...state.divisionClubs };
  let newPlayerDiv = playerDiv;
  const turnover: SeasonTurnover = { leagueId: playerDiv, promotedClubs: [], relegatedClubs: [], playoffWinners: [] };

  if (hasMultipleTiers) {
    // Real promotion/relegation between tiers
    const proRelResult = applyPromotionRelegation(
      countryId, state.divisionClubs, finalDivisionTables, clubs, playerClubId,
    );
    workingClubs = proRelResult.updatedClubs;
    newDivisionClubs = { ...state.divisionClubs, ...proRelResult.updatedDivisionClubs };
    if (proRelResult.playerNewDivision) {
      newPlayerDiv = proRelResult.playerNewDivision;
    }

    // Merge turnovers for the player's current division
    const playerTurnover = proRelResult.turnovers[playerDiv];
    if (playerTurnover) {
      turnover.promotedClubs = playerTurnover.promotedClubs;
      turnover.relegatedClubs = playerTurnover.relegatedClubs;
      turnover.playoffWinners = playerTurnover.playoffWinners;
    }

    // Generate replacement clubs for bottom-tier relegated clubs
    for (const cl of countryLeagues) {
      const clTurnover = proRelResult.turnovers[cl.id];
      if (!clTurnover) continue;
      // Bottom tier: relegated clubs need procedural replacements
      const isBottomTier = !countryLeagues.some(l => l.tier === cl.tier + 1);
      if (isBottomTier && clTurnover.relegatedClubs.length > 0) {
        for (const replacedId of clTurnover.relegatedClubs) {
          const rClub = workingClubs[replacedId] || clubs[replacedId];
          if (rClub) {
            rClub.playerIds.forEach(pid => { delete workingPlayers[pid]; });
          }
          delete workingClubs[replacedId];

          const { clubData, clubId } = generateReplacementClub(season, cl.id);
          const newClub: Club = {
            id: clubId, name: clubData.name, shortName: clubData.shortName,
            color: clubData.color, secondaryColor: clubData.secondaryColor,
            budget: clubData.budget, wageBill: 0, reputation: clubData.reputation,
            facilities: clubData.facilities, youthRating: clubData.youthRating,
            fanBase: clubData.fanBase, boardPatience: clubData.boardPatience,
            playerIds: [], formation: '4-4-2', lineup: [], subs: [],
            divisionId: cl.id,
          };
          // generateSquad's `divisionTier` param is the league id used to
          // bias filler nationality distribution (e.g. 'eng', 'eng-2'),
          // not the numeric qualityTier (1–4). Passing the number drops
          // the league-aware bias into the DEFAULT distribution bucket.
          const squad = generateSquad(clubId, clubData.squadQuality, season, cl.id);
          let totalWages = 0;
          squad.forEach(p => { workingPlayers[p.id] = p; newClub.playerIds.push(p.id); totalWages += p.wage; });
          newClub.wageBill = totalWages;
          const { lineup: newLineup, subs: newSubs } = selectBestLineup(squad, '4-4-2');
          newClub.lineup = newLineup.map(p => p.id);
          newClub.subs = newSubs.map(p => p.id);
          newClub.aiManagerProfile = generateAIManagerProfile(clubId, clubData.reputation);
          workingClubs[clubId] = newClub;
          newDivisionClubs[cl.id] = newDivisionClubs[cl.id].filter(id => id !== replacedId);
          newDivisionClubs[cl.id].push(clubId);
        }
      }
    }
  } else {
    // Single-tier fallback: use old replacement system
    const finalTable = buildLeagueTable(state.divisionFixtures[playerDiv] || [], state.divisionClubs[playerDiv] || []);
    const singleResult = applySeasonTurnover(playerDiv, state.divisionClubs[playerDiv] || [], finalTable, clubs);
    workingClubs = { ...singleResult.updatedClubs };
    if (!workingClubs[playerClubId] && clubs[playerClubId]) {
      workingClubs[playerClubId] = clubs[playerClubId];
    }
    turnover.relegatedClubs = singleResult.turnover.relegatedClubs;
    // Clean up players from replaced clubs
    for (const replacedId of turnover.relegatedClubs) {
      const rClub = workingClubs[replacedId] || clubs[replacedId];
      if (rClub) rClub.playerIds.forEach(pid => { delete workingPlayers[pid]; });
    }
    const newLeagueClubs = [...singleResult.updatedLeagueClubs];
    if (!newLeagueClubs.includes(playerClubId)) newLeagueClubs.push(playerClubId);
    for (let i = 0; i < turnover.relegatedClubs.length; i++) {
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
      // Pass league id (not numeric qualityTier) so generateSquad picks
      // an appropriate nationality distribution bucket for the country.
      const squad = generateSquad(clubId, clubData.squadQuality, season, playerDiv);
      let totalWages = 0;
      squad.forEach(p => { workingPlayers[p.id] = p; newClub.playerIds.push(p.id); totalWages += p.wage; });
      newClub.wageBill = totalWages;
      const { lineup: rl, subs: rs } = selectBestLineup(squad, '4-4-2');
      newClub.lineup = rl.map(p => p.id);
      newClub.subs = rs.map(p => p.id);
      newClub.aiManagerProfile = generateAIManagerProfile(clubId, clubData.reputation);
      workingClubs[clubId] = newClub;
      newLeagueClubs.push(clubId);
    }
    newDivisionClubs = { ...state.divisionClubs, [playerDiv]: newLeagueClubs };
  }

  // Validate post-promotion state: player club must exist in its new division
  if (hasMultipleTiers && !newDivisionClubs[newPlayerDiv]?.includes(playerClubId)) {
    // Safety: force player club into their division if promo/relegation logic failed
    Sentry.captureMessage(`Post-promotion validation: ${playerClubId} not found in ${newPlayerDiv}, adding manually`);
    if (!newDivisionClubs[newPlayerDiv]) newDivisionClubs[newPlayerDiv] = [];
    newDivisionClubs[newPlayerDiv].push(playerClubId);
  }

  // Track promotion/relegation in season history
  if (hasMultipleTiers && newPlayerDiv !== playerDiv) {
    const newLeague = LEAGUES.find(l => l.id === newPlayerDiv);
    const isPromoted = !!(newLeague && newLeague.tier < (league?.tier || 1));
    const isRelegated = !!(newLeague && newLeague.tier > (league?.tier || 1));
    history.promoted = isPromoted;
    history.replaced = isRelegated;
  } else {
    history.promoted = false;
    history.replaced = false;
  }

  let newMessages = [...messages];

  // Generate promotion/relegation messages
  if (hasMultipleTiers) {
    if (newPlayerDiv !== playerDiv) {
      const newLeague = LEAGUES.find(l => l.id === newPlayerDiv);
      const title = history.promoted ? 'Promoted!' : 'Relegated';
      const body = history.promoted
        ? `Congratulations! ${pc.name} has been promoted to ${newLeague?.name || 'the upper division'}!`
        : `${pc.name} has been relegated to ${newLeague?.name || 'the lower division'}.`;
      newMessages = addMsg(newMessages, { week: state.week, season, type: 'board', title, body });
    }
    // Report other league movements
    const playerDivTurnover = turnover;
    if (playerDivTurnover.promotedClubs.length > 0) {
      const promoNames = playerDivTurnover.promotedClubs.map(id => clubs[id]?.name || id).join(', ');
      newMessages = addMsg(newMessages, { week: state.week, season, type: 'general', title: 'Promotions', body: `Promoted to the league: ${promoNames}.` });
    }
    if (playerDivTurnover.relegatedClubs.length > 0) {
      const relNames = playerDivTurnover.relegatedClubs.map(id => clubs[id]?.name || id).join(', ');
      newMessages = addMsg(newMessages, { week: state.week, season, type: 'general', title: 'Relegations', body: `Relegated from the league: ${relNames}.` });
    }
  } else if (turnover.relegatedClubs.length > 0) {
    const replacedNames = turnover.relegatedClubs.map(id => clubs[id]?.name || id).join(', ');
    newMessages = addMsg(newMessages, { week: state.week, season, type: 'general', title: 'League Turnover', body: `${replacedNames} departed the league.` });
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

  finalizeSeason(set, get, history, updatedRecords, workingClubs, workingPlayers, turnover, newDivisionClubs, newPlayerDiv, newMessages);
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

  // Carry last season's unsigned free agents into the new pool. Without this,
  // state.freeAgents was silently wiped each endSeason — combined with the
  // cap-full silent-drop below, CP players expiring from clubs almost never
  // persisted long enough to reach the user's FA tab. Existing FAs that age
  // past the 34 retirement threshold here are dropped (same gate we use when
  // admitting newly-expiring players).
  const existingFaSet = new Set(state.freeAgents);
  const freeAgentIds: string[] = [];
  for (const faId of state.freeAgents) {
    const fa = mergedPlayers[faId];
    if (!fa) continue;
    if (fa.age + 1 > 34) continue;
    const agedFa: Player = {
      ...fa, age: fa.age + 1,
      careerGoals: (fa.careerGoals || 0) + fa.goals,
      careerAssists: (fa.careerAssists || 0) + fa.assists,
      careerAppearances: (fa.careerAppearances || 0) + fa.appearances,
      goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
      seasonRatingTotal: 0, seasonRatedMatches: 0, matchHistory: [],
      suspendedUntilWeek: undefined, growthDelta: 0, lastAttributeChanges: undefined, lastTrainingGains: undefined, onLoan: false,
      loanFromClubId: undefined, loanToClubId: undefined, lowMoraleWeeks: 0, wantsToLeave: false, transferCooldownUntilWeek: undefined, lastTransferTalkWeek: undefined,
      listedForSale: false,
    };
    newPlayers[agedFa.id] = agedFa;
    freeAgentIds.push(agedFa.id);
  }
  const farewells: { playerId: string; playerName: string; seasonsServed: number; stats: { label: string; value: string }[] }[] = [];

  Object.values(mergedPlayers).forEach(p => {
    // Existing FAs already processed above — skip to avoid double-aging and
    // double-adding them to freeAgentIds.
    if (existingFaSet.has(p.id)) return;

    const aged = {
      ...p, age: p.age + 1,
      // Accumulate career stats before resetting season stats
      careerGoals: (p.careerGoals || 0) + p.goals,
      careerAssists: (p.careerAssists || 0) + p.assists,
      careerAppearances: (p.careerAppearances || 0) + p.appearances,
      goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
      seasonRatingTotal: 0, seasonRatedMatches: 0, matchHistory: [],
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

  let newMessages = [...inputMessages];

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

  // Consistency: ensure all divisionClubs entries reference valid clubs
  for (const [leagueId, clubIds] of Object.entries(newDivisionClubs)) {
    newDivisionClubs[leagueId] = clubIds.filter(id => newClubs[id]);
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

  // Generate continental tournaments based on the top-tier league table
  // If the player was promoted/relegated, use the top tier's table (continental qualifies top-tier only)
  const topTierLeagueId = getLeaguesByCountry(leagueInfo?.countryId || newPlayerDivision)
    .find(l => l.tier === 1)?.id || newPlayerDivision;
  const prevLeagueTable = newDivisionTables[topTierLeagueId] || state.leagueTable;
  const playerClubMap: Record<string, { name: string; shortName: string; color: string; reputation: number }> = {};
  for (const [id, club] of Object.entries(newClubs)) {
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

  // Clean up orphaned unattached players — must use the NEWLY-built freeAgentIds
  // set (carry-overs + this-season's expiries), not state.freeAgents (the old
  // set from before the expiry loop ran). Previously this used the old set,
  // so every player the expiry loop just routed to the FA pool was immediately
  // deleted here — about ~140 CP fcIds per season. The original intent of this
  // block is to purge external transfer-market players whose listings rotated
  // out, which the new set still catches (those players are never in
  // freeAgentIds).
  const newFreeAgentSet = new Set(freeAgentIds);
  for (const [pid, p] of Object.entries(newPlayers)) {
    if (p.clubId === '' && !newFreeAgentSet.has(pid)) {
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

  newMessages = addMsg(newMessages, {
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

  // Staff season tick: decrement contracts, walk-aways, rising-star bumps, reset performance.
  // Semantics: contractYearsRemaining N at season start = N more end-of-season ticks
  // before the member walks. So a fresh 2y deal lasts exactly 2 seasons:
  //   start S1 = 2 → end S1 tick = 1 → start S2 = 1 → end S2 tick = 0 → walks.
  const staffAfterSeason: typeof state.staff.members = [];
  for (const m of state.staff.members) {
    const ensured = ensureStaffFields(m);
    const remaining = (ensured.contractYearsRemaining ?? 1) - 1;
    if (remaining <= 0) {
      // Contract expired — they walk
      newMessages = addMsg(newMessages, {
        week: 1, season: newSeason, type: 'general',
        title: `${ensured.firstName} ${ensured.lastName} Departed`,
        body: `Their contract has expired. Renew before the end of next season to keep them.`,
      });
      continue;
    }
    let updatedQuality = ensured.quality;
    const seasonsAtClub = (ensured.seasonsAtClub ?? 0) + 1;
    // Rising stars gain +1 quality every 2 seasons until they hit 9
    if ((ensured.traits || []).includes('rising_star') && seasonsAtClub > 0 && seasonsAtClub % 2 === 0 && ensured.quality < 9) {
      updatedQuality = Math.min(9, ensured.quality + 1);
      newMessages = addMsg(newMessages, {
        week: 1, season: newSeason, type: 'general',
        title: `${ensured.firstName} ${ensured.lastName} Improving`,
        body: `Quality has risen to ${updatedQuality}. They are growing into the role.`,
      });
    }
    staffAfterSeason.push({
      ...ensured,
      quality: updatedQuality,
      contractYearsRemaining: remaining,
      seasonsAtClub,
      performance: { trainingGains: 0, youthPromotions: 0, scoutFinds: 0, injuriesPrevented: 0, weeksAtClub: 0 },
    });
  }
  // Use the season-ticked staff list when committing the new season
  const newStaffMembers = staffAfterSeason;

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

  const newLeagueTotalWeeks = LEAGUES.find(l => l.id === newPlayerDivision)?.totalWeeks || TOTAL_WEEKS;
  set({
    season: newSeason, week: 1, totalWeeks: newLeagueTotalWeeks, transferWindowOpen: true,
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
    contractStrikes: {},
    merchandise: {
      ...state.merchandise,
      lastSeasonRevenue: state.merchandise.currentSeasonRevenue,
      currentSeasonRevenue: 0,
      activeCampaign: null,
      campaignCooldownWeeks: 0,
      kitLaunchUsedThisSeason: false,
      signatureDrop: null,
      signatureDropCooldownWeeks: 0,
      signatureDropsUsedThisSeason: [],
      derbyBuzzWeeks: 0,
      // winStreak survives across seasons (player progresses through final fixtures)
    },
    youthAcademy: { prospects: newYouthProspects, nextIntakePreview: newIntakePreview, youthPreviewEnhanced: false, spotlightUsesRemaining: 2 },
    staff: { ...state.staff, members: newStaffMembers, availableHires: newAvailableHires, lastMarketRefreshWeek: undefined, lastMarketRefreshSeason: undefined },
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

    // Career managers without an active national team appointment can't run
    // the picker. Sandbox always has a national team. The picker is the
    // pre-tournament "week before the first national game" prompt.
    const showPicker = nt !== null;

    const tournamentMsg = addMsg(postState.messages, {
      week: 1, season: newSeason, type: 'national_team',
      title: showPicker ? `${tournament.name} — Pick Your Squad` : `${tournament.name} Begins!`,
      body: showPicker
        ? `The ${tournament.name} starts next week. Confirm your 23-man ${postState.managerNationality} squad before kick-off.`
        : `The ${tournament.name} is about to start! You'll manage ${postState.managerNationality} through the tournament. ${squad.length} players have been called up.`,
    });

    set({
      seasonPhase: 'international',
      internationalTournament: tournament,
      nationalTeam: nt,
      players: boostedPlayers,
      messages: tournamentMsg,
      currentScreen: showPicker ? 'national-squad-picker' : 'international-tournament',
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
