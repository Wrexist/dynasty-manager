/**
 * Regression: a paid pack must require proof of payment, and the daily free
 * allowance must be a real daily limit.
 *
 * Two independent ways to get paid content for nothing:
 *
 * 1. **The pending-credit marker was not proof of payment.** It is written
 *    BEFORE the StoreKit charge so a crash between charge and grant cannot eat
 *    a purchase — but the mount-time reconciler granted on the marker's mere
 *    existence. Any failed attempt left an identical record: enable Airplane
 *    Mode, tap the £9.99 Icon Pack, `buyProduct` throws "not available from the
 *    store" (a non-cancel error, so the marker was deliberately kept), navigate
 *    away and back, and the reconciler credits a guaranteed 88+ walkout. Repeat
 *    indefinitely. The marker now carries `charged`, promoted only once the
 *    store confirms, and failures that never reached the store are separated
 *    from failures that may have followed a charge.
 *
 * 2. **The daily free bucket lived in the save.** That made a "daily" pack
 *    per-slot (three saves = three free Gold packs a day) and rerollable by
 *    force-quitting after a bad pull, and it reset on date INEQUALITY, so
 *    winding the device clock backwards — or changing timezone — re-armed it.
 *    It is now one device-global record keyed on a monotonic day index.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit,
  readDailyPackOpens, writeDailyPackOpens, currentDayIndex,
  __resetSaveStorageForTests,
} from '@/store/helpers/persistence';
import { isPurchaseNotAttempted, PurchaseNotAttemptedError } from '@/utils/purchases';
import { useGameStore } from '@/store/gameStore';
import { PACK_TIER_MAP } from '@/config/packs';

const CLUB = 'manchester-city';

describe('pending pack credit is proof of payment, not of an attempt', () => {
  beforeEach(() => { localStorage.clear(); clearPendingPackCredit(); });

  it('round-trips the charged flag as a tri-state', () => {
    writePendingPackCredit({ productId: 'p', tierKey: 'icon', timestamp: 1, slot: 1, charged: false });
    expect(readPendingPackCredit()?.charged).toBe(false);

    writePendingPackCredit({ productId: 'p', tierKey: 'icon', timestamp: 1, slot: 1, charged: true });
    expect(readPendingPackCredit()?.charged).toBe(true);

    // A legacy marker (written before the flag existed) must stay
    // distinguishable from an explicit false — it is still honoured, because
    // only the old binary could have produced it.
    localStorage.setItem('dynasty-pending-pack-credit', JSON.stringify({ productId: 'p', tierKey: 'icon', timestamp: 1, slot: 1 }));
    expect(readPendingPackCredit()?.charged).toBeUndefined();
  });

  it('separates a store failure that never charged from one that might have', () => {
    // Everything before `purchasePackage` is definitively un-charged.
    expect(isPurchaseNotAttempted(new PurchaseNotAttemptedError('offline'))).toBe(true);
    // A receipt-validation style failure is NOT — its marker must survive.
    expect(isPurchaseNotAttempted(new Error('receipt validation failed'))).toBe(false);
  });
});

describe('daily free pack allowance is device-global and clock-monotonic', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    __resetSaveStorageForTests();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('a free open is spent immediately, outside the save', () => {
    const goldFree = PACK_TIER_MAP.gold?.freeDailyLimit ?? 0;
    expect(goldFree, 'gold must have a free daily allowance for this test to mean anything').toBeGreaterThan(0);

    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(true);
    const result = useGameStore.getState().openPack('gold', { method: 'free' });
    expect(result.success).toBe(true);

    // Spent — and recorded on the device, not in the save payload.
    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(false);
    expect(readDailyPackOpens().free.gold).toBe(1);
  });

  it('reloading the save does not refund the allowance', () => {
    useGameStore.getState().openPack('gold', { method: 'free' });
    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(false);

    // Force-quit + reload, the save-scum reroll: a brand-new session on the
    // same device must still see the allowance as spent.
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(false);
  });

  it('a second save slot shares the same daily allowance', () => {
    useGameStore.getState().openPack('gold', { method: 'free' });
    // A different career is still the same device and the same day.
    useGameStore.setState({ activeSlot: 2 });
    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(false);
  });

  it('winding the clock backwards does not re-arm it', () => {
    useGameStore.getState().openPack('gold', { method: 'free' });
    const spent = readDailyPackOpens();
    expect(spent.free.gold).toBe(1);

    // Pretend the stored record was written "tomorrow" — i.e. the device clock
    // has since gone backwards. Reset must require a STRICTLY GREATER day.
    writeDailyPackOpens({ ...spent, dayIndex: currentDayIndex() + 1 });
    expect(readDailyPackOpens().free.gold).toBe(1);
    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(false);
  });

  it('a genuinely new day does reset it', () => {
    useGameStore.getState().openPack('gold', { method: 'free' });
    // Record stamped a day in the past — the honest rollover case.
    writeDailyPackOpens({ ...readDailyPackOpens(), dayIndex: currentDayIndex() - 1 });
    expect(readDailyPackOpens().free.gold).toBeUndefined();
    expect(useGameStore.getState().canOpenPack('gold', 'free').ok).toBe(true);
  });
});
