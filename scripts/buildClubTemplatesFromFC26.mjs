#!/usr/bin/env node
/**
 * Regenerate src/data/squads/<league>.ts files from FC26_20250921.csv
 *
 * Replaces the FC25-era hand-curated club templates in CLUB_TEMPLATES
 * with FC26 real rosters: every player carries the same fcId, name,
 * age, nationality, OVR/POT, 6-axis attributes, height/weight and
 * skill-moves rating that they have in EA's FC26 dataset.
 *
 * Inputs
 *   FC26_20250921.csv          — raw FC26 player data (~18k rows)
 *   scripts/fc26-report.json   — auto FC26-club ↔ game-club mapping
 *                                produced by scripts/analyzeFC26.mjs;
 *                                buckets A + B are confident matches.
 *
 * Outputs
 *   src/data/squads/<league>.ts   one file per game league with all
 *                                 mapped clubs in that league.
 *
 * Clubs that have no FC26 mapping are simply absent from the emitted
 * file and fall through to runtime real-player picker fillers (see
 * src/utils/realPlayerPicker.ts) at game-init time.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CSV_PATH = join(ROOT, 'FC26_20250921.csv');
const REPORT_PATH = join(ROOT, 'scripts/fc26-report.json');
const OUT_DIR = join(ROOT, 'src/data/squads');

// Translate FC26-report league IDs (3-letter codes) to the file names
// already used under src/data/squads/. Anything not in this map keeps
// its existing FC25 file because we don't have a target name for it.
const LEAGUE_FILE_MAP = {
  aut: 'austria',
  bel: 'belgium',
  che: 'switzerland',
  cyp: 'cyprus',
  cze: 'czechia',
  den: 'denmark',
  eng: 'england',
  'eng-2': 'england2',
  'eng-3': 'england3',
  'eng-4': 'england4',
  esp: 'spain',
  'esp-2': 'spain2',
  fin: 'finland',
  fra: 'france',
  'fra-2': 'france2',
  ger: 'germany',
  'ger-2': 'germany2',
  'ger-3': 'germany3',
  gre: 'greece',
  hun: 'hungary',
  ice: 'iceland',
  irl: 'ireland',
  isr: 'israel',
  ita: 'italy',
  'ita-2': 'italy2',
  ned: 'netherlands',
  nor: 'norway',
  pol: 'poland',
  por: 'portugal',
  rou: 'romania',
  sco: 'scotland',
  srb: 'serbia',
  svk: 'slovakia',
  swe: 'sweden',
  tur: 'turkey',
  ukr: 'ukraine',
};

// FC26 club names → game club ids that the auto-matcher missed (bucket
// C1). Without this list, big clubs like Bayern, Inter, AC Milan, PSV,
// Benfica fall through to runtime random fillers — visibly wrong on
// the team sheet. Every entry is a league-club id from
// src/data/leagues/*.ts; aliases are no longer needed because the
// generated files key by league id directly.
const FC26_CLUB_OVERRIDES = {
  // ger
  'FC Bayern München': { clubId: 'bayern-munich', leagueId: 'ger' },
  'Bayer 04 Leverkusen': { clubId: 'bayer-leverkusen', leagueId: 'ger' },
  'TSG 1899 Hoffenheim': { clubId: 'hoffenheim', leagueId: 'ger' },
  '1. FSV Mainz 05': { clubId: 'mainz-05', leagueId: 'ger' },
  '1. FC Heidenheim 1846': { clubId: 'fc-heidenheim', leagueId: 'ger' },
  '1. FC Köln': { clubId: 'koln', leagueId: 'ger' },
  'Hamburger SV': { clubId: 'hamburg', leagueId: 'ger' },
  // ita
  Inter: { clubId: 'inter-milan', leagueId: 'ita' },
  'AC Milan': { clubId: 'ac-milan', leagueId: 'ita' },
  Roma: { clubId: 'as-roma', leagueId: 'ita' },
  Sassuolo: { clubId: 'sassuolo', leagueId: 'ita' },
  Pisa: { clubId: 'pisa', leagueId: 'ita' },
  Cremonese: { clubId: 'cremonese', leagueId: 'ita' },
  // ita-2
  Empoli: { clubId: 'empoli', leagueId: 'ita-2' },
  Monza: { clubId: 'monza', leagueId: 'ita-2' },
  Venezia: { clubId: 'venezia', leagueId: 'ita-2' },
  // esp
  'Athletic Club': { clubId: 'athletic-bilbao', leagueId: 'esp' },
  'Real Betis Balompié': { clubId: 'real-betis', leagueId: 'esp' },
  'CA Osasuna': { clubId: 'osasuna', leagueId: 'esp' },
  'RCD Mallorca': { clubId: 'mallorca', leagueId: 'esp' },
  'RCD Espanyol': { clubId: 'espanyol', leagueId: 'esp' },
  'RC Celta': { clubId: 'celta-vigo', leagueId: 'esp' },
  'Levante UD': { clubId: 'levante', leagueId: 'esp' },
  'Elche CF': { clubId: 'elche', leagueId: 'esp' },
  'Real Oviedo': { clubId: 'real-oviedo', leagueId: 'esp' },
  // esp-2
  'UD Las Palmas': { clubId: 'las-palmas', leagueId: 'esp-2' },
  'Real Valladolid CF': { clubId: 'real-valladolid', leagueId: 'esp-2' },
  'CD Leganés': { clubId: 'leganes', leagueId: 'esp-2' },
  'Granada CF': { clubId: 'granada', leagueId: 'esp-2' },
  'Cádiz CF': { clubId: 'cadiz', leagueId: 'esp-2' },
  // fra
  'Olympique de Marseille': { clubId: 'marseille', leagueId: 'fra' },
  'Olympique Lyonnais': { clubId: 'lyon', leagueId: 'fra' },
  'AS Monaco': { clubId: 'monaco', leagueId: 'fra' },
  'OGC Nice': { clubId: 'nice', leagueId: 'fra' },
  'Lille OSC': { clubId: 'lille', leagueId: 'fra' },
  'RC Lens': { clubId: 'lens', leagueId: 'fra' },
  'RC Strasbourg Alsace': { clubId: 'strasbourg', leagueId: 'fra' },
  'Stade Rennais FC': { clubId: 'rennes', leagueId: 'fra' },
  'Stade Brestois 29': { clubId: 'brest', leagueId: 'fra' },
  'AJ Auxerre': { clubId: 'auxerre', leagueId: 'fra' },
  'Le Havre AC': { clubId: 'le-havre', leagueId: 'fra' },
  'Angers SCO': { clubId: 'angers', leagueId: 'fra' },
  'FC Lorient': { clubId: 'lorient', leagueId: 'fra' },
  'FC Metz': { clubId: 'metz', leagueId: 'fra' },
  'Paris FC': { clubId: 'paris-fc', leagueId: 'fra' },
  // fra-2
  'Stade de Reims': { clubId: 'reims', leagueId: 'fra-2' },
  'Montpellier HSC': { clubId: 'montpellier', leagueId: 'fra-2' },
  'AS Saint-Étienne': { clubId: 'saint-etienne', leagueId: 'fra-2' },
  // ned
  PSV: { clubId: 'psv-eindhoven', leagueId: 'ned' },
  'FC Utrecht': { clubId: 'fc-utrecht', leagueId: 'ned' },
  'FC Twente': { clubId: 'fc-twente', leagueId: 'ned' },
  'FC Groningen': { clubId: 'fc-groningen', leagueId: 'ned' },
  // por
  'SL Benfica': { clubId: 'benfica', leagueId: 'por' },
  'Sporting Clube de Braga': { clubId: 'braga', leagueId: 'por' },
  'Vitória SC': { clubId: 'vitoria-guimaraes', leagueId: 'por' },
  'GD Estoril Praia': { clubId: 'estoril', leagueId: 'por' },
  // tur
  'Galatasaray SK': { clubId: 'galatasaray', leagueId: 'tur' },
  'Fenerbahçe SK': { clubId: 'fenerbahce', leagueId: 'tur' },
  'Beşiktaş JK': { clubId: 'besiktas', leagueId: 'tur' },
  'Medipol Başakşehir FK': { clubId: 'istanbul-basaksehir', leagueId: 'tur' },
  'Kasımpaşa SK': { clubId: 'kasimpasa', leagueId: 'tur' },
  // eng
  Sunderland: { clubId: 'sunderland', leagueId: 'eng' },
  Burnley: { clubId: 'burnley', leagueId: 'eng' },
  'Brighton & Hove Albion': { clubId: 'brighton', leagueId: 'eng' },
  'Leeds United': { clubId: 'leeds-united', leagueId: 'eng' },
  // eng-2
  'Leicester City': { clubId: 'leicester', leagueId: 'eng-2' },
  Southampton: { clubId: 'southampton', leagueId: 'eng-2' },
  'Sheffield United': { clubId: 'sheffield-united', leagueId: 'eng-2' },
  'Norwich City': { clubId: 'norwich-city', leagueId: 'eng-2' },
  'Ipswich Town': { clubId: 'ipswich-town', leagueId: 'eng-2' },
  'West Bromwich Albion': { clubId: 'west-brom', leagueId: 'eng-2' },
  'Birmingham City': { clubId: 'birmingham-city', leagueId: 'eng-2' },
  'Sheffield Wednesday': { clubId: 'sheffield-wednesday', leagueId: 'eng-2' },
  'Preston North End': { clubId: 'preston-north-end', leagueId: 'eng-2' },
  'Queens Park Rangers': { clubId: 'qpr', leagueId: 'eng-2' },
  Wrexham: { clubId: 'wrexham', leagueId: 'eng-2' },
  'Charlton Athletic': { clubId: 'charlton-athletic', leagueId: 'eng-2' },
  // sco
  Falkirk: { clubId: 'falkirk', leagueId: 'sco' },
  'Livingston FC': { clubId: 'livingston', leagueId: 'sco' },
  // bel
  'RSC Anderlecht': { clubId: 'anderlecht', leagueId: 'bel' },
  'Club Brugge KV': { clubId: 'club-brugge', leagueId: 'bel' },
  'Royal Antwerp FC': { clubId: 'antwerp', leagueId: 'bel' },
  'KAA Gent': { clubId: 'gent', leagueId: 'bel' },
  'KRC Genk': { clubId: 'genk', leagueId: 'bel' },
  'Standard de Liège': { clubId: 'standard-liege', leagueId: 'bel' },
  'Cercle Brugge KSV': { clubId: 'cercle-brugge', leagueId: 'bel' },
  'Union Saint-Gilloise': { clubId: 'union-sg', leagueId: 'bel' },
  // den
  'FC København': { clubId: 'fc-copenhagen', leagueId: 'den' },
  'FC Midtjylland': { clubId: 'fc-midtjylland', leagueId: 'den' },
  'Brøndby IF': { clubId: 'brondby', leagueId: 'den' },
  'FC Nordsjælland': { clubId: 'fc-nordsjaelland', leagueId: 'den' },
  'Randers FC': { clubId: 'randers', leagueId: 'den' },
  // nor
  'Molde FK': { clubId: 'molde', leagueId: 'nor' },
  'FK Bodø/Glimt': { clubId: 'bodo-glimt', leagueId: 'nor' },
  'SK Brann': { clubId: 'brann', leagueId: 'nor' },
  'Rosenborg BK': { clubId: 'rosenborg', leagueId: 'nor' },
  'Viking FK': { clubId: 'viking', leagueId: 'nor' },
  'Vålerenga Fotball': { clubId: 'valerenga', leagueId: 'nor' },
  // swe
  'BK Häcken': { clubId: 'hacken', leagueId: 'swe' },
  'Djurgårdens IF': { clubId: 'djurgarden', leagueId: 'swe' },
  'Hammarby Fotboll': { clubId: 'hammarby', leagueId: 'swe' },
  'IF Elfsborg': { clubId: 'elfsborg', leagueId: 'swe' },
  'Mjällby AIF': { clubId: 'mjallby', leagueId: 'swe' },
  // aut
  'SK Rapid': { clubId: 'rapid-wien', leagueId: 'aut' },
  'FC Red Bull Salzburg': { clubId: 'red-bull-salzburg', leagueId: 'aut' },
  'SK Sturm Graz': { clubId: 'sturm-graz', leagueId: 'aut' },
  'FK Austria Wien': { clubId: 'austria-wien', leagueId: 'aut' },
  'LASK Linz': { clubId: 'lask', leagueId: 'aut' },
  // che
  'BSC Young Boys': { clubId: 'young-boys', leagueId: 'che' },
  'FC Basel 1893': { clubId: 'fc-basel', leagueId: 'che' },
  'FC Zürich': { clubId: 'fc-zurich', leagueId: 'che' },
  'FC Lugano': { clubId: 'fc-lugano', leagueId: 'che' },
  // ger-2
  'FC Schalke 04': { clubId: 'schalke', leagueId: 'ger-2' },
  'Holstein Kiel': { clubId: 'holstein-kiel', leagueId: 'ger-2' },
  '1. FC Nürnberg': { clubId: 'nurnberg', leagueId: 'ger-2' },
  'Fortuna Düsseldorf': { clubId: 'fortuna-dusseldorf', leagueId: 'ger-2' },
  // pol
  'Widzew Łódź': { clubId: 'widzew-lodz', leagueId: 'pol' },
  // rou
  'FCV Farul Constanța': { clubId: 'farul-constanta', leagueId: 'rou' },
  'FC Argeș': { clubId: 'fc-arges', leagueId: 'rou' },
  // eng-3
  'Cardiff City': { clubId: 'cardiff-city', leagueId: 'eng-3' },
  'Plymouth Argyle': { clubId: 'plymouth-argyle', leagueId: 'eng-3' },
  'Luton Town': { clubId: 'luton-town', leagueId: 'eng-3' },
  'Bolton Wanderers': { clubId: 'bolton-wanderers', leagueId: 'eng-3' },
  'Huddersfield Town': { clubId: 'huddersfield-town', leagueId: 'eng-3' },
  // eng-4
  'Milton Keynes Dons': { clubId: 'mk-dons', leagueId: 'eng-4' },
  'Bristol Rovers': { clubId: 'bristol-rovers', leagueId: 'eng-4' },
  'Cambridge United': { clubId: 'cambridge-united', leagueId: 'eng-4' },
};

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

function parseCSV(content) {
  // Strip a UTF-8 BOM and normalise CRLF → LF before splitting. Without
  // this a BOM makes headers[0] become "﻿player_id" — every column
  // lookup keyed by the first header silently returns '' and downstream
  // fcId/realPlayerPicker matching breaks completely.
  const normalized = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = parseCSVLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = (f[j] || '').trim();
    out.push(obj);
  }
  return out;
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
// Cover Latin-1 (À-ÿ) and Latin Extended-A (Ā-ſ, U+0100–U+017F) so
// initials like Š./Ž./Č./Ł./Ś. hit the abbreviation branch.
const ABBREV_RE = /^([A-ZÀ-ÖØ-öø-ÿĀ-ſ])\.\s+(.+)$/;

// Lowercase + strip whitespace and hyphens so "Gue-sung" / "Gue Sung" /
// "Guesung" all collapse to the same key. Used to detect when a
// hyphenated mononym got duplicated across fn and ln.
function nameDedupKey(s) {
  return (s || '').toLowerCase().replace(/[\s-]+/g, '');
}

function extractName(longName, shortName) {
  const longParts = (longName || '').trim().split(/\s+/).filter(Boolean);
  const shortParts = (shortName || '').trim().split(/\s+/).filter(Boolean);
  const fallback = longParts[0] || shortParts[0] || 'Unknown';

  let fn;
  let ln;

  const m = (shortName || '').match(ABBREV_RE);
  if (m) {
    // "J. Bellingham" → fn from full long name, ln from the short.
    fn = longParts[0] || fallback;
    ln = m[2].trim();
  } else if (shortParts.length >= 2) {
    // "Lautaro Martínez" — Western order, fn + ln.
    // "Cho Gue Sung" — Korean order in FC26, family + given.
    // Either way EA's short_name encodes how the player is labelled, so
    // trust it: first token = fn, rest = ln. (Multi-word given names
    // like "Pierre-Emerick" already arrive hyphenated as a single token.)
    fn = shortParts[0];
    ln = shortParts.slice(1).join(' ');
  } else if (shortParts.length === 1 && longParts.length >= 2) {
    // Single-token short_name. Two distinct cases:
    //   a) True mononym — long_name *starts* with the short token
    //      (Rodrygo / Endrick / Brahim). The player is known by a
    //      single name; emit fn = ln = short so display stays clean.
    //   b) Surname-only short — long_name starts with a different
    //      given name (Carvajal → "Daniel Carvajal Ramos"). Treat
    //      short as ln and pull fn from long_name's first token.
    const shortKey = nameDedupKey(shortParts[0]);
    if (longParts.length > 0 && nameDedupKey(longParts[0]) === shortKey) {
      fn = shortParts[0];
      ln = shortParts[0];
    } else {
      ln = shortParts[0];
      const firstDifferent = longParts.find(p => nameDedupKey(p) !== shortKey);
      fn = firstDifferent ?? longParts[0] ?? ln;
    }
  } else {
    fn = fallback;
    if (longParts.length >= 2) {
      let i = longParts.length - 1;
      while (i > 0 && NAME_SUFFIXES.has(longParts[i])) i--;
      ln = longParts[i];
    } else {
      ln = shortParts[0] || longParts[0] || 'Unknown';
    }
  }

  // Final pass: if fn and ln still collapse to the same dedup key
  // (hyphenated Korean / Japanese romanisations like
  // 'Gue-sung' vs 'Gue Sung'), fall back to a single mononym so the
  // generated row doesn't render as "Gue-sung Gue Sung".
  if (nameDedupKey(fn) === nameDedupKey(ln)) {
    fn = ln;
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
    fn, ln, pos, age,
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

function emitTemplate(t) {
  const altPosStr = t.altPos.length > 0 ? `, altPos: [${t.altPos.map(p => `'${p}'`).join(', ')}]` : '';
  const skillStr = t.skillMoves ? `, skillMoves: ${t.skillMoves}` : '';
  const heightStr = t.heightCm ? `, heightCm: ${t.heightCm}` : '';
  const weightStr = t.weightKg ? `, weightKg: ${t.weightKg}` : '';
  const fcIdStr = t.fcId ? `, fcId: '${esc(t.fcId)}'` : '';
  const sourceStr = t.source ? `, source: '${t.source}'` : '';
  return `      { fn: '${esc(t.fn)}', ln: '${esc(t.ln)}', pos: '${t.pos}', age: ${t.age}, nat: '${esc(t.nat)}', ovr: ${t.ovr}, pot: ${t.pot}, pace: ${t.pace}, shooting: ${t.shooting}, passing: ${t.passing}, defending: ${t.defending}, physical: ${t.physical}, mental: ${t.mental}${altPosStr}${skillStr}${heightStr}${weightStr}${fcIdStr}${sourceStr} },`;
}

console.log('Reading inputs...');
const report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
const csvContent = readFileSync(CSV_PATH, 'utf-8');
const records = parseCSV(csvContent);
console.log(`Parsed ${records.length} CSV rows`);

const fc26ToGame = new Map();
for (const e of [...report.bucketA, ...report.bucketB]) {
  fc26ToGame.set(e.fc26Name, { clubId: e.gameClubId, leagueId: e.gameLeagueId });
}
let overrideCount = 0;
for (const [fc26Name, mapping] of Object.entries(FC26_CLUB_OVERRIDES)) {
  if (!fc26ToGame.has(fc26Name)) overrideCount++;
  fc26ToGame.set(fc26Name, mapping);
}
console.log(`Loaded ${fc26ToGame.size} FC26→game-club mappings (${overrideCount} via manual override)`);

const byClub = {};
for (const row of records) {
  const fc26ClubName = row['club_name'];
  const map = fc26ToGame.get(fc26ClubName);
  if (!map) continue;
  if (!byClub[map.clubId]) byClub[map.clubId] = { leagueId: map.leagueId, players: [] };
  byClub[map.clubId].players.push(buildTemplate(row));
}

const byLeague = {};
let totalClubs = 0;
let totalPlayers = 0;
let skippedLeagues = new Set();
for (const [clubId, data] of Object.entries(byClub)) {
  const fileName = LEAGUE_FILE_MAP[data.leagueId];
  if (!fileName) { skippedLeagues.add(data.leagueId); continue; }
  if (!byLeague[fileName]) byLeague[fileName] = {};
  data.players.sort((a, b) => b.ovr - a.ovr);
  byLeague[fileName][clubId] = data.players;
  totalClubs++;
  totalPlayers += data.players.length;
}
if (skippedLeagues.size > 0) {
  console.log(`Skipped leagues with no file mapping: ${[...skippedLeagues].join(', ')}`);
}

for (const [fileName, clubs] of Object.entries(byLeague)) {
  const sortedClubIds = Object.keys(clubs).sort();
  let out = `import type { PlayerTemplate } from '@/data/playerTemplates';\n\n`;
  out += `// ${fileName} — Auto-generated from FC26_20250921.csv via\n`;
  out += `// scripts/buildClubTemplatesFromFC26.mjs. Do not edit by hand.\n`;
  out += `// Re-run \`node scripts/buildClubTemplatesFromFC26.mjs\` after\n`;
  out += `// updating the FC26 CSV.\n`;
  out += `export const SQUADS: Record<string, PlayerTemplate[]> = {\n`;
  for (const clubId of sortedClubIds) {
    out += `  '${esc(clubId)}': [\n`;
    for (const t of clubs[clubId]) out += emitTemplate(t) + '\n';
    out += `  ],\n`;
  }
  out += `};\n`;
  const outPath = join(OUT_DIR, `${fileName}.ts`);
  writeFileSync(outPath, out);
  console.log(`Wrote ${fileName}.ts (${sortedClubIds.length} clubs, ${(out.length / 1024).toFixed(1)} KB)`);
}

console.log(`\nDone — ${totalClubs} clubs, ${totalPlayers} players, ${Object.keys(byLeague).length} league files.`);
