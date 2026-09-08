import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetIdbForTests, idbPut } from '@/store/helpers/idbStorage';

function transaction() {
  return {
    objectStore: () => ({ put: vi.fn() }),
    abort: vi.fn(),
    oncomplete: null as null | (() => void),
    onerror: null as null | (() => void),
    onabort: null as null | (() => void),
  };
}

function database(tx: ReturnType<typeof transaction>) {
  const db = { transaction: vi.fn(() => tx), close: vi.fn(), onversionchange: null };
  const request = { result: db, onsuccess: null as null | (() => void) };
  const open = vi.fn(() => request);
  vi.stubGlobal('indexedDB', { open });
  return { db, request, open };
}

beforeEach(() => { vi.useFakeTimers(); __resetIdbForTests(); });
afterEach(() => { __resetIdbForTests(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('IndexedDB write completion', () => {
  it('acknowledges transaction completion and clears its deadline', async () => {
    const tx = transaction();
    const { request } = database(tx);
    const write = idbPut('save', 'career');
    request.onsuccess?.();
    await Promise.resolve();
    tx.oncomplete?.();
    expect(await write).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tx.abort).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a stalled write, returns failure and permits a fresh connection', async () => {
    const tx = transaction();
    const { db, request, open } = database(tx);
    let outcome: boolean | undefined;
    const write = idbPut('save', 'career').then(ok => { outcome = ok; });
    request.onsuccess?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBe(false);
    expect(tx.abort).toHaveBeenCalledOnce();
    expect(db.close).toHaveBeenCalledOnce();
    tx.oncomplete?.();
    await write;
    expect(outcome).toBe(false);

    const next = transaction();
    db.transaction.mockReturnValue(next);
    const retry = idbPut('save', 'new career');
    expect(open).toHaveBeenCalledTimes(2);
    request.onsuccess?.();
    await Promise.resolve();
    next.oncomplete?.();
    expect(await retry).toBe(true);
  });

  it('returns failure promptly on abort without leaving a timer', async () => {
    const tx = transaction();
    const { request } = database(tx);
    const write = idbPut('save', 'career');
    request.onsuccess?.();
    await Promise.resolve();
    tx.onabort?.();
    expect(await write).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
