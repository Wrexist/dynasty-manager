#!/usr/bin/env node
/**
 * FC26 CSV Analyzer — Phase 0 of the community pack pipeline.
 *
 * Reads the raw FC26 export, maps FC26 league IDs onto in-game league IDs,
 * buckets clubs as existing / new / orphan, and emits scripts/fc26-report.json
 * with the column catalogue + bucket summaries that Phase 1 (processFC26.mjs)
 * consumes. No writes into src/.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
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
  if (!name) return '';
  // 1. Lowercase
  let s = String(name).toLowerCase();
  // 2. Strip accents (NFD + remove combining marks U+0300–U+036F)
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // 3. Remove leading prefixes (longest-first so "1. fc" beats "1." and "fc")
  const prefixes = [
    '1. fc ', '1.fc ', '1. ',
    'afc ', 'fc ', 'cf ', 'sc ', 'ac ', 'sv ', 'tsg ', 'vfl ', 'vfb ',
  ];
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const p of prefixes) {
      if (s.startsWith(p)) {
        s = s.slice(p.length);
        stripped = true;
        break;
      }
    }
  }
  // 4. Remove trailing suffixes
  const suffixes = [' afc', ' fc', ' cf'];
  stripped = true;
  while (stripped) {
    stripped = false;
    for (const sfx of suffixes) {
      if (s.endsWith(sfx)) {
        s = s.slice(0, -sfx.length);
        stripped = true;
        break;
      }
    }
  }
  // 5. Collapse whitespace → single hyphen
  s = s.trim().replace(/\s+/g, '-');
  // 6. Strip anything that isn't a-z, 0-9, or hyphen
  s = s.replace(/[^a-z0-9-]/g, '');
  // Collapse runs of hyphens and trim leading/trailing hyphens
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s;
}

/**
 * Classic Levenshtein edit distance between two strings.
 * Used by fuzzyMatch to score candidate name pairs.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  a = a || '';
  b = b || '';
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Two-row DP to keep memory at O(min(a,b)).
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,       // insertion
        prev[j] + 1,           // deletion
        prev[j - 1] + cost,    // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Best-match lookup of a CSV club name against a set of known in-game
 * club ids. Returns { clubId, score, isFuzzy } for the top candidate:
 *   - exact normalized match → isFuzzy: false, score: 1.0
 *   - else score ≥ 0.85 AND |len(a) - len(b)| ≤ 4 → isFuzzy: true
 *   - else null
 * Score = 1 - (distance / max(len(a), len(b))).
 * The third arg is kept for API parity with the plan; filtering to a
 * single league is the caller's job.
 * @param {string} fc26Name
 * @param {string[]} gameClubIds
 * @param {boolean} [sameLeagueOnly]
 * @returns {{ clubId: string, score: number, isFuzzy: boolean } | null}
 */
function fuzzyMatch(fc26Name, gameClubIds, sameLeagueOnly = true) {
  const norm = normalizeClubName(fc26Name);
  if (!norm) return null;

  let best = null;
  for (const candidate of gameClubIds) {
    const candNorm = normalizeClubName(candidate);
    if (!candNorm) continue;

    if (candNorm === norm) {
      return { clubId: candidate, score: 1.0, isFuzzy: false };
    }

    const lenDiff = Math.abs(norm.length - candNorm.length);
    if (lenDiff > 4) continue;

    const dist = levenshtein(norm, candNorm);
    const maxLen = Math.max(norm.length, candNorm.length);
    const score = maxLen === 0 ? 0 : 1 - dist / maxLen;

    if (score >= 0.85 && (!best || score > best.score)) {
      best = { clubId: candidate, score, isFuzzy: true };
    }
  }
  return best;
}

/**
 * Load every club id currently defined in src/data/leagues/*.ts, grouped by
 * the league's internal LEAGUE_INFO.id (not filename — filenames use country
 * words like "england2.ts" but carry id: 'eng-2' inside).
 * @returns {Map<string, Set<string>>} gameLeagueId → set of club ids
 */
