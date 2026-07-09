import { describe, it, expect } from 'vitest';
import {
  shouldFireFirstMatchPaywall,
  hasCompletedFirstMatch,
  subscribeSlotContextMissing,
  type FirstMatchPaywallInput,
} from '@/utils/paywallTiming';
import type { MonetizationState, Match } from '@/types/game';

// Minimal non-Pro monetization state: no entitlements, no subscription.
const FREE: MonetizationState = {
  entitlements: [],
  subscription: null,
} as unknown as MonetizationState;

const PRO: MonetizationState = {
  entitlements: ['com.dynastymanager.pro'],
  subscription: null,
} as unknown as MonetizationState;

const SUBBED: MonetizationState = {
  entitlements: [],
  subscription: { expiresAt: Date.now() + 30 * 24 * 3600 * 1000, productId: 'com.dynastymanager.pro.monthly' },
} as unknown as MonetizationState;

function playedFixture(): Match {
  return { homeClubId: 'me', awayClubId: 'them', played: true, week: 1 } as unknown as Match;
}
function unplayedFixture(): Match {
  return { homeClubId: 'me', awayClubId: 'them', played: false, week: 2 } as unknown as Match;
}

function base(overrides: Partial<FirstMatchPaywallInput> = {}): FirstMatchPaywallInput {
  return {
    currentScreen: 'dashboard',
    monetization: FREE,
    fixtures: [playedFixture()],
    playerClubId: 'me',
    currentMatchResult: null,
    onboardingSeen: false,
    ...overrides,
  };
}

describe('hasCompletedFirstMatch', () => {
  it('is true when a player fixture is played', () => {
    expect(hasCompletedFirstMatch({ fixtures: [playedFixture()], playerClubId: 'me', currentMatchResult: null })).toBe(true);
  });

  it('is false when no player fixture is played', () => {
    expect(hasCompletedFirstMatch({ fixtures: [unplayedFixture()], playerClubId: 'me', currentMatchResult: null })).toBe(false);
  });

  it('ignores played fixtures for other clubs', () => {
    const other = { homeClubId: 'a', awayClubId: 'b', played: true, week: 1 } as unknown as Match;
    expect(hasCompletedFirstMatch({ fixtures: [other], playerClubId: 'me', currentMatchResult: null })).toBe(false);
  });

  it('counts a committed currentMatchResult (World Cup path has no fixtures)', () => {
    expect(hasCompletedFirstMatch({ fixtures: [], playerClubId: 'me', currentMatchResult: { homeGoals: 1 } })).toBe(true);
  });
});

describe('shouldFireFirstMatchPaywall', () => {
  it('fires for a free user, on the dashboard, after a first match', () => {
    expect(shouldFireFirstMatchPaywall(base())).toBe(true);
  });

  it('does NOT fire before any match is played', () => {
    expect(shouldFireFirstMatchPaywall(base({ fixtures: [unplayedFixture()], currentMatchResult: null }))).toBe(false);
  });

  it('does NOT fire off the dashboard (never interrupts match / match-review)', () => {
    expect(shouldFireFirstMatchPaywall(base({ currentScreen: 'match' }))).toBe(false);
    expect(shouldFireFirstMatchPaywall(base({ currentScreen: 'match-review' }))).toBe(false);
  });

  it('does NOT fire once the onboarding has been seen (fires exactly once)', () => {
    expect(shouldFireFirstMatchPaywall(base({ onboardingSeen: true }))).toBe(false);
  });

  it('does NOT fire for a one-time Pro purchaser', () => {
    expect(shouldFireFirstMatchPaywall(base({ monetization: PRO }))).toBe(false);
  });

  it('does NOT fire for an active subscriber', () => {
    expect(shouldFireFirstMatchPaywall(base({ monetization: SUBBED }))).toBe(false);
  });
});

describe('subscribeSlotContextMissing', () => {
  it('redirects when no slot and no return context (lost webview state)', () => {
    expect(subscribeSlotContextMissing({})).toBe(true);
  });

  it('redirects when no slot and returnTo is the onboarding continuation', () => {
    expect(subscribeSlotContextMissing({ returnTo: '/mode-select' })).toBe(true);
  });

  it('allows the pre-game onboarding flow that carries a slot', () => {
    expect(subscribeSlotContextMissing({ slot: 2, returnTo: '/mode-select' })).toBe(false);
  });

  it('allows in-game upsells that return to /game without a slot', () => {
    expect(subscribeSlotContextMissing({ returnTo: '/game' })).toBe(false);
  });

  it('allows the title-settings browse that returns to / without a slot', () => {
    expect(subscribeSlotContextMissing({ returnTo: '/' })).toBe(false);
  });
});
