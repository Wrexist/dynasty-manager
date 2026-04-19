#!/usr/bin/env node
/**
 * Build National Player Pool
 *
 * Parses fc25_players.csv and emits src/data/nationalPlayerPool.ts — a
 * PlayerTemplate[] per nationality, used to seed national-team squads with
 * real players instead of procedural names.
 *
 * Keeps only the top ~80 players per nation (by OVR) so bundle size stays small.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CSV_PATH = join(ROOT, 'fc25_players.csv');
const OUT_PATH = join(ROOT, 'src/data/nationalPlayerPool.ts');

const MAX_PER_NATION = 60;
const MIN_OVR = 58; // filter out very low-rated fodder

// ── CSV parsing (same algorithm as importFC25.mjs) ──
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

function mapPosition(pos) {
  const valid = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
  const aliases = { LWB: 'LB', RWB: 'RB', CF: 'ST', LF: 'LW', RF: 'RW' };
  if (valid.includes(pos)) return pos;
  return aliases[pos] || 'CM';
}

function parseAltPositions(altPosStr, primaryPos) {
  if (!altPosStr || altPosStr.trim() === '') return [];
  return altPosStr.split(/[,\s]+/)
    .map(p => mapPosition(p.trim()))
    .filter(p => p !== primaryPos && p !== '');
}

function computeMental(row) {
  const composure = parseInt(row['Composure']) || 50;
  const vision = parseInt(row['Vision']) || 50;
  const reactions = parseInt(row['Reactions']) || 50;
  return Math.round((composure + vision + reactions) / 3);
}

function computePotential(age, ovr) {
  if (age <= 20) return Math.min(99, ovr + 8);
  if (age <= 23) return Math.min(99, ovr + 5);
  if (age <= 27) return Math.min(99, ovr + 2);
  if (age <= 30) return ovr;
  return Math.max(ovr - 2, 40);
}

function buildTemplate(row) {
  const ovr = parseInt(row['OVR']) || 60;
  const age = parseInt(row['Age']) || 25;
  const pos = mapPosition(row['Position']);
  const name = row['Name'] || 'Unknown';
  const parts = name.split(/\s+/);
  const fn = parts.length === 1 ? parts[0] : parts[0];
  const ln = parts.length === 1 ? parts[0] : parts.slice(1).join(' ');
  return {
    fn, ln, pos, age,
    nat: row['Nation'] || 'Unknown',
    ovr,
    pot: computePotential(age, ovr),
    pace: parseInt(row['PAC']) || 50,
    shooting: parseInt(row['SHO']) || 50,
    passing: parseInt(row['PAS']) || 50,
    defending: parseInt(row['DEF']) || 50,
    physical: parseInt(row['PHY']) || 50,
    mental: computeMental(row),
    skillMoves: parseInt(row['Skill moves']) || 2,
    altPos: parseAltPositions(row['Alternative positions'] || '', pos),
  };
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Main ──
console.log('Reading CSV...');
const csvContent = readFileSync(CSV_PATH, 'utf-8');
const records = parseCSV(csvContent);
console.log(`Parsed ${records.length} players`);

// Group by nation
const byNation = {};
for (const row of records) {
  const nation = row['Nation'];
  if (!nation) continue;
  const ovr = parseInt(row['OVR']) || 0;
  if (ovr < MIN_OVR) continue;
  if (!byNation[nation]) byNation[nation] = [];
  byNation[nation].push(row);
}

// Sort each nation by OVR desc, take top N
const pool = {};
let totalPlayers = 0;
for (const [nation, rows] of Object.entries(byNation)) {
  rows.sort((a, b) => (parseInt(b['OVR']) || 0) - (parseInt(a['OVR']) || 0));
  const top = rows.slice(0, MAX_PER_NATION).map(buildTemplate);
  pool[nation] = top;
  totalPlayers += top.length;
}

console.log(`Building pool for ${Object.keys(pool).length} nations, ${totalPlayers} total players`);

// ── Emit TS ──
const nations = Object.keys(pool).sort();
let output = `import type { PlayerTemplate } from '@/data/playerTemplates';\n\n`;
output += `/**\n`;
output += ` * National player pool — top ${MAX_PER_NATION} real players per nationality from FC25 data.\n`;
output += ` * Auto-generated by scripts/buildNationalPool.mjs — do not edit by hand.\n`;
output += ` * Used by generateNationalTeamPool() to seed national-team squads with real players.\n`;
output += ` */\n`;
output += `export const NATIONAL_PLAYER_POOL: Record<string, PlayerTemplate[]> = {\n`;

for (const nation of nations) {
  output += `  '${esc(nation)}': [\n`;
  for (const t of pool[nation]) {
    const altPosStr = t.altPos.length > 0 ? `, altPos: [${t.altPos.map(p => `'${p}'`).join(', ')}]` : '';
    const skillStr = t.skillMoves ? `, skillMoves: ${t.skillMoves}` : '';
    output += `    { fn: '${esc(t.fn)}', ln: '${esc(t.ln)}', pos: '${t.pos}', age: ${t.age}, nat: '${esc(t.nat)}', ovr: ${t.ovr}, pot: ${t.pot}, pace: ${t.pace}, shooting: ${t.shooting}, passing: ${t.passing}, defending: ${t.defending}, physical: ${t.physical}, mental: ${t.mental}${altPosStr}${skillStr} },\n`;
  }
  output += `  ],\n`;
}

output += `};\n`;

writeFileSync(OUT_PATH, output);
console.log(`Wrote ${OUT_PATH} (${(output.length / 1024).toFixed(1)} KB)`);
