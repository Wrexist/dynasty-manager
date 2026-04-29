import { Club, Player, TransferListing, Match, LeagueTableEntry } from '@/types/game';

import { buildLeagueTable, generateDivisionFixtures, LEAGUES, generateFriendlies, getLeaguesByCountry } from '@/data/league';

import { generateSquad, selectBestLineup } from '@/utils/playerGen';

import { generateStaffMarket, getStaffBonus } from '@/utils/staff';

import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../../storeTypes';

import { addGameBreadcrumb } from '@/utils/sentry';
import { track } from '@/utils/analytics';

import { generateCupDraw } from '@/data/cup';

import { createEmptyRecords } from '@/utils/records';

import {
  TOTAL_WEEKS,
} from '@/config/gameBalance';

import { generateInitialMarket, generatePreSeasonMarket } from '@/utils/transferMarketGen';

import { resetSeasonGrowth } from '@/store/helpers/development';

import { generateMonthlyObjectives } from '@/utils/weeklyObjectives';

import { generateAIManagerProfile } from '@/config/aiManager';

import { createMilestone } from '@/utils/milestones';

import {
  generateObjectives,
} from '@/store/slices/orchestration/helpers';
import {
  generateLeagueCupDraw,
} from '@/store/slices/orchestration/tournaments';

