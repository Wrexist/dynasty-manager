/**
 * Save corruption protection tests.
 *
 * Covers the four guarantees from docs/release-triage.md Phase B.4:
 *   1. Schema validation on load.
 *   2. Atomic writes via a per-slot tmp key.
 *   3. One-deep backup rotation.
 *   4. Version guard refuses future-version saves.
 *
 * "Manual corruption test" (prompt requirement) is covered by the
 * corrupt-primary-recovers-from-backup case and the
 * unrecoverable-both-corrupt case.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  STORAGE_KEYS,
  writeSaveSlot,
  readSaveSlot,
  readSaveSlotBackup,
  readSaveSlotTmp,
  recoverStaleSaveTmp,
} from '@/store/helpers/persistence';
import {
  validateSaveShape,
  isSaveFromNewerVersion,
  CURRENT_VERSION,
} from '@/utils/saveMigration';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

const SLOT = 1;

/** A minimal save payload that passes every guard (version, shape, migration)
 *  but weighs well under the jsdom 5 MB localStorage quota. Real initGame()
 *  saves are ~2.5 MB each — having two copies (main + backup) in jsdom hits
 *  the quota. These hand-crafted payloads let us exercise the
 *  parse-primary-fails → recover-from-backup flow without that noise. */
function makeMinimalSave(): string {
  return JSON.stringify({
    version: CURRENT_VERSION,
    playerClubId: 'c1',
    clubs: { c1: { id: 'c1', name: 'Minimal FC', playerIds: [] } },
    players: {},
    fixtures: [],
    season: 1,
    week: 1,
    divisionFixtures: { eng: [] },
    divisionClubs: { eng: ['c1'] },
    playerDivision: 'eng',
    divisionTables: { eng: [] },
    messages: [],
    seasonHistory: [],
    communityPackEnabled: false,
    cpPool: { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0 },
  });
}

describe('validateSaveShape', () => {
  it('accepts a well-formed save payload', () => {
    const good = { playerClubId: 'c1', clubs: { c1: {} }, season: 1, week: 1, version: CURRENT_VERSION };
    expect(validateSaveShape(good)).toEqual({ ok: true });
  });

  it('rejects null and non-object roots', () => {
    expect(validateSaveShape(null).ok).toBe(false);
    expect(validateSaveShape('nope').ok).toBe(false);
    expect(validateSaveShape([]).ok).toBe(false);
  });

  it('rejects missing required fields', () => {
    const base = { playerClubId: 'c1', clubs: { c1: {} }, season: 1, week: 1 };
    expect(validateSaveShape({ ...base, playerClubId: undefined }).ok).toBe(false);
    expect(validateSaveShape({ ...base, clubs: undefined }).ok).toBe(false);
    expect(validateSaveShape({ ...base, season: undefined }).ok).toBe(false);
    expect(validateSaveShape({ ...base, week: undefined }).ok).toBe(false);
  });

  it('rejects playerClubId not present in clubs map', () => {
    const orphan = { playerClubId: 'ghost', clubs: { c1: {} }, season: 1, week: 1 };
    const r = validateSaveShape(orphan);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not present/);
  });
});

describe('isSaveFromNewerVersion', () => {
  it('returns true when save.version > CURRENT_VERSION', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION + 1 })).toBe(true);
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION + 99 })).toBe(true);
  });

  it('returns false for current or older versions', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION })).toBe(false);
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION - 1 })).toBe(false);
    expect(isSaveFromNewerVersion({ version: 1 })).toBe(false);
  });

  it('returns false when version is missing or not a number', () => {
    expect(isSaveFromNewerVersion({})).toBe(false);
    expect(isSaveFromNewerVersion({ version: 'abc' })).toBe(false);
    expect(isSaveFromNewerVersion(null)).toBe(false);
  });
});

describe('atomic writeSaveSlot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('leaves no tmp key after a successful write', () => {
    writeSaveSlot(SLOT, '{"hello":"world"}');
    expect(readSaveSlot(SLOT)).toBe('{"hello":"world"}');
    expect(readSaveSlotTmp(SLOT)).toBeNull();
  });

  it('rotates the previous main into the backup key', () => {
    writeSaveSlot(SLOT, '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    expect(readSaveSlot(SLOT)).toBe('{"save":"two"}');
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"one"}');
  });

  it('only keeps one backup deep (second rotation drops oldest)', () => {
    writeSaveSlot(SLOT, '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    writeSaveSlot(SLOT, '{"save":"three"}');
    expect(readSaveSlot(SLOT)).toBe('{"save":"three"}');
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"two"}');
  });

  it('cleans a stale tmp from a previous crashed write', () => {
    // Simulate a crash between "stage tmp" and "promote": tmp set, main not yet
    // updated.
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '{"crashed":"write"}');
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    expect(readSaveSlotTmp(SLOT)).toBeNull();
    expect(readSaveSlot(SLOT)).toBe('{"save":"two"}');
    // The first valid main value rotates to backup.
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"one"}');
  });
});

