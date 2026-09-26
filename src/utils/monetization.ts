/**
 * Monetization helper utilities.
 * Provides simple entitlement checks that can be called from any component or utility.
 *
 * IMPORTANT: These helpers NEVER modify match outcomes, training rates,
 * transfer values, or any core simulation parameter.
 */

import type { MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo, SubscriptionTier } from '@/types/game';
import { COSMETIC_ITEMS, AD_REWARD_LIMITS, STARTER_KIT, STARTER_KIT_WINDOW_MS, PRO_ONE_TIME_PRODUCT_IDS, PRODUCTS, CONSUMABLE_PRODUCT_IDS, FREE_TRIAL_DAYS, SUB_TRIAL_PRODUCT_IDS, TRIAL_TARGET_PRODUCT_ID } from '@/config/monetization';
import { observeClock } from '@/store/helpers/persistence';
// legacy: ownership of earned cosmetics. utils/managerPass never imports this
// module, so there is no cycle.
import { isEarnedCosmeticOwned } from '@/utils/managerPass';

/**
 * The time entitlement decisions are judged against.
 *
 * NOT `Date.now()`. Every check here compares a stored `expiresAt` to the
 * device clock, which the user controls — so winding it backwards extended a
 * lapsed subscription indefinitely, offline, with no purchase, and re-armed the
 * Starter Kit window. There is no backend to ask, so the defence is local:
 * `observeClock` keeps the furthest time this device ever saw and returns the
 * later of that and now, which makes rolling the clock back worth nothing.
 *
 * A successful store sync calls `reanchorClock`, so a device whose clock was
 * genuinely wrong (set far ahead, then corrected) recovers rather than reading
 * as permanently expired.
 */
function entitlementNow(): number {
  return observeClock();
}

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
    return expiresMs < entitlementNow();
  }

  // Recurring tier with no expiry date. Fail closed against a bounded window
  // anchored on when we wrote the record: a real subscriber keeps Pro for at
  // least a full billing period offline, and the next successful sync replaces
  // this record with a properly dated one. With no anchor at all (a record
  // predating `grantedAt`, or a hand-edited save) we cannot verify anything, so
  // treat it as expired and let the store be the judge.
  const grantedMs = sub.grantedAt ? new Date(sub.grantedAt).getTime() : NaN;
  if (!Number.isFinite(grantedMs)) return true;
  return grantedMs + UNANCHORED_WINDOW_MS[sub.tier] < entitlementNow();
}

/** Check if the player has an active subscription */
export function isSubscriptionActive(state: MonetizationState): boolean {
  return state.subscription != null && !isSubscriptionExpired(state.subscription);
}

/**
 * An active store subscription the player can renew, cancel or manage.
 *
 * Narrower than `isSubscriptionActive`: `extractSubscriptionInfo` also writes a
 * Lifetime owner's record into the subscription slot, and the Shop and Settings
 * used to present that as an "Active Subscription · lifetime" with a Manage
 * Subscription button leading to a store page that lists nothing. Pro status
 * itself is untouched — `isPro()` remains the only authority.
 */
export function hasRecurringSubscription(state: MonetizationState): boolean {
  const sub = state.subscription;
  if (!sub || PRODUCTS[sub.productId]?.type !== 'subscription') return false;
  return isSubscriptionActive(state);
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

/** Milliseconds for an ISO date, NaN when absent or unparseable. */
const isoMs = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);

/**
 * Is `candidate` a lapse that ended AFTER `other` was last vouched for?
 *
 * `extractSubscriptionInfo` records a refund, revocation or lapse as a record
 * written after its own expiry (`expiresAt <= grantedAt`). That shape alone is
 * not proof of an observation: the v73→v74 migration backfilled `grantedAt`
 * with the migration time on every dated record, so an old save's long-expired
 * local trial has it too. What makes the lapse the newer verdict is that the
 * subscription ENDED at or after the other record was written — e.g. a refund
 * of the very subscription the other record describes. A lapse that ended
 * before the other record was written (an old trial; a subscription the player
 * has since restarted) never overrides it. An undated other record (no
 * `grantedAt`) cannot be compared, and the lapse wins.
 */
function isNewerObservedLapse(candidate: SubscriptionInfo, other: SubscriptionInfo): boolean {
  const expires = isoMs(candidate.expiresAt);
  const observed = isoMs(candidate.grantedAt);
  if (!Number.isFinite(expires) || !Number.isFinite(observed) || expires > observed) return false;
  const otherObserved = isoMs(other.grantedAt);
  return !Number.isFinite(otherObserved) || expires >= otherObserved;
}

