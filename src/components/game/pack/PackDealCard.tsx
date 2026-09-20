import { useEffect } from 'react';
import { track } from '@/utils/analytics';
import { Clock, Plus } from 'lucide-react';
import { PACK_TIER_MAP } from '@/config/packs';
import { formatDealRemaining, type ActivePackDeal } from '@/utils/packDeals';

export function PackDealCard({ deal, price, available, onSelect, onOdds }: {
  deal: ActivePackDeal; price?: string; available: boolean; onSelect: () => void; onOdds: () => void;
}) {
  useEffect(() => {
    track('pack_deal_viewed', { slotId: deal.slotId, tierKey: deal.tierKey, bonusCards: deal.bonusCards });
  }, [deal.slotId, deal.tierKey, deal.bonusCards, deal.endsAt]);
  const tier = PACK_TIER_MAP[deal.tierKey];
  return (
    <article className="relative min-w-[220px] flex-1 overflow-hidden rounded-2xl border border-white/15 bg-card p-4"
      style={{ backgroundImage: `linear-gradient(145deg, ${tier.gradientFrom}, transparent 85%)` }}>
      <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-wider">
        <span className="flex items-center rounded-full bg-black/25 px-2 py-1 text-white"><Plus className="h-3 w-3" />{deal.bonusCards} bonus card{deal.bonusCards === 1 ? '' : 's'}</span>
        <Clock className="h-4 w-4 text-white/70" />
      </div>
      <h4 className="mt-4 font-display text-lg font-bold text-white">{tier.label}</h4>
      <p className="text-xs text-white/80">{tier.cards + deal.bonusCards} players · normally {tier.cards}</p>
      <p className="mt-3 text-xs tabular-nums text-white">Bonus ends in {formatDealRemaining(deal.remainingMs)}</p>
      <button type="button" onClick={onSelect} disabled={!available}
        className="mt-3 min-h-11 w-full rounded-xl bg-white px-3 text-xs font-bold text-black transition active:scale-[0.98] disabled:opacity-40">
        {available ? `Buy ${price ?? 'in app'}` : 'Unavailable'}
      </button>
      <button type="button" onClick={onOdds} className="min-h-11 w-full text-xs text-white/80 underline underline-offset-4">Contents & odds</button>
    </article>
  );
}
