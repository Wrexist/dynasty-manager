import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePackDeals } from '@/hooks/usePackDeals';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import { PACK_TIER_MAP, PAID_PACK_TIERS } from '@/config/packs';
import { getStoreAvailability } from '@/utils/purchases';
import { claimPackUpsell } from '@/utils/packUpsell';
import { PackDealUpsell } from './PackDealUpsell';
import type { ProductId } from '@/types/game';
import { selectPackDeal } from '@/utils/packDeals';

/** Dashboard gaps only: never mounted over a match or the onboarding flow. */
export function PackDealOfferHost() {
  const deals = usePackDeals();
  const season = useGameStore(s => s.season);
  const week = useGameStore(s => s.week);
  const fixtures = useGameStore(s => s.fixtures);
  const clubId = useGameStore(s => s.playerClubId);
  const canOpen = useGameStore(s => s.canOpenPack);
  const [available, setAvailable] = useState<string[]>([]);
  const [prices, setPrices] = useState<Partial<Record<ProductId, string>>>({});
  const [settled, setSettled] = useState(false);
  const [open, setOpen] = useState(false);
  const attempted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => setSettled(true), 4000);
    void getStoreAvailability(PAID_PACK_TIERS.map(key => PACK_TIER_MAP[key].productId! as ProductId))
      .then(result => {
        if (!cancelled && result.supported) {
          setAvailable(result.available);
          setPrices(result.prices);
        }
      })
      .catch(() => { /* An unavailable store must never be promoted. */ });
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  const last = fixtures.filter(m => m.played && (m.homeClubId === clubId || m.awayClubId === clubId))
    .reduce<typeof fixtures[number] | undefined>((best, match) => !best || match.week > best.week ? match : best, undefined);
  const won = !!last && last.week >= week - 1 && (last.homeClubId === clubId ? last.homeGoals > last.awayGoals : last.awayGoals > last.homeGoals);
  const eligible = deals.filter(deal => available.includes(PACK_TIER_MAP[deal.tierKey].productId!)
    && canOpen(deal.tierKey, 'iap', deal.bonusCards).ok
    && (won || deal.remainingMs <= 3600_000));
  const wants = settled && !(season === 1 && week <= 2) && eligible.length > 0 && !attempted.current;
  const active = usePresentationSlot('packOffer', wants || open);
  useEffect(() => {
    if (!active || !wants || document.hidden) return;
    // Avoid competing with dialogs outside the presentation queue.
    if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
    attempted.current = true;
    if (claimPackUpsell(undefined, won ? 1 : 2)) setOpen(true);
  }, [active, wants, won]);
  if (!open || !active || eligible.length === 0) return null;
  return <PackDealUpsell prices={prices} trigger={won ? 'postWin' : 'dealExpiring'} deals={eligible} onClose={() => setOpen(false)} onView={deal => {
    selectPackDeal(deal);
    setOpen(false);
    useGameStore.getState().setScreen('packs');
  }} />;
}
