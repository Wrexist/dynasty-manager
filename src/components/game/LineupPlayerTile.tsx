import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Link, TrendingUp, TrendingDown } from 'lucide-react';
import type { Player } from '@/types/game';
import { PlayerCard, type PositionTone } from './PlayerCard';

const HOT_FORM_MIN = 70;
const COLD_FORM_MAX = 35;

interface LineupPlayerTileProps {
  player: Player;
  position: string;
  isSelected: boolean;
  chemistryLinkCount: number;
  compatRing?: 'natural' | 'compatible' | 'wrong' | null;
  /**
   * Tone for the position label on the card (reflects whether this player
   * fits the slot they're in): natural → green, compatible → amber, wrong
   * → red. Unlike `compatRing` (which is driven by the *selected* player
   * vs every slot), this is always the tile-player vs its own slot.
   */
  positionTone?: PositionTone | null;
  week?: number;
  /** @deprecated kept for prop-API compatibility; colorstripe removed from tile. */
  clubColor?: string;
  /**
   * Whether the tile itself is the thing you tap.
   *
   * Default true, which is how `SubstitutionSheet` uses it. `PitchBoard`
   * passes FALSE: it owns a real <button> per slot, and a tile that brought
   * its own `role="button"` inside that would nest two interactive elements
   * for one action — invalid DOM, two tab stops, and exactly the bug the
   * Sunday teamsheet had to have fixed.
   */
  interactive?: boolean;
  onClick?: () => void;
}

// Where the selected player would fit, as a gradient of emphasis rather than
// three equally loud boxes: a natural fit glows, a workable one gets a hairline,
// a wrong one steps back. With a thick ring on every card (most of them red)
// the board shouted everywhere and so said nothing.
const COMPAT_RING_CLASSES = {
  natural: 'ring-1 ring-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.45)]',
  compatible: 'ring-1 ring-amber-400/60',
  wrong: 'opacity-50 saturate-50',
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
  positionTone,
  week,
  interactive = true,
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
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }
        : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? fullName : undefined}
      title={fullName}
      className={cn(
        'relative shrink-0 cursor-pointer rounded-[7px]',
        // Selection is a lift, not a blink: the card rises and glows and then
        // holds still, so the eye can leave it and go find the target.
        'transition-[transform,box-shadow] duration-200 ease-out',
        isSelected && '-translate-y-1 scale-[1.06] z-10 shadow-[0_10px_22px_-6px_rgba(0,0,0,0.7),0_0_16px_hsl(var(--primary)/0.5)]',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        player.injured && 'opacity-60',
      )}
    >
      <PlayerCard
        player={player}
        size="xs"
        interactive="none"
        compact
        positionTone={positionTone}
      />

      {isSelected && (
        <span className="absolute inset-0 rounded-[7px] ring-2 ring-primary pointer-events-none z-10" />
      )}

      {statusLabel && (
        <span
          title={statusLabel === 'INJ' ? 'Injured' : 'Suspended'}
          aria-label={statusLabel === 'INJ' ? 'Injured' : 'Suspended'}
          className="absolute -top-1.5 -right-1.5 z-20 text-[6px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm" // type-floor: graphic — overlay on the 52px tactics chip
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
          className="absolute bottom-0.5 left-0.5 z-10 flex items-center gap-px text-[6px] text-primary font-semibold tabular-nums leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" // type-floor: graphic — overlay on the 52px tactics chip
        >
          <Link className="w-[6px] h-[6px]" aria-hidden />
          {chemDisplay}
        </span>
      )}
    </div>
  );
});
