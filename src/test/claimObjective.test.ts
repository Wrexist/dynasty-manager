/**
 * claimObjective — the reward-claim action for weekly/monthly objectives.
 * Base XP is granted on claim (not on completion), so this verifies the
 * claim grants XP + flips `claimed`, and is a no-op for ineligible objectives.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { objectiveClaimXP, type ObjectiveInstance } from '@/utils/weeklyObjectives';

const CLUB_ID = 'manchester-city';

const makeObj = (over: Partial<ObjectiveInstance> = {}): ObjectiveInstance => ({
  objectiveId: 'win-match', title: 'Win', description: '', icon: 'trophy',
  xpReward: 10, completed: false, claimed: false, rarity: 'common', ...over,
});

const xpGained = (before: { xp: number; level: number }, after: { xp: number; level: number }) =>
  after.level > before.level || after.xp > before.xp;

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('objectiveClaimXP', () => {
  it('applies the rarity multiplier', () => {
    expect(objectiveClaimXP(makeObj({ rarity: 'common', xpReward: 10 }))).toBe(10);
    expect(objectiveClaimXP(makeObj({ rarity: 'rare', xpReward: 10 }))).toBeGreaterThan(10);
    expect(objectiveClaimXP(makeObj({ rarity: 'legendary', xpReward: 10 })))
      .toBeGreaterThan(objectiveClaimXP(makeObj({ rarity: 'rare', xpReward: 10 })));
  });
});

describe('claimObjective', () => {
  it('grants XP and marks a completed objective claimed', () => {
    useGameStore.setState({ weeklyObjectives: [makeObj({ completed: true, claimed: false })] });
    const before = { ...useGameStore.getState().managerProgression };
    const beforeXp = useGameStore.getState().sessionStats.xpEarned;
    useGameStore.getState().claimObjective('win-match');
    const s = useGameStore.getState();
    expect(s.weeklyObjectives[0].claimed).toBe(true);
    expect(xpGained(before, s.managerProgression)).toBe(true);
    // Claimed XP is also reflected in the Dashboard session total.
    expect(s.sessionStats.xpEarned).toBe(beforeXp + objectiveClaimXP(makeObj({ completed: true })));
  });

  it('is a no-op when the objective is not completed', () => {
    useGameStore.setState({ weeklyObjectives: [makeObj({ completed: false, claimed: false })] });
    const before = useGameStore.getState().managerProgression;
    useGameStore.getState().claimObjective('win-match');
    const s = useGameStore.getState();
    expect(s.weeklyObjectives[0].claimed).toBeFalsy();
    expect(s.managerProgression).toBe(before); // unchanged reference → no grant
  });

  it('is a no-op when already claimed (no double-pay)', () => {
    useGameStore.setState({ weeklyObjectives: [makeObj({ completed: true, claimed: true })] });
    const before = useGameStore.getState().managerProgression;
    useGameStore.getState().claimObjective('win-match');
    expect(useGameStore.getState().managerProgression).toBe(before);
  });
});
