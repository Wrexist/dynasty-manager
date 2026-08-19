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
import { toast } from 'sonner';
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
import { SUNDAY_MIN_START, SUNDAY_RINGER_COST, SUNDAY_TACTICS, getSundayTactic } from '@/config/sundayLeague';
import { SUNDAY_ICON, SUNDAY_WEATHER_ICON } from '@/config/sundayIcons';
import { MATCH_SPEEDS } from '@/config/matchSpeed';
import { findSundayFixture, sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { buildSundayTable, sundayCupRoundName, sundayPosition } from '@/utils/sunday/season';
import { buildMatchdayTeam, sundayResultVerdict, sundayStyleOf } from '@/utils/sunday/match';
import { deriveSundayStakes } from '@/utils/sunday/tier';
import { sundayMilestoneToday, sundayReverseFixtureRecall } from '@/utils/sunday/briefing';
import type { SundayMatchTier, SundayTacticId } from '@/types/game';

const WarningIcon = SUNDAY_ICON.warning;
const RecallIcon = SUNDAY_ICON.recall;
const KickOffIcon = SUNDAY_ICON.kickOff;
const SkipIcon = SUNDAY_ICON.skip;
const HeroIcon = SUNDAY_ICON.hero;
const LowlightIcon = SUNDAY_ICON.lowlight;
const SquadIcon = SUNDAY_ICON.squad;
const TurningPointIcon = SUNDAY_ICON.substitution;
const ConsequenceIcon = SUNDAY_ICON.expense;
const RatingsIcon = SUNDAY_ICON.ratings;
const RivalIcon = SUNDAY_ICON.rival;

/** How long each narrative line takes to appear, scaled by the match-speed
 *  setting so the mode honours the same preference every other screen does. */
const REVEAL_BASE_MS = 520;

/** The fastest tier. At Instant the manager has asked not to watch a match, so
 *  the half-time break is skipped and the ninety minutes are played in one go
 *  under the tactic already set. */
const INSTANT_SPEED = MATCH_SPEEDS[MATCH_SPEEDS.length - 1].value;

/**
 * What the header and the briefing look like at each tier.
 *
 * Existing tokens only, and deliberately quiet: a ring and a soft glow in a
 * colour the mode already uses for that thing (gold for a final, orange for
 * the derby, sky for a cup tie). A cup final should FEEL different from a wet
 * Tuesday without inventing a palette for it.
 */
const TIER_RIM: Record<SundayMatchTier, string> = {
  routine: '',
  cup: 'ring-1 ring-sky-400/30',
  derby: 'ring-1 ring-orange-400/40',
  'cup-final': 'ring-1 ring-primary/50 shadow-[0_0_28px_-8px_hsl(var(--primary)/0.55)]',
  decider: 'ring-1 ring-primary/45 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.45)]',
};

/** How much longer a goal line hangs before the next one, by tier. A decider
 *  and a final breathe; nothing else changes pace. Reduced motion and
 *  performance mode bypass the reveal entirely, so this never applies there. */
const TIER_GOAL_CADENCE: Record<SundayMatchTier, number> = {
  routine: 1, cup: 1, derby: 1.15, 'cup-final': 1.5, decider: 1.5,
};

/**
 * The labelled reasons this XI is better or worse than it looks on paper.
 *
 * The same list before and after the match, deliberately: pre-match it is the
 * answer to "what am I taking out there", post-match to "why did that happen".
 * Nothing here is a judgement — every row is an adjustment the simulation
 * really applied.
 */
const AdjustmentList = ({ rows, label }: { rows: readonly { label: string; delta: number }[]; label: string }) => (
  <div>
    <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <ul className="mt-1 space-y-0.5">
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-caption text-foreground/85 truncate">{row.label}</span>
          <span className={cn(
            'text-caption font-semibold tabular-nums shrink-0',
            row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {row.delta > 0 ? '+' : ''}{row.delta}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

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
  const playFirstHalf = useGameStore(s => s.playSundayFirstHalf);
  const finishMatch = useGameStore(s => s.finishSundayMatch);
  const arrive = useGameStore(s => s.arriveSundayMatch);
  const hireRingers = useGameStore(s => s.hireSundayRingers);
  const setScreen = useGameStore(s => s.setScreen);
  const ratings = useGameStore(s => s.matchPlayerRatings);
  const players = useGameStore(s => s.players);
  const arrival = sunday?.arrival && sunday.arrival.week === week ? sunday.arrival : null;

  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True once this mount has started a match, so the mount-time rescue below
   *  cannot fire on the pause we just created ourselves. */
  const started = useRef(false);

  const fixture = useMemo(
    () => (sunday ? findSundayFixture(sunday, fixtures, week, playerClubId) : null),
    [sunday, fixtures, week, playerClubId],
  );

  // The report for THIS week, if it has already been played. Checking the week
  // and season (not merely "is there a report") is what stops last week's match
  // being replayed on screen after an advance.
  const report = sunday?.lastMatch && sunday.lastMatch.week === week ? sunday.lastMatch : null;
  // A match paused at the break, waiting for the one decision.
  const halfTime = sunday?.halfTime && sunday.halfTime.week === week ? sunday.halfTime : null;
  // What is being revealed: the finished report once there is one, otherwise
  // the half already played. The report BEGINS with the pause's own lines, so
  // the index carries straight over when the second half arrives.
  const feed = report ? report.narrative : halfTime ? halfTime.narrative : null;

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

  // A pause that was already here when this screen mounted survived an app
  // restart, so the manager's decision is gone (see `SundayHalfTime`): finish
  // it under the tactic it kicked off with and say so, rather than pretending
  // the choice is still open and handing out a free re-roll of the half.
  useEffect(() => {
    if (started.current || !halfTime || report || kicking) return;
    started.current = true;
    setKicking(true);
    void finishMatch().then(finished => {
      setKicking(false);
      if (!finished) return;
      setRevealed(finished.narrative.length);
      toast(t('sunday.match.resumed'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal loop, with a haptic tap on each goal line as it lands.
  useEffect(() => {
    if (!playing || !feed) return;
    if (revealed >= feed.length) {
      setPlaying(false);
      if (report && report.goalsFor > report.goalsAgainst) hapticSuccess();
      return;
    }
    const line = feed[revealed] ?? '';
    const isGoal = /\d+-\d+\)/.test(line);
    if (isGoal) hapticLight();
    // A goal in a final or a decider is allowed to hang. Everything else keeps
    // the manager's chosen match speed exactly.
    const cadence = isGoal ? TIER_GOAL_CADENCE[report?.tier ?? halfTime?.tier ?? 'routine'] ?? 1 : 1;
    const delay = reduceMotion ? 0 : Math.max(120, (matchSpeed / 3300) * REVEAL_BASE_MS * cadence);
    timer.current = setTimeout(() => setRevealed(n => n + 1), delay);
    return () => clearTimer();
  }, [playing, revealed, feed, report, halfTime, matchSpeed, reduceMotion, clearTimer]);

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

  // What is riding on it. Arithmetic, not atmosphere — see `utils/sunday/tier`.
  // Computed from the table as it stands BEFORE kick-off, which is the same
  // table the store used when it stamped the tier onto the report.
  const stakes = useMemo(() => {
    if (!sunday || !fixture) return null;
    const oppId = fixture.kind === 'cup'
      ? (fixture.tie.homeClubId === playerClubId ? fixture.tie.awayClubId : fixture.tie.homeClubId)
      : (fixture.match.homeClubId === playerClubId ? fixture.match.awayClubId : fixture.match.homeClubId);
    return deriveSundayStakes({
      divisionId: sunday.divisionId,
      clubId: playerClubId,
      opponentClubId: oppId,
      fixtures,
      divisionClubIds: sunday.divisionClubIds,
      table: buildSundayTable(fixtures, sunday.divisionClubIds),
      rivalClubId: sunday.rivalry?.clubId ?? null,
      cupRound: fixture.kind === 'cup' ? fixture.tie.round : null,
    });
  }, [sunday, fixture, fixtures, playerClubId]);

  // The same breakdown the post-match panel shows, computed live from the men
  // who are actually named. Nothing is stored: it is the honest answer to
  // "what am I taking onto that pitch?" before it becomes the answer to "why
  // did that happen?".
  const preMatchAdjustments = useMemo(() => {
    if (!sunday || !fixture || report) return [];
    const named = sunday.arrival?.presentIds.length ? sunday.arrival.presentIds : sunday.teamsheet;
    const xi = named.map(id => players[id]).filter(Boolean);
    if (xi.length < SUNDAY_MIN_START) return [];
    return buildMatchdayTeam({
      xi,
      squad: sunday.squad,
      tacticId: sunday.tactic,
      pitchQuality: sundayPitchQuality(sunday, week),
      ballsLevel: sunday.upgrades.find(u => u.id === 'balls')?.level ?? 0,
      glovesLevel: sunday.upgrades.find(u => u.id === 'keeper-gloves')?.level ?? 0,
      coachLevel: sunday.upgrades.find(u => u.id === 'coach')?.level ?? 0,
      teamMorale: sunday.teamMorale,
      isPlayerClub: true,
    }).adjustments;
  }, [sunday, fixture, report, players, week]);

  // What the club already knows about this afternoon: the last time these two
  // met (score, and who settled it, off that fixture's own event array) and
  // the man one game short of a milestone. Both derived — no new state.
  const memory = useMemo(() => {
    if (!sunday || !fixture) return null;
    const oppId = fixture.kind === 'cup'
      ? (fixture.tie.homeClubId === playerClubId ? fixture.tie.awayClubId : fixture.tie.homeClubId)
      : (fixture.match.homeClubId === playerClubId ? fixture.match.awayClubId : fixture.match.homeClubId);
    const named = sunday.arrival?.presentIds.length ? sunday.arrival.presentIds : sunday.teamsheet;
    return {
      reverse: sundayReverseFixtureRecall(fixtures, playerClubId, oppId, players),
      milestone: sundayMilestoneToday(sunday.squad, players, named),
    };
  }, [sunday, fixture, fixtures, players, playerClubId]);

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

  // How they play, in touchline English. Read off the club's persisted style —
  // the same one the simulation will use — so the clue is never a lie. It says
  // what they DO and hints at an answer; it never prints the matchup matrix or
  // a number, because working it out is the game.
  const oppStyle = opponentId && clubs[opponentId]
    ? sundayStyleOf(sunday.divisionStyles, opponentId, clubs, players)
    : null;

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
    if (report || halfTime || kicking || !canKickOff) return;
    started.current = true;
    setKicking(true);
    setRevealed(0);
    // Instant is the manager saying he does not want to watch. Ninety minutes
    // in one call, no break, exactly as the weekly advance would play it.
    if (matchSpeed <= INSTANT_SPEED) {
      void playMatch().then(result => {
        setKicking(false);
        if (result) setPlaying(true);
      });
      return;
    }
    void playFirstHalf().then(result => {
      setKicking(false);
      if (result.halfTime || result.report) setPlaying(true);
    });
  };

  /** The one decision at the break. Kept as a single confirm — a tactic and a
   *  whistle, not a menu. */
  const chooseSecondHalf = (tactic: SundayTacticId) => {
    if (!halfTime || kicking) return;
    setKicking(true);
    hapticLight();
    void finishMatch(tactic).then(finished => {
      setKicking(false);
      if (finished) setPlaying(true);
    });
  };
  /**
   * The arrival decision: guests or the gap. Once, and it says so afterwards.
   *
   * The result used to be discarded — both buttons stayed live while the
   * action was in flight, and the store's own answer ("2 guests sorted. £30
   * when the whip-round settles.") was never shown to anybody.
   */
  const decideRingers = (n: number) => {
    if (deciding || arrival?.ringersHired != null) return;
    setDeciding(true);
    void hireRingers(n).then(result => {
      setDeciding(false);
      hapticLight();
      toast(result.message);
    });
  };

  const pitch = Math.round(sundayPitchQuality(sunday, week));
  const WeatherIcon = SUNDAY_WEATHER_ICON[matchWeather?.weather ?? 'clear'];
  const done = !!report && revealed >= report.narrative.length;
  // The break is only offered once the first half has finished revealing —
  // a decision on top of a feed still scrolling is a decision nobody read.
  const atTheBreak = !!halfTime && !report && !playing && revealed >= halfTime.narrative.length;
  // Names off the REPORT, not the players map: a guest can be man of the match
  // and cease to exist an hour later, which used to blank the panel entirely.
  const heroName = report?.motmPlayerId
    ? report.motmName ?? (players[report.motmPlayerId]
      ? `${players[report.motmPlayerId].firstName} ${players[report.motmPlayerId].lastName}`
      : null)
    : null;
  const villainName = report?.lowlightPlayerId
    ? report.lowlightName ?? (players[report.lowlightPlayerId]
      ? `${players[report.lowlightPlayerId].firstName} ${players[report.lowlightPlayerId].lastName}`
      : null)
    : null;
  const standing = arrival ? arrival.presentIds.length + arrival.forcedRingers : 0;

  // The tier drives the header rim and the pace of the reveal. Before kick-off
  // it comes from the live arithmetic; afterwards from the report, which was
  // stamped with the same answer at kick-off.
  const tier = stakes?.tier ?? report?.tier ?? 'routine';

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* Scoreline / fixture header */}
      <GlassPanel className={cn('p-4', TIER_RIM[tier])}>
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
          <GlassPanel className={cn('p-4 space-y-2.5', TIER_RIM[tier])}>
            <SectionHeader level="section" title={t('sunday.match.title')} />
            {stakes?.line && (
              <p className={cn(
                'text-body font-semibold leading-snug',
                tier === 'decider' || tier === 'cup-final' ? 'text-primary' : 'text-foreground',
              )}>
                {stakes.line}
              </p>
            )}
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
                          'w-5 h-5 rounded text-micro font-bold inline-flex items-center justify-center',
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
            {/* Deliberately OUTSIDE the league-only intel block above: a cup
                tie is exactly when knowing how they set up matters most. */}
            {oppStyle && (
              <p className="text-caption text-foreground/85 leading-relaxed">
                {t(`sunday.match.style.${oppStyle}`, { formation: getSundayTactic(oppStyle).formation })}
                {' '}
                <span className="text-muted-foreground">{t(`sunday.match.counter.${oppStyle}`)}</span>
              </p>
            )}
            {memory?.reverse && (
              <p className="text-caption text-foreground/85 leading-relaxed">
                <RecallIcon className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-muted-foreground" aria-hidden />
                {memory.reverse}
              </p>
            )}
            {memory?.milestone && (
              <p className="text-caption text-primary/90 leading-relaxed">{memory.milestone}</p>
            )}
            {isDerby && sunday.rivalry && (
              <p className="text-caption text-orange-300">
                {sunday.rivalry.managerName} — {sunday.rivalry.managerStyle}
                {sunday.rivalry.defector && ` ${t('sunday.rival.defector', { name: sunday.rivalry.defector.name })}`}
                {' · '}
                {t('sunday.hub.rivalRecord', {
                  w: sunday.rivalry.wins, d: sunday.rivalry.draws, l: sunday.rivalry.losses,
                })}
              </p>
            )}
            <p className={cn('text-caption', sunday.teamsheet.length >= SUNDAY_MIN_START ? 'text-muted-foreground' : 'text-amber-300')}>
              {t('sunday.match.namedSide', { n: sunday.teamsheet.length })}
            </p>
            {preMatchAdjustments.length > 0 && <AdjustmentList rows={preMatchAdjustments} label={t('sunday.match.whyPanel')} />}
          </GlassPanel>

          <LiquidButton tone="primary" className="w-full py-3" onClick={onArrive} disabled={kicking}>
            <span className="inline-flex items-center gap-1.5"><SquadIcon className="w-4 h-4" aria-hidden /> {t('sunday.arrival.title')}</span>
          </LiquidButton>
          {/* The button's own label does not say it is a one-way door, and the
              teamsheet locks behind it. */}
          <p className="text-micro text-muted-foreground leading-relaxed px-1">{t('sunday.arrival.gateHint')}</p>
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
            {/* A decision, and it stays decided. */}
            {arrival.ringersHired != null && (
              <p className="text-caption text-muted-foreground">
                {t('sunday.arrival.decided')}
                {arrival.ringersHired > 0 && (
                  <span className="text-foreground">
                    {' '}
                    {t('sunday.arrival.hire', {
                      n: arrival.ringersHired,
                      s: arrival.ringersHired === 1 ? '' : 's',
                      cost: arrival.ringersHired * SUNDAY_RINGER_COST,
                    })}
                  </span>
                )}
              </p>
            )}
          </GlassPanel>

          {shortfallPending ? (
            <GlassPanel className="p-4 space-y-2" tone="danger">
              <p className="text-body font-semibold text-amber-200 inline-flex items-center gap-1.5">
                <WarningIcon className="w-4 h-4" aria-hidden />
                {t('sunday.arrival.short', { n: arrival.optionalRingers })}
              </p>
              <LiquidButton
                tone="amber"
                className="w-full py-2.5"
                disabled={deciding || sunday.balance < arrival.optionalRingers * SUNDAY_RINGER_COST}
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
              <LiquidButton className="w-full py-2.5" disabled={deciding} onClick={() => decideRingers(0)}>
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
              <span className="inline-flex items-center gap-1.5"><KickOffIcon className="w-4 h-4" aria-hidden /> {t('sunday.match.kickOff')}</span>
            </LiquidButton>
          )}
        </>
      )}

      {/* 3 · THE MATCH */}
      {feed && (
        <GlassPanel className="p-4">
          <SectionHeader
            level="section"
            title={t('sunday.match.narrative')}
            accessory={
              !done ? (
                <button
                  type="button"
                  onClick={() => { clearTimer(); setPlaying(false); setRevealed(feed.length); }}
                  className="text-caption font-semibold text-primary inline-flex items-center gap-1 min-h-[44px] px-1"
                >
                  <SkipIcon className="w-3.5 h-3.5" aria-hidden /> {t('sunday.match.skip')}
                </button>
              ) : undefined
            }
          />
          <ul className="mt-2 space-y-2" aria-live="polite">
            {feed.slice(0, revealed).map((line, i) => {
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

      {/* 3b · HALF TIME — the one decision, and it is really simulated */}
      {atTheBreak && (
        <GlassPanel className={cn('p-4 space-y-2', TIER_RIM[tier])}>
          <SectionHeader
            level="section"
            title={t('sunday.match.halfTime')}
            accessory={
              // HOME-AWAY, like the header above it and like the `HT x-y`
              // marker in the feed. The report stores the score from the
              // club's own point of view, and printing that here made the
              // panel read 0-1 under a feed that had just said HT 1-0.
              <span className="text-h3 font-display font-bold tabular-nums text-foreground">
                {isHome
                  ? `${halfTime!.goalsFor}-${halfTime!.goalsAgainst}`
                  : `${halfTime!.goalsAgainst}-${halfTime!.goalsFor}`}
              </span>
            }
          />
          <p className="text-caption text-muted-foreground">{t('sunday.match.halfTimeHint')}</p>
          <div className="space-y-1.5">
            {SUNDAY_TACTICS.map(option => {
              const current = option.id === halfTime!.tactic;
              const fitPct = Math.round((halfTime!.tacticFit[option.id] ?? 0.5) * 100);
              return (
                <LiquidButton
                  key={option.id}
                  tone={current ? 'primary' : undefined}
                  className="w-full py-2.5"
                  disabled={kicking}
                  onClick={() => chooseSecondHalf(option.id)}
                >
                  <span className="flex items-center gap-2 w-full text-left">
                    <span className="min-w-0 flex-1 text-body font-semibold truncate">
                      {option.name}
                      {current && <span className="text-micro text-muted-foreground"> · {t('sunday.match.asWeAre')}</span>}
                    </span>
                    <span className="text-caption tabular-nums text-muted-foreground shrink-0">
                      {fitPct}% {t('sunday.match.fit')}
                    </span>
                  </span>
                </LiquidButton>
              );
            })}
          </div>
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
              {heroName && (
                <div className="flex items-start gap-2">
                  <HeroIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.hero')}: </span>
                    {heroName} · {report.motmRating.toFixed(1)}
                  </p>
                </div>
              )}
              {villainName && report.lowlightPlayerId !== report.motmPlayerId && (
                <div className="flex items-start gap-2">
                  <LowlightIcon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.lowlight')}: </span>
                    {villainName} · {report.lowlightRating.toFixed(1)}
                  </p>
                </div>
              )}
              {report.moraleDelta !== 0 && (
                <div className="flex items-start gap-2">
                  <SquadIcon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.morale')}: </span>
                    <span className={cn('tabular-nums font-semibold', report.moraleDelta > 0 ? 'text-emerald-300' : 'text-destructive')}>
                      {report.moraleDelta > 0 ? '+' : ''}{report.moraleDelta}
                    </span>
                  </p>
                </div>
              )}
              {report.turningPoint && (
                <div className="flex items-start gap-2">
                  <TurningPointIcon className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-caption text-foreground">
                    <span className="text-muted-foreground">{t('sunday.story.turningPoint')}: </span>
                    {report.turningPoint}
                  </p>
                </div>
              )}
              {report.consequences.length > 0 && (
                <div className="flex items-start gap-2">
                  <ConsequenceIcon className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden />
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

          {report.adjustments.length > 0 && (
            <GlassPanel className="p-4">
              <AdjustmentList rows={report.adjustments} label={t('sunday.match.whyPanel')} />
            </GlassPanel>
          )}

          {(ratings.length > 0 || report.guestRatings.length > 0) && (
            <GlassPanel className="p-4">
              <SectionHeader level="section" title={t('sunday.match.ratings')} icon={RatingsIcon} />
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
                {/* The guests, who are gone from the squad by now but earned
                    their ratings on the same afternoon. */}
                {report.guestRatings.map((g, i) => (
                  <div key={`guest-${i}`} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 text-body text-foreground truncate">
                      {g.name} <span className="text-micro text-muted-foreground">· {t('sunday.story.guests')}</span>
                    </span>
                    {g.goals > 0 && <span className="text-micro text-emerald-300">{g.goals}G</span>}
                    {g.assists > 0 && <span className="text-micro text-sky-300">{g.assists}A</span>}
                    <span className={cn(
                      'text-caption font-semibold tabular-nums w-8 text-right',
                      g.rating >= 7.5 ? 'text-emerald-300' : g.rating >= 6 ? 'text-foreground' : 'text-destructive',
                    )}>
                      {g.rating.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}

          {isDerby && (
            <GlassPanel className="p-3">
              <p className="text-caption text-orange-300 inline-flex items-center gap-1.5">
                {/* The derby, not a trophy. This was `Trophy`, which on a
                    screen that also shows the cup read as "you have won
                    something". `Swords` is the rivalry glyph everywhere else. */}
                <RivalIcon className="w-3.5 h-3.5" aria-hidden />
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
