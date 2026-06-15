import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

// Broadcast goal moment: a club-coloured screen flash, a confetti burst and a
// big "GOAL!" lower-third. Rendered inside the pitch panel above the canvas.
// Under reduced-motion it collapses to a brief, calm caption.

interface GoalCelebrationProps {
  color: string;
  text: string;
  minute: string;
  reducedMotion?: boolean;
  onDone: () => void;
}

const DURATION_MS = 2600;
const REDUCED_MS = 1400;

export function GoalCelebration({ color, text, minute, reducedMotion, onDone }: GoalCelebrationProps) {
  useEffect(() => {
    const id = setTimeout(onDone, reducedMotion ? REDUCED_MS : DURATION_MS);
    return () => clearTimeout(id);
  }, [onDone, reducedMotion]);

  const confetti = useMemo(
    () => (reducedMotion ? [] : Array.from({ length: 16 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      hue: i % 3,
      rotate: Math.random() * 360,
    }))),
    [reducedMotion],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {!reducedMotion && (
        <motion.div
          className="absolute inset-0"
          style={{ backgroundColor: color }}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}

      {confetti.map((c, i) => (
        <motion.div
          key={i}
          className="absolute top-0 h-2 w-1.5 rounded-sm"
          style={{ left: `${c.left}%`, backgroundColor: c.hue === 0 ? color : c.hue === 1 ? '#f5b915' : '#ffffff' }}
          initial={{ y: -20, opacity: 1, rotate: c.rotate }}
          animate={{ y: '120%', opacity: 0, rotate: c.rotate + 220 }}
          transition={{ duration: 1.8, delay: c.delay, ease: 'easeIn' }}
        />
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.p
          className="font-[Oswald,sans-serif] text-5xl font-extrabold uppercase tracking-tight text-primary drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
          initial={reducedMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        >
          Goal!
        </motion.p>
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
      </div>
    </div>
  );
}