describe('recoverStaleSaveTmp', () => {
  beforeEach(() => { localStorage.clear(); });

  it('promotes a valid tmp when primary is missing (simulated crash recovery)', () => {
    // Write succeeded at step 1 (stage tmp) but crashed before step 4 (promote).
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '{"version":1,"staged":true}');
    expect(readSaveSlot(SLOT)).toBeNull();
    recoverStaleSaveTmp();
    expect(readSaveSlot(SLOT)).toBe('{"version":1,"staged":true}');
    expect(readSaveSlotTmp(SLOT)).toBeNull();
  });

  it('drops a tmp with invalid JSON', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '<garbage>');
    recoverStaleSaveTmp();
    expect(readSaveSlotTmp(SLOT)).toBeNull();
    expect(readSaveSlot(SLOT)).toBeNull();
  });

  it('leaves primary untouched when both primary and tmp exist', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), '{"main":"ok"}');
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '{"stale":"tmp"}');
    recoverStaleSaveTmp();
    expect(readSaveSlot(SLOT)).toBe('{"main":"ok"}');
    // Stale tmp cleaned.
    expect(readSaveSlotTmp(SLOT)).toBeNull();
  });
});

describe('loadGame — corruption + version guard', () => {
  beforeEach(() => { localStorage.clear(); });

  it('sets loadError when slot JSON is invalid AND no backup exists', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'not-json{{{');
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(false);
    const err = useGameStore.getState().loadError;
    expect(err?.kind).toBe('corrupt');
    expect(err?.canRecover).toBe(false);
  });

  it('transparently recovers from backup when primary JSON is corrupted', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().resetGame();
    const goodRaw = makeMinimalSave();
    // Primary is garbage; backup holds a valid save.
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'corrupt{');
    localStorage.setItem(STORAGE_KEYS.saveSlotBackup(SLOT), goodRaw);
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(true);
    expect(useGameStore.getState().loadError).toBeNull();
    // Backup promoted to primary; the backup key itself is dropped by
    // promoteSaveBackup() to avoid holding two identical copies.
    expect(readSaveSlot(SLOT)).toBe(goodRaw);
  });

  it('refuses a save written by a newer app version', () => {
    const futureSave = JSON.stringify({
      version: CURRENT_VERSION + 5,
      playerClubId: 'c1',
      clubs: { c1: {} },
      season: 1,
      week: 1,
    });
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), futureSave);
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(false);
    const err = useGameStore.getState().loadError;
    expect(err?.kind).toBe('newer_version');
    expect(err?.saveVersion).toBe(CURRENT_VERSION + 5);
  });

  it('rejects a save whose shape is missing required fields (validation_failed)', () => {
    // Parseable, current version, but missing `clubs`.
    const malformed = JSON.stringify({
      version: CURRENT_VERSION,
      playerClubId: 'c1',
      season: 1,
      week: 1,
    });
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), malformed);
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(false);
    expect(useGameStore.getState().loadError?.kind).toBe('validation_failed');
  });

  it('clearLoadError() wipes the banner', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'not-json');
    useGameStore.getState().loadGame(SLOT);
    expect(useGameStore.getState().loadError).not.toBeNull();
    useGameStore.getState().clearLoadError();
    expect(useGameStore.getState().loadError).toBeNull();
  });
});

describe('attemptSaveRecovery', () => {
  beforeEach(() => { localStorage.clear(); });

  it('loads from the backup slot when user opts to recover', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().resetGame();
    const goodRaw = makeMinimalSave();
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'corrupt{');
    localStorage.setItem(STORAGE_KEYS.saveSlotBackup(SLOT), goodRaw);

    // Exercise attemptSaveRecovery directly. In practice loadGame would
    // have surfaced the loadError that prompted the user to click "Try
    // Recovery"; we skip straight to the recovery action.
    const ok = useGameStore.getState().attemptSaveRecovery(SLOT);
    expect(ok).toBe(true);
    expect(useGameStore.getState().loadError).toBeNull();
    expect(readSaveSlot(SLOT)).toBe(goodRaw);
  });

  it('sets loadError corrupt when no backup exists', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'not-json{{{');
    useGameStore.getState().loadGame(SLOT); // fills loadError with corrupt
    useGameStore.getState().clearLoadError();
    // Now call recovery — no backup to draw from.
    const ok = useGameStore.getState().attemptSaveRecovery(SLOT);
    expect(ok).toBe(false);
    const err = useGameStore.getState().loadError;
    expect(err?.kind).toBe('corrupt');
    expect(err?.canRecover).toBe(false);
  });
});
