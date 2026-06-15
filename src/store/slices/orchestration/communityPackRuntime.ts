import type { TransferListing } from '@/types/game';
import type { GameState } from '../../storeTypes';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { getActivePool, drawForMarket, drawForFaPoolSeed } from '@/utils/communityPackPool';
import { buildPlayerFromTemplate } from '@/utils/playerGen';
import {
  CP_FA_SEED_COUNT_BY_SEASON, CP_FA_SEED_MIN_AGE, CP_FA_SEED_MAX_AGE,
  CP_FA_SEED_ELITE_MIN_OVR, CP_FA_SEED_TOP_MIN_OVR, CP_FA_SEED_MID_MIN_OVR,
  CP_FA_SEED_ELITE_COUNT, CP_FA_SEED_TOP_COUNT,
} from '@/config/aiSimulation';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/**
 * Community pack market refresh: every 4 weeks, rotate out the oldest 20
 * listings and draw 20 fresh templates from the free-agent pool. The
 * `lastMarketRefreshWeek > week` leg catches the post-endSeason case where week
 * has just reset to 1 but lastMarketRefreshWeek is still the previous season's
 * late-game value (e.g. 44); without it the `>=4` check would stall for most of
 * the next season.
 *
 * Extracted from advanceWeekImpl (weekAdvance.ts) to keep the game loop
 * readable. Behaviour-guarded by communityPackRuntime.test.ts, which drives
 * this exact path through advanceWeek in the normal suite.
 */
export async function refreshCommunityPackMarket(set: Set, get: Get): Promise<void> {
  const cpState = get();
  const weeksSinceRefresh = cpState.week - cpState.cpPool.lastMarketRefreshWeek;
  const seasonRolledOver = cpState.cpPool.lastMarketRefreshWeek > cpState.week;
  if (!(cpState.communityPackEnabled && (weeksSinceRefresh >= 4 || seasonRolledOver))) return;

  const rotateOut = cpState.cpPool.marketListings.slice(0, 20);
  const keep = cpState.cpPool.marketListings.slice(20);
  const freeAgentsMod = await import('@/data/communityPack/freeAgents');
  const cpFreeAgents = freeAgentsMod.freeAgents as PlayerTemplate[];
  const activePool = getActivePool(cpFreeAgents, cpState.cpPool);
  const newDraws = drawForMarket(
    activePool,
    20,
    cpState.cpPool.usedFcIds,
    cpState.cpPool.shuffleSeed + cpState.week,
  );
  const newIds = newDraws
    .map(t => t.fcId)
    .filter((id): id is string => typeof id === 'string');

  const rotateOutSet = new Set(rotateOut);
  const updatedPlayers = { ...cpState.players };
  const newListings: TransferListing[] = [];
  for (const t of newDraws) {
    const p = buildPlayerFromTemplate(t, '', cpState.season);
    if (t.fcId) p.fcId = t.fcId;
    updatedPlayers[p.id] = p;
    const markup = 1.1 + Math.random() * 0.4;
    newListings.push({
      playerId: p.id,
      askingPrice: Math.max(50_000, Math.round(p.value * markup)),
      sellerClubId: '',
      externalPlayer: true,
      divisionId: '',
    });
  }

  // Drop listings whose external player was rotated out, and prune those
  // orphaned player records from state. Track which fcIds were actually
  // deleted: a rotated-out player who was SIGNED by a club is no longer on the
  // transferMarket, so he survives this loop — and freeing his fcId from
  // usedFcIds would let a later draw issue a second copy of the same real player.
  const keptMarket: TransferListing[] = [];
  const deletedFcIds = new Set<string>();
  for (const l of cpState.transferMarket) {
    const p = updatedPlayers[l.playerId];
    if (p?.fcId && rotateOutSet.has(p.fcId)) {
      deletedFcIds.add(p.fcId);
      delete updatedPlayers[l.playerId];
      continue;
    }
    keptMarket.push(l);
  }

  // fcIds that still have an active transferMarket listing after the prune.
  // Kept marketListings entries whose player was signed mid-cycle are dropped
  // (their fcIds stay in usedFcIds — the player still exists in the world).
  const liveListedFcIds = new Set<string>();
  for (const l of keptMarket) {
    const fcId = updatedPlayers[l.playerId]?.fcId;
    if (fcId) liveListedFcIds.add(fcId);
  }

  set({
    transferMarket: [...keptMarket, ...newListings],
    players: updatedPlayers,
    cpPool: {
      ...cpState.cpPool,
      // Advance the cursor by the number of templates we just consumed.
      // Without this, getActivePool() keeps returning the same 800-entry window
      // with an ever-growing used-fcId filter — in long saves the effective
      // pool starves silently. Aligns runtime behaviour with the existing
      // advanceCursor unit tests.
      cursor: cpState.cpPool.cursor + newDraws.length,
      marketListings: [...keep.filter(id => liveListedFcIds.has(id)), ...newIds],
      usedFcIds: [
        ...cpState.cpPool.usedFcIds.filter(id => !deletedFcIds.has(id)),
        ...newIds,
      ],
      lastMarketRefreshWeek: cpState.week,
    },
  });
}

