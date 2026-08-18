/**
 * Fan mood — regression cover for a mechanic that shipped inert.
 *
 * THE BUG. `fanMood` (0-100) drives the matchday-income multiplier
 * `FAN_MOOD_BASE + fanMood/100 * FAN_MOOD_SCALE`, i.e. a ±20% swing on the
 * single largest weekly income line. Its only input was the merchandise pricing
 * tier's `fanMoodImpact`, and the DEFAULT tier (`standard`) has an impact of 0.
 * So on a default save the value never left its initial 50 and the multiplier
 * was pinned at exactly 1.0 forever. Measured over 13 simulated seasons before
 * the fix: board confidence swung 50 -> 88 -> 10 while fan mood read exactly 50
 * every single week.
 *
 * That contradicted two shipped things:
 *   - the in-game help text (`config/ui.ts`, key `fanMood`): "Good results and
 *     winning streaks keep fans happy";
 *   - `utils/storylines.ts:136`, which gates a fan-unrest event on
 *     `fanMood < 25` — unreachable on a default save.
 *
 * THE SECOND HALF OF THE BUG. On a non-default tier the impact was applied
 * every week with nothing pulling back, so mood ratcheted to a rail (100 on
 * Fan-Friendly, 0 on Premium) within a season and stayed there. The pricing
 * choice was a one-off switch, not a standing trade-off.
 *
 * `noRatchet` and `movesOverASeason` below are the two tests that fail against
 * the pre-fix code.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { fanMoodTarget, nextFanMood } from '@/utils/fanMood';
import {
  FAN_MOOD_ADJUST_RATE,
  FAN_MOOD_FORM_WEIGHT,
  FAN_MOOD_POSITION_WEIGHT,
} from '@/config/gameBalance';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

const W = 'W' as const, D = 'D' as const, L = 'L' as const;

describe('fanMoodTarget', () => {
  it('has nothing to judge before a ball is kicked', () => {
    expect(fanMoodTarget([], 1, 20)).toBeNull();
  });

  it('tops out for a perfect run at the top of the table', () => {
    expect(fanMoodTarget([W, W, W, W, W], 1, 20)).toBeCloseTo(100, 6);
  });

  it('bottoms out for a losing run at the foot of the table', () => {
    expect(fanMoodTarget([L, L, L, L, L], 20, 20)).toBeCloseTo(0, 6);
  });

  it('weights form and position as configured', () => {
    // All wins, last place: form contributes fully, position not at all.
    expect(fanMoodTarget([W, W, W, W, W], 20, 20)).toBeCloseTo(100 * FAN_MOOD_FORM_WEIGHT, 6);
    // All losses, first place: the mirror.
    expect(fanMoodTarget([L, L, L, L, L], 1, 20)).toBeCloseTo(100 * FAN_MOOD_POSITION_WEIGHT, 6);
  });

  it('rises monotonically with better form at a fixed position', () => {
    const runs = [
      [L, L, L, L, L], [D, L, L, L, L], [W, L, L, L, L],
      [W, D, L, L, L], [W, W, L, L, L], [W, W, W, W, W],
    ];
    const scores = runs.map(r => fanMoodTarget(r, 10, 20)!);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('falls monotonically as the club slides down the table', () => {
    const scores = [1, 5, 10, 15, 20].map(pos => fanMoodTarget([W, D, L, W, D], pos, 20)!);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThan(scores[i - 1]);
  });

  it('treats a one-club league as neutral standing rather than dividing by zero', () => {
    const score = fanMoodTarget([W, W, W, W, W], 1, 1)!;
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeCloseTo(100 * (FAN_MOOD_FORM_WEIGHT + FAN_MOOD_POSITION_WEIGHT * 0.5), 6);
  });

  it('clamps a position reported outside the table', () => {
    expect(fanMoodTarget([W, W, W, W, W], 0, 20)).toBeCloseTo(100, 6);
    expect(fanMoodTarget([W, W, W, W, W], 99, 20)).toBeCloseTo(100 * FAN_MOOD_FORM_WEIGHT, 6);
  });
});

describe('nextFanMood', () => {
  const base = { leaguePosition: 10, leagueSize: 20, pricingDelta: 0, floor: 0 };

  it('closes the configured fraction of the gap to the target', () => {
    const form = [W, W, W, W, W];
    const target = fanMoodTarget(form, base.leaguePosition, base.leagueSize)!;
    const next = nextFanMood({ ...base, current: 50, form });
    expect(next).toBeCloseTo(50 + (target - 50) * FAN_MOOD_ADJUST_RATE, 6);
  });

  it('holds steady with no results yet — a new season does not snap the mood', () => {
    expect(nextFanMood({ ...base, current: 73, form: [] })).toBe(73);
  });

  it('applies the pricing tier on top of the reversion', () => {
    const form = [W, D, L, D, W];
    const neutral = nextFanMood({ ...base, current: 50, form, pricingDelta: 0 });
    expect(nextFanMood({ ...base, current: 50, form, pricingDelta: 2 })).toBeCloseTo(neutral + 2, 6);
    expect(nextFanMood({ ...base, current: 50, form, pricingDelta: -1 })).toBeCloseTo(neutral - 1, 6);
  });

  it('noRatchet: a standing pricing delta settles at an offset, it does not run to a rail', () => {
    // Pre-fix this loop was `mood = clamp(mood + delta)`, which reached 100 in
    // 25 weeks and stayed. With reversion the steady state is
    // `target + delta / rate`, comfortably inside the range.
    const form = [W, D, L, D, W];
    const target = fanMoodTarget(form, base.leaguePosition, base.leagueSize)!;
    let mood = 50;
    for (let week = 0; week < 200; week++) {
      mood = nextFanMood({ ...base, current: mood, form, pricingDelta: 2 });
    }
    expect(mood).toBeLessThan(100);
    expect(mood).toBeCloseTo(target + 2 / FAN_MOOD_ADJUST_RATE, 4);

    let grumpy = 50;
    for (let week = 0; week < 200; week++) {
      grumpy = nextFanMood({ ...base, current: grumpy, form, pricingDelta: -1 });
    }
    expect(grumpy).toBeGreaterThan(0);
    expect(grumpy).toBeCloseTo(target - 1 / FAN_MOOD_ADJUST_RATE, 4);
  });

  it('never leaves 0-100, whatever the delta', () => {
    for (const delta of [-50, -1, 0, 2, 50]) {
      for (const current of [0, 50, 100]) {
        for (const form of [[L, L, L, L, L], [W, W, W, W, W], []]) {
          const next = nextFanMood({ ...base, current, form, pricingDelta: delta });
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('honours the cult_hero floor', () => {
    const next = nextFanMood({ ...base, current: 10, form: [L, L, L, L, L], leaguePosition: 20, pricingDelta: -1, floor: 40 });
    expect(next).toBe(40);
  });

  it('recovers from a corrupted value instead of propagating NaN', () => {
    const next = nextFanMood({ ...base, current: NaN, form: [W, W, W, W, W] });
    expect(Number.isFinite(next)).toBe(true);
  });
});

describe('fan mood in the live game loop', () => {
  const CLUB = 'manchester-city';
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  beforeEach(() => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    useGameStore.getState().initGame(CLUB);
  });

  it('movesOverASeason: results move the mood off its starting value', { timeout: 180_000 }, async () => {
    const seen = new Set<number>();
    for (let w = 0; w < 46; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
      seen.add(Math.round(useGameStore.getState().fanMood * 100) / 100);
      if (w % 10 === 9) await tick();
    }
    // Pre-fix this set had exactly one member: 50. The default merchandise tier
    // has a fanMoodImpact of 0, so nothing else could ever write the field.
    expect(seen.size, `fan mood took ${seen.size} distinct values over a season`).toBeGreaterThan(1);
    expect(seen.has(50) && seen.size === 1).toBe(false);

    // Directional: the strongest club in the division has a good five-game run
    // somewhere in 38 league games, and the fans should notice.
    expect(Math.max(...seen)).toBeGreaterThan(60);

    for (const v of seen) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
