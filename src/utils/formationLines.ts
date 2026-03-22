import type { FormationSlot, ChemistryLink } from '@/types/game';

/** Compute formation connection lines between adjacent players by row proximity. */
export function getFormationLines(slots: FormationSlot[]): [number, number][] {
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
 * Build a map from sorted player-ID pair key to the strongest chemistry strength.
 * Used to color formation lines by chemistry quality.
 */
export function buildChemistryStrengthMap(links: ChemistryLink[]): Map<string, number> {
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
  return map;
}

/** FIFA-style line color: green (strong), yellow (moderate), red (weak). */
export function getChemistryLineColor(strength: number): string {
  if (strength >= 3) return '#22c55e';
  if (strength >= 2) return '#eab308';
  return '#ef4444';
}

/** Neutral color for formation lines with no chemistry data. */
export const NEUTRAL_LINE_COLOR = 'rgba(255,255,255,0.18)';
