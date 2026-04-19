import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier, getFitnessHexColor } from '@/utils/uiHelpers';
import { getPlayerDisplayName, getCardNameFontSizeClass } from '@/utils/playerDisplay';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { TierBorderFrame } from './TierBorderFrame';

const HOT_FORM_MIN = 70;
const COLD_FORM_MAX = 35;

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

  const chemDisplay = chemistryLinkCount > 9 ? '9+' : chemistryLinkCount;
  const formTrend: 'hot' | 'cold' | null =
    typeof player.form === 'number'
      ? player.form >= HOT_FORM_MIN
        ? 'hot'
        : player.form < COLD_FORM_MAX
          ? 'cold'
          : null
      : null;

  if (variant === 'bench') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'shrink-0 cursor-pointer rounded-lg w-[52px] sm:w-[58px] relative',
          'transition-all duration-150',
          isSelected && 'ring-2 ring-primary scale-110',
          !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
          !isSelected && isBestSub && 'shadow-[0_0_8px_hsl(var(--primary)/0.35)]',
          player.injured && 'opacity-40',
        )}
      >
        {statusLabel && (
          <span className="absolute -top-1.5 -right-1.5 z-10 text-[5px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm">
            {statusLabel}
          </span>
        )}
        <TierBorderFrame
          overall={player.overall}
          glow
          innerClassName="flex flex-col bg-black/70 backdrop-blur-sm px-1.5 py-1"
        >
          {/* Row A: rating (left) + position (right) */}
          <div className="flex items-start justify-between w-full leading-none">
            <span className={cn('text-sm font-bold font-display tabular-nums', tier.textClass)}>
              {player.overall}
            </span>
            <span className="text-[6px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
              {player.position}
            </span>
          </div>

          {/* Row B: fitness bar */}
          <div className="w-full h-[2px] rounded-full bg-white/10 my-1">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
            />
          </div>

          {/* Row C: morale + form trend + name + best-sub arrow */}
          <div className="flex items-center gap-0.5 w-full min-w-0 leading-tight">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getMoraleDotClass(player.morale))} />
            {formTrend === 'hot' && <TrendingUp className="w-1.5 h-1.5 text-emerald-400 shrink-0" aria-label="Hot form" />}
            {formTrend === 'cold' && <TrendingDown className="w-1.5 h-1.5 text-red-400 shrink-0" aria-label="Poor form" />}
            <span
              className={cn(
                nameFontSizeClass,
                'font-bold text-white/90 uppercase tracking-wide truncate whitespace-nowrap min-w-0 flex-1',
              )}
              title={fullName}
              aria-label={fullName}
            >
              {displayName}
            </span>
            {isBestSub && <TrendingUp className="w-1.5 h-1.5 text-primary shrink-0" aria-label="Suggested sub" />}
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
        'cursor-pointer rounded-lg w-[52px] sm:w-[58px] shrink-0 relative',
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
        innerClassName="flex flex-col bg-black/80 backdrop-blur-sm px-1.5 py-1"
      >
        {/* Row A: rating (left) + position (right) */}
        <div className="flex items-start justify-between w-full leading-none">
          <span className={cn('text-sm font-bold font-display tabular-nums', tier.textClass)}>
            {player.overall}
          </span>
          <span className="text-[6px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
            {position}
          </span>
        </div>

        {/* Row B: fitness bar */}
        <div className="w-full h-[2px] rounded-full bg-white/10 my-1">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
          />
        </div>

        {/* Row C: morale dot + form trend + name + chemistry link */}
        <div className="flex items-center gap-0.5 w-full min-w-0 leading-tight">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getMoraleDotClass(player.morale))} />
          {formTrend === 'hot' && <TrendingUp className="w-1.5 h-1.5 text-emerald-400 shrink-0" aria-label="Hot form" />}
          {formTrend === 'cold' && <TrendingDown className="w-1.5 h-1.5 text-red-400 shrink-0" aria-label="Poor form" />}
          <span
            className={cn(
              nameFontSizeClass,
              'font-bold text-white/90 uppercase tracking-wide truncate whitespace-nowrap min-w-0 flex-1',
            )}
            title={fullName}
            aria-label={fullName}
          >
            {displayName}
          </span>
          {chemistryLinkCount > 0 && (
            <span className="flex items-center gap-px text-[6px] text-primary font-semibold shrink-0 tabular-nums">
              <Link className="w-1.5 h-1.5" />
              {chemDisplay}
            </span>
          )}
        </div>
      </TierBorderFrame>
    </div>
  );
});
