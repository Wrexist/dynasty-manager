import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Sparkles, ShieldCheck, Play, ShoppingBag, Gift } from 'lucide-react';
import type { PackTierDefinition, PackUnlockMethod } from '@/types/game';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { PackArt } from './PackArt';

interface PackShopCardProps {
  tier: PackTierDefinition;
  /** True if the player can use the active method right now. */
  affordable: boolean;
  squadOk: boolean;
  onSelect: () => void;
  featured?: boolean;
  /** Active method for this tier given today's usage — the page picks
   *  this via `free → ad → iap → currency` priority. `null` means
   *  nothing is available right now (caps hit, no fallback). */
  method: PackUnlockMethod | null;
  /** Free opens remaining today (0 if tier doesn't offer free opens). */
  freeRemaining: number;
  /** Ad opens remaining today (0 if tier doesn't offer ad opens). */
  adRemaining: number;
  /** Pre-formatted countdown string to next daily reset (e.g. "5h 23m").
   *  Only shown when the active method is locked behind a daily reset. */
  resetCountdown?: string;
}

/**
 * Pack card with an Apple-style Liquid Glass overlay. The pack art bleeds
 * to the page (no hairline frame); label, price, and a Buy button live
 * inside a translucent glass panel at the bottom that refracts colour
 * from the art behind it via backdrop-blur + backdrop-saturate. Guarantee
 * badge floats over the art top-right.
 */
export const PackShopCard = memo(function PackShopCard({ tier, affordable, squadOk, onSelect, featured, method, freeRemaining, adRemaining, resetCountdown }: PackShopCardProps) {
  const noMethod = method === null;
  const disabled = !squadOk || noMethod || !affordable;
  const prefersReducedMotion = useReducedMotion();

  // CTA chip text + icon vary by active unlock method.
  const ctaLabel = method === 'free'
    ? 'Open Free'
    : method === 'ad'
      ? 'Watch'
      : method === 'iap'
        ? 'Buy'
        : method === 'currency'
          ? 'Buy'
          : 'Tomorrow';
  const lockedReason = !squadOk
    ? 'Full'
    : noMethod
      ? 'Tomorrow'
      : method === 'currency'
        ? 'Budget'
        : 'Store';

  // Bottom-row price/availability line. Free is the headline when free
  // opens remain; once free is used we step down to ad / iap / currency.
  // We also surface "X left today" so the user knows their daily quota.
  let priceLine: string;
  if (method === 'free') {
    priceLine = freeRemaining > 1
      ? `FREE · ${freeRemaining} left today`
      : 'FREE · today\'s daily';
  } else if (method === 'ad') {
    priceLine = adRemaining > 0
      ? `Free · ${adRemaining} ad${adRemaining === 1 ? '' : 's'} left today`
      : 'Watch ad';
  } else if (method === 'iap') {
    priceLine = tier.iapPriceDisplay || 'In-app purchase';
  } else if (method === 'currency') {
    priceLine = formatMoney(tier.price);
  } else {
    priceLine = resetCountdown ? `Resets in ${resetCountdown}` : 'Come back tomorrow';
  }

  const CtaIcon = method === 'free'
    ? Gift
    : method === 'ad'
      ? Play
      : method === 'iap'
        ? ShoppingBag
        : null;

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
      aria-label={`${ctaLabel} ${tier.label}, ${priceLine}${disabled ? ` (unavailable — ${lockedReason.toLowerCase()})` : ''}`}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl isolate',
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
                  {priceLine}
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
                {disabled
                  ? <Lock className="relative w-3 h-3" />
                  : CtaIcon
                    ? <CtaIcon className="relative w-3 h-3" />
                    : null}
                <span className="relative">{disabled ? lockedReason : ctaLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
});
