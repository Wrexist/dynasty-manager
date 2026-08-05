/**
 * Rewarded-ad prompt pacing.
 *
 * The escalation rules are the whole point of this system: frequency rises
 * with demonstrated tolerance and falls with demonstrated disinterest, bounded
 * hard at both ends. These tests pin all four behaviours, plus the Pro cohort
 * rules, because a regression here is invisible in the UI until retention moves.
 */
import { describe, it, expect } from 'vitest';
import {
  canPrompt,
  rollDay,
  dayKeyFor,
  safeEngagement,
  withPromptShown,
  withWatchCompleted,
  withPromptDismissed,
  promptsRemainingToday,
} from '@/utils/adPacing';
import { AD_PACING, dailyPromptAllowance } from '@/config/ads';
import { DEFAULT_MONETIZATION_STATE, DEFAULT_AD_ENGAGEMENT } from '@/config/monetization';
import type { MonetizationState, AdEngagementState } from '@/types/game';

const NOW = new Date('2026-08-03T12:00:00Z').getTime();

function stateWith(e: Partial<AdEngagementState>, pro = false): MonetizationState {
  return {
    ...DEFAULT_MONETIZATION_STATE,
    entitlements: pro ? ['com.dynastymanager.pro'] : [],
    adEngagement: { ...DEFAULT_AD_ENGAGEMENT, dayKey: dayKeyFor(NOW), ...e },
  };
}

describe('dailyPromptAllowance', () => {
  it('starts at the base allowance for a fresh free player', () => {
    expect(dailyPromptAllowance(0, 0, false)).toBe(AD_PACING.BASE_PROMPTS_PER_DAY);
  });

  it('ESCALATES with ads watched — the core ask', () => {
    const base = dailyPromptAllowance(0, 0, false);
    const after4 = dailyPromptAllowance(4, 0, false);
    expect(after4).toBeGreaterThan(base);
  });

  it('never exceeds the hard daily ceiling, however many are watched', () => {
    for (const watched of [10, 50, 1000]) {
      expect(dailyPromptAllowance(watched, 0, false)).toBeLessThanOrEqual(
        AD_PACING.MAX_PROMPTS_PER_DAY,
      );
    }
  });

  it('DECAYS with consecutive dismissals — a disengaged player is asked less', () => {
    const base = dailyPromptAllowance(0, 0, false);
    expect(dailyPromptAllowance(0, 2, false)).toBeLessThan(base);
  });

  it('never decays below the floor — one offer a day is still an offer', () => {
    expect(dailyPromptAllowance(0, 100, false)).toBe(AD_PACING.MIN_PROMPTS_PER_DAY);
  });

  it('gives Pro a flat, lower, NON-escalating allowance', () => {
    expect(dailyPromptAllowance(0, 0, true)).toBe(AD_PACING.PRO_PROMPTS_PER_DAY);
    // Watching more must not buy a Pro user more prompts.
    expect(dailyPromptAllowance(20, 0, true)).toBe(AD_PACING.PRO_PROMPTS_PER_DAY);
    expect(dailyPromptAllowance(0, 0, true)).toBeLessThan(AD_PACING.BASE_PROMPTS_PER_DAY);
  });
});

