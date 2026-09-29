/**
 * The live MatchDay layout puts the match first.
 *
 * At 390x844 the pitch used to start 482px down, below the full score panel,
 * the momentum bar, the mentality strip, pause/speed and the shouts — about
 * 300px of a 548px pitch showed above the bottom nav, so "watching the match"
 * meant scrolling past the controls. Now the view toggle and the pitch sit
 * directly under a one-row scoreboard, and the controls follow.
 *
 * The default view is still Log (locked product decision), so a player who
 * has never picked a view gets a discovery dot on the Pitch tab until they do.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { ScoreHeader } from '@/components/matchday/ScoreHeader';
import { STORAGE_KEYS } from '@/store/helpers/persistence';
import type { Club } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

import MatchDay from '@/pages/MatchDay';

const CLUB_ID = 'manchester-city';

const byLabel = (name: RegExp) => screen.getByRole('button', { name });
const precedes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

async function kickOff() {
  render(<MatchDay />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /kick off/i })); });
}

describe('MatchDay live layout', () => {
  beforeEach(() => {
     
    localStorage.removeItem(STORAGE_KEYS.MATCH_VIEW_MODE);
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('puts the view toggle above the live controls', async () => {
    await kickOff();
    const toggle = screen.getByRole('button', { name: /^pitch/i });
    expect(precedes(toggle, byLabel(/pause match/i))).toBe(true);
    expect(precedes(toggle, byLabel(/set mentality to balanced/i))).toBe(true);
  });

  it('marks the Pitch tab until a view has been picked, then never again', async () => {
    await kickOff();
    expect(screen.getByRole('button', { name: /watch the match live on the pitch/i })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^log$/i })); });
    expect(screen.queryByRole('button', { name: /watch the match live on the pitch/i })).toBeNull();
     
    expect(localStorage.getItem(STORAGE_KEYS.MATCH_VIEW_MODE)).toBe('commentary');
  });

  it('shows no discovery dot to a player who already chose a view', async () => {
     
    localStorage.setItem(STORAGE_KEYS.MATCH_VIEW_MODE, 'commentary');
    await kickOff();
    expect(screen.queryByRole('button', { name: /watch the match live on the pitch/i })).toBeNull();
  });
});

describe('ScoreHeader compact', () => {
  const club = (id: string, shortName: string): Club => ({ id, name: shortName, shortName, color: '#123456', secondaryColor: '#ffffff' } as Club);
  const props = {
    phase: 'second_half', week: 3, currentMin: 67, isLive: true, isCupMatch: false,
    homeClub: club('h', 'HOM'), awayClub: club('a', 'AWY'),
    homeGoals: 2, awayGoals: 1, htHomeGoals: 1, htAwayGoals: 1,
    homeYellowCards: 1, homeRedCards: 0, awayYellowCards: 0, awayRedCards: 1,
    homePlayersOnPitch: 11, awayPlayersOnPitch: 10,
    liveHomeXG: 1.42, liveAwayXG: 0.38, goalFlash: false,
  };

  it('keeps the score, clock, xG and a reduced side in one row', () => {
    render(<ScoreHeader {...props} compact />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('2-1');
    expect(status.textContent).toContain("67'");
    expect(screen.getByLabelText('HOM expected goals 1.42')).toBeTruthy();
    expect(screen.getByLabelText('AWY expected goals 0.38')).toBeTruthy();
    // The away side is down to ten: its red-card chip shows the head count.
    expect(screen.getByText('10')).toBeTruthy();
  });
});
