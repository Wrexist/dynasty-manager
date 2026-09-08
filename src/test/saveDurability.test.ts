import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import * as persistence from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

describe('save durability acknowledgement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    persistence.__resetSaveStorageForTests();
    localStorage.clear();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame('manchester-city');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('does not acknowledge an IDB-only save before the transaction completes', async () => {
    let finish!: (ok: boolean) => void;
    vi.spyOn(persistence, 'writeSaveSlot').mockReturnValue({
      lsOk: false, idbPromise: new Promise(resolve => { finish = resolve; }),
    });
    let acknowledged = false;
    const save = useGameStore.getState().flushSave().then(ok => { acknowledged = ok; return ok; });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    expect(useGameStore.getState().saveStatus).toBe('saving');
    finish(true);
    expect(await save).toBe(true);
    expect(useGameStore.getState().saveStatus).toBe('saved');
  });

  it('returns false if neither disk path persisted and allows a retry', async () => {
    const write = vi.spyOn(persistence, 'writeSaveSlot').mockReturnValue({ lsOk: false, idbPromise: Promise.resolve(false) });
    expect(await useGameStore.getState().flushSave()).toBe(false);
    expect(useGameStore.getState().saveStatus).toBe('failed');
    write.mockReturnValue({ lsOk: false, idbPromise: Promise.resolve(true) });
    expect(await useGameStore.getState().flushSave()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('a late failure cannot overwrite a newer successful save status', async () => {
    let finishFirst!: (ok: boolean) => void;
    const write = vi.spyOn(persistence, 'writeSaveSlot').mockReturnValueOnce({
      lsOk: false, idbPromise: new Promise(resolve => { finishFirst = resolve; }),
    });
    const first = useGameStore.getState().flushSave();
    useGameStore.setState({ week: 2 });
    write.mockReturnValue({ lsOk: false, idbPromise: Promise.resolve(true) });
    expect(await useGameStore.getState().flushSave()).toBe(true);
    finishFirst(false);
    expect(await first).toBe(false);
    expect(useGameStore.getState().saveStatus).toBe('saved');
  });
  it('acknowledges the successful mirror without waiting for stalled IDB', async () => {
    let finish!: (ok: boolean) => void;
    vi.spyOn(persistence, 'writeSaveSlot').mockReturnValue({
      lsOk: true, idbPromise: new Promise(resolve => { finish = resolve; }),
    });
    let acknowledged = false;
    const save = useGameStore.getState().flushSave().then(ok => { acknowledged = ok; });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(acknowledged).toBe(true);
    } finally {
      finish(false);
      await save;
    }
  });

  it('an older completion cannot hide a newer serialization failure', async () => {
    let finish!: (ok: boolean) => void;
    vi.spyOn(persistence, 'writeSaveSlot').mockReturnValueOnce({
      lsOk: false, idbPromise: new Promise(resolve => { finish = resolve; }),
    });
    const first = useGameStore.getState().flushSave();
    useGameStore.setState({ week: 2 });
    vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => { throw new Error('cannot serialize'); });
    expect(await useGameStore.getState().flushSave()).toBe(false);
    finish(true);
    expect(await first).toBe(true);
    expect(useGameStore.getState().saveStatus).toBe('failed');
    expect(useGameStore.getState().saveFailureMessage).toBe('Save could not be serialized');
  });

});
