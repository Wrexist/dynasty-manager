import { memo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { Lock, ShieldCheck, Play, ShoppingBag, Gift, HelpCircle, Clock, Plus } from 'lucide-react';
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
  /** Weekly bonus cards this purchase would add. Drives the "+1 this week"
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
 * ── Why the pack NAME is not drawn ──
 * The cover art has the pack's name illustrated into it ("CHAMPIONS",
 * "WORLD CLASS", …). The card therefore renders no label chip and no CTA over
 * the art: a glass chip repeating a word already painted on the packet is
 * clutter, and the old bottom-centre CTA landed directly on top of the burned-in
 * name. Everything the art does not say — contents, guarantee, price, why now —
 * lives in a strip beneath it.
 *
 * ── Why the art is never cropped ──
 * The covers are 2:3 and the name sits low on the packet, so any tighter aspect
 * ratio eats into it. Both layouts render the art at its native 2:3: the grid
 * card as a tall tile, the hero as a horizontal split so a full-width 2:3 image
 * does not swallow the screen.
 *
 * Between them the card still answers five questions in reading order: what is
 * this (the art), what do I get (guarantee badge + contents line), why is it
 * valuable (ribbon / bonus line), how much (CTA), and why now (countdown).
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

  let ctaLabel: string;
  if (method === 'free') ctaLabel = 'Open Free';
  else if (method === 'ad') ctaLabel = 'Watch Ad';
  else if (method === 'iap') ctaLabel = tier.iapPriceDisplay ? `Buy ${tier.iapPriceDisplay}` : 'In-App Purchase';
  else if (method === 'currency') ctaLabel = `Buy ${formatMoney(tier.price)}`;
  else ctaLabel = resetCountdown ? `Back in ${resetCountdown}` : 'Back tomorrow';

  const lockedReason = !squadOk
    ? 'Squad full'
    : noMethod
      ? (resetCountdown ? `Back in ${resetCountdown}` : 'Back tomorrow')
      : method === 'currency'
        ? 'Not enough funds'
        : 'Unavailable';

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
  // Kept SHORT on purpose: a grid tile is ~170px wide and the guarantee badge
  // takes the opposite corner, so anything longer than about twelve characters
  // truncates. The full sentence lives in the details strip below the art.
  const ribbon = bonusCards > 0
    ? `+${bonusCards} card${bonusCards === 1 ? '' : 's'}`
    : method === 'free'
      ? 'Free'
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

  // The weekly bonus card also rolls at the guaranteed floor, so the spoken
  // guarantee count must include it — the visible copy already does.
  const guaranteedCount = 1 + bonusCards;
  const ariaLabel = `${ctaLabel} ${tier.label}, ${totalCards} player${totalCards === 1 ? '' : 's'}, `
    + `${guaranteedCount === 1 ? 'one' : guaranteedCount} guaranteed ${tier.guaranteedMinOvr} or higher, ${ariaPrice}`
    + (disabled ? ` (unavailable — ${lockedReason.toLowerCase()})` : '');

  /* ── Art tile ──
     Native 2:3, so the illustrated pack name is never clipped. Chrome is kept
     to the top corners, the only region of the cover with no artwork in it. */
  const art = (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl isolate aspect-[2/3]',
        !disabled && 'shadow-[0_14px_32px_-16px_rgba(0,0,0,0.8)]',
      )}
    >
      {/* Art chain: new cover → previous cover → tier gradient. A pack can be
          pointed at artwork that has not shipped yet without the card dropping
          all the way to a bare gradient, and it lights up the moment the file
          lands in `public/packs/`. */}
      <PackArt
        src={tier.artSrc}
        loading={featured ? 'eager' : 'lazy'}
        className="absolute inset-0 w-full h-full object-cover object-center"
        fallback={
          <PackArt
            src={tier.artLegacySrc}
            className="absolute inset-0 w-full h-full object-cover object-center"
            fallback={
              <div
                className="absolute inset-0 flex items-end justify-center p-3"
                style={{ background: `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientTo} 100%)` }}
              >
                {/* The gradient placeholder DOES need the name — it is the one
                    state where the art is not carrying it. */}
                <span className="font-display font-bold uppercase tracking-wide text-white text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] text-sm">
                  {tier.label}
                </span>
              </div>
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

      {/* Chrome lives in the two top corners — the only region of these covers
          with no illustration in it. Ribbon left, guarantee right, and the
          ribbon is width-capped so a long one truncates instead of running
          under the badge opposite. */}
      <div className="absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1 z-10 pointer-events-none">
        {ribbon ? (
          <span className={cn(
            'flex items-center gap-1 min-w-0 h-5 px-2 text-[9px] font-bold uppercase tracking-widest rounded-full border backdrop-blur',
            ribbonTone,
          )}>
            {bonusCards > 0
              ? <Plus className="w-2.5 h-2.5 shrink-0" />
              : rawTier.badge === 'best_value'
                ? <PremiumSparkle className="w-3 h-3 shrink-0" withSatellite={false} />
                : null}
            <span className="truncate">{ribbon}</span>
          </span>
        ) : <span />}
        <span className="flex items-center gap-1 shrink-0 h-5 px-2 text-[10px] font-bold tabular-nums rounded-full text-white bg-black/55 border border-white/20 backdrop-blur">
          <ShieldCheck className="w-2.5 h-2.5" />
          {tier.guaranteedMinOvr}+
        </span>
      </div>
    </div>
  );

  /* ── Contents + CTA ──
     Everything the illustration cannot say. The CTA is a REAL button rather
     than a chip inside a card-wide one: the art and the buy control are two
     separate tap targets, which is what lets the Odds link live on the same
     strip without nesting a button inside a button (invalid HTML, and browsers
     disagree about which one a tap belongs to). */
  const cta = (
    <button
      type="button"
      onClick={() => { if (disabled) return; hapticLight(); onSelect(); }}
      disabled={disabled}
      className={cn(
        'w-full relative inline-flex items-center justify-center overflow-hidden',
        'rounded-full font-semibold uppercase tracking-widest border',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        disabled
          ? 'bg-muted/30 border-border/50 text-muted-foreground cursor-not-allowed'
          : 'bg-primary/90 border-primary/60 text-primary-foreground active:scale-[0.98]',
        featured ? 'h-10 px-4 text-xs gap-1.5' : 'h-8 px-2 text-[10px] gap-1',
      )}
      aria-label={ariaLabel}
    >
      {disabled
        ? <Lock className="w-3 h-3 shrink-0" />
        : CtaIcon
          ? <CtaIcon className="w-3 h-3 shrink-0" />
          : null}
      <span className="truncate">{disabled ? lockedReason : ctaLabel}</span>
    </button>
  );

  const details = (
    <div className={cn('flex flex-col', featured ? 'gap-1.5' : 'gap-1 mt-1.5')}>
      {/* `items-start`, not baseline: the contents line can wrap on a narrow
          tile and Odds should stay pinned to its first line. */}
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-muted-foreground leading-snug min-w-0', featured ? 'text-xs' : 'text-[10px]')}>
          <span className="text-foreground/90 font-semibold tabular-nums">
            {totalCards} player{totalCards === 1 ? '' : 's'}
          </span>
          {/* Just the floor, not "one guaranteed N+". The shield badge on the
              art already says "guaranteed", the bonus line below repeats the
              number for the weekly card, and spelling it out here wrapped the
              line and left the Odds link floating beside a two-line paragraph
              on both layouts. */}
          {` · ${tier.guaranteedMinOvr}+`}
        </p>
        {/* A circled (?), not an "Odds" link: the sheet behind it is now the
            whole pack guide — what a version is, what an average open looks
            like, the odds — and "Odds" undersold it. It stays on the details
            row rather than over the artwork, because corner chrome there
            collides with the ribbon and guarantee badge.
            Deliberately never disabled: the guide must be readable even when
            the pack cannot be opened right now, which is exactly when someone
            is deciding whether it is worth buying.
            The icon is 16px, so `p-3.5 -m-3.5` (14px each side) buys the 44px
            tap target without moving the layout. */}
        <button
          type="button"
          onClick={() => { hapticLight(); onShowOdds(); }}
          className={cn(
            'shrink-0 p-3.5 -m-3.5 rounded-full',
            'text-muted-foreground hover:text-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
          aria-label={`What's in the ${tier.label}? Odds and details`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
      {bonusCards > 0 && (
        <p className={cn('text-primary font-semibold leading-snug', featured ? 'text-xs' : 'text-[10px]')}>
          Weekly bonus: +{bonusCards} extra card, guaranteed {tier.guaranteedMinOvr}+
        </p>
      )}
      {featured && weeklyCountdown && (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
          <Clock className="w-3 h-3" /> New pack in {weeklyCountdown}
        </span>
      )}
      <div className="mt-0.5">{cta}</div>
    </div>
  );

  /** The art is its own tap target — tapping the packet is the natural gesture,
   *  and it does the same thing the CTA does. Pointer-only: the CTA below is
   *  the single keyboard/screen-reader control, so this stays out of the
   *  accessibility tree — two tab stops with the identical name and action
   *  were indistinguishable to a screen-reader user. */
  const artButton = (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-hidden
      whileHover={disabled || prefersReducedMotion ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={() => { if (disabled) return; hapticLight(); onSelect(); }}
      disabled={disabled}
      className={cn(
        'w-full block bg-transparent rounded-2xl',
        'focus:outline-none',
        disabled && 'opacity-60 grayscale cursor-not-allowed',
      )}
    >
      {art}
    </motion.button>
  );

  if (featured) {
    return (
      <div className="flex gap-3 items-stretch w-full">
        <div className="w-[42%] shrink-0">{artButton}</div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">{details}</div>
      </div>
    );
  }

  return (
    // No wrapper dimming: the art already greys out, and the contents line is
    // the thing a player reads to decide whether to come back for this pack
    // tomorrow. Fading it is fading the reason to return.
    <div className="w-full">
      {artButton}
      {details}
    </div>
  );
});
