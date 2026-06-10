/**
 * RevenueCat payment SDK wrapper for Dynasty Manager.
 * Handles initialization, purchases, restoration, entitlement mapping,
 * paywall presentation, subscription info extraction, and subscription management.
 *
 * SETUP REQUIRED:
 * 1. Create a RevenueCat account at https://app.revenuecat.com
 * 2. Set up your app in RevenueCat dashboard for iOS and Android
 * 3. Create products matching the IDs in src/config/monetization.ts
 * 4. For production: set VITE_REVENUECAT_API_KEY_IOS ('appl_…') and
 *    VITE_REVENUECAT_API_KEY_ANDROID ('goog_…') in the build environment
 */

import * as Sentry from '@sentry/react';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import type { ProductId, SubscriptionInfo } from '@/types/game';
import { PRODUCTS } from '@/config/monetization';
import { Capacitor } from '@capacitor/core';

// RevenueCat requires a separate API key per platform ('appl_…' for iOS,
// 'goog_…' for Android). VITE_REVENUECAT_API_KEY is the legacy single-key
// fallback (the iOS key). The test key is only ever used in dev builds —
// a production build with no key for the running platform must fail
// initialization loudly rather than silently ship against the test
// project, which would make every real purchase dead on arrival.
function resolveApiKey(): string | null {
  const platform = Capacitor.getPlatform();
  const key =
    (platform === 'ios' && import.meta.env.VITE_REVENUECAT_API_KEY_IOS) ||
    (platform === 'android' && import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID) ||
    import.meta.env.VITE_REVENUECAT_API_KEY;
  if (key) return key;
  return import.meta.env.DEV ? 'test_CBbgpDnLxWJvQXQQLWVvIEXjoYF' : null;
}

/** Set to true once production RevenueCat keys are configured and native plugins restored. */
const NATIVE_MONETIZATION_READY = true;

let initPromise: Promise<boolean> | null = null;
let listenerRemover: (() => void) | null = null;
let missingKeyReported = false;

/**
 * Initialize RevenueCat SDK. Safe to call multiple times — the in-flight
 * promise is memoized. Returns true once the SDK is configured (or when
 * running off-device, where monetization is mocked). On failure, the
 * cached promise is cleared so the next caller retries — important because
 * a transient launch-time failure must not permanently break "Restore
 * Purchases".
 */
export async function initPurchases(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return false;
  }
  if (initPromise) return initPromise;

  const apiKey = resolveApiKey();
  if (!apiKey) {
    // Misconfigured production build — no key for this platform. Never
    // configure with the test key on device; surface it and stay dark.
    if (!missingKeyReported) {
      missingKeyReported = true;
      Sentry.captureMessage(
        `RevenueCat API key missing for platform "${Capacitor.getPlatform()}"`,
        { level: 'error', tags: { context: 'purchases.init' } },
      );
    }
    return false;
  }

  initPromise = (async () => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    try {
      const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
      const logLevel = import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
      await Purchases.setLogLevel({ level: logLevel });
      // Race configure against a timeout. Clear the timer on resolution to
      // prevent a leaked Promise rejection from firing 5s after success and
      // polluting Sentry with phantom "RevenueCat init timeout" events.
      const timeout = new Promise<void>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('RevenueCat init timeout')), 5000);
      });
      await Promise.race([
        Purchases.configure({ apiKey }),
        timeout,
      ]);
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[Purchases] Failed to initialize RevenueCat:', err);
      Sentry.captureException(err, { tags: { context: 'purchases.init' } });
      initPromise = null;
      return false;
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  })();
  return initPromise;
}

/** Ensure the SDK is configured before issuing a call. Throws on failure
 *  so user-triggered flows surface a real error instead of a silent no-op. */
async function ensureConfigured(): Promise<void> {
  const ok = await initPurchases();
  if (!ok) throw new Error('RevenueCat SDK is not configured');
}

