/**
 * Roster integrity helpers.
 *
 * Any code path that moves a player into a club's `playerIds` MUST first
 * detach that player from every other roster. Otherwise stale listings,
 * out-of-sync free-agent records, or mid-flight loans can leave the same
 * player owned by two clubs — an integrity error that breaks match sim,
 * transfers, wage bills, and save migration.
 */

import type { Club } from '@/types/game';
import type { GameState } from '../storeTypes';

/**
 * Remove a player id from every club's roster-tracking arrays
 * (`playerIds`, `lineup`, `subs`) and clear set-piece/penalty taker
 * references when they point at this player. Returns a shallow-copy of
 * the clubs map; clubs that don't reference the player are not cloned.
 *
 * Always call this before appending a player id to a club's `playerIds`
 * so the same player can never appear in two clubs simultaneously.
 */
export function detachPlayerFromAllClubs(
  clubs: Record<string, Club>,
  playerId: string,
): Record<string, Club> {
  const out = { ...clubs };
  for (const [cid, c] of Object.entries(out)) {
    const inRoster = c.playerIds.includes(playerId);
    const isTaker = c.setPieceTakerId === playerId || c.penaltyTakerId === playerId;
    if (!inRoster && !isTaker) continue;
    out[cid] = {
      ...c,
      playerIds: inRoster ? c.playerIds.filter(id => id !== playerId) : c.playerIds,
      lineup: inRoster ? c.lineup.filter(id => id !== playerId) : c.lineup,
      subs: inRoster ? c.subs.filter(id => id !== playerId) : c.subs,
      setPieceTakerId: c.setPieceTakerId === playerId ? undefined : c.setPieceTakerId,
      penaltyTakerId: c.penaltyTakerId === playerId ? undefined : c.penaltyTakerId,
    };
  }
  return out;
}

/**
 * Strip every state-wide reference to a player ID. Any code path that
 * removes a player from active play (sale, release, free-agent dropoff)
 * MUST run this to prevent ghost references in:
 *   - transferMarket, incomingOffers, incomingLoanOffers, outgoingLoanRequests,
 *     activeLoans, shortlist, scoutWatchList
 *   - negotiationStrikes, contractStrikes (keyed by playerId)
 *   - pendingFarewell, pendingTransferTalk
 *   - merchandise.signatureDrop.playerId (if it references this player)
 *
 * Pre-fix audit findings: `executeSale` cleaned transferMarket +
 * incomingOffers + activeLoans but missed outgoingLoanRequests,
 * pendingFarewell, sponsorDeals references. `releasePlayer` missed
 * activeLoans, outgoingLoanRequests, negotiationStrikes,
 * contractStrikes, pendingFarewell, pendingTransferTalk. Centralising
 * the cleanup here means future "remove player" paths can't drift.
 *
 * Returns a `Partial<GameState>` for the slice to spread into its
 * `set()` call. Caller is responsible for the players[id] mutation
 * (clubId='' or removal) — this helper only touches reference arrays.
 */
export function purgePlayerReferences(
  state: GameState,
  playerId: string,
): Partial<GameState> {
  const negotiationStrikes = { ...state.negotiationStrikes };
  delete negotiationStrikes[playerId];
  const contractStrikes = { ...(state.contractStrikes || {}) };
  delete contractStrikes[playerId];

  return {
    transferMarket: state.transferMarket.filter(l => l.playerId !== playerId),
    incomingOffers: state.incomingOffers.filter(o => o.playerId !== playerId),
    incomingLoanOffers: state.incomingLoanOffers.filter(o => o.playerId !== playerId),
    outgoingLoanRequests: state.outgoingLoanRequests.filter(r => r.playerId !== playerId),
    activeLoans: state.activeLoans.filter(l => l.playerId !== playerId),
    shortlist: state.shortlist.filter(id => id !== playerId),
    scoutWatchList: state.scoutWatchList.filter(id => id !== playerId),
    negotiationStrikes,
    contractStrikes,
    pendingFarewell: state.pendingFarewell.filter(f => f.playerId !== playerId),
    // If a transfer-talk modal is open for THIS player, dismiss it so
    // the modal isn't stuck on a ghost reference. Other players' talks
    // stay intact.
    pendingTransferTalk: state.pendingTransferTalk?.playerId === playerId
      ? null
      : state.pendingTransferTalk,
    // Cancel a pending merchandise signature drop pinned to this player.
    merchandise: state.merchandise?.signatureDrop?.playerId === playerId
      ? { ...state.merchandise, signatureDrop: null }
      : state.merchandise,
  };
}

/**
 * Guarantee that a player id appears in exactly one club's `playerIds` —
 * the destination. Detaches from every other club, then appends to the
 * destination if not already present. Use this as the final step whenever
 * a slice moves a player between clubs, to keep the invariant regardless
 * of whatever stale state existed before.
 */
export function placePlayerInClub(
  clubs: Record<string, Club>,
  destClubId: string,
  playerId: string,
): Record<string, Club> {
  const cleaned = detachPlayerFromAllClubs(clubs, playerId);
  const dest = cleaned[destClubId];
  if (!dest) return cleaned;
  if (dest.playerIds.includes(playerId)) return cleaned;
  return {
    ...cleaned,
    [destClubId]: { ...dest, playerIds: [...dest.playerIds, playerId] },
  };
}
