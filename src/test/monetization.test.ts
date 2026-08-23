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
  isOnFreeTrial,
  getFreeTrialDaysRemaining,
  mergeDeviceMonetization,
} from '@/utils/monetization';
import { useGameStore } from '@/store/gameStore';
import {
  PRODUCTS,
  AD_REWARDS,
  SUB_TRIAL_PRODUCT_IDS,
  AD_REWARD_VALUES,
  adBudgetReward,
  AD_REWARD_LIMITS,
  COSMETIC_ITEMS,
  DEFAULT_MONETIZATION_STATE,
  STARTER_KIT_WINDOW_MS,
  PRO_ONE_TIME_PRODUCT_IDS,
  CONSUMABLE_PRODUCT_IDS,
  RETIRED_PRODUCT_IDS,
  isSellable,
  TRIAL_TARGET_PRODUCT_ID,
} from '@/config/monetization';
import type { MonetizationState, ProductId } from '@/types/game';

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

    // ── Revenue invariants (CLAUDE.md: violating these = revenue bugs) ──

    it('does NOT grant Pro from a subscription SKU sitting in entitlements', () => {
      // RevenueCat keeps expired subs in allPurchasedProductIdentifiers forever;
      // monthly/annual are not one-time Pro IDs, so their presence in
      // `entitlements` must not, on its own, grant Pro.
      expect(isPro(makeState({ entitlements: ['com.dynastymanager.pro.monthly'] }))).toBe(false);
      expect(isPro(makeState({ entitlements: ['com.dynastymanager.pro.annual'] }))).toBe(false);
    });

    it('does NOT grant Pro to a lapsed subscriber even with the sub SKU in entitlements', () => {
      expect(isPro(makeState({
        entitlements: ['com.dynastymanager.pro.monthly'],
        subscription: {
          tier: 'monthly',
          productId: 'com.dynastymanager.pro.monthly',
          expiresAt: new Date(Date.now() - 86400000).toISOString(),
          isInGracePeriod: false,
          willRenew: false,
        },
      }))).toBe(false);
    });

    it('reads a malformed/empty expiry as expired (no silent permanent Pro)', () => {
      for (const bad of ['', 'garbage']) {
        expect(isPro(makeState({
          subscription: {
            tier: 'monthly',
            productId: 'com.dynastymanager.pro.monthly',
            expiresAt: bad,
            isInGracePeriod: false,
            willRenew: false,
          },
        }))).toBe(false);
      }
    });
  });

  describe('free trial', () => {
    const trialState = (expiresAt: string) => makeState({
      subscription: {
        tier: 'trial',
        productId: 'com.dynastymanager.pro.monthly',
        expiresAt,
        isInGracePeriod: false,
        willRenew: true,
        isTrial: true,
      },
    });

    it('isOnFreeTrial returns true within trial window', () => {
      const state = trialState(new Date(Date.now() + 86400000 * 2).toISOString());
      expect(isOnFreeTrial(state)).toBe(true);
    });

    it('isOnFreeTrial returns false after trial expires', () => {
      const state = trialState(new Date(Date.now() - 1000).toISOString());
      expect(isOnFreeTrial(state)).toBe(false);
    });

    it('isOnFreeTrial returns false for non-trial subscriptions', () => {
      const state = makeState({
        subscription: {
          tier: 'monthly',
          productId: 'com.dynastymanager.pro.monthly',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          isInGracePeriod: false,
          willRenew: true,
        },
      });
      expect(isOnFreeTrial(state)).toBe(false);
    });

    it('isPro returns true while on trial', () => {
      const state = trialState(new Date(Date.now() + 86400000).toISOString());
      expect(isPro(state)).toBe(true);
    });

    it('getFreeTrialDaysRemaining rounds up partial days', () => {
      const state = trialState(new Date(Date.now() + (1.4 * 86400000)).toISOString());
      expect(getFreeTrialDaysRemaining(state)).toBe(2);
    });

    it('getFreeTrialDaysRemaining returns 0 for expired trial', () => {
      const state = trialState(new Date(Date.now() - 1000).toISOString());
      expect(getFreeTrialDaysRemaining(state)).toBe(0);
    });

    it('getFreeTrialDaysRemaining returns 0 when no subscription', () => {
      expect(getFreeTrialDaysRemaining(makeState())).toBe(0);
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

  it('never offers two sellable products that grant the same thing', () => {
    // The $7.99 `com.dynastymanager.pro` regression: it granted precisely the
    // Pro that `pro.lifetime` grants, for less than half the price, on the same
    // screen. Every row above it became unsellable and revenue per paying
    // player was capped at the cheapest duplicate. Two sellable SKUs may
    // overlap only if one grants strictly more — and then it must cost more.
    // Compare what a purchase actually LEAVES the player with, not which IDs
    // it writes. `pro` and `pro.lifetime` are different IDs that both resolve
    // to the same thing — permanent Pro — which is exactly why an ID-set
    // comparison would have waved the original bug straight through.
    const cosmeticPacks = new Set<string>(COSMETIC_ITEMS.map(item => item.pack));
    const grants = (id: ProductId): Set<string> => {
      const ids = [id, ...(PRODUCTS[id].includes || [])];
      const out = new Set<string>();
      if (ids.some(x => PRO_ONE_TIME_PRODUCT_IDS.includes(x))) out.add('PERMANENT_PRO');
      for (const x of ids) if (cosmeticPacks.has(x)) out.add(x);
      return out;
    };

    // Scoped to permanent, non-consumable products. Subscriptions grant Pro
    // too but expire, so they are not substitutes for a one-time unlock;
    // consumables grant nothing persistent and would all compare equal.
    const sellable = (Object.keys(PRODUCTS) as ProductId[]).filter(
      id => isSellable(id)
        && PRODUCTS[id].type === 'one_time'
        && !CONSUMABLE_PRODUCT_IDS.includes(id),
    );

    for (let i = 0; i < sellable.length; i++) {
      for (let j = i + 1; j < sellable.length; j++) {
        const [a, b] = [sellable[i], sellable[j]];
        const [ga, gb] = [grants(a), grants(b)];
        const aInB = [...ga].every(x => gb.has(x));
        const bInA = [...gb].every(x => ga.has(x));

        // Identical grant sets — one of them is dead weight.
        expect(aInB && bInA, `${a} and ${b} grant the same products`).toBe(false);

        // Strict superset must be the dearer of the two.
        if (aInB) expect(PRODUCTS[b].priceUsd, `${b} grants more than ${a} but costs less`).toBeGreaterThan(PRODUCTS[a].priceUsd);
        if (bInA) expect(PRODUCTS[a].priceUsd, `${a} grants more than ${b} but costs less`).toBeGreaterThan(PRODUCTS[b].priceUsd);
      }
    }
  });

  it('keeps the Pro ladder in a sellable order', () => {
    const monthly = PRODUCTS['com.dynastymanager.pro.monthly'].priceUsd;
    const annual = PRODUCTS['com.dynastymanager.pro.annual'].priceUsd;
    const lifetime = PRODUCTS['com.dynastymanager.pro.lifetime'].priceUsd;

    // Yearly must beat twelve months of Monthly by enough to be worth badging.
    // Below ~40% the "BEST VALUE" row is a rounding error and nobody upgrades.
    const annualSaving = 1 - annual / (monthly * 12);
    expect(annualSaving).toBeGreaterThanOrEqual(0.4);

    // Lifetime brackets Yearly. Under 1.5x it cannibalises the subscription;
    // over 2x nobody takes it and it stops working as an anchor.
    expect(lifetime).toBeGreaterThanOrEqual(annual * 1.5);
    expect(lifetime).toBeLessThanOrEqual(annual * 2);
  });

  it('prices the bundle below the sum of what it grants', () => {
    const bundle = PRODUCTS['com.dynastymanager.bundle.all'];
    const parts = bundle.includes!.reduce((sum, id) => sum + PRODUCTS[id].priceUsd, 0);
    expect(bundle.priceUsd).toBeLessThan(parts);
  });

  it('honours retired products forever', () => {
    // Retiring is a *sale* change. A retired ID stays in the catalog and in the
    // Pro entitlement list, because owners hold it in `monetization.entitlements`
    // and recover it through `restoreEntitlements`. Deleting one revokes Pro
    // from players who already paid.
    for (const id of RETIRED_PRODUCT_IDS) {
      expect(PRODUCTS[id], `retired ${id} was deleted from the catalog`).toBeDefined();
      expect(isSellable(id)).toBe(false);
    }
    expect(PRO_ONE_TIME_PRODUCT_IDS).toContain('com.dynastymanager.pro');
  });

  it('points the free trial at a plan that actually offers one', () => {
    expect(SUB_TRIAL_PRODUCT_IDS).toContain(TRIAL_TARGET_PRODUCT_ID);
    expect(PRODUCTS[TRIAL_TARGET_PRODUCT_ID].type).toBe('subscription');
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
  it('ad budget rewards scale with club size and stay capped at both ends', () => {
    const { TRANSFER_BUDGET_BONUS_PCT: pct, TRANSFER_BUDGET_BONUS_MIN: min, TRANSFER_BUDGET_BONUS_MAX: max } = AD_REWARD_VALUES;

    // A bottom-tier club must not have its budget transformed by one ad. The
    // old flat GBP 500K grant was ~100% of such a budget.
    const smallBudget = 300_000;
    const smallReward = adBudgetReward(smallBudget, pct, min, max);
    expect(smallReward).toBe(min);
    expect(smallReward / smallBudget).toBeLessThan(0.2);

    // A rich club gets a meaningful but clamped amount.
    const bigBudget = 200_000_000;
    const bigReward = adBudgetReward(bigBudget, pct, min, max);
    expect(bigReward).toBe(max);
    expect(bigReward / bigBudget).toBeLessThan(0.01);

    // Mid-tier sits on the proportional band, between the clamps.
    const midReward = adBudgetReward(4_000_000, pct, min, max);
    expect(midReward).toBe(200_000);
    expect(midReward).toBeGreaterThan(min);
    expect(midReward).toBeLessThan(max);
  });

  it('ad budget rewards survive a zero or malformed budget', () => {
    const { SEASON_END_BONUS_PCT: pct, SEASON_END_BONUS_MIN: min, SEASON_END_BONUS_MAX: max } = AD_REWARD_VALUES;
    expect(adBudgetReward(0, pct, min, max)).toBe(min);
    expect(adBudgetReward(-5_000, pct, min, max)).toBe(min);
    expect(adBudgetReward(NaN, pct, min, max)).toBe(min);
  });

  it('no ad reward grants manager XP — XP feeds perks, perks feed the sim', () => {
    // Manager XP unlocks perks (training_ground, set_piece_coach, dna_coach)
    // which are read by applyPlayerDevelopment and simulateMatch. An XP reward
    // is therefore monetization mutating simulation parameters, which the
    // header contracts in config/monetization.ts and utils/monetization.ts
    // forbid. Guard the removal so it cannot be reintroduced by accident.
    expect(Object.keys(AD_REWARDS)).not.toContain('xp_double');
    expect(AD_REWARD_VALUES).not.toHaveProperty('XP_MULTIPLIER');
  });

  it('ad reward limits prevent abuse', () => {
    expect(AD_REWARD_LIMITS.transfer_budget).toBeLessThanOrEqual(2);
    expect(AD_REWARD_LIMITS.season_bonus).toBe(1);
  });
});

describe('save migration (v22→v23 clean break)', () => {
  it('migrateSaveData performs clean break from pre-v23 saves', async () => {
    const { migrateSaveData, CURRENT_VERSION } = await import('@/utils/saveMigration');
    const oldSave = { version: 18 };
    const migrated = migrateSaveData(oldSave);
    expect(migrated.version).toBe(CURRENT_VERSION);
    // Clean break resets game state — old fictional league data is incompatible
    expect(migrated.gameStarted).toBe(false);
    expect(migrated.playerClubId).toBe('');
    expect(migrated.playerDivision).toBe('eng');
  });

  it('clean break resets state even with existing monetization', async () => {
    const { migrateSaveData, CURRENT_VERSION } = await import('@/utils/saveMigration');
    const existingMonetization = {
      entitlements: ['com.dynastymanager.pro'],
      activeCosmetics: { avatar: 'avatar-classic' },
      adRewardsClaimed: {},
      firstLaunchTimestamp: 1000,
      starterKitDismissed: false,
    };
    const oldSave = { version: 18, monetization: existingMonetization };
    const migrated = migrateSaveData(oldSave);
    expect(migrated.version).toBe(CURRENT_VERSION);
    // Clean break at v22→v23 resets everything
    expect(migrated.gameStarted).toBe(false);
  });
});

describe('subscription expiry is anchored, never permanent by omission', () => {
  const base = { productId: 'com.dynastymanager.pro.monthly' as const, isInGracePeriod: false, willRenew: true };

  it('treats a monthly sub with no expiry and no anchor as expired', async () => {
    const { isPro } = await import('@/utils/monetization');
    // The bug this guards: `expiresAt == null` used to mean "lifetime", so a
    // RevenueCat response that omitted expirationDate on an active monthly
    // entitlement granted Pro forever for one month's payment.
    expect(isPro({
      entitlements: [], activeCosmetics: {}, adRewardsClaimed: {},
      subscription: { ...base, tier: 'monthly', expiresAt: null },
    } as never)).toBe(false);
  });

  it('honours a monthly sub with no expiry inside its anchored window', async () => {
    const { isPro } = await import('@/utils/monetization');
    expect(isPro({
      entitlements: [], activeCosmetics: {}, adRewardsClaimed: {},
      subscription: { ...base, tier: 'monthly', expiresAt: null, grantedAt: new Date().toISOString() },
    } as never)).toBe(true);
  });

  it('expires a monthly sub whose anchor is older than a billing period', async () => {
    const { isPro } = await import('@/utils/monetization');
    const stale = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    expect(isPro({
      entitlements: [], activeCosmetics: {}, adRewardsClaimed: {},
      subscription: { ...base, tier: 'monthly', expiresAt: null, grantedAt: stale },
    } as never)).toBe(false);
  });

  it('keeps lifetime permanent, identified by tier rather than a missing date', async () => {
    const { isPro } = await import('@/utils/monetization');
    expect(isPro({
      entitlements: [], activeCosmetics: {}, adRewardsClaimed: {},
      subscription: { productId: 'com.dynastymanager.pro.lifetime', tier: 'lifetime', expiresAt: null, isInGracePeriod: false, willRenew: false },
    } as never)).toBe(true);
  });
});

describe('imported saves cannot grant entitlements', () => {
  it('strips monetization from an imported payload', async () => {
    const { importJsonToSlot } = await import('@/utils/saveBackup');
    const { CURRENT_VERSION } = await import('@/utils/saveMigration');
    const { readSaveSlot, __resetSaveStorageForTests } = await import('@/store/helpers/persistence');
    __resetSaveStorageForTests();
    // A hand-edited export is the whole exploit: add the Pro SKU, re-import,
    // hold Pro forever (restoreEntitlements only ever ADDS).
    const forged = {
      version: CURRENT_VERSION,
      playerClubId: 'ars',
      clubs: { ars: { id: 'ars', playerIds: [], lineup: [], subs: [] } },
      season: 1,
      week: 1,
      monetization: { entitlements: ['com.dynastymanager.pro'], activeCosmetics: {}, adRewardsClaimed: {} },
    };
    const res = importJsonToSlot(1, JSON.stringify(forged));
    expect(res.ok).toBe(true);
    const written = JSON.parse(readSaveSlot(1) as string);
    expect(written.monetization).toBeUndefined();
  });
});

describe('mergeDeviceMonetization', () => {
  const sub = (over = {}) => ({
    tier: 'monthly' as const,
    productId: 'com.dynastymanager.pro.monthly' as const,
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    isInGracePeriod: false,
    willRenew: true,
    ...over,
  });
  const expiredSub = () => sub({ expiresAt: new Date(Date.now() - 86_400_000).toISOString() });

  it('unions entitlements from both sides and never drops one', () => {
    const r = mergeDeviceMonetization(
      { entitlements: ['com.dynastymanager.pack.manager'], subscription: null, firstLaunchTimestamp: 5 },
      { entitlements: ['com.dynastymanager.pro'], subscription: null, firstLaunchTimestamp: 9 },
    );
    expect(r.entitlements).toContain('com.dynastymanager.pro');
    expect(r.entitlements).toContain('com.dynastymanager.pack.manager');
  });

  it('deduplicates entitlements present on both sides', () => {
    const r = mergeDeviceMonetization(
      { entitlements: ['com.dynastymanager.pro'], subscription: null, firstLaunchTimestamp: 0 },
      { entitlements: ['com.dynastymanager.pro'], subscription: null, firstLaunchTimestamp: 0 },
    );
    expect(r.entitlements).toEqual(['com.dynastymanager.pro']);
  });

  it('takes whichever side has a subscription when the other has none', () => {
    const s = sub();
    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: s, firstLaunchTimestamp: 0 },
      { entitlements: [], subscription: null, firstLaunchTimestamp: 0 },
    ).subscription).toEqual(s);
    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: null, firstLaunchTimestamp: 0 },
      { entitlements: [], subscription: s, firstLaunchTimestamp: 0 },
    ).subscription).toEqual(s);
  });

  it('prefers an active subscription over an expired one, from either side', () => {
    const active = sub();
    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: active, firstLaunchTimestamp: 0 },
      { entitlements: [], subscription: expiredSub(), firstLaunchTimestamp: 0 },
    ).subscription).toEqual(active);
    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: expiredSub(), firstLaunchTimestamp: 0 },
      { entitlements: [], subscription: active, firstLaunchTimestamp: 0 },
    ).subscription).toEqual(active);
  });

  it('takes the earliest REAL first-launch stamp so the Starter Kit cannot re-arm', () => {
    // 0 means "never stamped" and must not win — `??` would wrongly keep it.
    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: null, firstLaunchTimestamp: 1_000 },
      { entitlements: [], subscription: null, firstLaunchTimestamp: 0 },
    ).firstLaunchTimestamp).toBe(1_000);

    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: null, firstLaunchTimestamp: 8_000 },
      { entitlements: [], subscription: null, firstLaunchTimestamp: 3_000 },
    ).firstLaunchTimestamp).toBe(3_000);

    expect(mergeDeviceMonetization(
      { entitlements: [], subscription: null, firstLaunchTimestamp: 0 },
      { entitlements: [], subscription: null, firstLaunchTimestamp: 0 },
    ).firstLaunchTimestamp).toBe(0);
  });

  it('strips subscription and consumable SKUs from the union', () => {
    // A save from an older build (or a hand-edited one) can carry a banned SKU
    // in `entitlements`. Unioning raw would make that contamination permanent
    // and carry it into every other slot — a lapsed subscriber would keep Pro
    // forever, which is the exact failure isPersistableEntitlement exists to
    // prevent.
    const r = mergeDeviceMonetization(
      {
        entitlements: [
          'com.dynastymanager.pro.monthly',
          'com.dynastymanager.pack.gold',
          'com.dynastymanager.pro',
        ],
        subscription: null,
        firstLaunchTimestamp: 0,
      },
      { entitlements: ['com.dynastymanager.pack.icon'], subscription: null, firstLaunchTimestamp: 0 },
    );
    expect(r.entitlements).toEqual(['com.dynastymanager.pro']);
    expect(isPro({ ...DEFAULT_MONETIZATION_STATE, entitlements: r.entitlements })).toBe(true);
  });

  it('survives missing entitlement arrays', () => {
    const r = mergeDeviceMonetization(
      { entitlements: undefined as never, subscription: null, firstLaunchTimestamp: 0 },
      { entitlements: undefined as never, subscription: null, firstLaunchTimestamp: 0 },
    );
    expect(r.entitlements).toEqual([]);
  });
});

describe('startFreeTrial SKU validation', () => {
  it('refuses a one-time SKU, which would otherwise become permanent Pro', () => {
    // isSubscriptionExpired treats a PRO_ONE_TIME_PRODUCT_ID in the
    // subscription slot as never expiring, so writing one here would convert a
    // 7-day trial into Pro forever.
    useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });
    useGameStore.getState().startFreeTrial('com.dynastymanager.pro');
    expect(useGameStore.getState().monetization.subscription).toBeNull();
  });

  it('refuses a consumable SKU', () => {
    useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });
    useGameStore.getState().startFreeTrial('com.dynastymanager.pack.gold');
    expect(useGameStore.getState().monetization.subscription).toBeNull();
  });

  it('accepts the trial-eligible subscription SKUs', () => {
    for (const id of SUB_TRIAL_PRODUCT_IDS) {
      useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });
      useGameStore.getState().startFreeTrial(id);
      const sub = useGameStore.getState().monetization.subscription;
      expect(sub).not.toBeNull();
      expect(sub!.tier).toBe('trial');
      expect(sub!.productId).toBe(id);
    }
  });
});
