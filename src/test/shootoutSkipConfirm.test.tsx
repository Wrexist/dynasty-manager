/**
 * The shootout's Skip resolves every remaining kick at once and sits beside the
 * aim area; one stray tap used to throw the shootout away. It now needs a
 * confirming second tap, and disarms itself if none comes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { PenaltyShootout } from '@/components/game/PenaltyShootout';
import type { Match } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

const CLUB = 'manchester-city';

describe('shootout Skip needs confirming', () => {
  let skip: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().initGame(CLUB);
    const s = useGameStore.getState();
    const opp = (s.divisionClubs[s.playerDivision] || []).find(id => id !== CLUB)!;
    skip = vi.fn();
    useGameStore.setState({
      currentMatchResult: { id: 'cup-x', week: s.week, homeClubId: CLUB, awayClubId: opp, played: true, homeGoals: 1, awayGoals: 1, events: [] } as Match,
      penaltyShootoutKicks: [],
      penaltyShootoutCtx: { playerIsHome: true, homeGKId: null, awayGKId: null, homeGKQuality: 60, awayGKQuality: 60, usedTakerIds: [] } as never,
      skipPenaltyShootout: skip,
    } as never);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('one tap arms it, the second skips', () => {
    render(<PenaltyShootout />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip the shootout' }));
    expect(skip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm: skip the rest/ }));
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('disarms if the confirming tap never comes', () => {
    render(<PenaltyShootout />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip the shootout' }));
    act(() => { vi.advanceTimersByTime(3500); });
    fireEvent.click(screen.getByRole('button', { name: 'Skip the shootout' }));
    expect(skip).not.toHaveBeenCalled();
  });
});