/**
 * Purchase a consumable IAP (e.g. a single Premium Gold or Icon pack open).
 * Returns true if the purchase completed successfully. The caller is
 * responsible for granting the in-game reward immediately on success —
 * consumables are NOT persisted as entitlements and cannot be restored.
 *
 * On web/dev (where the native plugin isn't available) this resolves true
 * so the rest of the flow can be tested without a real store.
 */
export async function purchaseConsumable(productId: ProductId): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    // No native store available — treat as a successful test purchase so
    // the pack flow can be exercised end-to-end in dev.
    return true;
  }

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings() as {
      current?: { availablePackages: { product: { identifier: string } }[] };
      all?: Record<string, { availablePackages: { product: { identifier: string } }[] }>;
    };
    const allPackages = [
      ...(offerings.current?.availablePackages || []),
      ...Object.values(offerings.all || {}).flatMap(o => o.availablePackages || []),
    ];
    const pkg = allPackages.find(p => p.product.identifier === productId);
    if (!pkg) {
      throw new Error(`Consumable ${productId} not found in offerings`);
    }
    await Purchases.purchasePackage({ aPackage: pkg as Parameters<typeof Purchases.purchasePackage>[0]['aPackage'] });
    return true;
  } catch (err: unknown) {
    const error = (err && typeof err === 'object' ? err : {}) as { code?: string; userCancelled?: boolean };
    if (error.userCancelled || error.code === 'PURCHASE_CANCELLED') {
      return false;
    }
    if (import.meta.env.DEV) console.error('[Purchases] Consumable purchase failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.purchaseConsumable' }, extra: { productId } });
    throw err;
  }
}

/** Purchase a product. Returns the list of granted entitlement product IDs. */
export async function purchaseProduct(productId: ProductId): Promise<ProductId[]> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return [productId];
  }

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    // SDK types unavailable in web builds — use structural typing
    const offerings = await Purchases.getOfferings() as {
      current?: { availablePackages: { product: { identifier: string } }[] };
      all?: Record<string, { availablePackages: { product: { identifier: string } }[] }>;
    };

    // Find the package matching our product ID across all offerings
    const allPackages = [
      ...(offerings.current?.availablePackages || []),
      ...Object.values(offerings.all || {}).flatMap(o => o.availablePackages || []),
    ];
    const pkg = allPackages.find(p => p.product.identifier === productId);

    if (!pkg) {
      throw new Error(`Product ${productId} not found in offerings`);
    }

    // pkg is narrowed from the loose offerings shape above; the runtime object
    // satisfies PurchasesPackage but structural typing misses the extra fields.
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg as Parameters<typeof Purchases.purchasePackage>[0]['aPackage'] });
    return mapEntitlements(customerInfo);
  } catch (err: unknown) {
    const error = (err && typeof err === 'object' ? err : {}) as { code?: string; userCancelled?: boolean };
    if (error.userCancelled || error.code === 'PURCHASE_CANCELLED') {
      // User cancelled — not an error
      return [];
    }
    if (import.meta.env.DEV) console.error('[Purchases] Purchase failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.purchaseProduct' }, extra: { productId } });
    throw err;
  }
}

/** Restore previously purchased products. Returns granted entitlement product IDs. */
export async function restorePurchases(): Promise<ProductId[]> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return [];
  }

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.restorePurchases();
    return mapEntitlements(customerInfo);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] Restore failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.restore' } });
    throw err;
  }
}

/**
 * Fetch localised price strings for every product RevenueCat exposes.
 * Returns the StoreKit-formatted string (e.g. "$14.99", "kr 149,99",
 * "€9,99") so the shop UI can display prices in the user's actual
 * currency instead of the USD fallback baked into config. Returns an
 * empty object on web/dev or if offerings can't be fetched — callers
 * should fall back to the USD config price in that case.
 */
