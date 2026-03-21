import { Club, Player, PlayerAttributes, TransferListing, SeasonHistory, IncomingOffer, FacilitiesState, BoardObjective, Position, Message, Match, DivisionId, PlayoffState } from '@/types/game';
import { CLUBS_DATA, buildLeagueTable, getClubsByDivision, generateAllDivisionFixtures, buildAllDivisionTables, DERBIES, DIVISIONS, getDerbyIntensity, getDerbyName } from '@/data/league';
import { generateSquad, selectBestLineup, generatePlayer, calculateOverallExport } from '@/utils/playerGen';
import { simulateMatch, simulateHalf, finalizeMatch } from '@/engine/match';
import { generateInitialStaff, generateStaffMarket, getStaffBonus } from '@/utils/staff';
import { applyWeeklyTraining, getInjuryRisk, updateTacticalFamiliarity } from '@/utils/training';
import { completeAssignment } from '@/utils/scouting';
import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../storeTypes';
import { addMsg, getSuffix, pick, shuffle } from '@/utils/helpers';
import { migrateLegacySave } from '@/store/helpers/persistence';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { checkAchievements, ACHIEVEMENTS } from '@/utils/achievements';
import { generateCupDraw, advanceCupRound, getCupResultForClub } from '@/data/cup';
import { generatePressConference } from '@/data/pressConferences';
import { getMentorBonus } from '@/utils/chemistry';
import { checkChallengeComplete, checkChallengeFailed, CHALLENGES } from '@/data/challenges';
import { calculateSeasonAwards } from '@/utils/seasonAwards';
import { getLeadershipBonus, wantsTransfer } from '@/utils/personality';
import { createEmptyRecords, updateRecords, findBiggestWin } from '@/utils/records';
import {
  TOTAL_WEEKS, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY,
  CONFIDENCE_MIN,
  MATCH_INJURY_WEEKS_MIN, MATCH_INJURY_WEEKS_RANGE, TRAINING_INJURY_WEEKS_MIN, TRAINING_INJURY_WEEKS_RANGE,
  RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE,
  PHYSIO_RECOVERY_BOOST_THRESHOLD, PHYSIO_INJURY_REDUCTION_PER_QUALITY, ASSISTANT_MANAGER_FAMILIARITY_BOOST,
  CONTRACT_WARNING_WEEKS, CONTRACT_WARNING_OVERALL_THRESHOLD,
  CONTRACT_MORALE_HIT_WEEK_THRESHOLD, CONTRACT_MORALE_HIT_OVERALL_THRESHOLD, CONTRACT_MORALE_HIT_AMOUNT, CONTRACT_MORALE_MIN,
  MATCHDAY_INCOME_PER_FAN, COMMERCIAL_INCOME_PER_REP, STADIUM_INCOME_PER_LEVEL,
  POSITION_PRIZE_PER_RANK, POSITION_PRIZE_MAX_RANK,
  SPONSORSHIP_REP_MULTIPLIER, MERCHANDISE_FAN_MULTIPLIER, SCOUTING_COST_PER_ASSIGNMENT,
  FAN_MOOD_BASE, FAN_MOOD_SCALE,
  STADIUM_LEVEL_DIVISOR, MEDICAL_LEVEL_FACTOR, FACILITY_MAX_LEVEL,
  SEASON_END_CONFIDENCE,
  MIN_SQUAD_SIZE, REPLACEMENT_QUALITY_REP_MULTIPLIER, REPLACEMENT_QUALITY_BASE, REPLACEMENT_QUALITY_VARIANCE,
  GENERIC_FILL_POSITIONS,
  LISTING_PRICE_MIN_MULTIPLIER, LISTING_PRICE_RANDOM_RANGE, INITIAL_LISTINGS_MIN, INITIAL_LISTINGS_RANGE,
  SEASON_YOUTH_INTAKE_MIN, SEASON_YOUTH_INTAKE_RANGE,
  LOAN_PLAY_CHANCE_HIGH, LOAN_PLAY_CHANCE_LOW, LOAN_DEV_BASE_CHANCE, LOAN_DEV_REP_FACTOR,
  LOAN_QUALITY_FORMULA_REP_MULT, LOAN_QUALITY_FORMULA_BASE, LOAN_FITNESS_DRAIN, LOAN_YOUNG_AGE_THRESHOLD,
  AI_LOAN_OFFER_CHANCE, AI_LOAN_DURATIONS, AI_LOAN_WAGE_SPLITS, AI_LOAN_RECALL_CLAUSE_CHANCE,
  AI_TRANSFER_CHANCE, AI_TRANSFER_FEE_BASE, AI_TRANSFER_FEE_RANGE, AI_TRANSFER_MAX_BUDGET_RATIO, AI_TRANSFER_MIN_BUDGET,
  getExpectedPosition,
  STREAK_MORALE_THRESHOLD, STREAK_MORALE_BONUS, STREAK_INCOME_THRESHOLD, STREAK_INCOME_MULTIPLIER, STREAK_FORM_THRESHOLD, STREAK_FORM_BONUS,
} from '@/config/gameBalance';
import {
  SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END,
  WINDOW_CLOSING_WEEK, WINDOW_OPENING_WEEK,
  AI_OFFER_CHANCE, AI_OFFER_MIN_BUDGET_RATIO, AI_OFFER_POSITION_THRESHOLD,
  URGENCY_NONE, URGENCY_ONE, URGENCY_TWO_PLUS,
  OFFER_FEE_BASE, OFFER_FEE_RANDOM_RANGE, OFFER_MAX_BUDGET_RATIO,
} from '@/config/transfers';
import {
  PLAYOFF_HOME_ADVANTAGE, PLAYOFF_GOAL_RANGE, PLAYOFF_STRONG_BONUS, PLAYOFF_WEAK_BONUS,
  PLAYOFF_FINAL_STRONG_BONUS, PLAYOFF_FINAL_WEAK_BONUS, PLAYOFF_EXTRA_TIME_CHANCE, PLAYOFF_FALLBACK_OVERALL,
  PROMOTION_BUDGET_MULTIPLIER, PROMOTION_MORALE_BONUS, PROMOTION_FAN_MOOD_BONUS,
  RELEGATION_BUDGET_MULTIPLIER, RELEGATION_MORALE_PENALTY, RELEGATION_FAN_MOOD_PENALTY, RELEGATION_UNHAPPY_OVERALL,
  VERDICT_EXCELLENT_OFFSET, VERDICT_ACCEPTABLE_OFFSET, BOARD_SACKING_THRESHOLD,
  STORYLINE_CHAIN_TRIGGER_CHANCE, STORYLINE_CHAIN_MIN_WEEK,
} from '@/config/playoffs';
import { applyPlayerDevelopment, resetSeasonGrowth } from '@/store/helpers/development';
import { determineZones, generatePlayoffBracket, populatePlayoffFinal, resolvePlayoffFinal, applyPromotionRelegation, generateReplacementClub, isPlayerInPlayoffs, getNextPlayoffMatch } from '@/utils/promotionRelegation';
import { generateStorylines } from '@/utils/storylines';
import { STORYLINE_CHAINS, shouldTriggerChain } from '@/data/storylineChains';
import type { ActiveStorylineChain, StorylineEvent } from '@/types/game';
import { getWinStreak } from '@/utils/celebrations';
import { generateWeeklyObjectives, evaluateObjectives } from '@/utils/weeklyObjectives';
import type { ObjectiveContext } from '@/utils/weeklyObjectives';
import { createMilestone } from '@/utils/milestones';
import { createDefaultProgression, grantXP, XP_REWARDS, MANAGER_PERKS, canUnlockPerk, hasPerk } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';
import type { CareerMilestone, PerkId, ManagerProgression } from '@/types/game';
import { processMatchResult } from '@/store/helpers/matchProcessing';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

// migrateLegacySave and getSlotSummaries extracted to @/store/helpers/persistence
export { getSlotSummaries } from '@/store/helpers/persistence';



