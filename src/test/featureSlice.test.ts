/**
 * featureSlice — coach-checklist XP and pending-achievement handling.
 * (The onboarding reward path is covered separately in onboardingReward.test.ts.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { COACH_TASK_XP, COACH_ALL_TASKS_BONUS_XP } from '@/config/gameBalance';
import { getTotalXP } from '@/utils/managerPerks';

const CLUB_ID = 'celtic';
const TASK_IDS = Object.keys(COACH_TASK_XP);

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('featureSlice — markCoachTaskComplete', () => {
  it('records the task and grants its configured XP', () => {
    const taskId = TASK_IDS[0];
    const before = getTotalXP(useGameStore.getState().managerProgression);

    useGameStore.getState().markCoachTaskComplete(taskId);

    const s = useGameStore.getState();
    expect(s.completedCoachTaskIds).toContain(taskId);
    expect(getTotalXP(s.managerProgression) - before).toBe(COACH_TASK_XP[taskId]);
  });

  it('is idempotent — re-completing a task grants nothing', () => {
    const taskId = TASK_IDS[0];
    useGameStore.getState().markCoachTaskComplete(taskId);
    const afterFirst = getTotalXP(useGameStore.getState().managerProgression);

    useGameStore.getState().markCoachTaskComplete(taskId);

    const s = useGameStore.getState();
    expect(s.completedCoachTaskIds.filter(id => id === taskId)).toHaveLength(1);
    expect(getTotalXP(s.managerProgression)).toBe(afterFirst);
  });

  it('awards the all-tasks bonus exactly once when the last task lands', () => {
    const before = getTotalXP(useGameStore.getState().managerProgression);
    for (const id of TASK_IDS) useGameStore.getState().markCoachTaskComplete(id);

    const expected =
      TASK_IDS.reduce((sum, id) => sum + COACH_TASK_XP[id], 0) + COACH_ALL_TASKS_BONUS_XP;
    expect(getTotalXP(useGameStore.getState().managerProgression) - before).toBe(expected);
  });
});

describe('featureSlice — clearPendingAchievements', () => {
  it('empties the pending list', () => {
    useGameStore.setState({ pendingAchievementIds: ['a', 'b'] });
    useGameStore.getState().clearPendingAchievements();
    expect(useGameStore.getState().pendingAchievementIds).toEqual([]);
  });
});
