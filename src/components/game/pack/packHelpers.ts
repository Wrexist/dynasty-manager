import { PLAYER_TIER_THRESHOLDS, type PlayerTier } from '@/config/ui';

/** Resolve the design-system tier for a given OVR value. */
export function tierForOvr(ovr: number): PlayerTier {
  for (const t of PLAYER_TIER_THRESHOLDS) {
    if (ovr >= t.min) return t;
  }
  return PLAYER_TIER_THRESHOLDS[PLAYER_TIER_THRESHOLDS.length - 1];
}

/** Build an inline gradient background string for a tier. */
export function tierGradient(tier: PlayerTier): string {
  return `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientVia} 45%, ${tier.gradientTo} 100%)`;
}
