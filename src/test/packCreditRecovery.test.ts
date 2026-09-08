/**
 * Launch-time pending-pack-credit reconciliation (utils/packCreditRecovery.ts).
 *
 * Regression context: the reconciler used to live only on PacksPage mount, so
 * a crash between StoreKit charge and grant stayed stranded until the player
 * happened to reopen Packs — and TTL-expired unclaimed if they never did.
 * The recovery now runs once per GameShell mount. These tests pin the
 * invariants that make that safe:
 *
 * - only `charged` markers grant (existence alone proves nothing);
 * - the credit is granted only into the save slot that paid;
 * - confirmed credits do not expire; unconfirmed markers are not granted;
 * - a blocked grant keeps the marker and flags it reported;
 * - World Cup sessions never receive a club pack credit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit,
} from '@/store/helpers/persistence';
import { useGameStore } from '@/store/gameStore';
import { reconcilePendingPackCreditAtLaunch, setPackPurchaseInFlight } from '@/utils/packCreditRecovery';

const CLUB = 'manchester-city';
const originalOpenPack = useGameStore.getState().openPack;
const originalFlushSave = useGameStore.getState().flushSave;

function squadSize(): number {
  const s = useGameStore.getState();
  return (s.clubs[s.playerClubId]?.playerIds || []).length;
}

describe('launch-time pack credit reconciliation', async () => {
  beforeEach(() => {
    useGameStore.setState({ openPack: originalOpenPack, flushSave: originalFlushSave });
    localStorage.clear();
    clearPendingPackCredit();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('grants a charged marker into the paying save and clears it', async () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    await reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBeGreaterThan(before);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('never grants an uncharged marker', async () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: false,
    });

    await reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('ignores a credit belonging to another save slot', async () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot === 1 ? 2 : 1,
      charged: true,
    });

    await reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).not.toBeNull();
  });

  it('preserves and delivers a confirmed purchase even after seven days', async () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    await reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBeGreaterThan(before);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('keeps and flags the marker when the grant is blocked', async () => {
    const spy = vi.fn(() => ({ success: false as const, message: 'Your squad is full.' }));
    useGameStore.setState({ openPack: spy });
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    await reconcilePendingPackCreditAtLaunch();

    expect(spy).toHaveBeenCalledTimes(1);
    const kept = readPendingPackCredit();
    expect(kept).not.toBeNull();
    expect(kept?.reported).toBe(true);
  });

  it('waits for disk and does not grant twice across concurrent mount effects', async () => {
    let finish!: (ok: boolean) => void;
    useGameStore.setState({ flushSave: vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; })) });
    writePendingPackCredit({ productId: 'com.dynastymanager.pack.gold', tierKey: 'gold', timestamp: Date.now(), slot: useGameStore.getState().activeSlot, charged: true });
    const pending = reconcilePendingPackCreditAtLaunch();
    const afterGrant = squadSize();
    expect(readPendingPackCredit()?.recordId).toBeTruthy();
    await reconcilePendingPackCreditAtLaunch();
    expect(squadSize()).toBe(afterGrant);
    finish(true);
    await pending;
    expect(readPendingPackCredit()).toBeNull();
  });

  it('retains a failed-save grant and retries saving without generating another pack', async () => {
    useGameStore.setState({ flushSave: vi.fn().mockResolvedValue(false) });
    writePendingPackCredit({ productId: 'com.dynastymanager.pack.gold', tierKey: 'gold', timestamp: Date.now(), slot: useGameStore.getState().activeSlot, charged: true });
    await reconcilePendingPackCreditAtLaunch();
    const afterGrant = squadSize();
    expect(readPendingPackCredit()).not.toBeNull();
    useGameStore.setState({ flushSave: vi.fn().mockResolvedValue(true) });
    await reconcilePendingPackCreditAtLaunch();
    expect(squadSize()).toBe(afterGrant);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('rejects a mismatched product id instead of granting a more valuable tier', async () => {
    const before = squadSize();
    writePendingPackCredit({ productId: 'com.dynastymanager.pack.gold', tierKey: 'icon', timestamp: Date.now(), slot: useGameStore.getState().activeSlot, charged: true });
    await reconcilePendingPackCreditAtLaunch();
    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).not.toBeNull();
  });

  it('does not clear the pre-charge marker while the store sheet is open', async () => {
    writePendingPackCredit({ productId: 'com.dynastymanager.pack.gold', tierKey: 'gold', timestamp: Date.now(), slot: useGameStore.getState().activeSlot, charged: false });
    setPackPurchaseInFlight(true);
    try {
      await reconcilePendingPackCreditAtLaunch();
      expect(readPendingPackCredit()?.charged).toBe(false);
    } finally { setPackPurchaseInFlight(false); }
  });

  it('retains proof of payment when recovery throws, without rejecting the mount effect', async () => {
    useGameStore.setState({ openPack: vi.fn(() => { throw new Error('generation failed'); }) });
    writePendingPackCredit({ productId: 'com.dynastymanager.pack.gold', tierKey: 'gold', timestamp: Date.now(), slot: useGameStore.getState().activeSlot, charged: true });
    await expect(reconcilePendingPackCreditAtLaunch()).resolves.toBeUndefined();
    expect(readPendingPackCredit()?.charged).toBe(true);
  });

  it('does nothing in a World Cup session', async () => {
    useGameStore.setState({ gameMode: 'world-cup' });
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    await reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).not.toBeNull();
  });
});
