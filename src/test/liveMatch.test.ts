/**
 * The interactive second half must be RESUMABLE, so a substitution, a touchline
 * shout or a key-moment choice made during playback affects the minutes that
 * follow. It used to simulate 46->90 in a single call while MatchDay merely
 * revealed a pre-computed event array on a timer — so after minute 45 a sub
 * changed the lineup and fabricated an event but could not alter one subsequent
 * minute, a shout did nothing at all, and the marquee key-moment overlay was
 * cosmetic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { SECOND_HALF_SEGMENTS } from '@/config/matchEngine';

function advanceToPlayerMatch(): boolean {
  for (let i = 0; i < 12; i++) {
    const st = useGameStore.getState();
    const fixture = st.fixtures.find(
      m => m.week === st.week && !m.played && (m.homeClubId === st.playerClubId || m.awayClubId === st.playerClubId),
    );
    if (fixture) return true;
    void useGameStore.getState().advanceWeek();
  }
  return false;
}

describe('interactive second half is segmented', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('everton');
  });

  it('stops at the first boundary instead of simulating to full time', () => {
    expect(advanceToPlayerMatch()).toBe(true);
    expect(useGameStore.getState().playFirstHalf()).toBeTruthy();
    expect(useGameStore.getState().matchPhase).toBe('half_time');
    expect(useGameStore.getState().secondHalfSimulatedTo).toBe(45);

    const firstBoundary = SECOND_HALF_SEGMENTS[0];
    const partial = useGameStore.getState().playSecondHalf(firstBoundary);
    expect(partial).toBeTruthy();

    const st = useGameStore.getState();
    // Not finalised: still in the half, fixture unplayed, no ratings yet.
    expect(st.matchPhase).toBe('second_half');
    expect(st.secondHalfSimulatedTo).toBe(firstBoundary);
    expect(partial!.played).toBe(false);
    // And crucially it did NOT run to full time.
    const maxMinute = Math.max(...partial!.events.map(e => e.minute));
    expect(maxMinute).toBeLessThanOrEqual(firstBoundary);
  });

  it('resumes across every boundary and finalises exactly once at 90', () => {
    expect(advanceToPlayerMatch()).toBe(true);
    useGameStore.getState().playFirstHalf();

    for (const boundary of SECOND_HALF_SEGMENTS) {
      expect(useGameStore.getState().playSecondHalf(boundary)).toBeTruthy();
    }

    const st = useGameStore.getState();
    // The final segment finalises: the fixture is played and ratings exist.
    expect(st.matchPhase === 'full_time' || st.matchPhase === 'extra_time' || st.matchPhase === 'penalties').toBe(true);
    expect(st.matchPlayerRatings.length).toBeGreaterThan(0);
  });

  it('the whole-half call still works unchanged for non-segmented callers', () => {
    expect(advanceToPlayerMatch()).toBe(true);
    useGameStore.getState().playFirstHalf();
    const result = useGameStore.getState().playSecondHalf();
    expect(result).toBeTruthy();
    expect(useGameStore.getState().matchPlayerRatings.length).toBeGreaterThan(0);
  });
});
