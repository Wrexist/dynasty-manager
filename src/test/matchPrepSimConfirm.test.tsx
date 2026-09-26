/**
 * Match Prep's Instant Sim confirm is a real dialog.
 *
 * It used to be a hand-rolled `fixed inset-0` div: no role, no accessible
 * name, no Escape, no backdrop tap, focus left behind on the page, and 36px
 * (`h-9`) buttons under the 44px floor. It now goes through ConfirmDialog, the
 * same component TransferPage's confirms use.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import type { ProductId } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

import MatchPrep from '@/pages/MatchPrep';

const PRO: ProductId = 'com.dynastymanager.pro';

function stage(playResult: unknown) {
  const play = vi.fn(() => playResult);
  useGameStore.setState(s => ({
    // Instant Sim is Pro-only; a one-time Pro entitlement is the simplest way in.
    monetization: { ...s.monetization, entitlements: [PRO] },
    currentScreen: 'match-prep',
    playCurrentMatch: play as never,
  }));
  return play;
}

beforeEach(() => {
  useGameStore.getState().initGame('manchester-city');
});
afterEach(cleanup);

const renderPrep = () => render(<MemoryRouter><MatchPrep /></MemoryRouter>);

async function openConfirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
  return screen.findByRole('dialog');
}

describe('MatchPrep instant-sim confirm', () => {
  it('opens as a labelled dialog with 44px actions', async () => {
    stage(null);
    renderPrep();
    const dialog = await openConfirm();
    expect(dialog).toHaveAccessibleName('Simulate this match?');
    expect(screen.getByRole('button', { name: 'Sim Match' })).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('h-11');
  });

  it('Escape cancels without simulating', async () => {
    const play = stage(null);
    renderPrep();
    const dialog = await openConfirm();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(play).not.toHaveBeenCalled();
    expect(useGameStore.getState().currentScreen).toBe('match-prep');
  });

  it('Sim Match plays the match and opens the review', async () => {
    const play = stage({ id: 'm1' });
    renderPrep();
    await openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Sim Match' }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().currentScreen).toBe('match-review');
  });
});
