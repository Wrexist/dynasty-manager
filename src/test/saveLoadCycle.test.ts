/**
 * Save/load roundtrip integration test.
 *
 * The audit flagged that nothing protects the serialization contract across
 * the game loop — a mutation that adds a field to GameState, forgets to
 * mark it non-persistent, and doesn't add a migration could silently reset
 * on the next load with no test catching it. This exercises the full
 * saveGame → reset → loadGame path on a non-trivial mid-game state and
 * verifies the key fields round-trip identically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  __resetAutosaveSchedulerForTests,
} from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';

const CLUB_ID = 'manchester-city';
const SLOT = 1;

async function initFreshGame() {
  vi.useFakeTimers();
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  await useGameStore.getState().initGame(CLUB_ID);
}

describe('save/load roundtrip', () => {
  beforeEach(async () => {
    await initFreshGame();
  });

  afterEach(() => vi.useRealTimers());

  it('preserves core game state across save → mutate-in-memory → load', () => {
    // Capture reference state before save
    const before = useGameStore.getState();
    const snapshot = {
      playerClubId: before.playerClubId,
      season: before.season,
      week: before.week,
      playerDivision: before.playerDivision,
      playerIds: Object.keys(before.players).sort(),
      clubIds: Object.keys(before.clubs).sort(),
      fixtureCount: before.fixtures.length,
      squadIds: before.clubs[before.playerClubId].playerIds.slice().sort(),
      lineupIds: before.clubs[before.playerClubId].lineup.slice().sort(),
      budget: before.clubs[before.playerClubId].budget,
    };

    // Save to explicit slot (synchronous path)
    useGameStore.getState().saveGame(SLOT);

    // Mutate in-memory state without touching the slot (resetGame would
    // delete the slot itself). This proves loadGame re-hydrates from the
    // persisted bytes, not just leaves the in-memory state alone.
    useGameStore.setState(s => ({
      clubs: {
        ...s.clubs,
        [snapshot.playerClubId]: {
          ...s.clubs[snapshot.playerClubId],
          budget: snapshot.budget + 999_999,
        },
      },
    }));

    const loaded = useGameStore.getState().loadGame(SLOT);
    expect(loaded).toBe(true);

    const after = useGameStore.getState();
    expect(after.playerClubId).toBe(snapshot.playerClubId);
    expect(after.season).toBe(snapshot.season);
    expect(after.week).toBe(snapshot.week);
    expect(after.playerDivision).toBe(snapshot.playerDivision);
    expect(Object.keys(after.players).sort()).toEqual(snapshot.playerIds);
    expect(Object.keys(after.clubs).sort()).toEqual(snapshot.clubIds);
    expect(after.fixtures.length).toBe(snapshot.fixtureCount);

    const restoredClub = after.clubs[snapshot.playerClubId];
    expect(restoredClub.playerIds.slice().sort()).toEqual(snapshot.squadIds);
    expect(restoredClub.lineup.slice().sort()).toEqual(snapshot.lineupIds);
    // Budget was reset to the saved value, not the mutated one.
    expect(restoredClub.budget).toBe(snapshot.budget);
  });

  it('preserves per-player attributes and condition across save → load', () => {
    const firstPlayerId = useGameStore.getState()
      .clubs[useGameStore.getState().playerClubId].playerIds[0];

    useGameStore.setState(s => ({
      players: {
        ...s.players,
        [firstPlayerId]: {
          ...s.players[firstPlayerId],
          fitness: 42,
          morale: 73,
          form: 88,
          goals: 12,
          injured: true,
          injuryWeeks: 3,
        },
      },
    }));

    useGameStore.getState().saveGame(SLOT);

    // Overwrite the in-memory player with junk and verify load restores the
    // saved fields. We can't resetGame without also removing the save slot.
    useGameStore.setState(s => ({
      players: {
        ...s.players,
        [firstPlayerId]: {
          ...s.players[firstPlayerId],
          fitness: 0,
          morale: 0,
          form: 0,
          goals: 0,
          injured: false,
          injuryWeeks: 0,
        },
      },
    }));

    expect(useGameStore.getState().loadGame(SLOT)).toBe(true);

    const restored = useGameStore.getState().players[firstPlayerId];
    expect(restored).toBeDefined();
    expect(restored.fitness).toBe(42);
    expect(restored.morale).toBe(73);
    expect(restored.form).toBe(88);
    expect(restored.goals).toBe(12);
    expect(restored.injured).toBe(true);
    expect(restored.injuryWeeks).toBe(3);
  });

  it('preserves openedPacks history across save → load', () => {
    const existingId = useGameStore.getState()
      .clubs[useGameStore.getState().playerClubId].playerIds[0];
    const record = {
      id: 'test-pack-1',
      tier: 'gold' as const,
      season: 1,
      week: 3,
      timestamp: 1_700_000_000_000,
      playerIds: [existingId],
      topOvr: 88,
    };

    useGameStore.setState(s => ({
      openedPacks: [record, ...(s.openedPacks || [])],
      lastPackSeason: 1,
      lastPackWeek: 3,
    }));

    useGameStore.getState().saveGame(SLOT);

    // Wipe the in-memory pack state; loadGame should restore it.
    useGameStore.setState({
      openedPacks: [],
      lastPackSeason: 0,
      lastPackWeek: 0,
    });

    expect(useGameStore.getState().loadGame(SLOT)).toBe(true);

    const after = useGameStore.getState();
    expect(after.lastPackSeason).toBe(1);
    expect(after.lastPackWeek).toBe(3);
    const restored = (after.openedPacks || []).find(r => r.id === 'test-pack-1');
    expect(restored).toBeDefined();
    expect(restored?.tier).toBe('gold');
    expect(restored?.topOvr).toBe(88);
    expect(restored?.playerIds).toEqual([existingId]);
  });

  it('returns false when the slot is empty and leaves state untouched', () => {
    // Switch to a fresh, never-saved slot and try to load.
    const stateBeforeLoad = useGameStore.getState().playerClubId;
    const loaded = useGameStore.getState().loadGame(9);
    expect(loaded).toBe(false);
    // State should not have been replaced by a nothing-loaded path.
    expect(useGameStore.getState().playerClubId).toBe(stateBeforeLoad);
  });
});
