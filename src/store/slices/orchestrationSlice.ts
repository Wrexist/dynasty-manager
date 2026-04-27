import * as Sentry from '@sentry/react';
import { Club, Player, TransferListing, Message, Match, LeagueId, LeagueTableEntry } from '@/types/game';

import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, buildAllDivisionTables, DERBIES, LEAGUES, clearLeagueTableCache, generateFriendlies, getLeaguesByCountry } from '@/data/league';

import { generateSquad, selectBestLineup, buildPlayerFromTemplate } from '@/utils/playerGen';
import { resetRealPlayerClaims, claimRealPlayer } from '@/utils/realPlayerPicker';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { getActivePool, drawForMarket, drawForFaPoolSeed } from '@/utils/communityPackPool';
import {
  CP_FA_SEED_COUNT_BY_SEASON, CP_FA_SEED_ELITE_COUNT, CP_FA_SEED_TOP_COUNT, CP_FA_SEED_ELITE_MIN_OVR, CP_FA_SEED_TOP_MIN_OVR, CP_FA_SEED_MID_MIN_OVR, CP_FA_SEED_MIN_AGE, CP_FA_SEED_MAX_AGE,
} from '@/config/aiSimulation';
import { simulateMatch } from '@/engine/match';
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

import { generateCupDraw } from '@/data/cup';

import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';

import { createEmptyRecords } from '@/utils/records';

import { getDefaultMerchState } from '@/utils/merchandise';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';

import {
  TOTAL_WEEKS, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY, STADIUM_LEVEL_DIVISOR, MEDICAL_LEVEL_FACTOR, RECOVERY_LEVEL_FACTOR, FACILITY_MAX_LEVEL, FORFEIT_SCORE, LINEUP_SIZE,
} from '@/config/gameBalance';
import {
  SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END,
} from '@/config/transfers';

import { generateInitialMarket, generateInitialFreeAgents, generatePreSeasonMarket } from '@/utils/transferMarketGen';

import { resetSeasonGrowth, hydrateSeasonGrowth } from '@/store/helpers/development';

import { generateMonthlyObjectives } from '@/utils/weeklyObjectives';

import { generateAIManagerProfile } from '@/config/aiManager';

import { createMilestone } from '@/utils/milestones';
import { createDefaultProgression, MANAGER_PERKS, canUnlockPerk } from '@/utils/managerPerks';
import { buildHallEntry, saveToHall } from '@/utils/hallOfManagers';
import { initializeClubPowerRankings } from '@/utils/teamRankings';
import type { PerkId, ManagerProgression } from '@/types/game';

import { generateStarterDeals } from '@/store/slices/sponsorSlice';
import {
  rebuildRealPlayerClaims, generateObjectives,
} from '@/store/slices/orchestration/helpers';
import {
  generateLeagueCupDraw,
} from '@/store/slices/orchestration/tournaments';
import { endSeasonImpl } from '@/store/slices/orchestration/seasonEnd';
import { advanceWeekImpl } from '@/store/slices/orchestration/weekAdvance';
import {
  playCurrentMatchImpl, playFirstHalfImpl, playSecondHalfImpl, playExtraTimeImpl, playPenaltiesImpl, revealNextPenaltyKickImpl, skipPenaltyShootoutImpl,
} from '@/store/slices/orchestration/matchActions';

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

// `advanceLeagueCupRound` is exported from `./orchestration/tournaments.ts`.

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

  playCurrentMatch: () => playCurrentMatchImpl(set, get),

  playFirstHalf: () => playFirstHalfImpl(set, get),

  playSecondHalf: () => playSecondHalfImpl(set, get),

  playExtraTime: () => playExtraTimeImpl(set, get),

  playPenalties: () => playPenaltiesImpl(set, get),

  revealNextPenaltyKick: () => revealNextPenaltyKickImpl(set, get),

  skipPenaltyShootout: () => skipPenaltyShootoutImpl(set, get),

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
