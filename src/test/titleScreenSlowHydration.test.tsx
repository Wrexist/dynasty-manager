/**
 * Regression: a slow IndexedDB at launch must not turn a career into a
 * "New Game" row.
 *
 * Hydration releases the title screen after 3 s even if IDB has not answered.
 * A ~7 MB save never fits the localStorage mirror, so an unread slot read as
 * empty, the screen offered New Game over it, and the new game's first save
 * overwrote the IDB main copy. An unread slot now renders a "still loading"
 * row with a retry, and re-renders into the real career once the read lands.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/main', () => ({
  signalReady: () => {},
  saveStorageReady: Promise.resolve(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const career = JSON.stringify({
  version: 92, playerClubId: 'arsenal', season: 4, week: 12,
  clubs: { arsenal: { name: 'Arsenal' } }, players: {},
});

// Slot 1 holds a career only in IndexedDB. Until `answering` flips, IDB does
// not answer for it (an open that timed out).
const idbState = vi.hoisted(() => ({ answering: false }));
vi.mock('@/store/helpers/idbStorage', () => {
  const store = new Map<string, string>();
  return {
    idbGet: vi.fn(async (k: string) => store.get(k) ?? null),
    idbRead: vi.fn(async (k: string) => {
      if (k.startsWith('dynasty-save-1')) {
        if (!idbState.answering) return { ok: false };
        return { ok: true, value: k === 'dynasty-save-1' ? career : null };
      }
      return { ok: true, value: store.get(k) ?? null };
    }),
    idbPut: vi.fn(async () => true),
    idbDel: vi.fn(async () => {}),
    idbKeys: vi.fn(async () => []),
    requestPersistentStorage: vi.fn(async () => true),
  };
});

import TitleScreen from '@/pages/TitleScreen';

describe('title screen with an unread save slot', () => {
  it('never offers New Game on it, and shows the career once a retry reads it', async () => {
    render(
      <MemoryRouter>
        <TitleScreen />
      </MemoryRouter>,
    );

    // Readable empty slots still offer New Game...
    await screen.findByLabelText('Start new game in slot 2');
    // ...but the unread one is a loading row, not an empty slot.
    const loading = screen.getByLabelText('Save slot 1 is still loading. Tap to try again');
    expect(screen.queryByLabelText('Start new game in slot 1')).toBeNull();

    idbState.answering = true;
    fireEvent.click(loading);

    await screen.findByLabelText('Continue — Arsenal, Season 4 Week 12');
    expect(screen.queryByLabelText('Save slot 1 is still loading. Tap to try again')).toBeNull();
    expect(screen.queryByLabelText('Start new game in slot 1')).toBeNull();
  });
});