describe('canPrompt', () => {
  it('allows a fresh free player when ads are usable', () => {
    expect(canPrompt(stateWith({}), NOW, true).allowed).toBe(true);
  });

  it('refuses a FREE player when the ad SDK is unavailable', () => {
    // Offering a reward the app cannot deliver is the Pro-only-buff failure.
    const d = canPrompt(stateWith({}), NOW, false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('ads_unavailable');
  });

  it('ALSO refuses a PRO player when the ad SDK is unavailable', () => {
    // Pro's entitlement is skipping the video, NOT reaching rewards free
    // players cannot earn. `transfer_budget` grants in-game money, so a
    // Pro-only reward economy would be a paid economic advantage — the exact
    // pay-to-win failure the header contracts forbid. Both cohorts unlock
    // together when a real showRewardedAd() ships.
    const d = canPrompt(stateWith({}, true), NOW, false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('ads_unavailable');
  });

  it('refuses once the daily allowance is spent', () => {
    const spent = AD_PACING.BASE_PROMPTS_PER_DAY;
    const d = canPrompt(stateWith({ promptsToday: spent, lastPromptAt: 0 }), NOW, true);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('daily_cap');
  });

  it('refuses inside the minimum gap', () => {
    const d = canPrompt(stateWith({ lastPromptAt: NOW - 1000 }), NOW, true);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('cooldown');
  });

  it('allows again once the gap has elapsed', () => {
    const past = NOW - (AD_PACING.MIN_GAP_MS + 1000);
    expect(canPrompt(stateWith({ lastPromptAt: past }), NOW, true).allowed).toBe(true);
  });

  it('makes Pro wait longer between offers than a free player', () => {
    const justOverFreeGap = NOW - (AD_PACING.MIN_GAP_MS + 1000);
    expect(canPrompt(stateWith({ lastPromptAt: justOverFreeGap }), NOW, true).allowed).toBe(true);
    expect(
      canPrompt(stateWith({ lastPromptAt: justOverFreeGap }, true), NOW, true).allowed,
    ).toBe(false);
  });

  it('lets a heavy watcher exceed the base allowance, up to the ceiling', () => {
    // 5 watched today raises the allowance above base; spending exactly the
    // base number of prompts must therefore NOT cap them out yet.
    const s = stateWith({ watchedToday: 5, promptsToday: AD_PACING.BASE_PROMPTS_PER_DAY, lastPromptAt: 0 });
    expect(canPrompt(s, NOW, true).allowed).toBe(true);
  });
});

describe('state transitions', () => {
  it('withPromptShown increments the counter and stamps the time', () => {
    const out = withPromptShown(DEFAULT_AD_ENGAGEMENT, NOW);
    expect(out.promptsToday).toBe(1);
    expect(out.lastPromptAt).toBe(NOW);
  });

  it('withWatchCompleted raises both counters and CLEARS the dismissal streak', () => {
    const out = withWatchCompleted({ ...DEFAULT_AD_ENGAGEMENT, consecutiveDismissals: 4 }, NOW);
    expect(out.watchedToday).toBe(1);
    expect(out.totalWatched).toBe(1);
    expect(out.consecutiveDismissals).toBe(0);
  });

  it('withPromptDismissed raises the dismissal streak', () => {
    const out = withPromptDismissed({ ...DEFAULT_AD_ENGAGEMENT, consecutiveDismissals: 1 }, NOW);
    expect(out.consecutiveDismissals).toBe(2);
  });
});

describe('daily rollover', () => {
  it('resets the daily counters on a new day', () => {
    const yesterday = { ...DEFAULT_AD_ENGAGEMENT, dayKey: '2026-08-02', watchedToday: 5, promptsToday: 7 };
    const out = rollDay(yesterday, NOW);
    expect(out.watchedToday).toBe(0);
    expect(out.promptsToday).toBe(0);
    expect(out.dayKey).toBe(dayKeyFor(NOW));
  });

  it('carries the dismissal streak ACROSS days', () => {
    // Sustained disinterest should not be forgiven overnight — otherwise a
    // player who dismissed all day yesterday gets a full-strength morning.
    const yesterday = { ...DEFAULT_AD_ENGAGEMENT, dayKey: '2026-08-02', consecutiveDismissals: 3 };
    expect(rollDay(yesterday, NOW).consecutiveDismissals).toBe(3);
  });

  it('never rolls lifetime totals', () => {
    const yesterday = { ...DEFAULT_AD_ENGAGEMENT, dayKey: '2026-08-02', totalWatched: 42 };
    expect(rollDay(yesterday, NOW).totalWatched).toBe(42);
  });

  it('is a no-op within the same day', () => {
    const today = { ...DEFAULT_AD_ENGAGEMENT, dayKey: dayKeyFor(NOW), promptsToday: 2 };
    expect(rollDay(today, NOW)).toBe(today);
  });
});

describe('safeEngagement', () => {
  it('repairs a missing or malformed block rather than throwing', () => {
    expect(safeEngagement(undefined)).toEqual(DEFAULT_AD_ENGAGEMENT);
    expect(safeEngagement(null)).toEqual(DEFAULT_AD_ENGAGEMENT);
  });

  it('coerces negative, NaN and non-numeric counters to zero', () => {
    const bad = {
      dayKey: 5, watchedToday: -3, promptsToday: NaN,
      consecutiveDismissals: 'x', lastPromptAt: Infinity, totalWatched: undefined,
    } as unknown as AdEngagementState;
    const out = safeEngagement(bad);
    expect(out.dayKey).toBe('');
    expect(out.watchedToday).toBe(0);
    expect(out.promptsToday).toBe(0);
    expect(out.consecutiveDismissals).toBe(0);
    expect(out.lastPromptAt).toBe(0);
    expect(out.totalWatched).toBe(0);
  });
});

describe('promptsRemainingToday', () => {
  it('counts down as prompts are spent and floors at zero', () => {
    expect(promptsRemainingToday(stateWith({}), NOW)).toBe(AD_PACING.BASE_PROMPTS_PER_DAY);
    expect(promptsRemainingToday(stateWith({ promptsToday: 99 }), NOW)).toBe(0);
  });
});
