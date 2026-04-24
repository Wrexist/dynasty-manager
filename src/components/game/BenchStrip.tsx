import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getFitnessHexColor } from '@/utils/uiHelpers';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { PlayerCard } from './PlayerCard';

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
  /** @deprecated kept for prop-API compatibility; club-color stripe removed. */
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
 * Bench / reserves tile. Renders the shared FIFA-style {@link PlayerCard}
 * shield at `sm` with the stat panel on — same visual as the squad page,
 * just scaled down to fit the horizontal bench scroller. Decision-support
 * metadata (morale, form, chemistry, fitness, best-sub marker, INJ/SUS)
 * sits as overlays so the card itself stays the familiar squad-page look.
 */
export const BenchStrip = memo(function BenchStrip({
  player,
  isSelected,
  chemistryLinkCount = 0,
  compatRing,
  isBestSub,
  week,
  onClick,
}: BenchStripProps) {
  const fitnessColor = getFitnessHexColor(player.fitness);
  const statusLabel = getStatusLabel(player, week);
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
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn(
        'relative shrink-0 cursor-pointer rounded-[12px] transition-transform duration-150',
        isSelected && 'scale-[1.05] z-10',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        !isSelected && isBestSub && 'shadow-[0_0_10px_hsl(var(--primary)/0.45)]',
        player.injured && 'opacity-60',
      )}
      role="button"
      tabIndex={0}
      aria-label={fullName}
      title={fullName}
    >
      <PlayerCard
        player={player}
        size="sm"
        interactive="none"
      />

      {isSelected && (
        <span className="absolute inset-0 rounded-[12px] ring-2 ring-primary animate-pulse pointer-events-none z-20" />
      )}

      {statusLabel && (
        <span
          title={statusLabel === 'INJ' ? 'Injured' : 'Suspended'}
          aria-label={statusLabel === 'INJ' ? 'Injured' : 'Suspended'}
          className="absolute -top-1.5 -right-1.5 z-20 text-[7px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm"
        >
          {statusLabel}
        </span>
      )}

      {/* Morale + form indicators — bottom-left on the shield */}
      <div className="absolute bottom-1 left-1 z-10 flex items-center gap-0.5">
        <span
          className={cn('w-1.5 h-1.5 rounded-full shadow-[0_0_0_0.5px_rgba(0,0,0,0.6)]', getMoraleDotClass(player.morale))}
          aria-label={`Morale ${player.morale}`}
        />
        {formTrend === 'hot' && <TrendingUp className="w-[9px] h-[9px] text-emerald-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" aria-label="Hot form" />}
        {formTrend === 'cold' && <TrendingDown className="w-[9px] h-[9px] text-red-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" aria-label="Poor form" />}
        {isBestSub && <TrendingUp className="w-[10px] h-[10px] text-primary drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" aria-label="Suggested sub" />}
      </div>

      {/* Chemistry link count — bottom-right on the shield */}
      {chemistryLinkCount > 0 && (
        <span
          aria-label={`${chemistryLinkCount} chemistry link${chemistryLinkCount === 1 ? '' : 's'}`}
          className="absolute bottom-1 right-1 z-10 flex items-center gap-px text-[8px] text-primary font-semibold tabular-nums leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]"
        >
          <Link className="w-[7px] h-[7px]" aria-hidden />
          {chemDisplay}
        </span>
      )}

      {/* Fitness bar — bottom edge, below the card */}
      <div className="mt-1 h-[3px] w-full rounded-full bg-muted/80 overflow-hidden" title={`Fitness ${player.fitness}%`}>
        <div
          className="h-full transition-all"
          style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
          aria-label={`Fitness ${player.fitness}%`}
        />
      </div>
    </div>
  );
});
