/**
 * Phase 6a — Manager perk progression system.
 *
 * Extends the single-test managerPerks.test.ts with comprehensive coverage
 * of canUnlockPerk gates, XP economics, branch counting, capstone gating,
 * specialization titles, prerequisite chains, and Dynasty Builder
 * multiplier propagation.
 *
 * Bugs here corrupt the prestige economy and player career progression
 * across saves.
 */

import { describe, it, expect } from 'vitest';

import {
  MANAGER_PERKS,
  canUnlockPerk,
  grantXP,
  getTotalXP,
  countHighBranches,
  getSpecializationTitle,
  branchHasHighTier,
  getPrerequisiteChain,
  getNextPerk,
  getCapstonePerk,
  getBranchPerks,
  getXPProgress,
  hasPerk,
  dynastyMult,
  xpForLevel,
  createDefaultProgression,
  XP_REWARDS,
} from '@/utils/managerPerks';
import {
  MANAGER_XP_BASE,
  MANAGER_XP_PER_LEVEL,
  CAPSTONE_MIN_BRANCHES,
} from '@/config/gameBalance';
import type { ManagerProgression, PerkId } from '@/types/game';

// ── Helpers ────────────────────────────────────────────────────────────

function progAt(level: number, xp: number, unlocked: PerkId[] = [], prestige = 0): ManagerProgression {
  return { level, xp, unlockedPerks: unlocked, prestigeLevel: prestige };
}

// ── createDefaultProgression ───────────────────────────────────────────

describe('createDefaultProgression', () => {
  it('starts at level 1 with no XP and no perks', () => {
    expect(createDefaultProgression()).toEqual({
      xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0,
    });
  });
});

// ── xpForLevel & getXPProgress ─────────────────────────────────────────

describe('xpForLevel', () => {
  it('follows MANAGER_XP_BASE + level * MANAGER_XP_PER_LEVEL', () => {
    expect(xpForLevel(1)).toBe(MANAGER_XP_BASE + MANAGER_XP_PER_LEVEL);
    expect(xpForLevel(5)).toBe(MANAGER_XP_BASE + 5 * MANAGER_XP_PER_LEVEL);
    expect(xpForLevel(10)).toBe(MANAGER_XP_BASE + 10 * MANAGER_XP_PER_LEVEL);
  });
});

describe('getXPProgress', () => {
  it('returns current/needed/percentage', () => {
    const prog = progAt(2, 30);
    const result = getXPProgress(prog);
    expect(result.current).toBe(30);
    expect(result.needed).toBe(xpForLevel(2));
    expect(result.percentage).toBeGreaterThan(0);
    expect(result.percentage).toBeLessThanOrEqual(100);
  });

  it('caps percentage at 100', () => {
    const prog = progAt(1, 999);
    expect(getXPProgress(prog).percentage).toBe(100);
  });
});

// ── grantXP ─────────────────────────────────────────────────────────────

describe('grantXP', () => {
  it('adds XP without level-up below threshold', () => {
    const prog = progAt(1, 10);
    const after = grantXP(prog, 20);
    expect(after.xp).toBe(30);
    expect(after.level).toBe(1);
  });

  it('levels up when crossing threshold and carries remainder', () => {
    const threshold = xpForLevel(1);
    const prog = progAt(1, threshold - 5);
    const after = grantXP(prog, 10);
    expect(after.level).toBe(2);
    expect(after.xp).toBe(5);
  });

  it('handles multiple level-ups in a single grant', () => {
    const prog = progAt(1, 0);
    const huge = xpForLevel(1) + xpForLevel(2) + xpForLevel(3) + 7;
    const after = grantXP(prog, huge);
    expect(after.level).toBe(4);
    expect(after.xp).toBe(7);
  });

  it('applies prestige XP multiplier', () => {
    const base = progAt(1, 0, [], /* prestige */ 1); // 1.5x
    const after = grantXP(base, 20);
    expect(after.xp).toBe(30); // 20 * 1.5 = 30
  });

  it('preserves unlockedPerks and prestigeLevel', () => {
    const prog = progAt(1, 0, ['set_piece_coach'], 2);
    const after = grantXP(prog, 50);
    expect(after.unlockedPerks).toEqual(['set_piece_coach']);
    expect(after.prestigeLevel).toBe(2);
  });
});

// ── getTotalXP ─────────────────────────────────────────────────────────

describe('getTotalXP', () => {
  it('returns the current XP for a fresh level-1 manager', () => {
    expect(getTotalXP(progAt(1, 30))).toBe(30);
  });

  it('accumulates XP from all completed levels', () => {
    const prog = progAt(3, 10);
    // Total = xp + xpForLevel(1) + xpForLevel(2)
    const expected = 10 + xpForLevel(1) + xpForLevel(2);
    expect(getTotalXP(prog)).toBe(expected);
  });

  it('subtracts the cost of unlocked perks from the pool', () => {
    const tierOne = MANAGER_PERKS.find(p => p.id === 'set_piece_coach')!;
    const prog = progAt(5, 0, ['set_piece_coach']);
    const totalEarned = xpForLevel(1) + xpForLevel(2) + xpForLevel(3) + xpForLevel(4);
    expect(getTotalXP(prog)).toBe(totalEarned - tierOne.cost);
  });
});

