#!/usr/bin/env node
/**
 * Sunday League chrome meter.
 *
 * Two modes, and the distinction matters more than anything else in this file:
 *
 *   --dom    <beforeURL> <afterURL>   THE HEADLINE. What is on the glass.
 *   --static <beforeRev> [afterRev]   A secondary signal, plus the voice floor.
 *
 * ── WHY --dom IS THE HEADLINE, AND WHAT WENT WRONG WITHOUT IT ───────────────
 *
 * The measurement this tool exists to reproduce was always "what is on screen
 * at once, in the default tab". The first reconstruction of it counted static
 * source instead, and — fatally — counted config prose from the POOL: every
 * one of the eight `SUNDAY_PERSONALITIES` descriptions, every
 * `SUNDAY_UPGRADES` description, the whole `SUNDAY_SPONSORS` blurb catalogue.
 *
 * Screens do not render pools. `SundayPersonalityCard` renders a description
 * only when its card is `selected`; the Clubhouse renders at most one upgrade
 * description at a time and none on first paint. Counting the catalogue scored
 * the Setup screen 1194 -> 1204 (+1%) with its long blocks unchanged at 8 -> 8.
 * The browser says 1380 -> 731 with blocks 8 -> 1. The static number was not
 * slightly off; it had the sign wrong, and it was the single largest input to a
 * conclusion that a copy-reduction target had been missed when it had been met.
 *
 * So: no source-derived figure in this file may stand in for a rendered one.
 * `--static` counts what a FILE CAN SAY, never what a SCREEN DOES SAY, and its
 * output is labelled that way. It deliberately does not look at config records
 * at all any more — a screen's share of a catalogue is not knowable from source.
 *
 * ── WHAT --dom MEASURES ─────────────────────────────────────────────────────
 *
 * One real Chromium at 390x844 against a running dev server, `Math.random`
 * seeded so both revisions roll comparable content. For each screen it reads
 * GameShell's `<main>` (the screen slot — the top bar, tab strip and week bar
 * are chrome the audit counted against their own files; Setup is a route with
 * no shell, so it falls back to the app root) and reports:
 *
 *   chars        `innerText`, whitespace-collapsed
 *   explanatory  characters in LEAF elements of >= EXPLANATORY_MIN chars —
 *                a sentence explaining something, not a label naming it
 *   over80       leaf elements longer than 80 characters
 *
 * The headline is the DEFAULT LANDING STATE of each screen. Tabs, selections
 * and match beats are measured too and reported separately, named by state,
 * because "the Clubhouse" is not one number: its Upgrades tab fell 1508 -> 422
 * while its Sponsors tab did not move.
 *
 * A caveat --dom cannot resolve on its own: at full time the >80 blocks are
 * match COMMENTARY, which is authored voice and is supposed to be long. Read
 * that row with the voice figure from --static, not against a chrome target.
 *
 * ── VOICE ───────────────────────────────────────────────────────────────────
 *
 * `--static` also measures the authored lines a player reads as the club's own
 * voice, and exits non-zero if they fall. Cutting chrome by cutting voice is a
 * different trade from the one a chrome reduction claims, and the DOM cannot
 * tell the two apart. This is the one thing the static pass is genuinely best at.
 *
 * Usage:
 *   # headline — two dev servers, one per revision
 *   node scripts/measure-sunday-chrome.mjs --dom http://127.0.0.1:8086 http://127.0.0.1:8085
 *   # voice floor + source-side signal
 *   npm run sunday:chrome -- --static <before-rev> [after-rev]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

// NOTE: there is deliberately no config-record counting here. See the header.
// A screen renders a slice of a catalogue chosen at runtime, and source cannot
// say which slice; counting the whole pool is how this tool once reported a
// 47% reduction as a 1% increase. Catalogue prose is measured by --dom, where
// it is either on the glass or it is not.

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
    const ui = [...new Set([
      ...literalTStrings(src, en), ...templateStrings(src, en),
      ...mappedStrings(src, en), ...hardcodedStrings(src),
    ])];
    rows[name] = {
      ui: ui.reduce((a, s) => a + s.length, 0),
      uiExplanatory: ui.filter(s => s.length >= EXPLANATORY_MIN).reduce((a, s) => a + s.length, 0),
      uiBig: ui.filter(s => s.length > 80).length,
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

// ── DOM mode: what is on the glass ─────────────────────────────────────────

/** Seeded in the page so both revisions roll comparable clubs and squads. */
const SEED_MATH_RANDOM = () => {
  let s = 0x2f6e2b1 >>> 0;
  Math.random = () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
};

