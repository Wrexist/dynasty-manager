/**
 * SundayTimeline — the afternoon as a match sheet.
 *
 * The narrative feed is the mode's voice and it stays. But prose cannot be
 * SCANNED: after eighteen sentences nobody can tell you when the second goal
 * went in, who was booked, or whether the sub changed anything. Every football
 * match ever written down gets a column of minutes with a mark against each —
 * this draws that, off the same events the prose was written from
 * (`utils/sunday/timeline.ts`), so the two can never disagree.
 *
 * THE THREE MARKS ARE DRAWN, NOT ICONS. A goal is a filled disc and a card is a
 * coloured rectangle: that is the printed convention, it is more legible at
 * 10px than any pictogram, and it costs nothing from the eager `lucide` chunk.
 * Only the rows with no conventional shape take a glyph, from
 * `SUNDAY_TIMELINE_ICON`.
 *
 * OURS AND THEIRS. Told apart by weight, not by side: a home/away split column
 * halves the space for names at 375px, which is where this is read. Our rows
 * are foreground with a live mark; theirs are muted with a hollow one. Colour
 * is never the only carrier — every row also says what happened in words.
 *
 * NO MOTION. The timeline arrives after the reveal has finished (or at the
 * break, when a decision is waiting on it), so it has nothing to animate into.
 * That also makes it correct under reduced motion for free, and keeps every
 * `backdrop-filter` off a surface that scrolls.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { SUNDAY_TIMELINE_ICON } from '@/config/sundayIcons';
import type { SundayTimelineEntry } from '@/types/game';

const InjuryIcon = SUNDAY_TIMELINE_ICON.injury;
const SubIcon = SUNDAY_TIMELINE_ICON.sub;
const MissIcon = SUNDAY_TIMELINE_ICON['penalty-missed'];

/** The vertical rule the marks hang off, drawn per row so it stretches with
 *  whatever height the row's text happens to take. */
const Spine = ({ children }: { children: React.ReactNode }) => (
  <span className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/45" aria-hidden />
    <span className="relative flex items-center justify-center">{children}</span>
  </span>
);

const Mark = ({ row }: { row: SundayTimelineEntry }) => {
  const ours = row.ours;
  switch (row.kind) {
    case 'goal':
    case 'own-goal':
      return (
        <span
          className={cn(
            'block h-2.5 w-2.5 rounded-full ring-2 ring-[hsl(var(--card))]',
            ours ? 'bg-primary' : 'bg-muted-foreground/70',
          )}
          aria-hidden
        />
      );
    case 'yellow':
      return <span className="block h-3 w-2 rounded-[2px] bg-amber-400 ring-2 ring-[hsl(var(--card))]" aria-hidden />;
    case 'red':
      return <span className="block h-3 w-2 rounded-[2px] bg-destructive ring-2 ring-[hsl(var(--card))]" aria-hidden />;
    case 'injury':
      return <InjuryIcon className={cn('h-3 w-3', ours ? 'text-sky-300' : 'text-muted-foreground')} aria-hidden />;
    case 'sub':
      return <SubIcon className={cn('h-3 w-3', ours ? 'text-foreground/70' : 'text-muted-foreground')} aria-hidden />;
    case 'penalty-missed':
      return <MissIcon className={cn('h-3 w-3', ours ? 'text-amber-300' : 'text-muted-foreground')} aria-hidden />;
    default:
      return null;
  }
};

/**
 * One row's words.
 *
 * `null` names are real: the engine does not always attribute an event to a
 * man, and the honest answer then is the side it happened to, not a guess.
 */
const RowText = ({ row, us, them }: { row: SundayTimelineEntry; us: string; them: string }) => {
  const { t } = useTranslation();
  const who = row.name ?? (row.ours ? us : them);
  switch (row.kind) {
    case 'goal':
      return (
        <>
          <span className="font-semibold">{who}</span>
          {row.second && <span className="text-muted-foreground"> ({row.second})</span>}
        </>
      );
    case 'own-goal':
      return (
        <>
          <span className="font-semibold">{who}</span>
          <span className="text-muted-foreground"> · {t('sunday.timeline.ownGoal')}</span>
        </>
      );
    case 'penalty-missed':
      return <>{who} <span className="text-muted-foreground">· {t('sunday.timeline.missed')}</span></>;
    case 'yellow':
      return <>{who} <span className="text-muted-foreground">· {t('sunday.timeline.booked')}</span></>;
    case 'red':
      return <>{who} <span className="text-muted-foreground">· {t('sunday.timeline.sentOff')}</span></>;
    case 'injury':
      return <>{who} <span className="text-muted-foreground">· {t('sunday.timeline.hurt')}</span></>;
    case 'sub':
      return (
        <>
          {who}
          <span className="text-muted-foreground"> · {t('sunday.timeline.onFor', { name: row.second ?? them })}</span>
        </>
      );
    default:
      return null;
  }
};

export interface SundayTimelineProps {
  rows: readonly SundayTimelineEntry[];
  /** Short names, used when the engine attributed an event to nobody. */
  us: string;
  them: string;
  className?: string;
}

export const SundayTimeline = memo(function SundayTimeline({ rows, us, them, className }: SundayTimelineProps) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <ol className={cn('space-y-0.5', className)}>
      {rows.map((row, i) => {
        const key = `${i}-${row.at}-${row.kind}`;
        if (row.kind === 'break' || row.kind === 'shootout') {
          const label = row.kind === 'break' ? t('sunday.match.halfTime') : t('sunday.timeline.penalties');
          return (
            <li key={key} className="flex items-center gap-2 py-1.5">
              <span className="h-px flex-1 bg-border/45" aria-hidden />
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                {label} {row.home}-{row.away}
              </span>
              <span className="h-px flex-1 bg-border/45" aria-hidden />
            </li>
          );
        }
        const scoring = row.kind === 'goal' || row.kind === 'own-goal';
        return (
          <li key={key} className="flex items-stretch gap-2">
            <span className="w-8 shrink-0 pt-0.5 text-right text-micro tabular-nums text-muted-foreground">
              {row.minute}&rsquo;
            </span>
            <Spine><Mark row={row} /></Spine>
            <span className={cn(
              'min-w-0 flex-1 truncate py-0.5 text-caption',
              row.ours ? 'text-foreground' : 'text-muted-foreground',
            )}>
              <RowText row={row} us={us} them={them} />
            </span>
            {scoring && (
              <span className={cn(
                'shrink-0 py-0.5 text-caption font-bold tabular-nums',
                row.ours ? 'text-primary' : 'text-muted-foreground',
              )}>
                {row.home}-{row.away}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
});
