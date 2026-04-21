import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Sparkles, ShieldCheck } from 'lucide-react';
import type { PackTierDefinition } from '@/config/packs';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { PackArt } from './PackArt';

interface PackShopCardProps {
  tier: PackTierDefinition;
  affordable: boolean;
  squadOk: boolean;
  onSelect: () => void;
  featured?: boolean;
}

/**
 * Slim pack card — the pack art is the visual. No tier-coloured backdrop,
 * no overlaid info panel. A compact footer row below the art shows label,
 * price, and a small Open pill. Guarantee badge floats over the art.
 */
export const PackShopCard = memo(function PackShopCard({ tier, affordable, squadOk, onSelect, featured }: PackShopCardProps) {
  const disabled = !affordable || !squadOk;
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={() => { if (disabled) return; hapticLight(); onSelect(); }}
      disabled={disabled}
      className={cn(
        'group relative w-full text-left flex flex-col gap-2 bg-transparent',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl',
        disabled && 'opacity-50 grayscale cursor-not-allowed',
      )}
      aria-label={`Open ${tier.label}, ${formatMoney(tier.price)}${disabled ? ' (unavailable)' : ''}`}
    >
      {/* Art frame — just the pack illustration on the page background, with
          a hairline border for definition and a soft drop shadow for lift. */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl isolate',
          'border border-white/10',
          !disabled && 'shadow-[0_14px_32px_-16px_rgba(0,0,0,0.8)]',
          featured ? 'aspect-[4/5]' : 'aspect-[3/4]',
        )}
      >
        <PackArt
          src={tier.artSrc}
          className="absolute inset-0 w-full h-full object-cover object-center"
          fallback={
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientTo} 100%)` }}
            />
          }
        />

        {/* Shimmer sweep — subtle life signal, only when interactive. */}
        {!disabled && !prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: featured
                ? 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)'
                : 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{
              duration: featured ? 1.6 : 2.4,
              repeat: Infinity,
              repeatDelay: featured ? 2.6 : 7,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Floating badges — top-right. Guarantee chip always shows; featured
            adds a sparkle pill above it. */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
          {featured && (
            <span className="flex items-center gap-1 h-5 px-2 text-[9px] uppercase tracking-widest rounded-full text-white bg-black/45 border border-white/20 backdrop-blur">
              <Sparkles className="w-2.5 h-2.5" /> Featured
            </span>
          )}
          <span className="flex items-center gap-1 h-5 px-2 text-[10px] font-bold tabular-nums rounded-full text-white bg-black/45 border border-white/20 backdrop-blur">
            <ShieldCheck className="w-2.5 h-2.5" />
            {tier.guaranteedMinOvr}+
          </span>
        </div>
      </div>

      {/* Slim footer — label + price on one row, Open pill on the right.
          Lives below the art so nothing covers the illustration. */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <h3
            className={cn(
              'font-display font-bold text-foreground leading-tight truncate',
              featured ? 'text-base' : 'text-sm',
            )}
          >
            {tier.label}
          </h3>
          <p className="text-[11px] font-semibold tabular-nums text-muted-foreground leading-none mt-0.5">
            {formatMoney(tier.price)}
          </p>
        </div>
        {disabled ? (
          <span className="shrink-0 flex items-center gap-1 h-7 px-2.5 text-[10px] uppercase tracking-widest rounded-full border border-border/60 text-muted-foreground bg-muted/20 font-semibold">
            <Lock className="w-3 h-3" /> {!affordable ? 'Budget' : 'Full'}
          </span>
        ) : (
          <span className="shrink-0 flex items-center h-7 px-3 text-[10px] uppercase tracking-widest rounded-full bg-primary/15 border border-primary/40 text-primary font-semibold">
            Open
          </span>
        )}
      </div>
    </motion.button>
  );
});
