import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier, getFitnessHexColor } from '@/utils/uiHelpers';
import { getPlayerDisplayName, getCardNameFontSizeClass } from '@/utils/playerDisplay';
import { Link, TrendingUp } from 'lucide-react';
import type { Player } from '@/types/game';
import { TierBorderFrame } from './TierBorderFrame';

interface PlayerCardProps {
  player: Player;
  position: string;
  variant: 'starter' | 'bench';
  isSelected: boolean;
  chemistryLinkCount: number;
  compatRing?: 'natural' | 'compatible' | 'wrong' | null;
  isBestSub?: boolean;
  week?: number;
  onClick: () => void;
}

const COMPAT_RING_CLASSES = {
  natural: 'ring-2 ring-emerald-400/80',
  compatible: 'ring-2 ring-amber-400/80',
  wrong: 'ring-2 ring-red-500/80',
};

function getMoraleDotClass(morale: number): string {
  if (morale >= 60) return 'bg-emerald-400';
  if (morale >= 35) return 'bg-amber-400';
  return 'bg-red-400';
}

function getStatusLabel(player: Player, week?: number): string | null {
  if (player.injured) return 'INJ';
  if (player.suspendedUntilWeek && (week === undefined || player.suspendedUntilWeek > week)) return 'SUS';
  return null;
}

export const PlayerCard = memo(function PlayerCard({
  player,
  position,
  variant,
  isSelected,
  chemistryLinkCount,
  compatRing,
  isBestSub,
  week,
  onClick,
}: PlayerCardProps) {
  const fitnessColor = getFitnessHexColor(player.fitness);
  const statusLabel = getStatusLabel(player, week);
  const tier = getPlayerTier(player.overall);
  const displayName = getPlayerDisplayName(player);
  const nameFontSizeClass = getCardNameFontSizeClass(displayName);
  const fullName = `${player.firstName} ${player.lastName}`;

  if (variant === 'bench') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'shrink-0 cursor-pointer rounded-lg min-w-[44px] relative',
          'transition-all duration-150',
          isSelected && 'ring-2 ring-primary scale-110',
          !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
          !isSelected && isBestSub && 'shadow-[0_0_8px_hsl(var(--primary)/0.35)]',
          player.injured && 'opacity-40',
        )}
      >
        <TierBorderFrame
          overall={player.overall}
          glow
          innerClassName="flex flex-col items-center bg-black/70 backdrop-blur-sm px-2 py-1.5"
        >
          <div className="flex items-center gap-1 max-w-full">
            <span
              className={cn(
                nameFontSizeClass,
                'font-bold text-white/90 uppercase tracking-wide leading-tight truncate whitespace-nowrap min-w-0',
              )}
              title={fullName}
              aria-label={fullName}
            >
              {displayName}
            </span>
            <span className={cn('text-[10px] font-bold font-display tabular-nums shrink-0', tier.textClass)}>
              {player.overall}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[6px] text-gray-400 font-medium">{player.position}</span>
            {isBestSub && <TrendingUp className="w-2 h-2 text-primary" />}
            {statusLabel && (
              <span className="text-[5px] font-bold text-red-400">{statusLabel}</span>
            )}
          </div>
          {/* Fitness indicator */}
          <div className="w-full h-[2px] rounded-full bg-white/10 mt-1">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
            />
          </div>
        </TierBorderFrame>
      </div>
    );
  }

  // Starter variant
  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg min-w-[40px] relative',
        'transition-all duration-150',
        isSelected && 'ring-2 ring-primary scale-110 shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        player.injured && 'opacity-60',
      )}
    >
      {/* Status badge (injury/suspension) */}
      {statusLabel && (
        <span className="absolute -top-1.5 -right-1.5 z-10 text-[5px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm">
          {statusLabel}
        </span>
      )}

      <TierBorderFrame
        overall={player.overall}
        glow
        innerClassName="flex flex-col items-center bg-black/80 backdrop-blur-sm px-2 py-1.5"
      >
        {/* Rating - largest element */}
        <span className={cn('text-sm font-bold font-display tabular-nums leading-none', tier.textClass)}>
          {player.overall}
        </span>

        {/* Fitness bar */}
        <div className="w-full h-[2px] rounded-full bg-white/10 my-0.5">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
          />
        </div>

        {/* Name + morale dot */}
        <div className="flex items-center gap-0.5 max-w-full">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getMoraleDotClass(player.morale))} />
          <span
            className={cn(
              nameFontSizeClass,
              'font-bold text-white/90 uppercase tracking-wide leading-tight truncate whitespace-nowrap min-w-0',
            )}
            title={fullName}
            aria-label={fullName}
          >
            {displayName}
          </span>
        </div>

        {/* Position + Chemistry */}
        <div className="flex items-center gap-0.5 mt-px">
          <span className="text-[6px] text-gray-400 font-medium leading-tight">{position}</span>
          {chemistryLinkCount > 0 && (
            <span className="flex items-center gap-px text-[6px] text-primary font-semibold leading-tight">
              <Link className="w-1.5 h-1.5" />
              {chemistryLinkCount}
            </span>
          )}
        </div>
      </TierBorderFrame>
    </div>
  );
});
