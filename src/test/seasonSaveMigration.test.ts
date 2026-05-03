/**
 * Phase 8 — Save migration with active season state.
 *
 * Existing saveMigration.test.ts covers individual version steps. This file
 * focuses on:
 *
 *   - validateSaveShape (currently untested) — the load-path guard
 *   - isSaveFromNewerVersion — the future-version refusal guard
 *   - End-to-end migration of saves carrying active season-state fields
 *     (free agents, division tables/fixtures, season history, cup state)
 *
 * Bugs here corrupt user save files permanently — the highest-stakes
 * surface in the game.
 */

import { describe, it, expect } from 'vitest';

import {
  migrateSaveData,
  validateSaveShape,
  isSaveFromNewerVersion,
  CURRENT_VERSION,
} from '@/utils/saveMigration';

// ── validateSaveShape ────────────────────────────────────────────────

describe('validateSaveShape', () => {
  function makeMinimalSave() {
    return {
      version: CURRENT_VERSION,
      playerClubId: 'manchester-city',
      clubs: { 'manchester-city': { id: 'manchester-city' } },
      season: 1,
      week: 1,
    };
  }

  it('accepts a minimally valid save', () => {
    const result = validateSaveShape(makeMinimalSave());
    expect(result.ok).toBe(true);
  });

  it('rejects null/undefined/non-object inputs', () => {
    expect(validateSaveShape(null).ok).toBe(false);
    expect(validateSaveShape(undefined).ok).toBe(false);
    expect(validateSaveShape('string').ok).toBe(false);
    expect(validateSaveShape(42).ok).toBe(false);
  });

  it('rejects arrays at the root', () => {
    const result = validateSaveShape([]);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toMatch(/not an object/);
  });

  it('rejects when playerClubId is missing or empty', () => {
    const r1 = validateSaveShape({ ...makeMinimalSave(), playerClubId: '' });
    expect(r1.ok).toBe(false);
    if (r1.ok === false) expect(r1.reason).toMatch(/playerClubId/);

    const noPC = makeMinimalSave() as Record<string, unknown>;
    delete noPC.playerClubId;
    expect(validateSaveShape(noPC).ok).toBe(false);
  });

  it('rejects when playerClubId is not a string', () => {
    const result = validateSaveShape({ ...makeMinimalSave(), playerClubId: 42 });
    expect(result.ok).toBe(false);
  });

  it('rejects when clubs is missing or not an object', () => {
    const noClubs = makeMinimalSave() as Record<string, unknown>;
    delete noClubs.clubs;
    expect(validateSaveShape(noClubs).ok).toBe(false);

    const arrayClubs = { ...makeMinimalSave(), clubs: [] };
    expect(validateSaveShape(arrayClubs).ok).toBe(false);

    const stringClubs = { ...makeMinimalSave(), clubs: 'not-an-object' };
    expect(validateSaveShape(stringClubs).ok).toBe(false);
  });

  it('rejects when season is missing or non-finite', () => {
    const noSeason = makeMinimalSave() as Record<string, unknown>;
    delete noSeason.season;
    expect(validateSaveShape(noSeason).ok).toBe(false);

    expect(validateSaveShape({ ...makeMinimalSave(), season: NaN }).ok).toBe(false);
    expect(validateSaveShape({ ...makeMinimalSave(), season: Infinity }).ok).toBe(false);
  });

  it('rejects when week is missing or non-finite', () => {
    const noWeek = makeMinimalSave() as Record<string, unknown>;
    delete noWeek.week;
    expect(validateSaveShape(noWeek).ok).toBe(false);

    expect(validateSaveShape({ ...makeMinimalSave(), week: NaN }).ok).toBe(false);
  });

  it('rejects when playerClubId is not present in clubs map', () => {
    const result = validateSaveShape({
      ...makeMinimalSave(),
      playerClubId: 'arsenal',
      clubs: { 'manchester-city': {} },
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toMatch(/not present in clubs/);
  });

  it('returns a discriminated-union failure with a reason string', () => {
    const result = validateSaveShape({});
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

// ── isSaveFromNewerVersion ────────────────────────────────────────────

describe('isSaveFromNewerVersion', () => {
  it('returns false for current-version saves', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION })).toBe(false);
  });

  it('returns false for older saves', () => {
    expect(isSaveFromNewerVersion({ version: 1 })).toBe(false);
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION - 1 })).toBe(false);
  });

  it('returns true for future-version saves', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION + 1 })).toBe(true);
    expect(isSaveFromNewerVersion({ version: 9999 })).toBe(true);
  });

  it('returns false for non-object / null / no-version inputs', () => {
    expect(isSaveFromNewerVersion(null)).toBe(false);
    expect(isSaveFromNewerVersion(undefined)).toBe(false);
    expect(isSaveFromNewerVersion('string')).toBe(false);
    expect(isSaveFromNewerVersion({})).toBe(false);
  });

  it('returns false when version is not a finite number', () => {
    expect(isSaveFromNewerVersion({ version: 'next' })).toBe(false);
    expect(isSaveFromNewerVersion({ version: NaN })).toBe(false);
    expect(isSaveFromNewerVersion({ version: Infinity })).toBe(false);
  });
});

// ── Active season-state migration ────────────────────────────────────

