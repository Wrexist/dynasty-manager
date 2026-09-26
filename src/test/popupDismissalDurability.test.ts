/**
 * R15 (logic half) — closing the Weekly Digest, or claiming the Daily Reward,
 * must survive an app kill.
 *
 * `dismissWeeklyDigest` only cleared the digest in memory; the save kept it
 * until the next autosave (normally the next week advance), so after an app
 * kill the digest the player had closed came straight back. The daily claim
 * wrote the device streak record at once but left its XP in memory, so a kill
 * kept "claimed today" and lost the reward. Both now ask for a save.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { __resetSaveStorageForTests, readSaveSlot } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

const SLOT = 1;
// Some cases swap `saveGame` for a spy; the store is a singleton, so put the
// real action back before every case.
const realSaveGame = useGameStore.getState().saveGame;

beforeEach(async () => {
  useGameStore.setState({ saveGame: realSaveGame });
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  useGameStore.getState().initGame('arsenal');
  useGameStore.setState({ activeSlot: SLOT, settings: { ...useGameStore.getState().settings, autoSave: true } });
});

describe('Weekly Digest dismissal', () => {
  it('asks for a save', () => {
    useGameStore.setState({ weeklyDigest: { incomeEarned: 1, expensesPaid: 1 } as never });
    const saveGame = vi.fn();
    useGameStore.setState({ saveGame });
    useGameStore.getState().dismissWeeklyDigest();
    expect(useGameStore.getState().weeklyDigest).toBeNull();
    expect(saveGame).toHaveBeenCalled();
  });

  it('is still dismissed after an app kill', async () => {
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().weeklyDigest).not.toBeNull();
    useGameStore.getState().saveGame(SLOT); // what the week advance left on disk
    // Out of the 2s autosave debounce window, as a player reading the digest is.
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().dismissWeeklyDigest();
    // The requested save runs (idle callback); then the app dies with no
    // lifecycle event — a crash or an OS kill. Only work already requested
    // reaches disk.
    useGameStore.getState().flushPendingOnly();
    expect(JSON.parse(readSaveSlot(SLOT)!).weeklyDigest).toBeNull();
    expect(useGameStore.getState().loadGame(SLOT)).toBe(true);
    expect(useGameStore.getState().weeklyDigest).toBeNull();
  });

  it('respects autosave being off', () => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, autoSave: false } });
    const saveGame = vi.fn();
    useGameStore.setState({ saveGame });
    useGameStore.getState().dismissWeeklyDigest();
    expect(saveGame).not.toHaveBeenCalled();
  });
});

describe('Daily Reward claim', () => {
  it('asks for a save so the XP outlives an app kill', () => {
    const saveGame = vi.fn();
    useGameStore.setState({ saveGame });
    const status = useGameStore.getState().claimDailyStreakReward();
    expect(status).not.toBeNull();
    expect(saveGame).toHaveBeenCalled();
  });
});
