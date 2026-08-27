import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  writeDailyPackOpens,
  currentDayIndex,
  currentWeekIndex,
  msUntilNextWeekIndex,
  readWeeklyPackBonus,
  writeWeeklyPackBonus,
  writeDailyStreak,
  STORAGE_KEYS,
} from '@/store/helpers/persistence';
import { getFeaturedPackTier, WEEKLY_BONUS_CARDS, PACK_TIER_MAP, resolvePackTier } from '@/config/packs';
import { weeklyBonusCardsFor, currentLoginStreak } from '@/store/slices/packsSlice';
import { localDateKey } from '@/utils/dailyStreak';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';

const CLUB_ID = 'celtic';

function resetDeviceState() {
  writeDailyPackOpens({ dayIndex: currentDayIndex(), free: {}, ad: {} });
  try { localStorage.removeItem(STORAGE_KEYS.WEEKLY_PACK_BONUS); } catch { /* jsdom */ }
  try { localStorage.removeItem(STORAGE_KEYS.DAILY_STREAK); } catch { /* jsdom */ }
}

/** Trim the squad so a multi-card pack always has room. Several of these tests
 *  open packs back to back and MAX_SQUAD_SIZE would otherwise be the thing
 *  that fails, masking whatever is actually being asserted. */
function makeRoom(keep = 15) {
  const state = useGameStore.getState();
  const club = state.clubs[state.playerClubId];
  useGameStore.setState({
    clubs: {
      ...state.clubs,
      [state.playerClubId]: { ...club, playerIds: club.playerIds.slice(0, keep), budget: 50_000_000 },
    },
  });
}

beforeEach(() => {
  resetDeviceState();
  useGameStore.getState().initGame(CLUB_ID);
  makeRoom();
});

