import type { GameState } from '../storeTypes';
import type { ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo } from '@/types/game';
import { PRODUCTS, COSMETIC_ITEMS, AD_REWARD_LIMITS, AD_REWARD_VALUES, DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import { grantXP } from '@/utils/managerPerks';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export function createMonetizationSlice(_set: Set, _get: Get) {
  return {
    monetization: { ...DEFAULT_MONETIZATION_STATE },

    /** Grant an entitlement after successful purchase. Handles bundle expansion. */
    grantEntitlement: (productId: ProductId) => {
      _set((s) => {
        const product = PRODUCTS[productId];
        const newEntitlements = [...s.monetization.entitlements];

        // Add the product itself
        if (!newEntitlements.includes(productId)) {
          newEntitlements.push(productId);
        }

        // Expand bundle includes
        if (product?.includes) {
          for (const included of product.includes) {
            if (!newEntitlements.includes(included)) {
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
    },

    /** Restore all entitlements (e.g. from RevenueCat restore flow) */
    restoreEntitlements: (productIds: ProductId[]) => {
      _set((s) => {
        const newEntitlements = [...s.monetization.entitlements];
        for (const id of productIds) {
          if (!newEntitlements.includes(id)) {
            newEntitlements.push(id);
          }
          // Expand bundles
          const product = PRODUCTS[id];
          if (product?.includes) {
            for (const included of product.includes) {
              if (!newEntitlements.includes(included)) {
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
              budget: club.budget + AD_REWARD_VALUES.TRANSFER_BUDGET_BONUS,
            },
          },
        };
      });
    },

    /** Update subscription info from RevenueCat */
    updateSubscription: (info: SubscriptionInfo | null) => {
      _set((s) => ({
        monetization: {
          ...s.monetization,
          subscription: info,
        },
      }));
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
              budget: club.budget + AD_REWARD_VALUES.SEASON_END_BONUS,
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

    /** Apply double XP from ad reward for the last match */
    applyDoubleXP: () => {
      const state = _get();
      const bonusXP = state.lastMatchXPGain;
      if (bonusXP <= 0) return;
      _set({
        managerProgression: grantXP(state.managerProgression, bonusXP),
      });
    },
  };
}
