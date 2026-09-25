/**
 * The live match Log lists the newest event first (playthrough 2026-09, R13).
 *
 * It listed oldest first with no scroll-to-latest, so at 61' the events the
 * player was watching for were below the fold of the capped log panel.
 * Newest-first needs no auto-scroll, so there is no motion to gate on reduced
 * motion.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { liveLogRows } from '@/utils/matchEventDisplay';
import type { MatchEvent } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));
vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

import MatchDay from '@/pages/MatchDay';

const ev = (minute: number, type: MatchEvent['type'] = 'commentary'): MatchEvent =>
  ({ minute, type, clubId: 'x', description: `${type} ${minute}` }) as MatchEvent;

describe('liveLogRows', () => {
  it('newest first, kickoffs dropped, each row keyed by its index in the source list', () => {
    const events = [ev(0, 'kickoff'), ev(3), ev(9, 'goal'), ev(46, 'kickoff'), ev(52)];
    const rows = liveLogRows(events);
    expect(rows.map(r => r.event.minute)).toEqual([52, 9, 3]);
    expect(rows.map(r => r.index)).toEqual([4, 2, 1]);
    expect(liveLogRows([])).toEqual([]);
  });
});

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('MatchDay — the Log view', () => {
  const realRandom = Math.random;
  beforeAll(() => {
    Math.random = mulberry32(20260925);
    useGameStore.getState().initGame('everton');
    for (let i = 0; i < 12; i++) {
      const cur = useGameStore.getState();
      const hasFixture = cur.fixtures.some(m => m.week === cur.week && !m.played
        && (m.homeClubId === cur.playerClubId || m.awayClubId === cur.playerClubId));
      if (hasFixture) break;
      void useGameStore.getState().advanceWeek();
    }
  });
  afterAll(() => { Math.random = realRandom; });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('shows the latest event at the top while the match runs', () => {
    vi.useFakeTimers();
    render(<MatchDay />);
    fireEvent.click(screen.getByRole('button', { name: /Kick Off/ }));
    // The Log is the default view; make sure of it.
    const logToggle = screen.queryByRole('button', { name: 'Log' });
    if (logToggle) fireEvent.click(logToggle);

    const minutes = () => {
      const region = screen.queryByLabelText('Match events');
      if (!region) return [];
      return Array.from(region.children).map(row => parseInt(row.firstElementChild?.textContent ?? '', 10));
    };
    for (let i = 0; i < 200 && minutes().length < 4; i++) {
      const cont = screen.queryByRole('button', { name: /Continue Match/ });
      if (cont) fireEvent.click(cont);
      const noSub = screen.queryByText('Continue without substitution');
      if (noSub) fireEvent.click(noSub);
      if (screen.queryByRole('button', { name: /Start 2nd Half/ })) break;
      act(() => { vi.advanceTimersByTime(3300); });
    }

    const shown = minutes();
    expect(shown.length).toBeGreaterThanOrEqual(4);
    expect(shown.every(Number.isFinite)).toBe(true);
    // Newest first: the list never goes forward in time as you read down.
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeLessThanOrEqual(shown[i - 1]);
    expect(shown[0]).toBe(Math.max(...shown));
    expect(shown[0]).toBeGreaterThan(shown[shown.length - 1]);
  });
});
