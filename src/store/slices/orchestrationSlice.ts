import * as Sentry from '@sentry/react';
import { Club, Player, TransferListing, Message, Match, MatchEvent, LeagueId, LeagueTableEntry, PenaltyKick } from '@/types/game';
import { calculateReputationTier } from '@/utils/managerCareer';
import {
  MOD_DISCIPLINE_CARDS, REP_WIN, REP_DRAW, REP_LOSS, REP_MIN, REP_MAX,
} from '@/config/managerCareer';
import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, getDerbyIntensity, clearLeagueTableCache, generateFriendlies, getLeaguesByCountry } from '@/data/league';
import { FRIENDLY_BOARD_CONFIDENCE_MULT } from '@/config/gameBalance';
import { generateSquad, selectBestLineup, buildPlayerFromTemplate } from '@/utils/playerGen';
import { resetRealPlayerClaims, claimRealPlayer } from '@/utils/realPlayerPicker';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { getActivePool, drawForMarket, drawForFaPoolSeed } from '@/utils/communityPackPool';
import {
  CP_FA_SEED_COUNT_BY_SEASON, CP_FA_SEED_ELITE_COUNT, CP_FA_SEED_TOP_COUNT, CP_FA_SEED_ELITE_MIN_OVR, CP_FA_SEED_TOP_MIN_OVR, CP_FA_SEED_MID_MIN_OVR, CP_FA_SEED_MIN_AGE, CP_FA_SEED_MAX_AGE,
} from '@/config/aiSimulation';
import { simulateMatch, simulateHalf, finalizeMatch, generateMatchWeather } from '@/engine/match';
import { generateInitialStaff, generateStaffMarket, getStaffBonus } from '@/utils/staff';

import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { guardAsync } from '@/utils/asyncGuard';
import { addGameBreadcrumb } from '@/utils/sentry';
import { track } from '@/utils/analytics';
import { fnv1a } from '@/utils/hashString';
import { migrateLegacySave, saveSessionSnapshot, readSaveSlot, readSaveSlotBackup, writeSaveSlot, promoteSaveBackup, removeSaveSlot, recoverStaleSaveTmp, trimFixturesForSave, trimFixtureArrayForSave } from '@/store/helpers/persistence';
import { migrateSaveData, validateSaveShape, isSaveFromNewerVersion, CURRENT_VERSION } from '@/utils/saveMigration';

import { generateCupDraw, advanceCupRound, getRoundName } from '@/data/cup';

import { isGroupStageComplete, generateKnockoutFromGroups, isKnockoutRoundComplete, advanceKnockoutRound, createEphemeralClub, findPlayerContinentalMatch } from '@/utils/continental';
import { CONTINENTAL_PRIZE_MONEY } from '@/config/continental';
import { generatePressConference } from '@/data/pressConferences';
import { isPro } from '@/utils/monetization';

import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';

import { createEmptyRecords } from '@/utils/records';

import { getDefaultMerchState } from '@/utils/merchandise';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';

import { MOTIVATE_ATTACK_BOOST, MOTIVATE_FOUL_BONUS, CALM_DEFENSE_BOOST, CALM_FOUL_REDUCTION, DEMAND_ATTACK_BOOST, DEMAND_DEFENSE_PENALTY, MOTIVATE_FITNESS_DRAIN_MULT, CALM_FITNESS_DRAIN_MULT, DEMAND_FITNESS_DRAIN_MULT } from '@/config/teamTalk';
import {
  TOTAL_WEEKS, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY, STADIUM_LEVEL_DIVISOR, MEDICAL_LEVEL_FACTOR, RECOVERY_LEVEL_FACTOR, FACILITY_MAX_LEVEL, CUP_EXTRA_TIME_GOAL_CHANCE, CUP_PENALTY_GK_QUALITY_FACTOR, CUP_PENALTY_KICKS, MOTIVATOR_MORALE_BOOST, CUP_EXTRA_TIME_REPUTATION_DIVISOR, FORFEIT_SCORE, LINEUP_SIZE,
} from '@/config/gameBalance';
import {
  SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END,
} from '@/config/transfers';

import { generateInitialMarket, generateInitialFreeAgents, generatePreSeasonMarket } from '@/utils/transferMarketGen';
import { PENALTY_CONVERSION_RATE, SHOUT_MODIFIERS, SHOUT_CUMULATIVE_SCALE } from '@/config/matchEngine';

import { resetSeasonGrowth, hydrateSeasonGrowth } from '@/store/helpers/development';

import { detectMatchDrama } from '@/utils/celebrations';

import { generateMonthlyObjectives } from '@/utils/weeklyObjectives';

import { generateAIManagerProfile, getAICounterTactics } from '@/config/aiManager';

