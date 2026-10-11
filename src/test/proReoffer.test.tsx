/**
 * Dynasty Pro re-offer at high points, and the free Optimize Lineup try.
 *
 * The full paywall used to appear once per device, before any gameplay. The
 * re-offer shows it again at a win streak or a celebrated season, with caps;
 * a loss never triggers a paywall, it grants one free Optimize Lineup instead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MonetizationState } from '@/types/game';
import {
  canReofferPro, recordProReoffer, isWinStreak,
  grantFreeOptimizeTry, hasFreeOptimizeTry, consumeFreeOptimizeTry,
} from '@/utils/proReoffer';
import { setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import {
  PRO_REOFFER_MIN_GAP_DAYS, PRO_REOFFER_MAX_TOTAL, PRO_REOFFER_MIN_ACCOUNT_AGE_HOURS,
} from '@/config/monetization';
import { OptimizeLineupButton } from '@/components/game/OptimizeLineupButton';
import { useGameStore } from '@/store/gameStore';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function freePlayer(firstLaunchAgo = 3 * DAY): MonetizationState {
  const base = useGameStore.getState().monetization;
  return { ...base, entitlements: [], subscription: null, firstLaunchTimestamp: Date.now() - firstLaunchAgo };
}

describe('isWinStreak', () => {
  it('needs the last three league results to be wins', () => {
    expect(isWinStreak(['L', 'W', 'W', 'W'])).toBe(true);
    expect(isWinStreak(['W', 'W', 'D'])).toBe(false);
    expect(isWinStreak(['W', 'W'])).toBe(false);
    expect(isWinStreak(undefined)).toBe(false);
  });
});

describe('canReofferPro', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
    setFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
  });

  it('re-offers to a free player who already saw the cold-open', () => {
    expect(canReofferPro(freePlayer())).toBe(true);
  });

  it('never before the cold-open, on day one, or to Pro or trial users', () => {
    expect(canReofferPro(freePlayer((PRO_REOFFER_MIN_ACCOUNT_AGE_HOURS - 1) * HOUR))).toBe(false);
    expect(canReofferPro({ ...freePlayer(), entitlements: ['com.dynastymanager.pro'] })).toBe(false);
    expect(canReofferPro({ ...freePlayer(), subscription: { tier: 'annual', expiresAt: Date.now() - DAY } as MonetizationState['subscription'] })).toBe(false);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    expect(canReofferPro(freePlayer())).toBe(false);
  });

  it('waits the minimum gap and stops at the lifetime cap', () => {
    const now = Date.now();
    recordProReoffer(now);
    expect(canReofferPro(freePlayer(), now + (PRO_REOFFER_MIN_GAP_DAYS - 1) * DAY)).toBe(false);
    expect(canReofferPro(freePlayer(), now + PRO_REOFFER_MIN_GAP_DAYS * DAY)).toBe(true);
    for (let i = 1; i < PRO_REOFFER_MAX_TOTAL; i++) recordProReoffer(now);
    expect(canReofferPro(freePlayer(), now + 365 * DAY)).toBe(false);
  });
});

describe('free Optimize Lineup try after a loss', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
  });

  it('is granted once, never to Pro, and spent on use', () => {
    grantFreeOptimizeTry({ ...freePlayer(), entitlements: ['com.dynastymanager.pro'] });
    expect(hasFreeOptimizeTry()).toBe(false);
    grantFreeOptimizeTry(freePlayer());
    expect(hasFreeOptimizeTry()).toBe(true);
    consumeFreeOptimizeTry();
    expect(hasFreeOptimizeTry()).toBe(false);
    grantFreeOptimizeTry(freePlayer()); // a later loss does not grant another
    expect(hasFreeOptimizeTry()).toBe(false);
  });

  it('the locked button runs Optimize once, then locks again', () => {
    grantFreeOptimizeTry(freePlayer());
    const onOptimize = vi.fn();
    render(
      <MemoryRouter>
        <OptimizeLineupButton potentialGain={3} autoFilling={false} onOptimize={onOptimize} locked />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /try smart optimize free/i });
    fireEvent.click(button);
    expect(onOptimize).toHaveBeenCalledTimes(1);
    expect(hasFreeOptimizeTry()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /dynasty pro feature/i }));
    expect(onOptimize).toHaveBeenCalledTimes(1);
  });
});
