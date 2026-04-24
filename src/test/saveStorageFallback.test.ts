/**
 * Regression tests for the IDB-backed save architecture introduced to fix
 * "saves disappear after backgrounding the app."
 *
 * Root cause: on mobile WKWebView `localStorage` is capped at ~5 MB per
 * origin. A full-size save (community-pack enabled) can exceed that, so
 * `writeSaveSlot` used to throw `SAVE_WRITE_FAILED`, and the slot showed
 * as empty on the next app launch.
 *
 * Fix: writes go through a module-level memory cache + IndexedDB (async)
 * + localStorage (best-effort). The memory cache serves the sync read
 * path, IDB is authoritative across sessions, and a localStorage quota
 * error is silently absorbed instead of surfacing to the user.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeSaveSlot,
  readSaveSlot,
  readSaveSlotBackup,
  removeSaveSlot,
  promoteSaveBackup,
  getSlotSummaries,
  __resetSaveStorageForTests,
  STORAGE_KEYS,
} from '@/store/helpers/persistence';

const SLOT = 2;

function validSave(opts: { playerClubId?: string; week?: number; season?: number } = {}): string {
  return JSON.stringify({
    version: 1,
    playerClubId: opts.playerClubId ?? 'manchester-city',
    clubs: { [opts.playerClubId ?? 'manchester-city']: { id: 'manchester-city', name: 'Man City' } },
    players: {},
    fixtures: [],
    season: opts.season ?? 1,
    week: opts.week ?? 1,
    divisionFixtures: { eng: [] },
    divisionClubs: { eng: ['manchester-city'] },
    playerDivision: 'eng',
    divisionTables: { eng: [] },
    gameMode: 'sandbox',
  });
}

describe('save storage — quota-exceeded resilience', () => {
  beforeEach(() => {
    __resetSaveStorageForTests();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('writeSaveSlot does not throw when localStorage is full', () => {
    // Simulate the exact failure mode reported on iOS WKWebView: a quota
    // error on every localStorage.setItem for save slots. The old
    // atomic-write path threw SAVE_WRITE_FAILED here, which bubbled up as
    // a "Save Failed" inbox message and left the slot empty on next load.
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('dynasty-save-')) {
        const err = new Error('QuotaExceededError');
        (err as unknown as { name: string }).name = 'QuotaExceededError';
        throw err;
      }
      return real.call(this, key, value);
    });

    expect(() => writeSaveSlot(SLOT, validSave())).not.toThrow();
    // Memory cache still serves the write even though localStorage rejected.
    expect(readSaveSlot(SLOT)).toBe(validSave());
  });

  it('getSlotSummaries shows the slot even when localStorage write failed', () => {
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('dynasty-save-')) {
        const err = new Error('QuotaExceededError');
        (err as unknown as { name: string }).name = 'QuotaExceededError';
        throw err;
      }
      return real.call(this, key, value);
    });

    writeSaveSlot(SLOT, validSave({ week: 7, season: 2 }));
    // Previously this returned { exists: false } because localStorage was
    // empty. The memory cache fix keeps the slot visible.
    const summaries = getSlotSummaries();
    const s = summaries.find(x => x.slot === SLOT);
    expect(s?.exists).toBe(true);
    expect(s?.week).toBe(7);
    expect(s?.season).toBe(2);
  });
});

describe('save storage — memory cache as source of truth', () => {
  beforeEach(() => {
    __resetSaveStorageForTests();
    localStorage.clear();
  });

  it('subsequent reads return the in-memory write even if localStorage is cleared', () => {
    writeSaveSlot(SLOT, validSave({ week: 3 }));
    // Simulate an aggressive storage manager wiping localStorage between
    // writes (or the browser evicting under memory pressure).
    localStorage.clear();
    expect(readSaveSlot(SLOT)).toBe(validSave({ week: 3 }));
  });

  it('backup rotation populates the backup slot after a second write', () => {
    writeSaveSlot(SLOT, validSave({ week: 1 }));
    writeSaveSlot(SLOT, validSave({ week: 2 }));
    expect(readSaveSlot(SLOT)).toBe(validSave({ week: 2 }));
    expect(readSaveSlotBackup(SLOT)).toBe(validSave({ week: 1 }));
  });

  it('removeSaveSlot clears memory + localStorage', () => {
    writeSaveSlot(SLOT, validSave());
    removeSaveSlot(SLOT);
    expect(readSaveSlot(SLOT)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.saveSlot(SLOT))).toBeNull();
  });

  it('promoteSaveBackup elevates the backup to primary across layers', () => {
    const recovered = validSave({ week: 5 });
    promoteSaveBackup(SLOT, recovered);
    expect(readSaveSlot(SLOT)).toBe(recovered);
    expect(readSaveSlotBackup(SLOT)).toBeNull();
    // localStorage mirror should match where quota permits.
    expect(localStorage.getItem(STORAGE_KEYS.saveSlot(SLOT))).toBe(recovered);
  });
});

describe('save storage — hydration fallback', () => {
  beforeEach(() => {
    __resetSaveStorageForTests();
    localStorage.clear();
  });

  it('reads a pre-existing localStorage save on first access (upgrade path)', () => {
    // Simulate an existing install: localStorage has data but the memory
    // cache is cold (fresh app start, pre-hydration).
    const payload = validSave({ week: 12 });
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), payload);
    // The first read should surface the localStorage data and cache it.
    expect(readSaveSlot(SLOT)).toBe(payload);
    // Now clearing localStorage must NOT lose the save — memory cache has it.
    localStorage.clear();
    expect(readSaveSlot(SLOT)).toBe(payload);
  });
});