/**
 * Should a sync refuse to write `incoming` over `current`?
 *
 * True when `incoming` is an observed lapse (see `isNewerObservedLapse`) that
 * ended before `current` — still active — was written. The live sync paths
 * (GameShell's launch sync and listener, `syncStoreState`) apply the same rule
 * `mergeDeviceMonetization` applies on load: a returning subscriber whose old
 * Yearly lapsed buys Monthly, `purchaseAndSync` writes its local record because
 * the customer record has not caught up (or Monthly is not attached to `pro`),
 * and the next payload still reports the old Yearly as inactive. That verdict
 * is about a subscription that ended before this purchase, so it must not
 * revoke the Pro the player just paid for.
 */
export function isStaleLapseOver(incoming: SubscriptionInfo | null, current: SubscriptionInfo | null): boolean {
  if (!incoming || !current || isSubscriptionExpired(current)) return false;
  const expires = isoMs(incoming.expiresAt);
  const observed = isoMs(incoming.grantedAt);
  if (!Number.isFinite(expires) || !Number.isFinite(observed) || expires > observed) return false;
  return !isNewerObservedLapse(incoming, current);
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
 * first-launch timestamp. A purchase is only ever added by this function; the
 * one thing it lets end a subscription is the store's own lapse verdict when it
 * postdates the other record (see `isNewerObservedLapse`). Otherwise the store
 * remains the authority for taking one away (an expired subscription still
 * reads as expired through isSubscriptionExpired).
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
  // which is the one a RevenueCat sync can have refreshed. The exception is a
  // lapse the store reported AFTER the other record was written (a refund or
  // revocation): the newer verdict wins, or loading a save from before the
  // refund would hand the refunded subscription back.
  const savedSub = saved.subscription ?? null;
  const liveSub = live.subscription ?? null;
  let subscription: SubscriptionInfo | null;
  if (!savedSub) subscription = liveSub;
  else if (!liveSub) subscription = savedSub;
  else if (isNewerObservedLapse(liveSub, savedSub)) subscription = liveSub;
  else if (isNewerObservedLapse(savedSub, liveSub)) subscription = savedSub;
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
  const ms = new Date(expiresAt).getTime() - entitlementNow();
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
  // legacy: an EARNED cosmetic (Manager Pass / Legacy tier) is owned through
  // play and never appears in `entitlements` — no product grants it.
  if (item.earnedBy) return isEarnedCosmeticOwned(item);
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
  // Already owns what the kit contains: recommending it again sold the Manager
  // Identity Pack to its own owner (StoreKit then answers "already purchased").
  if (STARTER_KIT.includes.every(id => state.entitlements.includes(id))) return false;
  const elapsed = entitlementNow() - state.firstLaunchTimestamp;
  return elapsed < STARTER_KIT_WINDOW_MS;
}

/** Get remaining time for starter kit offer in milliseconds */
export function getStarterKitRemainingMs(state: MonetizationState): number {
  if (!isStarterKitAvailable(state)) return 0;
  const elapsed = entitlementNow() - state.firstLaunchTimestamp;
  return Math.max(0, STARTER_KIT_WINDOW_MS - elapsed);
}

/** Count how many products the player owns (for stats/display) */
export function getPurchaseCount(state: MonetizationState): number {
  return state.entitlements.length;
}

// ── Paywall free-trial offers ──

export interface PaywallTrialInputs {
  /** Plans the paywall is showing. */
  planIds: ProductId[];
  /** True on a device with a real store; false on web/dev (purchases mocked). */
  native: boolean;
  /** No subscription record on this install. */
  locallyEligible: boolean;
  /** Per-product store eligibility: true / false / null (unknown). */
  eligibility: Partial<Record<ProductId, boolean | null>>;
  /** Free intro-offer length per product, as App Store Connect configured it. */
  storeTrialDays: Partial<Record<ProductId, number>>;
}

/**
 * Which plans the paywall may sell with a free trial, and for how many days.
 *
 * On device a plan qualifies only when the store BOTH has a free intro offer
 * on that exact product AND confirms this Apple ID can still use it. The trial
 * used to be hardcoded — "7-day free trial" on Yearly and Monthly, gated on
 * one probe of Yearly alone — so if App Store Connect put the offer on the
 * other product, or gave it a different length, the paywall either hid a
 * trial the store would grant or promised one it would not (3.1.2(c)).
 * Unknown eligibility never qualifies. Off-device the flow is mocked, so every
 * trial-bearing plan shows the configured default to keep it testable.
 */
