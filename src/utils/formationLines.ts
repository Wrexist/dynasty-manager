import type { FormationSlot, ChemistryLink } from '@/types/game';
import {
  getFamiliarityCap,
  CHEMISTRY_LINE_COLOR_STRONG,
  CHEMISTRY_LINE_COLOR_ESTABLISHED,
  CHEMISTRY_LINE_COLOR_DEVELOPING,
} from '@/config/chemistry';

/**
 * Compute formation connection lines between adjacent players by row proximity.
 * Used for away-team display and fallback when no chemistry data is available.
 */
export function getFormationStructureLines(slots: FormationSlot[]): [number, number][] {
  // Group slots into rows by y-coordinate (within 12 units = same row)
  const indexed = slots.map((s, i) => ({ ...s, idx: i }));
  indexed.sort((a, b) => a.y - b.y);

  const rows: { idx: number; x: number; y: number }[][] = [];
  for (const s of indexed) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(s.y - lastRow[0].y) < 12) {
      lastRow.push({ idx: s.idx, x: s.x, y: s.y });
    } else {
      rows.push([{ idx: s.idx, x: s.x, y: s.y }]);
    }
  }

  // Sort each row by x
  rows.forEach(row => row.sort((a, b) => a.x - b.x));

  const lines: [number, number][] = [];

  // Connect within each row (adjacent players)
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      lines.push([row[i].idx, row[i + 1].idx]);
    }
  }

  // Connect between adjacent rows
  for (let r = 0; r < rows.length - 1; r++) {
    const upper = rows[r];
    const lower = rows[r + 1];
    for (const u of upper) {
      // Connect to the 1-2 nearest players in the next row
      const sorted = [...lower].sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x));
      const nearest = sorted.slice(0, Math.min(2, sorted.length));
      for (const n of nearest) {
        // Only connect if horizontally close enough (within 45 units on the 0-100 scale)
        if (Math.abs(n.x - u.x) <= 45) {
          lines.push([u.idx, n.idx]);
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return lines.filter(([a, b]) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/** Neutral color for structural formation lines with no chemistry data. */
export const NEUTRAL_LINE_COLOR = 'rgba(255,255,255,0.18)';
