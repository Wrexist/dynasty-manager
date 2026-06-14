/**
 * continentalCoefficients — drives continental seeding and spot allocation.
 * Covers point scoring, the reputation/coefficient seeding blend, and the
 * season-window pruning invariant (a club that stops qualifying must NOT keep
 * a frozen, inflated coefficient — the documented bug in updateCoefficients).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateTournamentPoints,
  updateCoefficients,
  getSeedingScore,
} from '@/utils/continentalCoefficients';
import {
  COEFF_GROUP_WIN, COEFF_QUALIFY_KNOCKOUT, COEFF_R16_WIN,
  COEFF_SHIELD_MULTIPLIER, COEFF_SEEDING_BLEND,
} from '@/config/continental';
import type { ContinentalTournamentState, ContinentalCoefficient } from '@/types/game';

/** Minimal tournament: club A wins a group match vs B, qualifies, and wins an R16 tie. */
function tournamentWhereAWins(competition = 'champions_cup'): ContinentalTournamentState {
  return {
    competition,
    groups: [
      {
        clubIds: ['A', 'B'],
        matches: [{ homeClubId: 'A', awayClubId: 'B', homeGoals: 2, awayGoals: 0, played: true }],
      },
    ],
    knockoutTies: [
      { round: 'R16', winnerId: 'A', homeClubId: 'A', awayClubId: 'B' },
    ],
  } as unknown as ContinentalTournamentState;
}

describe('calculateTournamentPoints', () => {
  it('sums group win + knockout-qualify bonus + knockout win', () => {
    const pts = calculateTournamentPoints(tournamentWhereAWins(), 'A');
    expect(pts).toBe(COEFF_GROUP_WIN + COEFF_QUALIFY_KNOCKOUT + COEFF_R16_WIN);
  });

  it('applies the competition multiplier (Shield Cup worth less)', () => {
    const base = COEFF_GROUP_WIN + COEFF_QUALIFY_KNOCKOUT + COEFF_R16_WIN;
    const pts = calculateTournamentPoints(tournamentWhereAWins('shield_cup'), 'A');
    expect(pts).toBe(Math.round(base * COEFF_SHIELD_MULTIPLIER * 10) / 10);
  });

  it('awards an uninvolved club nothing', () => {
    expect(calculateTournamentPoints(tournamentWhereAWins(), 'Z')).toBe(0);
  });
});

describe('getSeedingScore', () => {
  it('returns pure reputation when the club has no coefficient', () => {
    expect(getSeedingScore('A', 70, {})).toBeCloseTo(70 * (1 - COEFF_SEEDING_BLEND), 5);
  });

  it('blends reputation with the normalized coefficient', () => {
    const coeffs: Record<string, ContinentalCoefficient> = {
      A: { clubId: 'A', points: 40, seasonPoints: {} },
    };
    // 40/4 = 10 (the normalization cap), so blend = rep*0.4 + 10*0.6.
    expect(getSeedingScore('A', 70, coeffs)).toBeCloseTo(70 * 0.4 + 10 * COEFF_SEEDING_BLEND, 5);
  });

  it('caps the normalized coefficient at 10', () => {
    const low: Record<string, ContinentalCoefficient> = { A: { clubId: 'A', points: 40, seasonPoints: {} } };
    const high: Record<string, ContinentalCoefficient> = { A: { clubId: 'A', points: 999, seasonPoints: {} } };
    expect(getSeedingScore('A', 70, high)).toBe(getSeedingScore('A', 70, low));
  });
});

describe('updateCoefficients — season-window pruning', () => {
  it('recomputes a lapsed club to zero once its only season falls outside the window', () => {
    // 'OLD' last scored in season 1; current season is 8 and the window is 5,
    // so season 1 is pruned and OLD must drop to 0 (not stay frozen high).
    const existing: Record<string, ContinentalCoefficient> = {
      OLD: { clubId: 'OLD', points: 5, seasonPoints: { 1: 10 } },
    };
    const updated = updateCoefficients(existing, tournamentWhereAWins(), 8);

    expect(updated.OLD.points).toBe(0);
    expect(updated.OLD.seasonPoints[1]).toBeUndefined();
  });

  it('credits this season’s participants', () => {
    const updated = updateCoefficients({}, tournamentWhereAWins(), 8);
    expect(updated.A.points).toBeGreaterThan(0);
    expect(updated.A.seasonPoints[8]).toBeGreaterThan(0);
  });
});
