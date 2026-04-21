#!/usr/bin/env node
/**
 * FC26 CSV Processor — Phase 1 of the community pack pipeline.
 *
 * Consumes the raw FC26 CSV plus scripts/fc26-report.json (from Phase 0,
 * analyzeFC26.mjs) and emits typed TS data under src/data/communityPack/.
 *
 * This file is a SKELETON — function bodies land in subsequent turns.
 * See scripts/community-pack-plan.md § "Phase 1 — Data pipeline" for the
 * per-turn breakdown.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Paths ─────────────────────────────────────────────────────────────────
const CSV_PATH = join(ROOT, 'FC26_20250921.csv');
const REPORT_PATH = join(ROOT, 'scripts/fc26-report.json');
const OUTPUT_DIR = join(ROOT, 'src/data/communityPack');

// ── CSV parser (lifted verbatim from scripts/analyzeFC26.mjs) ─────────────
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    results.push(obj);
  }
  return results;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ── Function stubs (bodies land in later turns) ───────────────────────────

/**
 * Parse a CSV cell as an integer, defaulting to 50 when missing or NaN.
 * @param {string | undefined} value
 * @returns {number}
 */
function toIntOr50(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 50 : n;
}

/**
 * Map FC26 outfield top-level attribute columns to the game's 5-field
 * stat block. FC26 spells physical as `physic`; rename on the way in.
 * Missing or NaN cells default to 50. `mental` is derived separately via
 * deriveMental().
 * @param {Record<string, string>} row
 * @returns {{ pace: number, shooting: number, passing: number, defending: number, physical: number }}
 */
function translateOutfieldStats(row) {
  return {
    pace: toIntOr50(row.pace),
    shooting: toIntOr50(row.shooting),
    passing: toIntOr50(row.passing),
    defending: toIntOr50(row.defending),
    physical: toIntOr50(row.physic),
  };
}

/**
 * Map FC26 goalkeeper attribute columns into the same 5-field stat block
 * so GKs share one row shape with outfielders. Missing or NaN cells
 * default to 50. `mental` is derived separately via deriveMental().
 * @param {Record<string, string>} row
 * @returns {{ pace: number, shooting: number, passing: number, defending: number, physical: number }}
 */
function translateGKStats(row) {
  return {
    pace: toIntOr50(row.goalkeeping_reflexes),
    shooting: toIntOr50(row.goalkeeping_diving),
    passing: toIntOr50(row.goalkeeping_kicking),
    defending: toIntOr50(row.goalkeeping_positioning),
    physical: toIntOr50(row.goalkeeping_handling),
  };
}

/**
 * Derive the `mental` stat from FC26 sub-attrs.
 *   - GKs use goalkeeping_speed directly (defaults to 50 when missing).
 *   - Outfielders average dribbling, mentality_composure,
 *     movement_reactions, and mentality_vision, skipping any NaN cells.
 *     If every source is NaN, defaults to 50.
 * @param {Record<string, string>} row
 * @param {boolean} isGK
 * @returns {number}
 */
function deriveMental(row, isGK) {
  if (isGK) {
    return toIntOr50(row.goalkeeping_speed);
  }
  const sources = [
    row.dribbling,
    row.mentality_composure,
    row.movement_reactions,
    row.mentality_vision,
  ];
  const nums = sources.map(v => parseInt(v, 10)).filter(n => !Number.isNaN(n));
  if (nums.length === 0) return 50;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round(avg);
}

/**
 * mulberry32 — small, fast, deterministic 32-bit PRNG. Inlined so the
 * processor stays dependency-free.
 * @param {number} seed  unsigned 32-bit integer
 * @returns {() => number}  uniform float in [0, 1)
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a string hash → unsigned 32-bit int. Used to seed mulberry32 from
 * a player id so the same id always reproduces the same fudge.
 * @param {string} str
 * @returns {number}
 */
