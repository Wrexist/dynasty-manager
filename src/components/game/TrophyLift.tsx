/**
 * Trophy-lift badge (G4) — the champion's trophy rises, settles, then breathes
 * with a soft gold glow. Extracted from the World Cup result screen so the
 * same ceremony visual is reused for domestic league / cup triumphs.
 *
 * Purely presentational. Pass the trophy icon as `icon` and the win state as
 * `gold` (a non-gold badge renders static, e.g. a runners-up medal).
 *
 * Reduced motion is checked explicitly via `useReducedMotionPref`, NOT left to
 * the global MotionConfig: `reducedMotion="always"` suppresses transforms but
 * not opacity, so the infinite glow pulse below kept looping in the player's
 * field of view for anyone who had asked for less motion.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

export function TrophyLift({ gold, icon, className }: {
  gold: boolean;
  icon: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotionPref();
  const animated = gold && !reduceMotion;
  return (
    <motion.div
      className={cn(
        'relative mx-auto w-20 h-24 rounded-2xl flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]',
        gold ? 'bg-gradient-to-b from-amber-400/40 to-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-foreground/70',
        className,
      )}
      initial={animated ? { y: 28, scale: 0.6, rotate: -8, opacity: 0 } : false}
      animate={animated ? { y: 0, scale: 1, rotate: 0, opacity: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
    >
      {gold && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: '0 0 28px 4px hsl(43 96% 55% / 0.55)', opacity: animated ? undefined : 0.55 }}
          animate={animated ? { opacity: [0.35, 0.8, 0.35] } : undefined}
          transition={animated ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 } : undefined}
        />
      )}
      <motion.span
        className="relative"
        animate={animated ? { y: [0, -3, 0] } : undefined}
        transition={animated ? { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.8 } : undefined}
      >
        {icon}
      </motion.span>
    </motion.div>
  );
}