// openPack defers AI backfill onto a macrotask; flush it so it cannot land in
// the next test and skew a squad-size assertion.
afterEach(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe('Market — weekly bonus lifecycle', () => {
  it('is offered on the featured tier, for the paid path only', () => {
    const featured = getFeaturedPackTier(currentWeekIndex());
    expect(weeklyBonusCardsFor(featured, 'iap')).toBe(WEEKLY_BONUS_CARDS);
    // The bonus is the reason to buy this week's pack. Attaching it to the free
    // or ad path would turn it into a weekly free upgrade instead.
    expect(weeklyBonusCardsFor(featured, 'free')).toBe(0);
    expect(weeklyBonusCardsFor(featured, 'ad')).toBe(0);
    expect(weeklyBonusCardsFor(featured, 'currency')).toBe(0);
    expect(weeklyBonusCardsFor(featured, null)).toBe(0);
  });

  it('is not offered on a non-featured tier', () => {
    const featured = getFeaturedPackTier(currentWeekIndex());
    for (const key of ['daily', 'gold', 'premium', 'rare', 'icon'] as const) {
      if (key === featured) continue;
      expect(weeklyBonusCardsFor(key, 'iap'), `${key} must not carry the bonus`).toBe(0);
    }
  });

  it('grants exactly one bonus card, then stops for the rest of the week', () => {
    const featured = getFeaturedPackTier(currentWeekIndex());
    const tier = PACK_TIER_MAP[featured];

    const first = useGameStore.getState().openPack(featured, { method: 'iap', skipPayment: true });
    expect(first.success).toBe(true);
    expect(first.players).toHaveLength(tier.cards + WEEKLY_BONUS_CARDS);

    // Claim recorded device-side, immediately — not deferred to the next save.
    const claim = readWeeklyPackBonus();
    expect(claim).toEqual({ weekIndex: currentWeekIndex(), tier: featured });
    expect(weeklyBonusCardsFor(featured, 'iap')).toBe(0);

    makeRoom();
    const second = useGameStore.getState().openPack(featured, { method: 'iap', skipPayment: true });
    expect(second.success, 'the pack itself stays on sale — only the bonus is limited').toBe(true);
    expect(second.players).toHaveLength(tier.cards);
  });

  it('re-arms when the week rolls over, and not before', () => {
    const week = currentWeekIndex();
    const featured = getFeaturedPackTier(week);
    writeWeeklyPackBonus({ weekIndex: week, tier: featured });
    expect(weeklyBonusCardsFor(featured, 'iap')).toBe(0);

    // A claim from a past week is spent history — the bonus is back.
    writeWeeklyPackBonus({ weekIndex: week - 1, tier: featured });
    expect(readWeeklyPackBonus()).toBeNull();
    expect(weeklyBonusCardsFor(featured, 'iap')).toBe(WEEKLY_BONUS_CARDS);
  });

  it('a clock wound backwards cannot re-arm the bonus', () => {
    // The exploit this guards: claim the bonus, set the device date back a
    // week, claim again. `readWeeklyPackBonus` keeps a future-dated record
    // rather than treating a mismatch as a reset.
    const week = currentWeekIndex();
    const featured = getFeaturedPackTier(week);
    writeWeeklyPackBonus({ weekIndex: week + 5, tier: featured });
    expect(readWeeklyPackBonus()).not.toBeNull();
  });

  it('survives a corrupt weekly record without granting a free bonus loop', () => {
    localStorage.setItem(STORAGE_KEYS.WEEKLY_PACK_BONUS, '{not json');
    expect(() => readWeeklyPackBonus()).not.toThrow();
    expect(readWeeklyPackBonus()).toBeNull();
  });

  it('reserves squad space for the bonus card before the store is charged', () => {
    // The failure this prevents: pre-flight passes on `tier.cards`, the store
    // charges, then `openPack` rejects on the same rule with the bonus counted.
    // The user is out real money for nothing.
    const featured = getFeaturedPackTier(currentWeekIndex());
    const tier = PACK_TIER_MAP[featured];
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    const fillTo = MAX_SQUAD_SIZE - tier.cards; // room for the pack, NOT the bonus
    const fakeIds = Array.from({ length: Math.max(0, fillTo - club.playerIds.length) }, (_, i) => `filler-${i}`);
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, playerIds: [...club.playerIds, ...fakeIds].slice(0, fillTo) },
      },
    });

    const pre = useGameStore.getState().canOpenPack(featured, 'iap');
    expect(pre.ok, 'pre-flight must refuse before any charge').toBe(false);
    const open = useGameStore.getState().openPack(featured, { method: 'iap', skipPayment: true });
    expect(open.success).toBe(false);
    expect(open.paidButRejected).toBe(true);
  });

  it('the rotation countdown is always inside one week and never negative', () => {
    const ms = msUntilNextWeekIndex();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });
});

describe('Market — Daily Pack streak resolution', () => {
  it('reads the device streak, defaulting to band 1 with no record', () => {
    expect(currentLoginStreak()).toBe(1);
  });

  it('a live streak lifts the pack the slice actually generates', () => {
    // Write a record that says "claimed yesterday on a 6-day run", so today is
    // day 7 — the top band — without the test having to claim anything.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    writeDailyStreak({ lastClaimDate: localDateKey(yesterday), current: 6, longest: 6 });
    expect(currentLoginStreak()).toBe(7);

    const band = resolvePackTier(PACK_TIER_MAP.daily, { streak: 7 });
    const open = useGameStore.getState().openPack('daily', { method: 'free' });
    expect(open.success).toBe(true);
    expect(Math.max(...open.players!.map(p => p.overall))).toBeGreaterThanOrEqual(band.guaranteedMinOvr);
    for (const p of open.players!) expect(p.overall).toBeLessThanOrEqual(band.ovrMax);
  });

  it('a broken streak drops back to band 1 rather than holding the top band', () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 10);
    writeDailyStreak({ lastClaimDate: localDateKey(longAgo), current: 30, longest: 30 });
    expect(currentLoginStreak()).toBe(1);
  });
});
