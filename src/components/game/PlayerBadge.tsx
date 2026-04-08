/**
 * PlayerBadge — unified glass-morphism player card badge.
 *
 * Replaces inline card implementations in GemRevealModal and PlayerDetail.
 * Dark glass background with club-color left accent stripe.
 */

import { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatingColor } from '@/utils/uiHelpers';

interface PlayerBadgeProps {
  clubColor: string;
  overall: number;
  position: string;
  jerseyNumber?: number;
  size?: 'sm' | 'md' | 'lg';
  growthDelta?: number;
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
  className,
}: PlayerBadgeProps) {
  const showJersey = size !== 'sm' && jerseyNumber != null && jerseyNumber > 0;
  const showGrowth = size === 'lg' && growthDelta != null && growthDelta !== 0;

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          SIZE_CLASSES[size],
          'rounded-xl flex flex-col items-center justify-between py-1.5',
          'bg-card/60 backdrop-blur-xl border border-border/50',
          'border-l-[3px]',
        )}
        style={{ borderLeftColor: clubColor }}
      >
        {/* Position pill */}
        <span className={cn(
          POS_SIZE[size],
          'font-bold bg-white/10 text-white/80 rounded-full leading-tight tracking-wide',
        )}>
          {position}
        </span>

        {/* Overall rating */}
        <span className={cn(
          RATING_SIZE[size],
          'font-black font-display tabular-nums leading-none',
          getRatingColor(overall),
        )}>
          {overall}
        </span>

        {/* Jersey number */}
        {showJersey && (
          <span className="text-[9px] font-medium text-muted-foreground tabular-nums leading-tight">
            #{jerseyNumber}
          </span>
        )}
      </div>

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
