/**
 * The one player shape every cross-dataset operation compares on, plus the
 * matcher itself.
 *
 * Comparison and the potential merge both need "is this the same player in
 * both files?". They previously each carried their own copy of the mapping,
 * which is how two answers to one question start drifting apart.
 */
import { parseCsv } from './csv.mjs';

/**
 * Fold accents and punctuation so "Nicolò Barella" and "Nicolo Barella" agree.
 * The character class is the Unicode combining-diacritic block, spelled in
 * escapes so the source stays readable in any editor.
 */
export function normName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/** EA ratings URLs end in the player's id, which is the SoFIFA id space. */
export const idFromEaUrl = (url) => {
  const m = String(url ?? '').match(/\/(\d+)\/?$/);
  return m ? m[1] : '';
};

/**
 * A normalized FC27 row -> comparable shape.
 * Used for both sides of the merge and the current side of the comparison.
 */
export const fromNormalizedRow = (row) => ({
  id: String(row.player_id ?? ''),
  name: row.name || '',
  longName: [row.first_name, row.last_name].filter(Boolean).join(' '),
  dob: row.date_of_birth || '',
  club: row.club || '',
  league: row.league || '',
  position: row.position || '',
  overall: numOrNull(row.overall),
  potential: numOrNull(row.potential),
});

/** A SoFIFA-shaped baseline row -> comparable shape. */
const fromSofifaRow = (r) => ({
  id: String(r.player_id ?? ''),
  name: r.short_name || r.long_name || '',
  longName: r.long_name || '',
  dob: r.dob || '',
  club: r.club_name || '',
  league: r.league_name || '',
  position: String(r.player_positions || '').split(',')[0].trim(),
  overall: numOrNull(r.overall),
  potential: numOrNull(r.potential),
});

/** An EA-ratings-shaped baseline row (the FC25 export) -> comparable shape. */
const fromEaRatingsRow = (r) => ({
  id: idFromEaUrl(r.url),
  name: r.Name || '',
  longName: r.Name || '',
  dob: '',
  club: r.Team || '',
  league: r.League || '',
  position: r.Position || '',
  overall: numOrNull(r.OVR),
  potential: null,
});

/**
 * Read any supported dataset into the comparable shape, detecting which of the
 * three schemas it is from its columns.
 * @param {string} text CSV contents
 */
export function readComparable(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const columns = rows[0];
  if ('player_id' in columns && 'club_name' in columns) return rows.map(fromSofifaRow);
  if ('player_id' in columns) return rows.map(fromNormalizedRow);
  return rows.map(fromEaRatingsRow);
}

/** Index by key, discarding keys more than one row claims. */
function uniqueIndex(rows, keyFn) {
  const map = new Map();
  const collided = new Set();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (map.has(key)) { collided.add(key); continue; }
    map.set(key, row);
  }
  for (const key of collided) map.delete(key);
  return map;
}

/**
 * Descending-confidence match tiers. Name-only is deliberately absent: without
 * a date of birth or a club to disambiguate, a shared name is not evidence.
 */
export const MATCH_TIERS = [
  ['id', (r) => r.id],
  ['name+dob', (r) => (r.dob ? `${normName(r.name)}|${r.dob}` : '')],
  ['longname+dob', (r) => (r.dob ? `${normName(r.longName)}|${r.dob}` : '')],
  ['name+club', (r) => (r.club ? `${normName(r.name)}|${normName(r.club)}` : '')],
];

/**
 * Match current rows against baseline rows, recording the tier each pair used
 * so a collapsed id space is visible rather than silently degrading into name
 * matching. Ambiguous keys never match: those players are reported as new.
 *
 * @returns {{ pairs: {current:object, base:object, tier:string}[],
 *             newPlayers: object[], removed: object[], tiers: Record<string, number> }}
 */
export function matchPlayers(current, baseline) {
  const indices = MATCH_TIERS.map(([label, keyFn]) => [label, keyFn, uniqueIndex(baseline, keyFn)]);
  const pairs = [];
  const usedBase = new Set();
  const unmatched = [];

  for (const row of current) {
    let matched = null;
    for (const [label, keyFn, index] of indices) {
      const key = keyFn(row);
      if (!key) continue;
      const candidate = index.get(key);
      if (candidate && !usedBase.has(candidate)) {
        matched = { current: row, base: candidate, tier: label };
        break;
      }
    }
    if (matched) { pairs.push(matched); usedBase.add(matched.base); } else { unmatched.push(row); }
  }

  const tiers = {};
  for (const p of pairs) tiers[p.tier] = (tiers[p.tier] ?? 0) + 1;

  return { pairs, newPlayers: unmatched, removed: baseline.filter((b) => !usedBase.has(b)), tiers };
}
