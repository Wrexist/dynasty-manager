import { track } from '@/utils/analytics';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Sparkles, ArrowUpRight, ArrowRight, Clock3, ShieldCheck } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { PACK_TIER_MAP } from '@/config/packs';
import { formatDealRemaining, type ActivePackDeal } from '@/utils/packDeals';
import { PackArt } from './PackArt';
import type { ProductId } from '@/types/game';

export function PackDealUpsell({ deals, onClose, onView, prices, trigger = 'postOpen', viewLabel = 'Choose pack' }: {
  prices?: Partial<Record<ProductId, string>>;
  viewLabel?: string;
  trigger?: 'postOpen' | 'postWin' | 'dealExpiring';
  deals: ActivePackDeal[]; onClose: () => void; onView: (deal: ActivePackDeal) => void;
}) {
  const initialTrigger = useRef(trigger);
  useEffect(() => { track('pack_upsell_shown', { trigger: initialTrigger.current }); }, []);
  const dismiss = () => { track('pack_upsell_dismissed', { trigger }); onClose(); };
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();
  useFocusTrap(ref, true, { initialFocus: ref });
  useScrollLock();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { track('pack_upsell_dismissed', { trigger }); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, trigger]);
  const [featured, ...others] = [...deals].sort((a, b) => b.bonusCards - a.bonusCards);
  if (!featured) return null;
  const tier = PACK_TIER_MAP[featured.tierKey];
  const priceFor = (key: ActivePackDeal['tierKey']) => {
    const pack = PACK_TIER_MAP[key];
    return prices === undefined ? pack.iapPriceDisplay : pack.productId ? prices[pack.productId] : undefined;
  };
  // Backdrop tap closes. `cursor-pointer` is load-bearing, not styling: this
  // layer is portalled into <body>, where React's click listener is delegated,
  // and iOS WebKit only dispatches a tap as a click on a non-interactive
  // element that looks clickable — without it a backdrop tap on an iPhone can
  // do nothing (device check; Chromium is unaffected).
  return createPortal(
    <div data-testid="pack-deal-backdrop" className="fixed inset-0 z-[100] flex cursor-pointer items-end justify-center bg-black/75 p-3 backdrop-blur-md sm:items-center sm:p-6"
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="pack-deal-title" aria-describedby="pack-deal-description" tabIndex={-1}
        initial={reduced ? false : { opacity: 0, y: 32, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 310 }}
        className="relative isolate w-full max-w-md cursor-auto outline-none overflow-y-auto overscroll-contain rounded-[28px] border border-white/15 bg-[#10151e] text-white shadow-[0_32px_100px_rgba(0,0,0,0.65)] max-h-[92dvh]">
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
        <button type="button" onClick={dismiss} aria-label="Close pack offers" className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"><X className="h-[18px] w-[18px]" /></button>
        <header className="px-5 pb-4 pt-6">
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-200/90"><Sparkles className="h-3 w-3" /> Limited pack offers</p>
          <h2 id="pack-deal-title" className="pr-5 font-display text-[28px] font-bold leading-tight tracking-tight">Boost your squad.</h2>
          <p id="pack-deal-description" className="mt-2 text-xs leading-relaxed text-slate-400">Your favourite packs. More cards. Same price.</p>
        </header>
        <div className="px-4">
          <article key={`${featured.slotId}-${featured.endsAt}`} className="relative isolate overflow-hidden rounded-[20px] border border-amber-200/20 bg-[#1b1e26]">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(234,179,8,0.16), transparent 65%), linear-gradient(135deg, rgba(255,255,255,0.025), transparent)' }} />
            <div className="relative grid grid-cols-[44%_1fr] items-center gap-2 px-3 pt-4">
              <div className="relative flex h-[192px] items-center justify-center">
                {!reduced && <motion.div aria-hidden className="pointer-events-none absolute inset-x-3 bottom-4 h-24 rounded-full bg-amber-300/15 blur-2xl" animate={{ opacity: [0.4, 0.85, 0.4], scale: [0.95, 1.1, 0.95] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} />}
                <div aria-hidden className="absolute bottom-1 h-3 w-24 rounded-full bg-black/70 blur-md" />
                <motion.div className="relative h-[182px] w-[122px] drop-shadow-[0_12px_16px_rgba(0,0,0,0.6)]" animate={reduced ? undefined : { y: [0, -5, 0], rotate: [-2, 1, -2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
                  <PackArt src={tier.artSrc} loading="eager" className="h-full w-full object-contain" fallback={<div className="h-full w-full rounded-xl" style={{ background: tier.gradientFrom }} />} />
                </motion.div>
                {!reduced && [0, 1, 2].map(i => <motion.span key={i} aria-hidden className="pointer-events-none absolute h-1 w-1 rounded-full bg-amber-100 shadow-[0_0_8px_rgba(253,230,138,0.8)]" style={{ left: `${12 + i * 33}%`, top: `${24 + i * 19}%` }} animate={{ opacity: [0, 0.8, 0], y: [5, -12] }} transition={{ duration: 3.5, repeat: Infinity, delay: i * 1.1, ease: 'easeInOut' }} />)}
              </div>
              <div className="min-w-0 pb-2">
                <span className="inline-flex rounded-md border border-amber-200/25 bg-amber-200/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-200">+{featured.bonusCards} bonus card{featured.bonusCards === 1 ? '' : 's'}</span>
                <h3 className="mt-3 font-display text-2xl font-bold leading-none">{tier.label}</h3>
                {priceFor(featured.tierKey) && <p className="mt-2 text-sm font-semibold text-amber-200">Only {priceFor(featured.tierKey)}</p>}
                <p className="mt-2 text-sm font-semibold tabular-nums text-white">{tier.cards + featured.bonusCards} players</p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/25 px-2 py-1 text-[10px] font-semibold tabular-nums text-white/90">
                  <ShieldCheck className="h-3 w-3 shrink-0 text-amber-200/80" />
                  {1 + featured.bonusCards} × {tier.guaranteedMinOvr}+ OVR
                </p>
                <p className="mt-1 text-[9px] text-slate-400">Guaranteed ratings</p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] tabular-nums text-amber-100"><Clock3 className="h-3 w-3 shrink-0" /> {formatDealRemaining(featured.remainingMs)} left</div>
              </div>
            </div>
            <div className="relative px-3 pb-3 pt-2">
              <motion.button type="button" onClick={() => onView(featured)} whileTap={reduced ? undefined : { scale: 0.98 }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-100/35 bg-gradient-to-b from-[#ffe6a3] to-[#eac26b] px-3 text-xs font-bold text-[#33230b] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_16px_rgba(234,179,8,0.08)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1e26]">{viewLabel}<ArrowRight className="h-4 w-4" /></motion.button>
            </div>
          </article>
          {others.length > 0 && <div className="mt-4">
            <p className="mb-2 px-1 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">More to discover</p>
            <div className="space-y-2">
              {others.map(deal => {
                const otherTier = PACK_TIER_MAP[deal.tierKey];
                return <button key={`${deal.slotId}-${deal.endsAt}`} type="button" onClick={() => onView(deal)} aria-label={`${otherTier.label}, ${otherTier.cards + deal.bonusCards} players, ${1 + deal.bonusCards} guaranteed ${otherTier.guaranteedMinOvr}+ OVR. ${viewLabel}`} className="group flex min-h-[78px] w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                  <PackArt src={otherTier.artSrc} loading="eager" className="h-[62px] w-[42px] shrink-0 object-contain drop-shadow-md" fallback={<div className="h-[62px] w-[42px] shrink-0 rounded-md" style={{ background: otherTier.gradientFrom }} />} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs font-semibold"><span>{otherTier.label}</span>{priceFor(deal.tierKey) && <span className="text-[11px] text-amber-200">Only {priceFor(deal.tierKey)}</span>}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] font-medium tabular-nums text-white/90">{otherTier.cards + deal.bonusCards} players</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white/90">
                        <ShieldCheck className="h-2.5 w-2.5 shrink-0 text-amber-200/80" />{1 + deal.bonusCards} × {otherTier.guaranteedMinOvr}+
                      </span>
                    </span>
                    <span className="mt-1 block text-[9px] text-slate-400">Guaranteed ratings · includes {deal.bonusCards} bonus</span>
                    <span className="mt-1 block text-[10px] tabular-nums text-amber-200/90">{formatDealRemaining(deal.remainingMs)} left</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-amber-200" />
                </button>;
              })}
            </div>
          </div>}
        </div>
        <footer className="px-4 pb-3 pt-2"><button type="button" onClick={dismiss} className="min-h-11 w-full rounded-xl text-xs text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">Maybe later</button></footer>
      </motion.div>
    </div>, document.body,
  );
}
