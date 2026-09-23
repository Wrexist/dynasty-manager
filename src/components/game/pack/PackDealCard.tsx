import { useEffect } from 'react';
import { track } from '@/utils/analytics';
import { Clock, Plus, ShieldCheck, ShoppingBag, HelpCircle } from 'lucide-react';
import { PACK_TIER_MAP } from '@/config/packs';
import { formatDealRemaining, type ActivePackDeal } from '@/utils/packDeals';
import { PackArt } from './PackArt';

export function PackDealCard({ deal, price, available, onSelect, onOdds }: {
  deal: ActivePackDeal; price?: string; available: boolean; onSelect: () => void; onOdds: () => void;
}) {
  useEffect(() => {
    track('pack_deal_viewed', { slotId: deal.slotId, tierKey: deal.tierKey, bonusCards: deal.bonusCards });
  }, [deal.slotId, deal.tierKey, deal.bonusCards, deal.endsAt]);
  const tier = PACK_TIER_MAP[deal.tierKey];
  return (
    <article className="relative isolate w-[272px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-card p-3">
      <div aria-hidden className="pointer-events-none absolute -left-12 top-8 -z-10 h-44 w-44 rounded-full opacity-20 blur-3xl"
        style={{ background: tier.accent }} />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
          <Plus aria-hidden className="h-3 w-3" />{deal.bonusCards} bonus card{deal.bonusCards === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground" aria-label={`Bonus ends in ${formatDealRemaining(deal.remainingMs)}`}>
          <Clock aria-hidden className="h-3 w-3" />{formatDealRemaining(deal.remainingMs)} left
        </span>
      </div>
      <div className="my-3 flex min-h-36 items-center gap-3">
        <PackArt src={tier.artSrc} className="h-36 w-24 shrink-0 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.45)]"
          fallback={<div aria-hidden className="h-36 w-24 shrink-0 rounded-xl" style={{ background: `linear-gradient(145deg, ${tier.gradientFrom}, ${tier.gradientTo})` }} />} />
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-xl font-bold leading-tight text-foreground">{tier.label}</h4>
          <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">{tier.cards + deal.bonusCards} players</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Includes {deal.bonusCards} bonus</p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold tabular-nums text-foreground">
            <ShieldCheck aria-hidden className="h-3 w-3 shrink-0 text-primary" />{1 + deal.bonusCards} × {tier.guaranteedMinOvr}+ OVR
          </p>
          <p className="mt-1 text-[9px] text-muted-foreground">Guaranteed ratings</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSelect} disabled={!available}
          aria-label={`${available ? `Buy ${price ?? 'in app'}` : 'Unavailable'} — ${tier.label}`}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-primary px-3 text-xs font-bold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40">
          <ShoppingBag aria-hidden className="h-3.5 w-3.5 shrink-0" />{available ? `Buy ${price ?? 'in app'}` : 'Unavailable'}
        </button>
        <button type="button" onClick={onOdds} aria-label={`Contents and odds for ${tier.label}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <HelpCircle aria-hidden className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}
