/**
 * Club history — and the two endings.
 *
 * One screen, three states, because they are the same subject at different
 * moments: what the club has done, what it just did (the season summary), and
 * what it was (the retrospective, when it folds). Sending the player to a
 * separate route for each would mean three near-identical screens and a
 * navigation problem at exactly the moments that should feel weighty.
 *
 * WHAT CHANGED, AND WHY. The three sections were three lists in three panels,
 * drawn identically and ranked by nothing: a season — the richest thing the
 * mode writes — was five lines of 11px muted text, a legend was a name and a
 * sentence with his fifty-four appearances thrown away, and a record's authored
 * context sat in the same grey as the label above it. Every word here is
 * authored by the simulation and none of it has been cut; it is ordered now.
 * The seasons come first because they are the story, and the club's honours
 * are three numbers at the top rather than something only a folded club ever
 * got to see.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { StatChip } from '@/components/game/sunday/SundayBits';
import { SundayFace } from '@/components/game/sunday/SundayFace';
import { SundaySeasonCard } from '@/components/game/sunday/SundaySeasonCard';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { formatMoney, getSuffix } from '@/utils/helpers';
import { getSundayDivision, SUNDAY_MEMORY_LEGENDARY_WEIGHT } from '@/config/sundayLeague';
import { buildSundayTable, sundayPosition } from '@/utils/sunday/season';
import { momentOfSeason } from '@/utils/sunday/memories';
import { sundayFaceSpec } from '@/utils/sunday/visuals';

const FoldedIcon = SUNDAY_ICON.folded;

/** The portrait size for a man who is remembered. Inside `SundayFace`'s large
 *  tier, because a legend gets a face rather than a thumbnail. */
const LEGEND_FACE = 44;

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
  const promotions = sunday.history.filter(h => h.promoted).length;
  const cups = sunday.history.filter(h => h.cupResult === 'Won the Sunday Cup').length;

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
            <FoldedIcon className="w-8 h-8 text-destructive mx-auto" aria-hidden />
            <p className="text-h3 font-display font-bold text-foreground">{t('sunday.history.folded')}</p>
            <p className="text-caption text-muted-foreground leading-relaxed">{sunday.foldReason}</p>
            <p className="text-caption text-muted-foreground leading-relaxed">{t('sunday.history.foldedBody')}</p>
          </div>
          {/* The retrospective: failure gets the same dignity as a dynasty.
              Every number is the club's own history — this is what it WAS. */}
          <div className="grid grid-cols-3 gap-2">
            <StatChip label={t('sunday.history.retro.seasons')} value={String(Math.max(season, sunday.history.length))} />
            <StatChip label={t('sunday.history.retro.promotions')} value={String(promotions)} tone="good" />
            <StatChip label={t('sunday.history.retro.cups')} value={String(cups)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatChip label={t('sunday.history.retro.goals')} value={String(sunday.history.reduce((n, h) => n + h.goalsFor, 0) + sunday.seasonStats.goalsFor)} />
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
          <SectionHeader title={t('sunday.history.seasonComplete', { season })} icon={SUNDAY_ICON.seasonComplete} />
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

      <SectionHeader title={t('sunday.history.title')} icon={SUNDAY_ICON.honours} />

      {/* What the club has won, which used to be visible only after it folded.
          Hidden until there is a completed season, because three zeroes is not
          an honours board — and hidden for a folded club, whose retrospective
          above already carries the same three numbers plus the part-season it
          died in. */}
      {!sunday.folded && sunday.history.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <StatChip label={t('sunday.history.retro.seasons')} value={String(sunday.history.length)} />
          <StatChip label={t('sunday.history.retro.promotions')} value={String(promotions)} tone={promotions > 0 ? 'good' : 'default'} />
          <StatChip label={t('sunday.history.retro.cups')} value={String(cups)} tone={cups > 0 ? 'good' : 'default'} />
        </div>
      )}

      {/* Seasons — the story, newest first. */}
      <GlassPanel className="p-3">
        <SectionHeader level="section" title={t('sunday.history.seasons')} icon={SUNDAY_ICON.seasonComplete} />
        {sunday.history.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.history.noSeasons')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {[...sunday.history].reverse().map(h => (
              <SundaySeasonCard key={h.season} record={h} />
            ))}
          </ul>
        )}
      </GlassPanel>

      {/* Records — the number, then the sentence that makes it a story. */}
      <GlassPanel className="p-3">
        <SectionHeader level="section" title={t('sunday.history.records')} icon={SUNDAY_ICON.honours} />
        {sunday.records.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.history.noRecords')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sunday.records.map(r => (
              <li key={r.id} className="rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/10 p-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-micro uppercase tracking-wider text-muted-foreground truncate">
                    {r.label}
                  </span>
                  {/* When it happened. Carried in every record since the mode
                      shipped and never drawn, so a record was a fact with no
                      date on it. */}
                  <span className="text-micro text-muted-foreground/70 shrink-0 tabular-nums">
                    {t('sunday.history.recordWhen', { season: r.season, week: r.week })}
                  </span>
                </div>
                <p className="text-body font-semibold text-foreground">{r.value}</p>
                {r.detail && (
                  <p className="text-caption text-muted-foreground/90 mt-0.5 leading-relaxed">{r.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      {/* Remembered — the men, with the numbers that earned it. */}
      <GlassPanel className="p-3">
        <SectionHeader level="section" title={t('sunday.history.legends')} icon={SUNDAY_ICON.legend} />
        {sunday.legends.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.history.noLegends')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sunday.legends.map(l => (
              <li key={l.playerId} className="rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/10 p-2.5 flex items-start gap-2.5">
                {/* His face survives him leaving: `sundayFaceSpec` returns the
                    stored appearance while he is still in the players map and
                    a stable one derived from his id once he is gone. */}
                <span className="block rounded-lg overflow-hidden bg-white/[0.05] shrink-0">
                  <SundayFace
                    {...sundayFaceSpec(players[l.playerId] ?? { id: l.playerId })}
                    size={LEGEND_FACE}
                    className="block"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-foreground truncate">{l.name}</p>
                  {/* The three numbers that were in the save all along. */}
                  <p className="text-micro text-muted-foreground tabular-nums">
                    {t('sunday.history.legendLine', { apps: l.apps, goals: l.goals, seasons: l.seasons })}
                  </p>
                  <p className="text-caption text-muted-foreground/90 leading-relaxed mt-0.5">{l.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
};

export default SundayHistory;
