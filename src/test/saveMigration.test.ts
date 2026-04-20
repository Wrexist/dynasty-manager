import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

describe('saveMigration', () => {
  it('should have current version set to 59', () => {
    expect(CURRENT_VERSION).toBe(59);
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
});
