import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import type { Player, MatchTimeline, PitchQuality } from '@/types/game';
import { PitchCanvas, type PitchHitTarget, type PitchTokenStyle } from './PitchCanvas';
import { PitchCardLayer } from './PitchCardLayer';

// Lightweight goal replay: re-runs just the goal's beats on a fresh PitchCanvas
// seeded at `from`, advancing a local minute up to `to`. Reuses the Canvas
// renderer untouched, so it never interferes with the live playhead.

interface ReplayOverlayProps {
  timeline: MatchTimeline;
  quality: PitchQuality;
  homeColor: string;
  awayColor: string;
  from: number;
  to: number;
  flip?: boolean;
  orientation?: 'portrait' | 'landscape';
  showOverall?: boolean;
  reducedMotion?: boolean;
  /** Cards mode: replay with player cards, like the live pitch. */
  tokenStyle?: PitchTokenStyle;
  players?: Record<string, Player>;
  onDone: () => void;
}

const STEP_MS = 650;

export function ReplayOverlay({ timeline, quality, homeColor, awayColor, from, to, flip, orientation, showOverall, reducedMotion, tokenStyle = 'chips', players, onDone }: ReplayOverlayProps) {
  const hitTargetsRef = useRef<PitchHitTarget[] | null>(null);
  const [minute, setMinute] = useState(from);
  // Read through a ref: the parent passes a fresh `onDone` every match minute,
  // and keying the effect on it restarted the replay from `from` on each tick,
  // so a replay longer than one minute of play looped until skipped.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let m = from;
    // The trailing timeout has to be cancellable too: it is scheduled INSIDE
    // the interval callback, so unmounting during its 900ms window — leaving
    // the pitch view as a replay finishes — fired `onDone` on a torn-down tree.
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      m += 1;
      if (m > to) {
        clearInterval(id);
        doneTimer = setTimeout(() => onDoneRef.current(), 900);
        return;
      }
      setMinute(m);
    }, STEP_MS);
    return () => { clearInterval(id); if (doneTimer !== undefined) clearTimeout(doneTimer); };
  }, [from, to]);

  return (
    <motion.div
      className="absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PitchCanvas
        timeline={timeline}
        minute={minute}
        startMinute={from}
        quality={quality}
        homeColor={homeColor}
        awayColor={awayColor}
        showOverall={showOverall}
        orientation={orientation}
        flip={flip}
        reducedMotion={reducedMotion}
        tokenStyle={tokenStyle}
        hitTargetsRef={hitTargetsRef}
        className="absolute inset-0 h-full w-full"
      />
      {tokenStyle === 'cards' && (
        <PitchCardLayer hitTargetsRef={hitTargetsRef} players={players} homeColor={homeColor} awayColor={awayColor} />
      )}
      {/* Broadcast letterbox bars. */}
      {!reducedMotion && (
        <>
          <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-[3] bg-black" initial={{ height: 0 }} animate={{ height: '8%' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} />
          <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-black" initial={{ height: 0 }} animate={{ height: '8%' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} />
        </>
      )}
      <div className="absolute left-2 top-2 z-[4] flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 backdrop-blur-md border border-border/40">
        <RotateCcw className="h-3 w-3 text-primary" />
        <span className="text-micro font-bold uppercase tracking-wide text-foreground">Replay</span>
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDone}
        className="absolute bottom-2 right-2 z-[4] rounded-full bg-card/80 px-3 py-1 text-micro font-semibold text-foreground backdrop-blur-md border border-border/40 active:scale-95 before:absolute before:-inset-3 before:content-['']"
      >
        Skip
      </button>
    </motion.div>
  );
}
