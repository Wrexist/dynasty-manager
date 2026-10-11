/**
 * A cup tie level after 120 minutes is decided by its shootout, and the
 * post-match card has to say so: a 1-1, 5-4 on penalties win rendered as an
 * amber "Draw" (and a shootout exit was not a loss).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { PostMatchPopup } from '@/components/game/PostMatchPopup';
import type { Match } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

const CLUB = 'manchester-city';

function stageResult(pens: { home: number; away: number } | undefined) {
  const s = useGameStore.getState();
  const opp = (s.divisionClubs[s.playerDivision] || []).find(id => id !== CLUB)!;
  const result = { id: 'cup-x', week: s.week, homeClubId: CLUB, awayClubId: opp, played: true, homeGoals: 1, awayGoals: 1, events: [], penaltyShootout: pens } as Match;
  useGameStore.setState({ currentMatchResult: result, lastMatchCompetition: 'Dynasty Cup — QF' });
}

describe('post-match card after a shootout', () => {
  beforeEach(() => { useGameStore.getState().initGame(CLUB); });

  it('a shootout win is a win', () => {
    stageResult({ home: 5, away: 4 });
    render(<PostMatchPopup onContinue={() => {}} />);
    expect(screen.getByText('Won on penalties')).toBeTruthy();
    expect(screen.getByText('5 - 4 pens')).toBeTruthy();
  });

  it('a shootout exit is a loss', () => {
    stageResult({ home: 3, away: 4 });
    render(<PostMatchPopup onContinue={() => {}} />);
    expect(screen.getByText('Lost on penalties')).toBeTruthy();
  });

  it('a level league match is still a draw', () => {
    stageResult(undefined);
    render(<PostMatchPopup onContinue={() => {}} />);
    expect(screen.getByText('Draw')).toBeTruthy();
  });
});
