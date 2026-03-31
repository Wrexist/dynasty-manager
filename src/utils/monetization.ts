/**
 * Monetization helper utilities.
 * Provides simple entitlement checks that can be called from any component or utility.
 *
 * IMPORTANT: These helpers NEVER modify match outcomes, training rates,
 * transfer values, or any core simulation parameter.
 */

import type { MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo } from '@/types/game';
import { COSMETIC_ITEMS, AD_REWARD_LIMITS, STARTER_KIT_WINDOW_MS, PRO_PRODUCT_IDS } from '@/config/monetization';

/** Check if a subscription has expired */
export function isSubscriptionExpired(sub: SubscriptionInfo): boolean {
  if (!sub.expiresAt) return false; // lifetime never expires
  return new Date(sub.expiresAt) < new Date();
}

/** Check if the player has an active subscription */
export function isSubscriptionActive(state: MonetizationState): boolean {
  return state.subscription != null && !isSubscriptionExpired(state.subscription);
}

/** Check if the player has Dynasty Pro (via one-time purchase OR active subscription) */
export function isPro(state: MonetizationState): boolean {
  // One-time purchase or bundle
  if (PRO_PRODUCT_IDS.some(id => state.entitlements.includes(id))) return true;
  // Active subscription
  if (isSubscriptionActive(state)) return true;
  return false;
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
