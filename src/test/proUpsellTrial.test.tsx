/**
 * In-game Pro upsells name the free trial only when the store confirms it.
 *
 * The five ProUpsell banners (Instant Match Sim before every match, tactics,
 * press, match insights, records) used to say only "Upgrade to Dynasty Pro",
 * because they had no eligibility check — so the one-time cold-open paywall
 * was the only place a player ever saw the trial. They now reuse the
 * paywall's per-plan rule through `probeTrialOfferDays`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const native = { value: true };
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => native.value, getPlatform: () => 'ios' },
  };
});

vi.mock('@/utils/purchases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/purchases')>();
  return { ...actual, getStoreAvailability: vi.fn(), checkIntroOfferEligibility: vi.fn() };
});

import { getStoreAvailability, checkIntroOfferEligibility } from '@/utils/purchases';
import { probeTrialOfferDays, resetTrialOfferProbe } from '@/utils/trialOffer';
import { ProUpsell } from '@/components/game/ProUpsell';
import { useGameStore } from '@/store/gameStore';
import type { ProductId } from '@/types/game';

const YEARLY: ProductId = 'com.dynastymanager.pro.yearly';
const MONTHLY: ProductId = 'com.dynastymanager.pro.monthly';

function storeSays(opts: {
  available?: ProductId[];
  trialDays?: Partial<Record<ProductId, number>>;
  eligibility?: Partial<Record<ProductId, boolean | null>>;
}) {
  vi.mocked(getStoreAvailability).mockResolvedValue({
    supported: true,
    available: opts.available ?? [YEARLY, MONTHLY],
    prices: {}, amounts: {},
    freeTrialDays: opts.trialDays ?? {},
  });
  vi.mocked(checkIntroOfferEligibility).mockResolvedValue(opts.eligibility ?? {});
}

beforeEach(() => {
  native.value = true;
  resetTrialOfferProbe();
  vi.mocked(getStoreAvailability).mockReset();
  vi.mocked(checkIntroOfferEligibility).mockReset();
  useGameStore.setState(s => ({ monetization: { ...s.monetization, subscription: null } }));
});
afterEach(cleanup);

describe('probeTrialOfferDays', () => {
  it('reports the store-configured length when the Apple ID is eligible', async () => {
    storeSays({ trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: true } });
    expect(await probeTrialOfferDays()).toBe(7);
  });

  it('reports nothing when eligibility is refused or unknown', async () => {
    storeSays({ trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: null } });
    expect(await probeTrialOfferDays()).toBeNull();
  });

  it('reports nothing when the trial plan is not on sale', async () => {
    storeSays({ available: [MONTHLY], trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: true } });
    expect(await probeTrialOfferDays()).toBeNull();
  });

  it('reuses one store answer across surfaces, then asks again after the TTL', async () => {
    storeSays({ trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: true } });
    await probeTrialOfferDays(1_000);
    await probeTrialOfferDays(2_000);
    expect(getStoreAvailability).toHaveBeenCalledTimes(1);
    await probeTrialOfferDays(1_000 + 11 * 60 * 1000);
    expect(getStoreAvailability).toHaveBeenCalledTimes(2);
  });

  it('never throws — a store failure means no trial line', async () => {
    vi.mocked(getStoreAvailability).mockRejectedValue(new Error('offline'));
    vi.mocked(checkIntroOfferEligibility).mockResolvedValue({});
    expect(await probeTrialOfferDays()).toBeNull();
  });
});

function renderUpsell() {
  return render(
    <MemoryRouter>
      <ProUpsell feature="Instant Match Sim" />
    </MemoryRouter>,
  );
}

describe('ProUpsell', () => {
  it('names the free trial when the store confirms it', async () => {
    storeSays({ trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: true } });
    renderUpsell();
    await waitFor(() => expect(screen.getByText('Dynasty Pro · 7-day free trial')).toBeTruthy());
    expect(screen.getByText('Try free')).toBeTruthy();
  });

  it('keeps the plain upgrade copy when the store does not confirm a trial', async () => {
    storeSays({ trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: false } });
    renderUpsell();
    await waitFor(() => expect(checkIntroOfferEligibility).toHaveBeenCalled());
    expect(screen.getByText('Upgrade to Dynasty Pro')).toBeTruthy();
    expect(screen.queryByText(/free trial/)).toBeNull();
  });

  it('never offers the trial to an install that already holds a subscription record', async () => {
    storeSays({ trialDays: { [YEARLY]: 7 }, eligibility: { [YEARLY]: true } });
    useGameStore.setState(s => ({
      monetization: {
        ...s.monetization,
        subscription: { tier: 'monthly', productId: MONTHLY, expiresAt: null, isTrial: false } as never,
      },
    }));
    renderUpsell();
    expect(screen.getByText('Upgrade to Dynasty Pro')).toBeTruthy();
    expect(getStoreAvailability).not.toHaveBeenCalled();
  });
});
