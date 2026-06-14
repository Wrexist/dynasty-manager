/**
 * completeOnboardingChecklist — the one-off XP payoff for finishing the
 * first-session "Getting Started" checklist. Covers the happy path (grants
 * ONBOARDING_COMPLETION_XP once) and the idempotency guard (a second call,
 * e.g. from a re-running component effect, never double-pays).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { ONBOARDING_COMPLETION_XP } from '@/config/gameBalance';
import { STORAGE_KEYS } from '@/store/helpers/persistence';
import { getTotalXP } from '@/utils/managerPerks';

const CLUB_ID = 'celtic';

beforeEach(() => {
  // The reward is guarded by a device-global persisted flag; clear it so each
  // test starts unclaimed.
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED);
  useGameStore.getState().initGame(CLUB_ID);
});

describe('completeOnboardingChecklist', () => {
  it('grants the completion XP exactly once and reports it', () => {
    const before = getTotalXP(useGameStore.getState().managerProgression);

    const granted = useGameStore.getState().completeOnboardingChecklist();
    expect(granted).toBe(true);

    const after = getTotalXP(useGameStore.getState().managerProgression);
    expect(after - before).toBe(ONBOARDING_COMPLETION_XP);
  });

  it('is idempotent — a second call pays nothing', () => {
    expect(useGameStore.getState().completeOnboardingChecklist()).toBe(true);
    const afterFirst = getTotalXP(useGameStore.getState().managerProgression);

    const second = useGameStore.getState().completeOnboardingChecklist();
    expect(second).toBe(false);
    expect(getTotalXP(useGameStore.getState().managerProgression)).toBe(afterFirst);
  });

  it('tracks the reward in session XP earned', () => {
    const before = useGameStore.getState().sessionStats.xpEarned;
    useGameStore.getState().completeOnboardingChecklist();
    expect(useGameStore.getState().sessionStats.xpEarned - before).toBe(ONBOARDING_COMPLETION_XP);
  });
});
