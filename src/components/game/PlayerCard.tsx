import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier, getFitnessHexColor } from '@/utils/uiHelpers';
import { getPlayerDisplayName, getCardNameFontSizeClass } from '@/utils/playerDisplay';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { TierBorderFrame } from './TierBorderFrame';
import { FlagIcon } from './FlagIcon';
import { CardArtBackground } from './CardArtBackground';

const HOT_FORM_MIN = 70;
const COLD_FORM_MAX = 35;

interface PlayerCardProps {
  player: Player;
  position: string;
  isSelected: boolean;
  chemistryLinkCount: number;
  compatRing?: 'natural' | 'compatible' | 'wrong' | null;
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
  isSelected,
  chemistryLinkCount,
  compatRing,
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

  const chemDisplay = chemistryLinkCount > 9 ? '9+' : chemistryLinkCount;
  const formTrend: 'hot' | 'cold' | null =
    typeof player.form === 'number'
      ? player.form >= HOT_FORM_MIN
        ? 'hot'
        : player.form < COLD_FORM_MAX
          ? 'cold'
          : null
      : null;

  const showChemistry = chemistryLinkCount > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-[7px] w-[48px] h-[48px] sm:w-[54px] sm:h-[54px] shrink-0 relative',
        'transition-transform duration-150',
        isSelected && 'scale-[1.08]',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
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
          'w-full h-full relative',
          clubColor && 'border-l-[2px]',
        )}
        style={clubColor ? { borderLeftColor: clubColor } : undefined}
      >
        <CardArtBackground overall={player.overall} overlayStrength={0.75} />

        <div className="relative w-full h-full flex flex-col px-1 py-0.5 gap-px">
        {/* Row A: rating + flag + position (all plain text, no pill) */}
        <div className="flex items-center justify-between gap-px w-full min-w-0 leading-none">
          <span className={cn('text-[13px] font-black font-display tabular-nums leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]', tier.textClass)}>
            {player.overall}
          </span>
          <FlagIcon nationality={player.nationality} size={9} className="rounded-[1px] shrink-0" />
          <span className="text-[6px] font-bold uppercase tracking-wider text-white/85 leading-none shrink-0 tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            {position}
          </span>
        </div>

        {/* Row B: name centered */}
        <div className="flex-1 flex items-center justify-center min-w-0 leading-none">
          <span
            className={cn(
              nameFontSizeClass,
              'block font-bold text-white uppercase tracking-wide truncate whitespace-nowrap w-full text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]',
            )}
            title={fullName}
            aria-label={fullName}
          >
            {displayName}
          </span>
        </div>

        {/* Row C: morale + form + chem/best-sub */}
        <div className="flex items-center justify-between w-full min-w-0 leading-none">
          <div className="flex items-center gap-px shrink-0">
            <span className={cn('w-1 h-1 rounded-full', getMoraleDotClass(player.morale))} aria-label={`Morale ${player.morale}`} />
            {formTrend === 'hot' && <TrendingUp className="w-[7px] h-[7px] text-emerald-400" aria-label="Hot form" />}
            {formTrend === 'cold' && <TrendingDown className="w-[7px] h-[7px] text-red-400" aria-label="Poor form" />}
          </div>
          {showChemistry && (
            <span className="flex items-center gap-px text-[6px] text-primary font-semibold tabular-nums leading-none shrink-0">
              <Link className="w-[6px] h-[6px]" />
              {chemDisplay}
            </span>
          )}
        </div>

        {/* Row D: fitness bar */}
        <div className="w-full h-[3px] rounded-b-[5.5px] bg-black/50 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
            aria-label={`Fitness ${player.fitness}%`}
          />
        </div>
        </div>
      </TierBorderFrame>
    </div>
  );
});