function readGlass() {
  // GameShell's screen slot. Setup is a route with no shell, so fall back.
  const root = document.querySelector('main') ?? document.getElementById('root');
  if (!root) return null;
  const text = (root.innerText || '').replace(/\s+/g, ' ').trim();
  const blocks = [];
  let explanatory = 0;
  for (const el of root.querySelectorAll('*')) {
    // Leaf elements only, so a paragraph counts once and not once per ancestor.
    if (el.childElementCount) continue;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (t.length >= 35) explanatory += t.length;
    if (t.length > 80) blocks.push(t);
  }
  return { chars: text.length, explanatory, over80: blocks.length, blocks };
}

/** Landing states form the headline; everything else is reported beside it. */
const LANDING = new Set([
  'Setup', 'Hub', 'Teamsheet', 'Squad', 'Recruit', 'Table', 'Clubhouse', 'History', 'MatchDay',
]);

/**
 * Playwright's bundled-browser revision and whatever is actually on the box do
 * not always agree (CI images pin one, `npx playwright install` fetches
 * another). Try the default resolution first, then any chromium sitting in the
 * browsers directory, then say which knob to turn instead of printing
 * Playwright's install banner at someone who cannot run the installer.
 */
async function launchChromium(chromium) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  const tries = [process.env.SUNDAY_CHROME_PATH, undefined];
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(dir)) {
      if (!d.startsWith('chromium-')) continue;
      tries.push(path.join(dir, d, 'chrome-linux', 'chrome'));
    }
  } catch { /* no browsers directory; the default resolution is all there is */ }
  let last;
  for (const executablePath of tries) {
    if (executablePath !== undefined && !fs.existsSync(executablePath)) continue;
    try { return await chromium.launch({ args, executablePath }); } catch (e) { last = e; }
  }
  throw new Error(`no usable chromium — set SUNDAY_CHROME_PATH. Last error: ${last?.message ?? 'none'}`);
}

async function walk(baseURL) {
  const { chromium } = await import('playwright');
  const browser = await launchChromium(chromium);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(SEED_MATH_RANDOM);
  const page = await ctx.newPage();
  const out = {};
  const tap = async (rx, to = 6000) => {
    const el = page.getByText(rx).last();
    try { await el.waitFor({ state: 'visible', timeout: to }); await el.click(); await page.waitForTimeout(600); return true; }
    catch { return false; }
  };
  const rec = async (name) => { await page.waitForTimeout(400); out[name] = await page.evaluate(readGlass); };

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const consent = page.getByRole('button', { name: /no thanks/i });
  if (await consent.count()) { await consent.first().click(); await page.waitForTimeout(400); }
  await tap(/new game/i);
  const close = page.locator('[aria-label*="aywall"], [aria-label*="lose"]').first();
  try { await close.waitFor({ state: 'visible', timeout: 6000 }); await close.click(); } catch { /* no paywall */ }
  await page.waitForTimeout(700);
  await tap(/sunday league/i);
  await page.waitForTimeout(900);

  await rec('Setup');
  await tap(/Chaos FC/);           await rec('Setup · another personality selected');
  await tap(/Get Started/i);       await page.waitForTimeout(1200);
  await rec('Hub');
  await tap(/^Team$/);             await rec('Teamsheet');
  await tap(/Pick it for me/i);    await page.waitForTimeout(900);
  await rec('Teamsheet · XI named');
  await tap(/^Squad$/);            await rec('Squad');
  await tap(/Recruit/);            await rec('Recruit');
  await tap(/^League$/);           await rec('Table');
  await tap(/^Fixtures$/);         await rec('Table · Fixtures tab');
  await tap(/^Cup$/);              await rec('Table · Cup tab');
  await tap(/^Clubhouse$/);        await rec('Clubhouse');
  await tap(/^Sponsors$/);         await rec('Clubhouse · Sponsors tab');
  await tap(/The books/i);         await rec('Clubhouse · The books tab');
  await tap(/^History$/);          await rec('History');
  await tap(/^Home$/);
  await tap(/Match Day|Pick the team/i);
  await page.waitForTimeout(700);
  if (await page.getByText(/Match Day/i).count()) await tap(/Match Day/i);
  await page.waitForTimeout(900);
  await rec('MatchDay');
  await tap(/Sunday morning/i);
  await tap(/Play with \d+|Bring in/i, 2500);
  await rec('MatchDay · side locked');
  await tap(/Kick off/i, 4000);
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(700);
    const b = await page.locator('body').innerText();
    if (/Back to the club/i.test(b)) break;
    if (/Half time/i.test(b) && /as you set up/.test(b)) { await tap(/as you set up/, 1500); continue; }
    if (/Skip to the result/i.test(b)) { await tap(/Skip to the result/i, 1200); continue; }
  }
  await rec('MatchDay · full time');
  await browser.close();
  return out;
}

