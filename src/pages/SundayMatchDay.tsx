/**
 * Match Day — the mode's centrepiece, in four beats on one screen.
 *
 *   1. BRIEFING   — who you are playing, where they sit, who to watch.
 *   2. ARRIVAL    — the Sunday morning: doubts resolve, no-shows are
 *                   discovered, and if you are short of eleven you make the
 *                   mode's sharpest call: pay for guests or carry the gap.
 *   3. THE MATCH  — the narrative revealing itself line by line.
 *   4. THE STORY  — hero, villain, where it turned, and what it cost.
 *
 * One screen, no route changes: bouncing a player through four pages to watch
 * one Sunday morning is the "20 unnecessary screens" failure mode.
 *
 * The reveal is presentation only. The result is computed in full the moment
 * the manager taps Kick Off, so backgrounding, killing or skipping cannot
 * change what happened. The ARRIVAL is state, not presentation — it is written
 * once, seeded, and a reload replays the same morning.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CloudRain, Flag, Frown, Play, Repeat, SkipForward, Snowflake,
  Sparkles, Sun, TrendingDown, Trophy, Users, Wind,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { SundayCrest } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { SUNDAY_MIN_START, SUNDAY_RINGER_COST } from '@/config/sundayLeague';
import { findSundayFixture, sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { buildSundayTable, sundayCupRoundName, sundayPosition } from '@/utils/sunday/season';
import { sundayResultVerdict } from '@/utils/sunday/match';
import type { WeatherCondition } from '@/types/game';

const WEATHER_ICON: Record<WeatherCondition, React.ElementType> = {
  clear: Sun, rain: CloudRain, wind: Wind, snow: Snowflake,
};

/** How long each narrative line takes to appear, scaled by the match-speed
 *  setting so the mode honours the same preference every other screen does. */
const REVEAL_BASE_MS = 520;

