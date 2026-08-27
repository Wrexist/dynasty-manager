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

interface PackOddsSheetProps {
  tier: PackTierDefinition;
  /** Login streak, so the Daily Pack's sheet describes TODAY's pack and can
   *  show the rest of the ladder as what the player is working toward. */
  streak?: number;
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
 * Published drop rates for a pack.
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
export function PackOddsSheet({ tier: rawTier, streak, onClose }: PackOddsSheetProps) {
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
        aria-label={`${tier.label} drop rates`}
        className="w-full max-w-lg bg-card/95 backdrop-blur-xl border border-border/50 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        initial={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-display font-bold text-foreground">{tier.label} — drop rates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rawTier.storeCaption}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drop rates"
            className="shrink-0 p-1.5 rounded-full bg-muted/40 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guarantee — the one outcome that is not a probability at all. */}
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">1 card is guaranteed {tier.guaranteedMinOvr}+ OVR.</span>{' '}
            The other {Math.max(0, tier.cards - 1)} roll at the rates below.
          </p>
        </div>

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
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