async function domMode(beforeURL, afterURL) {
  const A = await walk(beforeURL), B = await walk(afterURL);
  const pad = (s, n) => String(s).padEnd(n), r = (s, n) => String(s).padStart(n);
  const d = (a, b) => (a ? `${b > a ? '+' : ''}${(100 * (b - a) / a).toFixed(0)}%` : '—');
  const names = Object.keys(A);
  const emit = (title, keys) => {
    console.log(`\n${title}\n`);
    console.log('| state | chars before | chars after | explanatory before | explanatory after | blocks >80 before/after |');
    console.log('|---|---|---|---|---|---|');
    const t = { ca: 0, cb: 0, ea: 0, eb: 0, ba: 0, bb: 0 };
    for (const k of keys) {
      const a = A[k], b = B[k];
      if (!a || !b) { console.log(`| ${k} | — | — | — | — | — |`); continue; }
      t.ca += a.chars; t.cb += b.chars; t.ea += a.explanatory; t.eb += b.explanatory;
      t.ba += a.over80; t.bb += b.over80;
      console.log(`| ${pad(k, 34)} | ${r(a.chars, 5)} | ${r(b.chars, 5)} (${d(a.chars, b.chars)}) | ${r(a.explanatory, 5)} | ${r(b.explanatory, 5)} (${d(a.explanatory, b.explanatory)}) | ${a.over80} / ${b.over80} |`);
    }
    console.log(`| **TOTAL** | **${t.ca}** | **${t.cb}** (${d(t.ca, t.cb)}) | **${t.ea}** | **${t.eb}** (${d(t.ea, t.eb)}) | **${t.ba} / ${t.bb}** |`);
  };
  emit('### Headline — default landing state of every Sunday screen', names.filter(n => LANDING.has(n)));
  emit('### Other states, reported separately', names.filter(n => !LANDING.has(n)));
  console.log('\nAt full time the >80 blocks are match commentary — authored voice, long by design.');
  console.log('Read that row against the voice figure from --static, not against a chrome target.');
}

// ── static mode: what a file CAN say, plus the voice floor ──────────────────

function staticMode(before, after) {
  const files = { ...NAMED };
  for (const f of new Set([...sundayComponentFiles(before), ...sundayComponentFiles(after)])) {
    const n = f.split('/').pop().replace(/\.tsx?$/, '').replace(/^Sunday/, '');
    if (!Object.values(files).includes(f)) files[n] = f;
  }
  const A = measure(before, files), B = measure(after, files);
  let ua = 0, ub = 0, ea = 0, eb = 0, ga = 0, gb = 0;
  for (const n of Object.keys(files)) {
    ua += A[n]?.ui ?? 0; ub += B[n]?.ui ?? 0;
    ea += A[n]?.uiExplanatory ?? 0; eb += B[n]?.uiExplanatory ?? 0;
    ga += A[n]?.uiBig ?? 0; gb += B[n]?.uiBig ?? 0;
  }
  const d = (a, b) => `${b > a ? '+' : ''}${a ? (100 * (b - a) / a).toFixed(1) : '0.0'}%`;
  console.log(`\nStatic UI copy — what these files CAN put on screen, not what any screen DOES show.`);
  console.log(`Not the headline: run --dom for that. See the header of this file.`);
  console.log(`  copy        ${ua} → ${ub}  (${d(ua, ub)})`);
  console.log(`  explanatory ${ea} → ${eb}  (${d(ea, eb)})`);
  console.log(`  strings >80 ${ga} → ${gb}`);

  const va = voice(before), vb = voice(after);
  let ta = 0, tb = 0;
  for (const k of Object.keys(va)) { ta += va[k]; tb += vb[k]; }
  console.log(`\nAuthored voice: ${ta} → ${tb} (${tb - ta >= 0 ? '+' : ''}${tb - ta})`);
  for (const k of Object.keys(va)) if (vb[k] !== va[k]) console.log(`  ${k}: ${va[k]} → ${vb[k]}`);
  if (tb < ta) { console.error('\nVOICE FELL. Chrome cut by cutting voice is not the trade being claimed.'); process.exitCode = 1; }
}

async function main() {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === '--dom') {
    if (!a || !b) { console.error('usage: --dom <beforeURL> <afterURL>  (two running dev servers)'); process.exit(2); }
    await domMode(a, b);
  } else if (mode === '--static') {
    if (!a) { console.error('usage: --static <before-rev> [after-rev]'); process.exit(2); }
    staticMode(a, b ?? 'HEAD');
  } else {
    console.error('usage:\n  --dom    <beforeURL> <afterURL>   the headline: what is on the glass\n  --static <beforeRev> [afterRev]   source-side signal + the voice floor');
    process.exit(2);
  }
}

main();
