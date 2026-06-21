import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Club, Match, MatchEvent, Player, TacticalInstructions } from '@/types/game';
import { buildMatchTimeline } from '@/engine/match/choreography';
import { latestGoalAt } from '@/engine/match/pitchFrame';
import { GOAL_SCORING_TYPES } from '@/config/matchEngine';
import { detectPitchQuality, webglSupported } from '@/utils/pitchQuality';
import { areColorsSimilar } from '@/utils/uiHelpers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { PitchCanvas, type PitchHitTarget } from './PitchCanvas';
import { GoalCelebration } from './GoalCelebration';
import { WeatherOverlay } from './WeatherOverlay';
import { ReplayOverlay } from './ReplayOverlay';

// WebGL tier is lazy: its pixi chunk only loads on capable devices.
const PixiPitch = lazy(() => import('./PixiPitch'));

// Live 2.5D pitch panel. Builds a deterministic MatchTimeline from the events
// revealed so far and renders it via PitchCanvas, with a broadcast caption,
// goal celebrations + haptics, and weather ambience. Lazy-loaded by MatchDay.

interface PitchViewProps {
  match: Match;
  homeClub: Club;
  awayClub: Club;
  /** Events revealed so far (a growing prefix during live play). */
  events: MatchEvent[];
  minute: number;
  /** True when the human manager's club is the home side. */
  playerIsHome: boolean;
  /** Resolved per-side tactics (player club = live tactics, opponent = AI default). */
  homeTactics?: TacticalInstructions;
  awayTactics?: TacticalInstructions;
  /** Player lookup so shooting/passing attributes shape the choreography. */
  players?: Record<string, Player>;
  /** 'landscape' renders a short, wide sideways pitch (used in split view). */
  orientation?: 'portrait' | 'landscape';
  /** Show player overall on the chip instead of the shirt number. */
  showOverall?: boolean;
  reducedMotion?: boolean;
  /** Wall-clock ms per match minute (live match speed) — paces the pitch so
   *  player motion stays continuous at every speed. */
  msPerMinute?: number;
}

const CAPTIONED_TYPES = new Set<MatchEvent['type']>([
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'header_goal', 'solo_goal',
  'long_range_goal', 'counter_attack_goal', 'free_kick_goal', 'extra_time_goal',
  'shot_saved', 'shot_missed', 'hit_woodwork', 'goal_line_clearance', 'goalkeeper_error',
  'yellow_card', 'red_card', 'foul', 'injury', 'substitution', 'var_check', 'var_disallowed',
]);

interface Celebration {
  key: string; color: string; text: string; minute: string;
  scorer?: string; homeShort: string; awayShort: string; homeGoals: number; awayGoals: number; scoredByHome: boolean;
}

const SCORING_TYPES = new Set<MatchEvent['type']>(GOAL_SCORING_TYPES as unknown as MatchEvent['type'][]);

