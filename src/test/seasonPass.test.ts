/**
 * Dynasty Pass — point accrual helpers + the idempotent claim action.
 *
 * Covers the pure util (accrual, track status, claim) and the slice action
 * (grants XP, marks the tier, never double-pays on re-claim).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  defaultSeasonPass,
  addSeasonPassPoints,
  matchPassPoints,
  getSeasonPassStatus,
  claimableTierCount,
  claimSeasonPassTier,
} from '@/utils/seasonPass';
import { SEASON_PASS_POINTS, SEASON_PASS_TIERS } from '@/config/seasonPass';

const CLUB_ID = 'manchester-city';

describe('seasonPass util — accrual', () => {
  it('matchPassPoints: played only on non-win, played + win on a win', () => {
    expect(matchPassPoints(false)).toBe(SEASON_PASS_POINTS.matchPlayed);
    expect(matchPassPoints(true)).toBe(SEASON_PASS_POINTS.matchPlayed + SEASON_PASS_POINTS.win);
  });

  it('addSeasonPassPoints accumulates and returns same ref on a no-op', () => {
    const p0 = defaultSeasonPass();
    const p1 = addSeasonPassPoints(p0, 25);
    expect(p1.points).toBe(25);
    expect(p1.claimedTiers).toEqual([]);
    // Zero / negative is a no-op that preserves the reference.
    expect(addSeasonPassPoints(p1, 0)).toBe(p1);
    expect(addSeasonPassPoints(p1, -5)).toBe(p1);
  });

  it('tolerates a null/undefined pass by defaulting', () => {
    expect(addSeasonPassPoints(undefined, 10).points).toBe(10);
    expect(addSeasonPassPoints(null, 10).points).toBe(10);
  });
});

describe('seasonPass util — track status & claim', () => {
  const t1 = SEASON_PASS_TIERS[0];
  const t2 = SEASON_PASS_TIERS[1];

  it('marks tiers unlocked/claimable by threshold', () => {
    const status = getSeasonPassStatus({ points: t1.points, claimedTiers: [] });
    expect(status[0].unlocked).toBe(true);
    expect(status[0].claimable).toBe(true);
    expect(status[1].unlocked).toBe(false);
    expect(claimableTierCount({ points: t2.points, claimedTiers: [] })).toBe(2);
  });

  it('claim is a no-op while locked', () => {
    const res = claimSeasonPassTier({ points: 0, claimedTiers: [] }, t1.tier);
    expect(res.claimed).toBe(false);
    expect(res.xp).toBe(0);
  });

  it('claim grants the tier XP and adds the tier once', () => {
    const res = claimSeasonPassTier({ points: t1.points, claimedTiers: [] }, t1.tier);
    expect(res.claimed).toBe(true);
    expect(res.xp).toBe(t1.xp);
    expect(res.pass.claimedTiers).toEqual([t1.tier]);
  });

  it('re-claiming an already-claimed tier is a no-op', () => {
    const res = claimSeasonPassTier({ points: t1.points, claimedTiers: [t1.tier] }, t1.tier);
    expect(res.claimed).toBe(false);
    expect(res.xp).toBe(0);
    expect(res.pass.claimedTiers).toEqual([t1.tier]);
  });

  it('unknown tier index is a no-op', () => {
    const res = claimSeasonPassTier({ points: 9999, claimedTiers: [] }, 999);
    expect(res.claimed).toBe(false);
  });
});

describe('claimSeasonPassTier slice action', () => {
  const t1 = SEASON_PASS_TIERS[0];

  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('grants XP + marks the tier when unlocked', () => {
    useGameStore.setState({ seasonPass: { points: t1.points, claimedTiers: [] } });
    const before = useGameStore.getState().managerProgression;
    const beforeXp = useGameStore.getState().sessionStats.xpEarned;
    const result = useGameStore.getState().claimSeasonPassTier(t1.tier);
    const s = useGameStore.getState();
    expect(result).toEqual({ xp: t1.xp });
    expect(s.seasonPass.claimedTiers).toEqual([t1.tier]);
    expect(s.managerProgression).not.toBe(before); // XP granted → new ref
    expect(s.sessionStats.xpEarned).toBe(beforeXp + t1.xp);
  });

  it('is idempotent — a second claim does not double-pay', () => {
    useGameStore.setState({ seasonPass: { points: t1.points, claimedTiers: [] } });
    useGameStore.getState().claimSeasonPassTier(t1.tier);
    const afterFirst = useGameStore.getState().managerProgression;
    const result = useGameStore.getState().claimSeasonPassTier(t1.tier);
    expect(result).toBeNull();
    expect(useGameStore.getState().managerProgression).toBe(afterFirst); // unchanged
    expect(useGameStore.getState().seasonPass.claimedTiers).toEqual([t1.tier]);
  });

  it('is a no-op when the tier is still locked', () => {
    useGameStore.setState({ seasonPass: { points: 0, claimedTiers: [] } });
    const before = useGameStore.getState().managerProgression;
    const result = useGameStore.getState().claimSeasonPassTier(t1.tier);
    expect(result).toBeNull();
    expect(useGameStore.getState().managerProgression).toBe(before);
    expect(useGameStore.getState().seasonPass.claimedTiers).toEqual([]);
  });
});
