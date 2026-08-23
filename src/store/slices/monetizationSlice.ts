import type { GameState } from '../storeTypes';
import type { ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo } from '@/types/game';
import { PRODUCTS, COSMETIC_ITEMS, AD_REWARD_LIMITS, AD_REWARD_VALUES, adBudgetReward, DEFAULT_MONETIZATION_STATE, FREE_TRIAL_MS, TRIAL_TARGET_PRODUCT_ID, SUB_TRIAL_PRODUCT_IDS } from '@/config/monetization';
// Single source of truth for the entitlement boundary — shared with
// mergeDeviceMonetization so every writer of `entitlements` enforces it.
import { isPersistableEntitlement } from '@/utils/monetization';
import { withPromptShown, withWatchCompleted, withPromptDismissed } from '@/utils/adPacing';
import { writeDeviceEntitlements } from '@/store/helpers/persistence';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export function createMonetizationSlice(_set: Set, _get: Get) {
  /** Mirror the device-scoped purchase fields to localStorage after any change.
   *  Zustand's set() is synchronous, so calling this immediately after a
   *  mutation captures the new state. Purchases belong to the device, not to a
   *  save slot — without this, "New Game" and any pre-load screen start with no
   *  Pro until a RevenueCat sync lands, and the Starter Kit window re-arms. */
  const mirrorDevicePurchases = () => {
    const m = _get().monetization;
    writeDeviceEntitlements({
      entitlements: m.entitlements,
      subscription: m.subscription,
      firstLaunchTimestamp: m.firstLaunchTimestamp,
    });
  };

  return {
    // Deep-copy the nested arrays/objects — a shallow spread would alias
    // them to the module-level default, so one in-place mutation anywhere
    // would corrupt DEFAULT_MONETIZATION_STATE for every later consumer.
    monetization: {
      ...DEFAULT_MONETIZATION_STATE,
      entitlements: [...DEFAULT_MONETIZATION_STATE.entitlements],
      activeCosmetics: { ...DEFAULT_MONETIZATION_STATE.activeCosmetics },
      adRewardsClaimed: { ...DEFAULT_MONETIZATION_STATE.adRewardsClaimed },
    },

    /** Grant an entitlement after successful purchase. Handles bundle expansion.
     *  Subscription and consumable SKUs are silently dropped — see
     *  isPersistableEntitlement. */
    grantEntitlement: (productId: ProductId) => {
      _set((s) => {
        const product = PRODUCTS[productId];
        const newEntitlements = [...s.monetization.entitlements];

        // Add the product itself
        if (isPersistableEntitlement(productId) && !newEntitlements.includes(productId)) {
          newEntitlements.push(productId);
        }

        // Expand bundle includes
        if (product?.includes) {
          for (const included of product.includes) {
            if (isPersistableEntitlement(included) && !newEntitlements.includes(included)) {
              newEntitlements.push(included);
            }
          }
        }

        return {
          monetization: {
            ...s.monetization,
            entitlements: newEntitlements,
          },
        };
      });
      mirrorDevicePurchases();
    },

    /** Restore all entitlements (e.g. from RevenueCat restore flow).
     *  Subscription and consumable SKUs are silently dropped — see
     *  isPersistableEntitlement. */
    restoreEntitlements: (productIds: ProductId[]) => {
      _set((s) => {
        const newEntitlements = [...s.monetization.entitlements];
        for (const id of productIds) {
          if (isPersistableEntitlement(id) && !newEntitlements.includes(id)) {
            newEntitlements.push(id);
          }
          // Expand bundles
          const product = PRODUCTS[id];
          if (product?.includes) {
            for (const included of product.includes) {
              if (isPersistableEntitlement(included) && !newEntitlements.includes(included)) {
                newEntitlements.push(included);
              }
            }
          }
        }
        return {
          monetization: {
            ...s.monetization,
            entitlements: newEntitlements,
          },
        };
      });
      mirrorDevicePurchases();
    },

    /**
     * Prune entitlements the store says are no longer owned.
     *
     * Every other write path is additive, so a refunded purchase kept Pro (and
     * every cosmetic pack) permanently — buy Pro, request an Apple refund,
     * keep Pro, on every save slot via the device mirror. Only ever called
     * with a DEFINITIVE store answer (`getEntitlementsDefinitive`), never with
     * the fail-open empty list, so a network failure can't strip a paying user.
     *
     * Subscriptions are untouched: their status lives exclusively in
     * `subscription.expiresAt` and never in `entitlements`.
     */
    reconcileEntitlements: (ownedProductIds: ProductId[]) => {
      _set((s) => {
        const owned = new Set<ProductId>(ownedProductIds);
        // Expand bundles the same way `restoreEntitlements` does, so owning the
        // bundle keeps the things it includes.
        for (const id of ownedProductIds) {
          const product = PRODUCTS[id];
          if (product?.includes) for (const inc of product.includes) owned.add(inc);
        }
        // Retired SKUs are pruned like any other. `mapEntitlements` reads the
        // receipt (`allPurchasedProductIdentifiers`) and still lists
        // `com.dynastymanager.pro` among its valid IDs, so a legitimate owner
        // of the retired SKU is still reported by a definitive answer —
        // exempting it here would only have opened a refund hole.
        //
        // A Dynasty Edition owner from before the bundle expanded to
        // `pro.lifetime` does lose the redundant `com.dynastymanager.pro` ID
        // here. They keep Pro: `bundle.all` is itself in
        // `PRO_ONE_TIME_PRODUCT_IDS`, and the next restore re-grants Lifetime.
        const kept = s.monetization.entitlements.filter(id => owned.has(id));
        if (kept.length === s.monetization.entitlements.length) return {};
        return { monetization: { ...s.monetization, entitlements: kept } };
      });
      mirrorDevicePurchases();
    },

    /** Set a cosmetic selection for a given category */
    setCosmetic: (category: CosmeticCategory, cosmeticId: string) => {
      // Validate the cosmetic exists and player owns its pack
      const item = COSMETIC_ITEMS.find(c => c.id === cosmeticId && c.category === category);
      if (!item) return;
      const state = _get();
      if (!state.monetization.entitlements.includes(item.pack)) return;

      _set((s) => ({
        monetization: {
          ...s.monetization,
          activeCosmetics: {
            ...s.monetization.activeCosmetics,
            [category]: cosmeticId,
          },
        },
      }));
    },

    /** Clear a cosmetic selection (revert to default) */
    clearCosmetic: (category: CosmeticCategory) => {
      _set((s) => {
        const updated = { ...s.monetization.activeCosmetics };
        delete updated[category];
        return {
          monetization: {
            ...s.monetization,
            activeCosmetics: updated,
          },
        };
      });
    },

    /** Claim an ad reward. Returns false if limit reached. */
    claimAdReward: (rewardType: AdRewardType, contextKey?: string): boolean => {
      const state = _get();
      const season = state.season;
      const seasonKey = `${rewardType}_s${season}`;
      const claimed = state.monetization.adRewardsClaimed[seasonKey] || 0;
      const limit = AD_REWARD_LIMITS[rewardType];
      const contextualKey = contextKey ? `${seasonKey}_${contextKey}` : null;
      const contextualClaimed = contextualKey ? (state.monetization.adRewardsClaimed[contextualKey] || 0) : 0;

      if (claimed >= limit) return false;
      if (contextualKey && contextualClaimed >= 1) return false;

      _set((s) => ({
        monetization: {
          ...s.monetization,
          adRewardsClaimed: {
            ...s.monetization.adRewardsClaimed,
            [seasonKey]: claimed + 1,
            ...(contextualKey ? { [contextualKey]: contextualClaimed + 1 } : {}),
          },
        },
      }));
      return true;
    },

    /** Dismiss the starter kit offer */
    dismissStarterKit: () => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          starterKitDismissed: true,
        },
      }));
    },

    /** Initialize first launch timestamp if not set */
    initMonetizationTimestamp: () => {
      if (_get().monetization.firstLaunchTimestamp > 0) return;
      _set((s) => ({
        monetization: {
          ...s.monetization,
          firstLaunchTimestamp: Date.now(),
        },
      }));
      mirrorDevicePurchases();
    },

    /** Apply transfer budget bonus from ad reward */
    applyTransferBudgetBonus: () => {
      _set((s) => {
        const club = s.clubs[s.playerClubId];
        if (!club) return {};
        return {
          clubs: {
            ...s.clubs,
            [s.playerClubId]: {
              ...club,
              budget: club.budget + adBudgetReward(
                club.budget,
                AD_REWARD_VALUES.TRANSFER_BUDGET_BONUS_PCT,
                AD_REWARD_VALUES.TRANSFER_BUDGET_BONUS_MIN,
                AD_REWARD_VALUES.TRANSFER_BUDGET_BONUS_MAX,
              ),
            },
          },
        };
      });
    },

    // ── Rewarded-ad pacing ──
    //
    // These only move counters; whether a prompt may be raised at all is
    // decided by `canPrompt` in utils/adPacing.ts, and whether an ad can
    // actually be shown is decided by REWARDED_ADS_USABLE in utils/ads.ts.

    /** Record that an ad offer was shown to the player. */
    recordAdPromptShown: () => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          adEngagement: withPromptShown(s.monetization.adEngagement, Date.now()),
        },
      }));
    },

    /** Record a completed watch, or a Pro direct claim. Raises tomorrow's
     *  allowance and clears the dismissal decay. */
    recordAdWatched: () => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          adEngagement: withWatchCompleted(s.monetization.adEngagement, Date.now()),
        },
      }));
    },

    /** Record a dismissal. Lowers the allowance so a disengaged player is
     *  asked less, not more. */
    recordAdPromptDismissed: () => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          adEngagement: withPromptDismissed(s.monetization.adEngagement, Date.now()),
        },
      }));
    },

    /** Update subscription info from RevenueCat */
    updateSubscription: (info: SubscriptionInfo | null) => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          subscription: info,
        },
      }));
      mirrorDevicePurchases();
    },

    /** Start the introductory free trial (FREE_TRIAL_DAYS, currently 7).
     *  Marks the player as Pro-via-trial locally so all gated features unlock
     *  immediately. The native paywall flow (`purchaseProduct`) is what actually
     *  enrolls them in the monthly plan on iOS / Android — the store handles
     *  the introductory pricing automatically. On web/dev where there's no
     *  native plugin, this is the only path that grants trial access. Calling
     *  this when an active subscription already exists is a no-op. */
    startFreeTrial: (productId = TRIAL_TARGET_PRODUCT_ID) => {
      const state = _get();
      // Any existing subscription record (trial OR paid, even lapsed) makes this a no-op.
      // The old `tier !== 'trial'` check let an active trial restart its own clock,
      // granting unlimited free trials on re-entry to the onboarding screen.
      if (state.monetization.subscription) return;
      // Only a genuinely trial-eligible SUBSCRIPTION SKU may be recorded here.
      // The signature accepts any ProductId, so a caller passing a one-time SKU
      // (or a consumable) would write `{ tier: 'trial', productId: <one-time> }`
      // — and isSubscriptionExpired treats a PRO_ONE_TIME_PRODUCT_ID in the
      // subscription slot as NEVER expiring, turning a 7-day trial into
      // permanent Pro. Fail closed rather than mint that record.
      if (!SUB_TRIAL_PRODUCT_IDS.includes(productId)) {
        if (import.meta.env.DEV) {
          console.error(`[monetization] startFreeTrial called with non-trial SKU "${productId}"`);
        }
        return;
      }
      const expiresAt = new Date(Date.now() + FREE_TRIAL_MS).toISOString();
      const trialInfo: SubscriptionInfo = {
        tier: 'trial',
        productId,
        expiresAt,
        grantedAt: new Date().toISOString(),
        isInGracePeriod: false,
        willRenew: true,
        isTrial: true,
      };
      _set((s) => ({
        monetization: {
          ...s.monetization,
          subscription: trialInfo,
        },
      }));
      mirrorDevicePurchases();
    },

    /** Testing-only: wipe local Pro/entitlement state so the paywall funnel
     *  can be re-exercised on device. Purely a local-state reset — it never
     *  touches the App Store / RevenueCat, so any store-owned product will
     *  re-restore on the next launch (GameShell's entitlement sync). Exposed
     *  in the UI only behind the dev-tools build flag. */
    resetEntitlementsForTesting: () => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          entitlements: [],
          subscription: null,
          activeCosmetics: {},
        },
      }));
      // Clear the device record too, or the next hydrate at launch restores
      // exactly what the dev-tools reset was meant to wipe.
      mirrorDevicePurchases();
    },

    /** Apply season-end budget bonus from ad reward */
    applySeasonBonus: () => {
      _set((s) => {
        const club = s.clubs[s.playerClubId];
        if (!club) return {};
        return {
          clubs: {
            ...s.clubs,
            [s.playerClubId]: {
              ...club,
              budget: club.budget + adBudgetReward(
                club.budget,
                AD_REWARD_VALUES.SEASON_END_BONUS_PCT,
                AD_REWARD_VALUES.SEASON_END_BONUS_MIN,
                AD_REWARD_VALUES.SEASON_END_BONUS_MAX,
              ),
            },
          },
        };
      });
    },

    /** Apply youth preview enhancement from ad reward */
    applyYouthPreview: () => {
      _set((s) => ({
        youthAcademy: {
          ...s.youthAcademy,
          youthPreviewEnhanced: true,
        },
      }));
    },

  };
}
