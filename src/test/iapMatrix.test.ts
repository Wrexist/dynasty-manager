/**
 * Every SKU × every store outcome, through the real purchase path on a
 * simulated iOS device (RevenueCat mocked at the Capacitor-plugin boundary).
 *
 * This is the code half of docs/iap-verification.md: each row of that matrix
 * names the test here that covers it. What code cannot prove — StoreKit
 * sandbox behaviour, App Store Connect / RevenueCat configuration — is the
 * device checklist in the same doc.
 *
 * Families:
 *  - Pro subscriptions (Monthly, Yearly): status lives ONLY in
 *    `monetization.subscription`; the SKU never enters `entitlements`.
 *  - Pro one-time (Lifetime, Dynasty Edition bundle; the retired
 *    `com.dynastymanager.pro` is restore-only): `entitlements`.
 *  - Cosmetic packs (Manager / Stadium / Legacy): `entitlements`, no Pro.
 *  - Consumable player packs: never an entitlement, never restorable; proof of
 *    payment is the pack-credit marker (packCreditRecovery.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const mockPurchases = {
  setLogLevel: vi.fn().mockResolvedValue(undefined),
  configure: vi.fn().mockResolvedValue(undefined),
  getOfferings: vi.fn(),
  getProducts: vi.fn(),
  purchasePackage: vi.fn(),
  purchaseStoreProduct: vi.fn(),
  restorePurchases: vi.fn(),
  syncPurchases: vi.fn().mockResolvedValue(undefined),
  invalidateCustomerInfoCache: vi.fn().mockResolvedValue(undefined),
  getCustomerInfo: vi.fn(),
  checkTrialOrIntroductoryPriceEligibility: vi.fn(),
};

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
});

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO' },
  INTRO_ELIGIBILITY_STATUS: {
    INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
    INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
    INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
    INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS: 3,
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import * as Sentry from '@sentry/react';
import { useGameStore } from '@/store/gameStore';
import {
  PRODUCTS, CONSUMABLE_PRODUCT_IDS, PRO_ONE_TIME_PRODUCT_IDS, RETIRED_PRODUCT_IDS,
  SUB_TRIAL_PRODUCT_IDS, TRIAL_TARGET_PRODUCT_ID, DEFAULT_MONETIZATION_STATE,
} from '@/config/monetization';
import { PACK_TIER_MAP, PAID_PACK_TIERS } from '@/config/packs';
import { isPro, isSubscriptionActive, isPersistableEntitlement, hasProduct } from '@/utils/monetization';
import { purchaseAndSync, restoreAndSync, purchaseLanded } from '@/utils/purchaseSync';
import {
  purchaseConsumable, restorePurchases, extractSubscriptionInfo,
  isPaymentPendingError, isPurchaseNotAttempted,
} from '@/utils/purchases';
import { __resetClockHighWaterCache } from '@/store/helpers/persistence';
import type { ProductId } from '@/types/game';
import { DAY, iso, customer, proEntitlement, STORE_ERRORS } from './helpers/revenueCat';

const MONTHLY: ProductId = 'com.dynastymanager.pro.monthly';
const YEARLY: ProductId = 'com.dynastymanager.pro.yearly';
const LIFETIME: ProductId = 'com.dynastymanager.pro.lifetime';
const BUNDLE: ProductId = 'com.dynastymanager.bundle.all';
const RETIRED_PRO: ProductId = 'com.dynastymanager.pro';
const COSMETICS: ProductId[] = [
  'com.dynastymanager.pack.manager',
  'com.dynastymanager.pack.stadium',
  'com.dynastymanager.pack.legends',
];

type Family = 'subscription' | 'pro-one-time' | 'cosmetic';

const NON_CONSUMABLES: { id: ProductId; family: Family }[] = [
  { id: MONTHLY, family: 'subscription' },
  { id: YEARLY, family: 'subscription' },
  { id: LIFETIME, family: 'pro-one-time' },
  { id: BUNDLE, family: 'pro-one-time' },
  ...COSMETICS.map(id => ({ id, family: 'cosmetic' as const })),
];

/** What RevenueCat reports once `id` is owned. */
function ownedRecord(id: ProductId, family: Family) {
  if (family === 'subscription') {
    return customer({ active: { pro: proEntitlement(id, { expiresInDays: id === YEARLY ? 365 : 30 }) }, purchased: [id] });
  }
  if (family === 'pro-one-time') {
    return customer({ active: { pro: proEntitlement(id, { expiresInDays: null }) }, purchased: [id] });
  }
  // Cosmetic packs carry no RevenueCat entitlement — only the purchase record.
  return customer({ purchased: [id] });
}

