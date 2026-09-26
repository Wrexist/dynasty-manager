/**
 * Ballon d'Or top-10 reign — temporary stats boost + special card.
 *
 * When a player finishes in the Ballon d'Or top 10 at season end, they earn
 * a flat stats boost across all six attributes and the special `ballondor.webp`
 * card. The reign lasts exactly one Ballon d'Or cycle: at the next season's
 * award ceremony, players who keep their top-10 spot have the boost refreshed,
 * and players who drop out have their boost reverted (deltas subtracted) and
 * their card returns to the normal tier.
 *
 * Deltas (not absolute snapshots) are stored so growth, training, and decline
 * that happen *during* the reign survive the revert.
 *
 * `overall` moves by a delta too, never by recomputing it from attributes.
 * Real players carry authored ratings that sit above `calculateOverall` (95% of
 * them, by up to +15 — see `applyPlayerDevelopment`), so recomputing turned a
 * "boost" into a demotion: an 89 became a 77 on the boost and a 74 on the
 * revert, and his wage fell ~8x with it. The applied overall delta is stored
 * so the revert takes back exactly what the boost gave.
 */

import type { Player, PlayerAttributes } from '@/types/game';
import { clamp } from '@/utils/helpers';
import { calculateOverall } from '@/utils/playerGen';
import { recomputeDerivedEconomics } from '@/utils/playerEconomics';
import { BALLON_DOR_TOP10_ATTR_BOOST } from '@/config/gameBalance';

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
  // Career pedigree, distinct from the reign: set once, never reverted.
  // `isLegendWorthy` reads this decades later, when the reign markers and the
  // boost itself are long gone.
  player.ballonDorTop10Ever = true;
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

  const before = player.overall;
  const overallDelta = calculateOverall(nextAttrs, player.position) - calculateOverall(player.attributes, player.position);
  player.attributes = nextAttrs;
  player.overall = clamp(before + overallDelta);
  player.ballonDOrTop10BoostDeltas = deltas;
  player.ballonDOrTop10OverallDelta = player.overall - before;
  player.ballonDOrTop10HoldSeason = season;
  recomputeDerivedEconomics(player);
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
  // Boosts applied before the overall delta was recorded fall back to what
  // the formula says the attribute change was worth.
  const overallDelta = typeof player.ballonDOrTop10OverallDelta === 'number'
    ? player.ballonDOrTop10OverallDelta
    : calculateOverall(player.attributes, player.position) - calculateOverall(nextAttrs, player.position);
  player.attributes = nextAttrs;
  player.overall = clamp(player.overall - overallDelta);
  delete player.ballonDOrTop10BoostDeltas;
  delete player.ballonDOrTop10OverallDelta;
  delete player.ballonDOrTop10HoldSeason;
  // Shared pricing model (rarity × age × placement premium × wageFactor).
  recomputeDerivedEconomics(player);
  return player;
}
