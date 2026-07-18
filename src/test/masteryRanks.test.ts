/**
 * Mastery Ranks — the post-tree XP sink.
 *
 * Once every base-tree (non-prestige) perk is owned, surplus lifetime XP
 * converts into derived mastery ranks that scale dynastyMult. Bugs here
 * either leave late-game XP dead (the problem the feature exists to fix)
 * or let the multiplier run away and distort the sim.
 */

import { describe, it, expect } from 'vitest';

import {
  MANAGER_PERKS,
  getLifetimeXP,
  isBaseTreeComplete,
  getMasteryRank,
  getMasteryBonus,
  getMasteryProgress,
  dynastyMult,
  xpForLevel,
} from '@/utils/managerPerks';
import {
  MASTERY_XP_PER_RANK,
  MASTERY_BONUS_PER_RANK,
  MASTERY_BONUS_CAP,
} from '@/config/gameBalance';
import type { ManagerProgression, PerkId } from '@/types/game';

const BASE_PERK_IDS = MANAGER_PERKS.filter(p => !p.prestigeRequired).map(p => p.id as PerkId);
const BASE_TREE_COST = MANAGER_PERKS.filter(p => !p.prestigeRequired).reduce((s, p) => s + p.cost, 0);

/** Build a progression whose lifetime XP equals `lifetime` (level-walked like grantXP would). */
function progWithLifetime(lifetime: number, unlocked: PerkId[]): ManagerProgression {
  let level = 1;
  let xp = lifetime;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return { level, xp, unlockedPerks: unlocked, prestigeLevel: 0 };
}

describe('mastery eligibility', () => {
  it('is zero while any base perk is missing, regardless of XP surplus', () => {
    const missingOne = BASE_PERK_IDS.slice(0, -1);
    const prog = progWithLifetime(BASE_TREE_COST + 10 * MASTERY_XP_PER_RANK, missingOne);
    expect(isBaseTreeComplete(prog)).toBe(false);
    expect(getMasteryRank(prog)).toBe(0);
    expect(getMasteryProgress(prog)).toBeNull();
  });

  it('activates at rank 0 exactly when the tree completes with no surplus', () => {
    const prog = progWithLifetime(BASE_TREE_COST, BASE_PERK_IDS);
    expect(isBaseTreeComplete(prog)).toBe(true);
    expect(getMasteryRank(prog)).toBe(0);
    expect(getMasteryBonus(prog)).toBe(0);
  });
});

describe('mastery rank math', () => {
  it('grants one rank per MASTERY_XP_PER_RANK of surplus lifetime XP', () => {
    const prog = progWithLifetime(BASE_TREE_COST + 3 * MASTERY_XP_PER_RANK + 1, BASE_PERK_IDS);
    expect(getMasteryRank(prog)).toBe(3);
    expect(getMasteryBonus(prog)).toBeCloseTo(3 * MASTERY_BONUS_PER_RANK);
  });

  it('caps the bonus at MASTERY_BONUS_CAP no matter how much XP accrues', () => {
    const hugeRanks = Math.ceil(MASTERY_BONUS_CAP / MASTERY_BONUS_PER_RANK) * 10;
    const prog = progWithLifetime(BASE_TREE_COST + hugeRanks * MASTERY_XP_PER_RANK, BASE_PERK_IDS);
    expect(getMasteryBonus(prog)).toBe(MASTERY_BONUS_CAP);
    expect(getMasteryProgress(prog)?.capped).toBe(true);
  });

  it('does not lose ranks when prestige perks are later purchased (monotonic)', () => {
    const lifetime = BASE_TREE_COST + 4 * MASTERY_XP_PER_RANK;
    const withoutPrestigePerk = progWithLifetime(lifetime, BASE_PERK_IDS);
    const withPrestigePerk = progWithLifetime(lifetime, [...BASE_PERK_IDS, 'counter_master' as PerkId]);
    expect(getMasteryRank(withPrestigePerk)).toBe(getMasteryRank(withoutPrestigePerk));
  });

  it('lifetime XP ignores perk spend', () => {
    const a = progWithLifetime(5000, []);
    const b = progWithLifetime(5000, BASE_PERK_IDS.slice(0, 5));
    expect(getLifetimeXP(a)).toBe(getLifetimeXP(b));
  });
});

describe('dynastyMult with mastery', () => {
  it('stays 1.1 for dynasty_builder alone (pre-endgame saves unaffected)', () => {
    const prog: ManagerProgression = { level: 5, xp: 0, unlockedPerks: ['dynasty_builder'], prestigeLevel: 0 };
    expect(dynastyMult(prog)).toBe(1.1);
  });

  it('adds mastery bonus on top of the capstone once the tree is complete', () => {
    const prog = progWithLifetime(BASE_TREE_COST + 2 * MASTERY_XP_PER_RANK, BASE_PERK_IDS);
    expect(dynastyMult(prog)).toBeCloseTo(1.1 + 2 * MASTERY_BONUS_PER_RANK);
  });

  it('never exceeds 1.1 + cap', () => {
    const hugeRanks = Math.ceil(MASTERY_BONUS_CAP / MASTERY_BONUS_PER_RANK) * 10;
    const prog = progWithLifetime(BASE_TREE_COST + hugeRanks * MASTERY_XP_PER_RANK, BASE_PERK_IDS);
    expect(dynastyMult(prog)).toBeCloseTo(1.1 + MASTERY_BONUS_CAP);
  });
});
