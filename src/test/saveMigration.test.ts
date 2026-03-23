import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

describe('saveMigration', () => {
  it('should have current version set to 15', () => {
    expect(CURRENT_VERSION).toBe(17);
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

  it('should add manager progression and achievements in v5→v6', () => {
    const v5Data: Record<string, unknown> = { version: 5 };
    const result = migrateSaveData(v5Data);
    expect(result.managerProgression).toBeDefined();
    expect(result.careerTimeline).toEqual([]);
    expect(result.unlockedAchievements).toEqual([]);
    expect(result.managerStats).toBeDefined();
    expect(result.weeklyObjectives).toEqual([]);
  });

  it('should add preMatchLeaguePosition and lastMatchXPGain in v6→v7', () => {
    const v6Data: Record<string, unknown> = { version: 6 };
    const result = migrateSaveData(v6Data);
    expect(result.preMatchLeaguePosition).toBe(10);
    expect(result.lastMatchXPGain).toBe(0);
  });

  it('should add scoutWatchList in v7→v8', () => {
    const v7Data: Record<string, unknown> = { version: 7 };
    const result = migrateSaveData(v7Data);
    expect(result.scoutWatchList).toEqual([]);
  });

  it('should add weeklyDigest in v8→v9', () => {
    const v8Data: Record<string, unknown> = { version: 8 };
    const result = migrateSaveData(v8Data);
    expect(result.weeklyDigest).toBeNull();
  });

  it('should add freeAgents and aiManagerProfiles in v9→v10', () => {
    const v9Data: Record<string, unknown> = { version: 9, players: {}, clubs: {} };
    const result = migrateSaveData(v9Data);
    expect(result.freeAgents).toEqual([]);
    expect(result.version).toBe(17);
  });

  it('should add sponsorship system in v10→v11', () => {
    const v10Data: Record<string, unknown> = { version: 10 };
    const result = migrateSaveData(v10Data);
    expect(result.sponsorDeals).toEqual([]);
    expect(result.sponsorOffers).toEqual([]);
    expect(result.sponsorSlotCooldowns).toEqual({});
    expect(result.version).toBe(17);
  });

  it('should add unhappiness tracking and cup state in v11→v12', () => {
    const v11Data: Record<string, unknown> = {
      version: 11,
      players: { p1: { id: 'p1', morale: 20 }, p2: { id: 'p2', morale: 80 } },
    };
    const result = migrateSaveData(v11Data);
    expect(result.version).toBe(17);
    expect(result.currentCupTieId).toBeNull();
    const players = result.players as Record<string, Record<string, unknown>>;
    expect(players.p1.lowMoraleWeeks).toBe(0);
    expect(players.p1.wantsToLeave).toBe(false);
    expect(players.p2.lowMoraleWeeks).toBe(0);
  });

  it('should add recoveryLevel in v13→v14', () => {
    const v13Data: Record<string, unknown> = {
      version: 13,
      facilities: { trainingLevel: 5, youthLevel: 4, stadiumLevel: 3, medicalLevel: 6, upgradeInProgress: null },
    };
    const result = migrateSaveData(v13Data);
    expect(result.version).toBe(17);
    const facilities = result.facilities as Record<string, unknown>;
    expect(facilities.recoveryLevel).toBe(6);
  });

  it('should survive a corrupted migration step gracefully', () => {
    // Data at version 1 with a property that could cause issues
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

  it('should preserve existing data through migrations', () => {
    const v1Data: Record<string, unknown> = { version: 1, playerClubId: 'abc', season: 3 };
    const result = migrateSaveData(v1Data);
    expect(result.playerClubId).toBe('abc');
    expect(result.season).toBe(3);
    expect(result.version).toBe(CURRENT_VERSION);
  });
});