function storeSells(id: ProductId) {
  mockPurchases.getOfferings.mockResolvedValue({
    current: { availablePackages: [{ product: { identifier: id, priceString: '$1.00' } }] },
    all: {},
  });
}

function storeRecord(info: ReturnType<typeof customer>) {
  mockPurchases.getCustomerInfo.mockResolvedValue({ customerInfo: info });
}

const monetization = () => useGameStore.getState().monetization;

function nothingGranted() {
  expect(monetization().entitlements).toEqual([]);
  expect(monetization().subscription).toBeNull();
  expect(isPro(monetization())).toBe(false);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  __resetClockHighWaterCache();
  mockPurchases.setLogLevel.mockResolvedValue(undefined);
  mockPurchases.configure.mockResolvedValue(undefined);
  mockPurchases.getProducts.mockResolvedValue({ products: [] });
  storeRecord(customer());
  useGameStore.setState({
    monetization: { ...DEFAULT_MONETIZATION_STATE, entitlements: [], activeCosmetics: {}, adRewardsClaimed: {}, subscription: null },
  });
});

describe.each(NON_CONSUMABLES)('$id ($family)', ({ id, family }) => {
  it('purchase → granted, persisted in the right place, Pro exactly when it should be', async () => {
    storeSells(id);
    const info = ownedRecord(id, family);
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    const outcome = await purchaseAndSync(id);

    expect(outcome.status).toBe('completed');
    expect(purchaseLanded(id)).toBe(true);
    if (family === 'subscription') {
      expect(monetization().entitlements).not.toContain(id);
      expect(monetization().subscription).toMatchObject({ productId: id, tier: PRODUCTS[id].subscriptionTier });
      expect(isSubscriptionActive(monetization())).toBe(true);
    } else {
      expect(monetization().entitlements).toContain(id);
    }
    expect(isPro(monetization())).toBe(family !== 'cosmetic');
  });

  it('user cancel → nothing granted, not reported', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockRejectedValue(STORE_ERRORS.cancel);

    expect((await purchaseAndSync(id)).status).toBe('cancelled');
    nothingGranted();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('Ask to Buy (payment pending) → waiting, nothing granted, not reported', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockRejectedValue(STORE_ERRORS.pending);

    expect((await purchaseAndSync(id)).status).toBe('pending');
    nothingGranted();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('store error → failed, nothing granted, reported', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockRejectedValue(STORE_ERRORS.storeProblem);

    const outcome = await purchaseAndSync(id);

    expect(outcome.status).toBe('failed');
    nothingGranted();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('product unavailable → failed before the store sheet opens', async () => {
    mockPurchases.getOfferings.mockResolvedValue({ current: null, all: {} });
    mockPurchases.getProducts.mockResolvedValue({ products: [] });

    const outcome = await purchaseAndSync(id);

    expect(outcome.status).toBe('failed');
    expect(isPurchaseNotAttempted(outcome.error)).toBe(true);
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    expect(mockPurchases.purchaseStoreProduct).not.toHaveBeenCalled();
    nothingGranted();
  });

  it('restore on a fresh install → owned again', async () => {
    const info = ownedRecord(id, family);
    mockPurchases.restorePurchases.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    const result = await restoreAndSync();

    expect(purchaseLanded(id)).toBe(true);
    expect(result.proActive).toBe(family !== 'cosmetic');
    // A subscription SKU is never a persisted entitlement, even when restored.
    if (family === 'subscription') expect(result.restored).not.toContain(id);
    else expect(result.restored).toContain(id);
  });
});

describe('the retired com.dynastymanager.pro (grandfathered, restore-only)', () => {
  it('is never offered for sale but still restores Pro for its owners', async () => {
    expect(RETIRED_PRODUCT_IDS).toContain(RETIRED_PRO);
    expect(PRO_ONE_TIME_PRODUCT_IDS).toContain(RETIRED_PRO);
    const info = customer({ active: { pro: proEntitlement(RETIRED_PRO, { expiresInDays: null }) }, purchased: [RETIRED_PRO] });
    mockPurchases.restorePurchases.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    const result = await restoreAndSync();

    expect(result.restored).toContain(RETIRED_PRO);
    expect(isPro(monetization())).toBe(true);
  });
});

describe.each(PAID_PACK_TIERS.map(key => PACK_TIER_MAP[key].productId as ProductId))('consumable %s', (id) => {
  it('purchase → true, and nothing is written to entitlements', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: customer({ purchased: [id] }) });

    await expect(purchaseConsumable(id)).resolves.toBe(true);
    expect(monetization().entitlements).toEqual([]);
  });

  it('user cancel → false (the Market drops its marker), not reported', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockRejectedValue(STORE_ERRORS.cancel);

    await expect(purchaseConsumable(id)).resolves.toBe(false);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('Ask to Buy → rethrown as pending (the Market keeps a deferred marker), not reported', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockRejectedValue(STORE_ERRORS.pending);

    const err = await purchaseConsumable(id).catch(e => e);
    expect(isPaymentPendingError(err)).toBe(true);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('store error → thrown and reported (the Market keeps the marker: it may have charged)', async () => {
    storeSells(id);
    mockPurchases.purchasePackage.mockRejectedValue(STORE_ERRORS.storeProblem);

    const err = await purchaseConsumable(id).catch(e => e);
    expect(err).toBeTruthy();
    expect(isPurchaseNotAttempted(err)).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('product unavailable → not attempted (the Market drops its marker)', async () => {
    mockPurchases.getOfferings.mockResolvedValue({ current: null, all: {} });
    mockPurchases.getProducts.mockResolvedValue({ products: [] });

    const err = await purchaseConsumable(id).catch(e => e);
    expect(isPurchaseNotAttempted(err)).toBe(true);
  });

  it('is never restorable and never persistable', async () => {
    mockPurchases.restorePurchases.mockResolvedValue({ customerInfo: customer({ purchased: [id] }) });

    await expect(restorePurchases()).resolves.toEqual([]);
    expect(isPersistableEntitlement(id)).toBe(false);
    useGameStore.getState().grantEntitlement(id);
    useGameStore.getState().restoreEntitlements([id]);
    expect(monetization().entitlements).toEqual([]);
  });
});

describe.each([MONTHLY, YEARLY])('a lapsed %s subscription', (sub) => {
  const lapsed = () => ({
    tier: PRODUCTS[sub].subscriptionTier!, productId: sub, expiresAt: iso(Date.now() - DAY),
    isInGracePeriod: false, willRenew: false, isTrial: false,
  });

  it('loses Pro on its own', () => {
    useGameStore.getState().updateSubscription(lapsed());
    expect(isPro(monetization())).toBe(false);
  });

  it.each([LIFETIME, BUNDLE, RETIRED_PRO])('keeps Pro when %s is owned', (keeper) => {
    useGameStore.getState().updateSubscription(lapsed());
    useGameStore.getState().grantEntitlement(keeper);
    expect(isPro(monetization())).toBe(true);
    expect(isSubscriptionActive(monetization())).toBe(false);
  });

  it('never regains Pro from the store\'s forever-list of purchased IDs', async () => {
    useGameStore.getState().updateSubscription(lapsed());
    const info = customer({ purchased: [sub] });
    mockPurchases.restorePurchases.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    const result = await restoreAndSync();

    expect(result.proActive).toBe(false);
    expect(monetization().entitlements).not.toContain(sub);
  });
});

describe('subscription states the Shop and Settings render', () => {
  it.each([MONTHLY, YEARLY])('%s free trial → tier "trial", isTrial, plan kept', (sub) => {
    const info = extractSubscriptionInfo(customer({
      active: { pro: proEntitlement(sub, { expiresInDays: 7, periodType: 'TRIAL' }) },
    }) as never)!;
    expect(info).toMatchObject({ tier: 'trial', productId: sub, isTrial: true, willRenew: true });
  });

  it('billing grace period → still active, flagged', () => {
    const info = extractSubscriptionInfo(customer({
      active: { pro: proEntitlement(YEARLY, { expiresInDays: 10, billingIssue: true }) },
    }) as never)!;
    expect(info.isInGracePeriod).toBe(true);
    useGameStore.getState().updateSubscription(info);
    expect(isPro(monetization())).toBe(true);
  });

  it('cancelled but still paid up → active until expiry, will not renew', () => {
    const info = extractSubscriptionInfo(customer({
      active: { pro: proEntitlement(MONTHLY, { expiresInDays: 9, unsubscribed: true }) },
    }) as never)!;
    expect(info.willRenew).toBe(false);
    useGameStore.getState().updateSubscription(info);
    expect(isPro(monetization())).toBe(true);
  });
});

describe('catalogue invariants (CLAUDE.md → Entitlement invariants)', () => {
  it('product IDs are byte-for-byte the App Store Connect / RevenueCat IDs', () => {
    // A mismatch fails silently (the product resolves as "not available").
    // Yearly shipped as `.pro.annual` against a store product `.pro.yearly`.
    expect(Object.keys(PRODUCTS).sort()).toEqual([
      'com.dynastymanager.bundle.all',
      'com.dynastymanager.pack.gold',
      'com.dynastymanager.pack.icon',
      'com.dynastymanager.pack.legends',
      'com.dynastymanager.pack.manager',
      'com.dynastymanager.pack.premium_gold',
      'com.dynastymanager.pack.rare_gold',
      'com.dynastymanager.pack.stadium',
      'com.dynastymanager.pro',
      'com.dynastymanager.pro.lifetime',
      'com.dynastymanager.pro.monthly',
      'com.dynastymanager.pro.yearly',
    ]);
    for (const [key, def] of Object.entries(PRODUCTS)) expect(def.id).toBe(key);
    expect(PAID_PACK_TIERS.map(k => PACK_TIER_MAP[k].productId).sort()).toEqual([...CONSUMABLE_PRODUCT_IDS].sort());
  });

  it('both subscriptions carry the trial and share one trial target', () => {
    expect([...SUB_TRIAL_PRODUCT_IDS].sort()).toEqual([MONTHLY, YEARLY].sort());
    expect(SUB_TRIAL_PRODUCT_IDS).toContain(TRIAL_TARGET_PRODUCT_ID);
  });

  it('only one-time Pro SKUs may convey Pro through entitlements', () => {
    for (const id of PRO_ONE_TIME_PRODUCT_IDS) expect(PRODUCTS[id].type).toBe('one_time');
    for (const id of [MONTHLY, YEARLY]) {
      expect(isPersistableEntitlement(id)).toBe(false);
      // Even a hand-edited entitlement list cannot make a subscription SKU Pro.
      expect(isPro({ ...DEFAULT_MONETIZATION_STATE, entitlements: [id] })).toBe(false);
    }
  });

  it('the Pro entitlement is read as `pro` (dashboard) or `dynasty_pro` (legacy alias), nothing else', () => {
    const active = (key: string) => customer({ active: { [key]: { ...proEntitlement(MONTHLY), identifier: key } } }) as never;
    expect(extractSubscriptionInfo(active('pro'))?.productId).toBe(MONTHLY);
    expect(extractSubscriptionInfo(active('dynasty_pro'))?.productId).toBe(MONTHLY);
    expect(extractSubscriptionInfo(active('premium'))).toBeNull();
  });

  it('the RevenueCat hosted paywall is not reintroduced (Apple 3.1.2(c))', () => {
    const root = resolve(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== 'test') walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        const code = readFileSync(path, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/presentPaywall\s*\(|purchases-capacitor-ui/.test(code)) offenders.push(path);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it('cosmetic ownership never conveys Pro', () => {
    for (const id of COSMETICS) {
      expect(isPro({ ...DEFAULT_MONETIZATION_STATE, entitlements: [id] })).toBe(false);
      expect(hasProduct({ ...DEFAULT_MONETIZATION_STATE, entitlements: [id] }, id)).toBe(true);
    }
  });
});
