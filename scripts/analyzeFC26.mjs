#!/usr/bin/env node
/**
 * FC26 CSV Analyzer — Phase 0 of the community pack pipeline.
 *
 * Reads the raw FC26 export, maps FC26 league IDs onto in-game league IDs,
 * buckets clubs as existing / new / orphan, and emits scripts/fc26-report.json
 * with the column catalogue + bucket summaries that Phase 1 (processFC26.mjs)
 * consumes. No writes into src/.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Paths ─────────────────────────────────────────────────────────────────
const CSV_PATH = join(ROOT, 'FC26_20250921.csv');
const REPORT_PATH = join(ROOT, 'scripts/fc26-report.json');

// ── Thresholds for bucketing decisions ────────────────────────────────────
const MIN_CLUBS = 10;          // a candidate league needs at least this many clubs
const MIN_AVG_PLAYERS = 18;    //   and at least this many players per club on average

// ── FC26 league_id → in-game league id ────────────────────────────────────
const FC26_LEAGUE_ID_TO_GAME_ID = {
  13: 'eng',       // Premier League
  14: 'eng-2',     // EFL Championship
  60: 'eng-3',     // EFL League One
  61: 'eng-4',     // EFL League Two
  53: 'esp',       // LALIGA EA SPORTS
  54: 'esp-2',     // LALIGA HYPERMOTION
  31: 'ita',       // Serie A
  32: 'ita-2',     // Serie B
  19: 'ger',       // Bundesliga
  20: 'ger-2',     // 2. Bundesliga
  2076: 'ger-3',   // 3. Liga
  16: 'fra',       // Ligue 1
  17: 'fra-2',     // Ligue 2
  10: 'ned',       // Eredivisie
  308: 'por',      // Liga Portugal
  4: 'bel',        // Pro League
  68: 'tur',       // Süper Lig
  66: 'pol',       // Ekstraklasa
  1: 'den',        // Superliga
  41: 'nor',       // Eliteserien
  56: 'swe',       // Allsvenskan
  80: 'aut',       // Bundesliga (Austria)
  50: 'sco',       // Scottish Premiership
  65: 'irl',       // Premier Division
  189: 'gre',      // Super League Greece
  2012: 'che',     // Swiss Super League
  330: 'rou',      // Liga I
};

// ── Leagues to drop outright (noise / diaspora placements) ────────────────
const SKIP_LEAGUE_IDS = [
  332,  // Ukrainian clubs temporarily grouped under PL in FC26 data
];

// ── Leagues we might WANT to add to the game ──────────────────────────────
// Phase 0 reports stats on each; decisions happen later.
const NEW_LEAGUE_CANDIDATES = [
  39,    // MLS
  353,   // Argentine Primera División
  350,   // Saudi Pro League
  83,    // K League 1
  7,     // Brasileirão Série A
  351,   // A-League Men
  2149,  // Indian Super League (ISL)
  // Chinese Super League id is data-dependent — detectNewLeagues picks it up.
];

// ── Team-name aliases (CSV name → canonical in-game club id) ──────────────
// Empty for now; populated as fuzzy matching surfaces systematic mismatches.
const KNOWN_ALIASES = {};

// ── CSV parser (lifted verbatim from scripts/importFC25.mjs) ──────────────
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
 * Normalize a club name for fuzzy comparison: lowercase, strip punctuation,
 * drop common prefixes (FC, SC, AC, 1., SV, SpVgg), collapse whitespace,
 * transliterate accented characters to ASCII.
 * @param {string} name
 * @returns {string}
 */
function normalizeClubName(name) {
  return '';
}

/**
 * Classic Levenshtein edit distance between two strings.
 * Used by fuzzyMatch to score candidate name pairs.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  return 0;
}

/**
 * Best-match lookup of a CSV club name against the set of known in-game
 * club ids. Returns { id, score } for the top candidate if the normalized
 * edit distance is under a threshold, else null.
 * @param {string} csvName
 * @param {string[]} gameClubIds
 * @returns {{ id: string, score: number } | null}
 */
function fuzzyMatch(csvName, gameClubIds) {
  return null;
}

/**
 * Load every club id currently defined in src/data/leagues/*.ts so we know
 * what "existing" means when bucketing. Returns a flat array of ids.
 * @returns {string[]}
 */
function loadGameClubIds() {
  return [];
}

/**
 * Decide which bucket a CSV club falls into:
 *   'existing'  → matches a known in-game club id (exact or via KNOWN_ALIASES)
 *   'fuzzy'     → fuzzy-matches an existing club; needs human review
 *   'new'       → belongs to a mapped league but has no game counterpart
 *   'candidate' → belongs to a NEW_LEAGUE_CANDIDATES league
 *   'skip'      → league is in SKIP_LEAGUE_IDS
 *   'unmapped'  → league id we don't know about at all
 * @param {{ teamName: string, leagueId: number }} club
 * @param {string[]} gameClubIds
 * @returns {{ bucket: string, matchedId: string | null, score: number | null }}
 */
function categorizeClub(club, gameClubIds) {
  return { bucket: 'unmapped', matchedId: null, score: null };
}

/**
 * Scan the CSV for league ids that aren't in FC26_LEAGUE_ID_TO_GAME_ID and
 * meet the MIN_CLUBS / MIN_AVG_PLAYERS thresholds. Surfaces candidates
 * (including whatever id the Chinese Super League ends up using) so we can
 * extend NEW_LEAGUE_CANDIDATES in later turns.
 * @param {object[]} rows
 * @returns {Array<{ leagueId: number, clubCount: number, avgPlayers: number, sampleTeams: string[] }>}
 */
function detectNewLeagues(rows) {
  return [];
}

/**
 * Assemble the final report object written to scripts/fc26-report.json.
 * Must include: source checksum + row count, column catalogue, OVR histogram,
 * position distribution, per-league summaries (mapped + candidate),
 * bucket counts, and the unknown-position / unknown-league tails.
 * @param {object[]} rows
 * @returns {object}
 */
function buildReport(rows) {
  return {};
}

/**
 * Orchestration: read CSV → parse → buildReport → write JSON → print summary.
 * @returns {void}
 */
function main() {}

// Entry point — only run main when invoked directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  FC26_LEAGUE_ID_TO_GAME_ID,
  SKIP_LEAGUE_IDS,
  NEW_LEAGUE_CANDIDATES,
  KNOWN_ALIASES,
  normalizeClubName,
  levenshtein,
  fuzzyMatch,
  loadGameClubIds,
  categorizeClub,
  detectNewLeagues,
  buildReport,
};
