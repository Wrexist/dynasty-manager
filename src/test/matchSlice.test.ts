/**
 * matchSlice — in-match actions. Focused on the substitution rules
 * (makeMatchSub: 7 validation branches + the live/half-time event routing),
 * the shout cooldown/limit windows, and clearMatchResult's reset.
 *
 * Setup note: initGame(CLUB_ID) gives a real club with a valid 11-man lineup
 * and a populated bench, plus real Player records — we drive the exact
 * preconditions for each branch via targeted setState patches so the tests are
 * deterministic rather than dependent on the random squad.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';
import { MAX_SUBSTITUTIONS, MAX_SHOUTS_PER_MATCH, SHOUT_COOLDOWN, SHOUT_DURATION } from '@/config/matchEngine';

const CLUB_ID = 'celtic';

function club() {
  const s = useGameStore.getState();
  return s.clubs[s.playerClubId];
}
function patchPlayer(id: string, patch: Record<string, unknown>) {
  const s = useGameStore.getState();
  useGameStore.setState({ players: { ...s.players, [id]: { ...s.players[id], ...patch } } });
}
/** Put a minimal in-progress match on state so sub events have somewhere to go. */
function setLiveMatch() {
  const c = club();
  useGameStore.setState({
    currentMatchResult: {
      id: 'live', week: 1, homeClubId: c.id, awayClubId: 'opp',
      played: false, homeGoals: 0, awayGoals: 0, events: [],
    },
    halfTimeState: null,
  });
}

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('matchSlice — makeMatchSub (happy path)', () => {
  it('swaps lineup↔bench, tracks the sub, and records the event in the live match', () => {
    const c = club();
    const outId = c.lineup[0];
    const inId = c.subs[0];
    patchPlayer(inId, { injured: false, suspendedUntilWeek: undefined });
    setLiveMatch();

    const res = useGameStore.getState().makeMatchSub(outId, inId, 60);
    expect(res.success).toBe(true);

    const s = useGameStore.getState();
    const after = s.clubs[s.playerClubId];
    expect(after.lineup).toContain(inId);
    expect(after.lineup).not.toContain(outId);
    expect(after.subs).toContain(outId);
    expect(after.subs).not.toContain(inId);
    expect(s.matchSubsUsed).toBe(1);
    expect(s.matchSubbedOffIds).toContain(outId);

    const events = s.currentMatchResult!.events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'substitution', playerId: inId, assistPlayerId: outId, minute: 60 });
  });

  it('routes the sub event into halfTimeState when there is no live match', () => {
    const c = club();
    const outId = c.lineup[0];
    const inId = c.subs[0];
    patchPlayer(inId, { injured: false, suspendedUntilWeek: undefined });
    useGameStore.setState({
      currentMatchResult: null,
      halfTimeState: { events: [] } as GameState['halfTimeState'],
    });

    const res = useGameStore.getState().makeMatchSub(outId, inId, 45);
    expect(res.success).toBe(true);

    const s = useGameStore.getState();
    expect(s.currentMatchResult).toBeNull();
    expect(s.halfTimeState!.events).toHaveLength(1);
    expect(s.halfTimeState!.events[0]).toMatchObject({ type: 'substitution', playerId: inId, assistPlayerId: outId });
  });
});

