/**
 * Season-end regen is squad cover and academy intake, not a signing.
 *
 * The design-weighted anchor had no ceiling of its own, so the elite clubs'
 * top-up generated 85-95 players, academy teenagers included (one measured
 * rollover: 137 generated 85+, 63 of them 21 or under, best 97 against a best
 * real player of 94). `regenFillQuality` is now also held to squad depth and a
 * hard cap.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { regenFillQuality, squadDepthOverall, designedClubQuality } from '@/store/slices/orchestration/helpers';
import {
  REGEN_DEPTH_RANK, REGEN_DEPTH_MARGIN, REGEN_YOUTH_QUALITY_GAP, REGEN_FILL_QUALITY_CAP,
  REPLACEMENT_QUALITY_VARIANCE,
} from '@/config/gameBalance';
import { ALL_CLUBS } from '@/data/league';

const HALF_VARIANCE = Math.floor(REPLACEMENT_QUALITY_VARIANCE / 2);

/** The most highly-designed club in the data — the case that minted 95s. */
function eliteClub() {
  const best = [...ALL_CLUBS].sort((a, b) => (b.squadQuality ?? 0) - (a.squadQuality ?? 0))[0];
  return { id: best.id, divisionId: best.divisionId, reputation: best.reputation };
}

function rollAll(fn: () => number): number[] {
  const out: number[] = [];
  const spy = vi.spyOn(Math, 'random');
  for (let i = 0; i < REPLACEMENT_QUALITY_VARIANCE; i++) {
    spy.mockReturnValue((i + 0.5) / REPLACEMENT_QUALITY_VARIANCE);
    out.push(fn());
  }
  return out;
}

describe('regenFillQuality bounds', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('never exceeds the regen cap, even at the most highly-designed club', () => {
    const club = eliteClub();
    expect(designedClubQuality(club)).toBeGreaterThan(REGEN_FILL_QUALITY_CAP);
    for (const q of rollAll(() => regenFillQuality(club, 95, false, 95))) {
      expect(q).toBeLessThanOrEqual(REGEN_FILL_QUALITY_CAP);
    }
  });

  it('a gap fill lands at or below first-team depth minus the margin (plus variance)', () => {
    const club = eliteClub();
    const depth = 78;
    for (const q of rollAll(() => regenFillQuality(club, 80, false, depth))) {
      expect(q).toBeLessThanOrEqual(depth - REGEN_DEPTH_MARGIN + HALF_VARIANCE);
    }
  });

  it('academy intake sits the youth gap below a gap fill', () => {
    const club = eliteClub();
    const depth = 82;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const fill = regenFillQuality(club, 80, false, depth);
    const youth = regenFillQuality(club, 80, false, depth, true);
    expect(fill - youth).toBe(REGEN_YOUTH_QUALITY_GAP);
    expect(youth).toBeLessThanOrEqual(depth - REGEN_DEPTH_MARGIN - REGEN_YOUTH_QUALITY_GAP + HALF_VARIANCE);
  });

  it('leaves a club whose depth is above its blended anchor unchanged', () => {
    // A lower-league club: design + average already sit below its depth, so
    // the depth anchor must not move it.
    const club = { id: 'no-such-club', divisionId: 'no-such-division', reputation: 2 };
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(regenFillQuality(club, 50, false, 90)).toBe(regenFillQuality(club, 50, false, null));
  });

  it('never goes below the 35 floor', () => {
    const club = { id: 'no-such-club', divisionId: 'no-such-division', reputation: 1 };
    for (const q of rollAll(() => regenFillQuality(club, 30, false, 30, true))) {
      expect(q).toBeGreaterThanOrEqual(35);
    }
  });
});

describe('squadDepthOverall', () => {
  it('is the Nth-best overall, or null for a squad too thin to have one', () => {
    const squad = Array.from({ length: 20 }, (_, i) => ({ overall: 60 + i }));
    expect(squadDepthOverall(squad)).toBe(79 - (REGEN_DEPTH_RANK - 1));
    expect(squadDepthOverall(squad.slice(0, REGEN_DEPTH_RANK - 1))).toBeNull();
  });
});
