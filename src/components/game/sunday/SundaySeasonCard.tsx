/**
 * One season the club got through, as a card.
 *
 * WHAT WAS WRONG. A completed season is the richest thing the mode writes —
 * where it finished, what it did in the cup, who scored, who was the best
 * player, the one moment everyone still talks about, and a couple of authored
 * highlights — and the History screen was rendering all of it as five
 * consecutive lines of 11px muted text behind a grey left border. Two seasons
 * looked like one paragraph. `playerOfTheSeason` was not rendered at all.
 *
 * WHAT THIS IS. The same facts, ranked: what happened (the finish, and whether
 * it moved the club), then how (the record), then the parts that are actually
 * a story — the cup run, the moment, the highlights — and finally the two men
 * the season belonged to.
 *
 * COLOUR NEVER CARRIES IT ALONE. A promotion is green AND says "Promoted"; a
 * relegation is red AND says "Relegated"; a season that did neither is muted
 * and says only where it finished.
 *
 * THE WHOLE RECORD, NOT SCALARS. Everywhere else in the mode a component takes
 * values rather than objects, because the objects it would take are rewritten
 * by the store every week. A `SundaySeasonRecord` is the opposite: it is
 * written once at the rollover and never touched again, so its identity is as
 * stable as any scalar.
 */
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { getSuffix } from '@/utils/helpers';
import type { SundaySeasonRecord } from '@/types/game';

const CupIcon = SUNDAY_ICON.cup;

export function SundaySeasonCard({ record }: { record: SundaySeasonRecord }) {
  const { t } = useTranslation();

  return (
    <li className="rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/10 p-3 space-y-2">
      <div className="flex items-start gap-2.5">
        {/* The season's own number, big enough to find when there are nine of
            them and you are looking for the fourth. */}
        <span
          className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.05] inline-flex flex-col items-center justify-center leading-none"
          aria-hidden
        >
          <span className="text-micro text-muted-foreground">S</span>
          <span className="text-caption font-bold text-foreground tabular-nums">{record.season}</span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-foreground truncate leading-tight">
            {record.divisionName}
          </p>
          <p className={cn(
            'text-caption font-semibold',
            record.promoted ? 'text-emerald-300' : record.relegated ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {t('sunday.history.finished', { position: `${record.position}${getSuffix(record.position)}` })}
            {record.promoted && ` · ${t('sunday.history.promoted')}`}
            {record.relegated && ` · ${t('sunday.history.relegated')}`}
          </p>
        </div>

      </div>

      {/* The record, in the three colours the mode uses for a result
          everywhere else, so it can be read without being parsed. */}
      <p className="text-caption tabular-nums">
        <span className="text-emerald-300 font-semibold">{record.won}W</span>{' '}
        <span className="text-amber-300 font-semibold">{record.drawn}D</span>{' '}
        <span className="text-destructive font-semibold">{record.lost}L</span>
        <span className="text-muted-foreground">
          {' '}· {record.goalsFor}-{record.goalsAgainst} · {record.points} {t('sunday.table.points')}
        </span>
      </p>

      {record.cupResult && (
        <p className="inline-flex items-center gap-1.5 text-caption text-sky-300">
          <CupIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {record.cupResult}
        </p>
      )}

      {/* The moment. Authored by the simulation and the reason anybody scrolls
          this screen at all, so it gets the accent and its own margin. */}
      {record.momentOfTheSeason && (
        <p className="text-caption text-primary/90 leading-relaxed border-l-2 border-primary/40 pl-3">
          {record.momentOfTheSeason}
        </p>
      )}

      {record.highlights.length > 0 && (
        <ul className="space-y-0.5">
          {record.highlights.map(highlight => (
            <li key={highlight} className="text-micro text-muted-foreground/90 flex gap-1.5">
              <span aria-hidden className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
              <span className="min-w-0">{highlight}</span>
            </li>
          ))}
        </ul>
      )}

      {(record.topScorer || record.playerOfTheSeason) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
          {record.topScorer && (
            <p className="text-micro text-muted-foreground">
              {t('sunday.history.topScorer')}:{' '}
              <span className="text-foreground/90">{record.topScorer.name} ({record.topScorer.goals})</span>
            </p>
          )}
          {/* Written into every season record since the mode shipped and never
              once drawn. */}
          {record.playerOfTheSeason && (
            <p className="text-micro text-muted-foreground">
              {t('sunday.history.playerOfSeason')}:{' '}
              <span className="text-foreground/90">
                {record.playerOfTheSeason.name} ({record.playerOfTheSeason.rating.toFixed(1)})
              </span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}