import { createMilestone } from '@/utils/milestones';
import { createDefaultProgression, MANAGER_PERKS, canUnlockPerk, hasPerk, dynastyMult } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';
import { initializeClubPowerRankings, updateEloRatings } from '@/utils/teamRankings';
import type { PerkId, ManagerProgression } from '@/types/game';
import { processMatchResult } from '@/store/helpers/matchProcessing';
import { generateStarterDeals } from '@/store/slices/sponsorSlice';
import {
  rebuildRealPlayerClaims, applyAIMatchEvents, generateObjectives,
} from '@/store/slices/orchestration/helpers';
import {
  generateLeagueCupDraw, getContinentalMatchLabel, isAggregateDecided, advanceLeagueCupRound,
} from '@/store/slices/orchestration/tournaments';
import { endSeasonImpl } from '@/store/slices/orchestration/seasonEnd';
import { advanceWeekImpl } from '@/store/slices/orchestration/weekAdvance';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;
let lastSaveErrorLogAt = 0;
let lastSaveAt = 0;
let lastSavedHash: number | null = null; // FNV-1a of the last successfully written payload
const SAVE_DEBOUNCE_MS = 2000; // Minimum 2s between auto-saves
const AGGRESSIVE_TRIM_THRESHOLD = 3_000_000; // >3MB → strip ALL match events
// Pre-flight threshold: roughly 30k event records translates to ~3MB of JSON,
// so we strip aggressively before the first stringify instead of after.
const AGGRESSIVE_TRIM_EVENT_COUNT = 30_000;

// ── Async save scheduler ──
// Auto-saves run inside requestIdleCallback so JSON.stringify of the full game
// state (100KB+) doesn't block the main thread during match/week transitions.
// On tab close or app pause, flushPendingOnly() completes any scheduled work.
type IdleHandle = number;
let pendingIdleHandle: IdleHandle | null = null;
let pendingSlot: number | undefined;
let runSchedulerWork: (() => void) | null = null;

/** Reset the change-detection hash. Call on loadGame / resetGame so the next
 *  save isn't short-circuited against a stale hash from a prior session. */
export function resetSaveHash(): void {
  lastSavedHash = null;
}

/** Cancel any scheduled but not-yet-fired autosave. Call before destructive
 *  state transitions (resetGame, loadGame, switching slots) so the pending
 *  callback doesn't fire against the new state and clobber a freshly loaded
 *  slot or resurrect a slot that was just wiped. */
function cancelPendingSave(): void {
  if (pendingIdleHandle !== null) {
    cancelIdle(pendingIdleHandle);
    pendingIdleHandle = null;
  }
  runSchedulerWork = null;
  pendingSlot = undefined;
}

/** Test-only: zero every piece of module-level save scheduler state so each
 *  test file starts from a clean slate. Never call from production code. */
export function __resetAutosaveSchedulerForTests(): void {
  cancelPendingSave();
  lastSaveAt = 0;
  lastSaveErrorLogAt = 0;
  lastSavedHash = null;
}

function cancelIdle(handle: IdleHandle): void {
  if (typeof window === 'undefined') { clearTimeout(handle); return; }
  const w = window as Window & { cancelIdleCallback?: (h: IdleHandle) => void };
  if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(handle);
  else clearTimeout(handle);
}

function requestIdle(cb: () => void): IdleHandle {
  if (typeof window === 'undefined') return setTimeout(cb, 0) as unknown as IdleHandle;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => IdleHandle };
  if (typeof w.requestIdleCallback === 'function') return w.requestIdleCallback(cb, { timeout: 2000 });
  return setTimeout(cb, 0) as unknown as IdleHandle;
}

/** Count bytes of match events across trimmed fixtures. Used as a cheap
 *  pre-flight check to decide whether we need the aggressive-trim path
 *  before the first JSON.stringify — avoids a double serialization on
 *  very large saves. */
function countFixtureEventBytes(
  divFixtures: Record<string, unknown[]> | undefined,
  flatFixtures: unknown[] | undefined,
): number {
  let total = 0;
  const accumulate = (fx: unknown[]) => {
    for (const f of fx) {
      const m = f as { events?: unknown[] };
      if (m.events && m.events.length > 0) total += m.events.length;
    }
  };
  if (divFixtures) for (const fx of Object.values(divFixtures)) accumulate(fx);
  if (flatFixtures) accumulate(flatFixtures);
  return total;
}

const stripAllEvents = (fixtures: unknown[]): unknown[] =>
  fixtures.map((f: unknown) => {
    const m = f as { played?: boolean; events?: unknown[]; stats?: unknown };
    if (!m.played || !m.events) return m;
    const { events: _e, stats: _s, ...rest } = m as Record<string, unknown>;
    return rest;
  });

/** Serialize state and write to the active save slot. Runs inside the idle
 *  callback for auto-saves, or synchronously for manual saves and flushes.
 *  Updates saveStatus / lastSavedAt so the UI can reflect the result.
 *  Short-circuits via FNV-1a hash when the serialized payload is unchanged. */
