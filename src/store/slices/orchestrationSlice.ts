import * as Sentry from '@sentry/react';
import { Club, Player, Match, LeagueId } from '@/types/game';

import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, clearLeagueTableCache } from '@/data/league';

import { generateSquad, selectBestLineup } from '@/utils/playerGen';

import { simulateMatch } from '@/engine/match';

import type { GameState } from '../storeTypes';
import { addMsg, safeRandomUUID } from '@/utils/helpers';
import { guardAsync } from '@/utils/asyncGuard';
import { addGameBreadcrumb } from '@/utils/sentry';
import { track } from '@/utils/analytics';
import { fnv1a } from '@/utils/hashString';
import { migrateLegacySave, saveSessionSnapshot, readSaveSlot, readSaveSlotBackup, writeSaveSlot, promoteSaveBackup, removeSaveSlot, recoverStaleSaveTmp, trimFixturesForSave, trimFixtureArrayForSave } from '@/store/helpers/persistence';
import { migrateSaveData, validateSaveShape, isSaveFromNewerVersion, CURRENT_VERSION } from '@/utils/saveMigration';

import { generateCupDraw } from '@/data/cup';

import { createEmptyRecords } from '@/utils/records';

import { getDefaultMerchState } from '@/utils/merchandise';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';

import {
  FORFEIT_SCORE, LINEUP_SIZE,
} from '@/config/gameBalance';
import { isTransferWindowOpen } from '@/config/transfers';

import { resetSeasonGrowth, hydrateSeasonGrowth } from '@/store/helpers/development';
import { findTournamentMatch } from '@/store/slices/orchestration/helpers';

import { generateAIManagerProfile } from '@/config/aiManager';

import { createDefaultProgression, MANAGER_PERKS, canUnlockPerk } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';

import type { PerkId, ManagerProgression } from '@/types/game';

import {
  rebuildRealPlayerClaims,
} from '@/store/slices/orchestration/helpers';

