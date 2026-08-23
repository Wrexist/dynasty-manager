/**
 * App Store rejection 2.1.0 (build 1.2.5 / 174) — the reviewer tapped the
 * paywall CTA and got "Purchase Could Not Complete".
 *
 * Two defects in the purchase path could produce that banner without the
 * store ever charging anything:
 *
 *  1. Cancel misdetection. The Capacitor bridge rejects with the NUMERIC
 *     RevenueCat error code as a string ('1' = PURCHASE_CANCELLED_ERROR) and
 *     no `userCancelled` field on iOS. The old check looked for
 *     `err.userCancelled || err.code === 'PURCHASE_CANCELLED'`, so a plain
 *     sheet dismissal was reported to the user as a hard failure.
 *  2. Offering-only product lookup. A product missing from the RevenueCat
 *     offering threw before StoreKit was ever asked, even though the store
 *     itself could sell it.
 *
 * These tests pin both behaviours on a simulated iOS device.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPurchases = {
  setLogLevel: vi.fn().mockResolvedValue(undefined),
  configure: vi.fn().mockResolvedValue(undefined),
  getOfferings: vi.fn(),
  getProducts: vi.fn(),
  purchasePackage: vi.fn(),
  purchaseStoreProduct: vi.fn(),
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO' },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/react';
import {
  isUserCancelledError,
  purchaseProduct,
  purchaseConsumable,
  getStoreAvailability,
} from '@/utils/purchases';

const ANNUAL = 'com.dynastymanager.pro.yearly' as const;
const GOLD_PACK = 'com.dynastymanager.pack.gold' as const;

/** The exact shape iOS delivers: `call.reject(message, "\(error.code)", nsError)`. */
const iosCancel = { message: 'Purchase was cancelled.', code: '1' };
/** Android adds the hybrid-common info map as extra data. */
const androidCancel = { message: 'Purchase was cancelled.', code: '1', data: { userCancelled: 'true' } };

const emptyOfferings = { current: null, all: {} };
const storeProduct = { identifier: ANNUAL, priceString: '$14.99' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPurchases.setLogLevel.mockResolvedValue(undefined);
  mockPurchases.configure.mockResolvedValue(undefined);
});

describe('isUserCancelledError', () => {
  it('recognises the numeric iOS cancel code', () => {
    expect(isUserCancelledError(iosCancel)).toBe(true);
    expect(isUserCancelledError({ code: 1 })).toBe(true);
  });

  it('recognises the Android cancel payload', () => {
    expect(isUserCancelledError(androidCancel)).toBe(true);
    expect(isUserCancelledError({ userCancelled: true })).toBe(true);
  });

  it('recognises the legacy readable codes', () => {
    expect(isUserCancelledError({ code: 'PURCHASE_CANCELLED' })).toBe(true);
    expect(isUserCancelledError({ userInfo: { readableErrorCode: 'PURCHASE_CANCELLED_ERROR' } })).toBe(true);
  });

  it('does NOT swallow real failures as cancels', () => {
    expect(isUserCancelledError({ code: '2' })).toBe(false);   // STORE_PROBLEM
    expect(isUserCancelledError({ code: '10' })).toBe(false);  // NETWORK
    expect(isUserCancelledError({ code: '23' })).toBe(false);  // CONFIGURATION
    expect(isUserCancelledError(new Error('boom'))).toBe(false);
    expect(isUserCancelledError(null)).toBe(false);
    expect(isUserCancelledError('cancelled')).toBe(false);
  });
});

describe('purchaseProduct — cancel handling on device', () => {
  it('reports a dismissed StoreKit sheet as a cancel, not a failure', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [{ product: storeProduct }] },
      all: {},
    });
    mockPurchases.purchasePackage.mockRejectedValue(iosCancel);

    await expect(purchaseProduct(ANNUAL)).resolves.toEqual({ cancelled: true, granted: [] });
    // A cancel is not an error — it must never be reported to Sentry.
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('still throws (and reports) on a genuine store failure', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [{ product: storeProduct }] },
      all: {},
    });
    mockPurchases.purchasePackage.mockRejectedValue({ message: 'Store problem', code: '2' });

    await expect(purchaseProduct(ANNUAL)).rejects.toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('treats a cancelled consumable purchase as "no purchase" rather than an error', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [{ product: { identifier: GOLD_PACK } }] },
      all: {},
    });
    mockPurchases.purchasePackage.mockRejectedValue(androidCancel);

    await expect(purchaseConsumable(GOLD_PACK)).resolves.toBe(false);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('purchaseProduct — product resolution fallback', () => {
  it('buys straight from the store when the product is missing from every offering', async () => {
    mockPurchases.getOfferings.mockResolvedValue(emptyOfferings);
    mockPurchases.getProducts.mockResolvedValue({ products: [storeProduct] });
    mockPurchases.purchaseStoreProduct.mockResolvedValue({
      customerInfo: { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] },
    });

    const result = await purchaseProduct(ANNUAL);

    expect(mockPurchases.purchaseStoreProduct).toHaveBeenCalledWith({ product: storeProduct });
    expect(result.cancelled).toBe(false);
  });

  it('falls back to the store when offerings cannot be fetched at all', async () => {
    mockPurchases.getOfferings.mockRejectedValue(new Error('offerings unavailable'));
    mockPurchases.getProducts.mockResolvedValue({ products: [storeProduct] });
    mockPurchases.purchaseStoreProduct.mockResolvedValue({
      customerInfo: { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] },
    });

    await expect(purchaseProduct(ANNUAL)).resolves.toEqual({ cancelled: false, granted: [] });
  });

  it('throws a product-unavailable error only when the store has nothing either', async () => {
    mockPurchases.getOfferings.mockResolvedValue(emptyOfferings);
    mockPurchases.getProducts.mockResolvedValue({ products: [] });

    await expect(purchaseProduct(ANNUAL)).rejects.toThrow(/not available from the store/);
    expect(mockPurchases.purchaseStoreProduct).not.toHaveBeenCalled();
  });
});

describe('getStoreAvailability — paywall gating', () => {
  it('reports what the store can sell, merging offerings and direct lookups', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [{ product: { identifier: ANNUAL, priceString: 'kr 149,00' } }] },
      all: {},
    });
    mockPurchases.getProducts.mockResolvedValue({
      products: [{ identifier: 'com.dynastymanager.pro.lifetime', priceString: 'kr 199,00' }],
    });

    const { supported, available, prices } = await getStoreAvailability([
      ANNUAL,
      'com.dynastymanager.pro.lifetime',
      'com.dynastymanager.pro.monthly',
    ]);

    expect(supported).toBe(true);
    expect(available.sort()).toEqual([ANNUAL, 'com.dynastymanager.pro.lifetime'].sort());
    // Monthly never came back — the paywall must not offer it.
    expect(available).not.toContain('com.dynastymanager.pro.monthly');
    expect(prices[ANNUAL]).toBe('kr 149,00');
  });

  it('reports an empty catalogue (not a crash) when the store is unreachable', async () => {
    mockPurchases.getOfferings.mockRejectedValue(new Error('offline'));
    mockPurchases.getProducts.mockRejectedValue(new Error('offline'));

    const { supported, available } = await getStoreAvailability([ANNUAL]);

    expect(supported).toBe(true);
    expect(available).toEqual([]);
  });
});