function generateObjectives(club: Club, divisionId?: DivisionId): BoardObjective[] {
  const objectives: BoardObjective[] = [];
  const div = divisionId || club.divisionId || 'div-1';
  const divInfo = DIVISIONS.find(d => d.id === div);
  const teamCount = divInfo?.teamCount || 20;
  const hasPromotion = divInfo ? divInfo.autoPromoteSlots > 0 || divInfo.playoffSlots > 0 : false;
  const hasRelegation = divInfo ? divInfo.autoRelegateSlots > 0 || divInfo.replacedSlots > 0 : false;

  if (div === 'div-1') {
    // Top flight: win / top N / avoid relegation
    if (club.reputation >= 5) {
      objectives.push({ id: '1', description: 'Win the League', priority: 'critical', completed: false });
      objectives.push({ id: '2', description: 'Finish in Top 3', priority: 'important', completed: false });
    } else if (club.reputation >= 4) {
      objectives.push({ id: '1', description: 'Finish in Top 6', priority: 'critical', completed: false });
      objectives.push({ id: '2', description: 'Reach Top Half', priority: 'important', completed: false });
    } else {
      objectives.push({ id: '1', description: `Avoid Relegation (Top ${teamCount - (divInfo?.autoRelegateSlots || 3)})`, priority: 'critical', completed: false });
    }
  } else if (hasPromotion) {
    // Lower divisions: promotion objectives
    if (club.reputation >= 3) {
      objectives.push({ id: '1', description: 'Win Promotion', priority: 'critical', completed: false });
      objectives.push({ id: '2', description: 'Automatic Promotion (Top 2)', priority: 'important', completed: false });
    } else if (club.reputation >= 2) {
      objectives.push({ id: '1', description: 'Make the Playoffs', priority: 'critical', completed: false });
    } else {
      const safePos = teamCount - (divInfo?.autoRelegateSlots || 0) - (divInfo?.replacedSlots || 0);
      objectives.push({ id: '1', description: hasRelegation ? `Survive (Top ${safePos})` : 'Finish in Top Half', priority: 'critical', completed: false });
    }
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

/** Calculate average overall strength for a club's players. */
function getClubAvgStrength(club: Club, players: Record<string, Player>): number {
  return club.playerIds.reduce((s, id) => s + (players[id]?.overall || PLAYOFF_FALLBACK_OVERALL), 0) / Math.max(club.playerIds.length, 1);
}

/** Simulate playoff goals for a single tie. */
function simulatePlayoffGoals(hStrength: number, aStrength: number, homeAdv: number, isFinal: boolean): { homeGoals: number; awayGoals: number } {
  const strongBonus = isFinal ? PLAYOFF_FINAL_STRONG_BONUS : PLAYOFF_STRONG_BONUS;
  const weakBonus = isFinal ? PLAYOFF_FINAL_WEAK_BONUS : PLAYOFF_WEAK_BONUS;
  const homeGoals = Math.floor(Math.random() * PLAYOFF_GOAL_RANGE + (hStrength + homeAdv > aStrength ? strongBonus : weakBonus));
  const awayGoals = Math.floor(Math.random() * PLAYOFF_GOAL_RANGE + (aStrength > hStrength + homeAdv ? strongBonus : weakBonus));
  return { homeGoals, awayGoals };
}

/** Simulate a single playoff tie (leg or final). */
function simulatePlayoffTie(tie: PlayoffState['bracket'][number], clubs: Record<string, Club>, players: Record<string, Player>) {
  const hc = clubs[tie.homeClubId];
  const ac = clubs[tie.awayClubId];
  if (!hc || !ac) return;
  const hStrength = getClubAvgStrength(hc, players);
  const aStrength = getClubAvgStrength(ac, players);
  const isFinal = tie.round === 'final';
  const homeAdv = isFinal ? 0 : PLAYOFF_HOME_ADVANTAGE;
  const goals = simulatePlayoffGoals(hStrength, aStrength, homeAdv, isFinal);
  tie.homeGoals = goals.homeGoals;
  tie.awayGoals = goals.awayGoals;
  if (isFinal && tie.homeGoals === tie.awayGoals) {
    if (Math.random() < PLAYOFF_EXTRA_TIME_CHANCE) tie.homeGoals++; else tie.awayGoals++;
  }
  tie.played = true;
}

/** Simulate an entire playoff bracket instantly (for AI divisions). */
function simulatePlayoffBracket(
  playoff: PlayoffState,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
) {
  // Simulate semi-final legs
  for (const tie of playoff.bracket.filter(t => (t.round === 'semi-leg1' || t.round === 'semi-leg2') && !t.played)) {
    simulatePlayoffTie(tie, clubs, players);
  }
  // Populate final from semi winners
  const updated = populatePlayoffFinal(playoff);
  playoff.bracket = updated.bracket;
  playoff.currentRound = updated.currentRound;
  // Simulate final
  const final = playoff.bracket.find(t => t.round === 'final');
  if (final && !final.played && final.homeClubId && final.awayClubId) {
    simulatePlayoffTie(final, clubs, players);
  }
  const resolved = resolvePlayoffFinal(playoff);
  playoff.promotedClubId = resolved.promotedClubId;
  playoff.currentRound = resolved.currentRound;
}

/** Handle advanceWeek during the playoff phase. */
function advancePlayoffWeek(set: Set, get: Get) {
  const state = get();
  const { week, season, fixtures, clubs, players, playerClubId, training, staff, messages, playoffs } = state;
  const newPlayers = { ...players };
  let newMessages = [...messages];
  const newWeek = week + 1;

  // ── Basic squad maintenance (recovery + training) ──
  const physioBonus = getStaffBonus(staff.members, 'physio');
  const fitnessCoachBonus = getStaffBonus(staff.members, 'fitness-coach');
  const firstTeamCoachBonus = getStaffBonus(staff.members, 'first-team-coach');
  const playerClub = clubs[playerClubId];
  if (!playerClub) return set({ week: newWeek });

  playerClub.playerIds.forEach(pid => {
    let p = { ...newPlayers[pid] };
    if (p.injured) {
      const recoveryBoost = physioBonus >= PHYSIO_RECOVERY_BOOST_THRESHOLD ? 1 : 0;
      p.injuryWeeks = Math.max(0, p.injuryWeeks - 1 - recoveryBoost);
      if (p.injuryWeeks === 0) {
        p.injured = false;
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'injury', title: `${p.lastName} Returns`, body: `${p.firstName} ${p.lastName} has recovered and is available for the playoffs.` });
      }
    }
    if (p.suspendedUntilWeek && p.suspendedUntilWeek <= newWeek) {
      p.suspendedUntilWeek = undefined;
    }
    if (!p.injured) {
      p = applyWeeklyTraining(p, training, firstTeamCoachBonus + fitnessCoachBonus * 0.5);
    }
    newPlayers[pid] = p;
  });

  // ── Deep-copy playoffs ──
  const updatedPlayoffs = playoffs.map(p => ({ ...p, bracket: p.bracket.map(t => ({ ...t })) }));

  // ── Sync played fixture results back to playoff bracket ──
  for (const m of fixtures) {
    if (!m.played) continue;
    for (const playoff of updatedPlayoffs) {
      const tieIdx = playoff.bracket.findIndex(t => t.id === m.id && !t.played);
      if (tieIdx >= 0) {
        playoff.bracket[tieIdx] = { ...playoff.bracket[tieIdx], played: true, homeGoals: m.homeGoals, awayGoals: m.awayGoals };
      }
    }
  }

  // ── Advance completed rounds ──
  function advanceRounds(poffs: PlayoffState[]) {
    for (let i = 0; i < poffs.length; i++) {
      const playoff = poffs[i];
      if (!playoff.currentRound) continue;
      const roundTies = playoff.bracket.filter(t => t.round === playoff.currentRound);
      if (roundTies.every(t => t.played)) {
        if (playoff.currentRound === 'semi-leg1') {
          poffs[i] = { ...playoff, currentRound: 'semi-leg2' };
        } else if (playoff.currentRound === 'semi-leg2') {
          poffs[i] = populatePlayoffFinal(playoff);
        } else if (playoff.currentRound === 'final') {
          poffs[i] = resolvePlayoffFinal(playoff);
        }
      }
    }
  }

  advanceRounds(updatedPlayoffs);

  // ── If player has no more playoff matches, fast-forward all remaining AI playoffs ──
  const playerStillIn = isPlayerInPlayoffs(playerClubId, updatedPlayoffs);
  if (!playerStillIn) {
    for (const playoff of updatedPlayoffs) {
      if (playoff.currentRound) simulatePlayoffBracket(playoff, clubs, newPlayers);
    }
    // All playoffs now resolved — apply promotion/relegation and finalize
    const finalTables = buildAllDivisionTables(state.divisionFixtures, state.divisionClubs);
    const { promRel, updatedClubs: promRelClubs, updatedDivisionClubs: postPromRelDivClubs } = applyPromotionRelegation(
      state.divisionClubs, finalTables, updatedPlayoffs, clubs,
    );

    // Replace div-4 bottom 2
    const workingClubs = { ...promRelClubs };
    const workingPlayers = { ...newPlayers };
    for (const replacedId of promRel.replacedClubs) {
      const rClub = workingClubs[replacedId];
      if (rClub) {
        rClub.playerIds.forEach(pid => { delete workingPlayers[pid]; });
        delete workingClubs[replacedId];
      }
    }
    for (let i = 0; i < promRel.replacedClubs.length; i++) {
      const { clubData, clubId } = generateReplacementClub(season);
      const newClub: Club = {
        id: clubId, name: clubData.name, shortName: clubData.shortName,
        color: clubData.color, secondaryColor: clubData.secondaryColor,
        budget: clubData.budget, wageBill: 0, reputation: clubData.reputation,
        facilities: clubData.facilities, youthRating: clubData.youthRating,
        fanBase: clubData.fanBase, boardPatience: clubData.boardPatience,
        playerIds: [], formation: '4-4-2', lineup: [], subs: [],
        divisionId: 'div-4',
      };
      const squad = generateSquad(clubId, clubData.squadQuality, season);
      let totalWages = 0;
      squad.forEach(p => { workingPlayers[p.id] = p; newClub.playerIds.push(p.id); totalWages += p.wage; });
      newClub.wageBill = totalWages;
      const { lineup, subs } = selectBestLineup(squad, '4-4-2');
      newClub.lineup = lineup.map(p => p.id);
      newClub.subs = subs.map(p => p.id);
      workingClubs[clubId] = newClub;
      postPromRelDivClubs['div-4'].push(clubId);
      promRel.newClubs.push(clubId);
    }

    const playerClubObj = workingClubs[playerClubId];
    const newPlayerDivision = playerClubObj ? playerClubObj.divisionId : state.playerDivision;

    // Update the history entry already saved in seasonHistory (from endSeasonImpl)
    const updatedHistory = state.seasonHistory.map((h, i) =>
      i === state.seasonHistory.length - 1
        ? { ...h, promoted: promRel.promoted.some(p => p.clubId === playerClubId) || promRel.playoffWinners.some(p => p.clubId === playerClubId), relegated: promRel.relegated.some(r => r.clubId === playerClubId) }
        : h
    );
    // Pop last entry to pass to finalizeSeason (which will re-push it)
    const history = updatedHistory[updatedHistory.length - 1];
    const historyWithoutLast = updatedHistory.slice(0, -1);
    set({ seasonHistory: historyWithoutLast, players: workingPlayers });

    let fanMoodDelta = 0;
    const playerClubForConseq = workingClubs[playerClubId];
    if (history.promoted) {
      const toDivName = DIVISIONS.find(d => d.id === newPlayerDivision)?.name || newPlayerDivision;
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'PROMOTED!', body: `Congratulations! You won the playoffs and earned promotion to the ${toDivName}!` });
      if (playerClubForConseq) playerClubForConseq.budget = Math.round(playerClubForConseq.budget * PROMOTION_BUDGET_MULTIPLIER);
      playerClubForConseq?.playerIds.forEach(pid => {
        if (workingPlayers[pid]) workingPlayers[pid] = { ...workingPlayers[pid], morale: Math.min(100, workingPlayers[pid].morale + PROMOTION_MORALE_BONUS) };
      });
      fanMoodDelta = PROMOTION_FAN_MOOD_BONUS;
    }
    if (history.relegated) {
      const toDivName = DIVISIONS.find(d => d.id === newPlayerDivision)?.name || newPlayerDivision;
      newMessages = addMsg(newMessages, { week: newWeek, season, type: 'board', title: 'Relegated', body: `Your club has been relegated to the ${toDivName}. Time to rebuild.` });
      if (playerClubForConseq) playerClubForConseq.budget = Math.round(playerClubForConseq.budget * RELEGATION_BUDGET_MULTIPLIER);
      playerClubForConseq?.playerIds.forEach(pid => {
        const p = workingPlayers[pid];
        if (!p) return;
        workingPlayers[pid] = { ...p, morale: Math.max(0, p.morale - RELEGATION_MORALE_PENALTY) };
        if (p.overall > RELEGATION_UNHAPPY_OVERALL) {
          workingPlayers[pid] = { ...workingPlayers[pid], listedForSale: true };
          newMessages = addMsg(newMessages, { week: newWeek, season, type: 'transfer', title: `${p.lastName} Wants Out`, body: `${p.firstName} ${p.lastName} is unhappy after relegation and wants to leave.` });
        }
      });
      fanMoodDelta = RELEGATION_FAN_MOOD_PENALTY;
    }
    if (fanMoodDelta !== 0) {
      set(s => ({ fanMood: Math.max(0, Math.min(100, s.fanMood + fanMoodDelta)) }));
    }

    finalizeSeason(set, get, history, state.clubRecords, workingClubs, workingPlayers, updatedPlayoffs, promRel, postPromRelDivClubs, newPlayerDivision, newMessages);
    return;
  }

  // ── Player still in playoffs: simulate non-player ties for current round ──
  for (const playoff of updatedPlayoffs) {
    if (!playoff.currentRound) continue;
    for (const tie of playoff.bracket) {
      if (tie.round !== playoff.currentRound || tie.played) continue;
      if (tie.homeClubId === playerClubId || tie.awayClubId === playerClubId) continue;
      if (!tie.homeClubId || !tie.awayClubId) continue;
      simulatePlayoffTie(tie, clubs, newPlayers);
    }
  }

  // Re-advance rounds after AI simulation
  advanceRounds(updatedPlayoffs);

  // ── Create next playoff match for player as a fixture ──
  const nextPlayoff = getNextPlayoffMatch(playerClubId, updatedPlayoffs);
  let updatedFixtures = [...fixtures];
  if (nextPlayoff) {
    const { tie } = nextPlayoff;
    const roundLabel = tie.round === 'semi-leg1' ? 'Playoff Semi-Final (1st Leg)' :
      tie.round === 'semi-leg2' ? 'Playoff Semi-Final (2nd Leg)' : 'Playoff Final';
    const oppId = tie.homeClubId === playerClubId ? tie.awayClubId : tie.homeClubId;
    const oppClub = clubs[oppId];

    const playoffMatch: Match = {
      id: tie.id,
      week: newWeek,
      homeClubId: tie.homeClubId,
      awayClubId: tie.awayClubId,
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      events: [],
    };
    updatedFixtures = [...updatedFixtures, playoffMatch];

    newMessages = addMsg(newMessages, {
      week: newWeek, season, type: 'match_preview',
      title: roundLabel,
      body: `${roundLabel}: ${tie.homeClubId === playerClubId ? 'Home' : 'Away'} vs ${oppClub?.name || 'TBD'}. This is a must-win playoff match!`,
    });
  }

  set({
    week: newWeek,
    fixtures: updatedFixtures,
    players: newPlayers,
    messages: newMessages,
    playoffs: updatedPlayoffs,
    currentMatchResult: null,
    matchSubsUsed: 0,
  });
}

