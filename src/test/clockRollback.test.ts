/**
 * Regression: winding the device clock backwards must not extend Pro.
 *
 * Every entitlement decision compares a stored `expiresAt` against the device
 * clock, which the user controls. With no backend to ask, a lapsed subscriber
 * could set the date back and keep Pro indefinitely, offline, with no purchase
 * — and re-arm the time-limited Starter Kit offer while they were at it.
 *
 * The defence is a monotonic high-water mark: expiry is judged against the
 * FURTHEST time this device has ever seen, so moving the clock back buys
 * nothing. A successful store sync re-anchors it, so an honest device whose
 * clock was genuinely wrong recovers rather than reading as permanently expired.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isPro, isSubscriptionActive, isStarterKitAvailable } from '@/utils/monetization';
import { readClockHighWater, observeClock, reanchorClock, __resetClockHighWaterCache, STORAGE_KEYS } from '@/store/helpers/persistence';
import { STARTER_KIT_WINDOW_MS } from '@/config/monetization';
import type { MonetizationState } from '@/types/game';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000; // fixed reference instant

const baseState = (over: Partial<MonetizationState> = {}): MonetizationState => ({
  entitlements: [],
  subscription: null,
  activeCosmetics: {},
  adRewardsClaimed: {},
  firstLaunchTimestamp: 0,
  starterKitDismissed: false,
  ...over,
} as MonetizationState);

/** A monthly sub that expired one day before T0. */
const lapsedSub = {
  productId: 'com.dynastymanager.pro.monthly',
  tier: 'monthly' as const,
  expiresAt: new Date(T0 - DAY).toISOString(),
  grantedAt: new Date(T0 - 31 * DAY).toISOString(),
  isTrial: false,
};

describe('monotonic clock guard', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEYS.CLOCK_HIGH_WATER);
    // The mark is mirrored in memory so `isPro` — called from render paths —
    // never hits a synchronous localStorage write. Clearing storage alone
    // therefore does not reset it between cases.
    __resetClockHighWaterCache();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('advances on a forward clock and holds on a backward one', () => {
    vi.setSystemTime(T0);
    expect(observeClock()).toBe(T0);
    expect(readClockHighWater()).toBe(T0);

    // Clock wound back a year.
    vi.setSystemTime(T0 - 365 * DAY);
    expect(observeClock()).toBe(T0);          // effective now is unchanged
    expect(readClockHighWater()).toBe(T0);    // and the mark is not lowered

    // Clock moves genuinely forward.
    vi.setSystemTime(T0 + DAY);
    expect(observeClock()).toBe(T0 + DAY);
    expect(readClockHighWater()).toBe(T0 + DAY);
  });

  it('reanchor lowers the mark — the store-corroborated escape hatch', () => {
    vi.setSystemTime(T0 + 3650 * DAY); // clock accidentally set a decade ahead
    observeClock();
    expect(readClockHighWater()).toBe(T0 + 3650 * DAY);

    // Clock corrected, and a store sync confirms entitlement state.
    vi.setSystemTime(T0);
    reanchorClock();
    expect(readClockHighWater()).toBe(T0);
    expect(observeClock()).toBe(T0);
  });
});

describe('a lapsed subscription cannot be revived by the clock', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEYS.CLOCK_HIGH_WATER);
    // The mark is mirrored in memory so `isPro` — called from render paths —
    // never hits a synchronous localStorage write. Clearing storage alone
    // therefore does not reset it between cases.
    __resetClockHighWaterCache();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('stays expired after the clock is wound back past the expiry', () => {
    const state = baseState({ subscription: lapsedSub });

    // At real time the sub is expired, and observing stamps the high-water mark.
    vi.setSystemTime(T0);
    expect(isSubscriptionActive(state)).toBe(false);
    expect(isPro(state)).toBe(false);

    // Wind back to a week before expiry. Pre-fix this read as active again.
    vi.setSystemTime(T0 - 8 * DAY);
    expect(isSubscriptionActive(state)).toBe(false);
    expect(isPro(state)).toBe(false);
  });

  it('a genuinely active subscription is unaffected by the guard', () => {
    const activeSub = { ...lapsedSub, expiresAt: new Date(T0 + 10 * DAY).toISOString() };
    const state = baseState({ subscription: activeSub });
    vi.setSystemTime(T0);
    expect(isSubscriptionActive(state)).toBe(true);
    expect(isPro(state)).toBe(true);
  });

  it('recovers after a store sync re-anchors a wrongly-advanced clock', () => {
    const activeSub = { ...lapsedSub, expiresAt: new Date(T0 + 10 * DAY).toISOString() };
    const state = baseState({ subscription: activeSub });

    // Clock accidentally jumps years ahead — the sub reads expired, correctly
    // for the clock it can see.
    vi.setSystemTime(T0 + 400 * DAY);
    expect(isSubscriptionActive(state)).toBe(false);

    // Clock corrected. Without a re-anchor the high-water mark would keep the
    // paying customer locked out; the store sync clears it.
    vi.setSystemTime(T0);
    reanchorClock();
    expect(isSubscriptionActive(state)).toBe(true);
  });
});

describe('the Starter Kit window cannot be re-armed by the clock', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEYS.CLOCK_HIGH_WATER);
    // The mark is mirrored in memory so `isPro` — called from render paths —
    // never hits a synchronous localStorage write. Clearing storage alone
    // therefore does not reset it between cases.
    __resetClockHighWaterCache();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('stays closed once elapsed, even after winding back', () => {
    const firstLaunch = T0 - STARTER_KIT_WINDOW_MS - DAY; // window already over
    const state = baseState({ firstLaunchTimestamp: firstLaunch });

    vi.setSystemTime(T0);
    expect(isStarterKitAvailable(state)).toBe(false);

    // Wind back to inside the original window.
    vi.setSystemTime(firstLaunch + DAY);
    expect(isStarterKitAvailable(state)).toBe(false);
  });

  it('is still open for a genuinely new install', () => {
    vi.setSystemTime(T0);
    const state = baseState({ firstLaunchTimestamp: T0 - DAY });
    expect(isStarterKitAvailable(state)).toBe(true);
  });
});
