/**
 * Match Review's two exits are explicit and consistent.
 *
 * Back / swipe / hardware back leave WITHOUT advancing (store `goBack`); the
 * primary button is the only exit that advances the week, and it used to say
 * just "Continue". It now says "Advance to Next Week" when that is what it
 * does. Its label and its handler also used to decide "another match this
 * week" separately — the label counted friendlies, the handler did not — so a
 * button reading "Next Match This Week" could advance past an unplayed
 * friendly. Both now read `resolveMatchReviewExit`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import type { Match } from '@/types/game';
import { resolveMatchReviewExit } from '@/utils/matchReviewExit';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));

import MatchReview from '@/pages/MatchReview';

const CLUB_ID = 'manchester-city';

/**
 * A quiet league week: the player's fixture this week is the reviewed match
 * (played), with no friendly or tournament tie scheduled alongside it.
 */
function stageQuietWeek(): Match {
  const s = useGameStore.getState();
  const fixture = s.fixtures.find(m =>
    m.week >= 6 && (m.homeClubId === CLUB_ID || m.awayClubId === CLUB_ID))!;
  const played: Match = { ...fixture, played: true, homeGoals: 2, awayGoals: 1, events: [] };
  useGameStore.setState({
    week: fixture.week,
    fixtures: s.fixtures.map(m => (m.id === fixture.id ? played : m)),
    friendlies: [],
    cup: { ...s.cup, ties: [] },
    leagueCup: null,
    championsCup: null,
    shieldCup: null,
    conferenceCup: null,
    domesticSuperCup: null,
    continentalSuperCup: null,
    currentMatchResult: played,
    currentScreen: 'match-review',
    previousScreen: 'match',
    previousScreenFor: 'match-review',
  });
  return played;
}

/** Schedule an unplayed friendly for the player in the reviewed week. */
function addFriendlyThisWeek(played: Match) {
  const s = useGameStore.getState();
  const oppId = played.homeClubId === CLUB_ID ? played.awayClubId : played.homeClubId;
  const friendly = {
    ...played, id: 'friendly-same-week', played: false, homeGoals: 0, awayGoals: 0,
    homeClubId: CLUB_ID, awayClubId: oppId,
  } as Match;
  useGameStore.setState({ friendlies: [...(s.friendlies ?? []), friendly] });
}

let advanceWeek: ReturnType<typeof vi.fn>;
beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
  advanceWeek = vi.fn(async () => {});
  useGameStore.setState({ advanceWeek: advanceWeek as never });
});
afterEach(cleanup);

const renderReview = () => render(<MemoryRouter><MatchReview /></MemoryRouter>);

describe('resolveMatchReviewExit', () => {
  it('advances when nothing else is left to play this week', () => {
    const played = stageQuietWeek();
    expect(resolveMatchReviewExit(useGameStore.getState(), played)).toBe('advance');
  });

  it('returns for a same-week friendly — the case the handler used to skip', () => {
    const played = stageQuietWeek();
    addFriendlyThisWeek(played);
    expect(resolveMatchReviewExit(useGameStore.getState(), played)).toBe('next-match');
  });

  it('never advances from a past week', () => {
    const played = stageQuietWeek();
    useGameStore.setState({ week: played.week + 1 });
    expect(resolveMatchReviewExit(useGameStore.getState(), played)).toBe('dashboard');
  });

  it('ignores the reviewed match itself', () => {
    const played = stageQuietWeek();
    const unplayedCopy = { ...played, played: false };
    useGameStore.setState(s => ({ fixtures: s.fixtures.map(m => (m.id === played.id ? unplayedCopy : m)) }));
    expect(resolveMatchReviewExit(useGameStore.getState(), played)).toBe('advance');
  });
});

describe('MatchReview exits', () => {
  it('labels the advancing exit as advancing, and it advances', async () => {
    stageQuietWeek();
    renderReview();
    fireEvent.click(screen.getByRole('button', { name: 'Advance to Next Week' }));
    await waitFor(() => expect(useGameStore.getState().currentScreen).toBe('dashboard'));
    expect(advanceWeek).toHaveBeenCalledTimes(1);
  });

  it('with a friendly left this week, says so and does not advance', async () => {
    const played = stageQuietWeek();
    addFriendlyThisWeek(played);
    renderReview();
    expect(screen.queryByRole('button', { name: 'Advance to Next Week' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next Match This Week' }));
    await waitFor(() => expect(useGameStore.getState().currentScreen).toBe('dashboard'));
    expect(advanceWeek).not.toHaveBeenCalled();
  });

  it('Back leaves the review without advancing', () => {
    stageQuietWeek();
    const weekBefore = useGameStore.getState().week;
    useGameStore.getState().goBack();
    const s = useGameStore.getState();
    expect(s.currentScreen).toBe('dashboard');
    expect(s.week).toBe(weekBefore);
    expect(advanceWeek).not.toHaveBeenCalled();
  });
});