describe('migrateSaveData — preserves active season state', () => {
  /** Build a save at the current version that's mid-season with realistic
   *  active state. We then verify migration is idempotent (no field loss). */
  function makeActiveCurrentVersionSave() {
    return {
      version: CURRENT_VERSION,
      gameStarted: true,
      playerClubId: 'manchester-city',
      season: 5,
      week: 23,
      clubs: {
        'manchester-city': { id: 'manchester-city', name: 'Manchester City', wageBill: 1_000_000 },
        'arsenal': { id: 'arsenal', name: 'Arsenal', wageBill: 800_000 },
      },
      players: {
        'p1': { id: 'p1', firstName: 'Test', lastName: 'Player', clubId: 'manchester-city', age: 26, contractEnd: 7 },
      },
      freeAgents: ['fa1', 'fa2', 'fa3'],
      seasonHistory: [
        { season: 1, position: 1, points: 90, won: 28, drawn: 6, lost: 4, goalsFor: 88, goalsAgainst: 30,
          topScorer: { name: 'X', goals: 25 }, boardVerdict: 'excellent' },
      ],
      cup: { ties: [{ id: 't1', round: 'R3', homeClubId: 'a', awayClubId: 'b', played: false, homeGoals: 0, awayGoals: 0, week: 14 }],
        currentRound: 'R3', eliminated: false, winner: null },
      divisionClubs: { 'eng': ['manchester-city', 'arsenal'] },
      divisionTables: { 'eng': [{ clubId: 'manchester-city', played: 22, won: 18, drawn: 2, lost: 2, goalsFor: 60, goalsAgainst: 18, goalDifference: 42, points: 56, form: ['W'], cleanSheets: 12 }] },
      divisionFixtures: { 'eng': [] },
      messages: [{ id: 'm1', week: 5, season: 5, type: 'general', title: 'Hi', body: 'X', read: false }],
    };
  }

  it('is a no-op for already-current saves', () => {
    const save = makeActiveCurrentVersionSave();
    const before = JSON.parse(JSON.stringify(save));
    const after = migrateSaveData(save);
    expect(after).toEqual(before);
  });

  it('preserves season history across migration', () => {
    const save = makeActiveCurrentVersionSave();
    const result = migrateSaveData(save);
    expect(result.seasonHistory).toEqual(save.seasonHistory);
  });

  it('preserves free-agent pool across migration', () => {
    const save = makeActiveCurrentVersionSave();
    const result = migrateSaveData(save);
    expect(result.freeAgents).toEqual(['fa1', 'fa2', 'fa3']);
  });

  it('preserves cup state mid-season', () => {
    const save = makeActiveCurrentVersionSave();
    const result = migrateSaveData(save);
    expect(result.cup).toEqual(save.cup);
  });

  it('preserves divisionTables and divisionClubs', () => {
    const save = makeActiveCurrentVersionSave();
    const result = migrateSaveData(save);
    expect(result.divisionClubs).toEqual(save.divisionClubs);
    expect(result.divisionTables).toEqual(save.divisionTables);
  });

  it('passes the validateSaveShape gate post-migration', () => {
    const save = makeActiveCurrentVersionSave();
    const result = migrateSaveData(save);
    expect(validateSaveShape(result).ok).toBe(true);
  });
});

// ── Cross-version active-season migration ────────────────────────────

describe('migrateSaveData — pre-clean-break saves do not carry state forward', () => {
  it('v22 active-season save is wiped at the clean break (data resets)', () => {
    // v22→v23 is an explicit clean break. Anything in the save is discarded.
    const v22 = {
      version: 22,
      playerClubId: 'crown-city',
      season: 5, week: 30,
      clubs: { 'crown-city': {} },
      freeAgents: ['preserve-me'],
      seasonHistory: [{ season: 1 }],
    };
    const result = migrateSaveData(v22) as Record<string, unknown>;
    expect(result.version).toBe(CURRENT_VERSION);
    // Clean break drops the old save entirely.
    expect(result.gameStarted).toBe(false);
    expect(result.playerClubId).toBe('');
    expect(result.seasonHistory).toEqual([]);
  });

  it('post-clean-break v23 save keeps its season state through to current', () => {
    // Saves recorded at v23 or later survive the migration chain. Build a
    // v23 save with active season fields and check the post-v23 fields make
    // it through (the v23 schema is the floor — older fields are dropped).
    const v23 = {
      version: 23,
      gameStarted: true,
      playerClubId: 'manchester-city',
      season: 3, week: 15,
      clubs: { 'manchester-city': { id: 'manchester-city', wageBill: 0 } },
      players: {},
      freeAgents: ['preserve-me'],
      seasonHistory: [{
        season: 1, position: 2, points: 80, won: 24, drawn: 8, lost: 6,
        goalsFor: 70, goalsAgainst: 35, topScorer: { name: 'X', goals: 20 },
        boardVerdict: 'good',
      }],
      divisionClubs: {},
      divisionTables: {},
      divisionFixtures: {},
      playerDivision: 'eng',
    };
    const result = migrateSaveData(v23) as Record<string, unknown>;
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.playerClubId).toBe('manchester-city');
    expect(result.season).toBe(3);
    expect(result.week).toBe(15);
    expect(result.freeAgents).toEqual(['preserve-me']);
    expect((result.seasonHistory as unknown[]).length).toBe(1);
  });
});

// ── Future-version refusal ───────────────────────────────────────────

describe('migrateSaveData + isSaveFromNewerVersion combo', () => {
  it('a save at CURRENT_VERSION is not considered "from newer"', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION })).toBe(false);
  });

  it('isSaveFromNewerVersion is the correct gate before calling migrateSaveData', () => {
    // Sanity check: anything > CURRENT_VERSION must trip the guard before
    // we attempt migration (the migration loop wouldn't know how to handle it).
    const future = { version: CURRENT_VERSION + 5 };
    expect(isSaveFromNewerVersion(future)).toBe(true);
  });
});
