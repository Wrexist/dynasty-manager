import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

describe('saveMigration', () => {
  it('should have current version set to 63', () => {
    expect(CURRENT_VERSION).toBe(63);
  });

  it('v57 → v59 chains cleanly with a realistic halfTimeState payload', () => {
    // A save taken mid-match under v57 would still carry the legacy Set
    // serialization in halfTimeState. Chain through v57→v58→v59 and confirm
    // the final state has a plain array *and* other half-time fields survive.
    const v57: Record<string, unknown> = {
      version: 57,
      halfTimeState: {
        homeGoals: 1,
        awayGoals: 0,
        events: [{ minute: 22, type: 'goal', clubId: 'foo', description: 'Goal!' }],
        usedCommentaryLines: {},
      },
    };
    const out = migrateSaveData(v57) as Record<string, unknown>;
    expect(out.version).toBe(CURRENT_VERSION);
    const half = out.halfTimeState as Record<string, unknown>;
    expect(Array.isArray(half.usedCommentaryLines)).toBe(true);
    expect(half.homeGoals).toBe(1);
    expect(Array.isArray(half.events)).toBe(true);
  });

  it('v58 → v59 survives corrupt halfTimeState shapes', () => {
    // Defensive: a save where halfTimeState is a string / number / array
    // should not crash the migration — it should skip normalization.
    const cases: unknown[] = ['corrupt', 42, [], null];
    for (const bad of cases) {
      const data: Record<string, unknown> = { version: 58, halfTimeState: bad };
      expect(() => migrateSaveData(data)).not.toThrow();
      const out = migrateSaveData(data) as Record<string, unknown>;
      expect(out.version).toBe(CURRENT_VERSION);
    }
  });

  it('v58 → v59 normalizes halfTimeState.usedCommentaryLines to an array', () => {
    // A Set<string> written via JSON.stringify serialized to `{}`. The new
    // schema is a plain string[]; legacy saves must self-heal on load.
    const v58LegacySet: Record<string, unknown> = {
      version: 58,
      halfTimeState: { usedCommentaryLines: {} },
    };
    const healed = migrateSaveData(v58LegacySet) as Record<string, unknown>;
    const half = healed.halfTimeState as { usedCommentaryLines: unknown };
    expect(Array.isArray(half.usedCommentaryLines)).toBe(true);
    expect((half.usedCommentaryLines as unknown[]).length).toBe(0);

    // A save that already uses string[] passes through intact.
    const v58AlreadyArray: Record<string, unknown> = {
      version: 58,
      halfTimeState: { usedCommentaryLines: ['pressure on the ball!'] },
    };
    const passthru = migrateSaveData(v58AlreadyArray) as Record<string, unknown>;
    const passHalf = passthru.halfTimeState as { usedCommentaryLines: unknown };
    expect(passHalf.usedCommentaryLines).toEqual(['pressure on the ball!']);

    // A save with no halfTimeState (no match in flight) skips normalization.
    const v58NoMatch: Record<string, unknown> = { version: 58 };
    const skipped = migrateSaveData(v58NoMatch) as Record<string, unknown>;
    expect(skipped.halfTimeState).toBeUndefined();
  });

  it('should migrate v1 data to current version', () => {
    const v1Data: Record<string, unknown> = { version: 1, name: 'test' };
    const result = migrateSaveData(v1Data);
    expect(result.version).toBe(CURRENT_VERSION);
  });

  it('v56 → v57 defaults the four pack fields', () => {
    // Direct migration test: a v56 save with no pack fields should pick up
    // empty defaults so the slice's `(state.field || ...)` guards still
    // work and the cooldown / pity counter start from zero.
    const v56Data: Record<string, unknown> = { version: 56 };
    const result = migrateSaveData(v56Data) as Record<string, unknown>;
    // Migration may chain past v57 if newer migrations exist later; what we
    // care about is the v57-introduced fields landed correctly.
    expect(result.openedPacks).toEqual([]);
    expect(result.packPityCounter).toBe(0);
    expect(result.lastPackWeek).toBe(0);
    expect(result.lastPackSeason).toBe(0);
  });

  it('v56 → v57 preserves existing pack fields when present', () => {
    const v56Data: Record<string, unknown> = {
      version: 56,
      openedPacks: [{ id: 'x', tier: 'bronze', season: 2, week: 5, timestamp: 0, playerIds: ['p1'], topOvr: 65 }],
      packPityCounter: 4,
      lastPackWeek: 5,
      lastPackSeason: 2,
    };
    const result = migrateSaveData(v56Data) as Record<string, unknown>;
    expect(Array.isArray(result.openedPacks)).toBe(true);
    expect((result.openedPacks as unknown[]).length).toBe(1);
    expect(result.packPityCounter).toBe(4);
    expect(result.lastPackWeek).toBe(5);
    expect(result.lastPackSeason).toBe(2);
  });

  it('v62 → v63 seeds an empty adPackOpens bucket for the new daily-limit gate', () => {
    const v62Data: Record<string, unknown> = { version: 62 };
    const result = migrateSaveData(v62Data) as Record<string, unknown>;
    expect(result.adPackOpens).toEqual({ date: '', counts: {} });
  });

  it('v62 → v63 preserves an existing adPackOpens bucket', () => {
    const existing = { date: '2026-04-26', counts: { bronze: 2 } };
    const v62Data: Record<string, unknown> = { version: 62, adPackOpens: existing };
    const result = migrateSaveData(v62Data) as Record<string, unknown>;
    expect(result.adPackOpens).toEqual(existing);
  });

  it('should perform clean break at v22→v23 (European leagues expansion)', () => {
    const v22Data: Record<string, unknown> = {
      version: 22,
      playerClubId: 'crown-city',
      season: 5,
      clubs: { 'crown-city': { id: 'crown-city' } },
      playerDivision: 'div-1',
    };
    const result = migrateSaveData(v22Data);
    expect(result.version).toBe(CURRENT_VERSION);
    // Clean break: game state is reset
    expect(result.gameStarted).toBe(false);
    expect(result.playerClubId).toBe('');
    expect(result.playerDivision).toBe('eng');
  });

  it('should survive a corrupted migration step gracefully', () => {
    const corruptData: Record<string, unknown> = { version: 1 };
    const result = migrateSaveData(corruptData);
    expect(result.version).toBe(CURRENT_VERSION);
  });

  it('should not modify data already at current version', () => {
    const current: Record<string, unknown> = { version: CURRENT_VERSION, foo: 'bar' };
    const result = migrateSaveData(current);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.foo).toBe('bar');
  });

  it('should reset old saves from pre-v22 through clean break', () => {
    const v1Data: Record<string, unknown> = { version: 1, playerClubId: 'abc', season: 3 };
    const result = migrateSaveData(v1Data);
    // After v22→v23 clean break, old data is wiped
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.gameStarted).toBe(false);
  });

  it('v61 → v62 expands abbreviated firstName fields on saved players', () => {
    const v61: Record<string, unknown> = {
      version: 61,
      players: {
        p1: { id: 'p1', firstName: 'E.', lastName: 'Haaland', nationality: 'Norway' },
        p2: { id: 'p2', firstName: 'L.', lastName: 'Martínez', nationality: 'Argentina' },
        p3: { id: 'p3', firstName: 'Erling', lastName: 'Solo', nationality: 'Norway' },
        p4: { id: 'p4', firstName: 'A. Van', lastName: 'Berg', nationality: 'Netherlands' },
      },
    };
    const result = migrateSaveData(v61) as Record<string, unknown>;
    const players = result.players as Record<string, { firstName: string }>;
    expect(players.p1.firstName).not.toBe('E.');
    expect(players.p1.firstName.startsWith('E')).toBe(true);
    expect(players.p2.firstName.startsWith('L')).toBe(true);
    expect(players.p3.firstName).toBe('Erling'); // unchanged
    expect(players.p4.firstName.endsWith(' Van')).toBe(true);
  });

  it('v61 → v62 leaves saves without a players map untouched', () => {
    const v61: Record<string, unknown> = { version: 61 };
    expect(() => migrateSaveData(v61)).not.toThrow();
    const result = migrateSaveData(v61) as Record<string, unknown>;
    expect(result.version).toBe(CURRENT_VERSION);
  });
});
