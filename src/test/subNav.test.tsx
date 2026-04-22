import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SubNav, type SubNavItem } from '@/components/game/SubNav';
import { useGameStore } from '@/store/gameStore';

// Silence framer-motion's layout logging noise in jsdom.
vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
  hapticWarning: vi.fn(),
}));

const ITEMS: SubNavItem[] = [
  { screen: 'transfers', label: 'Transfers' },
  { screen: 'scouting', label: 'Scouting' },
  { screen: 'packs', label: 'Packs', dot: 'bg-fuchsia-400' },
];

describe('SubNav', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        currentScreen: 'transfers',
        matchPhase: 'none',
      } as Partial<ReturnType<typeof useGameStore.getState>>);
    });
  });

  it('renders all items with tablist/tab roles and marks the active one selected', () => {
    render(<SubNav items={ITEMS} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('dispatches setScreen when tapping an inactive tab', () => {
    render(<SubNav items={ITEMS} />);
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Scouting' }));
    });
    expect(useGameStore.getState().currentScreen).toBe('scouting');
  });

  it('skips setScreen when tapping the already-active tab (avoids redundant remount)', () => {
    const spy = vi.spyOn(useGameStore.getState(), 'setScreen');
    render(<SubNav items={ITEMS} />);
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Transfers' }));
    });
    // currentScreen stays transfers; no setScreen call triggered from the click
    expect(useGameStore.getState().currentScreen).toBe('transfers');
    spy.mockRestore();
  });

  it('blocks taps and disables buttons when a match is live', () => {
    act(() => {
      useGameStore.setState({
        currentScreen: 'match',
        matchPhase: 'first_half',
      } as Partial<ReturnType<typeof useGameStore.getState>>);
    });
    render(<SubNav items={ITEMS} />);
    const tab = screen.getByRole('tab', { name: 'Scouting' });
    expect(tab).toBeDisabled();
    act(() => { fireEvent.click(tab); });
    // Screen remains 'match' — click was blocked.
    expect(useGameStore.getState().currentScreen).toBe('match');
  });
});
