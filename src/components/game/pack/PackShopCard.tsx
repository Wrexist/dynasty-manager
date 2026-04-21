import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Sparkles, ShieldCheck } from 'lucide-react';
import type { PackTierDefinition } from '@/types/game';
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
 * Pack card with an Apple-style Liquid Glass overlay. The pack art fills
 * the whole card; label, price, and a Buy button live inside a translucent
 * glass panel at the bottom that refracts colour from the art behind it
 * via backdrop-blur + backdrop-saturate.
 */
export const PackShopCard = memo(function PackShopCard({ tier, affordable, squadOk, onSelect, featured }: PackShopCardProps) {
  const disabled = !affordable || !squadOk;
  const prefersReducedMotion = useReducedMotion();
  const lockedReason = !affordable ? 'Budget' : 'Full';
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={() => { if (disabled) return; hapticLight(); onSelect(); }}
      disabled={disabled}
      className={cn(
        'group relative w-full text-left bg-transparent',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl',
        disabled && 'opacity-60 grayscale cursor-not-allowed',
      )}
      aria-label={`Buy ${tier.label}, ${formatMoney(tier.price)}${disabled ? ` (unavailable — ${lockedReason.toLowerCase()})` : ''}`}
    >
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

        {/* Liquid-glass overlay — label, price, Buy button. Sits on top of
            the art so `backdrop-blur` picks up the tier's palette and tints
            the glass, the way Apple's Liquid Glass refracts the content
            behind it. */}
        <div className={cn('absolute inset-x-2 z-10', featured ? 'bottom-2' : 'bottom-1.5')}>
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl',
              'bg-white/10 backdrop-blur-2xl backdrop-saturate-150',
              'border border-white/25',
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(0,0,0,0.25),0_10px_28px_-10px_rgba(0,0,0,0.55)]',
            )}
          >
            {/* Top specular highlight — the bright rim along the top edge
                of a glass surface. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 via-white/5 to-transparent" />
            {/* Soft bottom shadow inside the glass for depth. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />

            <div className={cn('relative flex items-center justify-between gap-2', featured ? 'px-3 py-2.5' : 'px-2.5 py-2')}>
              <div className="min-w-0">
                <h3
                  className={cn(
                    'font-display font-bold text-white leading-tight truncate',
                    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]',
                    featured ? 'text-base' : 'text-sm',
                  )}
                >
                  {tier.label}
                </h3>
                <p
                  className={cn(
                    'font-semibold tabular-nums text-white/85 leading-none mt-0.5',
                    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]',
                    featured ? 'text-xs' : 'text-[11px]',
                  )}
                >
                  {formatMoney(tier.price)}
                </p>
              </div>

              {/* Liquid-glass action chip — matches the panel's material
                  language: translucent white tint, rim highlight, top
                  specular gloss, gentle outer shadow. */}
              <span
                className={cn(
                  'shrink-0 relative inline-flex items-center justify-center overflow-hidden',
                  'rounded-full font-semibold uppercase tracking-widest',
                  'border backdrop-blur-xl backdrop-saturate-150',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.2),0_4px_12px_-4px_rgba(0,0,0,0.5)]',
                  disabled
                    ? 'bg-white/10 border-white/20 text-white/70'
                    : 'bg-white/20 border-white/35 text-white',
                  featured ? 'h-8 px-3.5 text-[11px] gap-1' : 'h-7 px-3 text-[10px] gap-1',
                )}
              >
                <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-white/55 to-transparent" />
                {disabled && <Lock className="relative w-3 h-3" />}
                <span className="relative">{disabled ? lockedReason : 'Buy'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
});
