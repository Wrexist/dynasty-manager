/**
 * Both Pro subscriptions carry a free week in App Store Connect. Every surface
 * that sells them must name the trial on exactly the plans the store confirms
 * for this Apple ID — both, one or none — and never on a plan it does not
 * (Apple 3.1.2(c): a trial claim the store then refuses is a false claim).
 *
 *  - the paywall (SubscribeOnboarding): per-plan caption on each row;
 *  - the Shop: its subscription cards used to sell both plans without ever
 *    mentioning the trial;
 *  - the Shop's confirm dialog (PurchaseModal): states the trial and what is
 *    billed after it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
});

vi.mock('@/utils/purchases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/purchases')>();
  return { ...actual, getStoreAvailability: vi.fn(), checkIntroOfferEligibility: vi.fn() };
});

import { getStoreAvailability, checkIntroOfferEligibility } from '@/utils/purchases';
import { probePaywallTrials, probeTrialOfferDays, resetTrialOfferProbe } from '@/utils/trialOffer';
import ShopPage from '@/pages/ShopPage';
import SubscribeOnboarding from '@/pages/SubscribeOnboarding';
import { PurchaseModal } from '@/components/game/PurchaseModal';
import { useGameStore } from '@/store/gameStore';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import type { ProductId } from '@/types/game';

const YEARLY: ProductId = 'com.dynastymanager.pro.yearly';
const MONTHLY: ProductId = 'com.dynastymanager.pro.monthly';
const LIFETIME: ProductId = 'com.dynastymanager.pro.lifetime';

const PRICES: Partial<Record<ProductId, string>> = {
  [YEARLY]: '$24.99',
  [MONTHLY]: '$4.99',
  [LIFETIME]: '$39.99',
  'com.dynastymanager.bundle.all': '$42.99',
  'com.dynastymanager.pack.manager': '$2.99',
  'com.dynastymanager.pack.stadium': '$1.99',
  'com.dynastymanager.pack.legends': '$3.99',
};

/** The store: both subscriptions carry a free week (the owner's ASC setup). */
function storeSays(eligibility: Partial<Record<ProductId, boolean | null>>, trialDays = { [YEARLY]: 7, [MONTHLY]: 7 }) {
  vi.mocked(getStoreAvailability).mockImplementation(async (ids?: ProductId[]) => {
    const wanted = ids ?? (Object.keys(PRICES) as ProductId[]);
    return {
      supported: true,
      available: wanted.filter(id => PRICES[id]),
      prices: PRICES,
      amounts: {},
      freeTrialDays: trialDays,
    };
  });
  vi.mocked(checkIntroOfferEligibility).mockResolvedValue(eligibility);
}

beforeEach(() => {
  resetTrialOfferProbe();
  vi.mocked(getStoreAvailability).mockReset();
  vi.mocked(checkIntroOfferEligibility).mockReset();
  useGameStore.setState({
    monetization: { ...DEFAULT_MONETIZATION_STATE, entitlements: [], activeCosmetics: {}, adRewardsClaimed: {}, subscription: null },
  });
});
afterEach(cleanup);

describe('probePaywallTrials — the per-plan answer', () => {
  it('both plans carry the free week when the store confirms both', async () => {
    storeSays({ [YEARLY]: true, [MONTHLY]: true });
    expect(await probePaywallTrials()).toEqual({ [YEARLY]: 7, [MONTHLY]: 7 });
  });

  it('only the plan the store confirms', async () => {
    storeSays({ [YEARLY]: false, [MONTHLY]: true });
    expect(await probePaywallTrials()).toEqual({ [MONTHLY]: 7 });
  });

  it('unknown eligibility is never a trial', async () => {
    storeSays({ [YEARLY]: null, [MONTHLY]: null });
    expect(await probePaywallTrials()).toEqual({});
  });

  it('the in-game upsell still leads with the Yearly trial', async () => {
    storeSays({ [YEARLY]: true, [MONTHLY]: true }, { [YEARLY]: 7, [MONTHLY]: 3 });
    expect(await probeTrialOfferDays()).toBe(7);
  });

  it('...and falls back to the Monthly trial when that is the only one', async () => {
    storeSays({ [YEARLY]: false, [MONTHLY]: true }, { [YEARLY]: 7, [MONTHLY]: 3 });
    expect(await probeTrialOfferDays()).toBe(3);
  });
});

function renderShop() {
  return render(<MemoryRouter><ShopPage /></MemoryRouter>);
}

