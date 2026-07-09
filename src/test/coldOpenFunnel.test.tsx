import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock main.tsx so importing TitleScreen doesn't boot the whole app
// (ReactDOM render, Sentry init, Capacitor). We only need its two named
// exports.
vi.mock('@/main', () => ({
  signalReady: () => {},
  saveStorageReady: Promise.resolve(),
}));

// Capture navigation instead of really routing.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import TitleScreen from '@/pages/TitleScreen';
import SubscribeOnboarding from '@/pages/SubscribeOnboarding';

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('cold open — New Game funnel (G1)', () => {
  it('routes the first New Game straight to /mode-select with no paywall', async () => {
    render(
      <MemoryRouter>
        <TitleScreen />
      </MemoryRouter>,
    );

    // Slots hydrate asynchronously (saveStorageReady) — wait for the empty
    // "New Game" affordance to appear, then tap it.
    const newGame = await screen.findByLabelText('Start new game in slot 1');
    fireEvent.click(newGame);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [route, opts] = mockNavigate.mock.calls[0];
    expect(route).toBe('/mode-select');
    expect(opts?.state?.slot).toBe(1);
    // The paywall must NOT be in the cold-open path anymore.
    expect(mockNavigate).not.toHaveBeenCalledWith('/subscribe', expect.anything());
  });
});

describe('SubscribeOnboarding — missing-slot guard (G1)', () => {
  it('redirects to the title when reached with no slot and no return context', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/subscribe' }]}>
        <SubscribeOnboarding />
      </MemoryRouter>,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    // Renders nothing while redirecting.
    expect(screen.queryByText('Unlock Dynasty Pro')).toBeNull();
  });

  it('renders the paywall for an in-game upsell (returnTo /game, no slot needed)', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/subscribe', state: { returnTo: '/game' } }]}>
        <SubscribeOnboarding />
      </MemoryRouter>,
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/', { replace: true });
    expect(screen.getByText('Unlock Dynasty Pro')).toBeDefined();
  });

  it('renders the paywall for the pre-game flow that carries a slot', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/subscribe', state: { slot: 2, returnTo: '/mode-select' } }]}>
        <SubscribeOnboarding />
      </MemoryRouter>,
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/', { replace: true });
    expect(screen.getByText('Unlock Dynasty Pro')).toBeDefined();
  });
});
