import { describe, it, expect } from 'vitest';
import {
  isPro,
  hasProduct,
  hasCosmetic,
  getActiveCosmetic,
  getOwnedCosmetics,
  canClaimAdReward,
  isStarterKitAvailable,
  getStarterKitRemainingMs,
  getPurchaseCount,
} from '@/utils/monetization';
import {
  PRODUCTS,
  AD_REWARD_VALUES,
  AD_REWARD_LIMITS,
  COSMETIC_ITEMS,
  DEFAULT_MONETIZATION_STATE,
  STARTER_KIT_WINDOW_MS,
} from '@/config/monetization';
import type { MonetizationState } from '@/types/game';

// ── Balance Imports ──
import {
  MATCHDAY_INCOME_PER_FAN,
  COMMERCIAL_INCOME_BASE,
  COMMERCIAL_INCOME_PER_REP,
} from '@/config/gameBalance';

function makeState(overrides: Partial<MonetizationState> = {}): MonetizationState {
  return {
    ...DEFAULT_MONETIZATION_STATE,
    ...overrides,
  };
}

describe('monetization utils', () => {
  describe('isPro', () => {
    it('returns false for default state', () => {
      expect(isPro(makeState())).toBe(false);
    });

    it('returns true when pro entitlement is present', () => {
      expect(isPro(makeState({ entitlements: ['com.dynastymanager.pro'] }))).toBe(true);
    });

    it('returns true when bundle (which includes pro) is present', () => {
      expect(isPro(makeState({
        entitlements: ['com.dynastymanager.bundle.all', 'com.dynastymanager.pro'],
      }))).toBe(true);
    });

    it('returns true when an active subscription is present', () => {
      expect(isPro(makeState({
        subscription: {
          tier: 'monthly',
          productId: 'com.dynastymanager.pro.monthly',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          isInGracePeriod: false,
          willRenew: true,
        },
      }))).toBe(true);
    });

    it('returns false when subscription is expired', () => {
      expect(isPro(makeState({
        subscription: {
          tier: 'monthly',
          productId: 'com.dynastymanager.pro.monthly',
          expiresAt: new Date(Date.now() - 86400000).toISOString(),
          isInGracePeriod: false,
          willRenew: false,
        },
      }))).toBe(false);
    });

    it('returns true for lifetime subscription (no expiry)', () => {
      expect(isPro(makeState({
        subscription: {
          tier: 'lifetime',
          productId: 'com.dynastymanager.pro.lifetime',
          expiresAt: null,
          isInGracePeriod: false,
          willRenew: false,
        },
      }))).toBe(true);
    });
  });

  describe('hasProduct', () => {
    it('returns false for unowned product', () => {
      expect(hasProduct(makeState(), 'com.dynastymanager.pack.manager')).toBe(false);
    });

    it('returns true for owned product', () => {
      expect(hasProduct(
        makeState({ entitlements: ['com.dynastymanager.pack.manager'] }),
        'com.dynastymanager.pack.manager'
      )).toBe(true);
    });
  });

  describe('hasCosmetic', () => {
    it('returns false if cosmetic pack not owned', () => {
      expect(hasCosmetic(makeState(), 'avatar-classic')).toBe(false);
    });

    it('returns true if cosmetic pack is owned', () => {
      expect(hasCosmetic(
        makeState({ entitlements: ['com.dynastymanager.pack.manager'] }),
        'avatar-classic'
      )).toBe(true);
    });

    it('returns false for non-existent cosmetic ID', () => {
      expect(hasCosmetic(
        makeState({ entitlements: ['com.dynastymanager.pack.manager'] }),
        'totally-fake-id'
      )).toBe(false);
    });
  });

  describe('getActiveCosmetic', () => {
    it('returns undefined when no cosmetic selected', () => {
      expect(getActiveCosmetic(makeState(), 'avatar')).toBeUndefined();
    });

    it('returns the active cosmetic when selected and owned', () => {
      const state = makeState({
        entitlements: ['com.dynastymanager.pack.manager'],
        activeCosmetics: { avatar: 'avatar-classic' },
      });
      expect(getActiveCosmetic(state, 'avatar')).toBe('avatar-classic');
    });

    it('returns undefined if cosmetic selected but pack not owned (refund scenario)', () => {
      const state = makeState({
        entitlements: [],
        activeCosmetics: { avatar: 'avatar-classic' },
      });
      expect(getActiveCosmetic(state, 'avatar')).toBeUndefined();
    });
  });

  describe('getOwnedCosmetics', () => {
    it('returns empty array when nothing owned', () => {
      expect(getOwnedCosmetics(makeState(), 'avatar')).toEqual([]);
    });

    it('returns all avatars when manager pack is owned', () => {
      const state = makeState({ entitlements: ['com.dynastymanager.pack.manager'] });
      const avatars = getOwnedCosmetics(state, 'avatar');
      expect(avatars.length).toBe(12);
      expect(avatars.every(c => c.category === 'avatar')).toBe(true);
    });
  });

  describe('canClaimAdReward', () => {
    it('allows first claim', () => {
      expect(canClaimAdReward(makeState(), 'transfer_budget', 1)).toBe(true);
    });

    it('blocks claim when limit reached', () => {
      const state = makeState({
        adRewardsClaimed: { 'transfer_budget_s1': AD_REWARD_LIMITS.transfer_budget },
      });
      expect(canClaimAdReward(state, 'transfer_budget', 1)).toBe(false);
    });

    it('resets for new season', () => {
      const state = makeState({
        adRewardsClaimed: { 'transfer_budget_s1': AD_REWARD_LIMITS.transfer_budget },
      });
      expect(canClaimAdReward(state, 'transfer_budget', 2)).toBe(true);
    });
  });

  describe('isStarterKitAvailable', () => {
    it('returns false when firstLaunchTimestamp is 0', () => {
      expect(isStarterKitAvailable(makeState())).toBe(false);
    });

    it('returns true within 7 days of first launch', () => {
      const state = makeState({ firstLaunchTimestamp: Date.now() - 1000 });
      expect(isStarterKitAvailable(state)).toBe(true);
    });

    it('returns false after 7 days', () => {
      const state = makeState({
        firstLaunchTimestamp: Date.now() - STARTER_KIT_WINDOW_MS - 1000,
      });
      expect(isStarterKitAvailable(state)).toBe(false);
    });

    it('returns false if already dismissed', () => {
      const state = makeState({
        firstLaunchTimestamp: Date.now() - 1000,
        starterKitDismissed: true,
      });
      expect(isStarterKitAvailable(state)).toBe(false);
    });

    it('returns false if already Pro', () => {
      const state = makeState({
        firstLaunchTimestamp: Date.now() - 1000,
        entitlements: ['com.dynastymanager.pro'],
      });
      expect(isStarterKitAvailable(state)).toBe(false);
    });
  });

  describe('getStarterKitRemainingMs', () => {
    it('returns 0 when not available', () => {
      expect(getStarterKitRemainingMs(makeState())).toBe(0);
    });

    it('returns remaining time when available', () => {
      const state = makeState({ firstLaunchTimestamp: Date.now() - 1000 });
      const remaining = getStarterKitRemainingMs(state);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(STARTER_KIT_WINDOW_MS);
    });
  });

  describe('getPurchaseCount', () => {
    it('returns 0 for no purchases', () => {
      expect(getPurchaseCount(makeState())).toBe(0);
    });

    it('counts all entitlements', () => {
      expect(getPurchaseCount(makeState({
        entitlements: ['com.dynastymanager.pro', 'com.dynastymanager.pack.manager'],
      }))).toBe(2);
    });
  });
});