// A 3-letter broadcast code from a club's short name (e.g. "Arsenal" → "ARS").
const teamCode = (s: string) => (s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '—';

// Two-tone glossy crest disc for the score bug — a club-coloured disc with a
// light top-left sheen and a dark lower-right, so it reads as a crest rather
// than a flat dot. Pure CSS, no colour maths.
function ScoreCrest({ color }: { color: string }) {
  return (
    <span className="relative h-3 w-3 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: color || '#888888' }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 46%, rgba(0,0,0,0.38) 100%)' }}
      />
    </span>
  );
}

export default function PitchView({
  match, homeClub, awayClub, events, minute, playerIsHome, homeTactics, awayTactics, players, orientation = 'portrait', showOverall, reducedMotion, msPerMinute,
}: PitchViewProps) {
  const landscape = orientation === 'landscape';
  const quality = useMemo(() => detectPitchQuality(!!reducedMotion), [reducedMotion]);

  // Use the WebGL "Stunning" tier only on capable hardware; auto-fall back to
  // Canvas if Pixi fails to init or throws at runtime.
  const [pixiFailed, setPixiFailed] = useState(false);
  // Landscape (split view) uses the Canvas renderer — Pixi is portrait-only.
  const canUseWebgl = useMemo(() => quality.tier === 'high' && webglSupported(), [quality.tier]);
  const useWebgl = canUseWebgl && !pixiFailed && !landscape;

  // Kit-clash legibility: if the two kits are too close, force the away side to
  // a light neutral so chips stay distinguishable (mirrors the momentum bar).
  const homeColor = homeClub.color;
  const awayColor = useMemo(
    () => (areColorsSimilar(homeClub.color, awayClub.color) ? '#e2e8f0' : awayClub.color),
    [homeClub.color, awayClub.color],
  );

  // Rebuild as more events reveal; seed is id-stable so shown beats don't jump.
  const timeline = useMemo(
    () => buildMatchTimeline({ ...match, events }, homeClub, awayClub, {
      tactics: homeTactics && awayTactics ? { home: homeTactics, away: awayTactics } : undefined,
      players,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match.id, events.length, homeClub.id, awayClub.id, homeClub.formation, awayClub.formation, homeTactics, awayTactics],
  );

  // Most recent captionable event at or before the current minute.
  const caption = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.minute <= minute && CAPTIONED_TYPES.has(e.type)) {
        return { minute: e.displayMinute || `${e.minute}'`, text: e.description };
      }
    }
    return null;
  }, [events, minute]);

  // Running scoreline at the revealed minute, for the broadcast score bug.
  const score = useMemo(() => {
    let hg = 0;
    let ag = 0;
    for (const e of events) {
      if (e.minute <= minute && SCORING_TYPES.has(e.type)) {
        if (e.clubId === homeClub.id) hg++; else ag++;
      }
    }
    return { hg, ag };
  }, [events, minute, homeClub.id]);

  // Tap-to-inspect: the renderer publishes the current frame's chip screen
  // positions here; a tap on the pitch is hit-tested against them.
  const containerRef = useRef<HTMLDivElement>(null);
  const hitTargetsRef = useRef<PitchHitTarget[] | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspectPlayer = inspectId ? players?.[inspectId] : undefined;
  const inspectIsHome = !!(inspectId && homeClub.playerIds?.includes(inspectId));

  // Tactical-wide toggle: pull the camera back to the whole pitch (pauses the
  // broadcast follow-cam). Mirrored into a ref the renderer reads each frame.
  const [tacticalWide, setTacticalWide] = useState(false);
  const tacticalWideRef = useRef(false);
  tacticalWideRef.current = tacticalWide;

  // Fire a celebration + haptic the moment a *new* goal becomes visible. The
  // first pass only records the baseline so pre-existing goals don't replay
  // (e.g. when entering the second half).
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const initRef = useRef(false);
  const lastGoalKeyRef = useRef<string | null>(null);

  // Goal replay: re-run the most recent goal's beats in an overlay.
  const [replay, setReplay] = useState<{ from: number; to: number } | null>(null);
  const autoReplayedRef = useRef<string | null>(null);
  const lastGoal = useMemo(() => latestGoalAt(events, minute), [events, minute]);

  // Brief "you attack this way" cue at kickoff.
  const [showDir, setShowDir] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setShowDir(false), 4200);
    return () => clearTimeout(id);
  }, []);
  const playerClub = playerIsHome ? homeClub : awayClub;
  useEffect(() => {
    const g = latestGoalAt(events, minute);
    const key = g ? `${g.minute}-${g.type}-${g.playerId ?? ''}` : null;
    if (!initRef.current) {
      initRef.current = true;
      lastGoalKeyRef.current = key;
      return;
    }
    if (g && key && key !== lastGoalKeyRef.current) {
      lastGoalKeyRef.current = key;
      // Haptics are owned by MatchDay (success if you scored, heavy if conceded);
      // firing here too would double-buzz and ignore the success/heavy split.
      const scoredByHome = g.clubId === homeClub.id;
      const color = scoredByHome ? homeColor : awayColor;
      // Running scoreline at this goal (own goals/keeper errors credited to clubId).
      const gi = events.indexOf(g);
      let hg = 0;
      let ag = 0;
      for (let i = 0; i <= gi; i++) {
        const e = events[i];
        if (SCORING_TYPES.has(e.type)) { if (e.clubId === homeClub.id) hg++; else ag++; }
      }
      setCelebration({
        key, color: color || '#f5b915', text: g.description, minute: g.displayMinute || `${g.minute}'`,
        scorer: g.playerId ? players?.[g.playerId]?.lastName : undefined,
        homeShort: homeClub.shortName, awayShort: awayClub.shortName, homeGoals: hg, awayGoals: ag, scoredByHome,
      });
      setInspectId(null); // a goal interrupts any open inspect card
    }
  }, [events, minute, homeClub.id, homeClub.shortName, awayClub.shortName, homeColor, awayColor, players]);

  // Hit-test a tap on the pitch against the renderer's published chip positions.
  // A hit opens the inspect card; tapping empty turf dismisses it. Suppressed
  // while a celebration or replay overlay owns the pitch.
  const handlePitchPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (celebration || replay) return;
    const targets = hitTargetsRef.current;
    const el = containerRef.current;
    if (!targets || !el) { setInspectId(null); return; }
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: { id: string; d: number } | null = null;
    for (const t of targets) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= t.r && (!best || d < best.d)) best = { id: t.id, d };
    }
    setInspectId(best && players?.[best.id] ? best.id : null);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePitchPointer}
      role="group"
      aria-label={`Live match pitch, ${homeClub.shortName} versus ${awayClub.shortName}`}
      className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-black/20"
      style={{ aspectRatio: landscape ? '104 / 64' : '68 / 104' }}
    >
      {/* Text path for the aria-hidden canvas: announce each new commentary line. */}
      <div className="sr-only" role="status" aria-live="polite">
        {caption ? `${caption.minute} ${caption.text}` : `${teamCode(homeClub.shortName)} ${score.hg}, ${teamCode(awayClub.shortName)} ${score.ag}`}
      </div>
      {useWebgl ? (
        <ErrorBoundary fallback={() => (
          <PitchCanvas timeline={timeline} minute={minute} quality={quality} homeColor={homeColor} awayColor={awayColor} showOverall={showOverall} orientation={orientation} flip={!playerIsHome} reducedMotion={reducedMotion} msPerMinute={msPerMinute} hitTargetsRef={hitTargetsRef} tacticalWideRef={tacticalWideRef} className="absolute inset-0 h-full w-full" />
        )}>
          <Suspense fallback={
            <PitchCanvas timeline={timeline} minute={minute} quality={quality} homeColor={homeColor} awayColor={awayColor} showOverall={showOverall} orientation={orientation} flip={!playerIsHome} reducedMotion={reducedMotion} msPerMinute={msPerMinute} className="absolute inset-0 h-full w-full" />
          }>
            <PixiPitch
              timeline={timeline}
              minute={minute}
              quality={quality}
              homeColor={homeColor}
              awayColor={awayColor}
              showOverall={showOverall}
              flip={!playerIsHome}
              reducedMotion={reducedMotion}
              msPerMinute={msPerMinute}
              hitTargetsRef={hitTargetsRef}
              tacticalWideRef={tacticalWideRef}
              onError={() => setPixiFailed(true)}
              className="absolute inset-0 h-full w-full"
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <PitchCanvas
          timeline={timeline}
          minute={minute}
          quality={quality}
          homeColor={homeColor}
          awayColor={awayColor}
          showOverall={showOverall}
          orientation={orientation}
          flip={!playerIsHome}
          reducedMotion={reducedMotion}
          msPerMinute={msPerMinute}
          hitTargetsRef={hitTargetsRef}
          tacticalWideRef={tacticalWideRef}
          className="absolute inset-0 h-full w-full"
        />
      )}

      <WeatherOverlay weather={match.weather?.weather} pitch={match.weather?.pitch} density={quality.weatherScale} reducedMotion={reducedMotion} />

      {/* Broadcast score bug — clock + crests + running scoreline, overlaid on
          the live pitch (the big panel stays for pre/HT/FT in MatchDay). */}
      <div className="pointer-events-none absolute left-2 top-2 z-[6] flex items-center gap-1.5 rounded-md border border-border/40 bg-card/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
        <ScoreCrest color={homeColor} />
        <span className="text-[11px] font-bold tracking-tight text-foreground">{teamCode(homeClub.shortName)}</span>
        <span className="px-0.5 text-sm font-extrabold leading-none tabular-nums text-foreground">{score.hg}</span>
        <span className="text-[10px] leading-none text-muted-foreground">–</span>
        <span className="px-0.5 text-sm font-extrabold leading-none tabular-nums text-foreground">{score.ag}</span>
        <span className="text-[11px] font-bold tracking-tight text-foreground">{teamCode(awayClub.shortName)}</span>
        <ScoreCrest color={awayColor} />
        <span className="ml-0.5 rounded bg-primary/15 px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-primary">{minute}'</span>
      </div>

      {/* Tactical-wide / broadcast-follow camera toggle. */}
      {!reducedMotion && !celebration && !replay && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTacticalWide((v) => !v)}
          className="absolute left-2 top-11 z-[6] flex items-center gap-1 rounded-full border border-border/40 bg-card/80 px-2 py-1 backdrop-blur-md active:scale-95"
          aria-label={tacticalWide ? 'Switch to broadcast camera' : 'Switch to tactical wide view'}
          aria-pressed={tacticalWide}
        >
          {tacticalWide ? <Minimize2 className="h-3 w-3 text-primary" /> : <Maximize2 className="h-3 w-3 text-primary" />}
          <span className="text-[10px] font-semibold text-foreground">{tacticalWide ? 'Follow' : 'Wide'}</span>
        </button>
      )}

      <AnimatePresence>
        {showDir && (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-1 rounded-full bg-card/75 px-2.5 py-1 backdrop-blur-md border border-border/40">
              <span className="text-[10px] font-semibold text-foreground">{playerClub.shortName} attack</span>
              <span className="text-primary text-xs leading-none">{landscape ? '→' : '↑'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replay last goal — hidden during a celebration or an active replay. */}
      {lastGoal && !celebration && !replay && (
        <button
          onClick={() => setReplay({ from: Math.max(0, lastGoal.minute - 3), to: lastGoal.minute + 1 })}
          className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-card/75 px-2.5 py-1 backdrop-blur-md border border-border/40 active:scale-95"
          aria-label="Replay last goal"
        >
          <RotateCcw className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-foreground">Replay</span>
        </button>
      )}

      <AnimatePresence>
        {replay && (
          <ReplayOverlay
            timeline={timeline}
            quality={quality}
            homeColor={homeColor}
            awayColor={awayColor}
            showOverall={showOverall}
            from={replay.from}
            to={replay.to}
            flip={!playerIsHome}
            orientation={orientation}
            reducedMotion={reducedMotion}
            onDone={() => setReplay(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebration && (
          <GoalCelebration
            key={celebration.key}
            color={celebration.color}
            text={celebration.text}
            minute={celebration.minute}
            scorer={celebration.scorer}
            homeShort={celebration.homeShort}
            awayShort={celebration.awayShort}
            homeGoals={celebration.homeGoals}
            awayGoals={celebration.awayGoals}
            scoredByHome={celebration.scoredByHome}
            confettiCount={quality.confetti}
            reducedMotion={reducedMotion}
            onDone={() => {
              const done = celebration;
              setCelebration(null);
              // Auto-replay the goal once (broadcast rhythm), unless reduced motion.
              if (done && !reducedMotion && lastGoal && autoReplayedRef.current !== done.key) {
                autoReplayedRef.current = done.key;
                setReplay({ from: Math.max(0, lastGoal.minute - 3), to: lastGoal.minute + 1 });
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Tap-to-inspect mini-card — the only text path for the (aria-hidden)
          pitch, so it's announced politely. Takes the bottom slot over the caption. */}
      {inspectId && inspectPlayer && !celebration && !replay && (
        <div className="absolute inset-x-0 bottom-0 z-[8] p-2" aria-live="polite">
          <div className="pointer-events-auto mx-auto flex max-w-[94%] items-center gap-2.5 rounded-lg border border-border/50 bg-card/90 px-3 py-2 shadow-xl backdrop-blur-md">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-black/30"
              style={{ backgroundColor: (inspectIsHome ? homeColor : awayColor) || '#888888' }}
            >
              {inspectPlayer.position}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight text-foreground">{inspectPlayer.firstName} {inspectPlayer.lastName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{inspectPlayer.position} · Age {inspectPlayer.age} · {inspectPlayer.nationality}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">OVR</p>
              <p className="text-lg font-extrabold leading-none text-primary">{inspectPlayer.overall}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Fit</p>
              <p className="text-sm font-bold leading-none text-foreground tabular-nums">{Math.round(inspectPlayer.fitness)}%</p>
            </div>
            <button onClick={() => setInspectId(null)} className="ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold text-muted-foreground active:scale-90" aria-label="Close player card">✕</button>
          </div>
        </div>
      )}

      {caption && !celebration && !inspectId && (
        <div className="absolute inset-x-0 bottom-0 p-2">
          <div className="mx-auto max-w-[92%] rounded-lg bg-card/70 px-3 py-1.5 backdrop-blur-md border border-border/40">
            <p className="text-[11px] leading-snug text-foreground">
              <span className="font-bold text-primary tabular-nums mr-1.5">{caption.minute}</span>
              {caption.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
