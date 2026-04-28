import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'emerald' | 'sky' | 'rose' | 'amber';

interface PremiumProgressProps {
  /** 0..100 */
  value: number;
  className?: string;
  tone?: Tone;
  /** Animate the fill with a spring on mount/update. */
  animate?: boolean;
  /** Visual height — keep numbers familiar (1.5 / 2 / 3). */
  size?: 'sm' | 'md' | 'lg';
  /** Extra outer glow for "complete" / hero contexts. */
  glow?: boolean;
}

const HEIGHT: Record<NonNullable<PremiumProgressProps['size']>, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
};

const FILL_GRADIENT: Record<Tone, string> = {
  primary:
    'linear-gradient(180deg, hsl(var(--primary)/0.95) 0%, hsl(var(--primary)) 50%, hsl(var(--primary)/0.85) 100%)',
  emerald:
    'linear-gradient(180deg, rgba(110,231,183,0.95) 0%, rgb(16,185,129) 50%, rgb(4,120,87) 100%)',
  sky:
    'linear-gradient(180deg, rgba(125,211,252,0.95) 0%, rgb(56,189,248) 50%, rgb(2,132,199) 100%)',
  rose:
    'linear-gradient(180deg, rgba(253,164,175,0.95) 0%, rgb(244,63,94) 50%, rgb(159,18,57) 100%)',
  amber:
    'linear-gradient(180deg, rgba(253,224,71,0.95) 0%, rgb(245,158,11) 50%, rgb(180,83,9) 100%)',
};

const GLOW: Record<Tone, string> = {
  primary: '0 0 10px hsl(var(--primary)/0.45)',
  emerald: '0 0 10px rgba(16,185,129,0.5)',
  sky: '0 0 10px rgba(56,189,248,0.5)',
  rose: '0 0 10px rgba(244,63,94,0.5)',
  amber: '0 0 10px rgba(245,158,11,0.5)',
};

export function PremiumProgress({
  value,
  className,
  tone = 'primary',
  animate = true,
  size = 'md',
  glow = false,
}: PremiumProgressProps) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        'relative w-full rounded-full overflow-hidden',
        // Track: subtle inset shadow + tinted background
        'bg-black/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.04)]',
        HEIGHT[size],
        className,
      )}
    >
      <motion.div
        className="h-full rounded-full relative"
        style={{
          background: FILL_GRADIENT[tone],
          boxShadow: glow
            ? `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25), ${GLOW[tone]}`
            : 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)',
        }}
        initial={animate ? { width: 0 } : false}
        animate={{ width: `${pct}%` }}
        transition={animate ? { duration: 0.7, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
      >
        {/* Specular highlight along the top */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 rounded-t-full"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 100%)',
          }}
        />
      </motion.div>
    </div>
  );
}
