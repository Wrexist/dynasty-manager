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

import type { ProductId, SubscriptionInfo } from '@/types/game';
import { PRODUCTS } from '@/config/monetization';
import { Capacitor } from '@capacitor/core';

// Test API key — replace with per-platform production keys before release
// Production: use 'appl_xxx' for iOS, 'goog_xxx' for Android
const REVENUECAT_API_KEY = 'test_CBbgpDnLxWJvQXQQLWVvIEXjoYF';

let initialized = false;
let listenerRemover: (() => void) | null = null;

/** Initialize RevenueCat SDK. Call once at app startup. */
export async function initPurchases(): Promise<void> {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) {
    // Web: skip initialization, use mock mode
    initialized = true;
    return;
  }

  try {
    const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    initialized = true;
  } catch (err) {
    console.warn('[Purchases] Failed to initialize RevenueCat:', err);
  }
}

/** Purchase a product. Returns the list of granted entitlement product IDs. */
export async function purchaseProduct(productId: ProductId): Promise<ProductId[]> {
  if (!Capacitor.isNativePlatform()) {
    // Web/dev mode: return the product as if purchased (for testing)
    return [productId];
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();

    // Find the package matching our product ID across all offerings
    const allPackages = [
      ...(offerings.current?.availablePackages || []),
      ...Object.values(offerings.all || {}).flatMap(o => o.availablePackages || []),
    ];
    const pkg = allPackages.find(p => p.product.identifier === productId);

    if (!pkg) {
      throw new Error(`Product ${productId} not found in offerings`);
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return mapEntitlements(customerInfo);
  } catch (err: unknown) {
    const error = err as { code?: string; userCancelled?: boolean };
    if (error.userCancelled || error.code === 'PURCHASE_CANCELLED') {
      // User cancelled — not an error
      return [];
    }
    console.error('[Purchases] Purchase failed:', err);
    throw err;
  }
}

/** Restore previously purchased products. Returns granted entitlement product IDs. */
export async function restorePurchases(): Promise<ProductId[]> {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.restorePurchases();
    return mapEntitlements(customerInfo);
  } catch (err) {
    console.error('[Purchases] Restore failed:', err);
    throw err;
  }
}

/** Get current customer entitlements without making a purchase. */
export async function getEntitlements(): Promise<ProductId[]> {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return mapEntitlements(customerInfo);
  } catch (err) {
    console.error('[Purchases] Get entitlements failed:', err);
    return [];
  }
}

/** Get raw customer info for subscription extraction. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCustomerInfo(): Promise<any | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (err) {
    console.error('[Purchases] Get customer info failed:', err);
    return null;
  }
}

/** Map RevenueCat CustomerInfo to our ProductId array. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntitlements(customerInfo: any): ProductId[] {
  const validIds: ProductId[] = [
    'com.dynastymanager.pro',
    'com.dynastymanager.pro.monthly',
    'com.dynastymanager.pro.yearly',
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractSubscriptionInfo(customerInfo: any): SubscriptionInfo | null {
  const activeEntitlements = customerInfo?.entitlements?.active;
  if (!activeEntitlements) return null;

  // Look for a 'pro' or 'dynasty_pro' entitlement (configure in RevenueCat dashboard)
  const proEntitlement = activeEntitlements['pro'] || activeEntitlements['dynasty_pro'];
  if (!proEntitlement) return null;

  const productId = proEntitlement.productIdentifier as ProductId;
  const product = PRODUCTS[productId];
  if (!product || product.type !== 'subscription') return null;

  return {
    tier: product.subscriptionTier!,
    productId,
    expiresAt: proEntitlement.expirationDate || null,
    isInGracePeriod: proEntitlement.billingIssueDetectedAt != null,
    willRenew: !proEntitlement.unsubscribeDetectedAt,
  };
}

// ── Paywall Presentation ──

export type PaywallResult = 'purchased' | 'restored' | 'cancelled' | 'error' | 'not_presented';

/** Present the RevenueCat native paywall. Returns the outcome. */
export async function presentPaywall(offeringIdentifier?: string): Promise<PaywallResult> {
  if (!Capacitor.isNativePlatform()) {
    // Web: cannot show native paywall
    return 'not_presented';
  }

  try {
    const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};

    if (offeringIdentifier) {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      const offering = offerings.all?.[offeringIdentifier];
      if (offering) options.offering = offering;
    }

    const { result } = await RevenueCatUI.presentPaywall(options);
    return mapPaywallResult(result);
  } catch (err) {
    console.error('[Purchases] Paywall presentation failed:', err);
    return 'error';
  }
}

/** Present the paywall only if the user lacks the specified entitlement. */
export async function presentPaywallIfNeeded(entitlementId: string = 'pro'): Promise<PaywallResult> {
  if (!Capacitor.isNativePlatform()) return 'not_presented';

  try {
    const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
    const { result } = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: entitlementId,
    });
    return mapPaywallResult(result);
  } catch (err) {
    console.error('[Purchases] Paywall presentation failed:', err);
    return 'error';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaywallResult(result: any): PaywallResult {
  // PAYWALL_RESULT enum values: NOT_PRESENTED=0, ERROR=1, CANCELLED=2, PURCHASED=3, RESTORED=4
  switch (result) {
    case 0: return 'not_presented';
    case 1: return 'error';
    case 2: return 'cancelled';
    case 3: return 'purchased';
    case 4: return 'restored';
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
  if (!Capacitor.isNativePlatform()) return false;

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
  onUpdate: (productIds: ProductId[], customerInfo: unknown) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    listenerRemover = Purchases.addCustomerInfoUpdateListener((info) => {
      const ids = mapEntitlements(info);
      onUpdate(ids, info);
    });
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
