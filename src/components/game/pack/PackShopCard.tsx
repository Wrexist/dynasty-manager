import { memo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { Lock, ShieldCheck, Play, ShoppingBag, Gift, Info, Clock, Plus } from 'lucide-react';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';
import type { PackTierDefinition, PackUnlockMethod } from '@/types/game';
import { resolvePackTier, isFreeOpenMethod } from '@/config/packs';
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
  /** Opens the odds sheet. Required on every card that can roll randomly —
   *  see the disclosure note in `describePackOdds`. */
  onShowOdds: () => void;
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
  /** Login streak, for the streak-scaled Daily Pack. */
  streak?: number;
  /** Weekly bonus cards this purchase would add. Drives the "+1 THIS WEEK"
   *  ribbon and the bonus line under the caption. */
  bonusCards?: number;
  /** Pre-formatted countdown to the weekly rotation, shown on the hero. */
  weeklyCountdown?: string;
}

/** At most one badge per card, and the ribbon copy is fixed here so a future
 *  tier cannot invent its own. A badge on every card is a badge on none. */
const BADGE_COPY: Record<string, string> = {
  best_value: 'Best value',
  entry: 'Start here',
  trophy: 'Trophy pull',
};

/**
 * A Market pack card.
 *
 * Every card answers five questions in reading order, which is the whole point
 * of the layout: what is this (label chip), what do I get (guarantee badge +
 * caption), why is it valuable (badge ribbon / bonus line), how much (CTA), and
 * why now (weekly countdown or free-reset countdown). The previous card carried
 * only a label, a guarantee number and a price — a player could not tell a
 * $2.99 pack from a $9.99 one without doing arithmetic on OVR floors.
 */
export const PackShopCard = memo(function PackShopCard({
  tier: rawTier, affordable, squadOk, onSelect, onShowOdds, featured, method,
  freeRemaining, adRemaining, resetCountdown, streak, bonusCards = 0, weeklyCountdown,
}: PackShopCardProps) {
  // The guarantee badge must describe the open the CTA is about to perform: the
  // Daily Pack's floor rises with the streak. Same resolver the generator uses,
  // so the number on the card is the number you get.
  const tier = resolvePackTier(rawTier, { freeOpen: isFreeOpenMethod(method), streak });
  const noMethod = method === null;
  const disabled = !squadOk || noMethod || !affordable;
  const prefersReducedMotion = useReducedMotionPref();
  const totalCards = tier.cards + bonusCards;

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
    ? 'Squad full'
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

  // Ribbon priority: the weekly bonus outranks a standing badge, because it is
  // the only one that expires. Free outranks both on the free card — "free" is
  // the strongest word on a store page and it should not be crowded out.
  const ribbon = bonusCards > 0
    ? `+${bonusCards} card${bonusCards === 1 ? '' : 's'} this week`
    : method === 'free'
      ? 'Free today'
      : rawTier.badge
        ? BADGE_COPY[rawTier.badge]
        : null;
  const ribbonTone = bonusCards > 0
    ? 'bg-primary text-primary-foreground border-primary/60'
    : method === 'free'
      ? 'bg-emerald-500/90 text-white border-emerald-300/50'
      : rawTier.badge === 'best_value'
        ? 'bg-primary/90 text-primary-foreground border-primary/50'
        : 'bg-black/55 text-white border-white/20';

  return (
    <div className="w-full">
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
        aria-label={`${ctaLabel} ${tier.label}, ${totalCards} player${totalCards === 1 ? '' : 's'}, one guaranteed ${tier.guaranteedMinOvr} or higher, ${ariaPrice}${disabled ? ` (unavailable — ${lockedReason.toLowerCase()})` : ''}`}
      >
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-2xl isolate',
            !disabled && 'shadow-[0_14px_32px_-16px_rgba(0,0,0,0.8)]',
            featured ? 'aspect-[4/5]' : 'aspect-[3/4]',
          )}
        >
          {/* Art chain: new cover → previous cover → tier gradient. A pack
              can therefore be pointed at artwork that has not shipped yet
              without the card dropping all the way to a bare gradient in the
              meantime, and it lights up the moment the file lands in
              `public/packs/`. */}
          <PackArt
            src={tier.artSrc}
            className="absolute inset-0 w-full h-full object-cover object-center"
            fallback={
              <PackArt
                src={tier.artLegacySrc}
                className="absolute inset-0 w-full h-full object-cover object-center"
                fallback={
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientTo} 100%)` }}
                  />
                }
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

          {/* Top row — tier label (left) + ribbon/guarantee (right). */}
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
              {ribbon && (
                <span className={cn(
                  'flex items-center gap-1 h-5 px-2 text-[9px] font-bold uppercase tracking-widest rounded-full border backdrop-blur',
                  ribbonTone,
                )}>
                  {bonusCards > 0
                    ? <Plus className="w-2.5 h-2.5" />
                    : rawTier.badge === 'best_value'
                      ? <PremiumSparkle className="w-3 h-3" withSatellite={false} />
                      : null}
                  {ribbon}
                </span>
              )}
              <span className="flex items-center gap-1 h-5 px-2 text-[10px] font-bold tabular-nums rounded-full text-white bg-black/45 border border-white/20 backdrop-blur">
                <ShieldCheck className="w-2.5 h-2.5" />
                {tier.guaranteedMinOvr}+
              </span>
            </div>
          </div>

          {/* Bottom — single floating action chip. */}
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

      {/* ── Info strip ──
          What you get, in words, under the art. This is the half of the card
          the old design was missing: the art told you a pack existed and the
          chip told you a price, and nothing told you what was inside. */}
      <div className="mt-1.5 px-0.5">
        <p className={cn(
          'text-muted-foreground leading-snug',
          featured ? 'text-[11px]' : 'text-[10px]',
        )}>
          <span className="text-foreground/90 font-semibold tabular-nums">{totalCards} player{totalCards === 1 ? '' : 's'}</span>
          {' · '}one guaranteed {tier.guaranteedMinOvr}+
        </p>
        {bonusCards > 0 && (
          <p className="text-[10px] text-primary font-semibold leading-snug mt-0.5">
            Weekly bonus: +{bonusCards} extra card, guaranteed {tier.guaranteedMinOvr}+
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-1">
          {featured && weeklyCountdown ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
              <Clock className="w-3 h-3" /> New pack in {weeklyCountdown}
            </span>
          ) : <span />}
          <button
            type="button"
            onClick={() => { hapticLight(); onShowOdds(); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            aria-label={`View drop rates for ${tier.label}`}
          >
            <Info className="w-3 h-3" /> Odds
          </button>
        </div>
      </div>
    </div>
  );
});
