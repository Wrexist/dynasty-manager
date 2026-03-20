import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

describe('saveMigration', () => {
  it('should have current version set to 5', () => {
    expect(CURRENT_VERSION).toBe(5);
  });

  it('should migrate v1 data to current version', () => {
    const v1Data: Record<string, unknown> = { version: 1, name: 'test' };
    const result = migrateSaveData(v1Data);
    expect(result.version).toBe(CURRENT_VERSION);
  });

  it('should add messages, seasonHistory, incomingOffers in v1→v2', () => {
    const v1Data: Record<string, unknown> = { version: 1 };
    const result = migrateSaveData(v1Data);
    expect(result.messages).toEqual([]);
    expect(result.seasonHistory).toEqual([]);
    expect(result.incomingOffers).toEqual([]);
  });

  it('should add systems in v2→v3', () => {
    const v2Data: Record<string, unknown> = { version: 2 };
    const result = migrateSaveData(v2Data);
    expect(result.settings).toBeDefined();
    expect(result.tactics).toBeDefined();
    expect(result.training).toBeDefined();
    expect(result.staff).toBeDefined();
    expect(result.scouting).toBeDefined();
    expect(result.youthAcademy).toBeDefined();
    expect(result.facilities).toBeDefined();
    expect(result.financeHistory).toBeDefined();
  });

  it('should add save slots and loans in v3→v4', () => {
    const v3Data: Record<string, unknown> = { version: 3 };
    const result = migrateSaveData(v3Data);
    expect(result.activeSlot).toBe(1);
    expect(result.activeLoans).toEqual([]);
    expect(result.incomingLoanOffers).toEqual([]);
  });

  it('should not modify data already at current version', () => {
    const current: Record<string, unknown> = { version: CURRENT_VERSION, foo: 'bar' };
    const result = migrateSaveData(current);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.foo).toBe('bar');
  });

  it('should preserve existing data through migrations', () => {
    const v1Data: Record<string, unknown> = { version: 1, playerClubId: 'abc', season: 3 };
    const result = migrateSaveData(v1Data);
    expect(result.playerClubId).toBe('abc');
    expect(result.season).toBe(3);
    expect(result.version).toBe(CURRENT_VERSION);
  });
});
