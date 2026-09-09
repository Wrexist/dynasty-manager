/** Apply reviewed roster facts before generating game data, never to a save. */
export function applyTransferUpdates(rows, ledger, clubs) {
  const byId = new Map(rows.map(row => [row.player_id, row]));
  if (byId.size !== rows.length) throw new Error('Duplicate player IDs in source data');
  const clubById = new Map(clubs.map(club => [club.id, club]));
  const seen = new Set();
  const updates = new Map();
  for (const transfer of ledger.transfers) {
    const { playerId, name, nationality, toClubId, source, date, kind } = transfer;
    if (seen.has(playerId)) throw new Error(`Duplicate transfer for ${playerId}`);
    seen.add(playerId);
    const player = byId.get(playerId);
    if (!player || player.name !== name || player.nationality !== nationality) {
      throw new Error(`Transfer identity mismatch: ${playerId} (${name})`);
    }
    const club = clubById.get(toClubId);
    const isFreeAgent = kind === 'free-agent' && toClubId === null;
    if (!club && !isFreeAgent) throw new Error(`Unknown transfer destination: ${toClubId}`);
    if (kind === 'free-agent' && !isFreeAgent) throw new Error('Free agents cannot have a destination club');
    if (!/^https:\/\//.test(ledger.sources[source] ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > ledger.asOf) {
      throw new Error(`Missing source or invalid verification date: ${playerId}`);
    }
    if (!['permanent', 'loan', 'free-agent'].includes(kind)) throw new Error(`Unknown transfer kind: ${kind}`);
    if (kind === 'loan' && (!clubById.has(transfer.loan?.fromClubId) || transfer.loan.fromClubId === toClubId)) {
      throw new Error(`Missing or invalid parent club for ${name}`);
    }
    if (!Number.isFinite(Number(player.potential)) || !player.potential) {
      throw new Error(`Transferred player would be dropped for missing potential: ${playerId}`);
    }
    updates.set(playerId, {
      ...player,
      game_club_id: club?.id ?? '',
      game_club_name: club?.name ?? '',
      game_league_id: club?.divisionId ?? '',
      club_source: `${source}:${date}`,
    });
  }
  return rows.map(row => updates.get(row.player_id) ?? row);
}
