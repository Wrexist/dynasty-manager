import { describe, it, expect } from 'vitest';
import {
  getActiveLiveEvent,
  getUpcomingSpecialEvent,
  getEventDaysRemaining,
  freshProgress,
  canCheckInToday,
  applyCheckIn,
  getTrackStatus,
  applyTierClaim,
  applyMatchWin,
} from '@/utils/liveEvents';
import { SPECIAL_EVENTS, LIVE_EVENTS, generateMonthlyEvent, MATCH_WIN_POINTS_DAILY_CAP } from '@/config/liveEvents';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0);
const wc = SPECIAL_EVENTS.find(e => e.id === 'world-cup-2026')!;

describe('liveEvents — scheduling', () => {
  it('reports the World Cup Festival as active inside its window (special takes precedence)', () => {
    expect(getActiveLiveEvent(at(2026, 6, 19)).id).toBe('world-cup-2026');
    expect(getActiveLiveEvent(at(2026, 6, 11)).id).toBe('world-cup-2026'); // inclusive start
    expect(getActiveLiveEvent(at(2026, 7, 19)).id).toBe('world-cup-2026'); // inclusive end
  });

  it('falls back to the generated monthly festival outside any special window', () => {
    // The day before the WC starts and the day after it ends are inside the
    // June / July monthly festivals respectively — never empty.
    expect(getActiveLiveEvent(at(2026, 6, 10)).id).toBe('monthly-2026-06');
    expect(getActiveLiveEvent(at(2026, 7, 20)).id).toBe('monthly-2026-07');
    expect(getActiveLiveEvent(at(2025, 6, 19)).id).toBe('monthly-2025-06');
  });

  it('exposes LIVE_EVENTS as a back-compat alias of the special events', () => {
    expect(LIVE_EVENTS).toEqual(SPECIAL_EVENTS);
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

describe('liveEvents — monthly generator', () => {
  it('is deterministic: same month → identical event', () => {
    const a = generateMonthlyEvent(at(2027, 3, 4));
    const b = generateMonthlyEvent(at(2027, 3, 27));
    expect(a).toEqual(b);
    expect(a.id).toBe('monthly-2027-03');
  });

  it('spans the whole calendar month, including leap-year February', () => {
    const feb = generateMonthlyEvent(at(2028, 2, 15)); // 2028 is a leap year
    expect(feb.start).toBe('2028-02-01');
    expect(feb.end).toBe('2028-02-29');

    const apr = generateMonthlyEvent(at(2027, 4, 1)); // 30-day month
    expect(apr.end).toBe('2027-04-30');

    const dec = generateMonthlyEvent(at(2027, 12, 31));
    expect(dec.end).toBe('2027-12-31');
  });

  it('gives each month its own progress namespace and reward scale', () => {
    const jan = generateMonthlyEvent(at(2027, 1, 5));
    const feb = generateMonthlyEvent(at(2027, 2, 5));
    expect(jan.id).not.toBe(feb.id);
    // Reward scale mirrors the World Cup event so payouts stay consistent.
    expect(jan.tiers.map(t => t.points)).toEqual(wc.tiers.map(t => t.points));
    expect(jan.tiers.map(t => t.xp)).toEqual(wc.tiers.map(t => t.xp));
    expect(jan.checkInPoints).toBe(wc.checkInPoints);
  });

  it('the active event for a generated month is always non-null', () => {
    // A random date far from any special event still yields a live event.
    const e = getActiveLiveEvent(at(2030, 9, 12));
    expect(e).not.toBeNull();
    expect(e.id).toBe('monthly-2030-09');
  });
});

describe('liveEvents — upcoming special teaser', () => {
  it('reports the World Cup as upcoming within the horizon before it starts', () => {
    const teaser = getUpcomingSpecialEvent(at(2026, 5, 20), 45);
    expect(teaser?.event.id).toBe('world-cup-2026');
    expect(teaser?.startsInDays).toBe(22);
  });

  it('returns null once the special event has started or is beyond the horizon', () => {
    expect(getUpcomingSpecialEvent(at(2026, 6, 12))).toBeNull(); // already started
    expect(getUpcomingSpecialEvent(at(2026, 1, 1), 45)).toBeNull(); // too far out
  });
});
