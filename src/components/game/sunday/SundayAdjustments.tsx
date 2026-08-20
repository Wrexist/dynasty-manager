/**
 * The labelled reasons an XI is better or worse than it looks on paper.
 *
 * Every row is an adjustment `buildMatchdayTeam` really applied — the surface,
 * the tactic's fit, the kit that was paid for, the dressing room, who is
 * standing next to a mate. Nothing here is a judgement, and nothing is
 * invented.
 *
 * IT IS THE SAME DATA BEFORE AND AFTER THE MATCH AND IT IS NOT THE SAME
 * QUESTION. It shipped with one label — "Why it went that way" — on both, so
 * the briefing panel appeared to explain a result that had not happened yet.
 * The component takes the label and the tense from the caller now: before
 * kick-off it answers "what am I taking out there", afterwards "why did that
 * happen", and `direction` swaps the arrow so the two are told apart at a
 * glance rather than by reading the heading.
 */
import { cn } from '@/lib/utils';

export interface SundayAdjustmentsProps {
  rows: readonly { label: string; delta: number }[];
  label: string;
  /**
   * `forward` (default) is the pre-match reading; `back` is the post-match one.
   * Only the heading's glyph changes — the numbers are identical, because they
   * are the same numbers.
   */
  direction?: 'forward' | 'back';
  className?: string;
}

export function SundayAdjustments({ rows, label, direction = 'forward', className }: SundayAdjustmentsProps) {
  if (!rows.length) return null;
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        <span aria-hidden className="text-foreground/40">{direction === 'forward' ? '→' : '←'}</span>
        {label}
      </p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row, i) => (
          <li key={`${row.label}-${i}`} className="flex items-baseline gap-2 text-caption">
            <span className="min-w-0 flex-1 truncate text-foreground/85">{row.label}</span>
            {/* Size lives on the row: cn() would eat a `text-<scale>` class
                sitting beside a colour — see the note in SundayTimeline. */}
            <span className={cn(
              'shrink-0 font-semibold tabular-nums',
              row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-destructive' : 'text-muted-foreground',
            )}>
              {row.delta > 0 ? '+' : ''}{row.delta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
