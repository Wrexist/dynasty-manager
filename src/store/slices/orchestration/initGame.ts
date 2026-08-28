import { Club, Player, TransferListing, Match, LeagueTableEntry } from '@/types/game';
import { safeRandomUUID } from '@/utils/helpers';

import { buildLeagueTable, generateDivisionFixtures, LEAGUES, generateFriendlies, collectOccupiedWeeks, getLeaguesByCountry } from '@/data/league';

import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { loadNationalPool } from '@/data/nationalPlayerPoolAccess';

import { generateStaffMarket, getStaffBonus } from '@/utils/staff';

import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import type { GameState } from '../../storeTypes';

import * as Sentry from '@sentry/react';
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
import { FACILITY_MAX_LEVEL, STADIUM_LEVEL_DIVISOR, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY, clubMedicalLevel, clubRecoveryLevel } from '@/config/gameBalance';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { ALL_CLUBS, DERBIES, clearLeagueTableCache } from '@/data/league';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { generateStarterDeals, generateStarterOffers } from '@/store/slices/sponsorSlice';
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
import { BALLON_DOR_TOP10_RANK } from '@/config/gameBalance';
import { loadClubTemplates } from '@/data/playerTemplatesAccess';
import { LIVING_WORLD_LEAGUE_COUNT, LIVING_WORLD_SQUAD_SIZE } from '@/config/continental';
import { getLivingWorldLeagueIds } from '@/data/continentalDraw';

/**
 * Pick the 10 reigning Ballon d'Or top-10 holders for a freshly initialised
 * save. Weighted random sampling from the top 22 by overall keeps OVR
 * dominant but reshuffles the ten between saves.
 *
 * Phase 6: this used to blend in synthetic "ghost" stars built from templates
 * of elite clubs that weren't in the save (Real Madrid / Bayern / PSG when
 * managing in England) because those clubs simply didn't exist as entities.
 * The living world instantiates the strongest foreign top tiers, so those
 * players are now REAL squad members and the pool is global by construction —
 * no fabrication, and the holders can be scouted, bought and developed.
 */
function pickInitialBallonDorTop10(allPlayers: Record<string, Player>): Player[] {
  const POOL = 22;
  const candidatePool = Object.values(allPlayers)
    .filter(p => p.clubId && !p.injured)
    .sort((a, b) => b.overall !== a.overall ? b.overall - a.overall : a.age - b.age)
    .slice(0, POOL);

  // Weighted random selection without replacement. Weights run from POOL
  // down to 1, so the highest-OVR candidate is ~22× more likely than the
  // bottom — every save lands on a different ten while feeling realistic.
  const picks: Player[] = [];
  const remaining = [...candidatePool];
  while (picks.length < BALLON_DOR_TOP10_RANK && remaining.length > 0) {
    const totalWeight = remaining.reduce((s, _, i) => s + (POOL - i), 0);
    let r = Math.random() * totalWeight;
    let pickedIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      r -= POOL - i;
      if (r <= 0) { pickedIdx = i; break; }
    }
    picks.push(remaining.splice(pickedIdx, 1)[0]);
  }

  return picks;
}

/** Build the `Club` entity for a static club definition. Shared by the
 *  player-country pyramid pass and the living-world foreign-league pass. */
