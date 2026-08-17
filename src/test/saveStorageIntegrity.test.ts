/**
 * Regression: the save layer must never destroy a recovery layer it has not
 * read, and a damaged save must not render as an empty slot.
 *
 * Three defects, all of which end in "the career is gone":
 *
 * 1. **Hydration timeout was treated as hydration.** `hydrated` is set in a
 *    `finally` after a 3 s race, so a slow or wedged IndexedDB flipped it with
 *    an empty memory cache. The write path read that flag as "we have looked at
 *    this slot", so: cold launch → timeout → TitleScreen shows empty slots →
 *    user taps New Game → the write sees `oldMain === null` and DELETES the real
 *    IDB backup while overwriting the main. Both layers, one tap. The guard is
 *    now per-slot and only set once IDB actually resolved.
 *
 * 2. **Quota failure deleted the previous, untouched backup mirror.** The main
 *    localStorage write ran first, so on quota exceeded the backup rotation
 *    that was supposed to precede it had never happened — yet the catch removed
 *    the backup key anyway, on the strength of a flag describing the in-memory
 *    rotation. Mature saves exceed the ~5 MB WKWebView cap routinely, so this
 *    fired on essentially every save. The rotation now happens first, and a
 *    failed main write leaves whatever the backup holds alone.
 *
 * 3. **A corrupt primary reported the slot as EMPTY.** `getSlotSummaries`
 *    returned `exists: false` on a parse failure, so TitleScreen drew a "New
 *    Game" row over a real career and `loadGame` — which already recovers from
 *    the backup — was never reached. Worse, starting a new game there rotated
 *    the fresh save into the backup on the next autosave and destroyed the last
 *    good copy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  writeSaveSlot, readSaveSlot, readSaveSlotBackup, getSlotSummaries,
  isSlotHydrated, __resetSaveStorageForTests, STORAGE_KEYS,
} from '@/store/helpers/persistence';

vi.mock('@/store/helpers/idbStorage', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    idbGet: vi.fn(async (k: string) => store.get(k) ?? null),
    idbPut: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    idbDel: vi.fn(async (k: string) => { store.delete(k); }),
    idbKeys: vi.fn(async () => [...store.keys()]),
    requestPersistentStorage: vi.fn(async () => true),
  };
});

const SLOT = 1;
const MAIN = STORAGE_KEYS.saveSlot(SLOT);
const BACKUP = STORAGE_KEYS.saveSlotBackup(SLOT);

const payload = (n: number) => JSON.stringify({ version: 82, playerClubId: 'arsenal', season: n, week: 1, clubs: {}, players: {} });

describe('a slot that has not been read from IDB is never treated as empty', () => {
  beforeEach(() => { __resetSaveStorageForTests(); localStorage.clear(); });

  it('a pre-hydration write does not delete either backup layer', async () => {
    const { idbDel, idbPut } = await import('@/store/helpers/idbStorage');
    // The user's real backup, sitting in IDB, unread because hydration timed out.
    await idbPut(BACKUP, payload(9));
    localStorage.setItem(BACKUP, payload(9));
    expect(isSlotHydrated(SLOT)).toBe(false);

    (idbDel as unknown as { mockClear: () => void }).mockClear();
    // "New Game" on what looks like an empty slot.
    writeSaveSlot(SLOT, payload(1));

    expect(idbDel).not.toHaveBeenCalledWith(BACKUP);
    expect(localStorage.getItem(BACKUP)).toBe(payload(9));
  });
});

describe('a localStorage quota failure keeps the backup mirror', () => {
  beforeEach(() => { __resetSaveStorageForTests(); localStorage.clear(); });

  it('rotates the backup before the main write, and keeps it when the main fails', () => {
    writeSaveSlot(SLOT, payload(1));
    expect(readSaveSlot(SLOT)).toBe(payload(1));

    // Second write: main blows the quota, exactly as a mature save does.
    const realSet = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === MAIN) throw new DOMException('QuotaExceededError');
      return realSet.call(this, k, v);
    });
    try {
      const result = writeSaveSlot(SLOT, payload(2));
      expect(result.lsOk).toBe(false);
    } finally {
      spy.mockRestore();
    }

    // The main mirror is gone (IDB is truth), but the previous save survives in
    // the backup mirror — before the fix localStorage held neither.
    expect(localStorage.getItem(MAIN)).toBeNull();
    expect(localStorage.getItem(BACKUP)).toBe(payload(1));
    // ...and the in-memory/IDB backup agrees.
    expect(readSaveSlotBackup(SLOT)).toBe(payload(1));
  });
});

describe('a damaged primary is offered for recovery, not reported as empty', () => {
  beforeEach(() => { __resetSaveStorageForTests(); localStorage.clear(); });

  it('reports the slot as present and flags it, describing it from the backup', () => {
    writeSaveSlot(SLOT, payload(4)); // becomes the backup on the next write
    writeSaveSlot(SLOT, payload(5));
    expect(readSaveSlotBackup(SLOT)).toBe(payload(4));

    // Corrupt the primary in place, the way a truncated write would.
    writeSaveSlot(SLOT, '{"version":82,"clubs":');

    const summary = getSlotSummaries().find(s => s.slot === SLOT)!;
    expect(summary.exists).toBe(true);          // was false — the whole bug
    expect(summary.needsRecovery).toBe(true);
    // Described by the backup that did parse — which is the season-5 save,
    // rotated there by the corrupt write itself.
    expect(summary.season).toBe(5);
  });

  it('still flags the slot when neither copy parses', () => {
    writeSaveSlot(SLOT, 'not json either');
    writeSaveSlot(SLOT, 'not json');

    const summary = getSlotSummaries().find(s => s.slot === SLOT)!;
    expect(summary.exists).toBe(true);
    expect(summary.needsRecovery).toBe(true);
  });

  it('a genuinely empty slot is still empty', () => {
    const summary = getSlotSummaries().find(s => s.slot === 3)!;
    expect(summary.exists).toBe(false);
    expect(summary.needsRecovery).toBeUndefined();
  });
});
