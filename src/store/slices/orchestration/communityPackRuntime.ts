import type { TransferListing } from '@/types/game';
import type { GameState } from '../../storeTypes';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { getActivePool, drawForMarket } from '@/utils/communityPackPool';
import { buildPlayerFromTemplate } from '@/utils/playerGen';

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
