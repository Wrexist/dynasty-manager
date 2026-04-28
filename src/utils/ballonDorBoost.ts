/**
 * Ballon d'Or top-10 reign — temporary stats boost + special card.
 *
 * When a player finishes in the Ballon d'Or top 10 at season end, they earn
 * a flat stats boost across all six attributes and the special `ballondor.png`
 * card. The reign lasts exactly one Ballon d'Or cycle: at the next season's
 * award ceremony, players who keep their top-10 spot have the boost refreshed,
 * and players who drop out have their boost reverted (deltas subtracted) and
 * their card returns to the normal tier.
 *
 * Deltas (not absolute snapshots) are stored so growth, training, and decline
 * that happen *during* the reign survive the revert.
 */

import type { Player, PlayerAttributes } from '@/types/game';
import { clamp } from '@/utils/helpers';
import { calculateOverall } from '@/utils/playerGen';
import { calculatePlayerValue, calculatePlayerWage } from '@/config/playerGeneration';
import { getPlayerRarity, getRarityValueMultiplier, getRarityWageMultiplier } from '@/utils/playerRarity';
import { BALLON_DOR_TOP10_ATTR_BOOST, VALUE_AGE_MULTIPLIERS } from '@/config/gameBalance';

const ATTR_KEYS: (keyof PlayerAttributes)[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];

/** True iff the player is currently a reigning Ballon d'Or top-10 holder. */
export function hasBallonDorTop10Reign(player: Pick<Player, 'ballonDOrTop10HoldSeason'>): boolean {
  return typeof player.ballonDOrTop10HoldSeason === 'number';
}

/**
 * Apply (or refresh) the top-10 boost on a player. Mutates and returns the
 * same reference so callers inside `set()` reducers can chain.
 *
 * If the player already has an active boost (re-made the top 10 this year),
 * we skip re-applying the deltas — the boost from last cycle is still in
 * place — and just refresh `ballonDOrTop10HoldSeason` to the new season.
 */
export function applyBallonDorTop10Boost<T extends Player>(player: T, season: number): T {
  if (hasBallonDorTop10Reign(player)) {
    // Already boosted from last cycle — refresh the reign marker only.
    player.ballonDOrTop10HoldSeason = season;
    return player;
  }

  const nextAttrs: PlayerAttributes = { ...player.attributes };
  const deltas: Partial<PlayerAttributes> = {};
  for (const attr of ATTR_KEYS) {
    const before = nextAttrs[attr];
    const after = clamp(before + BALLON_DOR_TOP10_ATTR_BOOST);
    nextAttrs[attr] = after;
    if (after !== before) deltas[attr] = after - before;
  }

  player.attributes = nextAttrs;
  player.ballonDOrTop10BoostDeltas = deltas;
  player.ballonDOrTop10HoldSeason = season;
  recalculateDerivedFields(player);
  return player;
}

/**
 * Revert a player's top-10 boost. Subtracts the stored deltas, recomputes
 * overall/value/wage/rarity, and clears the reign markers. Safe to call on
 * a player without an active boost — it's a no-op.
 */
export function revertBallonDorTop10Boost<T extends Player>(player: T): T {
  const deltas = player.ballonDOrTop10BoostDeltas;
  if (!deltas) {
    // Defensive: clear any orphaned reign marker so display logic stays consistent.
    delete player.ballonDOrTop10HoldSeason;
    return player;
  }
  const nextAttrs: PlayerAttributes = { ...player.attributes };
  for (const attr of ATTR_KEYS) {
    const delta = deltas[attr];
    if (typeof delta === 'number') {
      nextAttrs[attr] = clamp(nextAttrs[attr] - delta);
    }
  }
  player.attributes = nextAttrs;
  delete player.ballonDOrTop10BoostDeltas;
  delete player.ballonDOrTop10HoldSeason;
  recalculateDerivedFields(player);
  return player;
}

/** Recompute overall/value/wage/rarity after an attribute change. */
function recalculateDerivedFields(player: Player): void {
  player.overall = calculateOverall(player.attributes, player.position);
  player.rarity = getPlayerRarity(player);
  let ageMult = 0.25;
  for (const tier of VALUE_AGE_MULTIPLIERS) {
    if (player.age <= tier.maxAge) { ageMult = tier.multiplier; break; }
  }
  const rarityValueMult = getRarityValueMultiplier(player.rarity);
  const rarityWageMult = getRarityWageMultiplier(player.rarity);
  player.value = Math.round(calculatePlayerValue(player.overall) * ageMult * rarityValueMult);
  player.wage = Math.round(calculatePlayerWage(player.overall) * rarityWageMult);
}