/** endSeason implementation — extracted to keep the slice method thin. */
function endSeasonImpl(set: Set, get: Get) {
  const state = get();
  const { season, leagueTable, players, clubs, playerClubId, boardConfidence, messages } = state;

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
    divisionId: state.playerDivision,
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

  // Generate playoff brackets for div-2, div-3, div-4
  const finalTables = buildAllDivisionTables(state.divisionFixtures, state.divisionClubs);
  const newPlayoffs: PlayoffState[] = [];
  for (const divId of ['div-2', 'div-3', 'div-4'] as DivisionId[]) {
    const div = DIVISIONS.find(d => d.id === divId);
    if (!div) continue;
    const table = finalTables[divId] || [];
    const zones = determineZones(table, div);
    if (zones.playoffContenders.length >= 4) {
      newPlayoffs.push(generatePlayoffBracket(zones.playoffContenders, divId));
    }
  }

  // Check if player's club is in any playoff
  if (isPlayerInPlayoffs(playerClubId, newPlayoffs)) {
    const playerDiv = state.playerDivision;
    const divName = DIVISIONS.find(d => d.id === playerDiv)?.name || playerDiv;
    const newMessages = addMsg(messages, {
      week: state.week, season, type: 'board',
      title: 'Playoffs!',
      body: `You finished ${pos}${getSuffix(pos)} in the ${divName} — you're in the promotion playoffs! Win to earn promotion.`,
    });
    set({
      seasonPhase: 'playoffs',
      playoffs: newPlayoffs,
      seasonHistory: [...state.seasonHistory, history],
      clubRecords: updatedRecords,
      messages: newMessages,
      currentScreen: 'dashboard',
    });
    return;
  }

  // Player NOT in playoffs: simulate all playoffs instantly
  for (const playoff of newPlayoffs) {
    simulatePlayoffBracket(playoff, clubs, players);
  }

  // Apply promotion/relegation
  const { promRel, updatedClubs: promRelClubs, updatedDivisionClubs: postPromRelDivClubs } = applyPromotionRelegation(
    state.divisionClubs, finalTables, newPlayoffs, clubs,
  );

  // Replace div-4 bottom 2
  const workingClubs = { ...promRelClubs };
  const workingPlayers = { ...players };
  for (const replacedId of promRel.replacedClubs) {
    const rClub = workingClubs[replacedId];
    if (rClub) {
      rClub.playerIds.forEach(pid => { delete workingPlayers[pid]; });
      delete workingClubs[replacedId];
    }
  }
  for (let i = 0; i < promRel.replacedClubs.length; i++) {
    const { clubData, clubId } = generateReplacementClub(season);
    const newClub: Club = {
      id: clubId, name: clubData.name, shortName: clubData.shortName,
      color: clubData.color, secondaryColor: clubData.secondaryColor,
      budget: clubData.budget, wageBill: 0, reputation: clubData.reputation,
      facilities: clubData.facilities, youthRating: clubData.youthRating,
      fanBase: clubData.fanBase, boardPatience: clubData.boardPatience,
      playerIds: [], formation: '4-4-2', lineup: [], subs: [],
      divisionId: 'div-4',
    };
    const squad = generateSquad(clubId, clubData.squadQuality, season);
    let totalWages = 0;
    squad.forEach(p => { workingPlayers[p.id] = p; newClub.playerIds.push(p.id); totalWages += p.wage; });
    newClub.wageBill = totalWages;
    const { lineup, subs } = selectBestLineup(squad, '4-4-2');
    newClub.lineup = lineup.map(p => p.id);
    newClub.subs = subs.map(p => p.id);
    workingClubs[clubId] = newClub;
    postPromRelDivClubs['div-4'].push(clubId);
    promRel.newClubs.push(clubId);
  }

  const playerClub = workingClubs[playerClubId];
  const newPlayerDivision = playerClub ? playerClub.divisionId : state.playerDivision;
  history.promoted = promRel.promoted.some(p => p.clubId === playerClubId) || promRel.playoffWinners.some(p => p.clubId === playerClubId);
  history.relegated = promRel.relegated.some(r => r.clubId === playerClubId);

  let newMessages = [...messages];
  let fanMoodDelta = 0;
  if (history.promoted) {
    const toDivName = DIVISIONS.find(d => d.id === newPlayerDivision)?.name || newPlayerDivision;
    newMessages = addMsg(newMessages, { week: state.week, season, type: 'board', title: 'PROMOTED!', body: `Congratulations! Your club has been promoted to the ${toDivName}!` });
    if (playerClub) playerClub.budget = Math.round(playerClub.budget * PROMOTION_BUDGET_MULTIPLIER);
    playerClub?.playerIds.forEach(pid => {
      if (workingPlayers[pid]) workingPlayers[pid] = { ...workingPlayers[pid], morale: Math.min(100, workingPlayers[pid].morale + PROMOTION_MORALE_BONUS) };
    });
    fanMoodDelta = PROMOTION_FAN_MOOD_BONUS;
  }
  if (history.relegated) {
    const toDivName = DIVISIONS.find(d => d.id === newPlayerDivision)?.name || newPlayerDivision;
    newMessages = addMsg(newMessages, { week: state.week, season, type: 'board', title: 'Relegated', body: `Your club has been relegated to the ${toDivName}. Time to rebuild and fight for promotion.` });
    if (playerClub) playerClub.budget = Math.round(playerClub.budget * RELEGATION_BUDGET_MULTIPLIER);
    playerClub?.playerIds.forEach(pid => {
      const p = workingPlayers[pid];
      if (!p) return;
      workingPlayers[pid] = { ...p, morale: Math.max(0, p.morale - RELEGATION_MORALE_PENALTY) };
      if (p.overall > RELEGATION_UNHAPPY_OVERALL) {
        workingPlayers[pid] = { ...workingPlayers[pid], listedForSale: true };
        newMessages = addMsg(newMessages, { week: state.week, season, type: 'transfer', title: `${p.lastName} Wants Out`, body: `${p.firstName} ${p.lastName} is unhappy after relegation and wants to leave.` });
      }
    });
    fanMoodDelta = RELEGATION_FAN_MOOD_PENALTY;
  }
  if (fanMoodDelta !== 0) {
    set(s => ({ fanMood: Math.max(0, Math.min(100, s.fanMood + fanMoodDelta)) }));
  }

  finalizeSeason(set, get, history, updatedRecords, workingClubs, workingPlayers, newPlayoffs, promRel, postPromRelDivClubs, newPlayerDivision, newMessages);
}

