/**
 * The paywall's cancellation instructions and Terms link must match the store
 * the player is buying through. They were Apple-only on every platform: an
 * Android (Google Play) subscriber was told to cancel in "Settings → Apple ID
 * → Subscriptions" and handed Apple's EULA, which governs no Play purchase.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const platform = { value: 'android' as 'ios' | 'android' };

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => false, getPlatform: () => platform.value },
  };
});
vi.mock('@/utils/externalUrl', () => ({ openExternalUrl: vi.fn().mockResolvedValue(undefined) }));

import { openExternalUrl } from '@/utils/externalUrl';
import SubscribeOnboarding from '@/pages/SubscribeOnboarding';
import { GOOGLE_PLAY_TERMS_URL, TERMS_URL } from '@/config/legal';

function renderPaywall() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/subscribe', state: { returnTo: '/game' } }]}>
      <SubscribeOnboarding />
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.mocked(openExternalUrl).mockClear(); });

describe('paywall store copy', () => {
  it('Android: Google Play cancellation path and Play terms, never Apple ID', () => {
    platform.value = 'android';
    const { container } = renderPaywall();
    expect(container.textContent).not.toContain('Apple ID');
    expect(container.textContent).toContain('Google Play → Payments & subscriptions');
    fireEvent.click(screen.getByRole('button', { name: 'Terms of Use' }));
    expect(openExternalUrl).toHaveBeenCalledWith(GOOGLE_PLAY_TERMS_URL);
  });

  it('iOS: Apple ID cancellation path and Apple\'s EULA', () => {
    platform.value = 'ios';
    const { container } = renderPaywall();
    expect(container.textContent).toContain('Settings → Apple ID → Subscriptions');
    fireEvent.click(screen.getByRole('button', { name: 'Terms of Use' }));
    expect(openExternalUrl).toHaveBeenCalledWith(TERMS_URL);
  });
});
