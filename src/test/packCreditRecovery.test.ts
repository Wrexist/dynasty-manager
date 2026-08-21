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
 * - stale markers expire; unconfirmed markers are dropped;
 * - a blocked grant keeps the marker and flags it reported;
 * - World Cup sessions never receive a club pack credit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit,
} from '@/store/helpers/persistence';
import { useGameStore } from '@/store/gameStore';
import { reconcilePendingPackCreditAtLaunch } from '@/utils/packCreditRecovery';

const CLUB = 'manchester-city';

function squadSize(): number {
  const s = useGameStore.getState();
  return (s.clubs[s.playerClubId]?.playerIds || []).length;
}

describe('launch-time pack credit reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingPackCredit();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });

  it('grants a charged marker into the paying save and clears it', () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBeGreaterThan(before);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('never grants an uncharged marker', () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: false,
    });

    reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('ignores a credit belonging to another save slot', () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot === 1 ? 2 : 1,
      charged: true,
    });

    reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).not.toBeNull();
  });

  it('drops a stale charged marker past the TTL', () => {
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).toBeNull();
  });

  it('keeps and flags the marker when the grant is blocked', () => {
    const spy = vi.fn(() => ({ success: false as const, message: 'Your squad is full.' }));
    useGameStore.setState({ openPack: spy });
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    reconcilePendingPackCreditAtLaunch();

    expect(spy).toHaveBeenCalledTimes(1);
    const kept = readPendingPackCredit();
    expect(kept).not.toBeNull();
    expect(kept?.reported).toBe(true);
  });

  it('does nothing in a World Cup session', () => {
    useGameStore.setState({ gameMode: 'world-cup' });
    const before = squadSize();
    writePendingPackCredit({
      productId: 'com.dynastymanager.pack.gold',
      tierKey: 'gold',
      timestamp: Date.now(),
      slot: useGameStore.getState().activeSlot,
      charged: true,
    });

    reconcilePendingPackCreditAtLaunch();

    expect(squadSize()).toBe(before);
    expect(readPendingPackCredit()).not.toBeNull();
  });
});
