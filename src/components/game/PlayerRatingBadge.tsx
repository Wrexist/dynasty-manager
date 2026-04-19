import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier } from '@/utils/uiHelpers';
import { TierBorderFrame } from '@/components/game/TierBorderFrame';

export type PlayerRatingBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SizeSpec {
  box: string;
  text: string;
  outerRadius: string;
  innerRadius: string;
}

const SIZE_MAP: Record<PlayerRatingBadgeSize, SizeSpec> = {
  xs: { box: 'w-7 h-7',   text: 'text-sm',   outerRadius: 'rounded-md', innerRadius: 'rounded-[4.5px]' },
  sm: { box: 'w-9 h-9',   text: 'text-base', outerRadius: 'rounded-lg', innerRadius: 'rounded-[6.5px]' },
  md: { box: 'w-10 h-10', text: 'text-lg',   outerRadius: 'rounded-lg', innerRadius: 'rounded-[6.5px]' },
  lg: { box: 'w-11 h-11', text: 'text-lg',   outerRadius: 'rounded-lg', innerRadius: 'rounded-[6.5px]' },
  xl: { box: 'w-14 h-14', text: 'text-2xl',  outerRadius: 'rounded-xl', innerRadius: 'rounded-[10.5px]' },
};

interface Props {
  overall: number;
  size?: PlayerRatingBadgeSize;
  shape?: 'square' | 'circle';
  glow?: boolean;
  className?: string;
}

/**
 * Single source of truth for the tier-bordered rating badge used across
 * Squad rows, negotiation modals, loan deals, and opponent rosters. Wraps
 * TierBorderFrame with a standardized inner gradient plate and tier-colored
 * numeral so every surface stays visually consistent.
 */
export const PlayerRatingBadge = memo(function PlayerRatingBadge({
  overall,
  size = 'md',
  shape = 'square',
  glow = true,
  className,
}: Props) {
  const spec = SIZE_MAP[size];
  const isCircle = shape === 'circle';
  const outerRadius = isCircle ? 'rounded-full' : spec.outerRadius;
  const innerRadius = isCircle ? 'rounded-full' : spec.innerRadius;

  return (
    <TierBorderFrame
      overall={overall}
      glow={glow}
      outerRadiusClass={outerRadius}
      innerRadiusClass={innerRadius}
      className={cn('shrink-0', className)}
      announceTier
    >
      <div className={cn(
        spec.box,
        innerRadius,
        'flex items-center justify-center bg-gradient-to-b from-white/[0.06] to-transparent',
      )}>
        <span className={cn(
          'font-display font-bold tabular-nums leading-none',
          spec.text,
          getPlayerTier(overall).textClass,
        )}>
          {overall}
        </span>
      </div>
    </TierBorderFrame>
  );
});
