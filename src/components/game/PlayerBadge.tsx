/**
 * PlayerBadge — unified glass-morphism player card badge.
 *
 * Replaces inline card implementations in GemRevealModal and PlayerDetail.
 * Dark glass background with club-color left accent stripe.
 */

import { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerTier } from '@/utils/uiHelpers';
import { TierBorderFrame } from './TierBorderFrame';
import { CardArtBackground } from './CardArtBackground';

interface PlayerBadgeProps {
  clubColor: string;
  overall: number;
  position: string;
  jerseyNumber?: number;
  size?: 'sm' | 'md' | 'lg';
  growthDelta?: number;
  /** Suppress the tier glow halo (e.g. when nested inside a glowing parent). */
  noGlow?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-[40px] h-[48px]',
  md: 'w-[52px] h-[66px]',
  lg: 'w-[60px] h-[76px]',
} as const;

const RATING_SIZE = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
} as const;

const POS_SIZE = {
  sm: 'text-[7px] px-1 py-px',
  md: 'text-[8px] px-1.5 py-0.5',
  lg: 'text-[9px] px-2 py-0.5',
} as const;

export const PlayerBadge = memo(function PlayerBadge({
  clubColor,
  overall,
  position,
  jerseyNumber,
  size = 'md',
  growthDelta,
  noGlow = false,
  className,
}: PlayerBadgeProps) {
  const showJersey = size !== 'sm' && jerseyNumber != null && jerseyNumber > 0;
  const showGrowth = size === 'lg' && growthDelta != null && growthDelta !== 0;
  const tier = getPlayerTier(overall);
  const showArtwork = size !== 'sm';

  return (
    <div className={cn('relative shrink-0', className)}>
      <TierBorderFrame
        tier={tier}
        overall={overall}
        glow={!noGlow}
        outerRadiusClass="rounded-xl"
        innerRadiusClass="rounded-[10px]"
        paddingClass="p-[2px]"
        announceTier
      >
        <div
          className={cn(
            SIZE_CLASSES[size],
            'relative flex flex-col items-center justify-between py-1.5',
            !showArtwork && 'bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl',
            'border border-border/50 border-l-[3px] rounded-[10px] overflow-hidden',
          )}
          style={{ borderLeftColor: clubColor }}
        >
          {showArtwork && <CardArtBackground overall={overall} overlayStrength={0.65} />}

          {/* Position pill */}
          <span className={cn(
            POS_SIZE[size],
            'relative font-bold bg-black/40 text-white rounded-full leading-tight tracking-wide drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]',
          )}>
            {position}
          </span>

          {/* Overall rating */}
          <span className={cn(
            RATING_SIZE[size],
            'relative font-black font-display tabular-nums leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]',
            tier.textClass,
          )}>
            {overall}
          </span>

          {/* Jersey number */}
          {showJersey && (
            <span className="relative text-[9px] font-medium text-white/90 tabular-nums leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
              #{jerseyNumber}
            </span>
          )}
        </div>
      </TierBorderFrame>

      {/* Growth indicator (lg only) */}
      {showGrowth && growthDelta > 0 && (
        <TrendingUp className="absolute -top-1 -left-1 w-4 h-4 text-emerald-400" />
      )}
      {showGrowth && growthDelta < 0 && (
        <TrendingDown className="absolute -top-1 -left-1 w-4 h-4 text-destructive" />
      )}
    </div>
  );
});
