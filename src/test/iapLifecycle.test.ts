/**
 * IAP lifecycle, end to end through the real code: RevenueCat SDK (mocked at
 * the Capacitor-plugin boundary, on a simulated iOS device) → utils/purchases
 * → utils/purchaseSync → the monetization slice → isPro().
 *
 * Every non-consumable purchase surface (paywall, Shop, Settings → Restore)
 * goes through `purchaseAndSync` / `restoreAndSync`, so these tests pin what a
 * player actually gets for each outcome the store can produce. Consumable
 * packs have their own proof-of-payment path — see packCreditRecovery.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import { useGameStore } from '@/store/gameStore';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { purchaseAndSync, restoreAndSync, syncStoreState } from '@/utils/purchaseSync';
import { __resetClockHighWaterCache } from '@/store/helpers/persistence';
import type { ProductId } from '@/types/game';

const DAY = 24 * 60 * 60 * 1000;
const MONTHLY: ProductId = 'com.dynastymanager.pro.monthly';
const YEARLY: ProductId = 'com.dynastymanager.pro.yearly';
const LIFETIME: ProductId = 'com.dynastymanager.pro.lifetime';
const BUNDLE: ProductId = 'com.dynastymanager.bundle.all';
const MANAGER_PACK: ProductId = 'com.dynastymanager.pack.manager';

const iso = (ms: number) => new Date(ms).toISOString();

interface EntitlementOpts {
  expiresInDays?: number | null;
  isActive?: boolean;
  periodType?: string;
  billingIssue?: boolean;
  unsubscribed?: boolean;
}

/** A RevenueCat `pro` entitlement unlocked by `productId`. */
function proEntitlement(productId: ProductId, opts: EntitlementOpts = {}) {
  const { expiresInDays = 30, isActive = true, periodType = 'NORMAL', billingIssue = false, unsubscribed = false } = opts;
  return {
    identifier: 'pro',
    isActive,
    willRenew: !unsubscribed,
    periodType,
    productIdentifier: productId,
    productPlanIdentifier: null,
    expirationDate: expiresInDays == null ? null : iso(Date.now() + expiresInDays * DAY),
    billingIssueDetectedAt: billingIssue ? iso(Date.now() - DAY) : null,
    unsubscribeDetectedAt: unsubscribed ? iso(Date.now() - DAY) : null,
  };
}

/** A CustomerInfo payload in the shape the Capacitor bridge delivers. */
function customer(opts: {
  active?: Record<string, unknown>;
  all?: Record<string, unknown>;
  purchased?: string[];
} = {}) {
  const active = opts.active ?? {};
  return {
    entitlements: { active, all: opts.all ?? active },
    allPurchasedProductIdentifiers: opts.purchased ?? [],
    activeSubscriptions: [],
    originalAppUserId: '$RCAnonymousID:test',
    nonSubscriptionTransactions: [],
  };
}

/** The store will sell `productId` through the current offering. */
function storeSells(productId: ProductId) {
  mockPurchases.getOfferings.mockResolvedValue({
    current: { availablePackages: [{ product: { identifier: productId, priceString: '$1.00' } }] },
    all: {},
  });
}

/** The customer record every later read returns. */
function storeRecord(info: ReturnType<typeof customer>) {
  mockPurchases.getCustomerInfo.mockResolvedValue({ customerInfo: info });
}

