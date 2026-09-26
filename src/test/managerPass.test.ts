/**
 * Manager Pass — seasons, XP accrual, tier unlocks, Pro-track gating, reward
 * application, season rollover, the stored-record parser and the game-state
 * observer. Pure functions take an injected `now`; the store tests go through
 * the real slice and the real localStorage record.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getManagerPassSeason,
  getPassSeasonDaysRemaining,
  freshPassRecord,
  parsePassRecord,
  passTierForXp,
  passTierProgress,
  canCheckInPass,
  applyPassCheckIn,
  applyPassEvent,
  applyPassEvents,
  matchPassXp,
  seasonPassXp,
  passClaimStatus,
  applyPassClaim,
  claimablePassRewards,
  applyClaimAll,
  rollPassSeason,
  isEarnedCosmeticOwned,
  savePassRecord,
  loadPassRecord,
  MAX_PASS_XP,
} from '@/utils/managerPass';
import {
  diffPassEvents,
  observePassState,
  attachManagerPassObserver,
  seasonTrophyCount,
  type PassObservedState,
} from '@/utils/managerPassObserver';
import {
  MANAGER_PASS_TRACK,
  MANAGER_PASS_TIER_COUNT,
  MANAGER_PASS_XP,
  MANAGER_PASS_XP_PER_TIER,
  MANAGER_PASS_MATCH_XP_DAILY_CAP,
  MANAGER_PASS_LEDGER_MAX,
  MANAGER_PASS_COSMETICS,
} from '@/config/managerPass';
import { PROFILE_BANNER_STYLES } from '@/config/profileBanners';
import { COSMETIC_ITEMS, PRODUCTS } from '@/config/monetization';
import { hasCosmetic, getActiveCosmetic } from '@/utils/monetization';
import { STORAGE_KEYS } from '@/store/helpers/persistence';
import { useGameStore } from '@/store/gameStore';
import type { ManagerPassEvent, ManagerPassRecord, SeasonHistory, MonetizationState } from '@/types/game';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const SEP = getManagerPassSeason(at(2026, 9, 25));
const fresh = () => freshPassRecord(SEP);
const withXp = (xp: number): ManagerPassRecord => ({ ...fresh(), xp });
const match = (key: string, outcome: 'win' | 'draw' | 'loss' = 'win'): ManagerPassEvent => ({ source: 'match', key, outcome });

const NOT_PRO: MonetizationState = {
  entitlements: [], activeCosmetics: {}, adRewardsClaimed: {}, firstLaunchTimestamp: 0,
  starterKitDismissed: false, subscription: null,
  adEngagement: { dayKey: '', watchedToday: 0, promptsToday: 0, consecutiveDismissals: 0, lastPromptAt: 0, totalWatched: 0 },
};
const LIFETIME_PRO: MonetizationState = { ...NOT_PRO, entitlements: ['com.dynastymanager.pro.lifetime'] };

beforeEach(() => {
  localStorage.clear();
});

describe('Manager Pass — seasons', () => {
  it('is two calendar months, derived from the date alone', () => {
    expect(SEP).toMatchObject({ id: 'pass-2026-5', start: '2026-09-01', end: '2026-10-31', themeIndex: 4 });
    expect(getManagerPassSeason(at(2026, 10, 31)).id).toBe('pass-2026-5');
    expect(getManagerPassSeason(at(2026, 11, 1))).toMatchObject({ id: 'pass-2026-6', start: '2026-11-01', end: '2026-12-31' });
    expect(getManagerPassSeason(at(2027, 1, 1))).toMatchObject({ id: 'pass-2027-1', start: '2027-01-01', end: '2027-02-28' });
    expect(getManagerPassSeason(at(2028, 2, 10)).end).toBe('2028-02-29'); // leap year
  });

  it('orders seasons across a year boundary', () => {
    const dec = getManagerPassSeason(at(2026, 12, 31));
    const jan = getManagerPassSeason(at(2027, 1, 1));
    expect(jan.ordinal).toBe(dec.ordinal + 1);
  });

  it('counts days remaining inclusive of the last day', () => {
    expect(getPassSeasonDaysRemaining(SEP, at(2026, 10, 31))).toBe(0);
    expect(getPassSeasonDaysRemaining(SEP, at(2026, 10, 30))).toBe(1);
    expect(getPassSeasonDaysRemaining(SEP, at(2026, 9, 1))).toBe(60);
  });
});

describe('Manager Pass — XP accrual', () => {
  it('pays the daily check-in once per local day', () => {
    const r1 = applyPassCheckIn(fresh(), at(2026, 9, 25, 9));
    expect(r1.xp).toBe(MANAGER_PASS_XP.dailyCheckIn);
    expect(canCheckInPass(r1, at(2026, 9, 25, 23))).toBe(false);
    expect(applyPassCheckIn(r1, at(2026, 9, 25, 23))).toBe(r1);
    expect(applyPassCheckIn(r1, at(2026, 9, 26, 0)).xp).toBe(2 * MANAGER_PASS_XP.dailyCheckIn);
  });

  it('pays a match by outcome, and a win more than a draw more than a loss', () => {
    expect(matchPassXp('win')).toBeGreaterThan(matchPassXp('draw'));
    expect(matchPassXp('draw')).toBeGreaterThan(matchPassXp('loss'));
    expect(matchPassXp('loss')).toBe(MANAGER_PASS_XP.matchPlayed);
    const r = applyPassEvent(fresh(), match('m:c1:1', 'win'), at(2026, 9, 25));
    expect(r.xp).toBe(matchPassXp('win'));
  });

  it('never pays the same event key twice (a replayed match after a reload)', () => {
    const once = applyPassEvent(fresh(), match('m:c1:57'), at(2026, 9, 25));
    const twice = applyPassEvent(once, match('m:c1:57', 'win'), at(2026, 9, 26));
    expect(twice).toBe(once);
  });

  it('caps match XP per local day and resets the cap the next day', () => {
    const day = at(2026, 9, 25);
    let r = fresh();
    for (let i = 1; i <= MANAGER_PASS_MATCH_XP_DAILY_CAP + 3; i++) r = applyPassEvent(r, match(`m:c:${i}`, 'loss'), day);
    expect(r.xp).toBe(MANAGER_PASS_MATCH_XP_DAILY_CAP * matchPassXp('loss'));
    // Matches past the cap are spent — replaying one later pays nothing.
    expect(applyPassEvent(r, match(`m:c:${MANAGER_PASS_MATCH_XP_DAILY_CAP + 1}`), at(2026, 9, 26))).toBe(r);
    const nextDay = applyPassEvent(r, match('m:c:999', 'loss'), at(2026, 9, 26));
    expect(nextDay.xp).toBe(r.xp + matchPassXp('loss'));
  });

  it('pays objectives and completed seasons, with a bonus per trophy', () => {
    const r = applyPassEvents(fresh(), [
      { source: 'objective', key: 'o:c:1' },
      { source: 'season', key: 's:c:1', trophies: 2 },
    ], at(2026, 9, 25));
    expect(r.xp).toBe(MANAGER_PASS_XP.objectiveCompleted + seasonPassXp(2));
    expect(seasonPassXp(2)).toBe(MANAGER_PASS_XP.seasonCompleted + 2 * MANAGER_PASS_XP.trophyWon);
  });

  it('stops at the top of the track and stamps the season completed once', () => {
    const r = applyPassEvent(withXp(MAX_PASS_XP - 10), { source: 'season', key: 's:c:9', trophies: 5 }, at(2026, 9, 25));
    expect(r.xp).toBe(MAX_PASS_XP);
    expect(r.completedSeasonIds).toEqual([SEP.id]);
    const again = applyPassEvent(r, { source: 'objective', key: 'o:c:99' }, at(2026, 9, 25));
    expect(again.completedSeasonIds).toEqual([SEP.id]);
  });

  it('bounds the dedupe ledger', () => {
    let r = fresh();
    for (let i = 0; i < MANAGER_PASS_LEDGER_MAX + 25; i++) r = applyPassEvent(r, { source: 'objective', key: `o:c:${i}` }, at(2026, 9, 25));
    expect(r.awardedKeys).toHaveLength(MANAGER_PASS_LEDGER_MAX);
    expect(r.awardedKeys[r.awardedKeys.length - 1]).toBe(`o:c:${MANAGER_PASS_LEDGER_MAX + 24}`);
  });
});

describe('Manager Pass — tiers and claims', () => {
  it('maps XP to tiers and progress', () => {
    expect(passTierForXp(0)).toBe(0);
    expect(passTierForXp(MANAGER_PASS_XP_PER_TIER - 1)).toBe(0);
    expect(passTierForXp(MANAGER_PASS_XP_PER_TIER)).toBe(1);
    expect(passTierForXp(10 ** 9)).toBe(MANAGER_PASS_TIER_COUNT);
    expect(passTierProgress(250)).toEqual({ tier: 2, next: 3, into: 50, needed: MANAGER_PASS_XP_PER_TIER });
    expect(passTierProgress(MAX_PASS_XP).next).toBeNull();
  });

  it('locks a reward until its tier is reached', () => {
    expect(passClaimStatus(withXp(0), 3, 'free', false)).toBe('locked');
    expect(passClaimStatus(withXp(300), 3, 'free', false)).toBe('claimable');
    expect(passClaimStatus(withXp(300), 2, 'free', false)).toBe('none'); // no free reward on tier 2
  });

  it('gates the Pro row on isPro — reached but not Pro is pro_locked and cannot be claimed', () => {
    const r = withXp(300);
    expect(passClaimStatus(r, 1, 'pro', false)).toBe('pro_locked');
    expect(applyPassClaim(r, 1, 'pro', false)).toBe(r);
    expect(passClaimStatus(r, 1, 'pro', true)).toBe('claimable');
    const claimed = applyPassClaim(r, 1, 'pro', true);
    expect(claimed.claimedPro).toEqual([1]);
    expect(claimed.ownedRewardIds).toEqual([MANAGER_PASS_TRACK[0].pro]);
    expect(passClaimStatus(claimed, 1, 'pro', true)).toBe('claimed');
  });

  it('lists and claims everything claimable, Pro rows only for Pro', () => {
    const r = withXp(600); // tiers 1..6
    expect(claimablePassRewards(r, false)).toEqual([{ tier: 3, track: 'free' }, { tier: 6, track: 'free' }]);
    expect(claimablePassRewards(r, true)).toHaveLength(2 + 6);
    expect(applyClaimAll(r, true).ownedRewardIds).toHaveLength(8);
  });
});

describe('Manager Pass — season rollover', () => {
  const NOV = getManagerPassSeason(at(2026, 11, 2));

  it('collects reached rewards for the player, resets progress, keeps the collection', () => {
    const old = { ...applyPassClaim(withXp(700), 3, 'free', false), awardedKeys: ['m:c:1'] };
    const rolled = rollPassSeason(old, NOV, false);
    expect(rolled.seasonId).toBe(NOV.id);
    expect(rolled.xp).toBe(0);
    expect(rolled.claimedFree).toEqual([]);
    expect(rolled.awardedKeys).toEqual(['m:c:1']);
    // tier 3 was claimed, tier 6 reached-but-unclaimed → auto-collected; Pro not (not Pro).
    expect(rolled.ownedRewardIds).toEqual([MANAGER_PASS_TRACK[2].free, MANAGER_PASS_TRACK[5].free]);
  });

  it('collects reached Pro rewards too when the player is Pro at rollover', () => {
    const rolled = rollPassSeason(withXp(100), NOV, true);
    expect(rolled.ownedRewardIds).toEqual([MANAGER_PASS_TRACK[0].pro]);
  });

  it('never resets progress toward the past (clock wound back)', () => {
    const novRecord = { ...freshPassRecord(NOV), xp: 500 };
    expect(rollPassSeason(novRecord, SEP, true)).toBe(novRecord);
    expect(rollPassSeason(novRecord, NOV, true)).toBe(novRecord);
  });
});

describe('Manager Pass — stored record ("migration" of the device record)', () => {
  it('rejects nothing-usable input', () => {
    expect(parsePassRecord(null)).toBeNull();
    expect(parsePassRecord('not json')).toBeNull();
    expect(parsePassRecord('[]')).toBeNull();
    expect(parsePassRecord('{"xp":5}')).toBeNull(); // no season
  });

  it('keeps earned cosmetics from a damaged or older record and defaults the rest', () => {
    const r = parsePassRecord(JSON.stringify({
      seasonId: 'pass-2026-5', seasonOrdinal: SEP.ordinal, xp: 'lots',
      ownedRewardIds: ['badge-the-grafter', 7], claimedFree: [3, 99, 'x'],
    }))!;
    expect(r).toMatchObject({ v: 1, xp: 0, ownedRewardIds: ['badge-the-grafter'], claimedFree: [3], claimedPro: [], awardedKeys: [] });
  });

  it('reads a record written by a newer build and clamps impossible values', () => {
    const r = parsePassRecord(JSON.stringify({ ...fresh(), v: 7, xp: 10 ** 9, somethingNew: true }))!;
    expect(r.v).toBe(1);
    expect(r.xp).toBe(MAX_PASS_XP);
    expect('somethingNew' in r).toBe(false);
  });

  it('round-trips through storage and backs the earned-cosmetic ownership check', () => {
    const item = COSMETIC_ITEMS.find(c => c.id === 'badge-the-grafter')!;
    expect(isEarnedCosmeticOwned(item)).toBe(false);
    savePassRecord({ ...fresh(), ownedRewardIds: [item.id] });
    expect(loadPassRecord(SEP).ownedRewardIds).toEqual([item.id]);
    expect(isEarnedCosmeticOwned(item)).toBe(true);
    // Ownership is read from storage, not memory: wiping the record revokes it.
    localStorage.removeItem(STORAGE_KEYS.MANAGER_PASS);
    expect(isEarnedCosmeticOwned(item)).toBe(false);
  });
});

describe('Manager Pass — catalog invariants', () => {
  const byId = new Map(COSMETIC_ITEMS.map(c => [c.id, c]));

  it('has 30 tiers, a Pro reward on each and a free reward on every third', () => {
    expect(MANAGER_PASS_TRACK.map(t => t.tier)).toEqual(Array.from({ length: MANAGER_PASS_TIER_COUNT }, (_, i) => i + 1));
    for (const t of MANAGER_PASS_TRACK) {
      expect(t.pro).toBeTruthy();
      expect(!!t.free).toBe(t.tier % 3 === 0);
    }
  });

  it('pays only earned catalog cosmetics, each exactly once across both rows', () => {
    const ids = MANAGER_PASS_TRACK.flatMap(t => [t.free, t.pro]).filter(Boolean) as string[];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const item = byId.get(id);
      expect(item, id).toBeDefined();
      expect(item!.earnedBy).toBe('manager_pass');
      expect(item!.pack).toBeUndefined();
    }
    expect(new Set(ids)).toEqual(new Set(MANAGER_PASS_COSMETICS.map(c => c.id)));
  });

  it('keeps catalog ids unique and every banner drawable', () => {
    expect(new Set(COSMETIC_ITEMS.map(c => c.id)).size).toBe(COSMETIC_ITEMS.length);
    for (const c of MANAGER_PASS_COSMETICS.filter(c => c.category === 'profile_banner')) {
      expect(PROFILE_BANNER_STYLES[c.id], c.id).toBeTruthy();
    }
  });

  it('title ids derive the displayed title (ManagerProfile renders the id)', () => {
    const derive = (id: string) => id.replace('badge-', '').replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    for (const c of MANAGER_PASS_COSMETICS.filter(c => c.category === 'title_badge')) {
      expect(derive(c.id)).toBe(c.name);
    }
  });

  it('is sold by no product', () => {
    for (const c of MANAGER_PASS_COSMETICS) {
      for (const p of Object.values(PRODUCTS)) expect(p.id).not.toBe(c.pack);
    }
  });
});

describe('Manager Pass — earned cosmetics through the monetization helpers', () => {
  it('hasCosmetic/getActiveCosmetic resolve an earned item by play, not by entitlements', () => {
    const id = 'celeb-text-pass-get-in';
    const state = { ...NOT_PRO, activeCosmetics: { celebration_text: id } };
    expect(hasCosmetic(state, id)).toBe(false);
    expect(getActiveCosmetic(state, 'celebration_text')).toBeUndefined();
    savePassRecord({ ...fresh(), ownedRewardIds: [id] });
    expect(hasCosmetic(state, id)).toBe(true);
    expect(getActiveCosmetic(state, 'celebration_text')).toBe(id);
    // Pro status is irrelevant to ownership once collected.
    expect(hasCosmetic(LIFETIME_PRO, id)).toBe(true);
  });

  it('purchased cosmetics still need their pack', () => {
    expect(hasCosmetic(NOT_PRO, 'avatar-classic')).toBe(false);
    expect(hasCosmetic({ ...NOT_PRO, entitlements: ['com.dynastymanager.pack.manager'] }, 'avatar-classic')).toBe(true);
  });
});

// ── Observer ──

const observed = (o: Partial<PassObservedState> = {}): PassObservedState => ({
  gameStarted: true, careerKey: 'career-a', wins: 10, draws: 5, losses: 5,
  objectivesCompleted: 3, seasonsPlayed: 1, lastSeason: null, ...o,
});
const history = (o: Partial<SeasonHistory> = {}): SeasonHistory => ({
  season: 2, position: 1, points: 90, won: 28, drawn: 6, lost: 4, goalsFor: 80, goalsAgainst: 30,
  topScorer: { name: 'X', goals: 20 }, boardVerdict: 'excellent', cupResult: 'Winner', leagueCupResult: 'Final', ...o,
});

describe('Manager Pass — observer diff', () => {
  it('turns one more match into a keyed match event with its outcome', () => {
    expect(diffPassEvents(observed(), observed({ wins: 11 }))).toEqual([{ source: 'match', key: 'm:career-a:21', outcome: 'win' }]);
    expect(diffPassEvents(observed(), observed({ draws: 6 }))[0]).toMatchObject({ outcome: 'draw' });
    expect(diffPassEvents(observed(), observed({ losses: 6 }))[0]).toMatchObject({ outcome: 'loss' });
  });

  it('keys objectives and seasons by the career counter', () => {
    expect(diffPassEvents(observed(), observed({ objectivesCompleted: 5 }))).toEqual([
      { source: 'objective', key: 'o:career-a:4' },
      { source: 'objective', key: 'o:career-a:5' },
    ]);
    expect(diffPassEvents(observed(), observed({ seasonsPlayed: 2, lastSeason: history() }))).toEqual([
      { source: 'season', key: 's:career-a:2', trophies: 2 },
    ]);
    expect(seasonTrophyCount(history({ position: 4, cupResult: 'Semi-Final', championsCupResult: 'Winner' }))).toBe(1);
  });

  it('pays nothing for a load, a new career, a jump or a game not running', () => {
    const before = observed();
    expect(diffPassEvents(before, observed({ careerKey: 'career-b', wins: 11 }))).toEqual([]);
    expect(diffPassEvents(before, observed({ wins: 40 }))).toEqual([]);
    expect(diffPassEvents(before, observed({ wins: 9 }))).toEqual([]);
    expect(diffPassEvents(before, observed({ objectivesCompleted: 30 }))).toEqual([]);
    expect(diffPassEvents(before, observed({ seasonsPlayed: 4, lastSeason: history() }))).toEqual([]);
    expect(diffPassEvents(observed({ gameStarted: false }), observed({ wins: 11 }))).toEqual([]);
  });

  it('derives the career key from careerId, falling back to the slot', () => {
    const base = { gameStarted: true, activeSlot: 2, managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0 }, seasonHistory: [] };
    expect(observePassState({ ...base, careerId: 'abc' }).careerKey).toBe('abc');
    expect(observePassState({ ...base, careerId: null }).careerKey).toBe('slot-2');
  });

  it('attaches to a store, baselines at attach and hands over each step once', () => {
    type S = Parameters<typeof observePassState>[0];
    let state: S = { gameStarted: true, careerId: 'c', activeSlot: 1, managerStats: { totalWins: 3, totalDraws: 0, totalLosses: 0 }, seasonHistory: [] };
    const listeners = new Set<(s: S) => void>();
    const store = {
      getState: () => state,
      subscribe: (l: (s: S) => void) => { listeners.add(l); return () => listeners.delete(l); },
    };
    const got: ManagerPassEvent[][] = [];
    const detach = attachManagerPassObserver(store, e => got.push(e));
    const setState = (next: S) => { state = next; listeners.forEach(l => l(state)); };
    setState({ ...state, managerStats: { totalWins: 4, totalDraws: 0, totalLosses: 0 } });
    setState({ ...state }); // unrelated change
    detach();
    setState({ ...state, managerStats: { totalWins: 5, totalDraws: 0, totalLosses: 0 } });
    expect(got).toEqual([[{ source: 'match', key: 'm:c:4', outcome: 'win' }]]);
  });
});

// ── Store ──

describe('Manager Pass — store slice', () => {
  const setMonetization = (m: MonetizationState) => useGameStore.setState({ monetization: m });

  beforeEach(() => {
    setMonetization(NOT_PRO);
  });

  it('checks in once a day and persists to the device record', () => {
    const s = useGameStore.getState();
    expect(s.checkInManagerPass()).toBe(MANAGER_PASS_XP.dailyCheckIn);
    expect(useGameStore.getState().checkInManagerPass()).toBeNull();
    expect(useGameStore.getState().managerPass.xp).toBe(MANAGER_PASS_XP.dailyCheckIn);
    expect(parsePassRecord(localStorage.getItem(STORAGE_KEYS.MANAGER_PASS))!.xp).toBe(MANAGER_PASS_XP.dailyCheckIn);
  });

  it('the existing daily login claim is also the day\'s Pass check-in', () => {
    expect(useGameStore.getState().claimDailyStreakReward()).not.toBeNull();
    expect(useGameStore.getState().managerPass.xp).toBe(MANAGER_PASS_XP.dailyCheckIn);
    // One check-in a day: the Pass page's own button is then spent.
    expect(useGameStore.getState().checkInManagerPass()).toBeNull();
    expect(useGameStore.getState().managerPass.xp).toBe(MANAGER_PASS_XP.dailyCheckIn);
  });

  it('records observed events, idempotently', () => {
    const events: ManagerPassEvent[] = [match('m:c:1'), { source: 'objective', key: 'o:c:1' }];
    const gained = useGameStore.getState().recordManagerPassEvents(events);
    expect(gained).toBe(matchPassXp('win') + MANAGER_PASS_XP.objectiveCompleted);
    expect(useGameStore.getState().recordManagerPassEvents(events)).toBe(0);
  });

  it('gates the Pro row on isPro and keeps collected Pro rewards after Pro lapses', () => {
    const season = getManagerPassSeason(new Date());
    savePassRecord({ ...freshPassRecord(season), xp: 100 });
    expect(useGameStore.getState().claimManagerPassReward(1, 'pro')).toBeNull();

    setMonetization(LIFETIME_PRO);
    const item = useGameStore.getState().claimManagerPassReward(1, 'pro');
    expect(item?.id).toBe(MANAGER_PASS_TRACK[0].pro);

    setMonetization(NOT_PRO);
    expect(hasCosmetic(NOT_PRO, item!.id)).toBe(true);
  });

  it('keeps progress for the session when storage refuses the write (quota)', () => {
    // WKWebView caps localStorage at ~5MB and the save mirror shares it. A
    // refused write used to be forgotten on the very next read (the memo was
    // keyed on the stored string), so a collected reward vanished at once.
    const season = getManagerPassSeason(new Date());
    savePassRecord({ ...freshPassRecord(season), xp: 300 });
    const realSetItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === STORAGE_KEYS.MANAGER_PASS) throw new DOMException('full', 'QuotaExceededError');
      return realSetItem.call(this, key, value);
    });
    try {
      const item = useGameStore.getState().claimManagerPassReward(3, 'free');
      expect(item?.id).toBe(MANAGER_PASS_TRACK[2].free);
      expect(isEarnedCosmeticOwned(item!)).toBe(true);
      expect(useGameStore.getState().equipEarnedCosmetic(item!.id)).toBe(true);
      useGameStore.getState().recordManagerPassEvents([match('m:quota:1')]);
      const r = useGameStore.getState().managerPass;
      expect(r.claimedFree).toEqual([3]);
      expect(r.xp).toBe(300 + matchPassXp('win'));
    } finally {
      spy.mockRestore();
      // Storage accepts again: this write also clears the in-memory override.
      savePassRecord(freshPassRecord(season));
    }
  });

  it('equips an earned cosmetic only once it is owned, and it then renders', () => {
    const season = getManagerPassSeason(new Date());
    savePassRecord({ ...freshPassRecord(season), xp: 600 });
    expect(useGameStore.getState().equipEarnedCosmetic('badge-the-grafter')).toBe(false);
    // A purchased item cannot be equipped through the earned path.
    expect(useGameStore.getState().equipEarnedCosmetic('badge-gaffer')).toBe(false);

    const collected = useGameStore.getState().claimAllManagerPassRewards();
    expect(collected.map(c => c.id)).toEqual([MANAGER_PASS_TRACK[2].free, MANAGER_PASS_TRACK[5].free]);
    expect(useGameStore.getState().equipEarnedCosmetic('badge-the-grafter')).toBe(true);
    const m = useGameStore.getState().monetization;
    expect(getActiveCosmetic(m, 'title_badge')).toBe('badge-the-grafter');
  });

  it('earns Pass XP from play through the observer GameShell mounts', () => {
    const base = useGameStore.getState();
    useGameStore.setState({
      gameStarted: true, careerId: 'career-int',
      managerStats: { ...base.managerStats, totalWins: 5, totalDraws: 2, totalLosses: 3 },
      sessionStats: { ...base.sessionStats, objectivesCompleted: 4 },
    });
    const detach = attachManagerPassObserver(useGameStore, events => {
      useGameStore.getState().recordManagerPassEvents(events);
    });
    try {
      const s = () => useGameStore.getState();
      useGameStore.setState({ managerStats: { ...s().managerStats, totalWins: 6 } });
      useGameStore.setState({ sessionStats: { ...s().sessionStats, objectivesCompleted: 5 } });
      expect(s().managerPass.xp).toBe(matchPassXp('win') + MANAGER_PASS_XP.objectiveCompleted);
      expect(s().managerPass.awardedKeys).toEqual(['m:career-int:11', 'o:career-int:5']);

      // Loading another career is a re-baseline, not a win.
      useGameStore.setState({ careerId: 'career-other', managerStats: { ...s().managerStats, totalWins: 7 } });
      expect(s().managerPass.xp).toBe(matchPassXp('win') + MANAGER_PASS_XP.objectiveCompleted);
    } finally {
      detach();
      useGameStore.setState({ gameStarted: false, careerId: null });
    }
  });

  it('never touches the simulation or manager XP', () => {
    const before = useGameStore.getState();
    const snapshot = JSON.stringify({ p: before.managerProgression, c: before.clubs, pl: before.players, b: before.boardConfidence });
    before.checkInManagerPass();
    useGameStore.getState().recordManagerPassEvents([match('m:x:1'), { source: 'season', key: 's:x:1', trophies: 3 }]);
    setMonetization(LIFETIME_PRO);
    useGameStore.getState().claimAllManagerPassRewards();
    const after = useGameStore.getState();
    expect(JSON.stringify({ p: after.managerProgression, c: after.clubs, pl: after.players, b: after.boardConfidence })).toBe(snapshot);
  });
});