// ── canUnlockPerk ──────────────────────────────────────────────────────

describe('canUnlockPerk', () => {
  const setPieceCoach = MANAGER_PERKS.find(p => p.id === 'set_piece_coach')!;
  const tacticalGenius = MANAGER_PERKS.find(p => p.id === 'tactical_genius')!;
  const counterMaster = MANAGER_PERKS.find(p => p.id === 'counter_master')!;
  const dynastyBuilder = MANAGER_PERKS.find(p => p.id === 'dynasty_builder')!;

  it('rejects already-unlocked perks', () => {
    const prog = progAt(5, 1000, ['set_piece_coach']);
    const result = canUnlockPerk(setPieceCoach, prog);
    expect(result.canUnlock).toBe(false);
    expect(result.reason).toBe('Already unlocked');
  });

  it('rejects perks with insufficient XP', () => {
    const prog = progAt(1, 10);
    const result = canUnlockPerk(setPieceCoach, prog);
    expect(result.canUnlock).toBe(false);
    expect(result.reason).toMatch(/Need .* more XP/);
  });

  it('rejects perks whose prerequisite is not unlocked', () => {
    const prog = progAt(10, 5000); // plenty of XP
    const result = canUnlockPerk(tacticalGenius, prog);
    expect(result.canUnlock).toBe(false);
    expect(result.reason).toMatch(/Requires/);
  });

  it('accepts perks when prerequisite is unlocked and XP is sufficient', () => {
    const prog = progAt(10, 5000, ['set_piece_coach']);
    const result = canUnlockPerk(tacticalGenius, prog);
    expect(result.canUnlock).toBe(true);
  });

  it('rejects prestige-required perks at insufficient prestige', () => {
    const prog = progAt(20, 9999, ['set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master', 'iron_will'], /* prestige */ 0);
    const result = canUnlockPerk(counterMaster, prog);
    expect(result.canUnlock).toBe(false);
    expect(result.reason).toMatch(/Prestige/);
  });

  it('accepts prestige-required perks at sufficient prestige', () => {
    const prog = progAt(20, 9999, ['set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master', 'iron_will'], /* prestige */ 1);
    const result = canUnlockPerk(counterMaster, prog);
    expect(result.canUnlock).toBe(true);
  });

  it('rejects capstone when fewer than CAPSTONE_MIN_BRANCHES branches reach row 3+', () => {
    // Only one branch reaches row 3+ — capstone gate fails.
    const prog = progAt(20, 9999, ['set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master']);
    const result = canUnlockPerk(dynastyBuilder, prog);
    expect(result.canUnlock).toBe(false);
    expect(result.reason).toMatch(new RegExp(`${CAPSTONE_MIN_BRANCHES} branches`));
  });

  it('accepts capstone with row-3+ perks in CAPSTONE_MIN_BRANCHES branches', () => {
    // formation_master (tactician row 3) + fortress_mentality (motivator row 3).
    const prog = progAt(25, 9999, [
      'set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master',
      'motivator', 'media_savvy', 'fan_favourite', 'fortress_mentality',
    ]);
    const result = canUnlockPerk(dynastyBuilder, prog);
    expect(result.canUnlock).toBe(true);
  });
});

// ── countHighBranches & branchHasHighTier ──────────────────────────────

describe('countHighBranches', () => {
  it('returns 0 when no row-3+ perks are unlocked', () => {
    const prog = progAt(2, 0, ['set_piece_coach', 'motivator']);
    expect(countHighBranches(prog)).toBe(0);
  });

  it('counts each branch with at least one row-3+ perk exactly once', () => {
    const prog = progAt(15, 0, [
      // Tactician row 3 (formation_master) requires the full chain.
      'set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master',
      // Motivator row 3 (fortress_mentality) requires its full chain.
      'motivator', 'media_savvy', 'fan_favourite', 'fortress_mentality',
    ]);
    expect(countHighBranches(prog)).toBe(2);
  });

  it('does not double-count multiple high perks in the same branch', () => {
    const prog = progAt(15, 0, [
      'set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master', 'iron_will',
    ]);
    expect(countHighBranches(prog)).toBe(1);
  });
});

describe('branchHasHighTier', () => {
  it('returns false when only row 0-2 perks are unlocked', () => {
    const prog = progAt(5, 0, ['set_piece_coach', 'tactical_genius', 'disciplinarian']);
    expect(branchHasHighTier('tactician', prog)).toBe(false);
  });

  it('returns true once a row-3+ perk is unlocked', () => {
    const prog = progAt(8, 0, [
      'set_piece_coach', 'tactical_genius', 'disciplinarian', 'formation_master',
    ]);
    expect(branchHasHighTier('tactician', prog)).toBe(true);
  });

  it('is independent across branches', () => {
    const prog = progAt(8, 0, [
      'motivator', 'media_savvy', 'fan_favourite', 'fortress_mentality',
    ]);
    expect(branchHasHighTier('motivator', prog)).toBe(true);
    expect(branchHasHighTier('tactician', prog)).toBe(false);
  });
});

