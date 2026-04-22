/**
 * Autosave scheduler & status tests.
 *
 * Exercises the async save path (requestIdleCallback / setTimeout fallback),
 * the sync manual-save path, flushSave / flushPendingOnly, and the
 * hash-based change-detection short-circuit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { fnv1a } from '@/utils/hashString';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

const CLUB_ID = 'manchester-city';

/** Drain any scheduled idle work and reset the store to a fresh game. */
function initFresh() {
  // In jsdom there is no requestIdleCallback so the scheduler falls through
  // to setTimeout. Use fake timers so scheduled callbacks run deterministically.
  vi.useFakeTimers();
  __resetAutosaveSchedulerForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  useGameStore.getState().initGame(CLUB_ID);
}

describe('fnv1a hash', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a('hello')).toBe(fnv1a('hello'));
  });

  it('differs for different inputs', () => {
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = fnv1a('dynasty-manager');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe('autosave: manual (sync) path', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('saveGame(slot) writes to localStorage synchronously', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().saveGame(2);
    expect(setItem).toHaveBeenCalled();
    const calls = setItem.mock.calls.filter(([k]) => k === 'dynasty-save-2');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('saveGame(slot) sets saveStatus to "saved" with a timestamp', () => {
    useGameStore.getState().saveGame(1);
    const { saveStatus, lastSavedAt } = useGameStore.getState();
    expect(saveStatus).toBe('saved');
    expect(lastSavedAt).toBeGreaterThan(0);
  });
});

describe('autosave: async scheduled path', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('saveGame() defers the write past the current tick', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().saveGame();
    // The actual write has not happened yet
    const immediate = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    expect(immediate.length).toBe(0);
    // After advancing timers the scheduled callback runs
    vi.runAllTimers();
    const later = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    expect(later.length).toBeGreaterThan(0);
  });

  it('sets saveStatus="saving" immediately and "saved" after the idle callback', () => {
    useGameStore.getState().saveGame();
    expect(useGameStore.getState().saveStatus).toBe('saving');
    vi.runAllTimers();
    expect(useGameStore.getState().saveStatus).toBe('saved');
  });

  it('coalesces rapid calls within the debounce window into one write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const store = useGameStore.getState();
    store.saveGame();
    store.saveGame();
    store.saveGame();
    vi.runAllTimers();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    // Debounce + idle coalescing → one primary save. Exclude the -backup
    // (backup rotation) and -tmp (atomic-write staging) keys so we're only
    // counting writes to the authoritative slot.
    const primary = writes.filter(([k]) => {
      const key = String(k);
      return !key.endsWith('-backup') && !key.endsWith('-tmp');
    });
    expect(primary.length).toBe(1);
  });
});

describe('autosave: flushSave', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('writes synchronously when nothing is pending', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().flushSave();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    expect(writes.length).toBeGreaterThan(0);
  });

  it('cancels a pending idle callback and runs it now', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().saveGame();
    // Before flush: no write yet
    expect(
      setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-')).length,
    ).toBe(0);
    useGameStore.getState().flushSave();
    // After flush: write happened without needing to advance timers
    expect(
      setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-')).length,
    ).toBeGreaterThan(0);
    // Running timers should not cause a second write — the handle was cancelled
    const countAfterFlush = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-') && !String(k).endsWith('-backup')).length;
    vi.runAllTimers();
    const countAfterTimers = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-') && !String(k).endsWith('-backup')).length;
    expect(countAfterTimers).toBe(countAfterFlush);
  });
});

describe('autosave: flushPendingOnly', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('is a no-op when nothing is scheduled', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().flushPendingOnly();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    expect(writes.length).toBe(0);
  });

  it('completes pending scheduled work when one exists', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().saveGame();
    useGameStore.getState().flushPendingOnly();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    expect(writes.length).toBeGreaterThan(0);
  });
});

describe('autosave: flushForLifecycle', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('creates a sync save when nothing is pending but autoSave is on', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().flushForLifecycle();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-') && !String(k).endsWith('-backup'));
    expect(writes.length).toBeGreaterThan(0);
  });

  it('is a no-op when autoSave is disabled and nothing is pending', () => {
    // updateSettings schedules a save to persist the preference itself — run
    // it to drain the queue so the assertion below actually covers the
    // "nothing pending + autoSave off" path we care about.
    useGameStore.getState().updateSettings({ autoSave: false });
    vi.runAllTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().flushForLifecycle();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-'));
    expect(writes.length).toBe(0);
  });

  it('still flushes pending work even when autoSave is disabled', () => {
    // Schedule a save WHILE autoSave is true
    useGameStore.getState().saveGame();
    // Then the user flips autoSave off — pending save should still write.
    useGameStore.getState().updateSettings({ autoSave: false });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().flushForLifecycle();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-') && !String(k).endsWith('-backup'));
    expect(writes.length).toBeGreaterThan(0);
  });
});

