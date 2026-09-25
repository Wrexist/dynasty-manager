/**
 * The one path from "the store just answered" to local purchase state, shared
 * by every surface that sells or restores a non-consumable: the paywall
 * (`SubscribeOnboarding`), the Shop and Settings → Restore Purchases.
 *
 * Each of those used to carry its own copy of purchase → grant → sync, and the
 * copies drifted: the Shop re-synced after a purchase that threw but told the
 * player it had failed even when the sync showed the charge had landed, and a
 * completed PAID subscription whose customer record had not caught up left a
 * paying player without Pro until the next launch. One implementation, pinned
 * by `src/test/iapLifecycle.test.ts`, is how every surface now behaves alike.
 *
 * Consumable player packs do NOT come through here — their proof of payment is
 * the pending-credit marker in `utils/packCreditRecovery.ts`.
 *
 * IMPORTANT: nothing here modifies a simulation parameter. It only moves
 * `monetization.entitlements` and `monetization.subscription`.
 */
import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';
import { useGameStore } from '@/store/gameStore';
import { PRODUCTS } from '@/config/monetization';
import {
  purchaseProduct,
  restorePurchases,
  getEntitlements,
  getCustomerInfo,
  extractSubscriptionInfo,
  isPaymentPendingError,
} from '@/utils/purchases';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { addGameBreadcrumb } from '@/utils/sentry';
import { resetTrialOfferProbe } from '@/utils/trialOffer';
import type { ProductId, SubscriptionInfo } from '@/types/game';

export interface StoreSyncResult {
  /** The subscription record the store reported this time, or null when it
   *  reported none. Written to the store only when non-null (see below). */
  subscription: SubscriptionInfo | null;
  /** Pro after the sync, judged by `isPro()` — the only source of truth. */
  proActive: boolean;
}

/**
 * Re-read what the store says this customer owns and fold it into local state.
 *
 * Additive for entitlements (`restoreEntitlements`); refunds are pruned by
 * GameShell's definitive reconcile, never by a sync that may have failed.
 * A null subscription is never written: `extractSubscriptionInfo` returns null
 * for a transient/empty payload, and writing it would clear `expiresAt` — the
 * only record of a paying subscriber — until the next successful sync.
 */
export async function syncStoreState(): Promise<StoreSyncResult> {
  const ids = await getEntitlements();
  if (ids.length > 0) useGameStore.getState().restoreEntitlements(ids);
  const info = await getCustomerInfo();
  const subscription = extractSubscriptionInfo(info);
  if (subscription) useGameStore.getState().updateSubscription(subscription);
  return { subscription, proActive: isPro(useGameStore.getState().monetization) };
}

export interface RestoreResult {
  /** Non-consumable products the store restored into `entitlements`. */
  restored: ProductId[];
  proActive: boolean;
  subscription: SubscriptionInfo | null;
}

/**
 * Restore Purchases. Throws when the store call itself fails, so the caller can
 * say "Restore failed" rather than "No purchases found".
 *
 * Always syncs, even when `restored` is empty: a subscription-only customer's
 * restore legitimately returns [] (subscription SKUs are never persisted as
 * entitlements), so their Pro comes back only through the subscription record.
 */
export async function restoreAndSync(): Promise<RestoreResult> {
  const restored = await restorePurchases();
  if (restored.length > 0) useGameStore.getState().restoreEntitlements(restored);
  const { subscription, proActive } = await syncStoreState();
  return { restored, proActive, subscription };
}

/** Does local state now show this exact product as owned / subscribed? */
export function purchaseLanded(productId: ProductId): boolean {
  const m = useGameStore.getState().monetization;
  const product = PRODUCTS[productId];
  if (!product) return false;
  if (product.type === 'subscription') {
    return isSubscriptionActive(m) && m.subscription?.productId === productId;
  }
  return m.entitlements.includes(productId);
}

export type PurchaseFlowStatus = 'completed' | 'cancelled' | 'pending' | 'failed';

/** Flat (not a discriminated union) to read cleanly under non-strict TS. */
export interface PurchaseFlowOutcome {
  status: PurchaseFlowStatus;
  /** Completed only after the SDK threw — the re-sync found the charge. */
  recovered?: boolean;
  /** Completed subscription purchase that is in its free-trial period. */
  isTrial?: boolean;
  /** The error, when status is 'failed'. */
  error?: unknown;
}