export async function getStorePrices(): Promise<Partial<Record<ProductId, string>>> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return {};
  }

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings() as {
      current?: { availablePackages: { product: { identifier: string; priceString?: string } }[] };
      all?: Record<string, { availablePackages: { product: { identifier: string; priceString?: string } }[] }>;
    };
    const allPackages = [
      ...(offerings.current?.availablePackages || []),
      ...Object.values(offerings.all || {}).flatMap(o => o.availablePackages || []),
    ];
    const prices: Partial<Record<ProductId, string>> = {};
    for (const pkg of allPackages) {
      const id = pkg.product.identifier as ProductId;
      const priceString = pkg.product.priceString;
      if (priceString && !prices[id]) prices[id] = priceString;
    }
    return prices;
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] getStorePrices failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.getStorePrices' } });
    return {};
  }
}

/** Get current customer entitlements without making a purchase. */
export async function getEntitlements(): Promise<ProductId[]> {  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return [];
  }

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return mapEntitlements(customerInfo);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] Get entitlements failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.getEntitlements' } });
    return [];
  }
}

/** Get raw customer info for subscription extraction. */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return null;
  }

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] Get customer info failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.getCustomerInfo' } });
    return null;
  }
}

/** Map RevenueCat CustomerInfo to our ProductId array.
 *  Consumable pack IAPs (premium_gold, icon) are intentionally NOT listed
 *  here — they grant a single pack open at purchase time and must not be
 *  restored as permanent entitlements. */
function mapEntitlements(customerInfo: CustomerInfo | null | undefined): ProductId[] {
  const validIds: ProductId[] = [
    'com.dynastymanager.pro',
    'com.dynastymanager.pro.monthly',
    'com.dynastymanager.pro.annual',
    'com.dynastymanager.pro.lifetime',
    'com.dynastymanager.pack.manager',
    'com.dynastymanager.pack.stadium',
    'com.dynastymanager.pack.legends',
    'com.dynastymanager.bundle.all',
  ];

  const purchased = new Set<string>();

  // Check entitlements.active (RevenueCat v12 best practice)
  const activeEntitlements = customerInfo?.entitlements?.active;
  // Guard against null (not just undefined) — RevenueCat's native SDK
  // historically returned null here under failure modes. Object.keys(null)
  // throws.
  if (activeEntitlements && typeof activeEntitlements === 'object') {
    for (const key of Object.keys(activeEntitlements)) {
      const ent = activeEntitlements[key];
      if (ent?.productIdentifier) purchased.add(ent.productIdentifier);
    }
  }

  // Also check allPurchasedProductIdentifiers as a fallback. RevenueCat
  // populates this list with EVERY purchase the user has ever made,
  // including expired subscriptions — so we must skip subscription SKUs
  // here, otherwise an expired annual/monthly plan would grant Pro
  // indefinitely. For non-consumable one-time purchases (Pro, Lifetime,
  // packs, bundle) the list is a reliable forever-record.
  const allIds = customerInfo?.allPurchasedProductIdentifiers || [];
  for (const id of allIds) {
    const product = PRODUCTS[id as ProductId];
    if (product && product.type !== 'subscription') {
      purchased.add(id);
    }
  }

  return Array.from(purchased).filter((id): id is ProductId => validIds.includes(id as ProductId));
}

/**
 * Extract subscription info from RevenueCat CustomerInfo.
 * Returns null if no active subscription is found.
 */
