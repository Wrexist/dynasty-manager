/**
 * The paywall answers "does Pro do the thing I just tapped?" first, and every
 * view is recorded against the surface that opened it.
 *
 * Every in-game upsell used to open the same generic list, and every paywall
 * view was tagged `onboarding`, so cold-open views and in-game upsell views
 * could not be told apart and no upsell could be measured.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => false, getPlatform: () => 'ios' },
  };
});

import SubscribeOnboarding from '@/pages/SubscribeOnboarding';
import { setAnalyticsSink, _resetAnalyticsCacheForTests, type AnalyticsPayload } from '@/utils/analytics';

function renderPaywall(state: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/subscribe', state: { returnTo: '/game', ...state } }]}>
      <SubscribeOnboarding />
    </MemoryRouter>,
  );
}

describe('paywall feature context', () => {
  let captured: AnalyticsPayload[];
  beforeEach(() => {
    localStorage.clear();
    _resetAnalyticsCacheForTests();
    captured = [];
    setAnalyticsSink(p => { captured.push(p); });
  });
  afterEach(() => { cleanup(); _resetAnalyticsCacheForTests(); });

  it('leads with the tapped feature and flags it', () => {
    renderPaywall({ surface: 'upsell', feature: 'Optimize Lineup' });
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Optimize Lineup');
    expect(items[0].textContent).toMatch(/you tapped this/i);
    expect(screen.getAllByText(/you tapped this/i)).toHaveLength(1);
  });

  it('maps an upsell label that names a bullet differently', () => {
    renderPaywall({ surface: 'upsell', feature: 'Advanced Match Insights' });
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('Advanced Analytics');
  });

  it('leaves the list alone for an unknown or absent feature', () => {
    renderPaywall({});
    expect(screen.queryByText(/you tapped this/i)).toBeNull();
    cleanup();
    renderPaywall({ feature: 'Something Pro does not list' });
    expect(screen.queryByText(/you tapped this/i)).toBeNull();
  });

  it('records the view against the surface that opened it', async () => {
    renderPaywall({ surface: 'upsell', feature: 'Instant Match Sim' });
    await waitFor(() => expect(captured.some(e => e.event === 'paywall_viewed')).toBe(true));
    expect(captured.find(e => e.event === 'paywall_viewed')!.data.surface).toBe('upsell');
  });

  it('a paywall opened with no surface is the cold-open', async () => {
    renderPaywall({});
    await waitFor(() => expect(captured.some(e => e.event === 'paywall_viewed')).toBe(true));
    expect(captured.find(e => e.event === 'paywall_viewed')!.data.surface).toBe('onboarding');
  });
});
