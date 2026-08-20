/**
 * MatchDay must know which competition it is showing.
 *
 * `useCurrentMatch` resolves tournament ties itself and hands them back as
 * `liveMatch` (with a `competition` label). MatchDay's own tie lookups were all
 * gated on `!liveMatch`, which that change silently switched off: on a cup week
 * every one of them returned null, so the Kick Off screen had no competition
 * badge, `isKnockoutTie` was false, and `evaluateHighStakes` was told a cup tie
 * was a league fixture — which is what decides whether the pre-match team talk
 * is offered at all.
 *
 * Visible in a reported save: "LEAGUE CUP · Week 16" on the Dashboard card, and
 * one tap later a Kick Off screen with no badge on it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import type { CupTie } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

import MatchDay from '@/pages/MatchDay';

const CLUB_ID = 'manchester-city';

/** Put a cup tie for the player on the current week, against a real opponent. */
function stageCupTie(competition: 'cup' | 'leagueCup'): string {
  const s = useGameStore.getState();
  const opponentId = (s.divisionClubs[s.playerDivision] || []).find(id => id !== CLUB_ID)!;
  const tie: CupTie = {
    id: `${competition}-test-tie`,
    round: 'R3' as CupTie['round'],
    homeClubId: CLUB_ID,
    awayClubId: opponentId,
    played: false,
    homeGoals: 0,
    awayGoals: 0,
    week: s.week,
  };
  if (competition === 'cup') {
    useGameStore.setState({ cup: { ...s.cup, ties: [tie] } });
  } else {
    useGameStore.setState({ leagueCup: { ...(s.leagueCup ?? { ties: [], currentRound: null, eliminated: false, winner: null }), ties: [tie] } as never });
  }
  return opponentId;
}

describe('MatchDay — competition context on a cup week', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('badges a Dynasty Cup tie', () => {
    stageCupTie('cup');
    render(<MatchDay />);
    expect(screen.getByText('Dynasty Cup')).toBeTruthy();
    expect(screen.getByText('Ready to Kick Off?')).toBeTruthy();
  });

  it('badges a League Cup tie', () => {
    stageCupTie('leagueCup');
    render(<MatchDay />);
    expect(screen.getByText('League Cup')).toBeTruthy();
  });

  it('leaves a plain league fixture unbadged', () => {
    // No tie staged — `useCurrentMatch` falls through to the league fixture.
    render(<MatchDay />);
    expect(screen.queryByText('Dynasty Cup')).toBeNull();
    expect(screen.queryByText('League Cup')).toBeNull();
  });
});
