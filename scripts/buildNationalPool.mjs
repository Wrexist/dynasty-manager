#!/usr/bin/env node
/**
 * Build National Player Pool — FC26 edition
 *
 * Parses FC26_20250921.csv and emits src/data/nationalPlayerPool.ts —
 * a PlayerTemplate[] per nationality. Used both to seed national-team
 * squads with real players and to pick real-named/real-rated fillers
 * during club-squad generation (see src/utils/realPlayerPicker.ts).
 *
 * Bumped to ~200 per nation so popular nations (England, Spain, etc.)
 * have enough candidates to cover all club fillers without exhausting
 * the pool and falling back to procedural generation.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CSV_PATH = join(ROOT, 'FC26_20250921.csv');
const OUT_PATH = join(ROOT, 'src/data/nationalPlayerPool.ts');

const MAX_PER_NATION = 220;
const MIN_OVR = 50;

/**
 * Nations the game exposes as manageable national teams (from src/data/nations.ts)
 * plus FC26-side alias labels for each (kept as separate pool keys; a runtime
 * resolver in src/utils/realPlayerPicker.ts merges them).
 */
const GAME_NATIONS = new Set([
  // UEFA
  'France', 'Spain', 'England', 'Portugal', 'Netherlands', 'Belgium', 'Germany',
  'Croatia', 'Italy', 'Switzerland', 'Denmark', 'Turkey', 'Austria', 'Norway',
  'Ukraine', 'Poland', 'Wales', 'Sweden', 'Serbia', 'Czechia', 'Hungary',
  'Scotland', 'Greece', 'Republic of Ireland', 'Northern Ireland', 'Slovakia',
  'Slovenia', 'Romania', 'Bulgaria', 'Bosnia and Herzegovina', 'Albania',
  'Iceland', 'Finland', 'Russia', 'Montenegro', 'North Macedonia', 'Cyprus',
  'Israel',
  // CONMEBOL
  'Argentina', 'Brazil', 'Colombia', 'Uruguay', 'Ecuador', 'Paraguay', 'Chile', 'Peru',
  'Venezuela', 'Bolivia',
  // CAF
  'Morocco', 'Senegal', 'Nigeria', 'Algeria', 'Egypt', "Côte d'Ivoire", 'Cameroon',
  'Ghana', 'Mali', 'Gabon', 'Tunisia', 'South Africa', 'DR Congo', 'Burkina Faso',
  'Guinea', 'Cabo Verde',
  // AFC
  'Japan', 'Korea Republic', 'Saudi Arabia', 'Australia', 'Iran', 'Iraq', 'Qatar',
  'United Arab Emirates', 'China PR',
  // CONCACAF
  'United States', 'Mexico', 'Canada', 'Costa Rica', 'Jamaica', 'Honduras', 'Panama',
]);

/** Aliases the game persists vs how the FC26 CSV labels the same nation. */
const NATIONALITY_GAME_ALIAS = {
  Holland: 'Netherlands',
  'Ivory Coast': "Côte d'Ivoire",
  'South Korea': 'Korea Republic',
  USA: 'United States',
  Ireland: 'Republic of Ireland',
  Czechia: 'Czechia',
  'Czech Republic': 'Czechia',
  UAE: 'United Arab Emirates',
  China: 'China PR',
  'Cape Verde': 'Cabo Verde',
  Bosnia: 'Bosnia and Herzegovina',
};

// Add aliases as additional accepted keys so the script also emits a pool
// under the in-game label (e.g. "Netherlands" → mirror of "Holland").
for (const k of Object.keys(NATIONALITY_GAME_ALIAS)) {
  GAME_NATIONS.add(k);
  GAME_NATIONS.add(NATIONALITY_GAME_ALIAS[k]);
}

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = values[j] || '';
    results.push(obj);
  }
  return results;
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

const VALID_POS = new Set(['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST']);
const POS_ALIASES = { LWB: 'LB', RWB: 'RB', CF: 'ST', LF: 'LW', RF: 'RW' };

function mapPosition(p) {
  const t = (p || '').trim().toUpperCase();
  if (VALID_POS.has(t)) return t;
  if (POS_ALIASES[t]) return POS_ALIASES[t];
  return null;
}

