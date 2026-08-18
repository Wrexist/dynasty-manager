/**
 * Match Day.
 *
 * Three states in one screen: the pre-match briefing, the narrative revealing
 * itself line by line, and the result. No page transitions between them —
 * bouncing a player through three routes to watch one Sunday morning is the
 * "20 unnecessary screens" failure mode.
 *
 * The narrative reveal is presentation only. The result is computed in full the
 * moment the manager taps Kick Off, so backgrounding the app, killing it, or
 * skipping the reveal cannot change what happened.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Flag, Play, SkipForward, Snowflake, Sun, Wind } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { SundayCrest } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { SUNDAY_MIN_START } from '@/config/sundayLeague';
import { findSundayFixture, sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { sundayCupRoundName } from '@/utils/sunday/season';
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
    // Weather is rolled from the seeded stream at kick-off, so it is only
    // knowable after the match — reporting it beforehand would mean rolling it
    // twice and the two rolls disagreeing.
    matchWeather: s.currentMatchResult?.weather ?? null,
  })));
  const playMatch = useGameStore(s => s.playSundayMatch);
  const setScreen = useGameStore(s => s.setScreen);
  const ratings = useGameStore(s => s.matchPlayerRatings);
  const players = useGameStore(s => s.players);

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

  // Re-entering the screen after the match was played (navigated away mid-
  // reveal, or came back later) shows the finished report immediately instead
  // of an empty feed stuck on "Playing…". `kicking` guards the one render
  // between the store writing the result and this component starting the
  // reveal, which would otherwise skip the animation on a fresh kick-off.
  useEffect(() => {
    if (report && !playing && !kicking && revealed === 0) {
      setRevealed(report.narrative.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, playing, kicking]);

  // Reveal loop. Driven off `revealed` so a skip (which jumps it to the end)
  // stops it naturally rather than needing a cancel flag.
  useEffect(() => {
    if (!playing || !report) return;
    if (revealed >= report.narrative.length) { setPlaying(false); return; }
    const delay = reduceMotion ? 0 : Math.max(120, (matchSpeed / 3300) * REVEAL_BASE_MS);
    timer.current = setTimeout(() => setRevealed(n => n + 1), delay);
    return () => clearTimer();
  }, [playing, revealed, report, matchSpeed, reduceMotion, clearTimer]);

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

  // `kicking` is set synchronously so a second tap in the same frame cannot
  // enter the action twice while the (lazy) implementation chunk resolves.
  const kickOff = () => {
    if (report || kicking) return;
    setKicking(true);
    void playMatch().then(result => {
      setKicking(false);
      if (!result) return;
      setRevealed(0);
      setPlaying(true);
    });
  };

  const pitch = Math.round(sundayPitchQuality(sunday, week));
  const namedCount = sunday.teamsheet.length;
  const WeatherIcon = WEATHER_ICON[matchWeather?.weather ?? 'clear'];
  const done = !!report && revealed >= report.narrative.length;

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

      {/* Pre-match briefing */}
      {!report && (
        <>
          <GlassPanel className="p-4 space-y-2">
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
            <p className={cn('text-caption', namedCount >= SUNDAY_MIN_START ? 'text-muted-foreground' : 'text-amber-300')}>
              {t('sunday.match.namedSide', { n: namedCount })}
            </p>
          </GlassPanel>

          <LiquidButton tone="primary" className="w-full py-3" onClick={kickOff} disabled={kicking}>
            <span className="inline-flex items-center gap-1.5"><Play className="w-4 h-4" aria-hidden /> {t('sunday.match.kickOff')}</span>
          </LiquidButton>
          <LiquidButton className="w-full py-2.5" onClick={() => setScreen('sunday-teamsheet')}>
            {t('sunday.sheet.title')}
          </LiquidButton>
        </>
      )}

      {/* Narrative feed */}
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
            {report.narrative.slice(0, revealed).map((line, i) => (
              <motion.li
                key={`${i}-${line.slice(0, 12)}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="text-caption text-foreground/85 leading-relaxed"
              >
                {line}
              </motion.li>
            ))}
          </ul>
          {!done && (
            <p className="text-micro text-muted-foreground mt-3">{t('sunday.match.playing')}</p>
          )}
        </GlassPanel>
      )}

      {/* Result */}
      {report && done && (
        <>
          <GlassPanel className="p-4">
            <p className="text-body font-semibold text-foreground">{sundayResultVerdict(report)}</p>
            {matchWeather && (
              <p className="text-caption text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                <WeatherIcon className="w-3.5 h-3.5" aria-hidden />
                {t('sunday.match.weather')}: {matchWeather.weather} · {t('sunday.match.pitch')}: {matchWeather.pitch}
              </p>
            )}
            {report.motmPlayerId && players[report.motmPlayerId] && (
              <p className="text-caption text-muted-foreground mt-1">
                {t('sunday.match.motm')}: {players[report.motmPlayerId].firstName} {players[report.motmPlayerId].lastName}
                {' · '}{report.motmRating.toFixed(1)}
              </p>
            )}
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

          <LiquidButton tone="primary" className="w-full py-3" onClick={() => setScreen('sunday-hub')}>
            {t('sunday.match.done')}
          </LiquidButton>
        </>
      )}
    </div>
  );
};

export default SundayMatchDay;
