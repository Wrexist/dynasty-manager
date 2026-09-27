import type { CSSProperties } from 'react';
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

// The Gold cover includes an opaque matte outside its foil silhouette.
// Mask the source before the opening animation cuts it into strips, so the
// same clean edge is used by the store, guide, popup, and flying foil pieces.
export const GOLD_FOIL_MASK = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536"><path fill="white" d="M78 16H948V82C930 125 919 172 919 230L923 995C923 1200 930 1340 954 1432V1490H67V1432C92 1340 106 1220 106 1000L103 240C103 172 88 125 78 82Z"/></svg>')}")`;

/**
 * CSS mask that clips an overlay to a pack cover's own silhouette, as the
 * cover renders with `object-contain` in its box. Anything drawn OVER the
 * pack — a shimmer, a glow — goes through this: an unmasked overlay paints a
 * rectangle across the transparent margin around a shaped foil pack.
 */
export function packArtMaskStyle(src: string): CSSProperties {
  const image = src === '/packs/gold.webp' ? GOLD_FOIL_MASK : `url(${src})`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  };
}
