/**
 * Club history — and the two endings.
 *
 * One screen, three states, because they are the same subject at different
 * moments: what the club has done, what it just did (the season summary), and
 * what it was (the retrospective, when it folds). Sending the player to a
 * separate route for each would mean three near-identical screens and a
 * navigation problem at exactly the moments that should feel weighty.
 */
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
import { getSundayDivision } from '@/config/sundayLeague';
import { buildSundayTable, sundayPosition } from '@/utils/sunday/season';

const SundayHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sunday, fixtures, playerClubId, season } = useGameStore(useShallow(s => ({
    sunday: s.sunday, fixtures: s.fixtures, playerClubId: s.playerClubId, season: s.season,
  })));
  const endSeason = useGameStore(s => s.endSundaySeason);
  const setScreen = useGameStore(s => s.setScreen);

  if (!sunday) return null;
  const div = getSundayDivision(sunday.divisionId);
  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  const position = sundayPosition(table, playerClubId);
  const stats = sunday.seasonStats;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* Folded — the run is over. */}
      {sunday.folded && (
        <GlassPanel className="p-5 text-center space-y-3" tone="danger">
          <Flag className="w-8 h-8 text-destructive mx-auto" aria-hidden />
          <p className="text-h3 font-display font-bold text-foreground">{t('sunday.history.folded')}</p>
          <p className="text-caption text-muted-foreground leading-relaxed">{sunday.foldReason}</p>
          <p className="text-caption text-muted-foreground leading-relaxed">{t('sunday.history.foldedBody')}</p>
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
          <LiquidButton tone="primary" className="w-full py-3" onClick={() => { void endSeason().then(() => setScreen('sunday-hub')); }}>
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
              <li key={r.id} className="flex items-baseline gap-2 py-2 text-caption">
                <span className="min-w-0 flex-1 text-muted-foreground truncate">{r.label}</span>
                <span className="text-foreground font-medium text-right">{r.value}</span>
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
