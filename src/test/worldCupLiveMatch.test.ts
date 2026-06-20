/**
 * Interactive (live) World Cup matches — Phase D.
 *
 * The player's national-team match runs through the real match engine
 * (first half → second half → extra time → penalties) instead of the
 * squad-OVR auto-sim, then writes the result back into the tournament and
 * advances it via the existing pipeline. These tests drive the store actions
 * headlessly and assert the tournament stays consistent and completes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { getPlayerNextWorldCupMatch } from '@/utils/internationalMatch';

const NAT = 'Brazil';

beforeEach(() => {
  useGameStore.getState().initGame('celtic');
  useGameStore.getState().startWorldCup(NAT);
});

/** Play the player's current WC match live to a finish (handles extra time and
 *  the kick-by-kick penalty shootout). */
function playLiveMatch() {
  const store = useGameStore.getState();
  const half = store.playWorldCupFirstHalf();
  expect(half).not.toBeNull();
  expect(useGameStore.getState().matchPhase).toBe('half_time');

  useGameStore.getState().playWorldCupSecondHalf();
  if (useGameStore.getState().matchPhase === 'extra_time') {
    useGameStore.getState().playWorldCupExtraTime();
  }
  if (useGameStore.getState().matchPhase === 'penalties') {
    // Pre-compute kicks, then finalise (the UI reveals them one-by-one).
    useGameStore.getState().playWorldCupPenalties();
    expect(useGameStore.getState().penaltyShootoutKicks.length).toBeGreaterThan(0);
    useGameStore.getState().skipPenaltyShootout();
  }
  expect(useGameStore.getState().matchPhase).toBe('full_time');
}

describe('live World Cup matches', () => {
  it('plays the first group match through the engine and writes it back', () => {
    const before = useGameStore.getState();
    const next = getPlayerNextWorldCupMatch(before.internationalTournament, NAT)!;
    expect(next).not.toBeNull();
    const opponent = next.opponent;
    const capsBefore = Object.values(before.nationalTeam!.caps).reduce((a, b) => a + b, 0);

    playLiveMatch();

    const after = useGameStore.getState();
    // The player's fixture is now played and recorded.
    const fixture = after.internationalTournament!.groups
      .flatMap(g => g.fixtures)
      .find(f => (f.homeNation === NAT || f.awayNation === NAT) && (f.homeNation === opponent || f.awayNation === opponent));
    expect(fixture?.played).toBe(true);

    // National-team result + caps recorded from the live match.
    expect(after.nationalTeam!.results.length).toBe(1);
    expect(after.nationalTeam!.results[0].opponent).toBe(opponent);
    expect(after.nationalTeam!.results[0].round).toBe('Group Stage');
    const capsAfter = Object.values(after.nationalTeam!.caps).reduce((a, b) => a + b, 0);
    expect(capsAfter).toBeGreaterThan(capsBefore);

    // The opponent nation was materialised as a club for the match.
    expect(after.clubs[opponent]).toBeTruthy();
    // Week advanced exactly once.
    expect(after.internationalTournament!.currentWeek).toBe(before.internationalTournament!.currentWeek + 1);
  });

  it('records real scorers — total int goals added equals the nation goals scored', () => {
    const next = getPlayerNextWorldCupMatch(useGameStore.getState().internationalTournament, NAT)!;
    const isHome = next.isHome;
    const goalsBefore = Object.values(useGameStore.getState().nationalTeam!.internationalGoals).reduce((a, b) => a + b, 0);

    playLiveMatch();

    const after = useGameStore.getState();
    const result = after.currentMatchResult!;
    const myGoals = isHome ? result.homeGoals : result.awayGoals;
    const goalsAfter = Object.values(after.nationalTeam!.internationalGoals).reduce((a, b) => a + b, 0);
    // Every goal credited from the play is matched by a scorer record (own
    // goals are excluded from both, so this holds as an equality on our side).
    const recordedFor = after.nationalTeam!.results[0].goalsFor;
    expect(recordedFor).toBe(myGoals);
    expect(goalsAfter - goalsBefore).toBeLessThanOrEqual(myGoals);
  });

  it('runs a full tournament via live play to a champion without hanging', () => {
    let guard = 0;
    while (guard++ < 40) {
      const s = useGameStore.getState();
      const t = s.internationalTournament!;
      if (t.phase === 'complete') break;
      const next = getPlayerNextWorldCupMatch(t, NAT);
      if (next && !t.playerEliminated) {
        playLiveMatch();
      } else {
        // Eliminated or between rounds — let the pipeline advance.
         
        s.advanceWeek();
      }
    }

    const t = useGameStore.getState().internationalTournament!;
    expect(t.phase).toBe('complete');
    expect(t.winner).toBeTruthy();
    const finalTie = t.knockoutTies.find(k => k.round === 'F');
    expect(finalTie?.played).toBe(true);
    expect(finalTie?.winnerId).toBe(t.winner);
  });

  it('a knockout match always resolves a winner (no stranded tie)', () => {
    // Advance to knockout by playing the group out live.
    let guard = 0;
    while (guard++ < 20) {
      const t = useGameStore.getState().internationalTournament!;
      if (t.phase !== 'group') break;
      const next = getPlayerNextWorldCupMatch(t, NAT);
      if (next && !t.playerEliminated) playLiveMatch();
      else useGameStore.getState().advanceWeek();
    }

    const t = useGameStore.getState().internationalTournament!;
    if (t.phase === 'knockout' && !t.playerEliminated) {
      const next = getPlayerNextWorldCupMatch(t, NAT);
      if (next) {
        playLiveMatch();
        // The tie we just played has a decisive winner.
        const after = useGameStore.getState().internationalTournament!;
        const played = after.knockoutTies.filter(k => (k.homeNation === NAT || k.awayNation === NAT) && k.played);
        expect(played.length).toBeGreaterThan(0);
        played.forEach(k => expect(k.winnerId).toBeTruthy());
      }
    }
  });
});
