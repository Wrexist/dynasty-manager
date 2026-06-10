import { describe, it, expect } from 'vitest';
import { checkMatchMilestones } from '@/utils/milestones';

describe('checkMatchMilestones', () => {
  it('fires at the exact threshold', () => {
    const m = checkMatchMilestones(50, [], 1, 10);
    expect(m?.title).toBe('50 Matches');
  });

  it('fires when a double-match week jumps past the threshold', () => {
    // League + cup in the same week: counter goes 49 → 51 and never equals 50.
    const m = checkMatchMilestones(51, [], 1, 10);
    expect(m?.title).toBe('50 Matches');
  });

  it('does not fire below the first threshold', () => {
    expect(checkMatchMilestones(49, [], 1, 10)).toBeNull();
  });

  it('does not re-fire an already-recorded threshold', () => {
    const first = checkMatchMilestones(51, [], 1, 10);
    expect(first).not.toBeNull();
    expect(checkMatchMilestones(51, [first!], 1, 11)).toBeNull();
  });

  it('catches up to the next unrecorded threshold on a later check', () => {
    const fifty = checkMatchMilestones(102, [], 1, 10);
    expect(fifty?.title).toBe('50 Matches');
    const hundred = checkMatchMilestones(102, [fifty!], 1, 11);
    expect(hundred?.title).toBe('100 Matches');
  });
});