function loadGameClubIds() {
  const dir = join(ROOT, 'src/data/leagues');
  const map = new Map();
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');

    // LEAGUE_INFO.id — look at the first id: occurrence AFTER the
    // LEAGUE_INFO declaration so we don't pick up stray ones.
    const infoMatch = content.match(/LEAGUE_INFO[\s\S]*?id:\s*['"]([a-z0-9-]+)['"]/);
    if (!infoMatch) continue;
    const gameLeagueId = infoMatch[1];

    // Club ids live inside the CLUBS array — everything after the first
    // mention of CLUBS is the club section.
    const clubsIdx = content.indexOf('CLUBS');
    const clubSection = clubsIdx >= 0 ? content.slice(clubsIdx) : '';
    const clubIds = new Set();
    for (const m of clubSection.matchAll(/id:\s*['"]([a-z0-9-]+)['"]/g)) {
      // Skip the league id itself if the regex picks it up for any reason.
      if (m[1] !== gameLeagueId) clubIds.add(m[1]);
    }

    map.set(gameLeagueId, clubIds);
  }
  return map;
}

/**
 * Sort a single FC26 CSV row into one of five buckets. The caller is
 * expected to aggregate the results.
 *
 *   A   — clean match: league is mapped and club names normalize to the same id
 *   B   — fuzzy match: needs human alias review before being trusted
 *   C1  — league known, club is new (league turnover since FC25)
 *   C2  — league itself is not in the game yet
 *   D   — drop: league in SKIP_LEAGUE_IDS, or row has no club_name
 *
 * @param {Record<string, string>} fc26Row  raw CSV row
 * @param {Map<string, Set<string>>} gameClubsByLeague  from loadGameClubIds
 * @returns {object}
 */
function categorizeClub(fc26Row, gameClubsByLeague) {
  const leagueIdRaw = fc26Row.league_id ?? fc26Row['league_id'] ?? '';
  const leagueId = parseInt(leagueIdRaw, 10);
  const fc26Name = (fc26Row.club_name ?? fc26Row.team_name ?? '').trim();
  const fc26LeagueName = (fc26Row.league_name ?? '').trim();

  // Step 0 — drop conditions.
  if (!fc26Name) {
    return { bucket: 'D', reason: 'missing club_name' };
  }
  if (SKIP_LEAGUE_IDS.includes(leagueId)) {
    return { bucket: 'D', reason: `league ${leagueId} in SKIP_LEAGUE_IDS` };
  }

  // Step 1 — is the league mapped to an in-game league?
  const gameLeagueId = FC26_LEAGUE_ID_TO_GAME_ID[leagueId];
  if (!gameLeagueId) {
    return {
      bucket: 'C2',
      fc26LeagueId: leagueId,
      fc26LeagueName,
      fc26Name,
    };
  }

  // Step 2 — try the alias table first (overrides fuzzy).
  const clubSet = gameClubsByLeague.get(gameLeagueId);
  const aliasTarget = KNOWN_ALIASES[fc26Name];
  if (aliasTarget && clubSet && clubSet.has(aliasTarget)) {
    return { bucket: 'A', gameLeagueId, gameClubId: aliasTarget };
  }

  // Step 3 — fuzzy match within the same league only.
  const candidates = clubSet ? Array.from(clubSet) : [];
  const match = fuzzyMatch(fc26Name, candidates, true);
  if (match) {
    if (!match.isFuzzy) {
      return { bucket: 'A', gameLeagueId, gameClubId: match.clubId };
    }
    return {
      bucket: 'B',
      gameLeagueId,
      gameClubId: match.clubId,
      score: match.score,
      fc26Name,
    };
  }

  // Step 4 — league is known but the club isn't; flag as new.
  return { bucket: 'C1', gameLeagueId, fc26Name };
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
