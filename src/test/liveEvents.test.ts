import { describe, it, expect } from 'vitest';
import {
  getActiveLiveEvent,
  getEventDaysRemaining,
  freshProgress,
  canCheckInToday,
  applyCheckIn,
  getTrackStatus,
  applyTierClaim,
  applyMatchWin,
} from '@/utils/liveEvents';
import { LIVE_EVENTS, MATCH_WIN_POINTS_DAILY_CAP } from '@/config/liveEvents';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0);
const wc = LIVE_EVENTS.find(e => e.id === 'world-cup-2026')!;

describe('liveEvents — scheduling', () => {
  it('reports the World Cup Festival as active inside its window', () => {
    expect(getActiveLiveEvent(at(2026, 6, 19))?.id).toBe('world-cup-2026');
    expect(getActiveLiveEvent(at(2026, 6, 11))?.id).toBe('world-cup-2026'); // inclusive start
    expect(getActiveLiveEvent(at(2026, 7, 19))?.id).toBe('world-cup-2026'); // inclusive end
  });

  it('reports no event outside the window', () => {
    expect(getActiveLiveEvent(at(2026, 6, 10))).toBeNull();
    expect(getActiveLiveEvent(at(2026, 7, 20))).toBeNull();
    expect(getActiveLiveEvent(at(2025, 6, 19))).toBeNull();
  });

  it('counts days remaining inclusive of the final day', () => {
    expect(getEventDaysRemaining(wc, at(2026, 7, 19))).toBe(0); // final day
    expect(getEventDaysRemaining(wc, at(2026, 7, 18))).toBe(1);
    expect(getEventDaysRemaining(wc, at(2026, 6, 19))).toBe(30);
  });
});

describe('liveEvents — daily check-in', () => {
  it('allows a check-in on a fresh record and blocks a repeat the same day', () => {
    const fresh = freshProgress(wc);
    expect(canCheckInToday(fresh, at(2026, 6, 19))).toBe(true);

    const after = applyCheckIn(fresh, wc, at(2026, 6, 19));
    expect(after.points).toBe(wc.checkInPoints);
    expect(canCheckInToday(after, at(2026, 6, 19))).toBe(false);

    // Same-day re-check is a no-op (points unchanged).
    const again = applyCheckIn(after, wc, at(2026, 6, 19));
    expect(again.points).toBe(wc.checkInPoints);
  });

  it('accrues points across consecutive days', () => {
    let p = freshProgress(wc);
    p = applyCheckIn(p, wc, at(2026, 6, 19));
    p = applyCheckIn(p, wc, at(2026, 6, 20));
    p = applyCheckIn(p, wc, at(2026, 6, 21));
    expect(p.points).toBe(wc.checkInPoints * 3);
    expect(canCheckInToday(p, at(2026, 6, 22))).toBe(true);
  });
});

describe('liveEvents — match-win points', () => {
  const day = (d: number) => at(2026, 6, d);

  it('awards points per win up to the daily cap, then stops', () => {
    let p = freshProgress(wc);
    for (let i = 0; i < MATCH_WIN_POINTS_DAILY_CAP; i++) {
      p = applyMatchWin(p, wc, day(19));
    }
    expect(p.points).toBe(wc.matchWinPoints * MATCH_WIN_POINTS_DAILY_CAP);
    expect(p.matchWinCount).toBe(MATCH_WIN_POINTS_DAILY_CAP);

    // Over the cap — no-op.
    const capped = applyMatchWin(p, wc, day(19));
    expect(capped.points).toBe(p.points);
  });

  it('resets the cap on a new day', () => {
    let p = freshProgress(wc);
    for (let i = 0; i < MATCH_WIN_POINTS_DAILY_CAP; i++) p = applyMatchWin(p, wc, day(19));
    const before = p.points;
    p = applyMatchWin(p, wc, day(20)); // next day
    expect(p.points).toBe(before + wc.matchWinPoints);
    expect(p.matchWinCount).toBe(1);
  });
});

describe('liveEvents — reward track', () => {
  it('unlocks tiers as points cross thresholds', () => {
    const p = { ...freshProgress(wc), points: wc.tiers[1].points }; // exactly tier 2's threshold
    const track = getTrackStatus(p, wc);
    expect(track[0].unlocked).toBe(true);
    expect(track[0].claimable).toBe(true);
    expect(track[1].unlocked).toBe(true);
    expect(track[2].unlocked).toBe(false);
    expect(track[2].claimable).toBe(false);
  });

  it('claims an unlocked tier exactly once and not a locked one', () => {
    let p = { ...freshProgress(wc), points: wc.tiers[0].points };
    const firstTier = wc.tiers[0].id;

    p = applyTierClaim(p, wc, firstTier);
    expect(p.claimedTierIds).toContain(firstTier);

    // Re-claim is a no-op (list unchanged).
    const before = p.claimedTierIds.length;
    p = applyTierClaim(p, wc, firstTier);
    expect(p.claimedTierIds.length).toBe(before);

    // A locked tier can't be claimed.
    const lockedTier = wc.tiers[wc.tiers.length - 1].id;
    p = applyTierClaim(p, wc, lockedTier);
    expect(p.claimedTierIds).not.toContain(lockedTier);

    // Unknown tier id is ignored.
    p = applyTierClaim(p, wc, 'does-not-exist');
    expect(p.claimedTierIds.length).toBe(before);
  });

  it('marks a claimed tier as claimed (not claimable) in the track', () => {
    let p = { ...freshProgress(wc), points: wc.tiers[0].points };
    p = applyTierClaim(p, wc, wc.tiers[0].id);
    const track = getTrackStatus(p, wc);
    expect(track[0].claimed).toBe(true);
    expect(track[0].claimable).toBe(false);
  });
});
