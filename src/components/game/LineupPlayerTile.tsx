import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { PlayerCard } from './PlayerCard';

const HOT_FORM_MIN = 70;
const COLD_FORM_MAX = 35;

interface LineupPlayerTileProps {
  player: Player;
  position: string;
  isSelected: boolean;
  chemistryLinkCount: number;
  compatRing?: 'natural' | 'compatible' | 'wrong' | null;
  week?: number;
  /** @deprecated kept for prop-API compatibility; colorstripe removed from tile. */
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
 * Formation slot tile — renders the shared FIFA-style {@link PlayerCard}
 * shield (xs, compact) so the tactics pitch matches the squad page look.
 * All the tactics-only decoration (selection pulse, compatibility ring,
 * chemistry count, status badge, fitness bar, club accent) is overlaid
 * on top of the card.
 */
export const LineupPlayerTile = memo(function LineupPlayerTile({
  player,
  isSelected,
  chemistryLinkCount,
  compatRing,
  week,
  onClick,
}: LineupPlayerTileProps) {
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
      role="button"
      tabIndex={0}
      aria-label={fullName}
      title={fullName}
      className={cn(
        'relative shrink-0 cursor-pointer rounded-[7px]',
        'transition-transform duration-150',
        isSelected && 'scale-[1.08] z-10',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        player.injured && 'opacity-60',
      )}
    >
      <PlayerCard
        player={player}
        size="xs"
        interactive="none"
        compact
      />

      {isSelected && (
        <span className="absolute inset-0 rounded-[7px] ring-2 ring-primary animate-pulse pointer-events-none z-10" />
      )}

      {statusLabel && (
        <span
          title={statusLabel === 'INJ' ? 'Injured' : 'Suspended'}
          aria-label={statusLabel === 'INJ' ? 'Injured' : 'Suspended'}
          className="absolute -top-1.5 -right-1.5 z-20 text-[6px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm"
        >
          {statusLabel}
        </span>
      )}

      {/* Morale + form indicator (top-right corner) */}
      <div className="absolute top-0.5 right-0.5 z-10 flex items-center gap-px">
        {formTrend === 'hot' && <TrendingUp className="w-[7px] h-[7px] text-emerald-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" aria-label="Hot form" />}
        {formTrend === 'cold' && <TrendingDown className="w-[7px] h-[7px] text-red-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" aria-label="Poor form" />}
        <span className={cn('w-1 h-1 rounded-full shadow-[0_0_0_0.5px_rgba(0,0,0,0.6)]', getMoraleDotClass(player.morale))} aria-label={`Morale ${player.morale}`} />
      </div>

      {/* Chemistry link count (bottom-left corner) */}
      {chemistryLinkCount > 0 && (
        <span
          aria-label={`${chemistryLinkCount} chemistry link${chemistryLinkCount === 1 ? '' : 's'}`}
          className="absolute bottom-0.5 left-0.5 z-10 flex items-center gap-px text-[6px] text-primary font-semibold tabular-nums leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]"
        >
          <Link className="w-[6px] h-[6px]" aria-hidden />
          {chemDisplay}
        </span>
      )}
    </div>
  );
});
