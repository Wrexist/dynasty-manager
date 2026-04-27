/**
 * RevenueCat payment SDK wrapper for Dynasty Manager.
 * Handles initialization, purchases, restoration, entitlement mapping,
 * paywall presentation, subscription info extraction, and subscription management.
 *
 * SETUP REQUIRED:
 * 1. Create a RevenueCat account at https://app.revenuecat.com
 * 2. Set up your app in RevenueCat dashboard for iOS and Android
 * 3. Create products matching the IDs in src/config/monetization.ts
 * 4. For production: replace the test API key below with per-platform keys
 */

import * as Sentry from '@sentry/react';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import type { PresentPaywallOptions } from '@revenuecat/purchases-capacitor-ui';
import type { ProductId, SubscriptionInfo } from '@/types/game';
import { PRODUCTS } from '@/config/monetization';
import { Capacitor } from '@capacitor/core';

// RevenueCat API key — set via environment variable for production
// Production: use 'appl_xxx' for iOS, 'goog_xxx' for Android
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || 'test_CBbgpDnLxWJvQXQQLWVvIEXjoYF';

/** Set to true once production RevenueCat keys are configured and native plugins restored. */
const NATIVE_MONETIZATION_READY = true;

let initialized = false;
let listenerRemover: (() => void) | null = null;

/** Initialize RevenueCat SDK. Call once at app startup. */
export async function initPurchases(): Promise<void> {
  if (initialized) return;
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    initialized = true;
    return;
  }

  try {
    const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
    const logLevel = import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
    await Purchases.setLogLevel({ level: logLevel });
    await Promise.race([
      Purchases.configure({ apiKey: REVENUECAT_API_KEY }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('RevenueCat init timeout')), 5000)),
    ]);
    initialized = true;
  } catch (err) {
    console.warn('[Purchases] Failed to initialize RevenueCat:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.init' } });
    // Mark initialized to prevent retry loops — purchases will use mock mode
    initialized = true;
  }
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
    const error = err as { code?: string; userCancelled?: boolean };
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
    const error = err as { code?: string; userCancelled?: boolean };
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
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.restorePurchases();
    return mapEntitlements(customerInfo);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] Restore failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.restore' } });
    throw err;
  }
}

/** Get current customer entitlements without making a purchase. */
export async function getEntitlements(): Promise<ProductId[]> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return [];
  }

  try {
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
    'com.dynastymanager.pro.lifetime',
    'com.dynastymanager.pack.manager',
    'com.dynastymanager.pack.stadium',
    'com.dynastymanager.pack.legends',
    'com.dynastymanager.bundle.all',
  ];

  const purchased = new Set<string>();

  // Check entitlements.active (RevenueCat v12 best practice)
  const activeEntitlements = customerInfo?.entitlements?.active;
  if (activeEntitlements) {
    for (const key of Object.keys(activeEntitlements)) {
      const ent = activeEntitlements[key];
      if (ent?.productIdentifier) purchased.add(ent.productIdentifier);
    }
  }

  // Also check allPurchasedProductIdentifiers (fallback for non-consumables)
  const allIds = customerInfo?.allPurchasedProductIdentifiers || [];
  for (const id of allIds) purchased.add(id);

  return Array.from(purchased).filter((id): id is ProductId => validIds.includes(id as ProductId));
}

/**
 * Extract subscription info from RevenueCat CustomerInfo.
 * Returns null if no active subscription is found.
 */
export function extractSubscriptionInfo(customerInfo: CustomerInfo | null | undefined): SubscriptionInfo | null {
  const activeEntitlements = customerInfo?.entitlements?.active;
  if (!activeEntitlements) return null;

  // Look for a 'pro' or 'dynasty_pro' entitlement (configure in RevenueCat dashboard)
  const proEntitlement = activeEntitlements['pro'] || activeEntitlements['dynasty_pro'];
  if (!proEntitlement) return null;

  const productId = proEntitlement.productIdentifier as ProductId;
  const product = PRODUCTS[productId];
  if (!product || (product.type !== 'subscription' && product.subscriptionTier !== 'lifetime')) return null;

  return {
    tier: product.subscriptionTier!,
    productId,
    expiresAt: proEntitlement.expirationDate || null,
    isInGracePeriod: proEntitlement.billingIssueDetectedAt != null,
    willRenew: !proEntitlement.unsubscribeDetectedAt,
  };
}

// ── Paywall Presentation ──

type PaywallResult = 'purchased' | 'restored' | 'cancelled' | 'error' | 'not_presented';

/** Present the RevenueCat native paywall. Returns the outcome. */
export async function presentPaywall(offeringIdentifier?: string): Promise<PaywallResult> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) {
    return 'not_presented';
  }

  try {
    const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
    const options: PresentPaywallOptions = {};

    if (offeringIdentifier) {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      const offering = offerings.all?.[offeringIdentifier];
      if (offering) options.offering = offering;
    }

    const { result } = await RevenueCatUI.presentPaywall(options);
    return mapPaywallResult(result);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] Paywall presentation failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.presentPaywall' }, extra: { offeringIdentifier } });
    return 'error';
  }
}

/** Present the paywall only if the user lacks the specified entitlement. */
export async function presentPaywallIfNeeded(entitlementId: string = 'pro'): Promise<PaywallResult> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) return 'not_presented';

  try {
    const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
    const { result } = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: entitlementId,
    });
    return mapPaywallResult(result);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Purchases] Paywall presentation failed:', err);
    Sentry.captureException(err, { tags: { context: 'purchases.presentPaywallIfNeeded' }, extra: { entitlementId } });
    return 'error';
  }
}

// PAYWALL_RESULT is a string enum exported from @revenuecat/purchases-capacitor-ui
// Values: "NOT_PRESENTED", "ERROR", "CANCELLED", "PURCHASED", "RESTORED"
function mapPaywallResult(result: string): PaywallResult {
  switch (result) {
    case 'NOT_PRESENTED': return 'not_presented';
    case 'ERROR': return 'error';
    case 'CANCELLED': return 'cancelled';
    case 'PURCHASED': return 'purchased';
    case 'RESTORED': return 'restored';
    default: return 'error';
  }
}

// ── Subscription Management ──

/**
 * Open the platform-specific subscription management page.
 * Uses the managementURL from RevenueCat CustomerInfo.
 * This serves as a Customer Center fallback since RevenueCat
 * Customer Center is not yet supported for Capacitor.
 */
export async function openSubscriptionManagement(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_MONETIZATION_READY) return false;

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    const managementUrl = customerInfo?.managementURL;
    if (managementUrl) {
      window.open(managementUrl, '_blank');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Purchases] Could not open subscription management:', err);
    return false;
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
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const callbackId = await Purchases.addCustomerInfoUpdateListener((info) => {
      const ids = mapEntitlements(info);
      onUpdate(ids, info);
    });
    listenerRemover = () => {
      void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: callbackId });
    };
  } catch (err) {
    console.warn('[Purchases] Failed to add listener:', err);
  }
}

/** Stop listening for entitlement changes. */
export function stopEntitlementListener(): void {
  if (listenerRemover) {
    listenerRemover();
    listenerRemover = null;
  }
}
