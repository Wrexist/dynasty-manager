/**
 * How you are playing, as four pictures and one honest bar.
 *
 * WHAT IT REPLACES. Four text buttons (name + tagline) under a paragraph of the
 * selected tactic's `description`, plus a 113-character sentence apologising
 * for the fit percentage. The paragraph is now the diagram, and the apology is
 * now a reference mark at 50 on the meter.
 *
 * THE TAGLINE STAYS AND THE DESCRIPTION GOES, deliberately. `tagline` is the
 * mode talking — "Big lad up top. Aim at him." is characterisation and there is
 * no picture of it. `description` was two sentences of mechanics, which is
 * exactly what a drawing does better.
 *
 * WHAT A CARD IS. A radio, not a button: four options, one chosen, so
 * `role="radio"` in a `radiogroup` is what a screen reader should hear. The
 * formation is on the face of the card because the board below re-slots when it
 * changes, and a shape that rearranges itself for no visible reason is a bug
 * report.
 */
import { memo } from 'react';
import { Meter } from '@/components/game/sunday/SundayBits';
import { SundayTacticDiagram } from '@/components/game/sunday/SundayTacticDiagram';
import { cn } from '@/lib/utils';
import type { SundayTacticId } from '@/types/game';

export interface SundayTacticCardProps {
  id: SundayTacticId;
  /** `SundayTacticInfo.name`. Game data — English. */
  name: string;
  /** `SundayTacticInfo.tagline`. The mode's voice. */
  tagline: string;
  /** The shape this tactic plays when the full eleven turn up, or the short
   *  shape when they do not — whichever the board is actually drawing. */
  formation: string;
  selected: boolean;
  /** Pre-match only. Once the morning has resolved, the shape is the shape. */
  disabled?: boolean;
  onSelect: (id: SundayTacticId) => void;
}

/**
 * SCALARS ONLY, and `memo`. Four of these sit above a board that re-renders on
 * every tap of a player token; nothing about a tactic changes when a left-back
 * moves, so they should not re-render with it.
 */
export const SundayTacticCard = memo(function SundayTacticCard({
  id, name, tagline, formation, selected, disabled, onSelect,
}: SundayTacticCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={() => { if (!disabled) onSelect(id); }}
      className={cn(
        'rounded-xl border p-2 text-left min-h-[44px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
        selected
          ? 'border-primary/60 bg-primary/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20',
        disabled && !selected && 'opacity-50',
      )}
    >
      {/* The formation sits ON the diagram rather than beside the name. Sharing
          one line, `4-5-1` took enough of a 155px card to come back as
          'Proper Foot…' at 390px — and the name is the half you have to be able
          to read. */}
      <span className={cn('relative block', selected ? 'text-primary' : 'text-muted-foreground')}>
        <SundayTacticDiagram tactic={id} />
        <span className="absolute top-0 right-0 text-micro font-semibold tabular-nums text-muted-foreground">
          {formation}
        </span>
      </span>
      <span className={cn('block text-caption font-bold truncate mt-1', selected ? 'text-primary' : 'text-foreground')}>
        {name}
      </span>
      <span className="block text-micro text-muted-foreground leading-tight mt-0.5">
        {tagline}
      </span>
    </button>
  );
});

/**
 * The fit bar, with the one thing that makes the number mean anything.
 *
 * `sundayTacticFit` measures the XI against ITS OWN average, so 50 is neutral
 * and neither 48 nor 62 is a verdict on the squad. The screen used to say that
 * in a sentence; it now says it with a tick at 50 and two three-word ends. The
 * caller computes `value` — with the coach level, which is what the match
 * actually uses.
 */
export function SundayFitMeter({ label, value, lowLabel, highLabel }: {
  label: string;
  /** 0-1, straight from `sundayTacticFit`. */
  value: number;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="min-w-0">
      <Meter label={label} value={value * 100} mark={50} />
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-micro text-muted-foreground truncate">{lowLabel}</span>
        <span className="text-micro text-muted-foreground truncate">{highLabel}</span>
      </div>
    </div>
  );
}