const monetization = () => useGameStore.getState().monetization;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  __resetClockHighWaterCache();
  mockPurchases.setLogLevel.mockResolvedValue(undefined);
  mockPurchases.configure.mockResolvedValue(undefined);
  mockPurchases.getProducts.mockResolvedValue({ products: [] });
  storeRecord(customer());
  useGameStore.setState({
    monetization: {
      ...DEFAULT_MONETIZATION_STATE,
      entitlements: [],
      activeCosmetics: {},
      adRewardsClaimed: {},
      subscription: null,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('one purchase path for every surface (purchaseAndSync)', () => {
  it('a store that completes a PAID subscription the customer record has not caught up with still unlocks Pro', async () => {
    storeSells(MONTHLY);
    // Transaction completed, but the entitlement is not on the record yet.
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: customer() });

    const outcome = await purchaseAndSync(MONTHLY);

    expect(outcome.status).toBe('completed');
    expect(isPro(monetization())).toBe(true);
    const sub = monetization().subscription!;
    expect(sub.productId).toBe(MONTHLY);
    expect(sub.tier).toBe('monthly');
    // Bounded: no invented expiry, anchored on the write so it cannot be permanent.
    expect(sub.expiresAt).toBeNull();
    expect(sub.grantedAt).toBeTruthy();
  });

  it('that bounded local record ends after one billing period if the store never confirms it', async () => {
    storeSells(MONTHLY);
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: customer() });
    await purchaseAndSync(MONTHLY);
    expect(isPro(monetization())).toBe(true);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 33 * DAY);
    expect(isPro(monetization())).toBe(false);
  });

  it('the local record for a trial purchase uses the trial length the surface showed', async () => {
    storeSells(YEARLY);
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: customer() });

    const outcome = await purchaseAndSync(YEARLY, { trialDays: 7 });

    expect(outcome).toMatchObject({ status: 'completed', isTrial: true });
    const sub = monetization().subscription!;
    expect(sub).toMatchObject({ tier: 'trial', productId: YEARLY, isTrial: true });
    const days = (new Date(sub.expiresAt!).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('the store\'s own record wins over the local fallback', async () => {
    storeSells(YEARLY);
    const info = customer({ active: { pro: proEntitlement(YEARLY, { expiresInDays: 365 }) } });
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    await purchaseAndSync(YEARLY, { trialDays: 7 });

    // The paywall advertised a trial but the store charged: no trial record.
    expect(monetization().subscription).toMatchObject({ tier: 'annual', productId: YEARLY, isTrial: false });
  });

  it('a throw AFTER the charge is a completed purchase once the re-sync finds it (the Shop used to report it as failed)', async () => {
    storeSells(LIFETIME);
    mockPurchases.purchasePackage.mockRejectedValue({ message: 'receipt validation', code: '8' });
    storeRecord(customer({ active: { pro: proEntitlement(LIFETIME, { expiresInDays: null }) }, purchased: [LIFETIME] }));

    const outcome = await purchaseAndSync(LIFETIME);

    expect(outcome).toMatchObject({ status: 'completed', recovered: true });
    expect(isPro(monetization())).toBe(true);
  });

  it('a throw that the re-sync cannot explain is a failure and grants nothing', async () => {
    storeSells(LIFETIME);
    mockPurchases.purchasePackage.mockRejectedValue({ message: 'Store problem', code: '2' });

    const outcome = await purchaseAndSync(LIFETIME);

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toBeTruthy();
    expect(isPro(monetization())).toBe(false);
    expect(monetization().entitlements).toEqual([]);
  });
});

describe('restore (restoreAndSync) — the Settings, Shop and paywall button', () => {
  it('a subscription-only customer restores no entitlement IDs but is told Pro is active', async () => {
    const info = customer({ active: { pro: proEntitlement(YEARLY, { expiresInDays: 200 }) }, purchased: [YEARLY] });
    mockPurchases.restorePurchases.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    const result = await restoreAndSync();

    expect(result.restored).toEqual([]);
    expect(result.proActive).toBe(true);
    // The subscription SKU never lands in entitlements (it would outlive the sub).
    expect(monetization().entitlements).not.toContain(YEARLY);
    expect(isSubscriptionActive(monetization())).toBe(true);
  });

  it('a fresh install recovers one-time purchases, expanding the bundle', async () => {
    const info = customer({ active: { pro: proEntitlement(BUNDLE, { expiresInDays: null }) }, purchased: [BUNDLE] });
    mockPurchases.restorePurchases.mockResolvedValue({ customerInfo: info });
    storeRecord(info);

    const result = await restoreAndSync();

    expect(result.restored).toContain(BUNDLE);
    expect(monetization().entitlements).toEqual(expect.arrayContaining([BUNDLE, LIFETIME, MANAGER_PACK]));
    expect(isPro(monetization())).toBe(true);
  });

  it('throws when the store call fails, so the surface says "Restore failed" not "nothing found"', async () => {
    mockPurchases.restorePurchases.mockRejectedValue(new Error('offline'));
    await expect(restoreAndSync()).rejects.toThrow('offline');
  });
});

describe('syncStoreState never clears a subscription on an empty answer', () => {
  it('keeps an active local subscription when the store payload has no pro entitlement at all', async () => {
    useGameStore.getState().updateSubscription({
      tier: 'monthly', productId: MONTHLY, expiresAt: iso(Date.now() + 20 * DAY),
      isInGracePeriod: false, willRenew: true, isTrial: false,
    });
    mockPurchases.getCustomerInfo.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });

    const { subscription, proActive } = await syncStoreState();

    expect(subscription).toBeNull();
    expect(proActive).toBe(true);
  });
});
