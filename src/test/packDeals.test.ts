import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveDeals, getStoreDeals, getDealForTier, formatDealRemaining } from '@/utils/packDeals';
import { PACK_DEAL_SLOTS, PACK_TIER_MAP } from '@/config/packs';
import { observeClock, __resetSaveStorageForTests, readPendingPackCredit, writePendingPackCredit } from '@/store/helpers/persistence';

describe('pack deals', () => {
  it('shows only the best offer per SKU throughout a rotation month', () => {
    for (let hour = 0; hour < 24 * 31; hour++) {
      const now = hour * 3600_000;
      const deals = getStoreDeals(now);
      expect(new Set(deals.map(d => d.tierKey)).size).toBe(deals.length);
      for (const deal of deals) expect(deal.bonusCards).toBe(Math.max(...getActiveDeals(now).filter(d => d.tierKey === deal.tierKey).map(d => d.bonusCards)));
    }
  });
  beforeEach(() => { localStorage.clear(); __resetSaveStorageForTests(); });
  it('uses deterministic paid-only slots that rotate exactly at their own boundary', () => {
    for (const slot of PACK_DEAL_SLOTS) {
      const end = slot.windowMs * 100;
      const before = getActiveDeals(end - 1).find(d => d.slotId === slot.id)!;
      const after = getActiveDeals(end).find(d => d.slotId === slot.id)!;
      expect(before.remainingMs).toBe(1);
      expect(before.endsAt).toBe(end);
      expect(after.tierKey).not.toBe(before.tierKey);
      expect(after.endsAt).toBe(end + slot.windowMs);
      expect(PACK_TIER_MAP[after.tierKey].productId).toBeTruthy();
      expect(getActiveDeals(end)).toEqual(getActiveDeals(end));
    }
  });
  it('keeps each offer stable through other slots rotating', () => {
    const now = 4 * 3600_000;
    expect(getActiveDeals(now).find(d => d.slotId === 'daily')?.tierKey)
      .toBe(getActiveDeals(now - 1).find(d => d.slotId === 'daily')?.tierKey);
  });
  it('selects the largest concurrent bonus and never bonuses free tiers', () => {
    for (let hour = 0; hour < 48; hour++) {
      const now = hour * 3600_000;
      for (const deal of getActiveDeals(now)) {
        expect(getDealForTier(deal.tierKey, now)!.bonusCards).toBeGreaterThanOrEqual(deal.bonusCards);
      }
      expect(getDealForTier('bronze', now)).toBeNull();
      expect(getDealForTier('silver', now)).toBeNull();
      expect(getDealForTier('daily', now)).toBeNull();
    }
  });
  it('does not restore expired offers after clock rollback', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(100 * 86400_000);
      const advanced = getActiveDeals(observeClock());
      vi.setSystemTime(90 * 86400_000);
      expect(getActiveDeals()).toEqual(advanced);
    } finally { vi.useRealTimers(); }
  });
  it('formats expiration without negative values or premature zero', () => {
    expect(formatDealRemaining(-1)).toBe('0m 00s');
    expect(formatDealRemaining(1)).toBe('0m 01s');
    expect(formatDealRemaining(3660_000)).toBe('1h 1m');
  });
  it('persists a purchased bonus past expiration and defaults legacy records to zero', () => {
    const marker = { productId: 'p', tierKey: 'gold', timestamp: 1, slot: 1, charged: true };
    writePendingPackCredit({ ...marker, bonusCards: 3, dealSlotId: 'flash' });
    expect(readPendingPackCredit()).toMatchObject({ bonusCards: 3, dealSlotId: 'flash' });
    writePendingPackCredit(marker);
    expect(readPendingPackCredit()?.bonusCards).toBe(0);
  });
});
