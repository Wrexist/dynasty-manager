#!/usr/bin/env node
/**
 * Community Pack validator — Phase E content QA.
 *
 * Loads the three auto-generated community pack data files (byClub,
 * freeAgents, and the CP-league squad files behind cpLeagueSquads) and verifies:
 *
 *   1. Every player has fcId, source:'real', ovr in [1,99], and all 6
 *      stats (pace/shooting/passing/defending/physical/mental) in [1,99].
 *   2. No duplicate fcId across byClub + freeAgents. (The CP-league squad
 *      files carry no fcId — they are name/rating templates — so they join
 *      every other check but not this one.)
 *   3. Every byClub key is a valid gameClubId from src/data/leagues/*.ts.
 *   4. Every new-league club has >=18 players and >=1 GK.
 *   5. No player has empty name (both fn and ln blank), empty nationality,
 *      or age outside [15, 45].
 *   6. All `pos` (and `altPos`) values are in the allowed Position set.
 *
 * The community pack TS files are pure JSON with a thin TS wrapper, so we
 * slice out the literal and JSON.parse it — no transpiler required.
 *
 * Exit code: 0 on clean, 1 if any check fails.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CP_DIR = join(ROOT, 'src/data/communityPack');
const LEAGUES_DIR = join(ROOT, 'src/data/leagues');

const VALID_POSITIONS = new Set([
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST',
]);
const STAT_FIELDS = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];
const MIN_RATING = 1;
const MAX_RATING = 99;
const MIN_AGE = 15;
const MAX_AGE = 45;
const NEW_LEAGUE_MIN_PLAYERS = 18;
const NEW_LEAGUE_MIN_GK = 1;

// ── File loaders ──────────────────────────────────────────────────────────

/**
 * Extract the first top-level JSON literal (object or array) from a
 * `export const NAME: Type = <literal>;` TS file. Scans char-by-char with
 * string-awareness so braces inside string values don't confuse the walker.
 */
function extractLiteral(filePath) {
  const src = readFileSync(filePath, 'utf8');
  // Find the '=' that introduces the literal, then the first { or [ after it.
  const eq = src.indexOf('=');
  if (eq === -1) throw new Error(`No '=' found in ${filePath}`);
  let start = -1;
  for (let i = eq + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[') { start = i; break; }
  }
  if (start === -1) throw new Error(`No object/array literal in ${filePath}`);

  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return JSON.parse(src.slice(start, i + 1));
      }
    }
  }
  throw new Error(`Unbalanced literal in ${filePath}`);
}

/**
 * Pull the set of club ids out of every src/data/leagues/*.ts file by
 * scanning the CLUBS array body for `id: '...'`. LEAGUE_INFO.id would
 * otherwise get picked up too, so we start scanning after the CLUBS marker.
 */
function loadGameClubIds() {
  const files = readdirSync(LEAGUES_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  const ids = new Set();
  for (const file of files) {
    const src = readFileSync(join(LEAGUES_DIR, file), 'utf8');
    const marker = src.indexOf('CLUBS');
    if (marker === -1) continue;
    const body = src.slice(marker);
    const re = /\bid:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      ids.add(m[1]);
    }
  }
  return ids;
}

/**
 * The seven community-pack-only league squad files aggregated by
 * `src/data/communityPack/cpLeagueSquads.ts`. Kept as an explicit list that a
 * check below reconciles against the aggregator's imports, so adding a league
 * to one side without the other fails loudly here instead of silently
 * shipping an unvalidated file.
 */
const CP_LEAGUE_SQUAD_FILES = ['arg', 'aus', 'bra', 'ind', 'kor', 'mls', 'sau'];
const SQUADS_DIR = join(ROOT, 'src/data/squads');

/**
 * Parse a generated `src/data/squads/<id>.ts` file into
 * { clubId: playerObject[] }. These files are TS literals (unquoted keys,
 * single-quoted positions), not JSON, so `extractLiteral` cannot read them.
 * They are machine-generated with one player per line, which is what makes a
 * line-based field parser reliable here — and only here. Never point this at
 * hand-written code.
 */