const SundayMatchDay = () => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const { sunday, clubs, fixtures, week, playerClubId, matchSpeed, matchWeather } = useGameStore(useShallow(s => ({
    sunday: s.sunday,
    clubs: s.clubs,
    fixtures: s.fixtures,
    week: s.week,
    playerClubId: s.playerClubId,
    matchSpeed: s.settings.matchSpeed,
    matchWeather: s.currentMatchResult?.weather ?? null,
  })));
  const playMatch = useGameStore(s => s.playSundayMatch);
  const arrive = useGameStore(s => s.arriveSundayMatch);
  const hireRingers = useGameStore(s => s.hireSundayRingers);
  const setScreen = useGameStore(s => s.setScreen);
  const ratings = useGameStore(s => s.matchPlayerRatings);
  const players = useGameStore(s => s.players);
  const arrival = sunday?.arrival && sunday.arrival.week === week ? sunday.arrival : null;

  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [kicking, setKicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fixture = useMemo(
    () => (sunday ? findSundayFixture(sunday, fixtures, week, playerClubId) : null),
    [sunday, fixtures, week, playerClubId],
  );

  // The report for THIS week, if it has already been played. Checking the week
  // and season (not merely "is there a report") is what stops last week's match
  // being replayed on screen after an advance.
  const report = sunday?.lastMatch && sunday.lastMatch.week === week ? sunday.lastMatch : null;

  const clearTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Re-entering the screen after the match was played shows the finished
  // report immediately instead of an empty feed stuck on "Playing…".
  useEffect(() => {
    if (report && !playing && !kicking && revealed === 0) {
      setRevealed(report.narrative.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, playing, kicking]);

  // Reveal loop, with a haptic tap on each goal line as it lands.
  useEffect(() => {
    if (!playing || !report) return;
    if (revealed >= report.narrative.length) {
      setPlaying(false);
      if (report.goalsFor > report.goalsAgainst) hapticSuccess();
      return;
    }
    const line = report.narrative[revealed] ?? '';
    if (/\d+-\d+\)/.test(line)) hapticLight();
    const delay = reduceMotion ? 0 : Math.max(120, (matchSpeed / 3300) * REVEAL_BASE_MS);
    timer.current = setTimeout(() => setRevealed(n => n + 1), delay);
    return () => clearTimer();
  }, [playing, revealed, report, matchSpeed, reduceMotion, clearTimer]);

  // Opponent intel for the briefing — position, form, danger man. All read
  // straight off the table and the opposition squad; no invented scouting.
  const intel = useMemo(() => {
    if (!sunday || !fixture) return null;
    const oppId = fixture.kind === 'cup'
      ? (fixture.tie.homeClubId === playerClubId ? fixture.tie.awayClubId : fixture.tie.homeClubId)
      : (fixture.match.homeClubId === playerClubId ? fixture.match.awayClubId : fixture.match.homeClubId);
    const opp = clubs[oppId];
    if (!opp) return null;
    const table = buildSundayTable(fixtures, sunday.divisionClubIds);
    const row = table.find(r => r.clubId === oppId);
    const danger = opp.playerIds
      .map(id => players[id])
      .filter(Boolean)
      .sort((a, b) => (b.goals - a.goals) || (b.overall - a.overall))[0];
    return {
      position: sundayPosition(table, oppId),
      tableSize: table.length,
      form: row?.form ?? [],
      danger: danger ? { name: `${danger.firstName} ${danger.lastName}`, goals: danger.goals } : null,
    };
  }, [sunday, fixture, clubs, fixtures, players, playerClubId]);

  if (!sunday) return null;

  const opponentId = fixture
    ? fixture.kind === 'cup'
      ? (fixture.tie.homeClubId === playerClubId ? fixture.tie.awayClubId : fixture.tie.homeClubId)
      : (fixture.match.homeClubId === playerClubId ? fixture.match.awayClubId : fixture.match.homeClubId)
    : report ? report.opponentClubId : null;
  const opponent = opponentId ? clubs[opponentId] : null;
  const isHome = fixture
    ? (fixture.kind === 'cup' ? fixture.tie.homeClubId : fixture.match.homeClubId) === playerClubId
    : report?.home ?? true;
  const isDerby = !!opponentId && sunday.rivalry?.clubId === opponentId;

  if (!fixture && !report) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <GlassPanel className="p-6 text-center">
          <p className="text-body text-muted-foreground">{t('sunday.match.noFixture')}</p>
          <LiquidButton className="mt-4" onClick={() => setScreen('sunday-hub')}>
            {t('sunday.match.done')}
          </LiquidButton>
        </GlassPanel>
      </div>
    );
  }

  // The arrival decision is live when we are short of eleven and undecided.
  const shortfallPending = !!arrival && !report
    && arrival.optionalRingers > 0 && arrival.ringersHired === null;
  const canKickOff = !!arrival && !shortfallPending;

  // `kicking` is set synchronously so a second tap in the same frame cannot
  // enter the action twice while the (lazy) implementation chunk resolves.
  const onArrive = () => {
    if (report || kicking || arrival) return;
    setKicking(true);
    void arrive().then(() => setKicking(false));
  };
  const kickOff = () => {
    if (report || kicking || !canKickOff) return;
    setKicking(true);
    void playMatch().then(result => {
      setKicking(false);
      if (!result) return;
      setRevealed(0);
      setPlaying(true);
    });
  };
  const decideRingers = (n: number) => {
    void hireRingers(n).then(() => hapticLight());
  };

  const pitch = Math.round(sundayPitchQuality(sunday, week));
  const WeatherIcon = WEATHER_ICON[matchWeather?.weather ?? 'clear'];
  const done = !!report && revealed >= report.narrative.length;
  const hero = report?.motmPlayerId ? players[report.motmPlayerId] : null;
  const villain = report?.lowlightPlayerId ? players[report.lowlightPlayerId] : null;
  const standing = arrival ? arrival.presentIds.length + arrival.forcedRingers : 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* Scoreline / fixture header */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <SundayCrest
              shortName={isHome ? sunday.identity.shortName : opponent?.shortName ?? '???'}
              color={isHome ? sunday.identity.color : opponent?.color ?? '#333'}
              secondaryColor={isHome ? sunday.identity.secondaryColor : opponent?.secondaryColor ?? '#fff'}
              size={36}
            />
            <span className="text-caption font-semibold text-foreground truncate">
              {isHome ? sunday.identity.shortName : opponent?.shortName}
            </span>
          </div>
          <div className="text-center shrink-0">
            {report ? (
              <p className="text-h2 font-display font-bold tabular-nums text-foreground">
                {isHome
                  ? `${report.goalsFor}-${report.goalsAgainst}`
                  : `${report.goalsAgainst}-${report.goalsFor}`}
              </p>
            ) : (
              <p className="text-h3 font-display font-bold text-muted-foreground">{t('sunday.match.vs')}</p>
            )}
            <p className="text-micro text-muted-foreground">
              {fixture?.kind === 'cup' ? sundayCupRoundName(fixture.tie.round) : t('sunday.hub.week', { week })}
              {isDerby ? ` · ${sunday.rivalry?.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-caption font-semibold text-foreground truncate text-right">
              {isHome ? opponent?.shortName : sunday.identity.shortName}
            </span>
            <SundayCrest
              shortName={isHome ? opponent?.shortName ?? '???' : sunday.identity.shortName}
              color={isHome ? opponent?.color ?? '#333' : sunday.identity.color}
              secondaryColor={isHome ? opponent?.secondaryColor ?? '#fff' : sunday.identity.secondaryColor}
              size={36}
            />
          </div>
        </div>
      </GlassPanel>

      {/* 1 · BRIEFING */}
      {!report && !arrival && (
        <>
          <GlassPanel className="p-4 space-y-2.5">
            <SectionHeader level="section" title={t('sunday.match.title')} />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                <p className="text-micro text-muted-foreground">{t('sunday.match.pitch')}</p>
                <p className="text-body font-semibold text-foreground">{pitch}/100</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                <p className="text-micro text-muted-foreground">{t('sunday.hub.nextFixture')}</p>
                <p className="text-body font-semibold text-foreground">
                  {isHome ? t('sunday.match.home') : t('sunday.match.away')}
                </p>
              </div>
            </div>
            {intel && fixture?.kind !== 'cup' && (
              <div className="flex items-center gap-2 text-caption text-muted-foreground">
                <span className="font-semibold text-foreground">{intel.position}/{intel.tableSize}</span>
                {intel.form.length > 0 && (
                  <span className="inline-flex gap-0.5" aria-label={intel.form.join(', ')}>
                    {intel.form.map((r, i) => (
                      <span
                        key={i}
                        className={cn(
                          'w-4 h-4 rounded text-[9px] font-bold inline-flex items-center justify-center',
                          r === 'W' ? 'bg-emerald-500/25 text-emerald-300'
                            : r === 'L' ? 'bg-destructive/25 text-destructive' : 'bg-amber-400/20 text-amber-300',
                        )}
                      >
                        {r}
                      </span>
                    ))}
                  </span>
                )}
                {intel.danger && intel.danger.goals > 0 && (
                  <span className="truncate ml-auto">⚠ {intel.danger.name} ({intel.danger.goals})</span>
                )}
              </div>
            )}
            {isDerby && sunday.rivalry && (
              <p className="text-caption text-orange-300">
                {sunday.rivalry.managerName} — {sunday.rivalry.managerStyle}
                {sunday.rivalry.defector && ` ${t('sunday.rival.defector', { name: sunday.rivalry.defector.name })}`}
              </p>
            )}
            <p className={cn('text-caption', sunday.teamsheet.length >= SUNDAY_MIN_START ? 'text-muted-foreground' : 'text-amber-300')}>
              {t('sunday.match.namedSide', { n: sunday.teamsheet.length })}
            </p>
          </GlassPanel>

          <LiquidButton tone="primary" className="w-full py-3" onClick={onArrive} disabled={kicking}>
            <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" aria-hidden /> {t('sunday.arrival.title')}</span>
          </LiquidButton>
          <LiquidButton className="w-full py-2.5" onClick={() => setScreen('sunday-teamsheet')}>
            {t('sunday.sheet.title')}
          </LiquidButton>
        </>
      )}

      {/* 2 · ARRIVAL */}
      {!report && arrival && (
        <>
          <GlassPanel className="p-4 space-y-2">
            <SectionHeader level="section" title={t('sunday.arrival.title')} />
            {arrival.beats.length === 0 ? (
              <p className="text-caption text-muted-foreground">{t('sunday.arrival.quiet')}</p>
            ) : (
              <ul className="space-y-1.5">
                {arrival.beats.map((line, i) => (
                  <motion.li
                    key={`${i}-${line.slice(0, 10)}`}
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.25, 1.5), duration: 0.25 }}
                    className="text-caption text-foreground/85 leading-relaxed"
                  >
                    {line}
                  </motion.li>
                ))}
              </ul>
            )}
            <p className="text-caption font-semibold text-foreground">
              {t('sunday.arrival.standing', { n: standing })}
              {arrival.forcedRingers > 0 && (
                <span className="text-muted-foreground font-normal">
                  {' · '}
                  {t('sunday.arrival.forced', { n: arrival.forcedRingers, s: arrival.forcedRingers === 1 ? '' : 's' })}
                </span>
              )}
            </p>
          </GlassPanel>

          {shortfallPending ? (
            <GlassPanel className="p-4 space-y-2" tone="danger">
              <p className="text-body font-semibold text-amber-200 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" aria-hidden />
                {t('sunday.arrival.short', { n: arrival.optionalRingers })}
              </p>
              <LiquidButton
                tone="amber"
                className="w-full py-2.5"
                disabled={sunday.balance < arrival.optionalRingers * SUNDAY_RINGER_COST}
                onClick={() => decideRingers(arrival.optionalRingers)}
              >
                <span className="block text-left w-full">
                  <span className="block text-body font-semibold">
                    {t('sunday.arrival.hire', {
                      n: arrival.optionalRingers,
                      s: arrival.optionalRingers === 1 ? '' : 's',
                      cost: arrival.optionalRingers * SUNDAY_RINGER_COST,
                    })}
                  </span>
                  <span className="block text-micro text-muted-foreground">{t('sunday.arrival.hireHint')}</span>
                </span>
              </LiquidButton>
              <LiquidButton className="w-full py-2.5" onClick={() => decideRingers(0)}>
                <span className="block text-left w-full">
                  <span className="block text-body font-semibold">
                    {t('sunday.arrival.playShort', { n: standing })}
                  </span>
                  <span className="block text-micro text-muted-foreground">{t('sunday.arrival.playShortHint')}</span>
                </span>
              </LiquidButton>
            </GlassPanel>
          ) : (
            <LiquidButton tone="primary" className="w-full py-3" onClick={kickOff} disabled={kicking}>
              <span className="inline-flex items-center gap-1.5"><Play className="w-4 h-4" aria-hidden /> {t('sunday.match.kickOff')}</span>
            </LiquidButton>
          )}
        </>
      )}

      {/* 3 · THE MATCH */}
      {report && (
        <GlassPanel className="p-4">
          <SectionHeader
            level="section"
            title={t('sunday.match.narrative')}
            accessory={
              !done ? (
                <button
                  type="button"
                  onClick={() => { clearTimer(); setPlaying(false); setRevealed(report.narrative.length); }}
                  className="text-caption font-semibold text-primary inline-flex items-center gap-1 min-h-[44px] px-1"
                >
                  <SkipForward className="w-3.5 h-3.5" aria-hidden /> {t('sunday.match.skip')}
                </button>
              ) : undefined
            }
          />
          <ul className="mt-2 space-y-2" aria-live="polite">
            {report.narrative.slice(0, revealed).map((line, i) => {
              const isScoreBeat = /\d+-\d+\)/.test(line);
              const isMarker = /^(HT|FT) \d/.test(line);
              return (
                <motion.li
                  key={`${i}-${line.slice(0, 12)}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className={cn(
                    'leading-relaxed',
                    isMarker
                      ? 'text-caption font-bold text-foreground tracking-wide border-t border-border/40 pt-2'
                      : isScoreBeat
                        ? 'text-body font-semibold text-foreground'
                        : 'text-caption text-foreground/85',
                  )}
                >
                  {line}
                </motion.li>
              );
            })}
          </ul>
          {!done && (
            <p className="text-micro text-muted-foreground mt-3">{t('sunday.match.playing')}</p>
          )}
        </GlassPanel>
      )}

      {/* 4 · THE STORY */}
      {report && done && (
        <>
          <GlassPanel className="p-4 space-y-2.5">
            <p className="text-body font-semibold text-foreground">{sundayResultVerdict(report)}</p>
            {matchWeather && (
              <p className="text-micro text-muted-foreground inline-flex items-center gap-1.5">
                <WeatherIcon className="w-3.5 h-3.5" aria-hidden />
                {matchWeather.weather} · {t('sunday.match.pitch')}: {matchWeather.pitch}
              </p>
            )}
            <div className="space-y-2">
              {hero && (
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.hero')}: </span>
                    {hero.firstName} {hero.lastName} · {report.motmRating.toFixed(1)}
                  </p>
                </div>
              )}
              {villain && villain.id !== hero?.id && (
                <div className="flex items-start gap-2">
                  <Frown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.lowlight')}: </span>
                    {villain.firstName} {villain.lastName} · {report.lowlightRating.toFixed(1)}
                  </p>
                </div>
              )}
              {report.turningPoint && (
                <div className="flex items-start gap-2">
                  <Repeat className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.turningPoint')}: </span>
                    {report.turningPoint}
                  </p>
                </div>
              )}
              {report.consequences.length > 0 && (
                <div className="flex items-start gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-micro text-muted-foreground">{t('sunday.story.consequences')}</p>
                    {report.consequences.map(line => (
                      <p key={line} className="text-caption text-foreground leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>

          {ratings.length > 0 && (
            <GlassPanel className="p-4">
              <SectionHeader level="section" title={t('sunday.match.ratings')} icon={Flag} />
              <div className="divide-y divide-border/30 mt-1">
                {ratings
                  .filter(r => report.playedIds.includes(r.playerId) && players[r.playerId])
                  .sort((a, b) => b.rating - a.rating)
                  .map(r => (
                    <div key={r.playerId} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 text-body text-foreground truncate">
                        {players[r.playerId].firstName} {players[r.playerId].lastName}
                      </span>
                      {r.goals > 0 && <span className="text-micro text-emerald-300">{r.goals}G</span>}
                      {r.assists > 0 && <span className="text-micro text-sky-300">{r.assists}A</span>}
                      <span className={cn(
                        'text-caption font-semibold tabular-nums w-8 text-right',
                        r.rating >= 7.5 ? 'text-emerald-300' : r.rating >= 6 ? 'text-foreground' : 'text-destructive',
                      )}>
                        {r.rating.toFixed(1)}
                      </span>
                    </div>
                  ))}
              </div>
            </GlassPanel>
          )}

          {isDerby && (
            <GlassPanel className="p-3">
              <p className="text-caption text-orange-300 inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" aria-hidden />
                {sunday.rivalry?.name} · {t('sunday.hub.rivalRecord', {
                  w: sunday.rivalry?.wins ?? 0, d: sunday.rivalry?.draws ?? 0, l: sunday.rivalry?.losses ?? 0,
                })}
              </p>
            </GlassPanel>
          )}

          <LiquidButton tone="primary" className="w-full py-3" onClick={() => setScreen('sunday-hub')}>
            {t('sunday.match.done')}
          </LiquidButton>
        </>
      )}
    </div>
  );
};

export default SundayMatchDay;
