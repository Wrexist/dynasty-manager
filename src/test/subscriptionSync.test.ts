/**
 * G2 defect 2 — a transient/empty RevenueCat customerInfo must never clear an
 * active subscription. extractSubscriptionInfo returns null when a payload
 * carries no active pro entitlement (including transient sync glitches), and
 * writing that null would wipe subscription.expiresAt — the ONLY source of
 * subscription truth — transiently stripping Pro from a paying user.
 *
 * These tests exercise the exact guard the sync sites use:
 *   const sub = extractSubscriptionInfo(info); if (sub) updateSubscription(sub);
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import { useGameStore } from '@/store/gameStore';
import { extractSubscriptionInfo } from '@/utils/purchases';
import { isPro } from '@/utils/monetization';
import type { SubscriptionInfo } from '@/types/game';

const CLUB_ID = 'manchester-city';

/** An active monthly subscription expiring a year from now. */
function activeSub(): SubscriptionInfo {
  return {
    tier: 'monthly',
    productId: 'com.dynastymanager.pro.monthly',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isInGracePeriod: false,
    willRenew: true,
    isTrial: false,
  };
}

/** A customerInfo with NO active pro entitlement — the transient-glitch shape. */
const emptyCustomerInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;

/** Apply the production guard used at every sync site. */
function applySyncGuard(info: CustomerInfo | null) {
  const sub = extractSubscriptionInfo(info);
  if (sub) useGameStore.getState().updateSubscription(sub);
}

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('extractSubscriptionInfo', () => {
  it('returns null for null customerInfo', () => {
    expect(extractSubscriptionInfo(null)).toBeNull();
  });

  it('returns null when there is no active pro entitlement (transient glitch)', () => {
    expect(extractSubscriptionInfo(emptyCustomerInfo)).toBeNull();
  });
});

describe('subscription sync guard', () => {
  it('a null extract result does NOT clear an active subscription', () => {
    useGameStore.getState().updateSubscription(activeSub());
    expect(isPro(useGameStore.getState().monetization)).toBe(true);

    // Simulate a sync tick with a transient/empty customerInfo.
    applySyncGuard(emptyCustomerInfo);

    // Subscription (and therefore Pro) survives.
    expect(useGameStore.getState().monetization.subscription).not.toBeNull();
    expect(isPro(useGameStore.getState().monetization)).toBe(true);
  });

  it('a genuinely expired local subscription lapses via expiresAt, not a null-clear', () => {
    useGameStore.getState().updateSubscription({
      ...activeSub(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    // Record still present, but isPro is false because expiresAt has passed.
    expect(useGameStore.getState().monetization.subscription).not.toBeNull();
    expect(isPro(useGameStore.getState().monetization)).toBe(false);

    // A transient sync doesn't resurrect or further mutate it.
    applySyncGuard(emptyCustomerInfo);
    expect(isPro(useGameStore.getState().monetization)).toBe(false);
  });
});
