import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

describe('saveMigration', () => {
  it('should have current version set to 61', () => {
    expect(CURRENT_VERSION).toBe(61);
  });

  it('v60 → v61 is a no-op version bump (release clauses are additive)', () => {
    const v60Data: Record<string, unknown> = {
      version: 60,
      playerClubId: 'test-club',
      players: { 'p1': { id: 'p1', firstName: 'Test', lastName: 'Player' } },
      settings: { tutorialSeen: true, soundEnabled: true, volume: 0.5 },
    };
    const result = migrateSaveData(v60Data);
    expect(result.version).toBe(CURRENT_VERSION);
    // Data preserved exactly — the migration is purely a version marker
    expect(result.playerClubId).toBe('test-club');
    expect(result.players).toEqual(v60Data.players);
    expect(result.settings).toEqual(v60Data.settings);
  });

  it('should migrate v1 data to current version', () => {
    const v1Data: Record<string, unknown> = { version: 1, name: 'test' };
    const result = migrateSaveData(v1Data);
    expect(result.version).toBe(CURRENT_VERSION);
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