import { CP_FA_SEED_COUNT_BY_SEASON, CP_FA_SEED_ELITE_COUNT, CP_FA_SEED_ELITE_MIN_OVR, CP_FA_SEED_MAX_AGE, CP_FA_SEED_MID_MIN_OVR, CP_FA_SEED_MIN_AGE, CP_FA_SEED_TOP_COUNT, CP_FA_SEED_TOP_MIN_OVR } from '@/config/aiSimulation';
import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';
import { FACILITY_MAX_LEVEL, MEDICAL_LEVEL_FACTOR, RECOVERY_LEVEL_FACTOR, STADIUM_LEVEL_DIVISOR, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY } from '@/config/gameBalance';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { ALL_CLUBS, DERBIES, clearLeagueTableCache } from '@/data/league';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { generateStarterDeals } from '@/store/slices/sponsorSlice';
import type { Message } from '@/types/game';
import { drawForFaPoolSeed, drawForMarket, getActivePool } from '@/utils/communityPackPool';
import { createDefaultProgression } from '@/utils/managerPerks';
import { getDefaultMerchState } from '@/utils/merchandise';
import { buildPlayerFromTemplate } from '@/utils/playerGen';
import { claimRealPlayer, resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import { generateInitialStaff } from '@/utils/staff';
import { initializeClubPowerRankings } from '@/utils/teamRankings';
import { generateInitialFreeAgents } from '@/utils/transferMarketGen';
import { applyBallonDorTop10Boost } from '@/utils/ballonDorBoost';
import { BALLON_DOR_TOP10_RANK, BALLON_DOR_ELITE_CLUB_BONUS } from '@/config/gameBalance';
import { CLUB_TEMPLATES } from '@/data/playerTemplates';

/** How many "ghost" stars each unloaded elite club contributes to the seed pool. */
const GHOST_STARS_PER_ELITE_CLUB = 2;
/** Pool size from which the 10 holders are drawn — larger than 10 so the
 *  weighted random pick can reshuffle the order between saves. */
const SEED_CANDIDATE_POOL_SIZE = 22;

/**
 * Build a Player record for an elite-club star whose club isn't loaded into
 * this save (e.g. Real Madrid, Bayern, PSG when the player picks an English
 * club). These "ghost" players exist purely as Ballon d'Or top-10 reign
 * holders — they keep their real `clubId` for narrative continuity, but
 * since that club isn't in the `clubs` map they're invisible to lineup,
 * transfer, and AI logic.
 */
function buildGhostElitePlayer(t: PlayerTemplate, clubId: string, season: number): Player {
  const player = buildPlayerFromTemplate(t, clubId, season, undefined, /* useRealNames */ true);
  // Re-pin the club after buildPlayerFromTemplate (which clears it during
  // generatePlayer) so display surfaces can reflect the real-world team.
  player.clubId = clubId;
  return player;
}

/**
 * Pick the 10 reigning Ballon d'Or top-10 holders for a freshly initialised
 * save. The pool combines:
 *  - real loaded players from the player's country pyramid (excludes free
 *    agents, youth, injured)
 *  - synthetic "ghost" stars from elite global clubs not loaded into this
 *    save (Real Madrid / Bayern / PSG / Barcelona / Inter etc.) so the
 *    seed feels like a global award rather than a Premier League shortlist
 *
 * Selection uses weighted random sampling from the top-{@link
 * SEED_CANDIDATE_POOL_SIZE} by overall, so OVR still dominates but each
 * save lands on a slightly different ten. Returned ghosts must be inserted
 * into `allPlayers` by the caller so their reign marker survives saves.
 */
function pickInitialBallonDorTop10(
  allPlayers: Record<string, Player>,
  loadedClubIdSet: Record<string, true>,
): { picks: Player[]; ghosts: Player[] } {
  // Real candidates from loaded country pyramid (club-affiliated, fit).
  const realCandidates = Object.values(allPlayers).filter(p => p.clubId && !p.injured);

  // Synthesize ghost stars for elite clubs outside the loaded country.
  const ghostCandidates: Player[] = [];
  for (const clubId of Object.keys(BALLON_DOR_ELITE_CLUB_BONUS)) {
    if (loadedClubIdSet[clubId]) continue;
    const templates = CLUB_TEMPLATES[clubId] || [];
    if (templates.length === 0) continue;
    const topStars = [...templates].sort((a, b) => b.ovr - a.ovr).slice(0, GHOST_STARS_PER_ELITE_CLUB);
    for (const t of topStars) ghostCandidates.push(buildGhostElitePlayer(t, clubId, 1));
  }

  // Combined pool sorted by OVR (younger wins ties) — top N feeds the random pick.
  const combined = [...realCandidates, ...ghostCandidates].sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.age - b.age;
  });
  const candidatePool = combined.slice(0, SEED_CANDIDATE_POOL_SIZE);

  // Weighted random selection without replacement. Weights run from
  // SEED_CANDIDATE_POOL_SIZE down to 1, so the highest-OVR candidate is ~22×
  // more likely than the bottom of the pool but never guaranteed — every
  // save lands on a different ten while still feeling realistic.
  const picks: Player[] = [];
  const remaining = [...candidatePool];
  const baseWeights = candidatePool.map((_, idx) => SEED_CANDIDATE_POOL_SIZE - idx);
  while (picks.length < BALLON_DOR_TOP10_RANK && remaining.length > 0) {
    const weights = remaining.map((_, idx) => baseWeights[idx] ?? 1);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * totalWeight;
    let pickedIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      r -= weights[i];
      if (r <= 0) { pickedIdx = i; break; }
    }
    picks.push(remaining.splice(pickedIdx, 1)[0]);
  }

  // Only ghosts that actually got picked need to be persisted into allPlayers.
  const pickedIds: Record<string, true> = {};
  for (const p of picks) pickedIds[p.id] = true;
  const pickedGhosts = ghostCandidates.filter(g => pickedIds[g.id]);
  return { picks, ghosts: pickedGhosts };
}
/**
 * Game initialization extracted from orchestrationSlice.ts.
 *
 * `initGameImpl` builds the initial state when the player picks a club:
 * generates squads for every league, seeds fixtures, draws cup brackets,
 * builds the AI manager profiles, and (optionally) seeds the Community
 * Pack player pool. Async because Community Pack data is dynamic-imported.
 */

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export async function initGameImpl(set: Set, get: Get, clubId: string, options?: { communityPackEnabled?: boolean }): Promise<void> {
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
      : generateSquad(club.id, cd.squadQuality, 1, cd.divisionId, /* isInitialSeason */ true, /* useRealNames */ communityPackEnabled);
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

  // Seed the 10 reigning Ballon d'Or top-10 holders. Picks from the
  // combined real-loaded + global-elite-ghost pool with weighted random
  // sampling, so each save lands on a different (but realistic) ten —
  // Salah / Haaland / Vinicius / Mbappé / Bellingham etc. shuffle around
  // instead of being identical every restart. Their reign expires at
  // season 1's award ceremony: those who re-make the new top 10 keep it,
  // others revert. `season - 1 = 0` is just a marker — the boost lifecycle
  // only cares whether the field is set.
  const loadedClubIdSet: Record<string, true> = {};
  for (const id of Object.keys(clubs)) loadedClubIdSet[id] = true;
  const { picks: seededTop10, ghosts: seededGhosts } = pickInitialBallonDorTop10(allPlayers, loadedClubIdSet);
  // Persist any picked ghost stars into the players map so the reigning-
  // top-10 panel can render them. They have a real-world clubId for
  // narrative context but no entry in the `clubs` map, so the rest of the
  // game (lineups, transfers, AI sims) treats them as nonexistent.
  for (const g of seededGhosts) {
    allPlayers[g.id] = g;
  }
  const affectedClubIds = new Set<string>();
  for (const p of seededTop10) {
    applyBallonDorTop10Boost(p, 0);
    // Only refresh wage bills for clubs actually loaded in this save —
    // ghost-club holders don't affect any real club's finances.
    if (p.clubId && clubs[p.clubId]) affectedClubIds.add(p.clubId);
  }
  // The boost recalculates `player.wage`, so any club hosting a seeded
  // holder needs its `wageBill` aggregate refreshed before week-1 finance
  // runs — otherwise the dashboard's "weekly cost" reads stale.
  for (const clubId of affectedClubIds) {
    const club = clubs[clubId];
    if (!club) continue;
    club.wageBill = club.playerIds.reduce(
      (sum, pid) => sum + (allPlayers[pid]?.wage || 0),
      0,
    );
  }

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
}