import { endSeasonImpl } from '@/store/slices/orchestration/seasonEnd';
import { advanceWeekImpl } from '@/store/slices/orchestration/weekAdvance';
import {
  playCurrentMatchImpl, playFirstHalfImpl, playSecondHalfImpl, playExtraTimeImpl, playPenaltiesImpl, revealNextPenaltyKickImpl, skipPenaltyShootoutImpl,
} from '@/store/slices/orchestration/matchActions';
import {
  playWorldCupFirstHalfImpl, playWorldCupSecondHalfImpl, playWorldCupExtraTimeImpl,
  playWorldCupPenaltiesImpl, finalizeWorldCupPenaltiesImpl,
} from '@/store/slices/orchestration/worldCupMatchActions';
import { initGameImpl } from '@/store/slices/orchestration/initGame';

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
    // ── Previously-unsaved fields (v68 fix) ──
    // Each of these is mutated by gameplay but was missing from the save
    // payload, so accumulated state was silently dropped on every reload.
    // `seasonTotalExpenses` in particular swallowed pack-severance, pack
    // quick-sells, and the release-clause flow. Community Pack: without
    // cpPool/communityPackEnabled a reloaded CP save re-shuffles the real
    // player pool (duplicate players league-wide) and reverts to fictional
    // names. clubPowerRankings: ELO ratings reset to empty without it.
    contractStrikes: state.contractStrikes || {},
    tacticalPresets: state.tacticalPresets || [],
    transferFilters: state.transferFilters,
    pendingGemReveal: state.pendingGemReveal || null,
    pendingTransferTalk: state.pendingTransferTalk || null,
    seasonStartAvgOVR: state.seasonStartAvgOVR || 0,
    seasonTransfersBought: state.seasonTransfersBought || [],
    seasonTransfersSold: state.seasonTransfersSold || [],
    seasonTotalIncome: state.seasonTotalIncome || 0,
    seasonTotalExpenses: state.seasonTotalExpenses || 0,
    clubPowerRankings: state.clubPowerRankings || {},
    communityPackEnabled: state.communityPackEnabled || false,
    cpPool: state.cpPool || { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0, lastSeedSeason: 0 },
  };
  let json: string;
  try {
    json = JSON.stringify(saveData);

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
  } catch (err) {
    // A serialization failure (circular ref / non-serializable value injected into
    // state) must NOT propagate uncaught out of the idle/lifecycle callback that calls
    // performSave — surface it like a write failure instead of silently losing the save.
    Sentry.captureException(err, { tags: { context: 'saveGame.stringify' } });
    set({ saveStatus: 'failed', saveFailureMessage: 'Save could not be serialized' });
    return;
  }

  // Change detection: if the payload is byte-identical to our last successful
  // write, skip the localStorage roundtrip. We still refresh lastSavedAt so
  // the indicator doesn't drift into a stale "5m ago" while the game is idle.
  const payloadHash = fnv1a(json);
  if (payloadHash === lastSavedHash) {
    set({ saveStatus: 'saved', lastSavedAt: Date.now(), saveFailureMessage: null });
    return;
  }

  // writeSaveSlot returns { lsOk, idbPromise } so we can detect when BOTH
  // disk paths failed and actually surface the "Save Failed" warning. The
  // previous version did try/catch on writeSaveSlot, but writeSaveSlot
  // never throws on quota exceeded (it swallows internally) — so the
  // warning was dead code. The memory cache is always updated, so the
  // session continues fine; the warning is specifically for "this save
  // will not survive an app restart".
  let saveResult: ReturnType<typeof writeSaveSlot>;
  try {
    saveResult = writeSaveSlot(s, json);
    // Only record the change-detection hash once a disk path confirms the
    // write. Recording it unconditionally meant a save where BOTH disk
    // paths failed would short-circuit the next identical "Save Now" to
    // 'saved' without ever persisting. localStorage success is known
    // synchronously; the IDB-only case commits in the .then() below.
    if (saveResult.lsOk) lastSavedHash = payloadHash;
  } catch (err) {
    // Memory cache write threw — true OOM scenario. (Stringify failures are caught above.)
    const errTime = Date.now();
    if (errTime - lastSaveErrorLogAt > 10000) {
      Sentry.captureException(err, { tags: { context: 'saveGame.throw' } });
      lastSaveErrorLogAt = errTime;
    }
    set({ saveStatus: 'failed', saveFailureMessage: 'Save could not be written' });
    addGameBreadcrumb('save', 'Save threw', { week: state.week, season: state.season, slot: s, bytes: json.length });
    return;
  }

  set({ saveStatus: 'saved', lastSavedAt: Date.now(), saveFailureMessage: null });
  addGameBreadcrumb('save', 'Save succeeded (memory + at-least-one-disk)', {
    week: state.week,
    season: state.season,
    slot: s,
    bytes: json.length,
    lsOk: saveResult.lsOk,
  });
  track('save_created', { slot: s, bytes: json.length });

  // If localStorage rejected the write (quota exceeded), wait for the IDB
  // outcome. If IDB also failed, the save is in memory ONLY and will be
  // lost on app restart — surface a clear warning to the user's inbox so
  // they can free up device storage. De-dupe to once-per-week so we don't
  // spam during a long burning-quota episode.
  if (!saveResult.lsOk) {
    void saveResult.idbPromise.then(idbOk => {
      if (idbOk) {
        // IDB succeeded — save is persistent; commit the change-detection
        // hash (deferred from the sync path because localStorage failed).
        lastSavedHash = payloadHash;
        return;
      }
      const errTime = Date.now();
      if (errTime - lastSaveErrorLogAt > 10000) {
        Sentry.captureMessage('[saveGame] Both localStorage and IDB rejected the write', 'error');
        lastSaveErrorLogAt = errTime;
      }
      set(s0 => {
        const hasSaveWarningThisWeek = s0.messages.some(
          m => m.title === 'Save Could Not Persist' && m.week === s0.week && m.season === s0.season,
        );
        if (hasSaveWarningThisWeek) return {};
        return {
          saveStatus: 'failed' as const,
          saveFailureMessage: 'Save kept in memory only',
          messages: addMsg(s0.messages, {
            type: 'warning',
            title: 'Save Could Not Persist',
            body: 'Device storage is full — your progress is in memory but won\'t survive an app restart. Free up storage in Settings → General → iPhone Storage.',
            week: s0.week,
            season: s0.season,
          }),
        };
      });
    });
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

// `advanceLeagueCupRound` is exported from `./orchestration/tournaments.ts`.

// Module-level (not GameState) so it never persists into saves and needs no
// migration: a transient "a week tick is currently running" latch shared by
// advanceWeek and advanceToNextMatch.
let weekAdvanceInFlight = false;

export const createOrchestrationSlice = (set: Set, get: Get) => ({
  initGame: async (clubId: string, options?: { communityPackEnabled?: boolean }) => {
    await initGameImpl(set, get, clubId, options);
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

      const squad = generateSquad(club.id, cd.squadQuality, state.season, leagueId, /* isInitialSeason */ false, /* useRealNames */ state.communityPackEnabled);
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
    // Re-entrancy guard: a double-tap on the advance button (or any two
    // callers racing) must not run two overlapping week ticks — each would
    // read stale state via get() and double-process finances/fixtures.
    if (weekAdvanceInFlight) return;
    weekAdvanceInFlight = true;
    try {
      await advanceWeekImpl(set, get);
    } finally {
      weekAdvanceInFlight = false;
    }
  },

  advanceToNextMatch: async () => {
    const hasMatchThisWeek = (s: GameState): boolean => {
      const { week: w, fixtures, friendlies, playerClubId: pcId } = s;
      if (friendlies?.some(m => m.week === w && !m.played && (m.homeClubId === pcId || m.awayClubId === pcId))) return true;
      if (fixtures.some(m => m.week === w && !m.played && (m.homeClubId === pcId || m.awayClubId === pcId))) return true;
      // Cup, league cup, continental (group + knockout) and super cups all
      // come from the shared selector. The previous inline checks omitted
      // the three continental tournaments, so "Skip to Next Match" could
      // advance through a continental week — the player's group match then
      // never gets played (weekAdvance deliberately never AI-sims it) and
      // the whole tournament hangs for the season.
      if (findTournamentMatch(s)) return true;
      return false;
    };

    if (weekAdvanceInFlight) return;
    weekAdvanceInFlight = true;
    try {
      const MAX_SKIPS = 5;
      for (let i = 0; i < MAX_SKIPS; i++) {
        const s = get();
        if (s.seasonPhase !== 'regular') break;
        if (s.week >= s.totalWeeks) break;
        if (hasMatchThisWeek(s)) break;
        // `advanceWeekImpl` is async when Community Pack is enabled (it
        // dynamic-imports the free-agents dataset on the 4-weekly market
        // refresh). Without `await` the loop would fire overlapping advances,
        // each reading stale state via get() — a real race on CP saves.
        // Called directly (not via s.advanceWeek()) because the slice action
        // would no-op behind the same in-flight guard this loop holds.
        await advanceWeekImpl(set, get);
        // Suppress the weekly digest for intermediate advances so the modal
        // only shows for the final week (the one with the upcoming match).
        set({ weeklyDigest: null });
      }
    } finally {
      weekAdvanceInFlight = false;
    }
  },

  playCurrentMatch: () => playCurrentMatchImpl(set, get),

  playFirstHalf: () => playFirstHalfImpl(set, get),

  playSecondHalf: () => playSecondHalfImpl(set, get),

  playExtraTime: () => playExtraTimeImpl(set, get),

  playPenalties: () => playPenaltiesImpl(set, get),

  revealNextPenaltyKick: () => revealNextPenaltyKickImpl(set, get),

  skipPenaltyShootout: () => skipPenaltyShootoutImpl(set, get),

  playWorldCupFirstHalf: () => playWorldCupFirstHalfImpl(set, get),

  playWorldCupSecondHalf: () => playWorldCupSecondHalfImpl(set, get),

  playWorldCupExtraTime: () => playWorldCupExtraTimeImpl(set, get),

  playWorldCupPenalties: () => playWorldCupPenaltiesImpl(set, get),

  finalizeWorldCupPenalties: () => finalizeWorldCupPenaltiesImpl(set, get),

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
    // Mid-match safety: if a match is in progress, abandon it FIRST so
    // we don't clobber halfTimeState / matchPhase out from under a
    // mid-render MatchDay component. The old behaviour was: set()
    // resets `halfTimeState: null, matchPhase: 'none'` while MatchDay's
    // animation loop still holds a stale ref → guaranteed crash on the
    // next animation frame.
    const currentState = get();
    if (currentState.matchPhase !== 'none' || currentState.halfTimeState) {
      currentState.cleanupAbandonedMatch();
    }
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
        } catch (backupErr) {
          // Capture the backup-parse failure too — previously the catch was
          // silent, so on real-world double-corruption we had no fingerprint
          // for triage (only the first warning at line ~659 was captured).
          Sentry.captureException(backupErr, {
            tags: { context: 'loadGame.backupParse', slot: String(s) },
            extra: { backupBytes: backupRaw.length, primarySnippet: raw.slice(0, 100), backupSnippet: backupRaw.slice(0, 100) },
          });
        }
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
      const clubIds = Object.keys(data.clubs || {});

      // Ensure division data exists (backward compat for old saves)
      const playerDivision: LeagueId = data.playerDivision || 'eng';
      // Build the table from the player's division only — multi-league saves
      // contain hundreds of foreign clubs that would otherwise pollute the
      // table with zero-point rows until the next advanceWeek rebuilds it.
      const playerLeagueClubIds: string[] = data.divisionClubs?.[playerDivision] || clubIds;
      const leagueTable = buildLeagueTable(data.fixtures || [], playerLeagueClubIds);
      const divisionClubs: Record<string, string[]> = data.divisionClubs || { [playerDivision]: clubIds };
      const divisionFixtures: Record<string, Match[]> = data.divisionFixtures || { [playerDivision]: data.fixtures || [] };
      const divisionTables = buildAllDivisionTables(divisionFixtures, divisionClubs);

      set({
        ...data, gameStarted: true, leagueTable,
        activeSlot: s,
        // Backfill settings with defaults for fields added after save was created
        settings: {
          matchSpeed: 3300, showOverallOnPitch: true, autoSave: true, hapticsEnabled: true,
          hidePageHints: false, hideOnboarding: false, confirmAllOffers: false, reducedMotion: false, performanceMode: false,
          ...(data.settings || {}),
        },
        currentScreen:
          (data.gameMode === 'career' && data.careerManager && !data.careerManager.contract)
            ? (data.careerManager.careerHistory?.some((e: { reason: string }) => e.reason === 'retired') ? 'hall-of-managers' : 'job-market')
            : 'dashboard',
        previousScreen: null,
        currentMatchResult: null, selectedPlayerId: null,
        transferWindowOpen: isTransferWindowOpen(data.week, data.totalWeeks),
        matchSubsUsed: 0,
        matchSubbedOffIds: [],
        matchPlayerRatings: [],
        currentCupTieId: null,
        unlockedAchievements: data.unlockedAchievements || [],
        pendingAchievementIds: [],
        managerStats: data.managerStats || { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
        activeLoans: data.activeLoans || [],
        incomingLoanOffers: data.incomingLoanOffers || [],
        outgoingLoanRequests: data.outgoingLoanRequests || [],
        cup: data.cup || generateCupDraw(clubIds, data.totalWeeks),
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
        // ── Previously-unsaved-field backfills (v68 fix) ──
        // Older saves that pre-date the fix won't have these keys, so we
        // fall back to the same defaults the slices declare. New saves
        // carry real values forward via `...data` above; these lines are
        // a safety net for older slot data.
        contractStrikes: data.contractStrikes || {},
        tacticalPresets: data.tacticalPresets || [],
        transferFilters: data.transferFilters || {
          tab: 'market', posFilter: 0, searchQuery: '',
          sortBy: 'overall', faSortBy: 'overall', divFilter: 'all',
          newsTypeFilter: 'all', hideUnaffordable: false, showShortlistOnly: false,
        },
        pendingGemReveal: data.pendingGemReveal || null,
        pendingTransferTalk: data.pendingTransferTalk || null,
        seasonStartAvgOVR: data.seasonStartAvgOVR ?? 0,
        seasonTransfersBought: data.seasonTransfersBought || [],
        seasonTransfersSold: data.seasonTransfersSold || [],
        seasonTotalIncome: data.seasonTotalIncome ?? 0,
        seasonTotalExpenses: data.seasonTotalExpenses ?? 0,
        clubPowerRankings: data.clubPowerRankings || {},
        communityPackEnabled: data.communityPackEnabled || false,
        cpPool: data.cpPool || { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0, lastSeedSeason: 0 },
        // Transient match-scoped field — reset on load so a team talk from
        // a previously-loaded slot can't leak into the freshly loaded game.
        matchTeamTalk: 'none' as const,
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
    // Remove ephemeral (virtual) club players and clubs that were injected for continental matches.
    // Virtual club IDs are real club IDs (no 'virtual-' prefix). `state.virtualClubs` may contain
    // real loaded clubs from OTHER divisions (continental qualifiers from cross-division loaded
    // leagues — see continentalDraw.ts) — we must not delete those. The canonical "is this a real
    // loaded club?" registry is `divisionClubs`; a club is ephemeral iff it isn't listed in any
    // loaded division. Ephemeral player IDs are prefixed `vc-` (see createEphemeralClub).
    const loadedClubIds = new Set<string>();
    for (const ids of Object.values(state.divisionClubs || {})) {
      for (const id of ids) loadedClubIds.add(id);
    }
    const virtualIds = Object.keys(state.virtualClubs || {});
    const newClubs = { ...state.clubs };
    const newPlayers = { ...state.players };
    let mutated = false;
    for (const vid of virtualIds) {
      if (!newClubs[vid]) continue;
      if (loadedClubIds.has(vid)) continue;
      delete newClubs[vid];
      mutated = true;
    }
    for (const pid of Object.keys(newPlayers)) {
      if (pid.startsWith('vc-')) {
        delete newPlayers[pid];
        mutated = true;
      }
    }
    set({
      ...(mutated ? { clubs: newClubs, players: newPlayers } : {}),
      halfTimeState: null, currentMatchWeather: null, matchPhase: 'none' as const,
      currentCupTieId: null, currentLeagueCupTieId: null,
      currentContinentalMatchId: null, currentContinentalCompetition: null,
      matchSubsUsed: 0,
      matchSubbedOffIds: [],
      // Audit finding: previously these match-scoped state fields persisted
      // across an abandoned match, so e.g. an abandoned penalty shootout
      // left `penaltyShootoutKicks` populated for the next match. Reset
      // them all to canonical defaults so a fresh match starts clean.
      currentMatchResult: null,
      matchPlayerRatings: [],
      matchTeamTalk: 'none' as const,
      matchShouts: [],
      penaltyShootoutKicks: [],
      penaltyShootoutRevealIndex: 0,
      preMatchSnapshot: null,
      lastMatchDrama: null,
      lastMatchCompetition: null,
    });
  },

  resetGame: (slot?: number) => {
    const s = slot ?? get().activeSlot;
    // Kill any pending idle save before wiping the slot — otherwise it fires
    // after reset and resurrects the slot we just deleted.
    cancelPendingSave();
    // Mid-match safety: same guard as loadGame. Abandon a match in flight
    // before wiping state so MatchDay's render loop doesn't dereference
    // a state slice we're about to zero out.
    const currentState = get();
    if (currentState.matchPhase !== 'none' || currentState.halfTimeState) {
      currentState.cleanupAbandonedMatch();
    }
    removeSaveSlot(s);
    resetSaveHash();
    set({
      saveStatus: 'idle' as const, lastSavedAt: null, saveFailureMessage: null,
      gameStarted: false, playerClubId: '', currentScreen: 'dashboard',
      clubs: {}, players: {}, fixtures: [], leagueTable: [],
      messages: [], seasonHistory: [], incomingOffers: [],
      matchPlayerRatings: [], halfTimeState: null, currentMatchWeather: null, matchPhase: 'none' as const,
      currentMatchResult: null, matchSubsUsed: 0, matchSubbedOffIds: [], currentCupTieId: null,
      // Match-scoped state that previously persisted across resets — audit
      // finding O2 (stale shootout kicks, leftover team talk, etc.).
      matchTeamTalk: 'none' as const, matchShouts: [],
      penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0,
      preMatchSnapshot: null, lastMatchDrama: null, lastMatchCompetition: null,
      transferMarket: [], shortlist: [], scoutWatchList: [], transferNews: [],
      activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
      cup: { ties: [], currentRound: null, eliminated: false, winner: null },
      pendingPressConference: null, activeNegotiation: null,
      pendingFarewell: [], pendingStoryline: null,
      openedPacks: [], packPityCounter: 0, lastPackWeek: 0, lastPackSeason: 0,
      dailyPackOpens: { date: '', free: {}, ad: {} },
      activeStorylineChains: [], completedStorylineChainIds: [], weeklyObjectives: [],
      objectiveStreak: 0, objectivesStartWeek: 1, completedCoachTaskIds: [],
      weekCliffhangers: [], rivalries: {},
      sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
      weeklyDigest: null, careerTimeline: [],
      gameMode: 'sandbox', careerManager: null, jobVacancies: [], jobOffers: [],
      // National-team + interview state — omitting these leaked an old NT
      // job (with dead player IDs) into a brand-new game.
      nationalTeam: null, internationalTournament: null, managerNationality: null,
      nationalTeamOffer: null, showNationalTeamOffer: false, activeInterview: null,
      sponsorDeals: [], sponsorOffers: [], sponsorSlotCooldowns: {}, negotiationStrikes: {}, contractStrikes: {},
      merchandise: getDefaultMerchState(),
      continentalCoefficients: {},
      // v68 newly-persisted fields — must reset here too so a New Game after
      // a Load doesn't inherit stale session aggregates / opt-in flags.
      tacticalPresets: [],
      transferFilters: {
        tab: 'market', posFilter: 0, searchQuery: '',
        sortBy: 'overall', faSortBy: 'overall', divFilter: 'all',
        newsTypeFilter: 'all', hideUnaffordable: false, showShortlistOnly: false,
      },
      pendingGemReveal: null,
      pendingTransferTalk: null,
      seasonStartAvgOVR: 0,
      seasonTransfersBought: [],
      seasonTransfersSold: [],
      seasonTotalIncome: 0,
      seasonTotalExpenses: 0,
      clubPowerRankings: {},
      communityPackEnabled: false,
      cpPool: { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0, lastSeedSeason: 0 },
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

    // Reinitialize game with new club, threading the Community Pack flag
    // through — without it a CP save silently reverted to fictional players
    // on prestige. Threading CP makes `initGame` genuinely async (it
    // dynamic-imports the CP datasets), so the bonuses are applied ONLY
    // once the init promise settles: by then initGame's own `set()` has
    // written the fresh world and nothing here gets clobbered. (The old
    // synchronous call relied on the non-CP body running with no awaits;
    // applying bonuses before an async init's `set()` would have lost the
    // budget multiplier and timeline carry-over to the init write.)
    const applyPrestigeBonuses = () => {
      const freshState = get();
      const updatedProg = preserveProgression
        ? { ...currentProg, prestigeLevel: newPrestigeLevel }
        : { ...freshState.managerProgression, prestigeLevel: newPrestigeLevel };

      const updates: Partial<GameState> = {
        managerProgression: updatedProg,
        currentScreen: 'dashboard' as const,
      };

      // Apply budget multiplier to the post-init club budget
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
          id: safeRandomUUID(),
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
    };

    const initResult = get().initGame(newClubId, { communityPackEnabled: get().communityPackEnabled });
    guardAsync(
      Promise.resolve(initResult).then(applyPrestigeBonuses),
      'resetAfterPrestige.initGame',
      { title: 'Reset failed', body: 'Could not restart for prestige bonus.' },
    );
  },

  // ── Farewell ──
  pendingFarewell: [] as GameState['pendingFarewell'],

  dismissFarewell: () => {
    const remaining = get().pendingFarewell.slice(1);
    set({ pendingFarewell: remaining });
  },
});
