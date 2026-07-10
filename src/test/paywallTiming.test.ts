import { describe, it, expect } from 'vitest';
import { subscribeSlotContextMissing } from '@/utils/paywallTiming';

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