/** The Shop's card for one plan, found by its product name heading. */
function card(name: string) {
  return screen.getByRole('heading', { name }).closest('div.p-4') as HTMLElement;
}

describe('Shop subscription cards name the confirmed trial', () => {
  it('names the free week on both Yearly and Monthly, never on Lifetime', async () => {
    storeSays({ [YEARLY]: true, [MONTHLY]: true });
    renderShop();

    await waitFor(() => expect(screen.getAllByText(/Free for 7 days/)).toHaveLength(2));
    expect(within(card('Dynasty Pro Annual')).getByText('Free for 7 days, then $24.99/year. Cancel anytime.')).toBeTruthy();
    expect(within(card('Dynasty Pro Monthly')).getByText('Free for 7 days, then $4.99/month. Cancel anytime.')).toBeTruthy();
    expect(within(card('Dynasty Pro Lifetime')).queryByText(/Free for/)).toBeNull();
  });

  it('names it only on the plan the store confirms', async () => {
    storeSays({ [YEARLY]: false, [MONTHLY]: true });
    renderShop();

    await waitFor(() => expect(within(card('Dynasty Pro Monthly')).getByText(/Free for 7 days/)).toBeTruthy());
    expect(within(card('Dynasty Pro Annual')).queryByText(/Free for/)).toBeNull();
  });

  it('never names it without the store\'s confirmation', async () => {
    storeSays({ [YEARLY]: null, [MONTHLY]: null });
    renderShop();

    await waitFor(() => expect(checkIntroOfferEligibility).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dynasty Pro Annual' })).toBeTruthy());
    expect(screen.queryByText(/Free for/)).toBeNull();
  });

  it('never names it to an install that already holds a subscription record', async () => {
    storeSays({ [YEARLY]: true, [MONTHLY]: true });
    useGameStore.setState(st => ({
      monetization: {
        ...st.monetization,
        subscription: {
          tier: 'monthly', productId: MONTHLY, expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
          isInGracePeriod: false, willRenew: false, isTrial: false,
        },
      },
    }));
    renderShop();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dynasty Pro Annual' })).toBeTruthy());
    expect(screen.queryByText(/Free for/)).toBeNull();
    expect(checkIntroOfferEligibility).not.toHaveBeenCalled();
  });
});

describe('the Shop confirm dialog', () => {
  const noop = () => {};

  it('states the trial and what is billed after it, keeping the billed amount as the total', () => {
    render(<PurchaseModal productId={YEARLY} storePrice="$24.99" trialDays={7} onConfirm={noop} onCancel={noop} />);
    expect(screen.getByText('$24.99/year')).toBeTruthy();
    expect(screen.getByText('Free for 7 days, then $24.99/year. Cancel anytime.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start 7-Day Free Trial' })).toBeTruthy();
  });

  it('is a plain subscribe dialog without a confirmed trial', () => {
    render(<PurchaseModal productId={MONTHLY} storePrice="$4.99" onConfirm={noop} onCancel={noop} />);
    expect(screen.queryByText(/Free for/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeTruthy();
  });

  it('never frames a one-time purchase as a trial', () => {
    render(<PurchaseModal productId={LIFETIME} storePrice="$39.99" trialDays={7} onConfirm={noop} onCancel={noop} />);
    expect(screen.queryByText(/Free for/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Purchase' })).toBeTruthy();
  });
});

describe('the paywall shows each plan\'s own trial', () => {
  function renderPaywall() {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/subscribe', state: { returnTo: '/game' } }]}>
        <SubscribeOnboarding />
      </MemoryRouter>,
    );
  }

  it('both rows carry the free week when the store confirms both', async () => {
    storeSays({ [YEARLY]: true, [MONTHLY]: true });
    renderPaywall();
    await waitFor(() => expect(screen.getAllByText('7-day free trial included')).toHaveLength(2));
  });

  it('only the Monthly row when only Monthly is confirmed, and Monthly is preselected', async () => {
    storeSays({ [YEARLY]: false, [MONTHLY]: true });
    renderPaywall();
    await waitFor(() => expect(screen.getAllByText('7-day free trial included')).toHaveLength(1));
    const monthlyRow = screen.getByText('Pro Monthly').closest('button')!;
    expect(within(monthlyRow).getByText('7-day free trial included')).toBeTruthy();
    expect(monthlyRow.getAttribute('aria-pressed')).toBe('true');
  });
});
