import { describe, it, expect } from 'vitest';
import { generatePlayer } from '@/utils/playerGen';
import type { Player, PlayerPromise, PlayerPromiseType } from '@/types/game';
import { evaluatePromises, isPromiseKept, makePlayerPromise } from '@/utils/playerPromises';
import {
  PROMISE_STARTS_THRESHOLD,
  PROMISE_AMBITION_TOP_FINISH,
  PROMISE_KEPT_MORALE_BOOST,
  PROMISE_KEPT_LOYALTY_BUMP,
  PROMISE_BROKEN_MORALE_HIT,
} from '@/config/gameBalance';

function makePlayer(overrides: Partial<Player> = {}): Player {
  const p = generatePlayer('CM', 78, 'club-1', 1);
  return { ...p, id: 'p1', appearances: 0, ...overrides } as Player;
}

function promiseFor(type: PlayerPromiseType, playerId = 'p1', season = 1): PlayerPromise {
  return { ...makePlayerPromise(playerId, type, season, 5), deadlineSeason: season };
}

const ctx = (over: Partial<Parameters<typeof evaluatePromises>[2]> = {}) => ({
  season: 1, leaguePosition: 10, wonTrophy: false, qualifyingSigning: false, ...over,
});

describe('player promises — evaluation rules', () => {
  describe('playing_time', () => {
    it('kept when appearances meet the threshold', () => {
      const player = makePlayer({ appearances: PROMISE_STARTS_THRESHOLD });
      expect(isPromiseKept('playing_time', player, ctx())).toBe(true);
    });
    it('broken when appearances fall short', () => {
      const player = makePlayer({ appearances: PROMISE_STARTS_THRESHOLD - 1 });
      expect(isPromiseKept('playing_time', player, ctx())).toBe(false);
    });
  });

  describe('ambition', () => {
    it('kept when a trophy is won', () => {
      const player = makePlayer();
      expect(isPromiseKept('ambition', player, ctx({ wonTrophy: true, leaguePosition: 15 }))).toBe(true);
    });
    it('kept on a top-4 finish without a trophy', () => {
      const player = makePlayer();
      expect(isPromiseKept('ambition', player, ctx({ leaguePosition: PROMISE_AMBITION_TOP_FINISH }))).toBe(true);
    });
    it('broken with no trophy and a mid-table finish', () => {
      const player = makePlayer();
      expect(isPromiseKept('ambition', player, ctx({ leaguePosition: PROMISE_AMBITION_TOP_FINISH + 1 }))).toBe(false);
    });
  });

  describe('strengthen_squad', () => {
    it('kept when a qualifying signing arrived', () => {
      const player = makePlayer();
      expect(isPromiseKept('strengthen_squad', player, ctx({ qualifyingSigning: true }))).toBe(true);
    });
    it('broken when no qualifying signing arrived', () => {
      const player = makePlayer();
      expect(isPromiseKept('strengthen_squad', player, ctx({ qualifyingSigning: false }))).toBe(false);
    });
  });
});

describe('player promises — outcomes', () => {
  it('kept path: morale + loyalty reward, no transfer request, message', () => {
    const player = makePlayer({ appearances: PROMISE_STARTS_THRESHOLD + 5 });
    const res = evaluatePromises([promiseFor('playing_time')], { p1: player }, ctx());
    expect(res.outcomes).toHaveLength(1);
    expect(res.outcomes[0]).toMatchObject({
      playerId: 'p1', kept: true, moraleDelta: PROMISE_KEPT_MORALE_BOOST,
      loyaltyDelta: PROMISE_KEPT_LOYALTY_BUMP, wantsToLeave: false,
    });
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].title).toContain('Promise Kept');
    expect(res.nextPromises[0].status).toBe('kept');
  });

  it('broken path: big morale hit + transfer request + message', () => {
    const player = makePlayer({ appearances: 2 });
    const res = evaluatePromises([promiseFor('playing_time')], { p1: player }, ctx());
    expect(res.outcomes[0]).toMatchObject({
      playerId: 'p1', kept: false, moraleDelta: -PROMISE_BROKEN_MORALE_HIT,
      loyaltyDelta: 0, wantsToLeave: true,
    });
    expect(res.messages[0].title).toContain('Promise Broken');
    expect(res.nextPromises[0].status).toBe('broken');
  });

  it('drops a promise whose player no longer exists', () => {
    const res = evaluatePromises([promiseFor('playing_time')], {}, ctx());
    expect(res.outcomes).toHaveLength(0);
    expect(res.nextPromises).toHaveLength(0);
  });

  it('leaves future-deadline promises active and untouched', () => {
    const future = { ...promiseFor('ambition'), deadlineSeason: 2 };
    const res = evaluatePromises([future], { p1: makePlayer() }, ctx({ season: 1 }));
    expect(res.outcomes).toHaveLength(0);
    expect(res.nextPromises[0].status).toBe('active');
  });

  it('retains a promise resolved this season, prunes older resolved ones', () => {
    const resolvedThisSeason: PlayerPromise = { ...promiseFor('ambition'), status: 'kept', deadlineSeason: 3 };
    const staleResolved: PlayerPromise = { ...promiseFor('ambition'), id: 'old', status: 'broken', deadlineSeason: 2 };
    const res = evaluatePromises([resolvedThisSeason, staleResolved], { p1: makePlayer() }, ctx({ season: 3 }));
    expect(res.nextPromises).toHaveLength(1);
    expect(res.nextPromises[0].deadlineSeason).toBe(3);
  });
});