function buildClubEntity(cd: (typeof ALL_CLUBS)[number]): Club {
  return {
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
}

/**
 * Trim a generated squad down to `LIVING_WORLD_SQUAD_SIZE` for a foreign
 * living-world club. Club templates hand out ~28-man squads; a foreign club is
 * AI-only, so we keep the best players (the recognisable names are the whole
 * point of making these clubs real) plus a guaranteed second keeper so an
 * injury to the first choice can't force a forfeit. Cuts ~30% off the save
 * payload for every instantiated league.
 */
function trimForeignSquad(squad: Player[]): Player[] {
  if (squad.length <= LIVING_WORLD_SQUAD_SIZE) return squad;
  const byOverall = [...squad].sort((a, b) => b.overall - a.overall);
  const kept = byOverall.slice(0, LIVING_WORLD_SQUAD_SIZE);
  const keepers = kept.filter(p => p.position === 'GK');
  if (keepers.length < 2) {
    const spare = byOverall.slice(LIVING_WORLD_SQUAD_SIZE).filter(p => p.position === 'GK');
    for (let i = 0; i < spare.length && keepers.length + i < 2; i++) {
      // Swap out the weakest outfield player for a backup keeper.
      const weakestOutfieldIdx = kept.map((p, idx) => ({ p, idx }))
        .filter(e => e.p.position !== 'GK')
        .pop()?.idx;
      if (weakestOutfieldIdx === undefined) break;
      kept[weakestOutfieldIdx] = spare[i];
    }
  }
  return kept;
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

  // A club id that resolves to nothing used to run the whole init and then die
  // on `club.divisionId` with an unguarded TypeError, half-way through building
  // the world — a launch-time crash with a partially mutated store behind it.
  // `ClubSelection` only ever offers real clubs, so this needs a stale
  // reference to reach: a deep link, a restored screen, or a save written
  // before a club was renamed or removed by a data regeneration (which
  // `saveMigration` already has to handle for exactly that reason).
  //
  // `advanceWeek` already refuses to run on a missing player club rather than
  // crashing; this is the same contract at the other end of the lifecycle.
  // Bail BEFORE touching state so the caller's screen is still intact.
  if (!clubId || !ALL_CLUBS.some(c => c.id === clubId)) {
    Sentry.captureMessage('initGame: unknown club id', {
      level: 'error',
      tags: { clubId: clubId || 'empty' },
    });
    set({ loadError: { slot: get().activeSlot, kind: 'validation_failed', canRecover: false, reason: `unknown club "${clubId || ''}"` } });
    return;
  }

  // The national player pool is lazy-loaded to keep it off the boot bundle.
  // TitleScreen prefetches it ~1.5s after mount, so by the time the user
  // reaches "Start Dynasty" the chunk is almost always already cached. We
  // fire-and-forget here as a safety net (not awaited) — the autosave test
  // suite explicitly pins the invariant that initGame's synchronous body
  // runs without any pre-await on the non-CP path. If the pool isn't loaded
  // yet, squad generation gracefully falls back to fully procedural names
  // (the real-player picker has a documented null-return → fallback path).
  loadNationalPool().catch(() => undefined);
  // Same treatment for the ~2.1MB club squad templates — lazy-loaded off the
  // boot path, prefetched by TitleScreen, fire-and-forget here as a safety
  // net. Squad generation falls back to procedural names if it races.
  loadClubTemplates().catch(() => undefined);

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
    // bra, aus, ind) into cpByClub. byClub entries win on collision because
    // they are the newer season's data.
    //
    // The two datasets DO overlap now: byClub is built from FC27 and covers
    // Argentina, MLS, Saudi and K League fully, while cpLeagueSquads is still
    // FC26. The overlap is deliberate — cpLeagueSquads keeps clubs populated
    // in those leagues wherever FC27 has no data for them (Brazil above all,
    // which EA's public endpoint carries no clubs for at all).
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
    const club: Club = buildClubEntity(cd);

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
  // ── The living world (Phase 6) ──
  // Instantiate the top tier of the strongest FOREIGN leagues as real,
  // persisted clubs. Before this, `initGame` built entities only for the
  // player's own country: 92 of 756 clubs in an English save, 18 in a Dutch
  // one. Every continental opponent was an ephemeral throwaway
  // (`createEphemeralClub`) whose squad was generated from `32 + rep * 10` and
  // discarded after the match, so Real Madrid had no squad, no history, no
  // transfers, nothing to scout — and the Ballon d'Or had to fabricate
  // synthetic seasons for "ghost" players to look like a global award.
  //
  // Three deliberate choices here:
  //
  // 1. Squads come from `generateSquad` (i.e. the lazily-loaded club-template
  //    data behind `getClubTemplatesSync`), NOT from the community-pack
  //    datasets. The community pack is dynamic-imported and must never be
  //    pulled into the boot graph for clubs the player didn't choose. This is
  //    the same data path `createEphemeralClub` already used — the difference
  //    is that these squads persist and develop instead of being thrown away.
  //
  // 2. Foreign leagues DO get domestic fixtures and tables. This is the
  //    expensive half of the feature (an extra ~9 AI matches per league per
  //    week), and it is deliberate for two reasons. First, without appearances
  //    no foreign player clears `BALLON_DOR_MIN_APPEARANCES`, so retiring the
  //    ghost-BdO hack would quietly turn the ceremony back into a
  //    single-country award. Second, `endSeasonImpl` regenerates fixtures for
  //    EVERY entry in `divisionClubs`, so a fixture-less foreign league in
  //    season 1 would sprout fixtures in season 2 anyway — the cost is not
  //    avoidable, only deferred, and deferring it makes season 2 mysteriously
  //    slower than season 1.
  //
  // 3. Foreign leagues get no promotion/relegation: `endSeasonImpl` scopes the
  //    cascade to the player's own country, so a relegated foreign club simply
  //    stays put. Accepted for v1 — the alternative is instantiating second
  //    tiers we'd never show. Foreign tables still turn over via development,
  //    AI transfers and the prize-money reputation drift.
  const livingWorldLeagueIds = getLivingWorldLeagueIds(countryId, LIVING_WORLD_LEAGUE_COUNT);
  for (const foreignLeagueId of livingWorldLeagueIds) {
    const foreignLeague = LEAGUES.find(l => l.id === foreignLeagueId);
    const foreignClubIds: string[] = [];
    for (const cd of ALL_CLUBS) {
      if (cd.divisionId !== foreignLeagueId) continue;
      const club = buildClubEntity(cd);
      const squad = trimForeignSquad(generateSquad(
        club.id, cd.squadQuality, 1, cd.divisionId,
        /* isInitialSeason */ true, /* useRealNames */ communityPackEnabled,
      ));
      let foreignWages = 0;
      for (const p of squad) {
        allPlayers[p.id] = p;
        club.playerIds.push(p.id);
        foreignWages += p.wage;
      }
      club.wageBill = foreignWages;
      const { lineup: fLineup, subs: fSubs } = selectBestLineup(squad, '4-3-3');
      club.lineup = fLineup.map(p => p.id);
      club.subs = fSubs.map(p => p.id);
      club.aiManagerProfile = generateAIManagerProfile(club.id, cd.reputation);
      clubs[club.id] = club;
      foreignClubIds.push(club.id);
    }
    if (foreignClubIds.length === 0) continue;
    divisionClubs[foreignLeagueId] = foreignClubIds;
    divisionFixtures[foreignLeagueId] = generateDivisionFixtures(
      foreignClubIds, foreignLeague?.totalWeeks || TOTAL_WEEKS,
    );
    divisionTables[foreignLeagueId] = buildLeagueTable(divisionFixtures[foreignLeagueId], foreignClubIds);
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

  // Starter inbox messages. The first three are the long-standing welcome
  // set; the latter two were added as part of the onboarding plan (Phase 3)
  // to actively point new managers at the Tactics and Scouting screens —
  // two systems that don't otherwise surface themselves during the first
  // week of play. All five are read=false so they show up unread in the
  // inbox; the inbox unread badge becomes a "go look at this" signal.
  const messages: Message[] = [
    { id: safeRandomUUID(), week: 1, season: 1, type: 'board', title: 'Welcome, Manager!', body: `The board of ${initClub.name} welcomes you. We expect great things this season. Check your objectives in the Club tab.`, read: false },
    { id: safeRandomUUID(), week: 1, season: 1, type: 'general', title: 'Transfer Window Open', body: 'The transfer window is now open. Scout the market and strengthen your squad before it closes in Week 8.', read: false },
    { id: safeRandomUUID(), week: 1, season: 1, type: 'transfer', title: 'Pre-Season Market Surge', body: 'Clubs are aggressively reshaping their squads during pre-season. Expect more transfer activity and higher-quality players on the market during the opening weeks. Any pre-season friendlies are scheduled on free weeks, so they never clash with your league fixtures.', read: false },
    { id: safeRandomUUID(), week: 1, season: 1, type: 'general', title: 'Set Your Tactics', body: 'Your assistant has set a default 4-3-3 formation. To change it: tap "Tactics" in the bottom navigation bar. Inside Tactics, the seven formation badges at the top let you pick a new shape (4-4-2 is balanced, 5-3-2 defends more). Tap "Save" when done. Sticking with one shape builds tactical familiarity — a real boost in matches.', read: false },
    { id: safeRandomUUID(), week: 1, season: 1, type: 'general', title: 'Send Out a Scout', body: 'Scouts find players you would never see on the open market. To send one: tap "Market" in the bottom navigation bar (the left-right arrows). At the top of the Market page there\'s a row of pills — Transfers, Scouting, Packs; tap "Scouting". Scroll to "Send Scout" and tap a region. Domestic returns reports in 2 weeks; Asia and Africa take 4-5 weeks but tend to surface higher-potential youngsters. Reports arrive automatically in your inbox.', read: false },
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

  // Generate cup draws and pre-season friendlies — scheduled on the player
  // league's calendar so finals land inside the season (totalWeeks varies 18-58)
  const playerTotalWeeks = league?.totalWeeks || TOTAL_WEEKS;
  const cup = generateCupDraw(leagueClubIds, playerTotalWeeks);
  const leagueCup = generateLeagueCupDraw(leagueClubIds, playerTotalWeeks);
  // Friendlies go only on weeks the player's club is otherwise free — never
  // sharing a week with a league fixture or an opening-round cup tie (the
  // weeks-1-3 double-booking bug).
  const friendlies = generateFriendlies(
    clubId,
    leagueClubIds,
    collectOccupiedWeeks(clubId, [fixtures, cup.ties, leagueCup?.ties || []]),
  );

  // Seed the 10 reigning Ballon d'Or top-10 holders with weighted random
  // sampling, so each save lands on a different (but realistic) ten —
  // Salah / Haaland / Vinicius / Mbappé / Bellingham etc. shuffle around
  // instead of being identical every restart. Their reign expires at
  // season 1's award ceremony: those who re-make the new top 10 keep it,
  // others revert. `season - 1 = 0` is just a marker — the boost lifecycle
  // only cares whether the field is set.
  //
  // The pool is now purely real players: the living world means the foreign
  // giants are instantiated, so no synthetic ghost holders are needed and
  // every reigning holder is a squad member you could actually sign.
  const seededTop10 = pickInitialBallonDorTop10(allPlayers);
  const affectedClubIds = new Set<string>();
  for (const p of seededTop10) {
    applyBallonDorTop10Boost(p, 0);
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

  // Surface the sponsorship system on day 1 — kit_main + digital are
  // auto-signed by generateStarterDeals, but the Finance page's Pending
  // Offers section would otherwise sit empty until the periodic offer
  // generator fires (week 2 at earliest, and only for slots that have
  // already been unlocked by facilities). Generate one introductory
  // kit_sleeve offer and queue an inbox welcome message pointing the
  // user at Finance.
  const starterSponsorDeals = generateStarterDeals(pcInit.reputation, 1);
  const starterSponsorOffers = generateStarterOffers(pcInit.reputation, 1, starterSponsorDeals);
  if (starterSponsorOffers.length > 0) {
    messages.push({
      id: safeRandomUUID(),
      week: 1,
      season: 1,
      type: 'sponsorship',
      title: 'Sponsor Offer Awaiting Review',
      body: `Welcome aboard — a local brand has put a kit-sleeve sponsorship on the table for your club. To review it: tap "More" in the bottom navigation bar (three dots, bottom-right), then tap "Finance". Scroll down to the "Pending Offers" section and tap the row to see the weekly payment, duration, and bonus condition. Tap "Accept" to sign the deal — it'll pay weekly income for the rest of the season on top of your matchday revenue.`,
      read: false,
    });
  }

  set({
    gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: league?.totalWeeks || TOTAL_WEEKS,
    // A successful start clears any stale load error — otherwise a failed load
    // (or the unknown-club guard above) leaves `SaveRecoveryDialog` hanging over
    // a brand-new, perfectly healthy game.
    loadError: null,
    // Starting a real game always exits any Capture Studio session — without
    // this, a new career begun after a capture teleport would inherit the
    // save-write block and silently never persist.
    captureSession: false,
    gameMode: get().gameMode || 'sandbox',
    transferWindowOpen: true, clubs, players: allPlayers, fixtures, leagueTable, friendlies,
    divisionFixtures, divisionTables, divisionClubs, playerDivision,
    lastSeasonTurnover: null, derbies: DERBIES,
    activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
    transferMarket, shortlist: [], scoutWatchList: [], freeAgents: initialFreeAgentIds, transferNews: [], boardObjectives: objectives, boardConfidence: STARTING_BOARD_CONFIDENCE,
    currentScreen: 'dashboard', previousScreen: null, currentMatchResult: null, trainingFocus: 'fitness',
    messages, seasonHistory: [], incomingOffers: [], matchSubsUsed: 0, matchPhase: 'none', matchTeamTalk: 'none', matchGamePlan: 'none', currentCupTieId: null,
    settings: { matchSpeed: 3300, showOverallOnPitch: true, autoSave: true, hapticsEnabled: true, soundEnabled: true, hidePageHints: false, hideOnboarding: false, confirmAllOffers: false, reducedMotion: false, performanceMode: false },
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
      medicalLevel: clubMedicalLevel(pcInit.facilities),
      recoveryLevel: clubRecoveryLevel(pcInit.facilities),
      upgradeInProgress: null,
    },
    financeHistory: [], matchPlayerRatings: [],
    unlockedAchievements: [], pendingAchievementIds: [],
    managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0, biggestSigningFee: 0 },
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
    retiredLegends: [],
    lastPackWeek: 0,
    lastPackSeason: 0,
    dailyPackOpens: { date: '', free: {}, ad: {} },
    sponsorDeals: starterSponsorDeals,
    sponsorOffers: starterSponsorOffers,
    sponsorSlotCooldowns: {},
    negotiationStrikes: {},
    contractStrikes: {},
    merchandise: getDefaultMerchState(),
    fanMood: 50,
    pendingPressConference: null,
    halfTimeState: null,
    preMatchLeaguePosition: 0,
    seasonPhase: 'regular',
    // A new career must not inherit the previous one's promotion playoff.
    // `initGame` sets state explicitly rather than resetting to the slice
    // defaults, so anything omitted here survives into the new save.
    playoffState: null,
    clubPowerRankings: initializeClubPowerRankings(clubs, LEAGUES),
    activeNegotiation: null,
    pendingTransferTalk: null,
    pendingGemReveal: null,
    activeChallenge: null,
    selectedPlayerId: null,
    lastMatchXPGain: 0,
    seasonGrowthTracker: {},
    // National-team + interview state and once-per-season perk flags —
    // initGame is the canonical new-world writer, so without these a new
    // save inherits the previous save's NT job (dead player IDs, phantom
    // tournament at season end) and pre-spent Galactico/Invincible perks.
    nationalTeam: null,
    internationalTournament: null,
    managerNationality: null,
    nationalTeamOffer: null,
    showNationalTeamOffer: false,
    activeInterview: null,
    galacticoUsedThisSeason: false,
    invincibleUsedThisSeason: false,
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