/** Standard season-end processing: aging, contracts, squad regen, fixtures, etc. */
function finalizeSeason(
  set: Set, get: Get,
  history: SeasonHistory,
  updatedRecords: ReturnType<typeof createEmptyRecords>,
  inputClubs: Record<string, Club>,
  inputPlayers: Record<string, Player>,
  playoffs: PlayoffState[],
  promRel: ReturnType<typeof applyPromotionRelegation>['promRel'],
  newDivisionClubs: Record<DivisionId, string[]>,
  newPlayerDivision: DivisionId,
  inputMessages: GameState['messages'],
) {
  const state = get();
  const { season, playerClubId } = state;
  const newSeason = season + 1;
  resetSeasonGrowth();

  if (state.activeLoans.length > 0) get().processLoanReturns();
  set({ activeLoans: [], incomingLoanOffers: [] });

  const newPlayers: Record<string, Player> = {};
  const newClubs = { ...inputClubs };

  Object.values(inputPlayers).forEach(p => {
    const aged = { ...p, age: p.age + 1, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, suspendedUntilWeek: undefined, growthDelta: 0, onLoan: false, loanFromClubId: undefined, loanToClubId: undefined };
    if (aged.contractEnd <= season) {
      const club = newClubs[aged.clubId];
      if (club) {
        const updatedClub = { ...club };
        updatedClub.playerIds = updatedClub.playerIds.filter(id => id !== aged.id);
        updatedClub.lineup = updatedClub.lineup.filter(id => id !== aged.id);
        updatedClub.subs = updatedClub.subs.filter(id => id !== aged.id);
        updatedClub.wageBill -= aged.wage;
        newClubs[updatedClub.id] = updatedClub;
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
    const currentSquadIds = club.playerIds.filter(id => newPlayers[id]);
    const currentSquad = currentSquadIds.map(id => newPlayers[id]);
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
      const newP = generatePlayer(fillPos, quality, club.id, newSeason);
      newPlayers[newP.id] = newP;
      const updatedClub = { ...newClubs[club.id] };
      updatedClub.playerIds = [...updatedClub.playerIds, newP.id];
      updatedClub.wageBill += newP.wage;
      newClubs[club.id] = updatedClub;
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

  const clubIds = Object.keys(newClubs);
  const newDivisionFixtures = generateAllDivisionFixtures(newDivisionClubs);
  const newDivisionTables = buildAllDivisionTables(newDivisionFixtures, newDivisionClubs);
  const newFixtures = newDivisionFixtures[newPlayerDivision];
  const newLeagueTable = newDivisionTables[newPlayerDivision];
  const newCup = generateCupDraw(clubIds, newClubs);

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

  const objectives = generateObjectives(newClubs[playerClubId], newPlayerDivision);
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
    messages: newMessages, incomingOffers: [], matchSubsUsed: 0, shortlist: [],
    youthAcademy: { prospects: newYouthProspects, nextIntakePreview: newIntakePreview },
    staff: { ...state.staff, availableHires: newAvailableHires },
    scouting: { ...state.scouting, assignments: [], reports: [] },
    cup: newCup,
    clubRecords: updatedRecords,
    activeChallenge: endChallenge,
    playoffs, lastPromotionRelegation: promRel,
    // Career milestones & manager XP at end of season
    careerTimeline: (() => {
      const milestones = [...state.careerTimeline];
      if (pos === 1) {
        const isFirst = !state.seasonHistory.some(h => h.position === 1);
        milestones.push(createMilestone(isFirst ? 'first_trophy' : 'season_start', isFirst ? 'First League Title!' : 'League Champions!', `Won the league in Season ${season} with ${playerEntry?.points || 0} points.`, season, TOTAL_WEEKS, isFirst ? 'medal' : 'trophy'));
      }
      if (state.cup.winner === playerClubId) {
        milestones.push(createMilestone('cup_win', 'Cup Winners!', `Won the cup in Season ${season}!`, season, TOTAL_WEEKS, 'medal'));
      }
      return milestones;
    })(),
    managerProgression: grantXP(state.managerProgression, XP_REWARDS.seasonEnd + (pos === 1 ? XP_REWARDS.titleWin : 0) + (state.cup.winner === playerClubId ? XP_REWARDS.cupWin : 0)),
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

  if (get().settings.autoSave) get().saveGame();
}

export const createOrchestrationSlice = (set: Set, get: Get) => ({
  initGame: (clubId: string) => {
    const allPlayers: Record<string, Player> = {};
    const clubs: Record<string, Club> = {};

    CLUBS_DATA.forEach(cd => {
      const club: Club = {
        id: cd.id, name: cd.name, shortName: cd.shortName,
        color: cd.color, secondaryColor: cd.secondaryColor,
        budget: cd.budget, wageBill: 0, reputation: cd.reputation,
        facilities: cd.facilities, youthRating: cd.youthRating,
        fanBase: cd.fanBase, boardPatience: cd.boardPatience,
        playerIds: [], formation: '4-3-3', lineup: [], subs: [],
        divisionId: cd.divisionId,
      };

      const squad = generateSquad(club.id, cd.squadQuality, 1);
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
      clubs[club.id] = club;
    });

    const clubIds = Object.keys(clubs);
    // Build per-division structures
    const divisionClubs = getClubsByDivision();
    const divisionFixtures = generateAllDivisionFixtures(divisionClubs);
    const divisionTables = buildAllDivisionTables(divisionFixtures, divisionClubs);
    const playerDivision = clubs[clubId].divisionId;
    // Backward-compat aliases for the player's division
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
    const cup = generateCupDraw(clubIds, clubs);

    set({
      gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: TOTAL_WEEKS,
      transferWindowOpen: true, clubs, players: allPlayers, fixtures, leagueTable,
      divisionFixtures, divisionTables, divisionClubs, playerDivision,
      playoffs: [], lastPromotionRelegation: null, derbies: DERBIES,
      transferMarket, shortlist: [], boardObjectives: objectives, boardConfidence: STARTING_BOARD_CONFIDENCE,
      currentScreen: 'dashboard', previousScreen: null, currentMatchResult: null, trainingFocus: 'fitness',
      messages, seasonHistory: [], incomingOffers: [], matchSubsUsed: 0,
      settings: { matchSpeed: 'normal', showOverallOnPitch: true, autoSave: false },
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
        upgradeInProgress: null,
      },
      financeHistory: [], matchPlayerRatings: [],
      unlockedAchievements: [],
      managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
      clubRecords: createEmptyRecords(),
      careerTimeline: [createMilestone('season_start', 'Career Begins', `Started managing ${CLUBS_DATA.find(c => c.id === clubId)?.name || 'a club'}.`, 1, 1, 'calendar')],
      managerProgression: createDefaultProgression(),
      cup,
      weeklyObjectives: generateWeeklyObjectives(true),
      pendingStoryline: null,
      activeStorylineChains: [],
      pendingFarewell: null,
    });
  },

  advanceWeek: () => {
    const state = get();
    // Playoff phase: separate flow
    if (state.seasonPhase === 'playoffs') {
      advancePlayoffWeek(set, get);
      return;
    }
    const { week, season, fixtures, clubs, players, playerClubId, training, staff, scouting, facilities, messages, boardConfidence } = state;
    const newPlayers = { ...players };
    let newMessages = [...messages];
    const newTimeline: CareerMilestone[] = [];

    const fitnessCoachBonus = getStaffBonus(staff.members, 'fitness-coach');
    const firstTeamCoachBonus = getStaffBonus(staff.members, 'first-team-coach');
    const physioBonus = getStaffBonus(staff.members, 'physio');
    const assistantManagerBonus = getStaffBonus(staff.members, 'assistant-manager');

    const playerClub = { ...clubs[playerClubId] };
    playerClub.playerIds.forEach(pid => {
      let p = { ...newPlayers[pid] };
      if (p.injured) {
        const recoveryBoost = physioBonus >= PHYSIO_RECOVERY_BOOST_THRESHOLD ? 1 : 0;
        p.injuryWeeks = Math.max(0, p.injuryWeeks - 1 - recoveryBoost);
        if (p.injuryWeeks === 0) {
          p.injured = false;
          newMessages = addMsg(newMessages, { week, season, type: 'injury', title: `${p.lastName} Returns`, body: `${p.firstName} ${p.lastName} has recovered from injury and is available for selection.` });
        }
      }
      if (p.suspendedUntilWeek && p.suspendedUntilWeek <= week) {
        p.suspendedUntilWeek = undefined;
        newMessages = addMsg(newMessages, { week, season, type: 'general', title: `${p.lastName} Available`, body: `${p.firstName} ${p.lastName}'s suspension has ended. Available for selection.` });
      }

      if (!p.injured) {
        p = applyWeeklyTraining(p, training, firstTeamCoachBonus + fitnessCoachBonus * 0.5);
        // Physio reduces training injury risk, age-scaled injury risk
        const baseInjuryRisk = getInjuryRisk(training, p.age);
        const physioReduction = 1 - physioBonus * PHYSIO_INJURY_REDUCTION_PER_QUALITY;
        const perkReduction = hasPerk(state.managerProgression, 'fitness_guru') ? 0.8 : 1;
        const injuryRisk = baseInjuryRisk * physioReduction * perkReduction;
        if (Math.random() < injuryRisk && !p.injured) {
          p.injured = true;
          p.injuryWeeks = TRAINING_INJURY_WEEKS_MIN + Math.floor(Math.random() * TRAINING_INJURY_WEEKS_RANGE);
          newMessages = addMsg(newMessages, { week, season, type: 'injury', title: `${p.lastName} Injured in Training`, body: `${p.firstName} ${p.lastName} picked up an injury during training. Out for ${p.injuryWeeks} week(s).` });
        }
      }

      const allClubPlayers = playerClub.playerIds.map(id => newPlayers[id]).filter(Boolean);
      const mentorBonusVal = getMentorBonus(p, allClubPlayers);
      p = applyPlayerDevelopment(p, training.schedule.mon, mentorBonusVal);
      if (p.growthDelta && p.growthDelta > 0) {
        newMessages = addMsg(newMessages, { week, season, type: 'development', title: `${p.lastName} Improving!`, body: `${p.firstName} ${p.lastName} (${p.position}) has improved to ${p.overall} overall!` });
      } else if (p.growthDelta && p.growthDelta < 0) {
        newMessages = addMsg(newMessages, { week, season, type: 'development', title: `${p.lastName} Declining`, body: `${p.firstName} ${p.lastName} (${p.position}) has dropped to ${p.overall} overall. Age is catching up.` });
      }

      newPlayers[pid] = p;
    });

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
    const newTacticalFamiliarity = Math.min(100, baseTactFam + amBoost + tactGeniusBoost);

    // Simulate AI matches for player's division
    const weekMatches = fixtures.filter(m => m.week === week && !m.played);
    const updatedFixtures = [...fixtures];
    const aiMatches = weekMatches.filter(m => m.homeClubId !== playerClubId && m.awayClubId !== playerClubId);

    // Simulate ALL other divisions' matches for this week
    const updatedDivisionFixtures = { ...state.divisionFixtures };
    const playerDiv = state.playerDivision;
    for (const divId of ['div-1', 'div-2', 'div-3', 'div-4'] as DivisionId[]) {
      if (divId === playerDiv) continue; // handled below via updatedFixtures
      const divFixtures = [...(updatedDivisionFixtures[divId] || [])];
      const divWeekMatches = divFixtures.filter(m => m.week === week && !m.played);
      for (const m of divWeekMatches) {
        const idx = divFixtures.findIndex(f => f.id === m.id);
        const hc = clubs[m.homeClubId];
        const ac = clubs[m.awayClubId];
        if (!hc || !ac) continue;
        const hp = hc.playerIds.map(id => newPlayers[id]).filter(p => p && !p.injured).slice(0, 11);
        const ap = ac.playerIds.map(id => newPlayers[id]).filter(p => p && !p.injured).slice(0, 11);
        const { result } = simulateMatch(m, hc, ac, hp, ap, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId));
        divFixtures[idx] = result;
        // Update player stats for other divisions
        result.events.forEach(ev => {
          if (ev.type === 'goal' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
          }
          if (ev.type === 'goal' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
            newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
          }
          if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: MATCH_INJURY_WEEKS_MIN + Math.floor(Math.random() * MATCH_INJURY_WEEKS_RANGE) };
          }
          if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], yellowCards: newPlayers[ev.playerId].yellowCards + 1 };
          }
          if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: week + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
          }
        });
      }
      updatedDivisionFixtures[divId] = divFixtures;
    }

    for (const m of aiMatches) {
      const idx = updatedFixtures.findIndex(f => f.id === m.id);
      const hc = clubs[m.homeClubId];
      const ac = clubs[m.awayClubId];
      if (!hc || !ac) continue;
      const hp = hc.playerIds.map(id => newPlayers[id]).filter(p => p && !p.injured).slice(0, 11);
      const ap = ac.playerIds.map(id => newPlayers[id]).filter(p => p && !p.injured).slice(0, 11);
      const { result } = simulateMatch(m, hc, ac, hp, ap, undefined, undefined, undefined, undefined, getDerbyIntensity(m.homeClubId, m.awayClubId));
      updatedFixtures[idx] = result;

      result.events.forEach(ev => {
        if (ev.type === 'goal' && ev.playerId && newPlayers[ev.playerId]) {
          newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
        }
        if (ev.type === 'goal' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
          newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
        }
        if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
          newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: MATCH_INJURY_WEEKS_MIN + Math.floor(Math.random() * MATCH_INJURY_WEEKS_RANGE) };
        }
        if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
          newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], yellowCards: newPlayers[ev.playerId].yellowCards + 1 };
        }
        if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
          newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: week + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
        }
      });
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
        const hPlayers = hClub.playerIds.map(id => newPlayers[id]).filter(p => p && !p.injured).slice(0, 11);
        const aPlayers = aClub.playerIds.map(id => newPlayers[id]).filter(p => p && !p.injured).slice(0, 11);

        const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
        const { result: cupResult } = simulateMatch(
          { id: tie.id, week: tie.week, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] },
          hClub, aClub, hPlayers, aPlayers, undefined, undefined, undefined, undefined, getDerbyIntensity(tie.homeClubId, tie.awayClubId)
        );

        // Ensure no draws in cup (extra-time goal for random side)
        let hGoals = cupResult.homeGoals;
        let aGoals = cupResult.awayGoals;
        if (hGoals === aGoals) {
          if (Math.random() < 0.5) hGoals++;
          else aGoals++;
        }

        newCup.ties[tieIdx] = { ...tie, played: true, homeGoals: hGoals, awayGoals: aGoals };

        // Track cup match stats for players
        cupResult.events.forEach(ev => {
          if (ev.type === 'goal' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
          }
          if (ev.type === 'goal' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
            newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
          }
          if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: MATCH_INJURY_WEEKS_MIN + Math.floor(Math.random() * MATCH_INJURY_WEEKS_RANGE) };
          }
          if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], yellowCards: newPlayers[ev.playerId].yellowCards + 1 };
          }
          if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
            newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: week + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
          }
        });

        // Cup match result message for player
        if (isPlayerMatch) {
          const isHome = tie.homeClubId === playerClubId;
          const won = isHome ? hGoals > aGoals : aGoals > hGoals;
          const oppName = clubs[isHome ? tie.awayClubId : tie.homeClubId]?.name || 'Unknown';
          const roundName = tie.round === 'R1' ? 'Round of 16' : tie.round === 'QF' ? 'Quarter-Finals' : tie.round === 'SF' ? 'Semi-Finals' : 'Final';
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

    // Incoming offers — AI clubs only bid for positions they actually need
    const newOffers = [...state.incomingOffers];
    const listedPlayers = Object.values(newPlayers).filter(p => p.listedForSale && p.clubId === playerClubId);
    for (const lp of listedPlayers) {
      if (Math.random() < AI_OFFER_CHANCE) {
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
          const baseFee = lp.value * (OFFER_FEE_BASE + Math.random() * OFFER_FEE_RANDOM_RANGE) * urgencyMult;
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
    const updatedChains: ActiveStorylineChain[] = [...(state.activeStorylineChains || [])];

    // Advance existing chains — check if a step is due this week
    for (let ci = updatedChains.length - 1; ci >= 0; ci--) {
      const chain = updatedChains[ci];
      const chainDef = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
      if (!chainDef) { updatedChains.splice(ci, 1); continue; }

      const nextStepIdx = chain.currentStep + 1;
      if (nextStepIdx >= chainDef.steps.length) {
        // Chain complete — remove
        updatedChains.splice(ci, 1);
        continue;
      }

      const nextStep = chainDef.steps[nextStepIdx];
      const dueWeek = chain.startWeek + nextStep.weekOffset;

      if (newWeek >= dueWeek) {
        // Check if this step requires a specific previous choice
        if (nextStep.requiredPrevChoice !== undefined) {
          const prevChoice = chain.choices[chain.choices.length - 1];
          if (prevChoice !== nextStep.requiredPrevChoice) {
            // Skip this step — try the next one or end the chain
            updatedChains[ci] = { ...chain, currentStep: nextStepIdx };
            continue;
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
          updatedChains[ci] = { ...chain, currentStep: nextStepIdx };
        }
      }
    }

    // Try to start a new chain (max 1 active, 15% chance per week)
    if (updatedChains.length === 0 && Math.random() < STORYLINE_CHAIN_TRIGGER_CHANCE && newWeek >= STORYLINE_CHAIN_MIN_WEEK) {
      const playerClub = clubs[playerClubId];
      const squadPlayers = Object.values(newPlayers).filter(p => p.clubId === playerClubId);
      const avgBudget = Object.values(clubs).reduce((s, c) => s + c.budget, 0) / Object.values(clubs).length;
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
      const expiring = Object.values(newPlayers).filter(ep => ep.clubId === playerClubId && ep.contractEnd <= season && ep.overall > CONTRACT_WARNING_OVERALL_THRESHOLD);
      const urgency = newWeek >= 35 ? 'URGENT: ' : newWeek >= 30 ? '' : 'Reminder: ';
      for (const ep of expiring) {
        newMessages = addMsg(newMessages, { week: newWeek, season, type: 'contract', title: `${urgency}${ep.lastName}'s Contract`, body: `${ep.firstName} ${ep.lastName}'s contract expires at the end of this season. ${newWeek >= 35 ? 'This player will leave for free!' : 'Consider renewing or selling.'}` });
        // Players with expiring contracts lose morale after week 25 — they want clarity
        if (newWeek >= CONTRACT_MORALE_HIT_WEEK_THRESHOLD && ep.overall >= CONTRACT_MORALE_HIT_OVERALL_THRESHOLD) {
          newPlayers[ep.id] = { ...newPlayers[ep.id], morale: Math.max(CONTRACT_MORALE_MIN, newPlayers[ep.id].morale + CONTRACT_MORALE_HIT_AMOUNT) };
        }
      }
    }

    // Transfer window messages
    if (newWeek === WINDOW_CLOSING_WEEK) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'Window Closing', body: 'The transfer window closes this week. Make your final moves!' });
    if (newWeek === WINDOW_OPENING_WEEK) newMessages = addMsg(newMessages, { week: newWeek, season, type: 'general', title: 'January Window Opens', body: 'The winter transfer window is now open until Week 24.' });

    // Scouting tick
    const newScouting = { ...scouting, assignments: [...scouting.assignments], reports: [...scouting.reports], discoveredPlayers: [...scouting.discoveredPlayers] };
    const scoutQuality = getStaffBonus(staff.members, 'scout');
    const completedAssignments: string[] = [];
    for (let i = 0; i < newScouting.assignments.length; i++) {
      const a = { ...newScouting.assignments[i] };
      const scoutReduction = hasPerk(state.managerProgression, 'scout_network') ? 2 : 1;
      a.weeksRemaining = Math.max(0, a.weeksRemaining - scoutReduction);
      newScouting.assignments[i] = a;
      if (a.weeksRemaining === 0) {
        completedAssignments.push(a.id);
        const { reports: newReports, players: scoutedPlayers } = completeAssignment(a, scoutQuality, season, newWeek);
        newScouting.reports.push(...newReports);
        scoutedPlayers.forEach(p => {
          newPlayers[p.id] = p;
          newScouting.discoveredPlayers.push(p.id);
        });
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
        const key = `${upgrade.type}Level` as keyof Pick<FacilitiesState, 'trainingLevel' | 'youthLevel' | 'stadiumLevel' | 'medicalLevel'>;
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
          const devGain = 1 + youthCoachQuality * 0.3 + newFacilities.youthLevel * 0.2;
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
    const commercialIncome = Math.round(playerClub.reputation * COMMERCIAL_INCOME_PER_REP);
    // League position prize money: higher position = more income
    const playerTableIdx = leagueTable.findIndex(e => e.clubId === playerClubId);
    const playerTablePos = playerTableIdx >= 0 ? playerTableIdx + 1 : leagueTable.length;
    const positionPrize = Math.max(0, (POSITION_PRIZE_MAX_RANK - playerTablePos)) * POSITION_PRIZE_PER_RANK;
    // Sponsorship: scales quadratically with reputation
    const sponsorIncome = Math.round(playerClub.reputation * playerClub.reputation * SPONSORSHIP_REP_MULTIPLIER);
    // Merchandise: scales with fan base
    const merchandiseIncome = Math.round(playerClub.fanBase * MERCHANDISE_FAN_MULTIPLIER);
    const weeklyIncome = matchdayIncome + commercialIncome + stadiumIncome + positionPrize + sponsorIncome + merchandiseIncome;
    const staffWages = staff.members.reduce((sum, s) => sum + s.wage, 0);
    // Scouting costs: each active assignment costs money per week
    const scoutingCosts = newScouting.assignments.length * SCOUTING_COST_PER_ASSIGNMENT;
    const totalExpenses = playerClub.wageBill + staffWages + scoutingCosts;
    newClubs[playerClubId] = { ...playerClub, budget: playerClub.budget + weeklyIncome - totalExpenses };

    const newFinanceHistory = [...state.financeHistory, {
      week: newWeek, season, income: weeklyIncome, expenses: totalExpenses, transfers: 0, balance: newClubs[playerClubId].budget,
    }];

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

    // Notify newly unlocked achievements
    for (const id of newAchievements) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        newMessages = addMsg(newMessages, {
          week: newWeek, season, type: 'general',
          title: `Achievement Unlocked: ${ach.title}`,
          body: `${ach.icon} ${ach.description}`,
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
            lp.overall = calculateOverallExport(attrs, lp.position);
          }
        }
        newPlayers[loan.playerId] = lp;
      }
    }

    // Evaluate weekly objectives from the previous week, then generate new ones
    const objCtx: ObjectiveContext = {
      playerClubId, players: newPlayers, playerIds: playerClub.playerIds,
      fixtures: updatedFixtures, leagueTable, week, season, lineup: playerClub.lineup,
    };
    const { updated: evalObjectives, xpEarned: objXP } = evaluateObjectives(state.weeklyObjectives, objCtx);
    let updatedProgression = state.managerProgression;
    if (objXP > 0) {
      updatedProgression = grantXP(updatedProgression, objXP);
      const completedCount = evalObjectives.filter(o => o.completed).length;
      newMessages = addMsg(newMessages, {
        week: newWeek, season, type: 'general',
        title: `Weekly Objectives: ${completedCount}/${evalObjectives.length} Complete`,
        body: `You earned ${objXP} XP from this week's objectives!`,
      });
    }
    const nextWeekHasMatch = updatedFixtures.some(m => !m.played && m.week === newWeek && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    const newObjectives = generateWeeklyObjectives(nextWeekHasMatch);

    set({
      week: newWeek, fixtures: updatedFixtures, players: newPlayers,
      leagueTable, transferWindowOpen, currentMatchResult: null,
      messages: newMessages, incomingOffers: newOffers, clubs: newClubs,
      matchSubsUsed: 0, boardObjectives: updatedObjectives,
      training: { ...training, tacticalFamiliarity: newTacticalFamiliarity },
      scouting: newScouting, facilities: newFacilities, youthAcademy: newYouthAcademy,
      financeHistory: newFinanceHistory,
      unlockedAchievements: allUnlocked,
      cup: newCup,
      activeChallenge: updatedChallenge,
      divisionFixtures: updatedDivisionFixtures, divisionTables,
      careerTimeline: [...state.careerTimeline, ...newTimeline],
      weeklyObjectives: newObjectives,
      managerProgression: updatedProgression,
      pendingStoryline: pendingStorylineEvent || null,
      activeStorylineChains: updatedChains,
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
                newLoanOffers = [...newLoanOffers, {
                  id: crypto.randomUUID(),
                  playerId: fp.id,
                  fromClubId: aiClub.id,
                  durationWeeks: pick([...AI_LOAN_DURATIONS]),
                  wageSplit: pick([...AI_LOAN_WAGE_SPLITS]),
                  recallClause: Math.random() < AI_LOAN_RECALL_CLAUSE_CHANCE,
                  week: newWeek,
                }];
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

    // AI inter-club transfers: during transfer windows, AI clubs buy from each other
    if (transferWindowOpen && Math.random() < AI_TRANSFER_CHANCE) {
      const latestState = get();
      const latestPlayers = { ...latestState.players };
      const latestClubs = { ...latestState.clubs };
      const aiClubIds = Object.keys(latestClubs).filter(id => id !== playerClubId);
      const buyerClubId = pick(aiClubIds);
      const buyerClub = { ...latestClubs[buyerClubId] };
      // Find weakest position in buyer's squad
      const buyerSquad = buyerClub.playerIds.map(id => latestPlayers[id]).filter(Boolean);
      const positionCounts: Record<string, number> = {};
      buyerSquad.forEach(p => { positionCounts[p.position] = (positionCounts[p.position] || 0) + 1; });
      const weakPos = (['GK', 'CB', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST'] as Position[])
        .filter(pos => (positionCounts[pos] || 0) < 2)
        .sort((a, b) => (positionCounts[a] || 0) - (positionCounts[b] || 0))[0];
      if (weakPos) {
        // Find a seller with surplus at that position
        const sellerIds = aiClubIds.filter(id => id !== buyerClubId);
        for (const sellerId of sellerIds) {
          const seller = latestClubs[sellerId];
          const sellerSquad = seller.playerIds.map(id => latestPlayers[id]).filter(Boolean);
          const surplus = sellerSquad.filter(p => p.position === weakPos && !seller.lineup.includes(p.id));
          if (surplus.length > 0 && buyerClub.budget > AI_TRANSFER_MIN_BUDGET) {
            const target = surplus.sort((a, b) => b.overall - a.overall)[0];
            const fee = Math.round(target.value * (AI_TRANSFER_FEE_BASE + Math.random() * AI_TRANSFER_FEE_RANGE));
            if (fee <= buyerClub.budget * AI_TRANSFER_MAX_BUDGET_RATIO) {
              // Execute transfer
              const updSeller = { ...latestClubs[sellerId] };
              updSeller.playerIds = updSeller.playerIds.filter(id => id !== target.id);
              updSeller.lineup = updSeller.lineup.filter(id => id !== target.id);
              updSeller.subs = updSeller.subs.filter(id => id !== target.id);
              updSeller.budget += fee;
              updSeller.wageBill -= target.wage;
              buyerClub.playerIds = [...buyerClub.playerIds, target.id];
              buyerClub.budget -= fee;
              buyerClub.wageBill += target.wage;
              latestPlayers[target.id] = { ...target, clubId: buyerClubId };
              latestClubs[sellerId] = updSeller;
              latestClubs[buyerClubId] = buyerClub;
              set({ players: latestPlayers, clubs: latestClubs });
              break;
            }
          }
        }
      }
    }

    // Auto-save after advancing week
    if (get().settings.autoSave) get().saveGame();
  },

  playCurrentMatch: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training } = state;
    const match = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    if (!match) return null;

    const hc = clubs[match.homeClubId];
    const ac = clubs[match.awayClubId];
    const hp = hc.lineup.map(id => players[id]).filter(Boolean);
    const ap = ac.lineup.map(id => players[id]).filter(Boolean);

    const isPlayerHome = match.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;
    // Store pre-match league position
    const preEntry = state.leagueTable.find(e => e.clubId === playerClubId);
    const prePos = preEntry ? state.leagueTable.indexOf(preEntry) + 1 : 10;

    const matchDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const { result, playerRatings } = simulateMatch(match, hc, ac, hp, ap, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, matchDerbyIntensity);

    const processed = processMatchResult(state, match, result, playerRatings, () => get().week);

    // Generate post-match press conference
    const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
    const press = generatePressConference(pressContext);

    const syncedDivFixtures = { ...state.divisionFixtures, [state.playerDivision]: processed.updatedFixtures };
    set({
      fixtures: processed.updatedFixtures, players: processed.newPlayers, leagueTable: processed.leagueTable,
      currentMatchResult: result, boardConfidence: processed.confidence, messages: processed.newMessages,
      matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
      pendingPressConference: press,
      divisionFixtures: syncedDivFixtures,
      divisionTables: { ...state.divisionTables, [state.playerDivision]: processed.leagueTable },
      careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
      managerProgression: processed.managerProgression,
      preMatchLeaguePosition: prePos,
      lastMatchXPGain: processed.xpGain,
    });
    return result;
  },

  playFirstHalf: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training } = state;
    const match = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
    if (!match) return null;

    const hc = clubs[match.homeClubId];
    const ac = clubs[match.awayClubId];
    const hp = hc.lineup.map(id => players[id]).filter(Boolean);
    const ap = ac.lineup.map(id => players[id]).filter(Boolean);

    const isPlayerHome = match.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;

    // Store pre-match league position for post-match popup
    const preMatchEntry = state.leagueTable.find(e => e.clubId === playerClubId);
    const preMatchPos = preMatchEntry ? state.leagueTable.indexOf(preMatchEntry) + 1 : 10;

    const halfDerbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
    const halfState = simulateHalf(hc, ac, hp, ap, 1, 45, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, undefined, halfDerbyIntensity);

    set({ halfTimeState: halfState, matchPhase: 'half_time', matchSubsUsed: 0, preMatchLeaguePosition: preMatchPos });
    return halfState;
  },

  playSecondHalf: () => {
    const state = get();
    const { week, fixtures, clubs, players, playerClubId, tactics, training, halfTimeState } = state;
    if (!halfTimeState) return null;

    const match = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
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
    const fullState = simulateHalf(hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity, playerClubId, halfTimeState, secondHalfDerbyIntensity);
    const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, fullState);

    const processed = processMatchResult(state, match, result, playerRatings, () => get().week);

    // Generate post-match press conference
    const pressContext2 = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
    const press2 = generatePressConference(pressContext2);

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
    });
    return result;
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
      transferMarket: state.transferMarket, shortlist: state.shortlist,
      boardObjectives: state.boardObjectives, boardConfidence: state.boardConfidence,
      trainingFocus: state.trainingFocus, totalWeeks: state.totalWeeks,
      messages: state.messages, seasonHistory: state.seasonHistory,
      incomingOffers: state.incomingOffers,
      settings: state.settings, tactics: state.tactics, training: state.training,
      staff: state.staff, scouting: state.scouting, youthAcademy: state.youthAcademy,
      facilities: state.facilities, financeHistory: state.financeHistory,
      unlockedAchievements: state.unlockedAchievements, managerStats: state.managerStats,
      activeLoans: state.activeLoans, incomingLoanOffers: state.incomingLoanOffers,
      cup: state.cup,
      fanMood: state.fanMood,
      activeChallenge: state.activeChallenge,
      divisionFixtures: state.divisionFixtures,
      divisionTables: state.divisionTables,
      divisionClubs: state.divisionClubs,
      playerDivision: state.playerDivision,
      derbies: state.derbies,
      seasonPhase: state.seasonPhase,
      playoffs: state.playoffs,
      lastPromotionRelegation: state.lastPromotionRelegation,
      clubRecords: state.clubRecords,
      careerTimeline: state.careerTimeline,
      managerProgression: state.managerProgression,
      weeklyObjectives: state.weeklyObjectives,
      pendingStoryline: state.pendingStoryline,
      activeStorylineChains: state.activeStorylineChains,
      preMatchLeaguePosition: state.preMatchLeaguePosition,
      lastMatchXPGain: state.lastMatchXPGain,
    };
    localStorage.setItem(`dynasty-save-${s}`, JSON.stringify(saveData));
  },

  loadGame: (slot?: number) => {
    migrateLegacySave();
    const s = slot ?? get().activeSlot;
    const raw = localStorage.getItem(`dynasty-save-${s}`);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const data = migrateSaveData(parsed);
      const clubIds = Object.keys(data.clubs);
      const leagueTable = buildLeagueTable(data.fixtures, clubIds);

      // Ensure division data exists (backward compat for old saves)
      const playerDivision: DivisionId = data.playerDivision || 'div-1';
      const divisionClubs: Record<DivisionId, string[]> = data.divisionClubs || { 'div-1': clubIds, 'div-2': [], 'div-3': [], 'div-4': [] };
      const divisionFixtures: Record<DivisionId, Match[]> = data.divisionFixtures || { 'div-1': data.fixtures, 'div-2': [], 'div-3': [], 'div-4': [] };
      const divisionTables = buildAllDivisionTables(divisionFixtures, divisionClubs);

      set({
        gameStarted: true, ...data, leagueTable,
        activeSlot: s,
        currentScreen: 'dashboard', previousScreen: null,
        currentMatchResult: null, selectedPlayerId: null,
        transferWindowOpen: data.week <= SUMMER_WINDOW_END || (data.week >= WINTER_WINDOW_START && data.week <= WINTER_WINDOW_END),
        matchSubsUsed: 0,
        matchPlayerRatings: [],
        unlockedAchievements: data.unlockedAchievements || [],
        managerStats: data.managerStats || { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
        activeLoans: data.activeLoans || [],
        incomingLoanOffers: data.incomingLoanOffers || [],
        cup: data.cup || generateCupDraw(clubIds, data.clubs),
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
        playoffs: data.playoffs || [],
        lastPromotionRelegation: data.lastPromotionRelegation || null,
        weeklyObjectives: data.weeklyObjectives || [],
        pendingStoryline: data.pendingStoryline || null,
        activeStorylineChains: data.activeStorylineChains || [],
        preMatchLeaguePosition: data.preMatchLeaguePosition ?? 10,
        lastMatchXPGain: data.lastMatchXPGain ?? 0,
      });
      return true;
    } catch { return false; }
  },

  resetGame: (slot?: number) => {
    const s = slot ?? get().activeSlot;
    localStorage.removeItem(`dynasty-save-${s}`);
    set({ gameStarted: false, playerClubId: '', currentScreen: 'dashboard', clubs: {}, players: {}, fixtures: [], leagueTable: [], messages: [], seasonHistory: [], incomingOffers: [] });
  },

  // ── Prestige ──
  startPrestige: (optionId: 'rival' | 'drop-division' | 'restart-perks') => {
    const state = get();
    const currentProg = state.managerProgression;
    const newPrestigeLevel = (currentProg.prestigeLevel || 0) + 1;

    // Save to Hall of Managers before resetting
    try {
      const entry = buildHallEntry(state.seasonHistory, state.managerStats, state.playerClubId, state.clubs, currentProg);
      saveToHall(entry);
    } catch { /* hall of managers save is best-effort */ }

    // Determine new club based on prestige option
    const currentClubId = state.playerClubId;
    const allClubs = CLUBS_DATA;

    let newClubId: string;
    let budgetMultiplier = 1;
    let preserveProgression = true;

    if (optionId === 'rival') {
      // Pick a random different club in the same division
      const sameDivision = allClubs.filter(c => c.divisionId === state.playerDivision && c.id !== currentClubId);
      newClubId = sameDivision.length > 0 ? sameDivision[Math.floor(Math.random() * sameDivision.length)].id : currentClubId;
    } else if (optionId === 'drop-division') {
      // Pick a random club from a lower division
      const currentDiv = state.playerDivision;
      const divNum = parseInt(currentDiv.split('-')[1] || '1', 10) || 1;
      const lowerDiv = `div-${Math.min(divNum + 1, 4)}` as DivisionId;
      const lowerClubs = allClubs.filter(c => c.divisionId === lowerDiv);
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
  pendingFarewell: null as GameState['pendingFarewell'],

  dismissFarewell: () => {
    set({ pendingFarewell: null });
  },
});
