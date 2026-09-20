import { PACK_DEAL_SLOTS, PAID_PACK_TIERS } from '@/config/packs';
import type { PackTierKey } from '@/types/game';
import { observeClock } from '@/store/helpers/persistence';

// Accepted local-clock tradeoff: jumping forward can find another offer, but
// the persisted high-water clock prevents returning to an earlier window.
export interface ActivePackDeal {
  slotId: typeof PACK_DEAL_SLOTS[number]['id'];
  tierKey: PackTierKey;
  bonusCards: number;
  endsAt: number;
  remainingMs: number;
}

export function getActiveDeals(now = observeClock()): ActivePackDeal[] {
  return PACK_DEAL_SLOTS.map((slot, index) => {
    const cycle = Math.floor(now / slot.windowMs);
    const pick = (cycle * 3 + index) % PAID_PACK_TIERS.length;
    const tierKey = PAID_PACK_TIERS[pick];
    const endsAt = (cycle + 1) * slot.windowMs;
    return { slotId: slot.id, tierKey, bonusCards: slot.bonusCards, endsAt, remainingMs: endsAt - now };
  });
}

export function getDealForTier(tier: PackTierKey, now = observeClock()) {
  return getActiveDeals(now).find(deal => deal.tierKey === tier) ?? null;
}

/** Show only the best live offer per SKU; underlying windows remain stable. */
export function getStoreDeals(now = observeClock()) {
  const seen = new Set<PackTierKey>();
  return getActiveDeals(now).filter(deal => {
    if (seen.has(deal.tierKey)) return false;
    seen.add(deal.tierKey);
    return true;
  });
}

let selectedDeal: ActivePackDeal | null = null;
export function selectPackDeal(deal: ActivePackDeal) { selectedDeal = deal; }
export function takeSelectedPackDeal() {
  const deal = selectedDeal;
  selectedDeal = null;
  return deal;
}

export function formatDealRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}
