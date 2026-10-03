/**
 * Match record integrity around full time and extra time (engine audit).
 *
 * - finalizeMatch pushed its Full Time event INTO the carried state; a level cup
 *   tie carries that state into extra time, so the record ended with both a 90'
 *   and a 120' "Full Time".
 * - Subs made at the extra-time break were written only to the 90' result, and
 *   extra time is simulated from `halfTimeState`, so they vanished; and the sub
 *   count was reset to 0, giving the user ten in all.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { simulateHalf, finalizeMatch } from '@/engine/match';
import { useGameStore } from '@/store/gameStore';
import type { Match } from '@/types/game';

const CLUB = 'arsenal';

describe('finalizeMatch leaves the carried state alone', () => {
  beforeEach(() => { useGameStore.getState().resetGame(); useGameStore.getState().initGame(CLUB); });

  it('adds Full Time to the result, not to the state it was given', () => {
    const s = useGameStore.getState();
    const m = s.fixtures.find(f => f.week === s.week && (f.homeClubId === CLUB || f.awayClubId === CLUB))!;
    const hc = s.clubs[m.homeClubId], ac = s.clubs[m.awayClubId];
    const hp = hc.lineup.map(id => s.players[id]).filter(Boolean);
    const ap = ac.lineup.map(id => s.players[id]).filter(Boolean);
    const first = simulateHalf(hc, ac, hp, ap, 1, 45);
    const full = simulateHalf(hc, ac, hp, ap, 46, 90, undefined, undefined, undefined, undefined, first);
    const before = full.events.length;
    const { result } = finalizeMatch(m as Match, hc, ac, hp, ap, full, s.players);
    expect(full.events.length).toBe(before);
    expect(result.events.filter(e => e.type === 'full_time')).toHaveLength(1);
  });
});

describe('substitutions at the extra-time break', () => {
  beforeEach(() => { useGameStore.getState().resetGame(); useGameStore.getState().initGame(CLUB); });

  it('reach the state extra time is simulated from, and keep counting toward the limit', { timeout: 60_000 }, () => {
    const st = useGameStore.getState;
    const half = st().playFirstHalf(45)!;
    expect(half).toBeTruthy();
    // Stand in for "90 minutes played, level, into extra time with 3 subs used".
    useGameStore.setState({
      matchPhase: 'extra_time',
      matchSubsUsed: 3,
      currentMatchResult: { id: 'x', week: st().week, homeClubId: CLUB, awayClubId: 'x', played: true, homeGoals: 1, awayGoals: 1, events: [...half.events] } as Match,
    });
    const club = st().clubs[CLUB];
    const outId = club.lineup.find(id => st().players[id]?.position !== 'GK')!;
    const inId = club.subs.find(id => !st().players[id]?.injured)!;
    expect(st().makeMatchSub(outId, inId, 90).success).toBe(true);
    expect(st().halfTimeState!.events.some(e => e.type === 'substitution' && e.playerId === inId)).toBe(true);
    expect(st().matchSubsUsed).toBe(4);
  });
});