export function extractSubscriptionInfo(customerInfo: CustomerInfo | null | undefined): SubscriptionInfo | null {
  try {
    const activeEntitlements = customerInfo?.entitlements?.active;
    if (!activeEntitlements || typeof activeEntitlements !== 'object') return null;

    // Look for a 'pro' or 'dynasty_pro' entitlement (configure in RevenueCat dashboard)
    const proEntitlement = activeEntitlements['pro'] || activeEntitlements['dynasty_pro'];
    if (!proEntitlement) return null;

    const productId = proEntitlement.productIdentifier as ProductId;
    const product = PRODUCTS[productId];
    if (!product || (product.type !== 'subscription' && product.subscriptionTier !== 'lifetime')) return null;

    // RevenueCat surfaces introductory free-trial periods through the
    // `periodType` field on an active entitlement. Values: 'NORMAL' | 'INTRO'
    // | 'TRIAL'. Either INTRO or TRIAL → the user is currently on a free
    // (or introductory-priced) period, and we should display "Trial" copy.
    const periodType: string | undefined = proEntitlement.periodType;
    const isTrial = periodType === 'TRIAL' || periodType === 'INTRO';

    return {
      tier: isTrial ? 'trial' : product.subscriptionTier!,
      productId,
      expiresAt: proEntitlement.expirationDate || null,
      isInGracePeriod: proEntitlement.billingIssueDetectedAt != null,
      willRenew: !proEntitlement.unsubscribeDetectedAt,
      isTrial,
    };
  } catch (err) {
    // Defensive: a malformed entitlement object from RevenueCat shouldn't
    // be able to crash the settings / shop / restore-purchases UI.
    Sentry.captureException(err, { tags: { context: 'extractSubscriptionInfo' } });
    return null;
  }
}

// ── Subscription Management ──
//
// The RevenueCat-hosted paywall (`RevenueCatUI.presentPaywall`) was removed
// in response to App Store review feedback (Guideline 3.1.2(c)). The hosted
// paywall is configured in the RevenueCat dashboard and was missing the
// required disclosures (subscription title/length on every tier, in-flow
// Terms of Use + Privacy Policy links, billed-amount prominence). All Pro
// purchase flows now go through the in-app SubscribeOnboarding screen which
// renders the disclosures Apple requires directly under our control.

/**
 * Open the platform-specific subscription management page.
 * Uses the managementURL from RevenueCat CustomerInfo.
 * This serves as a Customer Center fallback since RevenueCat
 * Customer Center is not yet supported for Capacitor.
 */
export async function openSubscriptionManagement(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) return false;

  // Apple's universal subscription-management URL — works on every iOS
  // device even when RevenueCat hasn't synced customerInfo yet. Used as
  // a fallback when `customerInfo.managementURL` is missing (audit
  // finding: without it, a flaky RC sync left the user with no way to
  // manage their subscription).
  const APPLE_SUB_FALLBACK = 'https://apps.apple.com/account/subscriptions';

  try {
    await ensureConfigured();
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    const managementUrl = customerInfo?.managementURL || APPLE_SUB_FALLBACK;
    const { openExternalUrl } = await import('@/utils/externalUrl');
    void openExternalUrl(managementUrl);
    return true;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Purchases] Could not open subscription management:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.openSubscriptionManagement' } });
    // Even on RevenueCat failure, route through Apple's universal URL
    // so the user can still cancel their subscription.
    try {
      const { openExternalUrl } = await import('@/utils/externalUrl');
      void openExternalUrl(APPLE_SUB_FALLBACK);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Entitlement Listener ──

/**
 * Start listening for real-time entitlement changes (e.g. purchases on
 * another device, family sharing, or subscription renewals).
 */
export async function startEntitlementListener(
  onUpdate: (productIds: ProductId[], customerInfo: CustomerInfo) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) return;
  try {
    await ensureConfigured();
    // If a previous listener is still registered (e.g. GameShell unmounted
    // and remounted), remove it before adding a new one — otherwise the
    // RevenueCat native side retains both callbacks and the orphaned one
    // can fire against a torn-down JS context (EXC_BAD_ACCESS).
    if (listenerRemover) {
      try { listenerRemover(); } catch { /* swallow */ }
      listenerRemover = null;
    }
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const callbackId = await Purchases.addCustomerInfoUpdateListener((info) => {
      const ids = mapEntitlements(info);
      onUpdate(ids, info);
    });
    listenerRemover = () => {
      void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: callbackId });
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Purchases] Failed to add listener:', err);
  }
}

/** Stop listening for entitlement changes. */
export function stopEntitlementListener(): void {
  if (listenerRemover) {
    listenerRemover();
    listenerRemover = null;
  }
}
