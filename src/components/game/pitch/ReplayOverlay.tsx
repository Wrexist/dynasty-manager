import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import type { MatchTimeline, PitchQuality } from '@/types/game';
import { PitchCanvas } from './PitchCanvas';

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
  onDone: () => void;
}

const STEP_MS = 650;

export function ReplayOverlay({ timeline, quality, homeColor, awayColor, from, to, flip, orientation, showOverall, reducedMotion, onDone }: ReplayOverlayProps) {
  const [minute, setMinute] = useState(from);

  useEffect(() => {
    let m = from;
    const id = setInterval(() => {
      m += 1;
      if (m > to) {
        clearInterval(id);
        setTimeout(onDone, 900);
        return;
      }
      setMinute(m);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [from, to, onDone]);

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
        className="absolute inset-0 h-full w-full"
      />
      {/* Broadcast letterbox bars. */}
      {!reducedMotion && (
        <>
          <motion.div className="pointer-events-none absolute inset-x-0 top-0 bg-black" initial={{ height: 0 }} animate={{ height: '8%' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} />
          <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black" initial={{ height: 0 }} animate={{ height: '8%' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} />
        </>
      )}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 backdrop-blur-md border border-border/40">
        <RotateCcw className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground">Replay</span>
      </div>
      <button
        onClick={onDone}
        className="absolute bottom-2 right-2 rounded-full bg-card/80 px-3 py-1 text-[10px] font-semibold text-foreground backdrop-blur-md border border-border/40 active:scale-95"
      >
        Skip
      </button>
    </motion.div>
  );
}
