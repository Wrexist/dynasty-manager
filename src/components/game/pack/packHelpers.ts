import { PLAYER_TIER_THRESHOLDS, type PlayerTier } from '@/config/ui';
import { buildTierGradient } from '@/utils/uiHelpers';
import type { Player } from '@/types/game';

/** Resolve the design-system tier for a given OVR value. */
export function tierForOvr(ovr: number): PlayerTier {
  for (const t of PLAYER_TIER_THRESHOLDS) {
    if (ovr >= t.min) return t;
  }
  return PLAYER_TIER_THRESHOLDS[PLAYER_TIER_THRESHOLDS.length - 1];
}

/**
 * Pack-surface gradient — 135deg with a 45% mid-stop for a punchier face
 * than the 50% neutral border stop. Delegates to the shared primitive in
 * `uiHelpers.buildTierGradient` so the colour palette stays single-sourced.
 */
export function tierGradient(tier: PlayerTier): string {
  return buildTierGradient(tier, 45);
}

/** The pull that headlines a pack: a Hall of Legends card outranks any
 *  ordinary pull, then highest OVR (first wins ties). Same rule as the
 *  Recent Pulls card in `PacksPage`, so the best-pull chip, the share card and
 *  the history all name the same card. */
export function pickBestPull<T extends Pick<Player, 'overall' | 'legendId'>>(players: T[]): T | null {
  if (players.length === 0) return null;
  return players.reduce((top, p) => {
    if (!!p.legendId !== !!top.legendId) return p.legendId ? p : top;
    return p.overall > top.overall ? p : top;
  }, players[0]);
}
