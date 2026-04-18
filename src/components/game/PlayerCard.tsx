import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getRatingColor, getFitnessHexColor } from '@/utils/uiHelpers';
import { Link, TrendingUp, ShieldCheck } from 'lucide-react';
import type { Player } from '@/types/game';

interface PlayerCardProps {
  player: Player;
  position: string;
  variant: 'starter' | 'bench';
  isSelected: boolean;
  chemistryLinkCount: number;
  compatRing?: 'natural' | 'compatible' | 'wrong' | null;
  isBestSub?: boolean;
  week?: number;
  /** Show a tiny shield badge when the player has a release clause. */
  showClauseBadge?: boolean;
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
  showClauseBadge,
  onClick,
}: PlayerCardProps) {
  const isWarning = player.fitness < 50 || (chemistryLinkCount === 0 && variant === 'starter');
  const fitnessColor = getFitnessHexColor(player.fitness);
  const statusLabel = getStatusLabel(player, week);
  const hasClause = !!(showClauseBadge && player.releaseClause && player.releaseClause > 0);

  if (variant === 'bench') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex flex-col items-center shrink-0 cursor-pointer rounded-lg px-2 py-1.5',
          'bg-black/60 backdrop-blur-sm border border-white/[0.08] min-w-[44px]',
          'transition-all duration-150',
          isSelected && 'ring-2 ring-primary scale-110',
          !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
          !isSelected && isBestSub && 'border-primary/50 shadow-[0_0_8px_hsl(var(--primary)/0.25)]',
          player.injured && 'opacity-40',
        )}
      >
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-bold text-white/90 uppercase tracking-wide">
            {player.lastName.slice(0, 3).toUpperCase()}
          </span>
          <span className={cn('text-[10px] font-bold font-display tabular-nums', getRatingColor(player.overall))}>
            {player.overall}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[6px] text-gray-400 font-medium">{player.position}</span>
          {isBestSub && <TrendingUp className="w-2 h-2 text-primary" />}
          {hasClause && (
            <ShieldCheck
              className="w-2 h-2 text-amber-400"
              aria-label={`Release clause £${((player.releaseClause || 0) / 1e6).toFixed(1)}M`}
            />
          )}
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
      </div>
    );
  }

  // Starter variant
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col items-center cursor-pointer rounded-lg relative',
        'bg-black/70 backdrop-blur-sm border px-2 py-1.5 min-w-[40px]',
        'transition-all duration-150',
        isSelected
          ? 'ring-2 ring-primary scale-110 border-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
          : isWarning
            ? 'border-red-500/40 shadow-[0_0_6px_rgba(239,68,68,0.2)]'
            : 'border-white/[0.08]',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        player.injured && 'opacity-60',
      )}
    >
      {/* Status badge (injury/suspension) */}
      {statusLabel && (
        <span className="absolute -top-1.5 -right-1.5 text-[5px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm">
          {statusLabel}
        </span>
      )}

      {/* Rating - largest element */}
      <span className={cn('text-sm font-bold font-display tabular-nums leading-none', getRatingColor(player.overall))}>
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
      <div className="flex items-center gap-0.5">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getMoraleDotClass(player.morale))} />
        <span className="text-[7px] font-bold text-white/90 uppercase tracking-wide leading-tight">
          {player.lastName.slice(0, 3).toUpperCase()}
        </span>
      </div>

      {/* Position + Chemistry + Clause */}
      <div className="flex items-center gap-0.5 mt-px">
        <span className="text-[6px] text-gray-400 font-medium leading-tight">{position}</span>
        {chemistryLinkCount > 0 && (
          <span className="flex items-center gap-px text-[6px] text-primary font-semibold leading-tight">
            <Link className="w-1.5 h-1.5" />
            {chemistryLinkCount}
          </span>
        )}
        {hasClause && (
          <ShieldCheck
            className="w-1.5 h-1.5 text-amber-400 shrink-0"
            aria-label={`Release clause £${((player.releaseClause || 0) / 1e6).toFixed(1)}M`}
          />
        )}
      </div>
    </div>
  );
});