export interface PurchaseFlowOptions {
  /** Free-trial length the surface showed for this plan (store-confirmed).
   *  Used only for the local fallback record when the store's customer record
   *  has not caught up with a purchase it just completed. */
  trialDays?: number;
}

/**
 * Buy a Pro plan, the bundle or a cosmetic pack, and reconcile local state.
 *
 *  - cancelled: the player dismissed the store sheet. No charge.
 *  - pending:   Ask to Buy / SCA. No charge yet; the entitlement listener
 *               grants it if and when it is approved.
 *  - completed: the store completed the transaction (or a post-throw re-sync
 *               proved it did). Local state already reflects it.
 *  - failed:    the store could not complete it. Nothing granted.
 */
export async function purchaseAndSync(
  productId: ProductId,
  options: PurchaseFlowOptions = {},
): Promise<PurchaseFlowOutcome> {
  const product = PRODUCTS[productId];
  try {
    const result = await purchaseProduct(productId);
    if (result.cancelled) return { status: 'cancelled' };
    if (result.pending) {
      addGameBreadcrumb('purchase', 'purchase awaiting approval', { productId });
      return { status: 'pending' };
    }

    if (result.granted.length > 0) useGameStore.getState().restoreEntitlements(result.granted);
    await syncStoreState();

    // The store completed a subscription purchase but the customer record we
    // just read shows no active subscription (propagation lag, or a RevenueCat
    // product not attached to the `pro` entitlement). The transaction is the
    // proof of payment, so unlock Pro now with a bounded local record instead
    // of making a paying player wait for the next launch. The next sync that
    // carries a real record replaces it; with none, `isSubscriptionExpired`
    // ends it after one trial or billing period.
    //
    // Only when NO subscription is active: Monthly → Yearly is a crossgrade
    // that Apple may apply at the next renewal, so the store rightly still
    // reports Monthly — that record is the truth and must not be overwritten.
    if (product?.type === 'subscription' && !isSubscriptionActive(useGameStore.getState().monetization)) {
      const now = Date.now();
      const trialDays = options.trialDays;
      const onTrial = typeof trialDays === 'number' && trialDays > 0;
      useGameStore.getState().updateSubscription({
        tier: onTrial ? 'trial' : product.subscriptionTier!,
        productId,
        expiresAt: onTrial ? new Date(now + trialDays * 24 * 60 * 60 * 1000).toISOString() : null,
        grantedAt: new Date(now).toISOString(),
        isInGracePeriod: false,
        willRenew: true,
        isTrial: onTrial,
      });
      addGameBreadcrumb('purchase', 'subscription completed but not yet on the customer record', { productId });
      // On device this means lag or a dashboard misconfiguration (the product
      // not attached to `pro`) — worth seeing. Off-device it is every mocked
      // purchase, so stay quiet there.
      if (Capacitor.isNativePlatform()) {
        Sentry.captureMessage('purchase completed but the store showed no active pro entitlement', {
          level: 'warning',
          tags: { context: 'purchaseSync.localRecord' },
          extra: { productId },
        });
      }
    }

    // The intro offer is spent: forget the cached "trial available" answer so
    // no surface advertises it again this session.
    if (product?.type === 'subscription') resetTrialOfferProbe();

    const sub = useGameStore.getState().monetization.subscription;
    const isTrial = product?.type === 'subscription' && sub?.productId === productId
      && (sub.isTrial === true || sub.tier === 'trial');
    return { status: 'completed', isTrial };
  } catch (err) {
    if (isPaymentPendingError(err)) return { status: 'pending' };
    // The throw can arrive AFTER the charge (receipt validation, network) —
    // re-read the store and, if the product is now owned, it was a success.
    try { await syncStoreState(); } catch { /* best-effort recovery */ }
    if (purchaseLanded(productId)) {
      addGameBreadcrumb('purchase', 'purchase recovered after throw', { productId });
      return { status: 'completed', recovered: true };
    }
    return { status: 'failed', error: err };
  }
}
