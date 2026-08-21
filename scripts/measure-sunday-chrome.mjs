#!/usr/bin/env node
/**
 * Sunday League chrome meter.
 *
 * Counts the STATIC ENGLISH TEXT each Sunday screen can put on the glass, at
 * any two git revisions, so a copy-reduction pass can be stated as a number
 * instead of an impression.
 *
 *   node scripts/measure-sunday-chrome.mjs <before-rev> [after-rev]   # default HEAD
 *
 * WHAT IT COUNTS, per file, deduped by string:
 *   1. `t('key')` resolved through `src/i18n/locales/en.ts`. A key whose EVERY
 *      occurrence sits in an `aria-*` attribute is not on the glass and is
 *      skipped; one used anywhere visible counts.
 *   2. Template keys — ``t(`sunday.match.style.${x}`)`` — as every en key under
 *      that prefix, because any of them can render.
 *   3. Keys reached through a lookup map (`{ pitch: 'sunday.club.statPitch' }`).
 *      Missing these under-counts exactly the screens a refactor moved into
 *      maps, which is the direction that flatters a reduction.
 *   4. Hardcoded JSX text nodes and visible string props.
 *   5. Prose fields of the config records the screen renders — a tactic's
 *      tagline, an upgrade's description, a sponsor's blurb. Rendered inside a
 *      `.map()` over the array it counts every record; reached through an
 *      accessor (`getSundayTactic(id)`) it counts one, at the mean record
 *      length, so the figure does not depend on which club was rolled.
 *
 * CLASSIFICATION. `explanatory` is any string of EXPLANATORY_MIN characters or
 * more — copy that explains rather than labels. Calibrated against the opening
 * audit of the immersion overhaul, which reported 59.9% of its chrome as
 * explanatory; this threshold reproduces 59.7% on the same files at the same
 * revision.
 *
 * VOICE is measured separately and must never fall: the authored lines a player
 * reads as the club's own voice (commentary, arrival beats, memories,
 * relationship lines, event bodies, rivalry, opponent intel). Cutting chrome by
 * cutting voice is not the same trade.
 *
 * PROVENANCE. Reconstructed after the original ad-hoc script was lost. It
 * reproduces the opening audit's per-file figures exactly for Hub, Setup,
 * Squad, Recruit, Table, EventModal and WeekBar, within nine characters for
 * Clubhouse, Teamsheet, History and Bits, and within sixty for MatchDay —
 * 99.0% of its 7,997 total. It is a report, not a gate: nothing in preflight
 * calls it.
 */
import { execSync } from 'node:child_process';

// ── the files ───────────────────────────────────────────────────────────────

/** The twelve the opening audit named, in the order it listed them. */
const NAMED = {
  Clubhouse:  'src/pages/SundayClubhouse.tsx',
  MatchDay:   'src/pages/SundayMatchDay.tsx',
  Setup:      'src/pages/SundaySetup.tsx',
  Teamsheet:  'src/pages/SundayTeamsheet.tsx',
  Hub:        'src/pages/SundayHub.tsx',
  Squad:      'src/pages/SundaySquad.tsx',
  History:    'src/pages/SundayHistory.tsx',
  Recruit:    'src/pages/SundayRecruit.tsx',
  Table:      'src/pages/SundayTable.tsx',
  Bits:       'src/components/game/sunday/SundayBits.tsx',
  EventModal: 'src/components/game/sunday/SundayEventModal.tsx',
  WeekBar:    'src/components/game/sunday/SundayWeekBar.tsx',
};

/** Config records whose prose reaches a screen. */
const CONFIG_SOURCES = [
  { sym: 'SUNDAY_UPGRADES',      acc: 'sundayUpgrade',        file: 'src/config/sundayLeague.ts' },
  { sym: 'SUNDAY_TACTICS',       acc: 'getSundayTactic',      file: 'src/config/sundayLeague.ts' },
  { sym: 'SUNDAY_ARCHETYPES',    acc: 'getSundayArchetype',   file: 'src/config/sundayLeague.ts' },
  { sym: 'SUNDAY_PERSONALITIES', acc: 'getSundayPersonality', file: 'src/config/sundayLeague.ts' },
  // Sponsors reach the screen through saved state, not the config array, so
  // the maps that render them are named rather than discovered.
  { sym: 'SUNDAY_SPONSORS', acc: 'sundaySponsor', file: 'src/data/sundayNames.ts', mapVia: ['sponsorOffers', 'sponsors'] },
];
/** `name` is an identity, not chrome — the audit excluded it and so does this. */
const PROSE_FIELDS = ['tagline', 'description', 'blurb'];

