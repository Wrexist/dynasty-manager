/**
 * Monetization helper utilities.
 * Provides simple entitlement checks that can be called from any component or utility.
 *
 * IMPORTANT: These helpers NEVER modify match outcomes, training rates,
 * transfer values, or any core simulation parameter.
 */

import type { MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo, SubscriptionTier } from '@/types/game';
import { COSMETIC_ITEMS, AD_REWARD_LIMITS, STARTER_KIT_WINDOW_MS, PRO_ONE_TIME_PRODUCT_IDS, PRODUCTS, CONSUMABLE_PRODUCT_IDS } from '@/config/monetization';

/** Upper bound on how long a recurring subscription record is trusted when the
 *  store gave us no `expiresAt`. Generous enough that a paying customer keeps
 *  Pro across a normal billing period offline, bounded so the record can never
 *  become permanent. */
const UNANCHORED_WINDOW_MS: Record<SubscriptionTier, number> = {
  trial: 8 * 24 * 60 * 60 * 1000,
  monthly: 32 * 24 * 60 * 60 * 1000,
  annual: 367 * 24 * 60 * 60 * 1000,
  lifetime: Infinity,
};

/** Check if a subscription has expired.
 *
 *  Lifetime is identified by IDENTITY (`tier` / one-time product id), never by
 *  a missing expiry date. `extractSubscriptionInfo` writes
 *  `expiresAt: proEntitlement.expirationDate || null` for EVERY tier, so a
 *  missing or empty `expirationDate` on an active monthly entitlement — which
 *  RevenueCat does return in sandbox, in some grace/billing-issue states, and
 *  for promotional entitlements — used to fall through the old
 *  `expiresAt == null → lifetime` branch. One month paid became Pro for life,
 *  and no later sync could correct it because every sync site guards
 *  `if (sub) updateSubscription(sub)` and only ever writes non-null. This is
 *  the same failure class as the `allPurchasedProductIdentifiers` bug we
 *  already defend against, arriving via the date instead of the SKU list.
 *
 *  An unparseable expiry must also read as expired: `new Date('garbage') <
 *  new Date()` is false (NaN comparison), so without that guard a malformed
 *  expiry silently granted permanent Pro too. */
function isSubscriptionExpired(sub: SubscriptionInfo): boolean {
  // Genuinely non-expiring: the lifetime tier, or any one-time Pro SKU that
  // somehow landed in the subscription slot.
  if (sub.tier === 'lifetime') return false;
  if (PRO_ONE_TIME_PRODUCT_IDS.includes(sub.productId)) return false;

  if (sub.expiresAt != null) {
    const expiresMs = new Date(sub.expiresAt).getTime();
    if (!Number.isFinite(expiresMs)) return true;
    return expiresMs < Date.now();
  }

  // Recurring tier with no expiry date. Fail closed against a bounded window
  // anchored on when we wrote the record: a real subscriber keeps Pro for at
  // least a full billing period offline, and the next successful sync replaces
  // this record with a properly dated one. With no anchor at all (a record
  // predating `grantedAt`, or a hand-edited save) we cannot verify anything, so
  // treat it as expired and let the store be the judge.
  const grantedMs = sub.grantedAt ? new Date(sub.grantedAt).getTime() : NaN;
  if (!Number.isFinite(grantedMs)) return true;
  return grantedMs + UNANCHORED_WINDOW_MS[sub.tier] < Date.now();
}

/** Check if the player has an active subscription */
export function isSubscriptionActive(state: MonetizationState): boolean {
  return state.subscription != null && !isSubscriptionExpired(state.subscription);
}

/**
 * May this product ID be persisted in `monetization.entitlements`?
 *
 *  - Subscription SKUs are banned: RevenueCat keeps them in
 *    allPurchasedProductIdentifiers forever, so a persisted sub SKU outlives
 *    the subscription. Sub status flows ONLY through subscription.expiresAt.
 *  - Consumable pack SKUs are banned: they grant a single pack open at
 *    purchase time and must never be restorable.
 *
 * Lives here rather than in the store slice so that every writer of
 * `entitlements` — the slice actions AND mergeDeviceMonetization — enforces
 * the same boundary.
 */
export function isPersistableEntitlement(productId: ProductId): boolean {
  const product = PRODUCTS[productId];
  if (!product) return false;
  if (product.type === 'subscription') return false;
  if (CONSUMABLE_PRODUCT_IDS.includes(productId)) return false;
  return true;
}

/**
 * Merge the device-scoped purchase fields of two monetization records, keeping
 * whichever side actually proves a purchase.
 *
 * `loadGame` needs this because BOTH directions are real and they happen at
 * different moments:
 *
 *  - Live is ahead of the save. The user bought Pro, then loaded a slot written
 *    before the purchase. Taking the save's block revokes Pro from a payer.
 *  - The SAVE is ahead of live. At cold launch the store still holds
 *    DEFAULT_MONETIZATION_STATE — `loadGame` runs from TitleScreen *before*
 *    GameShell's async RevenueCat sync — so taking live's block wipes the
 *    purchase record, and the next autosave writes that loss to disk.
 *
 * Neither side can be trusted wholesale, so merge rather than pick: the union
 * of entitlements, the stronger subscription record, and the earliest real
 * first-launch timestamp. A purchase is only ever added by this function, never
 * dropped; the store remains the authority for taking one away (an expired
 * subscription still reads as expired through isSubscriptionExpired).
 */
export function mergeDeviceMonetization(
  saved: Pick<MonetizationState, 'entitlements' | 'subscription' | 'firstLaunchTimestamp'>,
  live: Pick<MonetizationState, 'entitlements' | 'subscription' | 'firstLaunchTimestamp'>,
): Pick<MonetizationState, 'entitlements' | 'subscription' | 'firstLaunchTimestamp'> {
  // Filter the union through the same boundary the slice writers use. A save
  // written by an older build (or a hand-edited one) can carry a subscription
  // or consumable SKU in `entitlements`; unioning raw would preserve that
  // contamination permanently and carry it into every other slot.
  const entitlements = Array.from(
    new Set([...(saved.entitlements ?? []), ...(live.entitlements ?? [])]),
  ).filter(isPersistableEntitlement);

  // Prefer an unexpired record over an expired one; if both agree, prefer live,
  // which is the one a RevenueCat sync can have refreshed.
  const savedSub = saved.subscription ?? null;
  const liveSub = live.subscription ?? null;
  let subscription: SubscriptionInfo | null;
  if (!savedSub) subscription = liveSub;
  else if (!liveSub) subscription = savedSub;
  else {
    const liveActive = !isSubscriptionExpired(liveSub);
    const savedActive = !isSubscriptionExpired(savedSub);
    subscription = liveActive === savedActive ? liveSub : liveActive ? liveSub : savedSub;
  }

  // 0 means "never stamped". Take the earliest REAL stamp so the Starter Kit
  // window measures from genuine first launch and cannot be re-armed by
  // loading a save (`??` is wrong here — it does not fall through on 0).
  const stamps = [saved.firstLaunchTimestamp, live.firstLaunchTimestamp].filter(
    (t): t is number => typeof t === 'number' && t > 0,
  );
  const firstLaunchTimestamp = stamps.length ? Math.min(...stamps) : 0;

  return { entitlements, subscription, firstLaunchTimestamp };
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
