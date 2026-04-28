import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, ShieldCheck, Play, ShoppingBag, Gift } from 'lucide-react';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';
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
 * Pack card with the tier label floating in a small glass chip at the
 * top-left (paired with the guarantee badge top-right) and a single
 * compact CTA chip at the bottom. The pack art bleeds to the edges so
 * the visual hierarchy is: art first, then a clean label and one tap
 * target. Price for paid packs is inlined into the CTA so there's no
 * duplicate text container.
 */
export const PackShopCard = memo(function PackShopCard({ tier, affordable, squadOk, onSelect, featured, method, freeRemaining, adRemaining, resetCountdown }: PackShopCardProps) {
  const noMethod = method === null;
  const disabled = !squadOk || noMethod || !affordable;
  const prefersReducedMotion = useReducedMotion();

  // CTA chip text + icon vary by active unlock method. Price is folded
  // into the label for paid methods so the card carries no second text
  // line — one chip says everything the user needs to act.
  let ctaLabel: string;
  if (method === 'free') ctaLabel = 'Open Free';
  else if (method === 'ad') ctaLabel = 'Watch Ad';
  else if (method === 'iap') ctaLabel = tier.iapPriceDisplay ? `Buy ${tier.iapPriceDisplay}` : 'In-App Purchase';
  else if (method === 'currency') ctaLabel = `Buy ${formatMoney(tier.price)}`;
  else ctaLabel = resetCountdown ? `In ${resetCountdown}` : 'Tomorrow';

  const lockedReason = !squadOk
    ? 'Full'
    : noMethod
      ? 'Tomorrow'
      : method === 'currency'
        ? 'Budget'
        : 'Store';

  // a11y price summary — only used in aria-label, not rendered.
  const ariaPrice = method === 'free'
    ? `free, ${freeRemaining} left today`
    : method === 'ad'
      ? `watch an ad, ${adRemaining} left today`
      : method === 'iap'
        ? tier.iapPriceDisplay || 'in-app purchase'
        : method === 'currency'
          ? formatMoney(tier.price)
          : 'unavailable today';

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
      aria-label={`${ctaLabel} ${tier.label}, ${ariaPrice}${disabled ? ` (unavailable — ${lockedReason.toLowerCase()})` : ''}`}
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

        {/* Top row — tier label (left) + guarantee/featured badges (right).
            Title lives in its own glass chip so it's always fully visible
            (no truncation) and never competes with the art for space. */}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 z-10">
          <span
            className={cn(
              'inline-flex items-center rounded-full',
              'bg-white/15 backdrop-blur-xl backdrop-saturate-150 border border-white/25',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_-4px_rgba(0,0,0,0.5)]',
              'font-display font-bold text-white uppercase tracking-wide',
              'drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]',
              featured ? 'h-7 px-3 text-xs' : 'h-6 px-2.5 text-[11px]',
            )}
          >
            {tier.label}
          </span>
          <div className="flex flex-col items-end gap-1">
            {featured && (
              <span className="flex items-center gap-1 h-5 px-2 text-[9px] uppercase tracking-widest rounded-full text-white bg-black/45 border border-white/20 backdrop-blur">
                <PremiumSparkle className="w-3 h-3" withSatellite={false} /> Featured
              </span>
            )}
            <span className="flex items-center gap-1 h-5 px-2 text-[10px] font-bold tabular-nums rounded-full text-white bg-black/45 border border-white/20 backdrop-blur">
              <ShieldCheck className="w-2.5 h-2.5" />
              {tier.guaranteedMinOvr}+
            </span>
          </div>
        </div>

        {/* Bottom — single floating action chip. Price for paid packs is
            inlined into the label, so this is the only text the user has
            to read to act. */}
        <div className={cn('absolute inset-x-0 z-10 flex justify-center', featured ? 'bottom-3' : 'bottom-2')}>
          <span
            className={cn(
              'shrink-0 relative inline-flex items-center justify-center overflow-hidden',
              'rounded-full font-semibold uppercase tracking-widest',
              'border backdrop-blur-xl backdrop-saturate-150',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.2),0_4px_12px_-4px_rgba(0,0,0,0.5)]',
              disabled
                ? 'bg-white/10 border-white/20 text-white/70'
                : 'bg-white/25 border-white/40 text-white',
              featured ? 'h-9 px-4 text-[11px] gap-1.5' : 'h-8 px-3.5 text-[10px] gap-1.5',
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
    </motion.button>
  );
});
