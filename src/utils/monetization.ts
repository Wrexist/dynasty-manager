/**
 * Monetization helper utilities.
 * Provides simple entitlement checks that can be called from any component or utility.
 *
 * IMPORTANT: These helpers NEVER modify match outcomes, training rates,
 * transfer values, or any core simulation parameter.
 */

import type { MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo } from '@/types/game';
import { COSMETIC_ITEMS, AD_REWARD_LIMITS, STARTER_KIT_WINDOW_MS, PRO_ONE_TIME_PRODUCT_IDS } from '@/config/monetization';

/** Check if a subscription has expired */
function isSubscriptionExpired(sub: SubscriptionInfo): boolean {
  // Only an EXPLICIT null/undefined expiry means lifetime. An empty string
  // or unparseable date must read as expired: `new Date('garbage') < new
  // Date()` is false (NaN comparison), so without this guard a malformed
  // expiry silently granted permanent Pro.
  if (sub.expiresAt == null) return false; // lifetime never expires
  const expiresMs = new Date(sub.expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return true;
  return expiresMs < Date.now();
}

/** Check if the player has an active subscription */
export function isSubscriptionActive(state: MonetizationState): boolean {
  return state.subscription != null && !isSubscriptionExpired(state.subscription);
}

/** Check if the player has Dynasty Pro (via one-time purchase OR active subscription).
 *  Subscription SKUs are intentionally NOT checked against `entitlements`
 *  because RevenueCat keeps expired subs in `allPurchasedProductIdentifiers`
 *  forever — the only valid source for sub status is `subscription.expiresAt`. */
export function isPro(state: MonetizationState): boolean {
  if (PRO_ONE_TIME_PRODUCT_IDS.some(id => state.entitlements.includes(id))) return true;
  if (isSubscriptionActive(state)) return true;
  return false;
}

/** Check if the player is currently in the introductory free-trial window.
 *  Returns false if the trial has expired or no subscription exists. */
export function isOnFreeTrial(state: MonetizationState): boolean {
  const sub = state.subscription;
  if (!sub) return false;
  if (sub.tier !== 'trial' && !sub.isTrial) return false;
  return !isSubscriptionExpired(sub);
}

/** Get the number of full days remaining on the active free trial.
 *  Returns 0 if not on a trial or trial has expired. Rounds up so a
 *  partial day still reads as "1 day left". */
export function getFreeTrialDaysRemaining(state: MonetizationState): number {
  if (!isOnFreeTrial(state)) return 0;
  const expiresAt = state.subscription?.expiresAt;
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** Check if the player owns a specific product */
export function hasProduct(state: MonetizationState, productId: ProductId): boolean {
  return state.entitlements.includes(productId);
}

/** Check if a cosmetic pack is owned */
export function hasCosmetic(state: MonetizationState, cosmeticId: string): boolean {
  const item = COSMETIC_ITEMS.find(c => c.id === cosmeticId);
  if (!item) return false;
  return state.entitlements.includes(item.pack);
}

/** Get the active cosmetic ID for a category, or undefined for default */
export function getActiveCosmetic(state: MonetizationState, category: CosmeticCategory): string | undefined {
  const cosmeticId = state.activeCosmetics[category];
  if (!cosmeticId) return undefined;
  // Verify the player still owns it (in case of refund)
  if (!hasCosmetic(state, cosmeticId)) return undefined;
  return cosmeticId;
}

/** Get all owned cosmetics for a given category */
export function getOwnedCosmetics(state: MonetizationState, category: CosmeticCategory) {
  return COSMETIC_ITEMS.filter(
    c => c.category === category && state.entitlements.includes(c.pack)
  );
}

/** Check if an ad reward can still be claimed this season (and optional context) */
export function canClaimAdReward(state: MonetizationState, rewardType: AdRewardType, season: number, contextKey?: string): boolean {
  const seasonKey = `${rewardType}_s${season}`;
  const seasonClaimed = state.adRewardsClaimed[seasonKey] || 0;
  if (seasonClaimed >= AD_REWARD_LIMITS[rewardType]) return false;

  if (!contextKey) return true;

  const contextualKey = `${seasonKey}_${contextKey}`;
  const contextualClaimed = state.adRewardsClaimed[contextualKey] || 0;
  return contextualClaimed < 1;
}

/** Check if the starter kit time-limited offer is still available */
export function isStarterKitAvailable(state: MonetizationState): boolean {
  if (state.starterKitDismissed) return false;
  if (state.firstLaunchTimestamp <= 0) return false;
  if (isPro(state)) return false;
  const elapsed = Date.now() - state.firstLaunchTimestamp;
  return elapsed < STARTER_KIT_WINDOW_MS;
}

/** Get remaining time for starter kit offer in milliseconds */
export function getStarterKitRemainingMs(state: MonetizationState): number {
  if (!isStarterKitAvailable(state)) return 0;
  const elapsed = Date.now() - state.firstLaunchTimestamp;
  return Math.max(0, STARTER_KIT_WINDOW_MS - elapsed);
}

/** Count how many products the player owns (for stats/display) */
export function getPurchaseCount(state: MonetizationState): number {
  return state.entitlements.length;
}
