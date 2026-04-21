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
 * Post-hoc stat fudge for known FC26 data quirks. See
 * scripts/community-pack-plan.md § Phase 1 Turn 6 for the full rule list
 * (striker SHO floor, CB passing cap, young-player zeroed-pace fix).
 * Reads tuning constants from scripts/fc26-fudge.json.
 * @param {object} player  player object after translate + mapPosition
 * @returns {object} same player object (mutated in place), for chaining
 */
function applyFudge(player) {
  // TODO: Turn 6 — apply balancing rules from fc26-fudge.json.
}

/**
 * Map an FC26 position string to an in-game `Position`.
 * Reuses the alias table convention from importFC25.mjs
 * (LWB→LB, RWB→RB, CF→ST, LF→LW, RF→RW), falling back to 'CM' and
 * logging unknown tokens to fc26-unknowns.json.
 * @param {string} fc26Pos
 * @returns {string}
 */
function mapPosition(fc26Pos) {
  // TODO: Turn 2 — alias table + fallback + unknown-token log.
}

/**
 * Glue: one CSV row → one CommunityPlayer object ready for serialization.
 * Calls translateOutfieldStats/translateGKStats (GK vs outfield branch),
 * mapPosition, deriveMental, applyFudge, and finally assigns a stable id
 * (hash of fc26_id || `${fn}-${ln}-${nat}`).
 * @param {Record<string, string>} row
 * @param {object} reportContext  pre-loaded fc26-report.json
 * @returns {object | null} null when the row should be dropped entirely
 */
function buildPlayer(row, reportContext) {
  // TODO: Turn 7 — stitch the per-row pipeline together.
}

/**
 * Emit one TS file per in-game club (bucket A + fuzzy-approved B) under
 * OUTPUT_DIR, keyed by gameClubId. Shape mirrors src/data/squads/*.ts so
 * the existing PlayerTemplate consumers work unchanged.
 * @param {object[]} players  buildPlayer results with a resolved club
 * @param {object} report     pre-loaded fc26-report.json
 * @returns {void}
 */
function writeByClub(players, report) {
  // TODO: Turn 8a — group by gameClubId and write one file per club.
}

/**
 * Emit the free-agent pool (players whose club is null or dropped) as a
 * single TS file. These feed the pack-opening pool without being tied to
 * any in-game club.
 * @param {object[]} players
 * @returns {void}
 */
function writeFreeAgents(players) {
  // TODO: Turn 8b — serialize the unattached-player pool.
}

/**
 * Emit data files for qualified new leagues (bucket C2 qualifiedLeagues in
 * the report). One file per new league, each containing its clubs +
 * squads. Non-qualified C2 entries collapse into the free-agent pool.
 * @param {object[]} players
 * @param {object} report  pre-loaded fc26-report.json
 * @returns {void}
 */
function writeNewLeagues(players, report) {
  // TODO: Turn 8c — scaffold new-league club + squad files from C2.
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
