import type { Player, PlayerRarity } from '@/types/game';
import {
  RARITY_LEGEND_OVR, RARITY_LEGEND_OVR_FLOOR, RARITY_ICON_OVR,
  RARITY_STAR_OVR, RARITY_RARE_OVR,
  RARITY_LEGEND_TOP3_PLACEMENTS, RARITY_LEGEND_TOP25_PLACEMENTS,
  RARITY_ICON_TOP25_PLACEMENTS,
  RARITY_VALUE_MULTIPLIERS, RARITY_WAGE_MULTIPLIERS,
} from '@/config/gameBalance';

/**
 * Compute a player's rarity tier from their overall rating and award history.
 *
 * The tier ladder rewards both raw quality and earned reputation:
 *   - OVR ≥ 93                                      → legend
 *   - OVR ≥ 90 + ≥1 Ballon d'Or top-3 placement     → legend
 *   - OVR ≥ 90 + ≥3 Ballon d'Or top-25 placements   → legend
 *   - OVR ≥ 90 (no awards yet)                      → icon
 *   - OVR ≥ 88 + ≥1 Ballon d'Or top-25 placement    → icon
 *   - OVR ≥ 88                                      → icon
 *   - OVR ≥ 82                                      → star
 *   - OVR ≥ 75                                      → rare
 *   - else                                          → common
 *
 * Pure function — no side effects, safe to call inside selectors and
 * memoised React renders.
 */
export function getPlayerRarity(player: Pick<Player, 'overall' | 'ballonDOrPlacements'>): PlayerRarity {
  const ovr = player.overall;
  const placements = player.ballonDOrPlacements ?? [];
  const top3 = placements.filter(p => p.rank <= 3).length;
  const top25 = placements.length;

  // Legend: must combine elite OVR with either an OVR floor or award pedigree.
  if (ovr >= RARITY_LEGEND_OVR_FLOOR) return 'legend';
  if (ovr >= RARITY_LEGEND_OVR && top3 >= RARITY_LEGEND_TOP3_PLACEMENTS) return 'legend';
  if (ovr >= RARITY_LEGEND_OVR && top25 >= RARITY_LEGEND_TOP25_PLACEMENTS) return 'legend';

  // Icon: world-class baseline, optionally award-touched.
  if (ovr >= RARITY_ICON_OVR) return 'icon';
  if (ovr >= RARITY_LEGEND_OVR) return 'icon'; // unreachable in practice — kept defensive
  if (ovr >= RARITY_ICON_OVR - 1 && top25 >= RARITY_ICON_TOP25_PLACEMENTS) return 'icon';

  if (ovr >= RARITY_STAR_OVR) return 'star';
  if (ovr >= RARITY_RARE_OVR) return 'rare';
  return 'common';
}

/** Value multiplier for the player's current rarity tier. */
export function getRarityValueMultiplier(rarity: PlayerRarity | undefined): number {
  return RARITY_VALUE_MULTIPLIERS[rarity ?? 'common'];
}

/** Wage multiplier for the player's current rarity tier. */
export function getRarityWageMultiplier(rarity: PlayerRarity | undefined): number {
  return RARITY_WAGE_MULTIPLIERS[rarity ?? 'common'];
}

/**
 * Recompute and assign the rarity tier on a Player in-place. Returns the
 * same reference for fluent chaining inside Zustand `set` reducers that
 * already spread a fresh object.
 *
 * Use this after any mutation to `overall` or `ballonDOrPlacements`.
 */
export function applyRarityToPlayer<T extends Pick<Player, 'overall' | 'ballonDOrPlacements'> & { rarity?: PlayerRarity }>(
  player: T,
): T {
  player.rarity = getPlayerRarity(player);
  return player;
}

/** Human-friendly label for UI (badges, tooltips, modal headers). */
export function getRarityLabel(rarity: PlayerRarity | undefined): string {
  switch (rarity) {
    case 'legend': return 'Legend';
    case 'icon': return 'Icon';
    case 'star': return 'Star';
    case 'rare': return 'Rare';
    case 'common':
    default: return 'Squad';
  }
}

/** True when the rarity tier should trigger walkout / hype effects. */
export function isHypedRarity(rarity: PlayerRarity | undefined): boolean {
  return rarity === 'legend' || rarity === 'icon';
}