function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic per-player stat fudge. Keyed off playerId so the same id
 * always produces the same result. Picks 1 + (seed % 3) distinct stat
 * keys, applies a delta drawn from {-3, -2, +2, +3} to each (skipping 0
 * and ±1 so the change is visible), and clamps every fudged value to
 * [1, 99]. Returns a NEW stats object — input is not mutated.
 * @param {Record<string, number>} stats
 * @param {string} playerId
 * @returns {Record<string, number>}
 */
function applyFudge(stats, playerId) {
  const seed = hashStringToSeed(playerId);
  const rng = mulberry32(seed);
  const numToFudge = 1 + (seed % 3); // 1, 2, or 3
  const deltas = [-3, -2, 2, 3];

  const keys = Object.keys(stats);
  // Fisher–Yates shuffle a copy of the key indices using the seeded rng,
  // then take the first `numToFudge` to pick distinct keys.
  const order = keys.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const result = { ...stats };
  const take = Math.min(numToFudge, order.length);
  for (let i = 0; i < take; i++) {
    const key = keys[order[i]];
    const delta = deltas[Math.floor(rng() * deltas.length)];
    const clamped = Math.max(1, Math.min(99, result[key] + delta));
    result[key] = clamped;
  }
  return result;
}

/**
 * Map an FC26 player_positions string (comma-separated, e.g. "CM,CDM")
 * to in-game positions.
 *   pos    — first mapped position
 *   altPos — deduped list of subsequent mapped positions
 * Tokens not in the alias table are dropped.
 * @param {string} fc26Positions
 * @returns {{ pos: string | undefined, altPos: string[] }}
 */
