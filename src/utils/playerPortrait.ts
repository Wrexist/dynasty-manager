import type { Player, PlayerPortraitAsset } from '@/types/game';
import { PLAYER_PORTRAITS } from '@/data/playerPortraits';

function normalizedName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** A conservative sample resolver: unknown/anonymized identities retain the existing card.
 * Club-bound busts cannot follow a transfer in the wrong shirt. Unassigned pack
 * cards can show the source-club portrait until assigned to a different club.
 */
export function getPlayerPortrait(player: Player): PlayerPortraitAsset | null {
  if (player.source !== 'real' || !player.fcId) return null;
  const key = player.fcId.replace(/^fc\d{2}-/, '');
  const asset = Object.prototype.hasOwnProperty.call(PLAYER_PORTRAITS, key) ? PLAYER_PORTRAITS[key] : null;
  if (!asset || (player.clubId && player.clubId !== asset.clubId)) return null;
  const name = normalizedName(`${player.firstName} ${player.lastName}`);
  return asset.names.some(candidate => normalizedName(candidate) === name) ? asset : null;
}
