/**
 * Manager Pass durability — the IndexedDB mirror of the device record and the
 * carry-over of last season's Pro rewards.
 *
 * WKWebView can evict localStorage (and its ~5MB quota is shared with the save
 * mirror), and the Pass record is the only copy of collected Pass cosmetics.
 * A subscriber whose renewal had not synced when a Pass season closed read as
 * not-Pro at that instant and lost every Pro reward they had reached.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  freshPassRecord,
  getManagerPassSeason,
  passSeasonFromOrdinal,
  parsePassRecord,
  rollPassSeason,
  carriedProRewards,
  applyClaimAll,
  applyPassClaim,
  passClaimableCount,
  mergePassRecords,
  savePassRecord,
  loadPassRecord,
  hydratePassStorage,
  isEarnedCosmeticOwned,
  __resetPassStorageForTests,
} from '@/utils/managerPass';
import { MANAGER_PASS_TRACK, MANAGER_PASS_XP_PER_TIER } from '@/config/managerPass';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { STORAGE_KEYS } from '@/store/helpers/persistence';
import { useGameStore } from '@/store/gameStore';
import type { ManagerPassRecord, MonetizationState } from '@/types/game';

const idb = vi.hoisted(() => ({ store: new Map<string, string>(), answer: true }));

vi.mock('@/store/helpers/idbStorage', () => ({
  idbGet: vi.fn(async (k: string) => idb.store.get(k) ?? null),
  idbRead: vi.fn(async (k: string) => (idb.answer ? { ok: true, value: idb.store.get(k) ?? null } : { ok: false })),
  idbPut: vi.fn(async (k: string, v: string) => { idb.store.set(k, v); return true; }),
  idbDel: vi.fn(async (k: string) => { idb.store.delete(k); }),
  idbKeys: vi.fn(async () => [...idb.store.keys()]),
  requestPersistentStorage: vi.fn(async () => true),
}));

const KEY = STORAGE_KEYS.MANAGER_PASS;
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const SEP = getManagerPassSeason(at(2026, 9, 25));
const NOV = getManagerPassSeason(at(2026, 11, 2));
const JAN = getManagerPassSeason(at(2027, 1, 5));
const tiers = (n: number) => n * MANAGER_PASS_XP_PER_TIER;
const proIds = (n: number) => MANAGER_PASS_TRACK.slice(0, n).map(t => t.pro);
const flush = () => new Promise(r => setTimeout(r, 0));

const NOT_PRO: MonetizationState = {
  entitlements: [], activeCosmetics: {}, adRewardsClaimed: {}, firstLaunchTimestamp: 0,
  starterKitDismissed: false, subscription: null,
  adEngagement: { dayKey: '', watchedToday: 0, promptsToday: 0, consecutiveDismissals: 0, lastPromptAt: 0, totalWatched: 0 },
};
const LIFETIME_PRO: MonetizationState = { ...NOT_PRO, entitlements: ['com.dynastymanager.pro.lifetime'] };

beforeEach(() => {
  localStorage.clear();
  idb.store.clear();
  idb.answer = true;
  __resetPassStorageForTests();
});

describe('Manager Pass — IndexedDB mirror', () => {
  it('writes every save through to IndexedDB and stamps a write counter', async () => {
    const first = savePassRecord({ ...freshPassRecord(SEP), xp: 120 });
    const second = savePassRecord({ ...first, xp: 150 });
    await flush();
    expect(first.rev).toBe(1);
    expect(second.rev).toBe(2);
    expect(parsePassRecord(idb.store.get(KEY) ?? null)).toMatchObject({ xp: 150, rev: 2 });
    expect(parsePassRecord(localStorage.getItem(KEY))).toMatchObject({ xp: 150, rev: 2 });
  });

  it('restores the record when localStorage was evicted — collected cosmetics survive', async () => {
    const item = COSMETIC_ITEMS.find(c => c.id === 'badge-the-grafter')!;
    savePassRecord({ ...freshPassRecord(SEP), xp: 700, ownedRewardIds: [item.id] });
    await flush();
    // WKWebView drops localStorage; next launch starts with no memory.
    localStorage.removeItem(KEY);
    __resetPassStorageForTests();
    expect(isEarnedCosmeticOwned(item)).toBe(false);

    await expect(hydratePassStorage()).resolves.toBe(true);
    expect(isEarnedCosmeticOwned(item)).toBe(true);
    expect(loadPassRecord(SEP).xp).toBe(700);
    expect(parsePassRecord(localStorage.getItem(KEY))!.ownedRewardIds).toEqual([item.id]);
  });

  it('prefers the newer copy and never loses a reward only the older copy holds', async () => {
    // IndexedDB took writes localStorage refused (quota): it is newer.
    idb.store.set(KEY, JSON.stringify({ ...freshPassRecord(SEP), xp: 900, rev: 9, ownedRewardIds: ['badge-the-tinkerman'] }));
    localStorage.setItem(KEY, JSON.stringify({ ...freshPassRecord(SEP), xp: 300, rev: 4, ownedRewardIds: ['badge-the-grafter'] }));

    await expect(hydratePassStorage()).resolves.toBe(true);
    const r = loadPassRecord(SEP);
    expect(r.xp).toBe(900);
    expect(r.ownedRewardIds).toEqual(['badge-the-tinkerman', 'badge-the-grafter']);
    await flush();
    expect(parsePassRecord(idb.store.get(KEY) ?? null)!.ownedRewardIds).toEqual(['badge-the-tinkerman', 'badge-the-grafter']);
  });

  it('copies an existing localStorage record into an empty IndexedDB (installs that predate the mirror)', async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...freshPassRecord(SEP), xp: 450 }));
    await expect(hydratePassStorage()).resolves.toBe(false);
    await flush();
    expect(parsePassRecord(idb.store.get(KEY) ?? null)!.xp).toBe(450);
  });

  it('changes nothing when IndexedDB does not answer', async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...freshPassRecord(SEP), xp: 450 }));
    idb.answer = false;
    await expect(hydratePassStorage()).resolves.toBe(false);
    await flush();
    expect(idb.store.has(KEY)).toBe(false);
    expect(loadPassRecord(SEP).xp).toBe(450);
  });

  it('merge: a tie keeps the localStorage copy; ownership is a union', () => {
    const local = { ...freshPassRecord(SEP), xp: 100, rev: 3 };
    const mirror = { ...freshPassRecord(SEP), xp: 50, rev: 3 };
    expect(mergePassRecords(local, mirror)).toBe(local);
    expect(mergePassRecords(null, mirror)).toBe(mirror);
    expect(mergePassRecords(local, null)).toBe(local);
    const withReward = { ...mirror, ownedRewardIds: ['banner-touchline'] };
    expect(mergePassRecords(local, withReward)).toMatchObject({ xp: 100, ownedRewardIds: ['banner-touchline'] });
  });

  it('a restore republishes the store render cache', async () => {
    const season = getManagerPassSeason(new Date());
    idb.store.set(KEY, JSON.stringify({ ...freshPassRecord(season), xp: 640, rev: 5 }));
    // The slice started its own reconcile when the store was created; a new
    // session is a fresh reconcile, and the page's refresh reads the result.
    await hydratePassStorage();
    expect(useGameStore.getState().refreshManagerPass().xp).toBe(640);
  });
});

describe('Manager Pass — last season\'s Pro rewards (carry-over)', () => {
  it('a season closing while not-Pro keeps the reached, uncollected Pro rewards', () => {
    // Tier 4 reached; Pro tier 1 already collected in September.
    const sep = applyPassClaim({ ...freshPassRecord(SEP), xp: tiers(4) }, 1, 'pro', true);
    const nov = rollPassSeason(sep, NOV, false);
    expect(nov.proCarry).toEqual({ seasonId: SEP.id, seasonOrdinal: SEP.ordinal, rewardIds: proIds(4).slice(1) });
    // Nothing collectable while the device still reads not-Pro…
    expect(carriedProRewards(nov, false)).toEqual([]);
    expect(passClaimableCount(nov, false)).toBe(0);
    // …and all three once Pro is confirmed.
    expect(carriedProRewards(nov, true)).toEqual(proIds(4).slice(1));
    expect(passClaimableCount(nov, true)).toBe(3);
    const collected = applyClaimAll(nov, true);
    expect(collected.ownedRewardIds).toEqual(expect.arrayContaining(proIds(4)));
    expect(collected.proCarry).toBeNull();
    expect(passClaimableCount(collected, true)).toBe(0);
  });

  it('carries nothing when the player is Pro at the rollover (they are collected then)', () => {
    const nov = rollPassSeason({ ...freshPassRecord(SEP), xp: tiers(2) }, NOV, true);
    expect(nov.proCarry).toBeNull();
    expect(nov.ownedRewardIds).toEqual(proIds(2));
  });

  it('is bounded to the previous season', () => {
    const sep = { ...freshPassRecord(SEP), xp: tiers(2) };
    // A skipped season carries nothing.
    expect(rollPassSeason(sep, JAN, false).proCarry).toBeNull();
    // A carry is dropped at the next rollover, even if that season earned none.
    const nov = rollPassSeason(sep, NOV, false);
    const jan = rollPassSeason(nov, JAN, false);
    expect(jan.proCarry).toBeNull();
    expect(carriedProRewards(jan, true)).toEqual([]);
    // A stale carry on a record (clock jumped, record copied) is not collectable.
    const stale = { ...freshPassRecord(JAN), proCarry: nov.proCarry };
    expect(carriedProRewards(stale, true)).toEqual([]);
  });

  it('collects a pending carry at the next rollover when Pro by then', () => {
    const nov = rollPassSeason({ ...freshPassRecord(SEP), xp: tiers(2) }, NOV, false);
    const jan = rollPassSeason(nov, JAN, true);
    expect(jan.ownedRewardIds).toEqual(proIds(2));
  });

  it('survives storage and rejects ids that are not on the Pro track', () => {
    const nov = rollPassSeason({ ...freshPassRecord(SEP), xp: tiers(2) }, NOV, false);
    expect(parsePassRecord(JSON.stringify(nov))!.proCarry).toEqual(nov.proCarry);
    const tampered = { ...nov, proCarry: { ...nov.proCarry!, rewardIds: ['banner-touchline', 'bundle.all'] } };
    expect(parsePassRecord(JSON.stringify(tampered))!.proCarry).toBeNull();
  });

  it('store: a renewal that syncs after the rollover still collects last season\'s Pro rewards', () => {
    const season = getManagerPassSeason(new Date());
    const previous = passSeasonFromOrdinal(season.ordinal - 1);
    savePassRecord({ ...freshPassRecord(previous), xp: tiers(3) } as ManagerPassRecord);
    // The saved expiry is stale: the device reads not-Pro when the season rolls.
    useGameStore.setState({ monetization: NOT_PRO });
    const rolled = useGameStore.getState().refreshManagerPass();
    expect(rolled.seasonId).toBe(season.id);
    expect(rolled.proCarry?.rewardIds).toEqual(proIds(3));
    expect(useGameStore.getState().claimAllManagerPassRewards()).toEqual([]);

    // RevenueCat confirms the renewal.
    useGameStore.setState({ monetization: LIFETIME_PRO });
    const collected = useGameStore.getState().claimAllManagerPassRewards();
    expect(collected.map(c => c.id)).toEqual(proIds(3));
    expect(proIds(3).every(id => isEarnedCosmeticOwned({ id, earnedBy: 'manager_pass' }))).toBe(true);
  });
});
