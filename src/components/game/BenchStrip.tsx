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
 * Horizontal bench/subs tile. A compact 64×85 {@link PlayerCard} (sm,
 * compact mode — no stats cycle, no view indicator) carries the shield
 * identity; the narrow right column carries the decision-support
 * metadata the bench actually needs at a glance: form trend, chemistry
 * link count, morale dot, fitness bar, suggested-sub marker, and the
 * out-of-action status chip (INJ/SUS).
 *
 * Width ~140px, height ~85px. The whole strip is clickable — the inner
 * card is `interactive='none'` so parent-level selection is the only
 * click behaviour.
 */
export const BenchStrip = memo(function BenchStrip({
  player,
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
        'relative shrink-0 cursor-pointer rounded-[10px] transition-transform duration-150',
        'flex items-stretch gap-1.5 p-1 pr-2 w-[138px]',
        'bg-card/40 backdrop-blur-sm border border-border/40',
        isSelected && 'scale-[1.04] border-primary/60',
        !isSelected && compatRing && COMPAT_RING_CLASSES[compatRing],
        !isSelected && isBestSub && 'shadow-[0_0_8px_hsl(var(--primary)/0.35)]',
        clubColor && 'border-l-[3px]',
        player.injured && 'opacity-60',
      )}
      style={clubColor ? { borderLeftColor: clubColor } : undefined}
      role="button"
      tabIndex={0}
      aria-label={fullName}
      title={fullName}
    >
      {statusLabel && (
        <span className="absolute -top-1.5 -right-1.5 z-10 text-[6px] font-bold bg-red-500 text-white px-1 py-px rounded-full leading-tight shadow-sm">
          {statusLabel}
        </span>
      )}

      {isSelected && (
        <span className="absolute inset-0 rounded-[10px] ring-2 ring-primary animate-pulse pointer-events-none z-10" />
      )}

      <PlayerCard
        player={player}
        size="sm"
        interactive="none"
        compact
        className="shrink-0"
      />

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
        <div className="flex items-center gap-0.5 min-w-0">
          <span
            className="flex-1 min-w-0 text-[9px] font-bold text-foreground uppercase tracking-wide truncate"
            title={fullName}
          >
            {player.lastName}
          </span>
          {formTrend === 'hot' && <TrendingUp className="w-[8px] h-[8px] text-emerald-400 shrink-0" aria-label="Hot form" />}
          {formTrend === 'cold' && <TrendingDown className="w-[8px] h-[8px] text-red-400 shrink-0" aria-label="Poor form" />}
          {isBestSub && <TrendingUp className="w-[9px] h-[9px] text-primary shrink-0" aria-label="Suggested sub" />}
        </div>

        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn('w-1.5 h-1.5 rounded-full shrink-0', getMoraleDotClass(player.morale))}
            aria-label={`Morale ${player.morale}`}
          />
          {chemistryLinkCount > 0 && (
            <span className="flex items-center gap-px text-[8px] text-primary font-semibold tabular-nums leading-none shrink-0">
              <Link className="w-[7px] h-[7px]" />
              {chemDisplay}
            </span>
          )}
        </div>

        <div className="h-[3px] w-full rounded-full bg-muted/80 overflow-hidden" title={`Fitness ${player.fitness}%`}>
          <div
            className="h-full transition-all"
            style={{ width: `${player.fitness}%`, backgroundColor: fitnessColor }}
            aria-label={`Fitness ${player.fitness}%`}
          />
        </div>
      </div>
    </div>
  );
});
