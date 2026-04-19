import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier, getTierBorderStyle, getTierGlowStyle } from '@/utils/uiHelpers';
import type { PlayerTier } from '@/config/ui';

interface TierBorderFrameProps {
  /** Either pass a resolved tier or let the frame derive one from `overall`. */
  tier?: PlayerTier;
  overall?: number | null;
  /** Apply a subtle outer glow on Gold/Legendary tiers. */
  glow?: boolean;
  /** Outer corner radius class. Must pair with `innerRadiusClass`. */
  outerRadiusClass?: string;
  /** Inner corner radius class. Should be ~2px smaller than the outer. */
  innerRadiusClass?: string;
  /** Gradient stroke thickness. Defaults to 1.5px. */
  paddingClass?: string;
  /** Extra classes for the outer gradient wrapper. */
  className?: string;
  /** Extra classes for the inner content container. */
  innerClassName?: string;
  /** Additional inline style merged onto the outer wrapper. */
  style?: CSSProperties;
  /** Whether to expose `data-tier` for tests/styling. Defaults to true. */
  withDataTier?: boolean;
  children: ReactNode;
}

/**
 * Wraps content in a player-quality gradient border (Legendary/Gold/Silver/
 * Bronze/Common). Centralizes the outer-padding + inner-radius recipe so new
 * player-card surfaces don't re-invent it. Pass `glow` to give Gold and
 * Legendary tiers a subtle box-shadow halo.
 */
export const TierBorderFrame = memo(function TierBorderFrame({
  tier: tierProp,
  overall,
  glow = false,
  outerRadiusClass = 'rounded-lg',
  innerRadiusClass = 'rounded-[6.5px]',
  paddingClass = 'p-[1.5px]',
  className,
  innerClassName,
  style,
  withDataTier = true,
  children,
}: TierBorderFrameProps) {
  const tier = useMemo(
    () => tierProp ?? getPlayerTier(overall ?? 0),
    [tierProp, overall],
  );
  const wrapperStyle = useMemo<CSSProperties>(() => {
    const base = getTierBorderStyle(tier);
    const glowStyle = glow ? getTierGlowStyle(tier) : undefined;
    return { ...base, ...glowStyle, ...style };
  }, [tier, glow, style]);

  return (
    <div
      className={cn(outerRadiusClass, paddingClass, 'overflow-hidden', className)}
      style={wrapperStyle}
      data-tier={withDataTier ? tier.key : undefined}
    >
      <div className={cn(innerRadiusClass, 'overflow-hidden', innerClassName)}>{children}</div>
    </div>
  );
});
