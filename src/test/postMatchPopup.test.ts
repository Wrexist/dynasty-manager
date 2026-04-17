/**
 * Post-match UI regression tests.
 *
 * Covers the bugs around `lastMatchCompetition` and cup badge resolution
 * that caused friendly and cup matches to render with stale league data.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { getCompetitionInfo } from '@/utils/competitionBadge';
import type { Match } from '@/types/game';

const CLUB_ID = 'manchester-city';

function initGame() {
  useGameStore.getState().initGame(CLUB_ID);
}

describe('getCompetitionInfo — badge resolution', () => {
  it('strips " — <round>" suffix for cup matches', () => {
    expect(getCompetitionInfo('Dynasty Cup — QF').name).toBe('Dynasty Cup');
    expect(getCompetitionInfo('Dynasty Cup — F').name).toBe('Dynasty Cup');
    expect(getCompetitionInfo('League Cup — R2').name).toBe('League Cup');
    expect(getCompetitionInfo('Champions Cup — SF').name).toBe('Champions Cup');
  });

  it('handles clean competition names', () => {
    expect(getCompetitionInfo('Pre-Season Friendly').name).toBe('Friendly');
    expect(getCompetitionInfo('Super Cup').name).toBe('Super Cup');
    expect(getCompetitionInfo('Continental Super Cup').name).toBe('Continental Super Cup');
  });

  it('falls back to league for unknown / undefined', () => {
    expect(getCompetitionInfo(undefined).name).toBe('League');
    expect(getCompetitionInfo('Something Unknown').name).toBe('League');
    expect(getCompetitionInfo(undefined, { leagueName: 'Monarch Premier League' }).name).toBe('Monarch Premier League');
  });
});

describe('clearMatchResult', () => {
  beforeEach(initGame);

  it('nulls ancillary post-match state so the next popup cannot render stale values', () => {
    useGameStore.setState({
      lastMatchCompetition: 'Dynasty Cup — QF',
      lastMatchXPGain: 42,
      matchPlayerRatings: [{ playerId: 'p1', rating: 8.2 }],
      preMatchLeaguePosition: 5,
    });

    useGameStore.getState().clearMatchResult();

    const state = useGameStore.getState();
    expect(state.currentMatchResult).toBeNull();
    expect(state.lastMatchCompetition).toBeNull();
    expect(state.lastMatchXPGain).toBe(0);
    expect(state.matchPlayerRatings).toEqual([]);
    expect(state.preMatchLeaguePosition).toBe(10);
  });
});

describe('loadMatchForReview — sets lastMatchCompetition per source', () => {
  beforeEach(initGame);

  it('tags a historical friendly as "Pre-Season Friendly"', () => {
    const state = useGameStore.getState();
    const friendly: Match = {
      id: 'f-1', week: 1,
      homeClubId: CLUB_ID, awayClubId: 'arsenal',
      played: true, homeGoals: 3, awayGoals: 2, events: [],
    };
    // Seed a bogus competition so we can prove it gets overwritten.
    useGameStore.setState({ friendlies: [friendly], lastMatchCompetition: 'Dynasty Cup — QF' });

    state.loadMatchForReview(1);

    const post = useGameStore.getState();
    expect(post.currentMatchResult?.id).toBe('f-1');
    expect(post.lastMatchCompetition).toBe('Pre-Season Friendly');
  });

  it('clears lastMatchCompetition for a historical league fixture', () => {
    const state = useGameStore.getState();
    const fixture = state.fixtures.find(
      m => m.homeClubId === CLUB_ID || m.awayClubId === CLUB_ID
    );
    expect(fixture).toBeDefined();
    // Force the fixture to be "played" so loadMatchForReview picks it up.
    useGameStore.setState({
      fixtures: state.fixtures.map(m =>
        m.id === fixture!.id ? { ...m, played: true, homeGoals: 1, awayGoals: 0 } : m
      ),
      lastMatchCompetition: 'Dynasty Cup — QF',
    });

    state.loadMatchForReview(fixture!.week);

    const post = useGameStore.getState();
    expect(post.currentMatchResult?.id).toBe(fixture!.id);
    expect(post.lastMatchCompetition).toBeNull();
  });
});