/** Authored narrative. Chrome may fall; this may not. */
const VOICE_FILES = [
  'src/data/sundayNames.ts', 'src/data/sundayEvents.ts',
  'src/utils/sunday/memories.ts', 'src/utils/sunday/relationships.ts',
  'src/utils/sunday/rivalry.ts', 'src/utils/sunday/match.ts',
  'src/utils/sunday/briefing.ts', 'src/utils/sunday/events.ts',
  'src/utils/sunday/season.ts', 'src/utils/sunday/view.ts',
];
const VOICE_KEY_PREFIXES = ['sunday.match.style.', 'sunday.match.counter.'];

export const EXPLANATORY_MIN = 35;

// ── reading ─────────────────────────────────────────────────────────────────

const readAt = (rev, path) => {
  // stdio 'pipe' on stderr: a file that does not exist at `rev` is the normal
  // case for every component a later phase added, not an error worth printing.
  try { return execSync(`git show ${rev}:${path}`, { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
};

/** Blank out comments, preserving offsets so the lookbehinds below stay true. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(Math.max(0, m.length - p.length)));
}

function parseEn(src) {
  const map = new Map();
  const re = /^\s*'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(src))) {
    map.set(m[1], (m[2] ?? m[3] ?? m[4]).replace(/\\(['"`])/g, '$1').replace(/\\n/g, '\n'));
  }
  return map;
}

// ── the four text sources ───────────────────────────────────────────────────

function literalTStrings(src, en) {
  const clean = stripComments(src);
  const allA11y = new Map();
  for (const m of clean.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)) {
    const before = clean.slice(Math.max(0, m.index - 90), m.index);
    const a11y = /aria-[a-z]+\s*=\s*\{\s*$/.test(before);
    allA11y.set(m[2], (allA11y.get(m[2]) ?? true) && a11y);
  }
  const out = [];
  for (const [k, hidden] of allA11y) {
    if (hidden) continue;
    const v = en.get(k);
    if (v !== undefined) out.push(v);
  }
  return out;
}

function templateStrings(src, en) {
  const out = [];
  for (const m of stripComments(src).matchAll(/\bt\(\s*`([^`$]*)\$\{/g))
    for (const [k, v] of en) if (k.startsWith(m[1])) out.push(v);
  return out;
}

function mappedStrings(src, en) {
  const clean = stripComments(src);
  const out = [];
  for (const m of clean.matchAll(/'(sunday\.[A-Za-z0-9_.\-]+)'/g)) {
    if (/\bt\(\s*$/.test(clean.slice(Math.max(0, m.index - 6), m.index))) continue;
    const v = en.get(m[1]);
    if (v !== undefined) out.push(v);
  }
  return out;
}

const NOISE = /^[\s\d\W]*$/;
const CODEY = /[<>{}]|^\s*(https?:|\/|\.|@|#)|(^|\s)(w-|h-|px-|py-|text-|bg-|flex|grid|rounded|border|gap-|min-|max-)/;
function hardcodedStrings(src) {
  const clean = stripComments(src);
  const out = new Set();
  for (const m of clean.matchAll(/>([^<>{}();=\n]{1,200})</g)) {
    const s = m[1].trim();
    if (!s || NOISE.test(s) || CODEY.test(s)) continue;
    if (!/[A-Za-z]{2}/.test(s)) continue;
    if (/[_`$\\]|=>|\bconst\b|\breturn\b|\bimport\b/.test(s)) continue;
    out.add(s);
  }
  for (const m of clean.matchAll(/\b(title|label|placeholder|heading|subtitle|empty|caption)\s*=\s*(['"])([^'"]{2,200})\2/g)) {
    const s = m[3].trim();
    if (!s || NOISE.test(s) || CODEY.test(s)) continue;
    out.add(s);
  }
  return [...out];
}

function arrayBlock(src, name) {
  const i = src.indexOf(`export const ${name}`);
  if (i < 0) return '';
  const open = src.indexOf('[', src.indexOf('=', i));
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']' && !--depth) return src.slice(open, j + 1);
  }
  return '';
}

function fieldValues(block, field) {
  const re = new RegExp(`(?:^|[,{\\s])${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'g');
  const out = []; let m;
  while ((m = re.exec(block))) out.push(m[1].replace(/\\'/g, "'"));
  return out;
}

function configProse(rev, path) {
  const src = stripComments(readAt(rev, path) ?? '');
  const rows = [];
  for (const s of CONFIG_SOURCES) {
    const via = s.mapVia ?? [];
    const referenced = new RegExp(`\\b${s.sym}\\b`).test(src) || via.some(v => new RegExp(`\\b${v}\\b`).test(src));
    const accessed = new RegExp(`\\b${s.acc}[A-Za-z]*\\(`).test(src);
    if (!referenced && !accessed) continue;
    const block = arrayBlock(readAt(rev, s.file) ?? '', s.sym);
    if (!block) continue;
    const params = new Set();
    for (const sym of [s.sym, ...via])
      for (const m of src.matchAll(new RegExp(`\\b${sym}\\s*\\.\\s*(?:map|filter|flatMap)\\s*\\(\\s*\\(?\\s*([A-Za-z_$][\\w$]*)`, 'g')))
        params.add(m[1]);
    for (const f of PROSE_FIELDS) {
      if (!new RegExp(`\\.${f}\\b`).test(src)) continue;
      const vals = fieldValues(block, f);
      if (!vals.length) continue;
      const everyRecord = [...params].some(p => new RegExp(`\\b${p}\\.${f}\\b`).test(src));
      const total = vals.reduce((a, x) => a + x.length, 0);
      rows.push(everyRecord
        ? { label: `${s.sym.replace('SUNDAY_', '')}.${f}×${vals.length}`, chars: total, strings: vals }
        : { label: `${s.sym.replace('SUNDAY_', '')}.${f}×1`, chars: Math.round(total / vals.length), strings: [] });
    }
  }
  return rows;
}

// ── measuring ───────────────────────────────────────────────────────────────

function sundayComponentFiles(rev) {
  try {
    return execSync(
      `git ls-tree -r --name-only ${rev} -- src/components/game/sunday src/components/game/PitchBoard.tsx`,
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function measure(rev, files) {
  const en = parseEn(readAt(rev, 'src/i18n/locales/en.ts') ?? '');
  const rows = {};
  for (const [name, path] of Object.entries(files)) {
    const src = readAt(rev, path);
    if (src === null) { rows[name] = null; continue; }
    const cfg = configProse(rev, path);
    const ui = [...new Set([
      ...literalTStrings(src, en), ...templateStrings(src, en),
      ...mappedStrings(src, en), ...hardcodedStrings(src),
    ])];
    const all = [...new Set([...ui, ...cfg.flatMap(r => r.strings)])];
    let chrome = all.reduce((a, s) => a + s.length, 0);
    for (const r of cfg) if (!r.strings.length) chrome += r.chars;   // accessor: the mean record
    const explanatory = all.filter(s => s.length >= EXPLANATORY_MIN).reduce((a, s) => a + s.length, 0);
    rows[name] = {
      chrome, explanatory,
      big: all.filter(s => s.length > EXPLANATORY_MIN * 2 + 10).length,   // >80 chars
      ui: ui.reduce((a, s) => a + s.length, 0),
      uiExplanatory: ui.filter(s => s.length >= EXPLANATORY_MIN).reduce((a, s) => a + s.length, 0),
      sources: cfg.map(r => r.label),
    };
  }
  return rows;
}

const PROSE_LINE = /^[A-Z“‘({$].*\s.*/;
function voice(rev) {
  const out = {};
  for (const f of VOICE_FILES) {
    const raw = readAt(rev, f);
    if (raw === null) { out[f] = 0; continue; }
    const src = stripComments(raw);
    const seen = new Set();
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.){12,300})'|`((?:[^`\\]|\\.){12,300})`/g)) {
      const s = (m[1] ?? m[2]).replace(/\\'/g, "'");
      if (!PROSE_LINE.test(s)) continue;
      if (/[<>=]|^\s*(https?:|\/|@|#)/.test(s)) continue;
      seen.add(s);
    }
    out[f] = [...seen].reduce((a, s) => a + s.length, 0);
  }
  const en = parseEn(readAt(rev, 'src/i18n/locales/en.ts') ?? '');
  let keyed = 0;
  for (const [k, v] of en) if (VOICE_KEY_PREFIXES.some(p => k.startsWith(p))) keyed += v.length;
  out['en.ts (opponent intel)'] = keyed;
  return out;
}

// ── report ──────────────────────────────────────────────────────────────────

function main() {
  const before = process.argv[2];
  const after = process.argv[3] ?? 'HEAD';
  if (!before) {
    console.error('usage: node scripts/measure-sunday-chrome.mjs <before-rev> [after-rev]');
    process.exit(2);
  }
  const files = { ...NAMED };
  for (const f of new Set([...sundayComponentFiles(before), ...sundayComponentFiles(after)])) {
    const n = f.split('/').pop().replace(/\.tsx?$/, '').replace(/^Sunday/, '');
    if (!Object.values(files).includes(f)) files[n] = f;
  }
  const A = measure(before, files), B = measure(after, files);

  const pad = (s, n) => String(s).padEnd(n), r = (s, n) => String(s).padStart(n);
  console.log(`\nSunday chrome — ${before} → ${after}\n`);
  console.log('| screen | chrome before | chrome after | explanatory before | explanatory after | blocks >80 before/after |');
  console.log('|---|---|---|---|---|---|');
  const tot = { ca: 0, cb: 0, ea: 0, eb: 0, ba: 0, bb: 0, ua: 0, ub: 0, uea: 0, ueb: 0 };
  for (const name of Object.keys(files)) {
    const a = A[name], b = B[name];
    const [c0, c1] = [a?.chrome ?? 0, b?.chrome ?? 0];
    const [e0, e1] = [a?.explanatory ?? 0, b?.explanatory ?? 0];
    const [g0, g1] = [a?.big ?? 0, b?.big ?? 0];
    tot.ca += c0; tot.cb += c1; tot.ea += e0; tot.eb += e1; tot.ba += g0; tot.bb += g1;
    tot.ua += a?.ui ?? 0; tot.ub += b?.ui ?? 0;
    tot.uea += a?.uiExplanatory ?? 0; tot.ueb += b?.uiExplanatory ?? 0;
    const pct = c0 ? ` (${c1 > c0 ? '+' : ''}${(100 * (c1 - c0) / c0).toFixed(0)}%)` : '';
    console.log(`| ${pad(name, 14)} | ${r(c0, 5)} | ${r(c1, 5)}${pct} | ${r(e0, 5)} | ${r(e1, 5)} | ${g0} / ${g1} |`);
  }
  const d = (a, b) => `${b > a ? '+' : ''}${a ? (100 * (b - a) / a).toFixed(1) : '0.0'}%`;
  console.log(`| **TOTAL** | **${tot.ca}** | **${tot.cb}** (${d(tot.ca, tot.cb)}) | **${tot.ea}** | **${tot.eb}** (${d(tot.ea, tot.eb)}) | ${tot.ba} / ${tot.bb} |`);

  console.log(`\nUI copy only (config and game prose excluded):`);
  console.log(`  chrome      ${tot.ua} → ${tot.ub}  (${d(tot.ua, tot.ub)})`);
  console.log(`  explanatory ${tot.uea} → ${tot.ueb}  (${d(tot.uea, tot.ueb)})`);

  const va = voice(before), vb = voice(after);
  let ta = 0, tb = 0;
  for (const k of Object.keys(va)) { ta += va[k]; tb += vb[k]; }
  console.log(`\nAuthored voice: ${ta} → ${tb} (${tb - ta >= 0 ? '+' : ''}${tb - ta})`);
  for (const k of Object.keys(va)) if (vb[k] !== va[k]) console.log(`  ${k}: ${va[k]} → ${vb[k]}`);
  if (tb < ta) { console.error('\nVOICE FELL. Chrome cut by cutting voice is not the trade.'); process.exitCode = 1; }
}

main();