function mapPosition(fc26Positions) {
  const ALIASES = {
    LWB: 'LB',
    RWB: 'RB',
    LW: 'LW',
    RW: 'RW',
    CF: 'ST',
    LF: 'ST',
    RF: 'ST',
    LS: 'ST',
    RS: 'ST',
    CAM: 'CAM',
    CDM: 'CDM',
    CM: 'CM',
    CB: 'CB',
    LB: 'LB',
    RB: 'RB',
    GK: 'GK',
    ST: 'ST',
  };

  const tokens = String(fc26Positions || '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  const mapped = [];
  const seen = new Set();
  for (const t of tokens) {
    const m = ALIASES[t];
    if (m && !seen.has(m)) {
      mapped.push(m);
      seen.add(m);
    }
  }

  return {
    pos: mapped[0],
    altPos: mapped.slice(1),
  };
}

/**
 * Glue: one FC26 CSV row → one PlayerTemplate object matching the shape
 * used in src/data/squads/*.ts, plus community-pack-only metadata.
 *
 * Pipeline:
 *   1. Detect GK from the first token of player_positions.
 *   2. Pull raw 5-field stats from the GK or outfield translator.
 *   3. Compute `mental` via deriveMental(row, isGK).
 *   4. Combine into a 6-field stat block.
 *   5. Run applyFudge keyed on player_id (deterministic).
 *   6. Map positions to the in-game alias set.
 *   7. Split short_name (fallback long_name) into fn/ln. If the source
 *      has a space, fn = everything before the last space, ln = last
 *      word. If single-word, fn = first initial, ln = the whole name.
 *   8. Assemble the PlayerTemplate, omitting `altPos` when empty to
 *      mirror the existing squad-file convention.
 *
 * @param {Record<string, string>} row
 * @returns {object} PlayerTemplate + { source, fcId, heightCm, weightKg }
 */
function buildPlayer(row) {
  const primary = String(row.player_positions || '').split(',')[0].trim().toUpperCase();
  const isGK = primary === 'GK';

  const rawStats = isGK ? translateGKStats(row) : translateOutfieldStats(row);
  const mental = deriveMental(row, isGK);
  const stats = { ...rawStats, mental };
  const fudged = applyFudge(stats, row.player_id);

  const { pos, altPos } = mapPosition(row.player_positions);

  const nameSource = (row.short_name && row.short_name.trim())
    || (row.long_name && row.long_name.trim())
    || '';
  let fn, ln;
  const lastSpace = nameSource.lastIndexOf(' ');
  if (lastSpace >= 0) {
    fn = nameSource.slice(0, lastSpace);
    ln = nameSource.slice(lastSpace + 1);
  } else {
    fn = nameSource.charAt(0);
    ln = nameSource;
  }

  const skillMovesParsed = parseInt(row.skill_moves, 10);

  const template = {
    fn,
    ln,
    pos,
    age: parseInt(row.age, 10),
    nat: row.nationality_name,
    ovr: parseInt(row.overall, 10),
    pot: parseInt(row.potential, 10),
    pace: fudged.pace,
    shooting: fudged.shooting,
    passing: fudged.passing,
    defending: fudged.defending,
    physical: fudged.physical,
    mental: fudged.mental,
    skillMoves: Number.isNaN(skillMovesParsed) ? 1 : skillMovesParsed,
    source: 'real',
    fcId: row.player_id,
    heightCm: parseInt(row.height_cm, 10),
    weightKg: parseInt(row.weight_kg, 10),
  };

  if (altPos.length > 0) {
    template.altPos = altPos;
  }

  return template;
}

/**
 * Slug a free-form name into a deterministic id: lowercase, ASCII-only,
 * non-alphanumeric runs collapsed to single hyphens, no leading/trailing
 * hyphens. Used for league + club ids in writeNewLeagues.
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Idempotent — fs.mkdirSync({recursive:true}) is safe on existing dirs,
 * so each writer can call this without coordinating with main().
 */
function ensureOutputDir() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// TS preamble shared by every output file. Imports PlayerTemplate from
// the location it actually lives (matches src/data/squads/*.ts) and
// extends it with the FC26 metadata buildPlayer attaches.
const COMMUNITY_PLAYER_PREAMBLE = `import type { PlayerTemplate } from '@/data/playerTemplates';

interface CommunityPlayer extends PlayerTemplate {
  source: 'real';
  fcId: string;
  heightCm: number;
  weightKg: number;
}

`;

/**
 * Emit src/data/communityPack/byClub.ts — every bucket-A / fuzzy-B player
 * grouped by their resolved in-game club id. Club ids sorted
 * alphabetically, players within each club sorted by ovr desc.
 * `aliasMap` is accepted for API parity with later turns (it'll feed
 * fuzzy-resolved name overrides) but isn't consumed yet.
 * @param {Map<string, object[]>} clubPlayerMap  gameClubId → players
 * @param {Record<string, string>} [aliasMap]
 * @returns {void}
 */
function writeByClub(clubPlayerMap, aliasMap) {
  ensureOutputDir();
  const sortedIds = Array.from(clubPlayerMap.keys()).sort();
  const out = {};
  for (const clubId of sortedIds) {
    const players = [...clubPlayerMap.get(clubId)].sort((a, b) => b.ovr - a.ovr);
    out[clubId] = players;
  }
  const body = JSON.stringify(out, null, 2);
  const file = `${COMMUNITY_PLAYER_PREAMBLE}// Auto-generated by scripts/processFC26.mjs — do not edit by hand.
export const byClub: Record<string, CommunityPlayer[]> = ${body};
`;
  writeFileSync(join(OUTPUT_DIR, 'byClub.ts'), file);
}

/**
 * Emit src/data/communityPack/freeAgents.ts — players with no resolved
 * club, sorted by ovr desc. Feeds the pack-opening pool directly.
 * @param {object[]} players
 * @returns {void}
 */
function writeFreeAgents(players) {
  ensureOutputDir();
  const sorted = [...players].sort((a, b) => b.ovr - a.ovr);
  const body = JSON.stringify(sorted, null, 2);
  const file = `${COMMUNITY_PLAYER_PREAMBLE}// Auto-generated by scripts/processFC26.mjs — do not edit by hand.
export const freeAgents: CommunityPlayer[] = ${body};
`;
  writeFileSync(join(OUTPUT_DIR, 'freeAgents.ts'), file);
}

/**
 * Emit src/data/communityPack/newLeagues.ts — qualified C2 leagues with
 * a LeagueInfo-shaped `info` block plus `clubs` (each with a slug id,
 * name, and ovr-desc-sorted players). League and club ids are
 * deterministic slugs derived from their names.
 *
 * LeagueInfo fields the report can't supply (country, prizeMoney,
 * difficulty, etc.) get conservative placeholder defaults — Phase 2 is
 * expected to refine these as new leagues are formally adopted.
 *
 * @param {Record<string, { leagueName: string, clubs: Array<{ name: string, players: object[] }> }>} newLeaguesData
 * @returns {void}
 */
function writeNewLeagues(newLeaguesData) {
  ensureOutputDir();

  const out = {};
  for (const fc26Id of Object.keys(newLeaguesData)) {
    const { leagueName, clubs } = newLeaguesData[fc26Id];
    const leagueSlug = slugify(leagueName) || `league-${fc26Id}`;

    const slugClubs = clubs
      .map(c => ({
        id: slugify(c.name) || `club-${slugify(leagueName)}-${clubs.indexOf(c)}`,
        name: c.name,
        players: [...c.players].sort((a, b) => b.ovr - a.ovr),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const info = {
      id: leagueSlug,
      name: leagueName,
      shortName: leagueSlug.slice(0, 4).toUpperCase(),
      country: 'Unknown',
      countryCode: 'XX',
      teamCount: slugClubs.length,
      totalWeeks: slugClubs.length > 1 ? (slugClubs.length - 1) * 2 : 38,
      replacedSlots: 0,
      description: `Auto-imported from FC26 (league_id ${fc26Id}).`,
      difficulty: 'Medium',
      colorClass: 'text-slate-400',
      prizeMoney: 5_000_000,
      averageWage: 20_000,
      qualityTier: 3,
      tier: 1,
      countryId: leagueSlug,
      promotionSpots: 0,
      relegationSpots: 0,
      playoffSpots: 0,
    };

    out[leagueSlug] = { info, clubs: slugClubs };
  }

  // Sort top-level league keys alphabetically for stable diffs.
  const sortedOut = {};
  for (const k of Object.keys(out).sort()) sortedOut[k] = out[k];

  const body = JSON.stringify(sortedOut, null, 2);
  const file = `import type { LeagueInfo } from '@/types/game';
import type { PlayerTemplate } from '@/data/playerTemplates';

interface CommunityPlayer extends PlayerTemplate {
  source: 'real';
  fcId: string;
  heightCm: number;
  weightKg: number;
}

interface NewLeagueClub {
  id: string;
  name: string;
  players: CommunityPlayer[];
}

interface NewLeague {
  info: LeagueInfo;
  clubs: NewLeagueClub[];
}

// Auto-generated by scripts/processFC26.mjs — do not edit by hand.
export const newLeagues: Record<string, NewLeague> = ${body};
`;
  writeFileSync(join(OUTPUT_DIR, 'newLeagues.ts'), file);
}

/**
 * Orchestration: load report → read CSV → buildPlayer per row →
 * validate (unique ids, all positions valid, no empty names) →
 * writeByClub + writeFreeAgents + writeNewLeagues → print summary.
 * @returns {void}
 */
function main() {
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
  console.log(`Loaded report: ${report.summary.totalPlayers} players, ${report.summary.totalClubs} clubs`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // TODO: Turn 9 — full orchestration. Skeleton stops here.
}

// Entry point — only run main when invoked directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  parseCSV,
  parseCSVLine,
  translateOutfieldStats,
  translateGKStats,
  deriveMental,
  applyFudge,
  mapPosition,
  buildPlayer,
  writeByClub,
  writeFreeAgents,
  writeNewLeagues,
};
