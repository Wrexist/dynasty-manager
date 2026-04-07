import type { FormationSlot, ChemistryLink } from '@/types/game';
import {
  getFamiliarityCap,
  CHEMISTRY_LINE_COLOR_STRONG,
  CHEMISTRY_LINE_COLOR_ESTABLISHED,
  CHEMISTRY_LINE_COLOR_DEVELOPING,
} from '@/config/chemistry';

/**
 * Generate lines only between slot pairs that have actual chemistry links.
 * Maps chemistry links back to lineup slot indices for SVG rendering.
 */
export function getChemistryLines(
  slots: FormationSlot[],
  links: ChemistryLink[],
  playerIds: string[],
): [number, number][] {
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < playerIds.length; i++) {
    if (playerIds[i]) idToIndex.set(playerIds[i], i);
  }

  const seen = new Set<string>();
  const lines: [number, number][] = [];

  for (const link of links) {
    const idxA = idToIndex.get(link.playerIdA);
    const idxB = idToIndex.get(link.playerIdB);
    if (idxA === undefined || idxB === undefined) continue;
    if (idxA >= slots.length || idxB >= slots.length) continue;

    const key = idxA < idxB ? `${idxA}-${idxB}` : `${idxB}-${idxA}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push([idxA, idxB]);
  }

  return lines;
}

/**
 * Build a map from sorted player-ID pair key to the strongest chemistry strength.
 * Used to color formation lines by chemistry quality.
 */
export function buildChemistryStrengthMap(
  links: ChemistryLink[],
  pairFamiliarity?: Record<string, number>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const link of links) {
    const key = link.playerIdA < link.playerIdB
      ? `${link.playerIdA}-${link.playerIdB}`
      : `${link.playerIdB}-${link.playerIdA}`;
    const existing = map.get(key);
    if (!existing || link.strength > existing) {
      map.set(key, link.strength);
    }
  }
  // Cap displayed strength by pair familiarity (matches played together)
  if (pairFamiliarity) {
    for (const [key, strength] of map) {
      const familiarity = pairFamiliarity[key] || 0;
      const cap = getFamiliarityCap(familiarity);
      if (strength > cap) {
        if (cap <= 0) {
          map.delete(key);
        } else {
          map.set(key, cap);
        }
      }
    }
  }
  return map;
}

/** Chemistry line color: green (strong), yellow (established), dim white (developing). */
export function getChemistryLineColor(strength: number): string {
  if (strength >= 3) return CHEMISTRY_LINE_COLOR_STRONG;
  if (strength >= 2) return CHEMISTRY_LINE_COLOR_ESTABLISHED;
  return CHEMISTRY_LINE_COLOR_DEVELOPING;
}

