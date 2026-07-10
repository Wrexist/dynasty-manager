/**
 * Trophy-lift badge (G4) — the champion's trophy rises, settles, then breathes
 * with a soft gold glow. Extracted from the World Cup result screen so the
 * same ceremony visual is reused for domestic league / cup triumphs.
 *
 * Purely presentational. The float/pulse loops honour reduced-motion via the
 * global MotionConfig. Pass the trophy icon as `icon` and the win state as
 * `gold` (a non-gold badge renders static, e.g. a runners-up medal).
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TrophyLift({ gold, icon, className }: {
  gold: boolean;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        'relative mx-auto w-20 h-24 rounded-2xl flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]',
        gold ? 'bg-gradient-to-b from-amber-400/40 to-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-foreground/70',
        className,
      )}
      initial={gold ? { y: 28, scale: 0.6, rotate: -8, opacity: 0 } : false}
      animate={gold ? { y: 0, scale: 1, rotate: 0, opacity: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
    >
      {gold && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: '0 0 28px 4px hsl(43 96% 55% / 0.55)' }}
          animate={{ opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        />
      )}
      <motion.span
        className="relative"
        animate={gold ? { y: [0, -3, 0] } : undefined}
        transition={gold ? { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.8 } : undefined}
      >
        {icon}
      </motion.span>
    </motion.div>
  );
}
