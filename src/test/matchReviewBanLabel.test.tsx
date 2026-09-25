/**
 * Match Review's red-card line says how many MATCHES the ban costs (S11).
 *
 * Bans run through the week of the club's n-th upcoming fixture, so
 * `suspendedUntilWeek` is that week + 1. The label computed
 * `suspendedUntilWeek - week` — calendar weeks — and a one-match red card with
 * the next fixture a week away read "2 match ban". It now reads the club's
 * calendar back (`playerBanMatchesRemaining`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { buildFixtureWeeksByClub, suspensionEndWeek } from '@/store/slices/orchestration/helpers';
import type { Match } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

import MatchReview from '@/pages/MatchReview';

const CLUB_ID = 'manchester-city';

beforeEach(() => { useGameStore.getState().initGame(CLUB_ID); });
afterEach(cleanup);

/** Review a played league match in which one of our players was sent off and
 *  banned for `banMatches` of the club's fixtures. */
function stageRedCard(banMatches: number): string {
  const s = useGameStore.getState();
  const fixture = s.fixtures.find(m => m.week >= 6 && (m.homeClubId === CLUB_ID || m.awayClubId === CLUB_ID))!;
  const victimId = s.clubs[CLUB_ID].lineup[0];
  const played: Match = {
    ...fixture, played: true, homeGoals: 1, awayGoals: 1,
    events: [{ minute: 55, type: 'red_card', playerId: victimId, clubId: CLUB_ID, description: 'Straight red' }],
  };
  const fixtures = s.fixtures.map(m => (m.id === fixture.id ? played : m));
  const calendar = buildFixtureWeeksByClub({ ...s, fixtures }, fixture.week, new Set([CLUB_ID]))[CLUB_ID];
  useGameStore.setState({
    week: fixture.week,
    fixtures,
    divisionFixtures: { ...s.divisionFixtures, [s.playerDivision]: fixtures },
    players: {
      ...s.players,
      [victimId]: { ...s.players[victimId], suspendedUntilWeek: suspensionEndWeek(fixture.week, banMatches, calendar) },
    },
    currentMatchResult: played,
    currentScreen: 'match-review',
  });
  return s.players[victimId].lastName;
}

describe('the red-card ban label', () => {
  it('a one-match ban reads 1, not the weeks until the player is free', () => {
    stageRedCard(1);
    render(<MemoryRouter><MatchReview /></MemoryRouter>);
    expect(screen.getByText(/1-match ban/)).toBeTruthy();
    expect(screen.queryByText(/2 match ban|2-match ban/)).toBeNull();
  });

  it('a two-match ban reads 2', () => {
    stageRedCard(2);
    render(<MemoryRouter><MatchReview /></MemoryRouter>);
    expect(screen.getByText(/2-match ban/)).toBeTruthy();
  });
});
