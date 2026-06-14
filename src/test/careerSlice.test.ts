/**
 * careerSlice — guard behaviour outside Manager Career mode. A sandbox game has
 * no careerManager, and every career action must safely no-op / report rather
 * than mutate or throw, so the two modes can't corrupt each other.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const CLUB_ID = 'celtic';

beforeEach(() => {
  // initGame(clubId) starts a sandbox game — careerManager is null.
  useGameStore.getState().initGame(CLUB_ID);
});

describe('careerSlice — guards outside career mode', () => {
  it('sandbox game has no career manager', () => {
    expect(useGameStore.getState().careerManager).toBeFalsy();
  });

  it('applyForJob reports "not in career mode" and changes nothing', () => {
    const res = useGameStore.getState().applyForJob('any-vacancy');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/career mode/i);
    expect(useGameStore.getState().careerManager).toBeFalsy();
  });

  it('respondToJobOffer reports no active career', () => {
    const res = useGameStore.getState().respondToJobOffer('any-offer', true);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/no active career/i);
  });

  it('resignFromClub and retireManager are safe no-ops in sandbox', () => {
    expect(() => useGameStore.getState().resignFromClub()).not.toThrow();
    expect(() => useGameStore.getState().retireManager()).not.toThrow();
    expect(useGameStore.getState().careerManager).toBeFalsy();
    // The sandbox game is untouched — still started and on its club.
    expect(useGameStore.getState().gameStarted).toBe(true);
    expect(useGameStore.getState().playerClubId).toBe(CLUB_ID);
  });
});
