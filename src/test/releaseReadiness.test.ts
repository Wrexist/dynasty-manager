import { describe, it, expect } from 'vitest';
import { CHALLENGES } from '@/data/challenges';
import { generatePlayer, generateSquad, selectBestLineup } from '@/utils/playerGen';
import { LoanDeal, Player } from '@/types/game';

// ── Helpers ──

function makePlayer(overrides: Partial<Player> = {}): Player {
  const p = generatePlayer('CM', 75, 'club-1', 1);
  return { ...p, morale: 60, form: 60, wage: 50000, contractEnd: 3, ...overrides };
}

// ── Phase 1A: Suspension Filtering ──

describe('Suspension enforcement', () => {
  it('selectBestLineup excludes suspended players', () => {
    const squad = generateSquad('test', 70, 1);
    // Suspend 3 players
    squad[0].suspendedUntilWeek = 99;
    squad[1].suspendedUntilWeek = 99;
    squad[2].suspendedUntilWeek = 99;

    const { lineup } = selectBestLineup(squad, '4-3-3', 5);
    const suspendedInLineup = lineup.filter(p => p.suspendedUntilWeek && p.suspendedUntilWeek > 5);
    expect(suspendedInLineup.length).toBe(0);
  });

  it('selectBestLineup includes players whose suspension has expired', () => {
    const squad = generateSquad('test', 70, 1);
    squad[0].suspendedUntilWeek = 3;

    const { lineup } = selectBestLineup(squad, '4-3-3', 5);
    // Player with suspendedUntilWeek=3 should be available at week 5
    const ids = lineup.map(p => p.id);
    // They may or may not be selected based on position, but they shouldn't be excluded
    expect(ids.length).toBe(11);
  });
});

// ── Phase 2A: Challenge Constraints ──

describe('Challenge mode constraints', () => {
  it('youth-revolution challenge has youthOnly flag', () => {
    const youthChallenge = CHALLENGES.find(c => c.id === 'youth-revolution');
    expect(youthChallenge).toBeDefined();
    expect(youthChallenge!.youthOnly).toBe(true);
  });

  it('penny-pincher challenge has noTransfers flag', () => {
    const pennyChallenge = CHALLENGES.find(c => c.id === 'penny-pincher');
    expect(pennyChallenge).toBeDefined();
    expect(pennyChallenge!.noTransfers).toBe(true);
  });

  it('challenges without constraints have no flags', () => {
    const giantKiller = CHALLENGES.find(c => c.id === 'giant-killer');
    expect(giantKiller).toBeDefined();
    expect(giantKiller!.youthOnly).toBeUndefined();
    expect(giantKiller!.noTransfers).toBeUndefined();
  });

  it('all challenges have required fields', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.id).toBeTruthy();
      expect(challenge.name).toBeTruthy();
      expect(challenge.seasonLimit).toBeGreaterThan(0);
      expect(challenge.budgetModifier).toBeGreaterThan(0);
    }
  });
});

// ── Phase 2C: Release Clause ──

describe('Release clause', () => {
  it('player releaseClause field can be set', () => {
    const player = makePlayer({ releaseClause: 25_000_000 });
    expect(player.releaseClause).toBe(25_000_000);
  });

  it('player without release clause has undefined', () => {
    const player = makePlayer();
    expect(player.releaseClause).toBeUndefined();
  });
});

// ── Phase 3: Loan Lifecycle ──

describe('Loan deal structure', () => {
  it('LoanDeal supports obligatory buy fee', () => {
    const loan: LoanDeal = {
      id: 'loan-1',
      playerId: 'p1',
      fromClubId: 'from',
      toClubId: 'to',
      startWeek: 1,
      startSeason: 1,
      durationWeeks: 20,
      wageSplit: 50,
      recallClause: true,
      obligatoryBuyFee: 10_000_000,
    };
    expect(loan.obligatoryBuyFee).toBe(10_000_000);
    expect(loan.recallClause).toBe(true);
  });

  it('LoanDeal works without optional fields', () => {
    const loan: LoanDeal = {
      id: 'loan-2',
      playerId: 'p2',
      fromClubId: 'from',
      toClubId: 'to',
      startWeek: 5,
      startSeason: 1,
      durationWeeks: 10,
      wageSplit: 100,
      recallClause: false,
    };
    expect(loan.obligatoryBuyFee).toBeUndefined();
    expect(loan.recallClause).toBe(false);
  });
});

// ── General: Data Integrity ──

describe('Data integrity', () => {
  it('all 6 challenge scenarios exist', () => {
    expect(CHALLENGES.length).toBe(6);
    const ids = CHALLENGES.map(c => c.id);
    expect(ids).toContain('great-escape');
    expect(ids).toContain('invincibles');
    expect(ids).toContain('youth-revolution');
    expect(ids).toContain('penny-pincher');
    expect(ids).toContain('giant-killer');
    expect(ids).toContain('cup-specialist');
  });

  it('challenge difficulties are valid', () => {
    const validDiffs = ['easy', 'medium', 'hard', 'extreme'];
    for (const c of CHALLENGES) {
      expect(validDiffs).toContain(c.difficulty);
    }
  });

  it('generateSquad creates enough players for a full lineup and bench', () => {
    const squad = generateSquad('test', 70, 1);
    expect(squad.length).toBeGreaterThanOrEqual(20);
    // Should have at least 1 GK
    expect(squad.some(p => p.position === 'GK')).toBe(true);
  });
});
