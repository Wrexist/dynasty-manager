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
