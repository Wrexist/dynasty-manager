/**
 * Player rarity tier — derivation, multipliers, and integration with the
 * value/wage chain.
 *
 * The rarity ladder pins the long-tail balance of the transfer market:
 *   common → rare → star → icon → legend
 *
 * A regression here cascades into market values, wage demands, contract
 * negotiation, and pack pulls — coverage is high-leverage.
 */

import { describe, it, expect } from 'vitest';
import {
  getPlayerRarity, getRarityValueMultiplier, getRarityWageMultiplier,
  applyRarityToPlayer, getRarityLabel, isHypedRarity,
} from '@/utils/playerRarity';
import {
  RARITY_VALUE_MULTIPLIERS, RARITY_WAGE_MULTIPLIERS,
  RARITY_LEGEND_OVR, RARITY_LEGEND_OVR_FLOOR,
  RARITY_ICON_OVR, RARITY_STAR_OVR, RARITY_RARE_OVR,
} from '@/config/gameBalance';
import type { BallonDOrPlacement } from '@/types/game';

const placement = (rank: number, season = 1): BallonDOrPlacement => ({ rank, season, score: 100 });

describe('getPlayerRarity — OVR-only derivation', () => {
  it('classifies sub-75 OVR as common', () => {
    expect(getPlayerRarity({ overall: 50, ballonDOrPlacements: [] })).toBe('common');
    expect(getPlayerRarity({ overall: 74, ballonDOrPlacements: [] })).toBe('common');
  });

  it('classifies OVR 75-81 as rare', () => {
    expect(getPlayerRarity({ overall: 75, ballonDOrPlacements: [] })).toBe('rare');
    expect(getPlayerRarity({ overall: 81, ballonDOrPlacements: [] })).toBe('rare');
  });

  it('classifies OVR 82-87 as star', () => {
    expect(getPlayerRarity({ overall: 82, ballonDOrPlacements: [] })).toBe('star');
    expect(getPlayerRarity({ overall: 87, ballonDOrPlacements: [] })).toBe('star');
  });

  it('classifies OVR 88-89 as icon (no awards required)', () => {
    expect(getPlayerRarity({ overall: 88, ballonDOrPlacements: [] })).toBe('icon');
    expect(getPlayerRarity({ overall: 89, ballonDOrPlacements: [] })).toBe('icon');
  });

  it('classifies OVR 90-92 without awards as icon (NOT legend)', () => {
    // Award-less 90+ players are still icons. Legend status must be earned.
    expect(getPlayerRarity({ overall: 90, ballonDOrPlacements: [] })).toBe('icon');
    expect(getPlayerRarity({ overall: 92, ballonDOrPlacements: [] })).toBe('icon');
  });

  it('classifies OVR 93+ as legend regardless of awards', () => {
    expect(getPlayerRarity({ overall: 93, ballonDOrPlacements: [] })).toBe('legend');
    expect(getPlayerRarity({ overall: 99, ballonDOrPlacements: [] })).toBe('legend');
  });

  it('boundary: thresholds match config constants', () => {
    expect(RARITY_LEGEND_OVR_FLOOR).toBeGreaterThan(RARITY_LEGEND_OVR);
    expect(RARITY_LEGEND_OVR).toBeGreaterThan(RARITY_ICON_OVR);
    expect(RARITY_ICON_OVR).toBeGreaterThan(RARITY_STAR_OVR);
    expect(RARITY_STAR_OVR).toBeGreaterThan(RARITY_RARE_OVR);
  });
});

describe('getPlayerRarity — Ballon d\'Or pedigree', () => {
  it('promotes OVR 90+ to legend with one top-3 placement', () => {
    expect(getPlayerRarity({ overall: 90, ballonDOrPlacements: [placement(3)] })).toBe('legend');
    expect(getPlayerRarity({ overall: 91, ballonDOrPlacements: [placement(1)] })).toBe('legend');
  });

  it('promotes OVR 90+ to legend with three top-25 placements', () => {
    expect(getPlayerRarity({
      overall: 90,
      ballonDOrPlacements: [placement(15), placement(20), placement(8)],
    })).toBe('legend');
  });

  it('does NOT promote OVR 89 to legend even with top-3 hardware', () => {
    // Legend requires elite OVR floor — a former Ballon d'Or winner who
    // declined to 89 is no longer "legend" tier in raw value terms.
    expect(getPlayerRarity({ overall: 89, ballonDOrPlacements: [placement(1)] })).toBe('icon');
  });

  it('does NOT promote OVR 88 to legend with only one top-25', () => {
    expect(getPlayerRarity({ overall: 88, ballonDOrPlacements: [placement(20)] })).toBe('icon');
  });

  it('handles missing ballonDOrPlacements field safely', () => {
    expect(getPlayerRarity({ overall: 85 })).toBe('star');
    expect(getPlayerRarity({ overall: 92 })).toBe('icon');
  });
});

