import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ShieldCheck, Info } from 'lucide-react';
import type { PackTierDefinition } from '@/types/game';
import {
  describePackOdds,
  resolvePackTier,
  PACK_PITY_THRESHOLD,
  PACK_PITY_MIN_OVR,
  PACK_STREAK_BANDS,
} from '@/config/packs';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { PackArt } from './PackArt';

interface PackOddsSheetProps {
  tier: PackTierDefinition;
  /** Login streak, so the Daily Pack's sheet describes TODAY's pack and can
   *  show the rest of the ladder as what the player is working toward. */
  streak?: number;
  /** Weekly bonus cards this open would include. The sheet must describe the
   *  pack the player is about to buy, not a generic one — a featured pack ships
   *  six cards and two at the floor, and a sheet that says five and one is
   *  understating the offer it is attached to. */
  bonusCards?: number;
  onClose: () => void;
}

/** Percent with one decimal only where it earns it — "78%" reads better than
 *  "78.0%", and "0.5%" must not round to "0%". */
function pct(chance: number): string {
  const p = chance * 100;
  if (p > 0 && p < 1) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

/**
 * The pack guide: what a pack is, what it gives you, and its published odds.
 *
 * It grew out of a bare drop-rates table because the storefront has no other
 * teaching surface — a new player has no way to learn what a "version" is, why
 * a $9.99 pack can guarantee 88+, or what an average open looks like, and none
 * of that fits on a 170px card. The legal disclosure below is still the reason
 * this sheet must exist; the rest is the reason it is worth opening.
 *
 * NOT a nice-to-have. App Store Review Guideline 3.1.1 requires an app that
 * sells randomized items to disclose the odds of each outcome to the customer
 * *before* purchase, and this Market sold four randomized consumable packs
 * while disclosing nothing anywhere in the app. Every pack card links here, so
 * the disclosure is reachable before every buy CTA, paid or free.
 *
 * Every number is derived from `config/packs.ts` by `describePackOdds` — the
 * same config the generator rolls against. A hand-maintained odds table that
 * drifts is worse than none, because then it is a false claim rather than a
 * missing one.
 */
export function PackOddsSheet({ tier: rawTier, streak, bonusCards = 0, onClose }: PackOddsSheetProps) {
  const prefersReducedMotion = useReducedMotionPref();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  // Escape closes. The focus trap owns Tab containment, not dismissal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const tier = resolvePackTier(rawTier, { streak });
  const rows = describePackOdds(rawTier, { streak });
  const ladder = rawTier.streakOverrides;
  // Bonus cards roll at the guaranteed floor (see `generatePackContents`), so
  // they add to the guaranteed count, not to the randomised remainder.
  const guaranteed = 1 + bonusCards;
  const random = Math.max(0, tier.cards - 1);
  const totalCards = tier.cards + bonusCards;
  const versionBoost = tier.versionBoost ?? 0;
  // "Champions Pack" → "Champions". The word "version" follows it in the copy,
  // and "a Champions Pack version" reads as a mouthful of nouns.
  const versionName = rawTier.label.replace(/\s+pack$/i, '');
  // Expected 80+ cards per open. Weights are authored to sum to 1, but a tier
  // edited to sum to anything else must not silently turn this into a fiction —
  // normalise, so the number is always a real expectation over the same table
  // the odds rows below are drawn from.
  const weightSum = Object.values(tier.rarity).reduce((sum, w) => sum + Math.max(0, w || 0), 0);
  const elitePerCard = weightSum > 0
    ? ((tier.rarity.gold || 0) + (tier.rarity.legendary || 0)) / weightSum
    : 0;
  // A guaranteed floor at 80+ makes every guaranteed card (including the weekly
  // bonus cards, which roll at that same floor) a certain elite pull.
  const expectedElite = (tier.guaranteedMinOvr >= 80 ? guaranteed : 0) + random * elitePerCard;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${tier.label} pack guide`}
        className="w-full max-w-lg bg-card/95 backdrop-blur-xl border border-border/50 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        initial={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* The cover comes with the sheet so the popup is visibly attached to
              the packet that was tapped — the featured slot reuses one tier
              under three different names, and the art is what disambiguates. */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-16 shrink-0 aspect-[2/3] rounded-lg overflow-hidden">
              <PackArt
                src={tier.artSrc}
                loading="eager"
                className="w-full h-full object-cover object-center"
                fallback={
                  <PackArt
                    src={tier.artLegacySrc}
                    className="w-full h-full object-cover object-center"
                    fallback={
                      <div
                        className="w-full h-full"
                        style={{ background: `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientTo} 100%)` }}
                      />
                    }
                  />
                }
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-display font-bold text-foreground">{tier.label} — pack guide</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bonusCards > 0
                  ? `${totalCards} players this week, including the bonus card.`
                  : rawTier.storeCaption}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pack guide"
            className="shrink-0 p-1.5 rounded-full bg-muted/40 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Blurb — what this pack is FOR. The popup is the only place in the
            Market with room to teach that, so it leads before the numbers. */}
        {tier.storeBlurb && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{tier.storeBlurb}</p>
        )}

        {/* What you get — the outcomes that are not probabilities at all. */}
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1.5">
            What you get
          </h3>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-px" />
            <div className="space-y-1 text-xs text-foreground">
              <p>
                <span className="font-semibold tabular-nums">
                  {totalCards} player{totalCards === 1 ? '' : 's'}.
                </span>{' '}
                <span className="font-semibold">
                  {guaranteed === 1
                    ? `1 card is guaranteed ${tier.guaranteedMinOvr}+ OVR.`
                    : `${guaranteed} cards are guaranteed ${tier.guaranteedMinOvr}+ OVR.`}
                </span>{' '}
                {random === 0
                  ? ''
                  : `${random === 1 ? 'The other card rolls' : `The other ${random} roll`} at the rates below.`}
              </p>
              {versionBoost > 0 && (
                <p className="text-foreground/90">
                  Every card is a {versionName} version: +{versionBoost} to every stat and +{versionBoost} overall
                  over the player&apos;s base card.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* What to expect — the guarantee tells you the floor; this tells you
            what an average open actually looks like, which is the question a
            buyer is really asking when they open this sheet. Suppressed when
            the expectation rounds to zero (the free Daily): "~0.0 cards rated
            80+" is technically true and reads as a broken label — the Daily's
            promise is its streak ladder, which is right below. */}
        {expectedElite >= 0.05 && (
          <div className="text-xs text-foreground/90 mb-3">
            <span className="font-semibold">On average:</span>{' '}
            <span className="tabular-nums">~{expectedElite.toFixed(1)}</span> card
            {expectedElite.toFixed(1) === '1.0' ? '' : 's'} rated 80+ per open.
          </div>
        )}

        <table className="w-full text-xs">
          <caption className="sr-only">Per-card drop rates for the {tier.label}</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th scope="col" className="text-left font-semibold pb-1.5">Rarity</th>
              <th scope="col" className="text-right font-semibold pb-1.5">Chance per card</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-t border-border/40">
                <td className="py-2 text-foreground/90">{row.label}</td>
                <td className="py-2 text-right tabular-nums font-semibold text-foreground">{pct(row.chance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Streak ladder — only the Daily Pack has one. Shown as what today's
            pack is and what the next days are worth, so the escalation is a
            visible promise rather than a surprise. */}
        {ladder && ladder.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Streak ladder
            </h3>
            <ul className="space-y-1">
              {ladder.map((band, i) => {
                const from = PACK_STREAK_BANDS[i] ?? 1;
                const to = PACK_STREAK_BANDS[i + 1];
                const active = (streak ?? 1) >= from && (to === undefined || (streak ?? 1) < to);
                return (
                  <li
                    key={from}
                    className={cn(
                      'flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 border',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border/40 text-muted-foreground',
                    )}
                  >
                    <span className="tabular-nums">
                      {to === undefined ? `Day ${from}+` : from === to - 1 ? `Day ${from}` : `Days ${from}–${to - 1}`}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {band.guaranteedMinOvr}+ guaranteed
                      {active && <span className="ml-1.5 text-primary">· today</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-2 mt-4 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            Rates are per card and independent. If {PACK_PITY_THRESHOLD} packs pass without an
            {' '}{PACK_PITY_MIN_OVR}+ pull, the next pack&apos;s guaranteed card is raised toward
            {' '}{PACK_PITY_MIN_OVR}+ — see the Guarantee Tracker on the Market.
            Ratings shown are a player&apos;s overall at the moment they join; they develop from there.
            Every player is a real footballer — the same player can exist as different pack versions
            with different ratings.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
