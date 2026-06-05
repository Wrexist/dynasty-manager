import type { FormationSlot, ChemistryLink } from '@/types/game';
import {
  getFamiliarityCap,
  CHEMISTRY_LINE_COLOR_STRONG,
  CHEMISTRY_LINE_COLOR_ESTABLISHED,
  CHEMISTRY_LINE_COLOR_DEVELOPING,
} from '@/config/chemistry';

// Pitch geometry used to weight slot distances the same way the half-pitch is
// rendered (x → 64 SVG units, y → 54). Without this, the raw y values (which
// run 0–100 but are drawn compressed) would over-count vertical gaps and miss
// midfield → attack connections. Mirrors the mapping in LineupEditor.tsx.
const STRUCT_X_SCALE = 0.64;
const STRUCT_Y_SCALE = 0.54;
// Max rendered distance (SVG units) for two slots to be joined by a skeleton
// line. Tuned so each player links to its nearby teammates — including the
// midfield → forward chain — without fanning long diagonals across the pitch.
const STRUCT_MAX_DIST = 25;

/**
 * Structural "skeleton" lines for a formation — every pair of slots that sit
 * close together on the pitch, joined regardless of whether the players in
 * them have any chemistry link.
 *
 * This is deliberately distance-based rather than derived from the chemistry
 * `ADJACENT_PAIRS` config: that config intentionally omits some vertical links
 * (e.g. CM ↔ ST in a 4-3-3) for balance reasons, which left the pitch with no
 * lines crossing from midfield into attack. The skeleton is purely visual, so
 * it connects by proximity to always show the formation's full shape (defence
 * → midfield → attack). The brighter coloured chemistry lines are layered on
 * top for pairs that have actually built chemistry.
 */
export function getFormationStructureLines(slots: FormationSlot[]): [number, number][] {
  const lines: [number, number][] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dx = (slots[i].x - slots[j].x) * STRUCT_X_SCALE;
      const dy = (slots[i].y - slots[j].y) * STRUCT_Y_SCALE;
      if (Math.hypot(dx, dy) <= STRUCT_MAX_DIST) {
        lines.push([i, j]);
      }
    }
  }
  return lines;
}

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