describe('autosave: reset / load cancel pending work', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('resetGame() cancels a queued idle save so it cannot overwrite the wiped slot', () => {
    useGameStore.getState().saveGame();
    useGameStore.getState().resetGame(1);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.runAllTimers();
    const writes = setItem.mock.calls.filter(([k]) => k === 'dynasty-save-1');
    expect(writes.length).toBe(0);
  });

  it('loadGame() cancels a queued idle save so it cannot clobber loaded state', () => {
    // Seed a save to load back
    useGameStore.getState().saveGame(1);
    // Queue an autosave then load — the queued callback must not fire.
    useGameStore.getState().saveGame();
    useGameStore.getState().loadGame(1);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.runAllTimers();
    const writes = setItem.mock.calls.filter(([k]) => String(k).startsWith('dynasty-save-') && !String(k).endsWith('-backup'));
    expect(writes.length).toBe(0);
  });
});

describe('autosave: change detection', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('skips the localStorage write when the payload is unchanged', () => {
    // First save seeds the hash
    useGameStore.getState().saveGame(1);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    // Second save with identical state should short-circuit on the primary
    // save key (it may still refresh lastSavedAt but no setItem for the slot).
    useGameStore.getState().saveGame(1);
    const primary = setItem.mock.calls.filter(
      ([k]) => k === 'dynasty-save-1',
    );
    expect(primary.length).toBe(0);
  });

  it('still refreshes lastSavedAt on a deduplicated save', () => {
    useGameStore.getState().saveGame(1);
    const firstTs = useGameStore.getState().lastSavedAt;
    // Wait a tick so Date.now() advances
    vi.advanceTimersByTime(10);
    useGameStore.getState().saveGame(1);
    const secondTs = useGameStore.getState().lastSavedAt;
    expect(secondTs).not.toBe(firstTs);
    expect(useGameStore.getState().saveStatus).toBe('saved');
  });

  it('writes again when state actually changes between saves', () => {
    useGameStore.getState().saveGame(1);
    // Mutate a cheap, serialized field so the hash changes.
    useGameStore.setState(s => ({ season: s.season + 1 }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().saveGame(1);
    const primary = setItem.mock.calls.filter(([k]) => k === 'dynasty-save-1');
    expect(primary.length).toBeGreaterThan(0);
  });
});

describe('autosave: rapid lifecycle hooks', () => {
  beforeEach(() => initFresh());
  afterEach(() => vi.useRealTimers());

  it('coalesces back-to-back flushForLifecycle calls into a single primary write', () => {
    // pagehide + visibilitychange can both fire on the same tick when a mobile
    // tab is closed; the hash short-circuit must keep us honest.
    useGameStore.getState().saveGame();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    useGameStore.getState().flushForLifecycle();
    useGameStore.getState().flushForLifecycle();
    const primary = setItem.mock.calls.filter(([k]) => {
      const key = String(k);
      return key.startsWith('dynasty-save-') && !key.endsWith('-backup') && !key.endsWith('-tmp');
    });
    expect(primary.length).toBe(1);
  });
});

describe('new-game save pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().resetGame();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  // Regression: initGame is async (Promise<void>) because it dynamically
  // imports community-pack data. The onboarding handler used to call it
  // without awaiting, so saveGame ran before gameStarted was set and the
  // performSave seatbelt silently discarded the write. The slot then showed
  // as empty on the Title Screen.
  it('writes to the chosen slot when initGame is awaited (sandbox flow)', async () => {
    await useGameStore.getState().initGame(CLUB_ID);
    useGameStore.setState({ activeSlot: 2 });
    useGameStore.getState().saveGame(2);
    expect(localStorage.getItem('dynasty-save-2')).not.toBeNull();
    const parsed = JSON.parse(localStorage.getItem('dynasty-save-2')!);
    expect(parsed.playerClubId).toBe(CLUB_ID);
    expect(parsed.activeSlot).toBe(2);
  });

  it('saveGame silently bails out if caller skips the await (documents the bug this fix prevents)', () => {
    // Intentionally do NOT await — simulates the old ClubSelection behaviour.
    // With communityPackEnabled=false there is no await inside initGame, so
    // the synchronous body still runs and state ends up populated; the save
    // DOES land. This test pins that baseline so we catch regressions that
    // add a new await before the set().
    void useGameStore.getState().initGame(CLUB_ID);
    useGameStore.setState({ activeSlot: 3 });
    useGameStore.getState().saveGame(3);
    expect(localStorage.getItem('dynasty-save-3')).not.toBeNull();
  });
});
