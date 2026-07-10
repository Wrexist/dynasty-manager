/**
 * Save export/import (G6 — zero-backend data-loss safety net).
 *
 * Covers:
 *   1. Export/import round-trip through the persistence layer.
 *   2. Import rejects garbage and future-version saves with friendly errors.
 *   3. Import writes only after validation (a bad file never touches the slot).
 *   4. Backup-rotation gate: a valid outgoing main rotates; an invalid one is
 *      overwritten in place with the existing backup left untouched.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  writeSaveSlot,
  readSaveSlot,
  readSaveSlotBackup,
  __resetSaveStorageForTests,
} from '@/store/helpers/persistence';
import { CURRENT_VERSION } from '@/utils/saveMigration';
import { buildBackupFilename, importJsonToSlot, exportSlotJson } from '@/utils/saveBackup';

function clearAllSaveStorage() {
  __resetSaveStorageForTests();
  localStorage.clear();
}

const SLOT = 1;

/** A minimal but shape-valid save payload at the current schema version. */
function makeValidSave(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: CURRENT_VERSION,
    playerClubId: 'c1',
    clubs: { c1: { id: 'c1', name: 'Backup FC', playerIds: [] } },
    players: {},
    fixtures: [],
    season: 3,
    week: 12,
    divisionFixtures: { eng: [] },
    divisionClubs: { eng: ['c1'] },
    playerDivision: 'eng',
    divisionTables: { eng: [] },
    messages: [],
    seasonHistory: [],
    communityPackEnabled: false,
    ...overrides,
  });
}

/** A validator matching the autosave call site — parses then shape-checks. */
const shapeValidator = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw);
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && typeof parsed.playerClubId === 'string' && !!parsed.playerClubId
      && parsed.clubs && typeof parsed.clubs === 'object'
      && typeof parsed.season === 'number' && typeof parsed.week === 'number'
      && parsed.playerClubId in parsed.clubs;
  } catch { return false; }
};

describe('buildBackupFilename', () => {
  it('names the file with slot + local calendar day', () => {
    const name = buildBackupFilename(2, new Date(2026, 6, 10)); // month is 0-based
    expect(name).toBe('dynasty-save-slot2-2026-07-10.json');
  });
});

describe('importJsonToSlot', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('round-trips a valid save through the persistence layer', () => {
    const raw = makeValidSave();
    writeSaveSlot(SLOT, raw);
    const exported = readSaveSlot(SLOT);
    expect(exported).toBe(raw);

    // Wipe the slot entirely, then restore from the exported bytes.
    __resetSaveStorageForTests();
    localStorage.clear();
    expect(readSaveSlot(SLOT)).toBeNull();

    const res = importJsonToSlot(SLOT, exported!);
    expect(res.ok).toBe(true);
    // The restored slot parses to the same content as the export.
    expect(JSON.parse(readSaveSlot(SLOT)!)).toEqual(JSON.parse(exported!));
  });

  it('rejects unparseable garbage with a friendly error and never writes', () => {
    const res = importJsonToSlot(SLOT, '<<< not json >>>');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('parse');
      expect(res.message).toMatch(/Dynasty Manager save/i);
    }
    expect(readSaveSlot(SLOT)).toBeNull();
  });

  it('rejects a structurally-wrong JSON object as invalid', () => {
    const res = importJsonToSlot(SLOT, JSON.stringify({ version: CURRENT_VERSION, hello: 'world' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid');
    expect(readSaveSlot(SLOT)).toBeNull();
  });

  it('rejects a future-version save with a friendly update message', () => {
    const future = makeValidSave({ version: CURRENT_VERSION + 5 });
    const res = importJsonToSlot(SLOT, future);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('future');
      expect(res.message).toMatch(/newer version/i);
    }
    expect(readSaveSlot(SLOT)).toBeNull();
  });

  it('does not overwrite an existing slot when the imported file is bad', () => {
    const good = makeValidSave({ week: 5 });
    writeSaveSlot(SLOT, good);
    const res = importJsonToSlot(SLOT, 'garbage');
    expect(res.ok).toBe(false);
    // Existing save untouched.
    expect(readSaveSlot(SLOT)).toBe(good);
  });
});

describe('writeSaveSlot backup-rotation gate', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('rotates a VALID outgoing main into the backup', () => {
    const one = makeValidSave({ week: 1 });
    const two = makeValidSave({ week: 2 });
    writeSaveSlot(SLOT, one, { validateOutgoing: shapeValidator });
    writeSaveSlot(SLOT, two, { validateOutgoing: shapeValidator });
    expect(readSaveSlot(SLOT)).toBe(two);
    expect(readSaveSlotBackup(SLOT)).toBe(one);
  });

  it('does NOT burn a good backup when the outgoing main is malformed', () => {
    const good = makeValidSave({ week: 1 });
    const corrupt = '{"broken":'; // unparseable — simulates a partial/corrupt write
    const next = makeValidSave({ week: 3 });

    // 1) good save → no backup yet.
    writeSaveSlot(SLOT, good, { validateOutgoing: shapeValidator });
    expect(readSaveSlotBackup(SLOT)).toBeNull();

    // 2) a corrupt save lands on top → the good save rotates into backup.
    writeSaveSlot(SLOT, corrupt, { validateOutgoing: shapeValidator });
    expect(readSaveSlot(SLOT)).toBe(corrupt);
    expect(readSaveSlotBackup(SLOT)).toBe(good);

    // 3) a second save lands while main is the corrupt payload. The gate must
    //    refuse to rotate the corrupt main — the good backup survives.
    writeSaveSlot(SLOT, next, { validateOutgoing: shapeValidator });
    expect(readSaveSlot(SLOT)).toBe(next);
    expect(readSaveSlotBackup(SLOT)).toBe(good); // NOT overwritten by corrupt
  });

  it('keeps the always-rotate behaviour when no validator is injected', () => {
    writeSaveSlot(SLOT, '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"one"}');
  });
});

describe('exportSlotJson', () => {
  beforeEach(() => { clearAllSaveStorage(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('reports no-save for an empty slot', async () => {
    const res = await exportSlotJson(SLOT);
    expect(res).toEqual({ ok: false, error: 'no-save' });
  });

  it('delivers the exact save bytes via the clipboard fallback', async () => {
    const raw = makeValidSave();
    writeSaveSlot(SLOT, raw);
    let captured: string | null = null;
    // Force share + download to be unavailable so we exercise the clipboard tail:
    // navigator has no share/canShare, and URL has no createObjectURL.
    vi.stubGlobal('navigator', {
      userAgent: 'test',
      clipboard: { writeText: (t: string) => { captured = t; return Promise.resolve(); } },
    });
    vi.stubGlobal('URL', {});
    const res = await exportSlotJson(SLOT);
    expect(res).toEqual({ ok: true, method: 'clipboard' });
    expect(captured).toBe(raw);
  });
});
