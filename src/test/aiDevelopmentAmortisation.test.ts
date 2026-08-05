/**
 * AI development is spread across the season instead of dumped at rollover.
 *
 * The old behaviour ran all `AI_SEASON_DEVELOPMENT_PASSES` in one lump inside
 * `endSeason`. The justification was real — running the full pass every week is
 * 46x the work — but it only ruled out the naive fix, and the cost was that the
 * whole world stood still for a season and jumped in June. A rival's 19-year-old
 * never developed while you watched him.
 *
 * Two things must hold, and they pull against each other:
 *
 *   1. The world VISIBLY moves mid-season. This is the actual fix, and the thing
 *      the old code could not do at all.
 *   2. The season's total growth stays in the same band. Amortising must not
 *      quietly become a buff or a nerf to how fast the AI world improves —
 *      that would change difficulty drift, which is what
 *      `AI_SEASON_DEVELOPMENT_PASSES` exists to control.
 *
 * These are slow because they advance real weeks through the real store. That is
 * the point: the defect only exists in the interaction between `advanceWeek` and
 * `endSeason`, so nothing narrower would have caught it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { aiDevelopmentSlices, AI_SEASON_DEVELOPMENT_PASSES } from '@/config/aiSimulation';
import { stableClubSlice } from '@/store/slices/orchestration/helpers';
import { GROWTH_AGE_THRESHOLD } from '@/config/gameBalance';

const CLUB = 'manchester-city';

/**
 * Overall of every AI player young enough to still be developing, keyed by id.
 *
 * A COHORT, not a population average. The first version of this took the mean
 * across all young AI players and it went DOWN over twelve weeks — youth intake
 * and new market listings add low-rated teenagers faster than the existing ones
 * grow, so the mean measures squad churn rather than development. Comparing the
 * same ids to themselves is the only way to see the thing under test.
 */
function youngAiOveralls(): Map<string, number> {
  const s = useGameStore.getState();
  const out = new Map<string, number>();
  for (const p of Object.values(s.players)) {
    if (!p.clubId || p.clubId === s.playerClubId) continue;
    if (p.age >= GROWTH_AGE_THRESHOLD) continue;
    out.set(p.id, p.overall);
  }
  return out;
}

/** Mean OVR change across players present in BOTH snapshots. */
function cohortDelta(before: Map<string, number>, after: Map<string, number>) {
  let sum = 0;
  let n = 0;
  let grew = 0;
  for (const [id, was] of before) {
    const now = after.get(id);
    if (now === undefined) continue; // retired, released, or joined the player
    sum += now - was;
    if (now > was) grew++;
    n++;
  }
  return { mean: n ? sum / n : 0, grew, n };
}

describe('AI development slicing — the split itself', () => {
  it('is stable for a club id, and independent of array position', () => {
    // The slice MUST NOT come from an index into `divisionClubs`: that array is
    // rewritten by promotion and relegation every rollover, so an index-based
    // split would reassign clubs across a season boundary and let one skip a
    // pass or take two.
    const first = stableClubSlice('coventry-city', 4);
    for (let i = 0; i < 5; i++) expect(stableClubSlice('coventry-city', 4)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(4);
  });

  it('spreads clubs across all slices rather than piling them into one', () => {
    const ids = Object.keys(useGameStore.getState().clubs ?? {});
    const sample = ids.length ? ids : Array.from({ length: 200 }, (_, i) => `club-${i}`);
    const counts = [0, 0, 0, 0];
    for (const id of sample) counts[stableClubSlice(id, 4)]++;
    for (const c of counts) {
      // A hash that dumped everything into one slice would make the "amortised"
      // week just as expensive as the old batch for that week.
      expect(c, `slice distribution ${counts.join('/')}`).toBeGreaterThan(sample.length / 10);
    }
  });

  it('derives a slice count that spends the pass budget on any calendar length', () => {
    for (const totalWeeks of [38, 42, 46]) {
      const passes = totalWeeks / aiDevelopmentSlices(totalWeeks);
      // Within 25% of the configured budget on every shipped calendar length —
      // a 38-week league must not develop its world materially less than a
      // 46-week one purely because its season is shorter.
      expect(Math.abs(passes - AI_SEASON_DEVELOPMENT_PASSES), `${totalWeeks}w -> ${passes.toFixed(1)} passes`)
        .toBeLessThan(AI_SEASON_DEVELOPMENT_PASSES * 0.25);
    }
  });
});

describe('AI development slicing — the world moves during the season', () => {
  beforeEach(() => { useGameStore.getState().initGame(CLUB); });

  it('AI players develop mid-season, not only at rollover', () => {
    const before = youngAiOveralls();
    expect(before.size).toBeGreaterThan(0);

    // A quarter of the season. With slicing every club has had several passes;
    // under the old batch this window produced exactly zero AI development.
    for (let i = 0; i < 12; i++) useGameStore.getState().advanceWeek();

    const afterSnap = youngAiOveralls();
    // No player may LOSE overall here. Before the delta fix in
    // `applyPlayerDevelopment`, 446 of this cohort fell by a mean of 4 OVR
    // because the function overwrote an authored rating with its own formula.
    let fell = 0;
    for (const [id, was] of before) {
      const now = afterSnap.get(id);
      if (now !== undefined && now < was) fell++;
    }
    expect(fell, `${fell} young AI players LOST overall while developing`).toBe(0);
    const { mean, grew, n } = cohortDelta(before, afterSnap);
    expect(useGameStore.getState().week).toBeGreaterThan(1);
    expect(n).toBeGreaterThan(100);
    expect(grew, `no AI player in a cohort of ${n} improved in 12 weeks`).toBeGreaterThan(0);
    expect(mean, `cohort mean moved ${mean.toFixed(3)} OVR`).toBeGreaterThan(0);
  });

  it('growth is bounded — slicing is a redistribution, not a multiplier', () => {
    const before = youngAiOveralls();
    for (let i = 0; i < 12; i++) useGameStore.getState().advanceWeek();
    const { mean } = cohortDelta(before, youngAiOveralls());

    // Twelve weeks is roughly a quarter of the pass budget, so a quarter of
    // MAX_SEASON_GROWTH is the ceiling worth policing. If this ever approaches
    // it, amortisation has become a buff and league difficulty drift no longer
    // means what the config says.
    expect(mean, `cohort mean moved ${mean.toFixed(3)} OVR in 12 weeks`).toBeLessThan(4);
  });
});
