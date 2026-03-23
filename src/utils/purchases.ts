/**
 * RevenueCat payment SDK wrapper for Dynasty Manager.
 * Handles initialization, purchases, restoration, and entitlement mapping.
 *
 * SETUP REQUIRED:
 * 1. Create a RevenueCat account at https://app.revenuecat.com
 * 2. Set up your app in RevenueCat dashboard for iOS and Android
 * 3. Create products matching the IDs in src/config/monetization.ts
 * 4. Replace the placeholder API keys below with your real keys
 */

import type { ProductId } from '@/types/game';
import { Capacitor } from '@capacitor/core';

// Placeholder API keys — replace with real keys from RevenueCat dashboard
const REVENUECAT_IOS_KEY = 'appl_PLACEHOLDER_IOS_KEY';
const REVENUECAT_ANDROID_KEY = 'goog_PLACEHOLDER_ANDROID_KEY';

let initialized = false;

/** Initialize RevenueCat SDK. Call once at app startup. */
export async function initPurchases(): Promise<void> {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) {
    // Web: skip initialization, use mock mode
    initialized = true;
    return;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const apiKey = Capacitor.getPlatform() === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
    await Purchases.configure({ apiKey });
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

    // Find the package matching our product ID
    const allPackages = offerings.current?.availablePackages || [];
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

/** Map RevenueCat CustomerInfo to our ProductId array. */
function mapEntitlements(customerInfo: { activeSubscriptions: string[]; allPurchasedProductIdentifiers: string[] }): ProductId[] {
  const allProductIds = customerInfo.allPurchasedProductIdentifiers || [];
  // Filter to only our known product IDs
  const validIds: ProductId[] = [
    'com.dynastymanager.pro',
    'com.dynastymanager.pack.manager',
    'com.dynastymanager.pack.stadium',
    'com.dynastymanager.pack.legends',
    'com.dynastymanager.bundle.all',
  ];
  return allProductIds.filter((id): id is ProductId => validIds.includes(id as ProductId));
}
