/**
 * League — table, fixtures and the cup, in that order of usefulness.
 *
 * The table is built by `buildSundayTable` (the same function the season
 * rollover judges promotion on) rather than re-derived here, so what the player
 * reads and what the game acts on cannot diverge.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SectionHeader } from '@/components/game/SectionHeader';
import { FormPills, SundayCrest } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { getSundayDivision } from '@/config/sundayLeague';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { buildSundayTable, sundayCupRoundName } from '@/utils/sunday/season';
import { sundayLeagueBuzz, type SundayBuzzKind } from '@/utils/sunday/view';

/** Which glyph the news strip puts on each kind of line. */
const BUZZ_ICON: Record<SundayBuzzKind, React.ElementType> = {
  upset: SUNDAY_ICON.hotForm,
  heaviest: SUNDAY_ICON.hero,
  streak: SUNDAY_ICON.form,
  leader: SUNDAY_ICON.honours,
};

const BUZZ_TONE: Record<SundayBuzzKind, string> = {
  upset: 'text-orange-300',
  heaviest: 'text-fuchsia-300',
  streak: 'text-emerald-300',
  leader: 'text-amber-300',
};

type Tab = 'table' | 'fixtures' | 'cup';

const SundayTable = () => {
  const { t } = useTranslation();
  const { sunday, clubs, fixtures, week, playerClubId } = useGameStore(useShallow(s => ({
    sunday: s.sunday, clubs: s.clubs, fixtures: s.fixtures, week: s.week, playerClubId: s.playerClubId,
  })));
  const [tab, setTab] = useState<Tab>('table');
  const reduceMotion = useReducedMotionPref();
  const currentWeekRef = useRef<HTMLDivElement | null>(null);

  const table = useMemo(
    () => (sunday ? buildSundayTable(fixtures, sunday.divisionClubIds) : []),
    [sunday, fixtures],
  );

  const buzz = useMemo(
    () => (sunday ? sundayLeagueBuzz(sunday, clubs, fixtures, playerClubId) : []),
    [sunday, clubs, fixtures, playerClubId],
  );

  const byWeek = useMemo(() => {
    const map = new Map<number, typeof fixtures>();
    for (const m of fixtures) {
      const list = map.get(m.week) ?? [];
      list.push(m);
      map.set(m.week, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [fixtures]);

  // The fixtures tab lists the whole season, so opening it in week 14 dumped
  // you at week 1 and made you scroll to find the game you are about to play.
  useEffect(() => {
    if (tab !== 'fixtures') return;
    const node = currentWeekRef.current;
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [tab, reduceMotion]);

  if (!sunday) return null;
  const div = getSundayDivision(sunday.divisionId);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'table', label: t('sunday.table.tabTable'), icon: SUNDAY_ICON.league },
    { key: 'fixtures', label: t('sunday.table.tabFixtures'), icon: SUNDAY_ICON.fixtures },
    { key: 'cup', label: t('sunday.table.tabCup'), icon: SUNDAY_ICON.cup },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SectionHeader title={div.name} />

      <div className="flex gap-1.5" role="tablist" aria-label={t('sunday.table.title')}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex-1 px-3 py-2 rounded-full border text-caption font-semibold min-h-[44px] inline-flex items-center justify-center gap-1.5',
              tab === tb.key ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-white/[0.04] border-white/10 text-muted-foreground',
            )}
          >
            <tb.icon className="w-3.5 h-3.5" aria-hidden />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <GlassPanel className="p-2 overflow-x-auto">
          <table className="w-full text-caption min-w-[320px] table-fixed">
            <thead>
              <tr className="text-micro text-muted-foreground">
                <th scope="col" className="text-left px-2 py-1.5 font-semibold w-7">#</th>
                <th scope="col" className="text-left px-1 py-1.5 font-semibold">{t('sunday.hub.club')}</th>
                <th scope="col" className="text-right px-1 py-1.5 font-semibold w-6">{t('sunday.table.played')}</th>
                {/* One column, not three. W/D/L as three columns cost 60px and
                    said less than the last five results do; the record is still
                    all there, and the space bought the form. */}
                <th scope="col" className="text-center px-1 py-1.5 font-semibold w-12 whitespace-nowrap">{t('sunday.table.record')}</th>
                <th scope="col" className="text-right px-1 py-1.5 font-semibold w-7">{t('sunday.table.goalDifference')}</th>
                <th scope="col" className="text-right px-1 py-1.5 font-semibold w-7">{t('sunday.table.points')}</th>
                <th scope="col" className="text-center px-1 py-1.5 font-semibold w-[4.6rem]">{t('sunday.table.form')}</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => {
                const club = clubs[row.clubId];
                const mine = row.clubId === playerClubId;
                const promo = i < div.promotionSpots;
                const releg = div.relegationSpots > 0 && i >= table.length - div.relegationSpots;
                return (
                  <tr
                    key={row.clubId}
                    className={cn(
                      'border-t border-border/30',
                      mine && 'bg-primary/10',
                    )}
                  >
                    <td className="px-2 py-2">
                      <span className={cn(
                        'inline-flex w-5 justify-center tabular-nums font-semibold',
                        promo ? 'text-emerald-300' : releg ? 'text-destructive' : 'text-muted-foreground',
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-1 py-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {club && (
                          <SundayCrest shortName={club.shortName} color={club.color} secondaryColor={club.secondaryColor} size={20} />
                        )}
                        <span className={cn('truncate', mine ? 'font-semibold text-foreground' : 'text-foreground/85')}>
                          {club?.shortName ?? row.clubId}
                        </span>
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">{row.played}</td>
                    <td className="px-1 py-2 text-center text-micro tabular-nums text-muted-foreground whitespace-nowrap">
                      {row.won}-{row.drawn}-{row.lost}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums font-semibold text-foreground">{row.points}</td>
                    <td className="px-1 py-2">
                      <span className="flex justify-center"><FormPills form={row.form} size="xs" /></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-4 px-2 py-2 text-micro text-muted-foreground">
            {div.promotionSpots > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden /> {t('sunday.table.promotion')}
              </span>
            )}
            {div.relegationSpots > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive" aria-hidden /> {t('sunday.table.relegation')}
              </span>
            )}
          </div>
        </GlassPanel>
      )}

      {/* What happened to everyone else. Three lines, every one of them a
          statement about a fixture that was actually played or a row that is
          actually in the table — see `sundayLeagueBuzz`. */}
      {tab === 'table' && buzz.length > 0 && (
        <GlassPanel className="p-3">
          <SectionHeader level="eyebrow" title={t('sunday.table.elsewhere')} />
          <ul className="mt-1.5 space-y-1.5">
            {buzz.map(entry => {
              const Icon = BUZZ_ICON[entry.kind];
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <Icon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', BUZZ_TONE[entry.kind])} aria-hidden />
                  <span className="text-caption text-foreground/85 leading-snug">{entry.text}</span>
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      )}

      {tab === 'fixtures' && (
        <div className="space-y-2">
          {byWeek.map(([wk, matches]) => (
            // The ref sits on a wrapper rather than the panel: GlassPanel is a
            // shared primitive and does not forward refs, and widening it for
            // one Sunday screen is not worth the blast radius.
            <div key={wk} ref={wk === week ? currentWeekRef : undefined}>
            <GlassPanel className={cn('p-3', wk === week && 'border border-primary/30')}>
              <SectionHeader level="eyebrow" title={t('sunday.table.weekLabel', { n: wk })} />
              <div className="mt-1.5 space-y-1">
                {matches.map(m => {
                  const home = clubs[m.homeClubId];
                  const away = clubs[m.awayClubId];
                  const mine = m.homeClubId === playerClubId || m.awayClubId === playerClubId;
                  return (
                    <div key={m.id} className={cn('flex items-center gap-2 text-caption', mine && 'font-semibold')}>
                      <span className="flex-1 truncate text-right text-foreground/85">{home?.shortName ?? '?'}</span>
                      <span className="shrink-0 tabular-nums text-foreground w-12 text-center">
                        {m.played ? `${m.homeGoals}-${m.awayGoals}` : t('sunday.match.vs')}
                      </span>
                      <span className="flex-1 truncate text-foreground/85">{away?.shortName ?? '?'}</span>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
            </div>
          ))}
        </div>
      )}

      {tab === 'cup' && (
        sunday.cup ? (
          /* ONE panel. It used to be a panel for the competition's name, then a
             panel per round, each containing between one and four one-line
             ties — three nested surfaces to render four lines of football. */
          <GlassPanel className="p-3">
            <SectionHeader
              level="section"
              title={sunday.cup.name}
              accessory={
                <span className={cn(
                  'text-caption',
                  sunday.cup.winnerClubId === playerClubId ? 'text-amber-300 font-semibold'
                    : sunday.cup.eliminated ? 'text-muted-foreground' : 'text-transparent',
                )}>
                  {sunday.cup.winnerClubId === playerClubId
                    ? t('sunday.table.cupWon')
                    : sunday.cup.eliminated ? t('sunday.table.cupOut') : ''}
                </span>
              }
            />
            <ol className="mt-2 space-y-2.5">
              {[1, 2, 3].map(round => {
                const ties = sunday.cup!.ties.filter(x => x.round === round);
                if (!ties.length) return null;
                return (
                  <li key={round}>
                    <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground pb-1 border-b border-white/[0.08]">
                      {sundayCupRoundName(round)}
                    </p>
                    <ul className="pt-1.5 space-y-1">
                      {ties.map(tie => {
                        const home = clubs[tie.homeClubId];
                        const away = clubs[tie.awayClubId];
                        const mine = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
                        return (
                          <li
                            key={`${tie.round}-${tie.homeClubId}-${tie.awayClubId}`}
                            className={cn(
                              'flex items-center gap-2 text-caption rounded-md px-1.5 py-1',
                              mine && 'font-semibold bg-primary/10',
                            )}
                          >
                            <span className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                              <span className="truncate text-foreground/85">{home?.shortName ?? '?'}</span>
                              {home && (
                                <SundayCrest shortName={home.shortName} color={home.color} secondaryColor={home.secondaryColor} size={16} />
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums text-foreground w-16 text-center">
                              {tie.played
                                ? `${tie.homeGoals}-${tie.awayGoals}${tie.shootout ? ` (${tie.shootout.home}-${tie.shootout.away})` : ''}`
                                : t('sunday.match.vs')}
                            </span>
                            <span className="flex-1 min-w-0 flex items-center gap-1.5">
                              {away && (
                                <SundayCrest shortName={away.shortName} color={away.color} secondaryColor={away.secondaryColor} size={16} />
                              )}
                              <span className="truncate text-foreground/85">{away?.shortName ?? '?'}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </GlassPanel>
        ) : (
          <GlassPanel className="p-6 text-center">
            <p className="text-body text-muted-foreground">{t('sunday.table.noCup')}</p>
          </GlassPanel>
        )
      )}

    </div>
  );
};

export default SundayTable;
