import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier, getFitnessHexColor, getStableJerseyNumber } from '@/utils/uiHelpers';
import { getPlayerDisplayName, getCardNameFontSizeClass } from '@/utils/playerDisplay';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { TierBorderFrame } from './TierBorderFrame';
import { FlagIcon } from './FlagIcon';

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
  clubColor?: string;
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
  clubColor,
  onClick,
}: PlayerCardProps) {
  const fitnessColor = getFitnessHexColor(player.fitness);
  const statusLabel = getStatusLabel(player, week);
  const tier = getPlayerTier(player.overall);
  const displayName = getPlayerDisplayName(player);
  const nameFontSizeClass = getCardNameFontSizeClass(displayName);
  const fullName = `${player.firstName} ${player.lastName}`;
  const jersey = getStableJerseyNumber(player.id);

  const chemDisplay = chemistryLinkCount > 9 ? '9+' : chemistryLinkCount;
  const formTrend: 'hot' | 'cold' | null =
    typeof player.form === 'number'
      ? player.form >= HOT_FORM_MIN
        ? 'hot'
        : player.form < COLD_FORM_MAX
          ? 'cold'
          : null
      : null;

  const showChemistry = variant === 'starter' && chemistryLinkCount > 0;
  const showBestSub = variant === 'bench' && !!isBestSub;

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-[7px] w-[48px] h-[64px] sm:w-[54px] sm:h-[72px] shrink-0 relative',
        'transition-transform duration-150',
        isSelected && 'scale-[1.08]',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        !isSelected && showBestSub && 'shadow-[0_0_8px_hsl(var(--primary)/0.35)]',
        player.injured && 'opacity-60',
      )}
    >
      {statusLabel && (
        <span className="absolute -top-1.5 -right-1.5 z-10 text-[6px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm">
          {statusLabel}
        </span>
      )}

      {isSelected && (
        <span className="absolute inset-0 rounded-[7px] ring-2 ring-primary animate-pulse pointer-events-none z-10" />
      )}

      <TierBorderFrame
        overall={player.overall}
        glow
        outerRadiusClass="rounded-[7px]"
        innerRadiusClass="rounded-[5.5px]"
        paddingClass="p-[1.5px]"
        className="w-full h-full"
        innerClassName={cn(
          'w-full h-full flex flex-col',
          'bg-gradient-to-b from-black/85 to-black/65 backdrop-blur-sm',
          clubColor && 'border-l-[2px]',
        )}
        style={clubColor ? { borderLeftColor: clubColor } : undefined}
      >
        {/* Row A: rating + flag + position */}
        <div className="flex items-center justify-between gap-0.5 px-1 pt-0.5 leading-none">
          <span className={cn('text-[15px] font-black font-display tabular-nums leading-none', tier.textClass)}>
            {player.overall}
          </span>
          <div className="flex items-center gap-0.5 min-w-0">
            <FlagIcon nationality={player.nationality} size={10} className="rounded-sm shrink-0" />
            <span className="text-[7px] font-semibold uppercase tracking-wider text-white/75 bg-white/10 rounded-sm px-1 py-px leading-none">
              {position}
            </span>
          </div>
        </div>

        {/* Row B: portrait band (jersey watermark + status indicators) */}
        <div className="relative flex-1 flex items-center justify-center">
          <span className="text-[22px] font-black font-display text-white/[0.07] tabular-nums leading-none select-none">
            {jersey}
          </span>
          <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
            <span className={cn('w-1 h-1 rounded-full', getMoraleDotClass(player.morale))} aria-label={`Morale ${player.morale}`} />
            {formTrend === 'hot' && <TrendingUp className="w-[7px] h-[7px] text-emerald-400" aria-label="Hot form" />}
            {formTrend === 'cold' && <TrendingDown className="w-[7px] h-[7px] text-red-400" aria-label="Poor form" />}
          </div>
          {showChemistry && (
            <div className="absolute bottom-0.5 right-0.5 flex items-center gap-px text-[6px] text-primary font-semibold tabular-nums leading-none">
              <Link className="w-[6px] h-[6px]" />
              {chemDisplay}
            </div>
          )}
          {showBestSub && (
            <TrendingUp className="absolute bottom-0.5 right-0.5 w-[7px] h-[7px] text-primary" aria-label="Suggested sub" />
          )}
        </div>

        {/* Row C: name */}
        <div className="px-0.5 leading-none">
          <span
            className={cn(
              nameFontSizeClass,
              'block font-bold text-white/95 uppercase tracking-wide truncate whitespace-nowrap text-center',
            )}
            title={fullName}
            aria-label={fullName}
          >
            {displayName}
          </span>
        </div>

        {/* Row D: fitness bar */}
        <div className="w-full h-[3px] rounded-b-[5.5px] bg-white/10 mt-0.5 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
            aria-label={`Fitness ${player.fitness}%`}
          />
        </div>
      </TierBorderFrame>
    </div>
  );
});
