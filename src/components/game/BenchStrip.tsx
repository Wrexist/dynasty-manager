import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerTier, getFitnessHexColor } from '@/utils/uiHelpers';
import { getPlayerDisplayName } from '@/utils/playerDisplay';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { TierBorderFrame } from './TierBorderFrame';
import { FlagIcon } from './FlagIcon';
import { CardArtBackground } from './CardArtBackground';

const HOT_FORM_MIN = 70;
const COLD_FORM_MAX = 35;

interface BenchStripProps {
  player: Player;
  position: string;
  isSelected: boolean;
  chemistryLinkCount?: number;
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

/**
 * Horizontal bench/subs tile. Shows the same info density as the square
 * `PlayerCard bench` tile it replaces, but wider-and-shorter so the tier
 * shield artwork can render as a decorative top-strip background behind the
 * stats instead of being squashed into a 48px square.
 */
export const BenchStrip = memo(function BenchStrip({
  player,
  position,
  isSelected,
  chemistryLinkCount = 0,
  compatRing,
  isBestSub,
  week,
  clubColor,
  onClick,
}: BenchStripProps) {
  const fitnessColor = getFitnessHexColor(player.fitness);
  const statusLabel = getStatusLabel(player, week);
  const tier = getPlayerTier(player.overall);
  const displayName = getPlayerDisplayName(player);
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

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-[8px] w-[128px] h-[44px] sm:w-[144px] sm:h-[48px] shrink-0 relative',
        'transition-transform duration-150',
        isSelected && 'scale-[1.04]',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        !isSelected && isBestSub && 'shadow-[0_0_8px_hsl(var(--primary)/0.35)]',
        player.injured && 'opacity-60',
      )}
      aria-label={fullName}
      title={fullName}
    >
      {statusLabel && (
        <span className="absolute -top-1.5 -right-1.5 z-10 text-[6px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm">
          {statusLabel}
        </span>
      )}

      {isSelected && (
        <span className="absolute inset-0 rounded-[8px] ring-2 ring-primary animate-pulse pointer-events-none z-10" />
      )}

      <TierBorderFrame
        overall={player.overall}
        glow
        outerRadiusClass="rounded-[8px]"
        innerRadiusClass="rounded-[6.5px]"
        paddingClass="p-[1.5px]"
        className="w-full h-full"
        innerClassName={cn(
          'w-full h-full relative',
          clubColor && 'border-l-[2px]',
        )}
        style={clubColor ? { borderLeftColor: clubColor } : undefined}
      >
        <CardArtBackground
          overall={player.overall}
          variant="top-strip"
          overlayStrength={0.7}
        />

        {/* Content overlay */}
        <div className="relative h-full flex items-center gap-1.5 px-1.5">
          {/* Rating */}
          <span
            className={cn(
              'text-[16px] font-black font-display tabular-nums leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]',
              tier.textClass,
            )}
          >
            {player.overall}
          </span>

          {/* Pos + flag stack */}
          <div className="flex flex-col items-center gap-px shrink-0 leading-none">
            <span className="text-[7px] font-bold uppercase tracking-wider text-white/85 tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
              {position}
            </span>
            <FlagIcon nationality={player.nationality} size={10} className="rounded-[1px]" />
          </div>

          {/* Name + trailing indicators */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-px">
            <div className="flex items-center gap-0.5 min-w-0">
              <span
                className="flex-1 min-w-0 text-[10px] font-bold text-white uppercase tracking-wide truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                title={fullName}
              >
                {displayName}
              </span>
              {formTrend === 'hot' && <TrendingUp className="w-[8px] h-[8px] text-emerald-300 shrink-0" aria-label="Hot form" />}
              {formTrend === 'cold' && <TrendingDown className="w-[8px] h-[8px] text-red-300 shrink-0" aria-label="Poor form" />}
              {isBestSub && <TrendingUp className="w-[9px] h-[9px] text-primary shrink-0" aria-label="Suggested sub" />}
              {chemistryLinkCount > 0 && (
                <span className="flex items-center gap-px text-[7px] text-primary font-semibold tabular-nums leading-none shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                  <Link className="w-[6px] h-[6px]" />
                  {chemDisplay}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={cn('w-1 h-1 rounded-full shrink-0', getMoraleDotClass(player.morale))}
                aria-label={`Morale ${player.morale}`}
              />
              <div className="flex-1 h-[3px] rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
                  aria-label={`Fitness ${player.fitness}%`}
                />
              </div>
            </div>
          </div>
        </div>
      </TierBorderFrame>
    </div>
  );
});
