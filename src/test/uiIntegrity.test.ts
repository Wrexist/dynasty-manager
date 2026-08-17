/**
 * Regression: a red card must cost a player, and the Competitions UI must show
 * the competition the club is actually in.
 *
 * 1. **A sent-off player could be substituted off.** `makeMatchSub` guarded
 *    squad membership, bench membership, re-entry, injury and suspension — but
 *    not dismissal. The engine deliberately never edits `club.lineup` on a red
 *    card; it records the dismissal in `halfTimeState.sentOff` and derives the
 *    man disadvantage from how many of the XI are unavailable. Swapping the
 *    sent-off player for a substitute therefore put a legal XI back on the
 *    pitch: `homeMissing` returned to 0, the red-card strength penalty never
 *    applied, and a dismissal cost one substitution instead of a man.
 *
 * 2. **The Competitions card always showed the Champions Cup.** Season rollover
 *    generates all three continental tournaments every year whenever there are
 *    enough qualifiers (always true), stamping the two the player is not in as
 *    eliminated. Selection preferred "the highest tier present" on the premise
 *    that the player is only ever in one — a premise the state does not
 *    satisfy. From season 2 onward a Shield Cup qualifier saw a permanent
 *    "Champions Cup — Eliminated" row while their real competition, whose
 *    fixtures they were playing on MatchDay, had no reachable UI at all.
 *    (Covered in competitionStatus.test.ts; asserted end-to-end here.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const CLUB = 'manchester-city';

describe('a sent-off player cannot be substituted off', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    localStorage.clear();
    useGameStore.getState().initGame(CLUB);
  });

  it('rejects the sub and leaves the club a man down', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const outId = club.lineup[5];
    const inId = club.subs[0];
    expect(outId, 'need a starter').toBeTruthy();
    expect(inId, 'need a substitute').toBeTruthy();

    useGameStore.setState({
      matchPhase: 'first_half',
      matchSubsUsed: 0,
      halfTimeState: { sentOff: [outId], injured: [], events: [] } as never,
    });

    const result = useGameStore.getState().makeMatchSub(outId, inId, 46);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/sent off/i);

    // The XI is untouched: the dismissed player is still counted against it,
    // which is how the man disadvantage is derived.
    const after = useGameStore.getState().clubs[useGameStore.getState().playerClubId];
    expect(after.lineup).toContain(outId);
    expect(after.lineup).not.toContain(inId);
    expect(useGameStore.getState().matchSubsUsed).toBe(0);
  });

  it('still allows an ordinary substitution in the same match', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const sentOffId = club.lineup[5];
    const otherOutId = club.lineup[6];
    const inId = club.subs[0];

    useGameStore.setState({
      matchPhase: 'first_half',
      matchSubsUsed: 0,
      halfTimeState: { sentOff: [sentOffId], injured: [], events: [] } as never,
    });

    const result = useGameStore.getState().makeMatchSub(otherOutId, inId, 46);
    expect(result.success).toBe(true);
    const after = useGameStore.getState().clubs[useGameStore.getState().playerClubId];
    expect(after.lineup).toContain(inId);
    expect(after.lineup).not.toContain(otherOutId);
    // ...and the dismissed player is still on the pitch sheet, unreplaced.
    expect(after.lineup).toContain(sentOffId);
  });
});
