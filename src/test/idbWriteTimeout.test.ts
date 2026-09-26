import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetIdbForTests, idbGet, idbPut, idbRead } from '@/store/helpers/idbStorage';

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

// Save hydration must tell "IDB answered: no save" apart from "IDB did not
// answer". Both used to read as `null`, and the open timeout (2 s) is shorter
// than the hydrate race (3 s), so a slow open marked a slot holding a career as
// read-and-empty — New Game was offered and the write path trusted it.
describe('IndexedDB read completion', () => {
  it('a timed-out open is an incomplete read, not an empty slot', async () => {
    const open = vi.fn(() => ({ onsuccess: null }));
    vi.stubGlobal('indexedDB', { open });
    let result: unknown;
    const read = idbRead('save').then(r => { result = r; });
    await vi.advanceTimersByTimeAsync(2000);
    await read;
    expect(result).toEqual({ ok: false });
    // The legacy reader keeps its null-on-anything contract.
    const legacy = idbGet('save');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await legacy).toBeNull();
  });

  it('an open that errors (WebKit UnknownError) is an incomplete read, and the next read retries', async () => {
    const request = { result: null, error: { name: 'UnknownError' }, onerror: null as null | (() => void) };
    const open = vi.fn(() => request);
    vi.stubGlobal('indexedDB', { open });
    const read = idbRead('save');
    request.onerror?.();
    expect(await read).toEqual({ ok: false });

    const retry = idbRead('save');
    expect(open).toHaveBeenCalledTimes(2);
    request.onerror?.();
    await retry;
  });

  it('an open refused outright (SecurityError) is a completed read of nothing', async () => {
    const request = { result: null, error: { name: 'SecurityError' }, onerror: null as null | (() => void) };
    vi.stubGlobal('indexedDB', { open: vi.fn(() => request) });
    const read = idbRead('save');
    request.onerror?.();
    expect(await read).toEqual({ ok: true, value: null });
  });

  it('unsupported IndexedDB is a completed read of nothing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await idbRead('save')).toEqual({ ok: true, value: null });
  });

  it('a stalled read request fails and permits a fresh connection', async () => {
    const req = { result: 'career' as unknown, onsuccess: null as null | (() => void), onerror: null };
    const tx = { objectStore: () => ({ get: vi.fn(() => req) }) };
    const db = { transaction: vi.fn(() => tx), close: vi.fn(), onversionchange: null };
    const request = { result: db, onsuccess: null as null | (() => void) };
    const open = vi.fn(() => request);
    vi.stubGlobal('indexedDB', { open });

    const stalled = idbRead('save');
    request.onsuccess?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await stalled).toEqual({ ok: false });
    expect(db.close).toHaveBeenCalledOnce();

    const retry = idbRead('save');
    expect(open).toHaveBeenCalledTimes(2);
    request.onsuccess?.();
    await Promise.resolve();
    req.onsuccess?.();
    expect(await retry).toEqual({ ok: true, value: 'career' });
  });
});
