/**
 * Club history — and the two endings.
 *
 * One screen, three states, because they are the same subject at different
 * moments: what the club has done, what it just did (the season summary), and
 * what it was (the retrospective, when it folds). Sending the player to a
 * separate route for each would mean three near-identical screens and a
 * navigation problem at exactly the moments that should feel weighty.
 */
import { useState } from 'react';
import { Award, Flag, Medal, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { StatChip } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { formatMoney, getSuffix } from '@/utils/helpers';
import { getSundayDivision, SUNDAY_MEMORY_LEGENDARY_WEIGHT } from '@/config/sundayLeague';
import { buildSundayTable, sundayPosition } from '@/utils/sunday/season';
import { momentOfSeason } from '@/utils/sunday/memories';

const SundayHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sunday, fixtures, playerClubId, season, players } = useGameStore(useShallow(s => ({
    sunday: s.sunday, fixtures: s.fixtures, playerClubId: s.playerClubId, season: s.season, players: s.players,
  })));
  const endSeason = useGameStore(s => s.endSundaySeason);
  const setScreen = useGameStore(s => s.setScreen);
  // Rolling the season over is the heaviest action in the mode and it is
  // async. A second tap while it runs would start a second rollover.
  const [rolling, setRolling] = useState(false);

  if (!sunday) return null;
  const div = getSundayDivision(sunday.divisionId);
  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  const position = sundayPosition(table, playerClubId);
  const stats = sunday.seasonStats;

  // Presentation night, derived on the spot: top scorer and best average from
  // the live players map, most reliable from club appearances this squad, the
  // moment of the season from the heaviest memory written this year.
  const awards = (() => {
    if (!sunday.seasonComplete || sunday.folded) return [] as { label: string; value: string }[];
    const out: { label: string; value: string }[] = [];
    const squadPlayers = sunday.squad
      .map(m => ({ m, p: players[m.playerId] }))
      .filter((x): x is { m: typeof x.m; p: NonNullable<typeof x.p> } => !!x.p);
    const scorer = [...squadPlayers].sort((a, b) => b.p.goals - a.p.goals)[0];
    if (scorer && scorer.p.goals > 0) {
      out.push({ label: t('sunday.history.topScorer'), value: `${scorer.p.firstName} ${scorer.p.lastName} (${scorer.p.goals})` });
    }
    const rated = squadPlayers
      .filter(x => (x.p.seasonRatedMatches ?? 0) >= 3)
      .map(x => ({ ...x, avg: (x.p.seasonRatingTotal ?? 0) / Math.max(1, x.p.seasonRatedMatches ?? 1) }))
      .sort((a, b) => b.avg - a.avg)[0];
    if (rated) {
      out.push({ label: t('sunday.history.playerOfSeason'), value: `${rated.p.firstName} ${rated.p.lastName} (${rated.avg.toFixed(1)})` });
    }
    const reliable = [...squadPlayers].sort((a, b) => b.p.appearances - a.p.appearances)[0];
    if (reliable && reliable.p.appearances > 0) {
      out.push({ label: t('sunday.history.reliable'), value: `${reliable.p.firstName} ${reliable.p.lastName} (${reliable.p.appearances})` });
    }
    return out;
  })();
  const seasonMoment = sunday.seasonComplete && !sunday.folded
    ? momentOfSeason(sunday.squad, season)
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* Folded — the run is over. */}
      {sunday.folded && (
        <GlassPanel className="p-5 space-y-3" tone="danger">
          <div className="text-center space-y-2">
            <Flag className="w-8 h-8 text-destructive mx-auto" aria-hidden />
            <p className="text-h3 font-display font-bold text-foreground">{t('sunday.history.folded')}</p>
            <p className="text-caption text-muted-foreground leading-relaxed">{sunday.foldReason}</p>
            <p className="text-caption text-muted-foreground leading-relaxed">{t('sunday.history.foldedBody')}</p>
          </div>
          {/* The retrospective: failure gets the same dignity as a dynasty.
              Every number is the club's own history — this is what it WAS. */}
          <div className="grid grid-cols-3 gap-2">
            <StatChip label={t('sunday.history.retro.seasons')} value={String(Math.max(season, sunday.history.length))} />
            <StatChip label={t('sunday.history.retro.promotions')} value={String(sunday.history.filter(h => h.promoted).length)} tone="good" />
            <StatChip label={t('sunday.history.retro.cups')} value={String(sunday.history.filter(h => h.cupResult === 'Won the Sunday Cup').length)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatChip
              label={t('sunday.history.retro.goals')}
              value={String(sunday.history.reduce((n, h) => n + h.goalsFor, 0) + sunday.seasonStats.goalsFor)}
            />
            <StatChip
              label={t('sunday.history.retro.bestFinish')}
              value={(() => {
                const best = [...sunday.history].sort((a, b) => a.position - b.position)[0];
                return best ? `${best.position}${getSuffix(best.position)} · ${best.divisionName.replace('Sunday League ', '')}` : '—';
              })()}
            />
            <StatChip label={t('sunday.history.retro.finalBalance')} value={formatMoney(sunday.balance)} tone="bad" />
          </div>
          {sunday.legends.length > 0 && (
            <p className="text-caption text-muted-foreground leading-relaxed">
              {t('sunday.history.legends')}: {sunday.legends.map(l => l.name).join(', ')}.
            </p>
          )}
          <LiquidButton tone="primary" className="w-full py-3" onClick={() => navigate('/')}>
            {t('sunday.history.mainMenu')}
          </LiquidButton>
        </GlassPanel>
      )}

      {/* Season complete — the summary and the button that starts the next one. */}
      {!sunday.folded && sunday.seasonComplete && (
        <GlassPanel className="p-5 space-y-3">
          <SectionHeader title={t('sunday.history.seasonComplete', { season })} icon={Trophy} />
          <p className="text-body text-foreground">
            {t('sunday.history.finished', { position: `${position}${getSuffix(position)}` })} · {div.name}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <StatChip label={t('sunday.table.played')} value={String(stats.played)} />
            <StatChip label={t('sunday.table.won')} value={String(stats.won)} tone="good" />
            <StatChip label={t('sunday.table.lost')} value={String(stats.lost)} tone={stats.lost > stats.won ? 'bad' : 'default'} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatChip label="GF" value={String(stats.goalsFor)} />
            <StatChip label="GA" value={String(stats.goalsAgainst)} />
            <StatChip label={t('sunday.hub.balance')} value={formatMoney(sunday.balance)} tone={sunday.balance < 0 ? 'bad' : 'good'} />
          </div>

          {/* Presentation night: the trophies-on-a-pub-table moment. All read
              off real season stats and real memories. */}
          {awards.length > 0 && (
            <div>
              <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sunday.history.awards')}
              </p>
              <ul className="mt-1.5 space-y-1">
                {awards.map(a => (
                  <li key={a.label} className="flex items-baseline gap-2 text-caption">
                    <span className="text-muted-foreground shrink-0">{a.label}:</span>
                    <span className="text-foreground min-w-0">{a.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {seasonMoment && (
            <p className="text-caption text-primary/90 leading-relaxed border-l-2 border-primary/40 pl-3">
              {t('sunday.history.moment')}: {seasonMoment.text}
              {/* The heaviest moments get named as what they are. Presentation
                  only: the weight was written when the moment happened. */}
              {seasonMoment.weight >= SUNDAY_MEMORY_LEGENDARY_WEIGHT && (
                <span className="block text-micro font-semibold text-primary/80 mt-0.5">
                  {t('sunday.story.legendary')}
                </span>
              )}
            </p>
          )}
          <LiquidButton
            tone="primary"
            className="w-full py-3"
            busy={rolling}
            onClick={() => {
              if (rolling) return;
              setRolling(true);
              void endSeason()
                .then(() => setScreen('sunday-hub'))
                .finally(() => setRolling(false));
            }}
          >
            {t('sunday.history.startNext')}
          </LiquidButton>
        </GlassPanel>
      )}

      <SectionHeader title={t('sunday.history.title')} />

      {/* Records */}
      <GlassPanel className="p-4">
        <SectionHeader level="section" title={t('sunday.history.records')} icon={Medal} />
        {sunday.records.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.history.noRecords')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/30">
            {sunday.records.map(r => (
              <li key={r.id} className="py-2 text-caption">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-muted-foreground truncate">{r.label}</span>
                  <span className="text-foreground font-medium text-right">{r.value}</span>
                </div>
                {r.detail && (
                  <p className="text-micro text-muted-foreground/80 mt-0.5 leading-relaxed">{r.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      {/* Legends */}
      <GlassPanel className="p-4">
        <SectionHeader level="section" title={t('sunday.history.legends')} icon={Award} />
        {sunday.legends.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.history.noLegends')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/30">
            {sunday.legends.map(l => (
              <li key={l.playerId} className="py-2">
                <p className="text-body font-medium text-foreground truncate">{l.name}</p>
                <p className="text-micro text-muted-foreground leading-relaxed">{l.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      {/* Seasons */}
      <GlassPanel className="p-4">
        <SectionHeader level="section" title={t('sunday.history.seasons')} />
        {sunday.history.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.history.noRecords')}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {[...sunday.history].reverse().map(h => (
              <li key={h.season} className="border-l-2 border-border/50 pl-3">
                <p className="text-caption font-semibold text-foreground">
                  {t('sunday.history.seasonLine', { season: h.season, division: h.divisionName })}
                </p>
                <p className={cn(
                  'text-caption',
                  h.promoted ? 'text-emerald-300' : h.relegated ? 'text-destructive' : 'text-muted-foreground',
                )}>
                  {t('sunday.history.finished', { position: `${h.position}${getSuffix(h.position)}` })}
                  {h.promoted && ` · ${t('sunday.history.promoted')}`}
                  {h.relegated && ` · ${t('sunday.history.relegated')}`}
                </p>
                <p className="text-micro text-muted-foreground">
                  {h.won}W {h.drawn}D {h.lost}L · {h.goalsFor}-{h.goalsAgainst}
                  {h.cupResult ? ` · ${h.cupResult}` : ''}
                </p>
                {h.topScorer && (
                  <p className="text-micro text-muted-foreground">
                    {t('sunday.history.topScorer')}: {h.topScorer.name} ({h.topScorer.goals})
                  </p>
                )}
                {h.momentOfTheSeason && (
                  <p className="text-micro text-primary/85 mt-0.5 leading-relaxed">{h.momentOfTheSeason}</p>
                )}
                {h.highlights.map(hl => (
                  <p key={hl} className="text-micro text-muted-foreground/85 mt-0.5">{hl}</p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
};

export default SundayHistory;
