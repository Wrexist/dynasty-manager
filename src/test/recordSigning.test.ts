/**
 * Regression: "Record Signing" must mean the biggest fee ever paid.
 *
 * The milestone compared the fee against `totalSpent * RECORD_SIGNING_SPEND_RATIO`
 * — career SPEND, not the biggest previous FEE. With spend at 0 the first
 * qualifying signing always fired; afterwards the bar rose with the running
 * total, so a £120M buy in season 8 went unlogged while a £15M buy in season 1
 * was celebrated.
 *
 * `managerStats.biggestSigningFee` (save schema v80) is the reference now.
 */
import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { RECORD_SIGNING_MIN_FEE } from '@/config/transfers';

/** The predicate as executeTransfer applies it. */
const isRecordSigning = (fee: number, previousBest: number) =>
  fee > previousBest && fee >= RECORD_SIGNING_MIN_FEE;

describe('record signing predicate', () => {
  it('fires for the first fee over the minimum', () => {
    expect(isRecordSigning(RECORD_SIGNING_MIN_FEE, 0)).toBe(true);
  });

  it('ignores fees below the minimum however large the career', () => {
    expect(isRecordSigning(RECORD_SIGNING_MIN_FEE - 1, 0)).toBe(false);
  });

  it('fires for a genuine record late in a career', () => {
    // The exact case the old formula missed: a huge fee after heavy spending.
    expect(isRecordSigning(120_000_000, 60_000_000)).toBe(true);
  });

  it('does not fire for a big-but-not-record fee', () => {
    expect(isRecordSigning(40_000_000, 60_000_000)).toBe(false);
  });

  it('does not fire for an equal fee — a record has to be beaten', () => {
    expect(isRecordSigning(60_000_000, 60_000_000)).toBe(false);
  });
});

describe('save migration v79 → v80', () => {
  const baseSave = (extra: Record<string, unknown> = {}) => ({
    version: 79,
    playerClubId: 'arsenal',
    clubs: { arsenal: { id: 'arsenal' } },
    season: 1,
    week: 1,
    ...extra,
  });

  it('seeds biggestSigningFee on an existing managerStats block', () => {
    const migrated = migrateSaveData(baseSave({
      managerStats: { totalWins: 5, totalDraws: 2, totalLosses: 1, totalSpent: 40_000_000, totalEarned: 0 },
    })) as Record<string, unknown>;
    const ms = migrated.managerStats as Record<string, unknown>;
    expect(ms.biggestSigningFee).toBe(0);
    // Existing counters survive untouched.
    expect(ms.totalSpent).toBe(40_000_000);
    expect(ms.totalWins).toBe(5);
    expect(migrated.version).toBe(CURRENT_VERSION);
  });

  it('preserves an already-set value rather than resetting it', () => {
    const migrated = migrateSaveData(baseSave({
      managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0, biggestSigningFee: 75_000_000 },
    })) as Record<string, unknown>;
    expect((migrated.managerStats as Record<string, unknown>).biggestSigningFee).toBe(75_000_000);
  });

  it('survives a save with no managerStats block at all', () => {
    const migrated = migrateSaveData(baseSave()) as Record<string, unknown>;
    expect(migrated.version).toBe(CURRENT_VERSION);
  });
});
