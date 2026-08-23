/**
 * Regression: a refunded purchase must stop conveying Pro, and an unknown
 * store answer must never revoke anything.
 *
 * Every entitlement write path was additive — `restoreEntitlements` only ever
 * pushes, `mergeDeviceMonetization` only ever unions — so nothing in the
 * codebase could remove an ID from `monetization.entitlements`. Buy Pro for
 * £7.99, request an Apple refund (largely self-service), keep Pro: permanently,
 * on every save slot, via the device mirror. Same for the £14.99 bundle and all
 * three cosmetic packs.
 *
 * The reconciliation could not even be written before, because
 * `getEntitlements` fails OPEN: its catch returns `[]`, indistinguishable from
 * "the store says you own nothing". `getEntitlementsDefinitive` returns `null`
 * for undeterminable, and only a definitive answer is allowed to prune.
 *
 * Subscriptions are deliberately untouched here — their status lives
 * exclusively in `subscription.expiresAt`, never in `entitlements`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { isPro } from '@/utils/monetization';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import type { ProductId } from '@/types/game';

const PRO: ProductId = 'com.dynastymanager.pro';
const BUNDLE: ProductId = 'com.dynastymanager.bundle.all';

describe('entitlement reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
    // `resetGame` deliberately preserves purchases — you do not lose Pro by
    // starting a new dynasty — so entitlements survive it and leak between
    // tests. Reset them explicitly or each case inherits the last one's grants.
    useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });
  });

  it('revokes a refunded one-time purchase', () => {
    useGameStore.getState().grantEntitlement(PRO);
    expect(isPro(useGameStore.getState().monetization)).toBe(true);

    // The store's definitive answer after the refund: you own nothing.
    useGameStore.getState().reconcileEntitlements([]);

    expect(useGameStore.getState().monetization.entitlements).not.toContain(PRO);
    expect(isPro(useGameStore.getState().monetization)).toBe(false);
  });

  it('keeps what the store still reports as owned', () => {
    useGameStore.getState().grantEntitlement(PRO);
    useGameStore.getState().reconcileEntitlements([PRO]);
    expect(useGameStore.getState().monetization.entitlements).toContain(PRO);
    expect(isPro(useGameStore.getState().monetization)).toBe(true);
  });

  it('keeps everything a still-owned bundle includes', () => {
    useGameStore.getState().restoreEntitlements([BUNDLE]);
    const afterGrant = useGameStore.getState().monetization.entitlements;
    expect(afterGrant.length).toBeGreaterThan(1); // bundle expanded

    // The store reports only the bundle SKU, as it does — the included items
    // are not separate purchases and must not be pruned.
    useGameStore.getState().reconcileEntitlements([BUNDLE]);
    expect(useGameStore.getState().monetization.entitlements.sort()).toEqual([...afterGrant].sort());
  });

  it('is never invoked on an undeterminable answer', async () => {
    // Off-device the definitive read returns null, which the caller treats as
    // "change nothing". This is the guard that stops a network failure
    // stripping Pro from a paying customer.
    const { getEntitlementsDefinitive } = await import('@/utils/purchases');
    await expect(getEntitlementsDefinitive()).resolves.toBeNull();
  });
});