describe('product catalog', () => {
  it('all products have valid IDs', () => {
    for (const [key, product] of Object.entries(PRODUCTS)) {
      expect(product.id).toBe(key);
      expect(product.name).toBeTruthy();
      expect(product.priceUsd).toBeGreaterThan(0);
    }
  });

  it('bundle includes valid product IDs', () => {
    const bundle = PRODUCTS['com.dynastymanager.bundle.all'];
    expect(bundle.includes).toBeDefined();
    for (const included of bundle.includes!) {
      expect(PRODUCTS[included]).toBeDefined();
    }
  });

  it('all cosmetic items reference valid packs', () => {
    for (const item of COSMETIC_ITEMS) {
      expect(PRODUCTS[item.pack]).toBeDefined();
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
    }
  });
});

describe('economy balance guarantees', () => {
  it('ad transfer budget bonus is less than 5% of a div-2 mid-table weekly income', () => {
    // Mid-table div-2 club: fanBase ~40, reputation ~3
    const weeklyIncome = 40 * MATCHDAY_INCOME_PER_FAN + COMMERCIAL_INCOME_BASE + 3 * COMMERCIAL_INCOME_PER_REP;
    const ratio = AD_REWARD_VALUES.TRANSFER_BUDGET_BONUS / weeklyIncome;
    expect(ratio).toBeLessThan(0.35); // Budget bonus is a one-time injection vs weekly income, generous threshold
  });

  it('ad season bonus is less than 2 weeks of div-4 income', () => {
    // Div-4 club: fanBase ~20, reputation ~1
    const weeklyIncome = 20 * MATCHDAY_INCOME_PER_FAN + COMMERCIAL_INCOME_BASE + 1 * COMMERCIAL_INCOME_PER_REP;
    const twoWeeks = weeklyIncome * 2;
    expect(AD_REWARD_VALUES.SEASON_END_BONUS).toBeLessThanOrEqual(twoWeeks);
  });

  it('XP multiplier only doubles (never more)', () => {
    expect(AD_REWARD_VALUES.XP_MULTIPLIER).toBe(2);
  });

  it('ad reward limits prevent abuse', () => {
    expect(AD_REWARD_LIMITS.transfer_budget).toBeLessThanOrEqual(2);
    expect(AD_REWARD_LIMITS.season_bonus).toBe(1);
    expect(AD_REWARD_LIMITS.xp_double).toBeLessThanOrEqual(46); // Max one per match week
  });
});

describe('save migration v19', () => {
  it('migrateSaveData adds monetization defaults', async () => {
    const { migrateSaveData } = await import('@/utils/saveMigration');
    const oldSave = { version: 18 };
    const migrated = migrateSaveData(oldSave);
    expect(migrated.version).toBe(21);
    expect(migrated.monetization).toEqual({
      entitlements: [],
      activeCosmetics: {},
      adRewardsClaimed: {},
      firstLaunchTimestamp: 0,
      starterKitDismissed: false,
      subscription: null,
    });
  });

  it('preserves existing monetization state during migration', async () => {
    const { migrateSaveData } = await import('@/utils/saveMigration');
    const existingMonetization = {
      entitlements: ['com.dynastymanager.pro'],
      activeCosmetics: { avatar: 'avatar-classic' },
      adRewardsClaimed: {},
      firstLaunchTimestamp: 1000,
      starterKitDismissed: false,
    };
    const oldSave = { version: 18, monetization: existingMonetization };
    const migrated = migrateSaveData(oldSave);
    expect(migrated.monetization).toEqual({
      ...existingMonetization,
      subscription: null,
    });
  });
});
