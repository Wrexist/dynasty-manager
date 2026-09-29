/**
 * A decision made during live play shapes the minutes that follow it.
 *
 * The first half was simulated in one call at kickoff and the second half in
 * [60, 75, 90] chunks, so a substitution at 20' changed nothing before 46'
 * (the subbed-off player could still score at 40'), and everything decided
 * after 75' — including the 80' "Waste" shout — was theatre. Both halves are
 * now simulated minute by minute as the clock reaches them.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { computeShoutMods } from '@/store/slices/orchestration/matchActions';
import { SHOUT_DURATION, SHOUT_MODIFIERS } from '@/config/matchEngine';

const CLUB = 'arsenal';

describe('live decisions take effect from the next minute', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });

  it('a player subbed off at 20\' takes no part in minutes 21-45', { timeout: 60_000 }, () => {
    const st = useGameStore.getState;
    expect(st().playFirstHalf(1)).toBeTruthy();
    expect(st().matchPhase).toBe('first_half');
    for (let m = 2; m <= 20; m++) expect(st().playFirstHalf(m)).toBeTruthy();

    const club = st().clubs[CLUB];
    const outId = club.lineup.find(id => st().players[id]?.position !== 'GK')!;
    const inId = club.subs.find(id => !st().players[id]?.injured)!;
    expect(st().makeMatchSub(outId, inId, 20).success).toBe(true);

    let half = null;
    for (let m = 21; m <= 45; m++) half = st().playFirstHalf(m);
    expect(half).toBeTruthy();
    expect(st().matchPhase).toBe('half_time');
    const late = half!.events.filter(e => e.minute > 20 && (e.playerId === outId || e.assistPlayerId === outId) && e.type !== 'substitution');
    expect(late).toEqual([]);
  });

  it('the first half played in segments is a complete half: kickoff, stoppage, half-time', { timeout: 60_000 }, () => {
    const st = useGameStore.getState;
    let half = null;
    for (let m = 1; m <= 45; m++) half = st().playFirstHalf(m);
    expect(half!.events.filter(e => e.type === 'kickoff')).toHaveLength(1);
    expect(st().matchPhase).toBe('half_time');
    expect(st().firstHalfSimulatedTo).toBe(45);
    // The second half resumes from it as before.
    const second = st().playSecondHalf(90);
    expect(second).toBeTruthy();
    expect(second!.events.filter(e => e.type === 'kickoff' && e.minute === 0)).toHaveLength(1);
  });
});

describe('touchline shouts act over their own five minutes', () => {
  const push = SHOUT_MODIFIERS.push_forward;
  it('covers the SHOUT_DURATION minutes after the call, pro rata per stretch', () => {
    const shout = [{ type: 'push_forward' as const, startMinute: 60 }];
    // The minute of the call itself is already played.
    expect(computeShoutMods(shout, 60, 60).attackMod).toBe(0);
    for (let m = 61; m <= 60 + SHOUT_DURATION; m++) expect(computeShoutMods(shout, m, m).attackMod).toBeCloseTo(push.attackMod, 9);
    expect(computeShoutMods(shout, 61 + SHOUT_DURATION, 61 + SHOUT_DURATION).attackMod).toBe(0);
    // A 30-minute block (extra time) takes it pro rata.
    expect(computeShoutMods([{ type: 'push_forward', startMinute: 90 }], 91, 120).attackMod).toBeCloseTo(push.attackMod * SHOUT_DURATION / 30, 9);
  });

  it('a shout from long ago no longer counts', () => {
    expect(computeShoutMods([{ type: 'hold_the_line', startMinute: 50 }], 80, 80)).toEqual({ attackMod: 0, defenseMod: 0, foulMod: 0 });
  });
});
