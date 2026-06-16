import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Club, Match, MatchEvent, Player, TacticalInstructions } from '@/types/game';
import { buildMatchTimeline } from '@/engine/match/choreography';
import { latestGoalAt } from '@/engine/match/pitchFrame';
import { detectPitchQuality, webglSupported } from '@/utils/pitchQuality';
import { areColorsSimilar } from '@/utils/uiHelpers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PitchCanvas } from './PitchCanvas';
import { GoalCelebration } from './GoalCelebration';
import { WeatherOverlay } from './WeatherOverlay';

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
  reducedMotion?: boolean;
}

const CAPTIONED_TYPES = new Set<MatchEvent['type']>([
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'header_goal', 'solo_goal',
  'long_range_goal', 'counter_attack_goal', 'free_kick_goal', 'extra_time_goal',
  'shot_saved', 'shot_missed', 'hit_woodwork', 'goal_line_clearance', 'goalkeeper_error',
  'yellow_card', 'red_card', 'foul', 'injury', 'substitution', 'var_check', 'var_disallowed',
]);

interface Celebration { key: string; color: string; text: string; minute: string }

export default function PitchView({
  match, homeClub, awayClub, events, minute, playerIsHome, homeTactics, awayTactics, players, orientation = 'portrait', reducedMotion,
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

  // Fire a celebration + haptic the moment a *new* goal becomes visible. The
  // first pass only records the baseline so pre-existing goals don't replay
  // (e.g. when entering the second half).
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const initRef = useRef(false);
  const lastGoalKeyRef = useRef<string | null>(null);

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
      const color = g.clubId === homeClub.id ? homeColor : awayColor;
      setCelebration({ key, color: color || '#f5b915', text: g.description, minute: g.displayMinute || `${g.minute}'` });
    }
  }, [events, minute, homeClub.id, homeColor, awayColor]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-black/20" style={{ aspectRatio: landscape ? '104 / 64' : '68 / 104' }}>
      {useWebgl ? (
        <ErrorBoundary fallback={() => (
          <PitchCanvas timeline={timeline} minute={minute} quality={quality} homeColor={homeColor} awayColor={awayColor} orientation={orientation} flip={!playerIsHome} reducedMotion={reducedMotion} className="absolute inset-0 h-full w-full" />
        )}>
          <Suspense fallback={
            <PitchCanvas timeline={timeline} minute={minute} quality={quality} homeColor={homeColor} awayColor={awayColor} orientation={orientation} flip={!playerIsHome} reducedMotion={reducedMotion} className="absolute inset-0 h-full w-full" />
          }>
            <PixiPitch
              timeline={timeline}
              minute={minute}
              quality={quality}
              homeColor={homeColor}
              awayColor={awayColor}
              flip={!playerIsHome}
              reducedMotion={reducedMotion}
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
          orientation={orientation}
          flip={!playerIsHome}
          reducedMotion={reducedMotion}
          className="absolute inset-0 h-full w-full"
        />
      )}

      <WeatherOverlay weather={match.weather?.weather} density={quality.weatherScale} reducedMotion={reducedMotion} />

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

      <AnimatePresence>
        {celebration && (
          <GoalCelebration
            key={celebration.key}
            color={celebration.color}
            text={celebration.text}
            minute={celebration.minute}
            confettiCount={quality.confetti}
            reducedMotion={reducedMotion}
            onDone={() => setCelebration(null)}
          />
        )}
      </AnimatePresence>

      {caption && !celebration && (
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