describe('matchSlice — makeMatchSub (rejections)', () => {
  it('rejects once the substitution limit is reached', () => {
    const c = club();
    patchPlayer(c.subs[0], { injured: false, suspendedUntilWeek: undefined });
    useGameStore.setState({ matchSubsUsed: MAX_SUBSTITUTIONS });
    const res = useGameStore.getState().makeMatchSub(c.lineup[0], c.subs[0]);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/no substitutions remaining/i);
  });

  it('rejects an out-player not in the lineup', () => {
    const c = club();
    const res = useGameStore.getState().makeMatchSub('not-in-lineup', c.subs[0]);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/no longer in the lineup/i);
  });

  it('rejects an in-player not on the bench', () => {
    const c = club();
    const res = useGameStore.getState().makeMatchSub(c.lineup[0], 'not-on-bench');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not on the bench/i);
  });

  it('rejects re-entry of a player already substituted off', () => {
    const c = club();
    const inId = c.subs[0];
    patchPlayer(inId, { injured: false, suspendedUntilWeek: undefined });
    useGameStore.setState({ matchSubbedOffIds: [inId] });
    const res = useGameStore.getState().makeMatchSub(c.lineup[0], inId);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cannot re-enter/i);
  });

  it('rejects an injured incoming player', () => {
    const c = club();
    const inId = c.subs[0];
    patchPlayer(inId, { injured: true, suspendedUntilWeek: undefined });
    const res = useGameStore.getState().makeMatchSub(c.lineup[0], inId);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/injured/i);
  });

  it('rejects a suspended incoming player', () => {
    const c = club();
    const inId = c.subs[0];
    // week is 1 after initGame; a suspension that outlasts the current week blocks entry.
    patchPlayer(inId, { injured: false, suspendedUntilWeek: useGameStore.getState().week + 1 });
    const res = useGameStore.getState().makeMatchSub(c.lineup[0], inId);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/suspended/i);
  });
});

describe('matchSlice — shouts', () => {
  it('records a shout and reports success', () => {
    expect(useGameStore.getState().useShout('push_forward', 10)).toBe(true);
    expect(useGameStore.getState().matchShouts).toHaveLength(1);
  });

  it('blocks a second shout inside the cooldown but allows it after', () => {
    useGameStore.getState().useShout('push_forward', 10);
    // 15 - 10 = 5 < SHOUT_COOLDOWN (10): blocked.
    expect(useGameStore.getState().useShout('hold_the_line', 10 + SHOUT_COOLDOWN - 1)).toBe(false);
    // exactly SHOUT_COOLDOWN later: allowed.
    expect(useGameStore.getState().useShout('hold_the_line', 10 + SHOUT_COOLDOWN)).toBe(true);
  });

  it('blocks shouts once the per-match limit is reached', () => {
    const shouts = Array.from({ length: MAX_SHOUTS_PER_MATCH }, (_, i) => ({ type: 'push_forward' as const, startMinute: i }));
    useGameStore.setState({ matchShouts: shouts });
    expect(useGameStore.getState().useShout('push_forward', 80)).toBe(false);
  });

  it('getActiveShout returns the shout only inside its duration window', () => {
    useGameStore.setState({ matchShouts: [{ type: 'push_forward', startMinute: 30 }] });
    expect(useGameStore.getState().getActiveShout(30)?.type).toBe('push_forward');
    expect(useGameStore.getState().getActiveShout(30 + SHOUT_DURATION - 1)?.type).toBe('push_forward');
    expect(useGameStore.getState().getActiveShout(30 + SHOUT_DURATION)).toBeNull();
    expect(useGameStore.getState().getActiveShout(29)).toBeNull();
  });
});

describe('matchSlice — clearMatchResult', () => {
  it('resets all match-scoped transient state', () => {
    useGameStore.setState({
      currentMatchResult: { id: 'x', week: 1, homeClubId: 'a', awayClubId: 'b', played: true, homeGoals: 1, awayGoals: 0, events: [] },
      matchPhase: 'first_half',
      matchShouts: [{ type: 'push_forward', startMinute: 5 }],
      matchSubbedOffIds: ['p1'],
      matchTeamTalk: 'demand',
      penaltyShootoutKicks: [{} as never],
    });

    useGameStore.getState().clearMatchResult();

    const s = useGameStore.getState();
    expect(s.currentMatchResult).toBeNull();
    expect(s.matchPhase).toBe('none');
    expect(s.matchShouts).toEqual([]);
    expect(s.matchSubbedOffIds).toEqual([]);
    expect(s.matchTeamTalk).toBe('none');
    expect(s.penaltyShootoutKicks).toEqual([]);
  });
});
