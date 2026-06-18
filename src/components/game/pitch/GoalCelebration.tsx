import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Broadcast goal moment: a stadium flash + club-coloured wash, a confetti burst,
// a big "GOAL!" and a broadcast lower-third with the new scoreline + scorer.
// Under reduced-motion it collapses to a brief, calm card.

interface GoalCelebrationProps {
  color: string;
  /** Fallback caption (commentary) when structured data isn't supplied. */
  text: string;
  minute: string;
  scorer?: string;
  homeShort?: string;
  awayShort?: string;
  homeGoals?: number;
  awayGoals?: number;
  scoredByHome?: boolean;
  /** Confetti piece count (from the resolved quality tier). 0 = none. */
  confettiCount?: number;
  reducedMotion?: boolean;
  onDone: () => void;
}

const DURATION_MS = 2600;
const REDUCED_MS = 1400;

export function GoalCelebration({
  color, text, minute, scorer, homeShort, awayShort, homeGoals, awayGoals, scoredByHome,
  confettiCount = 16, reducedMotion, onDone,
}: GoalCelebrationProps) {
  useEffect(() => {
    const id = setTimeout(onDone, reducedMotion ? REDUCED_MS : DURATION_MS);
    return () => clearTimeout(id);
  }, [onDone, reducedMotion]);

  const confetti = useMemo(
    () => (reducedMotion ? [] : Array.from({ length: Math.max(0, confettiCount) }, (_, i) => ({
      left: 30 + Math.random() * 40, // cluster toward centre → reads as a burst
      delay: Math.random() * 0.18,
      hue: i % 3,
      rotate: Math.random() * 360,
      drift: (Math.random() * 2 - 1) * 40,
    }))),
    [reducedMotion, confettiCount],
  );

  const hasCard = homeShort != null && awayShort != null && homeGoals != null && awayGoals != null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {!reducedMotion && (
        <>
          {/* Stadium flash bloom. */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.85), rgba(255,255,255,0) 60%)' }}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {/* Club-colour wash. */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: color }}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </>
      )}

      {confetti.map((c, i) => (
        <motion.div
          key={i}
          className="absolute top-0 h-2 w-1.5 rounded-sm"
          style={{ left: `${c.left}%`, backgroundColor: c.hue === 0 ? color : c.hue === 1 ? '#f5b915' : '#ffffff' }}
          initial={{ y: -20, x: 0, opacity: 1, rotate: c.rotate }}
          animate={{ y: '120%', x: c.drift, opacity: 0, rotate: c.rotate + 220 }}
          transition={{ duration: 1.7, delay: c.delay, ease: 'easeIn' }}
        />
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
        <motion.p
          className="font-[Oswald,sans-serif] text-5xl font-extrabold uppercase tracking-tight text-primary drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
          initial={reducedMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        >
          Goal!
        </motion.p>

        {hasCard ? (
          <motion.div
            className="mt-2 flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <div className="flex items-center gap-2.5 rounded-lg bg-card/85 px-3 py-1.5 backdrop-blur-md border border-border/50">
              <span className={cn('text-xs font-bold', scoredByHome ? 'text-primary' : 'text-foreground/60')}>{homeShort}</span>
              <span className="font-[Oswald,sans-serif] text-xl font-extrabold tabular-nums text-foreground">{homeGoals}<span className="mx-0.5 text-foreground/50">–</span>{awayGoals}</span>
              <span className={cn('text-xs font-bold', scoredByHome ? 'text-foreground/60' : 'text-primary')}>{awayShort}</span>
            </div>
            {scorer && (
              <div className="rounded-md bg-card/70 px-2 py-0.5 backdrop-blur-md border border-border/40">
                <span className="text-[10px] font-semibold text-foreground">⚽ {scorer}<span className="ml-1.5 tabular-nums text-primary">{minute}</span></span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="mt-1 rounded-lg bg-card/80 px-3 py-1 backdrop-blur-md border border-border/40"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <p className="text-center text-[11px] leading-snug text-foreground">
              <span className="mr-1.5 font-bold tabular-nums text-primary">{minute}</span>
              {text}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
