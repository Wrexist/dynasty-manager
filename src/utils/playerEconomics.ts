/**
 * Player derived economics — value, wage, rarity, age curve, BdO premium.
 *
 * Single source of truth for `player.value`, `player.wage`, and
 * `player.rarity`. Every code path that mutates `overall`, `attributes`,
 * `age`, or `ballonDOrPlacements` should call into this module so the
 * pricing model stays identical across generation, development, training,
 * transfers, packs, and award lifecycles.
 *
 * The formula:
 *   value = calculatePlayerValue(overall)
 *         × ageMultiplier(age)
 *         × rarityValueMultiplier(rarity)
 *         × ballonDorPlacementPremium(placements)
 *   wage  = calculatePlayerWage(overall)
 *         × rarityWageMultiplier(rarity)
 */

import type { Player, BallonDOrPlacement } from '@/types/game';
import { calculatePlayerValue, calculatePlayerWage } from '@/config/playerGeneration';
import { getPlayerRarity, getRarityValueMultiplier, getRarityWageMultiplier } from '@/utils/playerRarity';
import { VALUE_AGE_MULTIPLIERS } from '@/config/gameBalance';
import { getBallonDOrValueBoost } from '@/utils/ballonDor';

/** Resolve the age-bracket value multiplier from VALUE_AGE_MULTIPLIERS. */
export function getValueAgeMultiplier(age: number): number {
  for (const tier of VALUE_AGE_MULTIPLIERS) {
    if (age <= tier.maxAge) return tier.multiplier;
  }
  // VALUE_AGE_MULTIPLIERS already includes an Infinity terminal — defensive
  // fallback for empty arrays only.
  return 0.10;
}

/** Multiplier from cumulative Ballon d'Or placement boosts. Each placement
 *  compounds (a winner with two top-3 placements stacks both). */
export function getBallonDorPlacementPremium(placements: BallonDOrPlacement[] | undefined): number {
  if (!placements || placements.length === 0) return 1.0;
  let mult = 1.0;
  for (const p of placements) {
    mult *= 1 + getBallonDOrValueBoost(p.rank);
  }
  return mult;
}

/**
 * Recompute `player.rarity`, `player.value`, and `player.wage` from the
 * current overall/age/placements. Mutates in place.
 *
 * Use this after any meaningful change to overall (development, training,
 * decline, attribute boost) so all paths converge on the same pricing.
 */
export function recomputeDerivedEconomics(player: Player): void {
  player.rarity = getPlayerRarity(player);
  const ageMult = getValueAgeMultiplier(player.age);
  const rarityValueMult = getRarityValueMultiplier(player.rarity);
  const rarityWageMult = getRarityWageMultiplier(player.rarity);
  const placementMult = getBallonDorPlacementPremium(player.ballonDOrPlacements);
  player.value = Math.round(calculatePlayerValue(player.overall) * ageMult * rarityValueMult * placementMult);
  player.wage = Math.round(calculatePlayerWage(player.overall) * rarityWageMult);
}

/**
 * Recompute only `player.value` (and rarity) — leaves wage untouched.
 *
 * Used by paths that already set wage at generation time and don't want
 * the small random factor inside `calculatePlayerWage` to drift on every
 * recompute (e.g. the star/veteran boost in `generateSquad`, where the
 * original game flow only refreshed value). Preserves the historical
 * Math.random() call sequence so seeded tests stay deterministic.
 */
export function recomputePlayerValueOnly(player: Player): void {
  player.rarity = getPlayerRarity(player);
  const ageMult = getValueAgeMultiplier(player.age);
  const rarityValueMult = getRarityValueMultiplier(player.rarity);
  const placementMult = getBallonDorPlacementPremium(player.ballonDOrPlacements);
  player.value = Math.round(calculatePlayerValue(player.overall) * ageMult * rarityValueMult * placementMult);
}