export function resolvePaywallTrials(inputs: PaywallTrialInputs): Partial<Record<ProductId, number>> {
  const trials: Partial<Record<ProductId, number>> = {};
  if (!inputs.locallyEligible) return trials;
  for (const id of inputs.planIds) {
    if (!SUB_TRIAL_PRODUCT_IDS.includes(id)) continue;
    if (!inputs.native) {
      trials[id] = FREE_TRIAL_DAYS;
      continue;
    }
    const days = inputs.storeTrialDays[id];
    if (inputs.eligibility[id] === true && typeof days === 'number' && days > 0) trials[id] = days;
  }
  return trials;
}

/** The plan a paywall should preselect: the trial target when it carries a
 *  trial (or when no plan does), otherwise the first plan that does — a free
 *  trial the player never sees selected converts nobody. */
export function preferredPaywallPlan(
  visibleIds: ProductId[],
  trials: Partial<Record<ProductId, number>>,
): ProductId | undefined {
  const target = visibleIds.includes(TRIAL_TARGET_PRODUCT_ID) ? TRIAL_TARGET_PRODUCT_ID : undefined;
  if (target && trials[target]) return target;
  const withTrial = visibleIds.find(id => trials[id]);
  return withTrial ?? target ?? visibleIds[0];
}

/**
 * A store price divided into periods ("works out at X/month"), formatted for
 * the storefront's currency — never by splicing `toFixed(2)` into the store's
 * own price string, which printed "2.08 €" in Germany and "¥250.00" in Japan (a
 * yen has no minor unit). Null — the caller omits the line — when the amount or
 * the currency is unknown, or the runtime rejects the currency code.
 *
 * It must read like the price it sits next to. The paywall showed "$24.99/year"
 * beside "Works out at US$2.08/month": the store string is formatted in the
 * STOREFRONT's locale, the derived line was formatted in the DEVICE's (en-GB
 * spells a US dollar "US$"). So, in order:
 *   1. `storePrice` (the price string shown beside it): the per-period amount
 *      is written in that string's own shape — its symbol, symbol position and
 *      separators — provided the string round-trips to `total`, so a string we
 *      cannot read is never trusted.
 *   2. Otherwise Intl with `currencyDisplay: 'narrowSymbol'` ("$", not "US$"),
 *      falling back to the default display where a runtime lacks narrowSymbol.
 */
export function formatPerPeriodPrice(
  total: number | null | undefined,
  periods: number,
  currencyCode: string | undefined,
  locale?: string,
  storePrice?: string,
): string | null {
  if (total == null || !Number.isFinite(total) || total <= 0 || !(periods > 0) || !currencyCode) return null;
  let fractionDigits: number;
  try {
    fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode })
      .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return null;
  }
  const amount = total / periods;
  const likeStore = storePrice ? formatLikeStorePrice(amount, total, storePrice, fractionDigits) : null;
  if (likeStore) return likeStore;
  for (const currencyDisplay of ['narrowSymbol', 'symbol'] as const) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, currencyDisplay }).format(amount);
    } catch { /* narrowSymbol unsupported → plain symbol */ }
  }
  return null;
}

/** `amount` written in the shape of `storePrice` (which must say `total`), or
 *  null when the string cannot be read with certainty. */
function formatLikeStorePrice(amount: number, total: number, storePrice: string, fractionDigits: number): string | null {
  const match = /\d(?:[\d.,'\u2019\s\u00a0\u202f]*\d)?/.exec(storePrice);
  if (!match) return null;
  const run = match[0];
  const seps = run.replace(/\d/g, '');
  let decimal = '';
  if (fractionDigits > 0) {
    // The decimal separator is the last non-digit, followed by exactly the
    // currency's minor-unit digits. A price shown without its minor unit is
    // not a template we can extend.
    const tail = new RegExp(`([^\\d])(\\d{${fractionDigits}})$`).exec(run);
    if (!tail) return null;
    decimal = tail[1];
  }
  const groupChars = decimal ? seps.slice(0, -1) : seps;
  const group = groupChars[0] ?? '';
  if ([...groupChars].some(c => c !== group) || (group && group === decimal)) return null;
  // Round-trip: the template must say exactly the total we divide.
  const parsed = Number((group ? run.split(group).join('') : run).replace(decimal || '\u0000', '.'));
  if (!Number.isFinite(parsed) || Math.abs(parsed - total) > 0.5 * 10 ** -fractionDigits) return null;
  const [intPart, fracPart] = amount.toFixed(fractionDigits).split('.');
  const grouped = group ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group) : intPart;
  const number = fracPart ? `${grouped}${decimal}${fracPart}` : grouped;
  return storePrice.slice(0, match.index) + number + storePrice.slice(match.index + run.length);
}
