/**
 * Paywall free-trial resolution (utils/monetization.ts).
 *
 * The trial used to be hardcoded: "7-day free trial" on Yearly and Monthly,
 * gated on one store probe of Yearly alone. If App Store Connect put the
 * intro offer on a different product, or gave it another length, the paywall
 * either hid a trial the store would grant or promised one it would not.
 * These tests pin that the claim follows the store, product by product.
 */
import { describe, it, expect } from 'vitest';
import { resolvePaywallTrials, preferredPaywallPlan, formatPerPeriodPrice } from '@/utils/monetization';
import { FREE_TRIAL_DAYS } from '@/config/monetization';
import type { ProductId } from '@/types/game';

const YEARLY: ProductId = 'com.dynastymanager.pro.yearly';
const MONTHLY: ProductId = 'com.dynastymanager.pro.monthly';
const LIFETIME: ProductId = 'com.dynastymanager.pro.lifetime';
const PLANS = [YEARLY, LIFETIME, MONTHLY];

const onDevice = (overrides: Partial<Parameters<typeof resolvePaywallTrials>[0]> = {}) => resolvePaywallTrials({
  planIds: PLANS,
  native: true,
  locallyEligible: true,
  eligibility: {},
  storeTrialDays: {},
  ...overrides,
});

describe('resolvePaywallTrials', () => {
  it('offers a trial only where the store has one AND confirms eligibility', () => {
    const trials = onDevice({
      eligibility: { [YEARLY]: false, [MONTHLY]: true },
      storeTrialDays: { [MONTHLY]: 7 },
    });
    expect(trials).toEqual({ [MONTHLY]: 7 });
  });

  it('uses the length App Store Connect configured, not the default', () => {
    const trials = onDevice({ eligibility: { [YEARLY]: true }, storeTrialDays: { [YEARLY]: 3 } });
    expect(trials[YEARLY]).toBe(3);
  });

  it('never claims a trial on unknown eligibility or a missing offer', () => {
    expect(onDevice({ eligibility: { [YEARLY]: null }, storeTrialDays: { [YEARLY]: 7 } })).toEqual({});
    expect(onDevice({ eligibility: { [YEARLY]: true }, storeTrialDays: {} })).toEqual({});
  });

  it('never offers a trial on a one-time purchase', () => {
    expect(onDevice({ eligibility: { [LIFETIME]: true }, storeTrialDays: { [LIFETIME]: 7 } })).toEqual({});
  });

  it('offers nothing to an install that already holds a subscription record', () => {
    expect(onDevice({ locallyEligible: false, eligibility: { [YEARLY]: true }, storeTrialDays: { [YEARLY]: 7 } })).toEqual({});
  });

  it('keeps the mocked web flow testable with the configured default', () => {
    const trials = resolvePaywallTrials({ planIds: PLANS, native: false, locallyEligible: true, eligibility: {}, storeTrialDays: {} });
    expect(trials).toEqual({ [YEARLY]: FREE_TRIAL_DAYS, [MONTHLY]: FREE_TRIAL_DAYS });
  });
});

describe('preferredPaywallPlan', () => {
  it('keeps Yearly when it carries the trial', () => {
    expect(preferredPaywallPlan(PLANS, { [YEARLY]: 7, [MONTHLY]: 7 })).toBe(YEARLY);
  });

  it('moves to the plan with the trial when Yearly has none', () => {
    expect(preferredPaywallPlan(PLANS, { [MONTHLY]: 7 })).toBe(MONTHLY);
  });

  it('keeps Yearly when no plan has a trial', () => {
    expect(preferredPaywallPlan(PLANS, {})).toBe(YEARLY);
  });

  it('falls through to the first visible plan when Yearly is not on sale', () => {
    expect(preferredPaywallPlan([LIFETIME, MONTHLY], {})).toBe(LIFETIME);
    expect(preferredPaywallPlan([], {})).toBeUndefined();
  });
});

describe('formatPerPeriodPrice ("Works out at X/month")', () => {
  // The line used to splice `toFixed(2)` into the store's price string, which
  // is wrong wherever the storefront's decimal separator or minor unit is not
  // the US one: "2.08 €" in Germany, "¥250.00" in Japan.
  it('formats in the storefront currency with the locale\'s separators', () => {
    expect(formatPerPeriodPrice(24.99, 12, 'EUR', 'de-DE')).toBe('2,08\u00a0€');
    expect(formatPerPeriodPrice(3000, 12, 'JPY', 'en-US')).toBe('¥250');
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-US')).toBe('$2.08');
  });

  // Playthrough 2026-09 (R10): "$24.99/year" beside "Works out at US$2.08/month".
  // en-GB spells a US dollar "US$" in the default currency display.
  it('a US dollar reads "$" in any device locale (narrowSymbol)', () => {
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-GB')).toBe('$2.08');
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-CA')).toBe('$2.08');
  });

  it('takes the shape of the store price it sits beside', () => {
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-GB', '$24.99')).toBe('$2.08');
    // The store string is authoritative, even where it says "US$".
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-US', 'US$24.99')).toBe('US$2.08');
    expect(formatPerPeriodPrice(24.99, 12, 'EUR', 'en-US', '24,99\u00a0€')).toBe('2,08\u00a0€');
    expect(formatPerPeriodPrice(3000, 12, 'JPY', 'en-GB', '¥3,000')).toBe('¥250');
    expect(formatPerPeriodPrice(33000, 12, 'KRW', 'en-US', '₩33,000')).toBe('₩2,750');
    expect(formatPerPeriodPrice(1234.56, 1, 'EUR', 'en-US', '1.234,56 €')).toBe('1.234,56 €');
  });

  it('never trusts a store string that does not say the total', () => {
    // No minor unit, a different number, or no number at all → Intl.
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-GB', '$25')).toBe('$2.08');
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-GB', '$19.99')).toBe('$2.08');
    expect(formatPerPeriodPrice(24.99, 12, 'USD', 'en-GB', 'Free')).toBe('$2.08');
  });

  it('omits the line rather than guessing', () => {
    expect(formatPerPeriodPrice(24.99, 12, undefined)).toBeNull();
    expect(formatPerPeriodPrice(null, 12, 'USD')).toBeNull();
    expect(formatPerPeriodPrice(0, 12, 'USD')).toBeNull();
    expect(formatPerPeriodPrice(24.99, 0, 'USD')).toBeNull();
    expect(formatPerPeriodPrice(24.99, 12, 'NOT-A-CODE')).toBeNull();
  });
});