// ── getSpecializationTitle ────────────────────────────────────────────

describe('getSpecializationTitle', () => {
  it('returns empty string when no perks are unlocked', () => {
    expect(getSpecializationTitle(progAt(1, 0))).toBe('');
  });

  it('returns the dominant branch title', () => {
    const prog = progAt(10, 0, ['set_piece_coach', 'tactical_genius', 'disciplinarian']);
    expect(getSpecializationTitle(prog)).toBe('The Tactician');
    const prog2 = progAt(10, 0, ['motivator', 'media_savvy']);
    expect(getSpecializationTitle(prog2)).toBe('The Motivator');
  });

  it('returns "The All-Rounder" when branches are tied', () => {
    const prog = progAt(10, 0, ['set_piece_coach', 'motivator']);
    expect(getSpecializationTitle(prog)).toBe('The All-Rounder');
  });
});

// ── getPrerequisiteChain & getNextPerk ───────────────────────────────

describe('getPrerequisiteChain', () => {
  it('is empty for tier-1 perks', () => {
    const setPieceCoach = MANAGER_PERKS.find(p => p.id === 'set_piece_coach')!;
    expect(getPrerequisiteChain(setPieceCoach)).toEqual([]);
  });

  it('returns the full chain bottom → top for deep perks', () => {
    const ironWill = MANAGER_PERKS.find(p => p.id === 'iron_will')!;
    const chain = getPrerequisiteChain(ironWill);
    expect(chain.map(p => p.id)).toEqual([
      'set_piece_coach',
      'tactical_genius',
      'disciplinarian',
      'formation_master',
    ]);
  });

  it('walks past prestige-required perks too', () => {
    const counterMaster = MANAGER_PERKS.find(p => p.id === 'counter_master')!;
    const chain = getPrerequisiteChain(counterMaster);
    expect(chain[chain.length - 1].id).toBe('iron_will');
  });
});

describe('getNextPerk', () => {
  it('returns the next perk in a branch', () => {
    const setPieceCoach = MANAGER_PERKS.find(p => p.id === 'set_piece_coach')!;
    const next = getNextPerk(setPieceCoach);
    expect(next?.id).toBe('tactical_genius');
  });

  it('returns undefined for terminal perks', () => {
    const dnaCoach = MANAGER_PERKS.find(p => p.id === 'dna_coach')!;
    expect(getNextPerk(dnaCoach)).toBeUndefined();
  });
});

// ── Misc helpers ──────────────────────────────────────────────────────

describe('hasPerk', () => {
  it('returns true when the perk is in unlockedPerks', () => {
    const prog = progAt(5, 0, ['dynasty_builder']);
    expect(hasPerk(prog, 'dynasty_builder')).toBe(true);
  });

  it('returns false otherwise', () => {
    const prog = progAt(5, 0, []);
    expect(hasPerk(prog, 'dynasty_builder')).toBe(false);
  });
});

describe('dynastyMult', () => {
  it('returns 1.1 when Dynasty Builder is unlocked', () => {
    expect(dynastyMult(progAt(5, 0, ['dynasty_builder']))).toBe(1.1);
  });

  it('returns 1 otherwise', () => {
    expect(dynastyMult(progAt(5, 0))).toBe(1);
  });
});

describe('getCapstonePerk & getBranchPerks', () => {
  it('getCapstonePerk returns the dynasty_builder perk', () => {
    expect(getCapstonePerk().id).toBe('dynasty_builder');
  });

  it('getBranchPerks returns perks for a branch sorted by row', () => {
    const tactician = getBranchPerks('tactician');
    expect(tactician[0].row).toBeLessThanOrEqual(tactician[tactician.length - 1].row);
    expect(tactician.every(p => p.branch === 'tactician')).toBe(true);
  });
});

describe('XP_REWARDS shape', () => {
  it('rewards scale: titleWin > cupWin > seasonEnd > win > draw', () => {
    expect(XP_REWARDS.titleWin).toBeGreaterThan(XP_REWARDS.cupWin);
    expect(XP_REWARDS.cupWin).toBeGreaterThan(XP_REWARDS.seasonEnd);
    expect(XP_REWARDS.seasonEnd).toBeGreaterThan(XP_REWARDS.win);
    expect(XP_REWARDS.win).toBeGreaterThan(XP_REWARDS.draw);
  });

  it('continental rewards scale: champions > shield > conference > league cup', () => {
    expect(XP_REWARDS.championsCupWin).toBeGreaterThan(XP_REWARDS.shieldCupWin);
    expect(XP_REWARDS.shieldCupWin).toBeGreaterThan(XP_REWARDS.conferenceCupWin);
    expect(XP_REWARDS.conferenceCupWin).toBeGreaterThan(XP_REWARDS.leagueCupWin);
  });
});