function performSave(set: Set, get: Get, slot: number | undefined): void {
  const state = get();

  // Seatbelt: if we're somehow invoked without an active game (e.g. after a
  // reset cleared state but cancelPendingSave failed, or a future caller
  // forgets to guard), bail out instead of writing an empty-state "ghost save".
  if (!state.gameStarted || !state.playerClubId) {
    set({ saveStatus: 'idle' });
    return;
  }

  const s = slot ?? state.activeSlot;

  let divFixturesForSave: Record<string, unknown[]> | undefined = state.divisionFixtures
    ? trimFixturesForSave(state.divisionFixtures, state.playerClubId)
    : state.divisionFixtures;
  let flatFixturesForSave: unknown[] | undefined = state.fixtures
    ? trimFixtureArrayForSave(state.fixtures, state.playerClubId)
    : state.fixtures;

  // Pre-flight: if we're carrying an unusually large number of event records,
  // apply aggressive event-stripping BEFORE the first stringify so we only
  // serialize once on large saves.
  if (countFixtureEventBytes(divFixturesForSave, flatFixturesForSave) > AGGRESSIVE_TRIM_EVENT_COUNT) {
    if (divFixturesForSave) {
      const aggressiveTrim: Record<string, unknown[]> = {};
      for (const [div, fx] of Object.entries(divFixturesForSave)) {
        aggressiveTrim[div] = stripAllEvents(fx);
      }
      divFixturesForSave = aggressiveTrim;
    }
    if (flatFixturesForSave) flatFixturesForSave = stripAllEvents(flatFixturesForSave);
  }

  const saveData = {
    version: CURRENT_VERSION,
    activeSlot: s,
    playerClubId: state.playerClubId, season: state.season, week: state.week,
    clubs: state.clubs, players: state.players, fixtures: flatFixturesForSave,
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
    divisionFixtures: divFixturesForSave,
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
    // Pack Opening — persist opened-packs log, pity counter, and the
    // ad-pack daily-open bucket so the per-day limit survives save/load.
    // `lastPackWeek` / `lastPackSeason` are legacy fields kept for save
    // compatibility; the once-per-week cooldown they enforced has been
    // removed.
    openedPacks: state.openedPacks || [],
    packPityCounter: state.packPityCounter || 0,
    lastPackWeek: state.lastPackWeek || 0,
    lastPackSeason: state.lastPackSeason || 0,
    dailyPackOpens: state.dailyPackOpens || { date: '', free: {}, ad: {} },
  };
  let json = JSON.stringify(saveData);

  // Fallback safety net: if our pre-flight underestimated and we still exceed
  // the quota threshold, apply aggressive trim and re-stringify. Rare because
  // the pre-flight above usually catches it.
  if (json.length > AGGRESSIVE_TRIM_THRESHOLD) {
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

  // Change detection: if the payload is byte-identical to our last successful
  // write, skip the localStorage roundtrip. We still refresh lastSavedAt so
  // the indicator doesn't drift into a stale "5m ago" while the game is idle.
  const payloadHash = fnv1a(json);
  if (payloadHash === lastSavedHash) {
    set({ saveStatus: 'saved', lastSavedAt: Date.now(), saveFailureMessage: null });
    return;
  }

  let saveFailed = false;
  try {
    writeSaveSlot(s, json);
    lastSavedHash = payloadHash;
  } catch (err) {
    saveFailed = true;
    const errTime = Date.now();
    if (errTime - lastSaveErrorLogAt > 10000) {
      Sentry.captureException(err, { tags: { context: 'saveGame' } });
      lastSaveErrorLogAt = errTime;
    }
    // Use functional set() so we read the freshest messages — the idle
    // callback may have been scheduled seconds ago and state has moved on.
    set(s0 => {
      const hasSaveWarningThisWeek = s0.messages.some(
        m => m.title === 'Save Failed' && m.week === s0.week && m.season === s0.season,
      );
      if (hasSaveWarningThisWeek) return {};
      return {
        messages: addMsg(s0.messages, {
          type: 'warning',
          title: 'Save Failed',
          body: 'Your game could not be saved. We’ll keep retrying automatically. If this keeps happening, restart the app.',
          week: s0.week,
          season: s0.season,
        }),
      };
    });
  }

  if (saveFailed) {
    set({ saveStatus: 'failed', saveFailureMessage: 'Save could not be written' });
    addGameBreadcrumb('save', 'Save failed', {
      week: state.week,
      season: state.season,
      slot: s,
      bytes: json.length,
    });
  } else {
    set({ saveStatus: 'saved', lastSavedAt: Date.now(), saveFailureMessage: null });
    addGameBreadcrumb('save', 'Save succeeded', {
      week: state.week,
      season: state.season,
      slot: s,
      bytes: json.length,
    });
    track('save_created', { slot: s, bytes: json.length });
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
}

// migrateLegacySave and getSlotSummaries extracted to @/store/helpers/persistence
export { getSlotSummaries } from '@/store/helpers/persistence';

// `weightedPickFromRecord`, `generateAIInjuryDetails`, `applyAIMatchEvents`,
// `rebuildRealPlayerClaims` and `generateObjectives` extracted to
// `./orchestration/helpers.ts` — see the import at the top of this file.

// `generateLeagueCupDraw`, `getContinentalMatchLabel`, `isAggregateDecided`,
// and `advanceLeagueCupRound` extracted to `./orchestration/tournaments.ts`.

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

// `advanceLeagueCupRound` is exported from `./orchestration/tournaments.ts`.

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
  initGame: async (clubId: string, options?: { communityPackEnabled?: boolean }) => {
    const communityPackEnabled = options?.communityPackEnabled ?? false;

    // Division is derived from club metadata, not the user's name — safe to
    // ship as a breadcrumb field. `clubId` is a stable internal id ("eng-liv"
    // style), not the user's custom club name.
    const initClubData = ALL_CLUBS.find(c => c.id === clubId);
    const gameMode = get().gameMode ?? 'sandbox';
    addGameBreadcrumb('game_start', 'Game started', {
      clubId,
      division: initClubData?.divisionId ?? null,
      communityPackEnabled,
      gameMode,
    });
    track('game_started', {
      communityPackEnabled,
      gameMode,
      division: initClubData?.divisionId ?? 'unknown',
    });

    // Lazy-load community pack datasets only when enabled so the default bundle
    // stays lean. Dynamic imports are cached by the module system.
    let cpByClub: Record<string, PlayerTemplate[]> | undefined;
    let cpFreeAgents: PlayerTemplate[] | undefined;
    if (communityPackEnabled) {
      const [byClubMod, freeAgentsMod, cpLeagueSquadsMod] = await Promise.all([
        import('@/data/communityPack/byClub'),
        import('@/data/communityPack/freeAgents'),
        import('@/data/communityPack/cpLeagueSquads'),
      ]);
      // Merge the 7 community-pack-only league squads (arg, mls, sau, kor,
      // bra, aus, ind) into cpByClub. byClub entries win on collision since
      // they carry richer metadata (fcId, height/weight), but the two
      // datasets cover disjoint club ids in practice.
      cpByClub = {
        ...cpLeagueSquadsMod.cpLeagueSquads,
        ...byClubMod.byClub,
      } as Record<string, PlayerTemplate[]>;
      cpFreeAgents = freeAgentsMod.freeAgents as PlayerTemplate[];
    }

    resetSeasonGrowth();
    clearLeagueTableCache();
    // Fresh game → fresh real-player claim registry. Without this, names
    // claimed by an earlier session's squad generation would still block
    // the new run from picking the same real players.
    resetRealPlayerClaims();
    // Pre-claim every community-pack template (per-club + free agents)
    // before any squad is generated, so the FC26 real-player picker that
    // backs `generateSquad` can't hand the same person to a non-CP club
    // as a filler.
    if (cpByClub) {
      for (const list of Object.values(cpByClub)) {
        for (const t of list) claimRealPlayer(t);
      }
    }
    if (cpFreeAgents) {
      for (const t of cpFreeAgents) claimRealPlayer(t);
    }
    const allPlayers: Record<string, Player> = {};
    const clubs: Record<string, Club> = {};
    const assignedFcIds: string[] = [];

    // Find which league the selected club belongs to
    const selectedClubData = ALL_CLUBS.find(c => c.id === clubId);
    const playerDivision = selectedClubData?.divisionId || 'eng';
    const league = LEAGUES.find(l => l.id === playerDivision);

    // Load clubs for ALL tiers in the player's country (for promotion/relegation)
    const countryId = league?.countryId || playerDivision;
    const countryLeagues = getLeaguesByCountry(countryId);
    const countryLeagueIds = countryLeagues.map(l => l.id);
    const leagueClubData = ALL_CLUBS.filter(cd => countryLeagueIds.includes(cd.divisionId));

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

      const cpTemplates = communityPackEnabled ? cpByClub?.[club.id] : undefined;
      const squad = cpTemplates && cpTemplates.length > 0
        ? cpTemplates.map(t => {
            if (t.fcId) assignedFcIds.push(t.fcId);
            return buildPlayerFromTemplate(t, club.id, 1);
          })
        : generateSquad(club.id, cd.squadQuality, 1, cd.divisionId, /* isInitialSeason */ true);
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

    // Build league structures for ALL tiers in the country
    const divisionClubs: Record<string, string[]> = {};
    const divisionFixtures: Record<string, Match[]> = {};
    const divisionTables: Record<string, LeagueTableEntry[]> = {};
    for (const cl of countryLeagues) {
      const clubIds = leagueClubData.filter(cd => cd.divisionId === cl.id).map(cd => cd.id);
      divisionClubs[cl.id] = clubIds;
      divisionFixtures[cl.id] = generateDivisionFixtures(clubIds, cl.totalWeeks || TOTAL_WEEKS);
      divisionTables[cl.id] = buildLeagueTable(divisionFixtures[cl.id], clubIds);
    }
    const leagueClubIds = divisionClubs[playerDivision] || [];
    const fixtures = divisionFixtures[playerDivision];
    const leagueTable = divisionTables[playerDivision];

    // Seed the transfer market at game start so week 1 has browsable players
    // while the summer window is open. Mirrors the end-of-season rollover path
    // (generateInitialMarket + generatePreSeasonMarket) so S1 behaves like any
    // other pre-season. Community-pack listings below stack on top.
    const transferMarket: TransferListing[] = [];
    const initialSeasonMarket = generateInitialMarket(1, 1);
    Object.assign(allPlayers, initialSeasonMarket.players);
    transferMarket.push(...initialSeasonMarket.listings);
    const initialPreSeasonMarket = generatePreSeasonMarket(1, 1);
    Object.assign(allPlayers, initialPreSeasonMarket.players);
    transferMarket.push(...initialPreSeasonMarket.listings);

    // cpPool state accumulates as we seed the world. The shuffleSeed is fixed
    // per save so the active pool is reproducible across sessions.
    const cpShuffleSeed = communityPackEnabled ? Date.now() % 0x80000000 : 0;
    const cpMarketListings: string[] = [];

    // Seed the transfer market from the community pack free-agent pool so the
    // player has ~60 real players to browse on day one when the pack is on.
    if (communityPackEnabled && cpFreeAgents) {
      const activePool = getActivePool(cpFreeAgents, {
        shuffleSeed: cpShuffleSeed,
        cursor: 0,
        usedFcIds: assignedFcIds,
        marketListings: [],
        lastMarketRefreshWeek: 0,
        lastSeedSeason: 0,
      });
      const initialMarket = drawForMarket(activePool, 60, assignedFcIds, cpShuffleSeed);
      for (const t of initialMarket) {
        const player = buildPlayerFromTemplate(t, '', 1);
        if (t.fcId) player.fcId = t.fcId;
        allPlayers[player.id] = player;
        const markup = 1.1 + Math.random() * 0.4;
        transferMarket.push({
          playerId: player.id,
          askingPrice: Math.max(50_000, Math.round(player.value * markup)),
          sellerClubId: '',
          externalPlayer: true,
          divisionId: '',
        });
        if (t.fcId) {
          cpMarketListings.push(t.fcId);
          assignedFcIds.push(t.fcId);
        }
      }
    }

    // Seed a small pool of free agents (2-3) so managers have a minimal
    // signing option from day one.
    const initialFreeAgents = generateInitialFreeAgents(1);
    Object.assign(allPlayers, initialFreeAgents.players);
    const initialFreeAgentIds = initialFreeAgents.freeAgentIds;

    // Phase E.7 — front-load the FA pool with real CP names at game start.
    // Seeds taper over S2/S3 in advanceWeek; after S3 the pool relies on
    // organic contract expiry. Elite count is capped tight per CP_FA_SEED_*
    // so the user sees a handful of recognisable names day one without
    // turning the FA tab into a weekly Bosman flood.
    let cpCursorAfterSeed = 0;
    if (communityPackEnabled && cpFreeAgents) {
      const s1SeedCount = CP_FA_SEED_COUNT_BY_SEASON[1] ?? 0;
      if (s1SeedCount > 0) {
        const seedActivePool = getActivePool(cpFreeAgents, {
          shuffleSeed: cpShuffleSeed,
          cursor: 0,
          usedFcIds: assignedFcIds,
          marketListings: [],
          lastMarketRefreshWeek: 0,
          lastSeedSeason: 0,
        });
        const seeds = drawForFaPoolSeed(
          seedActivePool,
          s1SeedCount,
          assignedFcIds,
          cpShuffleSeed ^ 0x5A5A5A5A,
          {
            minAge: CP_FA_SEED_MIN_AGE,
            maxAge: CP_FA_SEED_MAX_AGE,
            eliteMinOvr: CP_FA_SEED_ELITE_MIN_OVR,
            topMinOvr: CP_FA_SEED_TOP_MIN_OVR,
            midMinOvr: CP_FA_SEED_MID_MIN_OVR,
            eliteCount: CP_FA_SEED_ELITE_COUNT,
            topCount: CP_FA_SEED_TOP_COUNT,
          },
        );
        for (const t of seeds) {
          const p = buildPlayerFromTemplate(t, '', 1);
          if (t.fcId) p.fcId = t.fcId;
          p.clubId = '';
          // Match the wage-on-release reduction used by the contract-expiry
          // path so these seeds feel like "released players open to offers"
          // rather than mid-contract stars.
          p.wage = Math.round(p.wage * 0.8);
          allPlayers[p.id] = p;
          initialFreeAgentIds.push(p.id);
          if (t.fcId) assignedFcIds.push(t.fcId);
        }
        cpCursorAfterSeed = seeds.length;
      }
    }

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
      gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: league?.totalWeeks || TOTAL_WEEKS,
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
      openedPacks: [],
      packPityCounter: 0,
      lastPackWeek: 0,
      lastPackSeason: 0,
      dailyPackOpens: { date: '', free: {}, ad: {} },
      sponsorDeals: generateStarterDeals(pcInit.reputation, 1),
      sponsorOffers: [],
      sponsorSlotCooldowns: {},
      negotiationStrikes: {},
      contractStrikes: {},
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
      communityPackEnabled,
      cpPool: {
        shuffleSeed: cpShuffleSeed,
        // Advance the cursor by the seed count so subsequent refreshes
        // draw from fresh territory in the shuffle, not the same 800-
        // window we just pulled seeds from.
        cursor: cpCursorAfterSeed,
        usedFcIds: communityPackEnabled ? assignedFcIds : [],
        marketListings: cpMarketListings,
        lastMarketRefreshWeek: 0,
        // S1 seed was placed above; mark it done so the advanceWeek
        // week-1 check doesn't re-seed S1.
        lastSeedSeason: 1,
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
      const hp = hc.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured).slice(0, LINEUP_SIZE);
      const ap = ac.playerIds.map(id => newPlayers[id]).filter(Boolean).filter(p => !p.injured).slice(0, LINEUP_SIZE);
      if (hp.length === 0 || ap.length === 0) {
        m.played = true;
        m.homeGoals = hp.length === 0 ? 0 : FORFEIT_SCORE;
        m.awayGoals = ap.length === 0 ? 0 : FORFEIT_SCORE;
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

  advanceWeek: async () => {
    await advanceWeekImpl(set, get);
  },

  advanceToNextMatch: async () => {
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
      // `advanceWeek` is async when Community Pack is enabled (it
      // dynamic-imports the free-agents dataset on the 4-weekly market
      // refresh). Without `await` the loop would fire overlapping advances,
      // each reading stale state via get() — a real race on CP saves.
      await s.advanceWeek();
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
            const homeStr = hc.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
            const awayStr = ac.reputation / CUP_EXTRA_TIME_REPUTATION_DIVISOR;
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
      const hp2 = hAvail2.slice(0, LINEUP_SIZE);
      const ap2 = aAvail2.slice(0, LINEUP_SIZE);
      if (hp2.length === 0 || ap2.length === 0) {
        fullFixtures[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap2.length === 0 ? 0 : FORFEIT_SCORE, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
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
      lastMatchCompetition: null,
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
      try {
        get().cleanupAbandonedMatch();
        set({
          messages: addMsg(get().messages, {
            week: get().week, season: get().season, type: 'general',
            title: 'Match Error',
            body: 'An error occurred during the match simulation. The match has been abandoned.',
          }),
        });
      } catch (cleanupErr) {
        Sentry.captureException(cleanupErr, { tags: { context: 'matchCleanup' } });
      }
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

    // Friendly match — no league table / fixtures update, no rank change
    if (friendlyMatch) {
      const processed = processMatchResult(state, match, result, playerRatings, () => get().week, fullState.matchInjuries);
      const confDelta = (processed.confidence - (state.boardConfidence || 50)) * FRIENDLY_BOARD_CONFIDENCE_MULT;
      const friendlyConfidence = Math.max(0, Math.min(100, (state.boardConfidence || 50) + confDelta));
      const pressContext = processed.won ? 'post_win' : processed.lost ? 'post_loss' : 'post_draw';
      const drama = detectMatchDrama(result, playerClubId, clubs);

      set({
        friendlies: state.friendlies.map(f => f.id === match.id ? result : f),
        currentMatchResult: result,
        players: processed.newPlayers,
        boardConfidence: friendlyConfidence,
        messages: processed.newMessages,
        matchSubsUsed: 0, matchPlayerRatings: processed.playerRatings, managerStats: processed.managerStats,
        halfTimeState: null, matchPhase: 'full_time',
        lastMatchCompetition: 'Pre-Season Friendly',
        pendingPressConference: generatePressConference(pressContext, isPro(get().monetization)),
        careerTimeline: [...state.careerTimeline, ...processed.newMilestones],
        managerProgression: processed.managerProgression,
        lastMatchXPGain: Math.round((processed.xpGain || 0) * 0.5),
        lastMatchDrama: drama,
        pairFamiliarity: processed.pairFamiliarity,
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
      const hp2 = hAvail3.slice(0, LINEUP_SIZE);
      const ap2 = aAvail3.slice(0, LINEUP_SIZE);
      if (hp2.length === 0 || ap2.length === 0) {
        fullFixtures2[idx] = { ...m, played: true, homeGoals: hp2.length === 0 ? 0 : FORFEIT_SCORE, awayGoals: ap2.length === 0 ? 0 : FORFEIT_SCORE, events: [{ minute: 0, type: 'half_time' as const, clubId: '', description: 'Match forfeited — insufficient players' }] };
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
      lastMatchCompetition: null,
      lastMatchXPGain: processed.xpGain,
      lastMatchDrama: leagueDrama,
      rivalries: processed.updatedRivalries,
      pairFamiliarity: processed.pairFamiliarity,
      clubPowerRankings: eloRankings2,
    });
    return result;
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'playSecondHalf' } });
      try {
        get().cleanupAbandonedMatch();
        set({
          messages: addMsg(get().messages, {
            week: get().week, season: get().season, type: 'general',
            title: 'Match Error',
            body: 'An error occurred during the second half. The match has been abandoned.',
          }),
        });
      } catch (cleanupErr) {
        Sentry.captureException(cleanupErr, { tags: { context: 'secondHalfCleanup' } });
      }
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

    // Flash "saving" for the UI indicator — applies to both sync manual saves
    // and async auto-saves so the user always gets feedback.
    set({ saveStatus: 'saving' });

    // Manual saves (explicit slot) run synchronously so the user sees the
    // result immediately. Auto-saves defer to an idle callback.
    if (slot !== undefined) {
      performSave(set, get, slot);
      return;
    }

    pendingSlot = slot;
    if (pendingIdleHandle !== null) return; // already scheduled — coalesce
    runSchedulerWork = () => {
      pendingIdleHandle = null;
      runSchedulerWork = null;
      performSave(set, get, pendingSlot);
    };
    pendingIdleHandle = requestIdle(runSchedulerWork);
  },

  flushSave: () => {
    // User-initiated flush (e.g. Settings "Save Now"). Always writes.
    if (pendingIdleHandle !== null && runSchedulerWork) {
      cancelIdle(pendingIdleHandle);
      pendingIdleHandle = null;
      const work = runSchedulerWork;
      runSchedulerWork = null;
      work();
      return;
    }
    lastSaveAt = Date.now();
    set({ saveStatus: 'saving' });
    performSave(set, get, undefined);
  },

  flushPendingOnly: () => {
    // Completes already-scheduled work without creating a new save. Used by
    // tests; production lifecycle hooks should call flushForLifecycle().
    if (pendingIdleHandle === null || !runSchedulerWork) return;
    cancelIdle(pendingIdleHandle);
    pendingIdleHandle = null;
    const work = runSchedulerWork;
    runSchedulerWork = null;
    work();
  },

  flushForLifecycle: () => {
    // Lifecycle-triggered flush (beforeunload / pagehide / visibilitychange /
    // Capacitor pause). Two-step behaviour:
    //   1) If an autosave is already queued, run it now.
    //   2) Otherwise, if settings.autoSave is enabled, perform a sync save —
    //      this captures memory-only mutations like updateSettings that don't
    //      enqueue their own save.
    //   3) If autoSave is off, do nothing (respect the user preference).
    if (pendingIdleHandle !== null && runSchedulerWork) {
      cancelIdle(pendingIdleHandle);
      pendingIdleHandle = null;
      const work = runSchedulerWork;
      runSchedulerWork = null;
      work();
      return;
    }
    if (!get().settings.autoSave) return;
    lastSaveAt = Date.now();
    set({ saveStatus: 'saving' });
    performSave(set, get, undefined);
  },

  loadGame: (slot?: number) => {
    // Drop any queued autosave for the outgoing state — otherwise it would
    // fire after we've swapped in the loaded data and write it back, which
    // is a wasted write at best and slot-crossover at worst.
    cancelPendingSave();
    resetSeasonGrowth();
    clearLeagueTableCache();
    migrateLegacySave();
    // Salvage any staging-area payload left over from a previous crashed
    // write. Idempotent — no-op when there's nothing to do.
    recoverStaleSaveTmp();
    const s = slot ?? get().activeSlot;
    const raw = readSaveSlot(s);
    if (!raw) return false;

    // Try to parse primary; on failure, transparently fall back to backup.
    // When neither parses we surface a loadError so the dialog can offer the
    // user a way forward (there's nothing left to try).
    let parsed: unknown = null;
    let fromBackup = false;
    try { parsed = JSON.parse(raw); }
    catch {
      Sentry.captureMessage('[Load] Primary save corrupted, trying backup', 'warning');
      const backupRaw = readSaveSlotBackup(s);
      if (backupRaw) {
        try {
          parsed = JSON.parse(backupRaw);
          fromBackup = true;
          // Promote the backup to primary so the next save cycle starts from
          // a known-good state.
          promoteSaveBackup(s, backupRaw);
        } catch { /* both corrupt */ }
      }
      if (parsed === null) {
        set({ loadError: { slot: s, kind: 'corrupt', canRecover: false, reason: 'primary and backup both unparseable' } });
        return false;
      }
    }

    // Version guard — refuse to downgrade. Loading a future-version save
    // silently drops fields and will corrupt the next write.
    if (isSaveFromNewerVersion(parsed)) {
      const v = (parsed as { version?: number }).version;
      set({ loadError: { slot: s, kind: 'newer_version', saveVersion: v, canRecover: !fromBackup && readSaveSlotBackup(s) !== null, reason: `save version ${v} > app version ${CURRENT_VERSION}` } });
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: Record<string, any>;
    try {
      data = migrateSaveData(parsed as Record<string, unknown>) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'loadGame.migrate' } });
      set({ loadError: { slot: s, kind: 'migration_failed', canRecover: !fromBackup && readSaveSlotBackup(s) !== null, reason: err instanceof Error ? err.message : 'migration threw' } });
      return false;
    }
    if (data.migrationError) {
      Sentry.captureMessage('[LoadGame] Save migration failed — save data may be corrupt', 'error');
      set({ loadError: { slot: s, kind: 'migration_failed', canRecover: !fromBackup && readSaveSlotBackup(s) !== null } });
      return false;
    }

    const shape = validateSaveShape(data);
    if (shape.ok === false) {
      const reason = shape.reason;
      Sentry.captureMessage(`[LoadGame] Validation failed: ${reason}`, 'error');
      set({ loadError: { slot: s, kind: 'validation_failed', canRecover: !fromBackup && readSaveSlotBackup(s) !== null, reason } });
      return false;
    }

    try {
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
        currentScreen:
          (data.gameMode === 'career' && data.careerManager && !data.careerManager.contract)
            ? (data.careerManager.careerHistory?.some((e: { reason: string }) => e.reason === 'retired') ? 'hall-of-managers' : 'job-market')
            : 'dashboard',
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
        // Loaded data IS the current on-disk state → reflect that in the
        // indicator so it doesn't sit blank until the first autosave fires.
        saveStatus: 'saved' as const,
        lastSavedAt: Date.now(),
        saveFailureMessage: null,
        // Clear any stale load banner — this load just succeeded.
        loadError: null,
      });
      // Reset change-detection hash — any prior session's hash is meaningless
      // now that we've replaced state wholesale.
      resetSaveHash();
      // Hydrate module-level growth tracker so development functions use persisted data
      hydrateSeasonGrowth(data.seasonGrowthTracker || {});
      // Rebuild the real-player claim registry from the loaded squad. The
      // registry lives in module state, so without this the picker either
      // (fresh tab) thinks every real player is available and could re-issue
      // them as fillers, or (same tab as a previous session) keeps stale
      // claims from the old game and blocks valid picks.
      rebuildRealPlayerClaims(data.players || {});
      track('save_loaded', { slot: s });
      return true;
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'loadGame.apply' } });
      set({ loadError: { slot: s, kind: 'validation_failed', canRecover: !fromBackup && readSaveSlotBackup(s) !== null, reason: err instanceof Error ? err.message : 'apply threw' } });
      return false;
    }
  },

  attemptSaveRecovery: (slot: number) => {
    // User clicked "Try Recovery" in the SaveRecoveryDialog. Bypasses the
    // primary and loads straight from backup. If the backup itself is
    // missing / corrupt / invalid, we surface that as a second loadError
    // and the dialog's "Recovery" action disappears (canRecover=false).
    cancelPendingSave();
    resetSeasonGrowth();
    clearLeagueTableCache();
    migrateLegacySave();
    recoverStaleSaveTmp();
    const backupRaw = readSaveSlotBackup(slot);
    if (!backupRaw) {
      set({ loadError: { slot, kind: 'corrupt', canRecover: false, reason: 'no backup to recover from' } });
      return false;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(backupRaw); }
    catch {
      set({ loadError: { slot, kind: 'corrupt', canRecover: false, reason: 'backup unparseable' } });
      return false;
    }

    if (isSaveFromNewerVersion(parsed)) {
      const v = (parsed as { version?: number }).version;
      set({ loadError: { slot, kind: 'newer_version', saveVersion: v, canRecover: false, reason: 'backup also from newer version' } });
      return false;
    }

    let data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      data = migrateSaveData(parsed as Record<string, unknown>) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'attemptSaveRecovery.migrate' } });
      set({ loadError: { slot, kind: 'migration_failed', canRecover: false, reason: err instanceof Error ? err.message : 'migration threw' } });
      return false;
    }
    if (data.migrationError) {
      set({ loadError: { slot, kind: 'migration_failed', canRecover: false } });
      return false;
    }
    const shape = validateSaveShape(data);
    if (shape.ok === false) {
      set({ loadError: { slot, kind: 'validation_failed', canRecover: false, reason: shape.reason } });
      return false;
    }

    // Promote backup → primary so subsequent saves/loads use the recovered
    // data as the known-good primary.
    try { promoteSaveBackup(slot, backupRaw); } catch { /* non-fatal */ }

    // Delegate to the main apply path by re-running loadGame now that the
    // primary is the recovered backup. Safer than duplicating the big apply
    // block here.
    return get().loadGame(slot);
  },

  clearLoadError: () => set({ loadError: null }),

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
    // Kill any pending idle save before wiping the slot — otherwise it fires
    // after reset and resurrects the slot we just deleted.
    cancelPendingSave();
    removeSaveSlot(s);
    resetSaveHash();
    set({
      saveStatus: 'idle' as const, lastSavedAt: null, saveFailureMessage: null,
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
      openedPacks: [], packPityCounter: 0, lastPackWeek: 0, lastPackSeason: 0,
      dailyPackOpens: { date: '', free: {}, ad: {} },
      activeStorylineChains: [], completedStorylineChainIds: [], weeklyObjectives: [],
      objectiveStreak: 0, objectivesStartWeek: 1, completedCoachTaskIds: [],
      weekCliffhangers: [], rivalries: {}, lastMatchDrama: null, lastMatchCompetition: null,
      sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
      weeklyDigest: null, careerTimeline: [],
      gameMode: 'sandbox', careerManager: null, jobVacancies: [], jobOffers: [],
      sponsorDeals: [], sponsorOffers: [], sponsorSlotCooldowns: {}, negotiationStrikes: {}, contractStrikes: {},
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

    // Reinitialize game with new club. initGame is only async when Community
    // Pack is enabled (dynamic imports); in the prestige-reset flow CP is
    // never threaded through, so this is effectively sync. Still guard with
    // guardAsync in case a future change enables CP through this path.
    guardAsync(
      get().initGame(newClubId),
      'resetAfterPrestige.initGame',
      { title: 'Reset failed', body: 'Could not restart for prestige bonus.' },
    );

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