/**
 * Phase E.7 — CP FA-pool season-start seed. Fires on the first regular tick of
 * season 2+ (CP_FA_SEED_COUNT_BY_SEASON tapers the count), gated by
 * cpPool.lastSeedSeason so reloads don't re-inject. Season 1 is seeded inline at
 * initGame. No week check: this runs after the week was already advanced (week
 * is >= 2 here, and season-end paths return before reaching it), so a
 * `week === 1` guard would make the seed unreachable; the lastSeedSeason gate
 * alone is the once-per-season idempotency guard.
 *
 * Extracted verbatim from advanceWeekImpl to keep the game loop readable.
 * Behaviour-guarded by communityPackFaSeed.test.ts.
 */
export async function seedCommunityPackFreeAgents(set: Set, get: Get): Promise<void> {
  const cpSeedState = get();
  const seedCount = CP_FA_SEED_COUNT_BY_SEASON[cpSeedState.season] ?? 0;
  if (!(
    cpSeedState.communityPackEnabled &&
    seedCount > 0 &&
    cpSeedState.cpPool.lastSeedSeason < cpSeedState.season
  )) return;

  const freeAgentsMod = await import('@/data/communityPack/freeAgents');
  const cpFreeAgents = freeAgentsMod.freeAgents as PlayerTemplate[];
  const activePool = getActivePool(cpFreeAgents, cpSeedState.cpPool);
  const seeds = drawForFaPoolSeed(
    activePool,
    seedCount,
    cpSeedState.cpPool.usedFcIds,
    cpSeedState.cpPool.shuffleSeed ^ (0x5A5A5A5A + cpSeedState.season),
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
  if (seeds.length > 0) {
    const updatedPlayers = { ...cpSeedState.players };
    const updatedFreeAgents = [...cpSeedState.freeAgents];
    const newFcIds: string[] = [];
    for (const t of seeds) {
      const p = buildPlayerFromTemplate(t, '', cpSeedState.season);
      if (t.fcId) p.fcId = t.fcId;
      p.clubId = '';
      p.wage = Math.round(p.wage * 0.8);
      updatedPlayers[p.id] = p;
      updatedFreeAgents.push(p.id);
      if (t.fcId) newFcIds.push(t.fcId);
    }
    set({
      players: updatedPlayers,
      freeAgents: updatedFreeAgents,
      cpPool: {
        ...cpSeedState.cpPool,
        cursor: cpSeedState.cpPool.cursor + seeds.length,
        usedFcIds: [...cpSeedState.cpPool.usedFcIds, ...newFcIds],
        lastSeedSeason: cpSeedState.season,
      },
    });
  } else {
    // No eligible templates (pool exhausted or all used) — still bump the
    // marker so we don't retry every tick.
    set({
      cpPool: { ...cpSeedState.cpPool, lastSeedSeason: cpSeedState.season },
    });
  }
}
