/**
 * StarterKitBanner — the week-1 dashboard placement for the Starter Kit offer.
 *
 * The kit's only purchase surface used to be a card buried in the Shop, so its
 * 7-day window regularly expired unseen. The banner surfaces it on Dashboard
 * and must self-hide in exactly the states where the Shop card hides:
 * purchased (any Pro entitlement), dismissed, expired, or no launch stamp.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarterKitBanner } from '@/components/game/StarterKitBanner';
import { useGameStore } from '@/store/gameStore';

const CLUB = 'manchester-city';

describe('StarterKitBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });

  it('renders for a fresh non-Pro career inside the window', () => {
    render(<StarterKitBanner />);
    expect(screen.getByLabelText(/view in Shop/i)).toBeTruthy();
    expect(screen.getByText(/day(s)? left/i)).toBeTruthy();
  });

  it('hides once the offer is dismissed', () => {
    useGameStore.setState(s => ({ monetization: { ...s.monetization, starterKitDismissed: true } }));
    render(<StarterKitBanner />);
    expect(screen.queryByLabelText(/view in Shop/i)).toBeNull();
  });

  it('hides for Pro users', () => {
    useGameStore.setState(s => ({
      monetization: { ...s.monetization, entitlements: ['com.dynastymanager.pro'] },
    }));
    render(<StarterKitBanner />);
    expect(screen.queryByLabelText(/view in Shop/i)).toBeNull();
  });

  it('hides when the 7-day window has expired', () => {
    useGameStore.setState(s => ({
      monetization: { ...s.monetization, firstLaunchTimestamp: Date.now() - 8 * 86_400_000 },
    }));
    render(<StarterKitBanner />);
    expect(screen.queryByLabelText(/view in Shop/i)).toBeNull();
  });
});