function parsePositions(playerPositions) {
  if (!playerPositions) return { primary: 'CM', alts: [] };
  const tokens = playerPositions.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
  const mapped = tokens.map(mapPosition).filter(Boolean);
  if (mapped.length === 0) return { primary: 'CM', alts: [] };
  const primary = mapped[0];
  const alts = [...new Set(mapped.slice(1))].filter(p => p !== primary);
  return { primary, alts };
}

const NAME_SUFFIXES = new Set(['Jr.', 'Sr.', 'Jr', 'Sr', 'II', 'III', 'IV', 'Júnior']);
const ABBREV_RE = /^([A-ZÀ-ÖØ-öø-ÿ])\.\s+(.+)$/;

/**
 * Extract first + last name from FC26 long_name + short_name.
 *
 *  - Last name preference: the part after "X." in short_name (the
 *    author-curated family name as fans know the player). Falls back
 *    to the last meaningful word of long_name when short_name has no
 *    abbreviation marker.
 *  - First name: the first word of long_name (the actual given name,
 *    not just the initial).
 */
function extractName(longName, shortName) {
  const longParts = (longName || '').trim().split(/\s+/).filter(Boolean);
  const shortParts = (shortName || '').trim().split(/\s+/).filter(Boolean);

  const fn = longParts[0] || shortParts[0] || 'Unknown';

  let ln;
  const m = (shortName || '').match(ABBREV_RE);
  if (m) {
    ln = m[2].trim();
  } else if (shortParts.length >= 2) {
    ln = shortParts.slice(1).join(' ');
  } else if (longParts.length >= 2) {
    let i = longParts.length - 1;
    while (i > 0 && NAME_SUFFIXES.has(longParts[i])) i--;
    ln = longParts[i];
  } else {
    ln = shortParts[0] || longParts[0] || 'Unknown';
  }
  return { fn, ln };
}

function intOr(s, fallback) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

function computeMental(row) {
  const composure = intOr(row['mentality_composure'], 50);
  const vision = intOr(row['mentality_vision'], 50);
  const reactions = intOr(row['movement_reactions'], 50);
  return Math.round((composure + vision + reactions) / 3);
}

function computePotential(rawPotential, age, ovr) {
  const fromCsv = intOr(rawPotential, 0);
  if (fromCsv > 0) return Math.max(fromCsv, ovr);
  if (age <= 20) return Math.min(99, ovr + 8);
  if (age <= 23) return Math.min(99, ovr + 5);
  if (age <= 27) return Math.min(99, ovr + 2);
  if (age <= 30) return ovr;
  return Math.max(ovr - 2, 40);
}

function buildAttributesForGK(row) {
  // FC26 leaves the 6-axis pace/shooting/.../physic columns blank for GKs and
  // exposes them under goalkeeping_*. Map those into our 6 axes so the GK
  // weights in POSITION_WEIGHTS produce an overall that lines up with the
  // FC26 listed `overall`, instead of falling back to ~50 across the board.
  const gkSpeed = intOr(row['goalkeeping_speed'], 50);
  const gkKicking = intOr(row['goalkeeping_kicking'], 50);
  const gkPositioning = intOr(row['goalkeeping_positioning'], 50);
  const gkDiving = intOr(row['goalkeeping_diving'], 50);
  const gkHandling = intOr(row['goalkeeping_handling'], 50);
  const gkReflexes = intOr(row['goalkeeping_reflexes'], 50);
  const composure = intOr(row['mentality_composure'], 50);
  return {
    pace: gkSpeed,
    shooting: gkKicking,
    passing: gkKicking,
    defending: Math.round((gkPositioning + gkDiving) / 2),
    physical: gkHandling,
    mental: Math.round((gkReflexes + composure) / 2),
  };
}

function buildAttributesForOutfield(row) {
  return {
    pace: intOr(row['pace'], 50),
    shooting: intOr(row['shooting'], 50),
    passing: intOr(row['passing'], 50),
    defending: intOr(row['defending'], 50),
    physical: intOr(row['physic'], 50),
    mental: computeMental(row),
  };
}