function parseSquadFile(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const out = {};
  let current = null;
  const str = (line, key) => {
    const m = line.match(new RegExp(`\\b${key}: "((?:[^"\\\\]|\\\\.)*)"`));
    return m ? m[1] : undefined;
  };
  const single = (line, key) => {
    const m = line.match(new RegExp(`\\b${key}: '([^']*)'`));
    return m ? m[1] : undefined;
  };
  const num = (line, key) => {
    const m = line.match(new RegExp(`\\b${key}: (-?\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  for (const line of src.split('\n')) {
    const clubKey = line.match(/^  '([^']+)': \[/);
    if (clubKey) { current = clubKey[1]; out[current] = []; continue; }
    if (!current || !line.trimStart().startsWith('{ fn:')) continue;
    const altPosRaw = line.match(/\baltPos: \[([^\]]*)\]/);
    out[current].push({
      fn: str(line, 'fn'), ln: str(line, 'ln'),
      pos: single(line, 'pos'), nat: str(line, 'nat'),
      age: num(line, 'age'), ovr: num(line, 'ovr'), pot: num(line, 'pot'),
      pace: num(line, 'pace'), shooting: num(line, 'shooting'), passing: num(line, 'passing'),
      defending: num(line, 'defending'), physical: num(line, 'physical'), mental: num(line, 'mental'),
      ...(altPosRaw ? { altPos: [...altPosRaw[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) } : {}),
    });
  }
  return out;
}

// ── Per-player validation ─────────────────────────────────────────────────

function isInt(n) {
  return typeof n === 'number' && Number.isFinite(n) && Math.floor(n) === n;
}

function validatePlayer(p, context, errors, { requireProvenance = true } = {}) {
  // fcId + source — required for the byClub/freeAgents buckets, which promise
  // real, individually-identified players. The CP-league squad templates are
  // name/rating templates without ids, so those callers relax this.
  if (requireProvenance) {
    if (!p.fcId || typeof p.fcId !== 'string') {
      errors.push(`${context}: missing or non-string fcId`);
    }
    if (p.source !== 'real') {
      errors.push(`${context}: source is ${JSON.stringify(p.source)}, expected 'real'`);
    }
  }
  // ovr
  if (!isInt(p.ovr) || p.ovr < MIN_RATING || p.ovr > MAX_RATING) {
    errors.push(`${context}: ovr ${p.ovr} not in [${MIN_RATING},${MAX_RATING}]`);
  }
  // 6 stats
  for (const stat of STAT_FIELDS) {
    const v = p[stat];
    if (!isInt(v) || v < MIN_RATING || v > MAX_RATING) {
      errors.push(`${context}: ${stat}=${v} not in [${MIN_RATING},${MAX_RATING}]`);
    }
  }
  // Name — at least one of fn/ln must be non-blank
  const fnOk = typeof p.fn === 'string' && p.fn.trim().length > 0;
  const lnOk = typeof p.ln === 'string' && p.ln.trim().length > 0;
  if (!fnOk && !lnOk) {
    errors.push(`${context}: empty name (fn=${JSON.stringify(p.fn)}, ln=${JSON.stringify(p.ln)})`);
  }
  // Nationality
  if (typeof p.nat !== 'string' || p.nat.trim().length === 0) {
    errors.push(`${context}: empty nationality`);
  }
  // Age
  if (!isInt(p.age) || p.age < MIN_AGE || p.age > MAX_AGE) {
    errors.push(`${context}: age ${p.age} not in [${MIN_AGE},${MAX_AGE}]`);
  }
  // Position
  if (!VALID_POSITIONS.has(p.pos)) {
    errors.push(`${context}: invalid pos ${JSON.stringify(p.pos)}`);
  }
  if (Array.isArray(p.altPos)) {
    for (const ap of p.altPos) {
      if (!VALID_POSITIONS.has(ap)) {
        errors.push(`${context}: invalid altPos entry ${JSON.stringify(ap)}`);
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('Loading community pack data...');
  const byClub = extractLiteral(join(CP_DIR, 'byClub.ts'));
  const freeAgents = extractLiteral(join(CP_DIR, 'freeAgents.ts'));
  const gameClubIds = loadGameClubIds();

  // Reconcile the validated squad-file list against what cpLeagueSquads.ts
  // actually aggregates — a league added to one side but not the other is a
  // validator blind spot, which is worse than a failure.
  const aggregatorSrc = readFileSync(join(CP_DIR, 'cpLeagueSquads.ts'), 'utf8');
  const aggregated = [...aggregatorSrc.matchAll(/from '@\/data\/squads\/([a-z0-9]+)'/g)].map((m) => m[1]).sort();

  const errors = [];
  const warnings = [];
  const fcIdOwners = new Map(); // fcId -> first context seen

  // Counts for the summary.
  let byClubPlayerCount = 0;
  let freeAgentCount = 0;
  let cpLeagueClubCount = 0;
  let cpLeaguePlayerCount = 0;

  if (aggregated.join(',') !== [...CP_LEAGUE_SQUAD_FILES].sort().join(',')) {
    errors.push(`cpLeagueSquads.ts aggregates [${aggregated}] but the validator covers [${CP_LEAGUE_SQUAD_FILES}] — update CP_LEAGUE_SQUAD_FILES`);
  }

  // ── Check 1, 5, 6: per-player validation on every bucket.
  // ── Check 2: duplicate fcId tracking.
  function registerFcId(p, context) {
    if (!p.fcId) return;
    const prior = fcIdOwners.get(p.fcId);
    if (prior) {
      errors.push(`duplicate fcId ${p.fcId}: ${prior} and ${context}`);
    } else {
      fcIdOwners.set(p.fcId, context);
    }
  }

  // byClub
  for (const [clubId, players] of Object.entries(byClub)) {
    if (!Array.isArray(players)) {
      errors.push(`byClub[${clubId}] is not an array`);
      continue;
    }
    // Check 3: byClub key must be a real gameClubId.
    if (!gameClubIds.has(clubId)) {
      errors.push(`byClub key '${clubId}' is not a valid gameClubId (not found in src/data/leagues/*.ts)`);
    }
    players.forEach((p, idx) => {
      const ctx = `byClub[${clubId}][${idx}] ${p?.fn ?? ''} ${p?.ln ?? ''} (fcId=${p?.fcId ?? '?'})`;
      validatePlayer(p, ctx, errors);
      registerFcId(p, ctx);
      byClubPlayerCount++;
    });
  }

  // freeAgents
  if (!Array.isArray(freeAgents)) {
    errors.push('freeAgents is not an array');
  } else {
    freeAgents.forEach((p, idx) => {
      const ctx = `freeAgents[${idx}] ${p?.fn ?? ''} ${p?.ln ?? ''} (fcId=${p?.fcId ?? '?'})`;
      validatePlayer(p, ctx, errors);
      registerFcId(p, ctx);
      freeAgentCount++;
    });
  }

  // CP-league squads — also runs check 4 (>=18 players, >=1 GK per club).
  for (const leagueId of CP_LEAGUE_SQUAD_FILES) {
    const clubs = parseSquadFile(join(SQUADS_DIR, `${leagueId}.ts`));
    if (Object.keys(clubs).length === 0) {
      errors.push(`squads/${leagueId}.ts: parsed zero clubs — file shape changed under the parser`);
      continue;
    }
    for (const [cid, players] of Object.entries(clubs)) {
      cpLeagueClubCount++;
      if (!gameClubIds.has(cid)) {
        errors.push(`squads/${leagueId}.${cid}: not a valid gameClubId (not found in src/data/leagues/*.ts)`);
      }
      if (players.length < NEW_LEAGUE_MIN_PLAYERS) {
        errors.push(`squads/${leagueId}.${cid}: only ${players.length} players (min ${NEW_LEAGUE_MIN_PLAYERS})`);
      }
      const gkCount = players.filter((p) => p?.pos === 'GK').length;
      if (gkCount < NEW_LEAGUE_MIN_GK) {
        errors.push(`squads/${leagueId}.${cid}: ${gkCount} GKs (min ${NEW_LEAGUE_MIN_GK})`);
      }
      players.forEach((p, idx) => {
        const ctx = `squads/${leagueId}.${cid}[${idx}] ${p?.fn ?? ''} ${p?.ln ?? ''}`;
        validatePlayer(p, ctx, errors, { requireProvenance: false });
        cpLeaguePlayerCount++;
      });
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  const totalPlayers = byClubPlayerCount + freeAgentCount + cpLeaguePlayerCount;
  console.log('');
  console.log('── Community Pack validation summary ────────────────────────');
  console.log(`  byClub keys:            ${Object.keys(byClub).length}`);
  console.log(`  byClub players:         ${byClubPlayerCount}`);
  console.log(`  freeAgents:             ${freeAgentCount}`);
  console.log(`  CP leagues:             ${CP_LEAGUE_SQUAD_FILES.length}`);
  console.log(`  CP-league clubs:        ${cpLeagueClubCount}`);
  console.log(`  CP-league players:      ${cpLeaguePlayerCount}`);
  console.log(`  total players:          ${totalPlayers}`);
  console.log(`  unique fcIds:           ${fcIdOwners.size}`);
  console.log(`  gameClubIds available:  ${gameClubIds.size}`);
  console.log('');

  if (warnings.length > 0) {
    console.log(`── ${warnings.length} warning(s) ────────────────────────────────────────`);
    for (const w of warnings) console.log(`  WARN: ${w}`);
    console.log('');
  }

  if (errors.length === 0) {
    console.log('OK: all community pack checks passed.');
    process.exit(0);
  }

  // Cap the number of individual lines we print so a systemic failure
  // doesn't drown the terminal, but always show the total.
  const MAX_SHOWN = 50;
  console.log(`── ${errors.length} error(s) ──────────────────────────────────────────`);
  for (const e of errors.slice(0, MAX_SHOWN)) {
    console.log(`  ERR: ${e}`);
  }
  if (errors.length > MAX_SHOWN) {
    console.log(`  ... ${errors.length - MAX_SHOWN} more error(s) suppressed`);
  }
  process.exit(1);
}

main();