describe('rarity multipliers — invariants', () => {
  it('value multipliers are strictly increasing along the ladder', () => {
    expect(RARITY_VALUE_MULTIPLIERS.legend).toBeGreaterThan(RARITY_VALUE_MULTIPLIERS.icon);
    expect(RARITY_VALUE_MULTIPLIERS.icon).toBeGreaterThan(RARITY_VALUE_MULTIPLIERS.star);
    expect(RARITY_VALUE_MULTIPLIERS.star).toBeGreaterThan(RARITY_VALUE_MULTIPLIERS.rare);
    expect(RARITY_VALUE_MULTIPLIERS.rare).toBeGreaterThanOrEqual(RARITY_VALUE_MULTIPLIERS.common);
  });

  it('wage multipliers are strictly increasing along the ladder', () => {
    expect(RARITY_WAGE_MULTIPLIERS.legend).toBeGreaterThan(RARITY_WAGE_MULTIPLIERS.icon);
    expect(RARITY_WAGE_MULTIPLIERS.icon).toBeGreaterThan(RARITY_WAGE_MULTIPLIERS.star);
    expect(RARITY_WAGE_MULTIPLIERS.star).toBeGreaterThanOrEqual(RARITY_WAGE_MULTIPLIERS.rare);
    expect(RARITY_WAGE_MULTIPLIERS.rare).toBeGreaterThanOrEqual(RARITY_WAGE_MULTIPLIERS.common);
  });

  it('common multipliers are exactly 1.0 (no-op baseline)', () => {
    expect(RARITY_VALUE_MULTIPLIERS.common).toBe(1);
    expect(RARITY_WAGE_MULTIPLIERS.common).toBe(1);
  });

  it('legend value premium is meaningful (≥ 2× baseline)', () => {
    // Legends should feel hype — not a marginal 5% bump.
    expect(RARITY_VALUE_MULTIPLIERS.legend).toBeGreaterThanOrEqual(2);
  });

  it('getRarityValueMultiplier handles undefined as common', () => {
    expect(getRarityValueMultiplier(undefined)).toBe(1);
  });

  it('getRarityWageMultiplier handles undefined as common', () => {
    expect(getRarityWageMultiplier(undefined)).toBe(1);
  });
});

describe('applyRarityToPlayer — mutation helper', () => {
  it('writes the computed rarity onto the player object', () => {
    const p = { overall: 91, ballonDOrPlacements: [placement(1)], rarity: undefined as undefined };
    applyRarityToPlayer(p);
    expect(p.rarity).toBe('legend');
  });

  it('returns the same reference for chaining', () => {
    const p = { overall: 70 };
    expect(applyRarityToPlayer(p)).toBe(p);
  });

  it('updates rarity when overall changes (decline scenario)', () => {
    const p = { overall: 91, ballonDOrPlacements: [placement(2)], rarity: 'legend' as const };
    p.overall = 86; // age-related decline
    applyRarityToPlayer(p);
    expect(p.rarity).toBe('star');
  });
});

describe('rarity labels and hype', () => {
  it('returns human-readable labels', () => {
    expect(getRarityLabel('legend')).toBe('Legend');
    expect(getRarityLabel('icon')).toBe('Icon');
    expect(getRarityLabel('star')).toBe('Star');
    expect(getRarityLabel('rare')).toBe('Rare');
    expect(getRarityLabel('common')).toBe('Squad');
    expect(getRarityLabel(undefined)).toBe('Squad');
  });

  it('flags only legend and icon as hyped (walkout-worthy)', () => {
    expect(isHypedRarity('legend')).toBe(true);
    expect(isHypedRarity('icon')).toBe(true);
    expect(isHypedRarity('star')).toBe(false);
    expect(isHypedRarity('rare')).toBe(false);
    expect(isHypedRarity('common')).toBe(false);
    expect(isHypedRarity(undefined)).toBe(false);
  });
});