function buildTemplate(row) {
  const ovr = intOr(row['overall'], 60);
  const age = intOr(row['age'], 25);
  const { primary: pos, alts } = parsePositions(row['player_positions']);
  const { fn, ln } = extractName(row['long_name'], row['short_name']);
  const heightCm = intOr(row['height_cm'], 0);
  const weightKg = intOr(row['weight_kg'], 0);
  const skillMoves = intOr(row['skill_moves'], 2);
  const fcId = (row['player_id'] || '').trim();

  const attrs = pos === 'GK' ? buildAttributesForGK(row) : buildAttributesForOutfield(row);

  const t = {
    fn,
    ln,
    pos,
    age,
    nat: row['nationality_name'] || 'Unknown',
    ovr,
    pot: computePotential(row['potential'], age, ovr),
    ...attrs,
    altPos: alts,
    skillMoves,
    source: 'real',
  };
  if (fcId) t.fcId = `fc26-${fcId}`;
  if (heightCm > 0) t.heightCm = heightCm;
  if (weightKg > 0) t.weightKg = weightKg;
  return t;
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

console.log('Reading CSV...');
const csvContent = readFileSync(CSV_PATH, 'utf-8');
const records = parseCSV(csvContent);
console.log(`Parsed ${records.length} players`);

const byNation = {};
let filteredOut = 0;
for (const row of records) {
  const nation = row['nationality_name'];
  if (!nation) continue;
  if (!GAME_NATIONS.has(nation)) { filteredOut++; continue; }
  const ovr = intOr(row['overall'], 0);
  if (ovr < MIN_OVR) continue;
  if (!byNation[nation]) byNation[nation] = [];
  byNation[nation].push(row);
}
console.log(`Filtered out ${filteredOut} players from non-game nations`);

const pool = {};
let totalPlayers = 0;
for (const [nation, rows] of Object.entries(byNation)) {
  rows.sort((a, b) => (intOr(b['overall'], 0) - intOr(a['overall'], 0)));
  const top = rows.slice(0, MAX_PER_NATION).map(buildTemplate);
  pool[nation] = top;
  totalPlayers += top.length;
}
// Mirror in-game alias labels so consumers can look up either form.
for (const [gameLabel, csvLabel] of Object.entries(NATIONALITY_GAME_ALIAS)) {
  if (pool[csvLabel] && !pool[gameLabel]) {
    pool[gameLabel] = pool[csvLabel].map(t => ({ ...t, nat: gameLabel }));
  }
}

console.log(`Building pool for ${Object.keys(pool).length} nations, ${totalPlayers} total players`);

const nations = Object.keys(pool).sort();
let output = `import type { PlayerTemplate } from '@/data/playerTemplates';\n\n`;
output += `/**\n`;
output += ` * National player pool — top ${MAX_PER_NATION} real players per nationality from FC26 data.\n`;
output += ` * Auto-generated by scripts/buildNationalPool.mjs from FC26_20250921.csv.\n`;
output += ` * Do not edit by hand — regenerate via \`node scripts/buildNationalPool.mjs\`.\n`;
output += ` * Used by:\n`;
output += ` *   - generateNationalTeamPool() to seed national-team squads.\n`;
output += ` *   - pickUnclaimedRealPlayer() to seed club squad fillers with real names + ratings.\n`;
output += ` */\n`;
output += `export const NATIONAL_PLAYER_POOL: Record<string, PlayerTemplate[]> = {\n`;

for (const nation of nations) {
  output += `  '${esc(nation)}': [\n`;
  for (const t of pool[nation]) {
    const altPosStr = t.altPos.length > 0 ? `, altPos: [${t.altPos.map(p => `'${p}'`).join(', ')}]` : '';
    const skillStr = t.skillMoves ? `, skillMoves: ${t.skillMoves}` : '';
    const heightStr = t.heightCm ? `, heightCm: ${t.heightCm}` : '';
    const weightStr = t.weightKg ? `, weightKg: ${t.weightKg}` : '';
    const fcIdStr = t.fcId ? `, fcId: '${esc(t.fcId)}'` : '';
    const sourceStr = t.source ? `, source: '${t.source}'` : '';
    output += `    { fn: '${esc(t.fn)}', ln: '${esc(t.ln)}', pos: '${t.pos}', age: ${t.age}, nat: '${esc(t.nat)}', ovr: ${t.ovr}, pot: ${t.pot}, pace: ${t.pace}, shooting: ${t.shooting}, passing: ${t.passing}, defending: ${t.defending}, physical: ${t.physical}, mental: ${t.mental}${altPosStr}${skillStr}${heightStr}${weightStr}${fcIdStr}${sourceStr} },\n`;
  }
  output += `  ],\n`;
}

output += `};\n`;

writeFileSync(OUT_PATH, output);
console.log(`Wrote ${OUT_PATH} (${(output.length / 1024).toFixed(1)} KB)`);
