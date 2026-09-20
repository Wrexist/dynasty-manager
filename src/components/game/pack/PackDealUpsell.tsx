import { track } from '@/utils/analytics';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { PACK_TIER_MAP } from '@/config/packs';
import { formatDealRemaining, type ActivePackDeal } from '@/utils/packDeals';

export function PackDealUpsell({ deals, onClose, onView, trigger = 'postOpen', viewLabel = 'View contents & odds' }: {
  viewLabel?: string;
  trigger?: 'postOpen' | 'postWin' | 'dealExpiring';
  deals: ActivePackDeal[]; onClose: () => void; onView: (deal: ActivePackDeal) => void;
}) {
  const initialTrigger = useRef(trigger);
  useEffect(() => { track('pack_upsell_shown', { trigger: initialTrigger.current }); }, []);
  const dismiss = () => { track('pack_upsell_dismissed', { trigger }); onClose(); };
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();
  useFocusTrap(ref, true);
  useScrollLock();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { track('pack_upsell_dismissed', { trigger }); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, trigger]);
  const multiple = deals.length > 1;
  return createPortal(
    <div className={`fixed inset-0 z-[100] flex justify-center bg-black/65 p-4 backdrop-blur-md ${multiple ? 'items-end' : 'items-center'}`}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="pack-deal-title" tabIndex={-1}
        initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="relative w-full max-w-md overflow-y-auto rounded-3xl border border-white/20 bg-card p-6 shadow-2xl max-h-[85dvh]">
        <button type="button" onClick={dismiss} aria-label="Close pack offers" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"><X className="h-5 w-5" /></button>
        <Sparkles className="mb-4 h-7 w-7 text-amber-300" />
        <h2 id="pack-deal-title" className="pr-7 font-display text-2xl font-bold">More players in your next pack</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bonus cards on selected packs, at the usual store price.</p>
        <div className="mt-5 space-y-3">
          {deals.map(deal => (
            <button key={`${deal.slotId}-${deal.endsAt}`} type="button" onClick={() => onView(deal)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
              <span className="flex justify-between gap-3 text-sm font-semibold"><span>{PACK_TIER_MAP[deal.tierKey].label}</span><span className="text-amber-300">+{deal.bonusCards} card{deal.bonusCards === 1 ? '' : 's'}</span></span>
              <span className="mt-2 block text-xs tabular-nums text-muted-foreground">Bonus ends in {formatDealRemaining(deal.remainingMs)} · View contents & odds</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={dismiss} className="mt-3 min-h-11 w-full text-sm text-muted-foreground">Maybe later</button>
      </motion.div>
    </div>, document.body,
  );
}
