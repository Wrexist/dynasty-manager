import { PLAYER_TIER_THRESHOLDS, type PlayerTier } from '@/config/ui';
import { buildTierGradient } from '@/utils/uiHelpers';

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
