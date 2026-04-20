#!/usr/bin/env node
/**
 * SoFIFA Icons Scraper → fc25_icons.csv (+ fc25_icons_meta.json)
 *
 * Fetches every Icon player from sofifa.com via Playwright headless Chromium
 * (real browser is required — Cloudflare blocks vanilla HTTP from cloud IPs)
 * and writes:
 *   - fc25_icons.csv         58-col schema matching fc25_players.csv
 *   - fc25_icons_meta.json   sidecar: id → { name, ovr, imageUrl, sofifaUrl }
 *                             (intended for the pack-opening card UI)
 *
 * Setup (one-time, local only):
 *   npm run scrape:icons:setup     # downloads Chromium (~150MB)
 *
 * Usage:
 *   npm run scrape:icons                            # full scrape
 *   node scripts/scrapeSoFIFAIcons.mjs --limit 10   # smoke test
 *   node scripts/scrapeSoFIFAIcons.mjs --resume     # continue from cache
 *   node scripts/scrapeSoFIFAIcons.mjs --retry-failed
 *   node scripts/scrapeSoFIFAIcons.mjs --output my.csv
 *   node scripts/scrapeSoFIFAIcons.mjs --debug      # dump first parse-fail HTML
 *   node scripts/scrapeSoFIFAIcons.mjs --help
 *
 * Sandbox note: the Claude Code sandbox blocks sofifa.com outbound
 * (x-deny-reason: host_not_allowed). Use the GitHub Actions workflow or
 * run on a normal machine.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_OUTPUT_CSV = join(ROOT, 'fc25_icons.csv');
const META_JSON = join(ROOT, 'fc25_icons_meta.json');
const CACHE_FILE = join(__dirname, '.icons-cache.json');
const DEBUG_HTML = join(__dirname, '.icons-debug.html');

// ── CLI args ──
const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

if (flag('--help') || flag('-h')) {
  console.log(`SoFIFA Icons Scraper

Usage: node scripts/scrapeSoFIFAIcons.mjs [options]

Options:
  --limit N         Scrape only the first N icons (smoke testing)
  --resume          Continue from scripts/.icons-cache.json
  --retry-failed    Re-attempt only icons that previously errored
  --output PATH     Write CSV to PATH instead of fc25_icons.csv
  --debug           On first parse failure, save raw HTML to .icons-debug.html
  --delay MS        Override per-request delay (default 1000ms)
  -h, --help        Show this message

Outputs:
  fc25_icons.csv          58-column schema matching fc25_players.csv
  fc25_icons_meta.json    Image URLs + stable IDs for the pack-opening UI`);
  process.exit(0);
}

const LIMIT = arg('--limit') ? parseInt(arg('--limit'), 10) : Infinity;
const RESUME = flag('--resume') || flag('--retry-failed');
const RETRY_FAILED = flag('--retry-failed');
const DEBUG = flag('--debug');
const DELAY_MS = arg('--delay') ? parseInt(arg('--delay'), 10) : 1000;
const OUTPUT_CSV = (() => {
  const p = arg('--output');
  if (!p) return DEFAULT_OUTPUT_CSV;
  return isAbsolute(p) ? p : join(process.cwd(), p);
})();

// ── HTTP config ──
const BASE = 'https://sofifa.com';
// Force English locale via ?hl=en-US — SoFIFA picks a language based on the
// client IP otherwise, and non-English pages break every label-based parser.
const LANG_PARAM = 'hl=en-US';
const withLang = (url) => url + (url.includes('?') ? '&' : '?') + LANG_PARAM;
const ICONS_LIST_URL = (offset) => withLang(`${BASE}/players?type=all&lg%5B0%5D=2118&offset=${offset}`);
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Extra non-Icon players to bundle into the same output (active players that
// aren't on the Icons list but should appear alongside them in the pack pool).
// SoFIFA redirects /player/<id>/ to the canonical slug+version URL so we don't
// need to know the current version number.
const EXTRA_PLAYERS = [
  { id: '158023', slug: 'lionel-messi',      version: '', path: '/player/158023/' },
  { id: '20801',  slug: 'cristiano-ronaldo', version: '', path: '/player/20801/' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CSV header (must match fc25_players.csv exactly) ──
const CSV_COLUMNS = [
  '', 'Unnamed: 0', 'Rank', 'Name', 'OVR', 'PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY',
  'Acceleration', 'Sprint Speed', 'Positioning', 'Finishing', 'Shot Power', 'Long Shots',
  'Volleys', 'Penalties', 'Vision', 'Crossing', 'Free Kick Accuracy', 'Short Passing',
  'Long Passing', 'Curve', 'Dribbling', 'Agility', 'Balance', 'Reactions', 'Ball Control',
  'Composure', 'Interceptions', 'Heading Accuracy', 'Def Awareness', 'Standing Tackle',
  'Sliding Tackle', 'Jumping', 'Stamina', 'Strength', 'Aggression', 'Position', 'Weak foot',
  'Skill moves', 'Preferred foot', 'Height', 'Weight', 'Alternative positions', 'Age',
  'Nation', 'League', 'Team', 'play style', 'url', 'GK Diving', 'GK Handling', 'GK Kicking',
  'GK Positioning', 'GK Reflexes',
];

// ── Attribute label aliases (SoFIFA detail-page text) ──
const ATTR_LABELS = {
  'Acceleration': ['Acceleration'],
  'Sprint Speed': ['Sprint Speed'],
  // "Positioning" must NOT match "GK Positioning" — handled below in getAttribute.
  'Positioning': ['Att. Position', 'Attacking Position', 'Positioning'],
  'Finishing': ['Finishing'],
  'Shot Power': ['Shot Power'],
  'Long Shots': ['Long Shots'],
  'Volleys': ['Volleys'],
  'Penalties': ['Penalties'],
  'Vision': ['Vision'],
  'Crossing': ['Crossing'],
  'Free Kick Accuracy': ['Free Kick Accuracy', 'FK Acc.'],
  'Short Passing': ['Short Passing'],
  'Long Passing': ['Long Passing'],
  'Curve': ['Curve'],
  'Dribbling': ['Dribbling'],
  'Agility': ['Agility'],
  'Balance': ['Balance'],
  'Reactions': ['Reactions'],
  'Ball Control': ['Ball Control'],
  'Composure': ['Composure'],
  'Interceptions': ['Interceptions'],
  'Heading Accuracy': ['Heading Accuracy'],
  'Def Awareness': ['Defensive Awareness', 'Def Awareness', 'Marking'],
  'Standing Tackle': ['Standing Tackle'],
  'Sliding Tackle': ['Sliding Tackle'],
  'Jumping': ['Jumping'],
  'Stamina': ['Stamina'],
  'Strength': ['Strength'],
  'Aggression': ['Aggression'],
  'GK Diving': ['GK Diving', 'Diving'],
  'GK Handling': ['GK Handling', 'Handling'],
  'GK Kicking': ['GK Kicking', 'Kicking'],
  'GK Positioning': ['GK Positioning'],
  'GK Reflexes': ['GK Reflexes', 'Reflexes'],
};

// ── Playwright fetch with retry + Cloudflare-challenge detection ──
// `page` is set once at the start of main(). Sequential requests reuse it.
let page = null;

const CF_CHALLENGE_RE = /Just a moment|cf-browser-verification|cf-challenge-running|__cf_chl_/i;

async function get(url, options = {}) {
  const { waitFor, attempt = 1 } = options;
  if (!page) throw new Error('Playwright page not initialized — call setupBrowser() first.');

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response?.status() ?? 0;

    if (status === 403) {
      const headers = response.headers();
      const reason = headers['x-deny-reason'] || headers['cf-mitigated'] || 'unknown';
      throw new Error(
        `403 Forbidden from ${url} (reason: ${reason}). ` +
        (reason === 'host_not_allowed'
          ? 'Sandbox blocks sofifa.com — run this on a normal machine or via the GitHub Actions workflow.'
          : 'SoFIFA / Cloudflare is blocking even Playwright. May need stealth plugin or a residential proxy.')
      );
    }
    if ((status === 429 || status >= 500) && attempt <= 3) {
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`  ! ${status} on ${url} — backoff ${wait}ms (attempt ${attempt}/3)`);
      await sleep(wait);
      return get(url, { ...options, attempt: attempt + 1 });
    }
    if (status >= 400) throw new Error(`HTTP ${status} from ${url}`);

    let html = await page.content();

    // Cloudflare interstitial — wait for the JS challenge to auto-resolve.
    if (CF_CHALLENGE_RE.test(html)) {
      console.warn(`  ! Cloudflare check detected on ${url} — waiting 8s for auto-resolve…`);
      await page.waitForTimeout(8000);
      html = await page.content();
      if (CF_CHALLENGE_RE.test(html)) {
        if (attempt <= 2) {
          const wait = Math.pow(2, attempt) * 4000;
          console.warn(`  ! Cloudflare still active — extra ${wait}ms backoff (attempt ${attempt}/2)`);
          await sleep(wait);
          return get(url, { ...options, attempt: attempt + 1 });
        }
        throw new Error(`Cloudflare challenge did not auto-resolve at ${url}. Need stealth plugin or residential proxy.`);
      }
    }

    // Wait for a caller-specified selector to appear before snapshotting HTML.
    // SoFIFA's /players listing is client-rendered — the initial HTML has an
    // empty <tbody> and the JS populates rows after first paint.
    if (waitFor) {
      try {
        await page.waitForSelector(waitFor, { timeout: 15000, state: 'attached' });
        html = await page.content();
      } catch {
        console.warn(`  ! waitFor("${waitFor}") timed out on ${url} — continuing with current DOM`);
      }
    }

    return html;
  } catch (err) {
    // Playwright surfaces navigation timeouts as "Timeout 30000ms exceeded"
    const isTimeout = /Timeout\s*\d+ms\s*exceeded|net::ERR_/.test(err.message);
    if (isTimeout && attempt <= 3) {
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`  ! navigation error on ${url}: ${err.message.split('\n')[0]} — backoff ${wait}ms (attempt ${attempt}/3)`);
      await sleep(wait);
      return get(url, { ...options, attempt: attempt + 1 });
    }
    throw err;
  }
}

// ── Browser lifecycle ──
async function setupBrowser() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
  } catch (err) {
    if (/Executable doesn't exist|browserType\.launch/i.test(err.message)) {
      console.error('\nChromium is not installed.\n  Run: npm run scrape:icons:setup\n  (or: npx playwright install chromium)\n');
      process.exit(1);
    }
    throw err;
  }
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENT,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  // Block heavy resources we don't need — only HTML matters.
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'stylesheet' || type === 'media') {
      return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.setDefaultNavigationTimeout(30000);
  return browser;
}

// ── List-page parser ──
function parseListPage(html) {
  const re = /href="(\/player\/(\d+)\/([a-z0-9-]+)\/(\d+)\/)"/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, path, id, slug, version] = m;
    if (!seen.has(id)) seen.set(id, { id, slug, version, path });
  }
  return [...seen.values()];
}

// ── HTML helpers ──
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Detail-page parsers ──
function getName(html) {
  // Prefer the OG title meta tag — it's specifically the player name on
  // SoFIFA detail pages and isn't affected by banner/nav <h1> drift.
  let m = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (m) return stripTags(m[1].split(/[|–-]/)[0]); // strip trailing " | SoFIFA" etc.
  // Fallback: page <title>, taking the part before the first separator.
  m = html.match(/<title>([^|<]+?)\s+(?:FC|FIFA)\s/i);
  if (m) return stripTags(m[1]);
  // Last-resort fallback: first <h1>.
  m = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  return m ? stripTags(m[1]) : '';
}

function getOVR(html) {
  // Legacy pattern: <em title="Overall"> wrapping the number (pre-2026).
  let m = html.match(/<em[^>]*title=["']Overall(?: Rating)?["'][^>]*>(?:<[^>]+>)*?(\d{2,3})/i);
  if (m) return parseInt(m[1], 10);
  // Current pattern: <em title="NN">NN</em> under the "Best overall" label.
  m = html.match(/Best overall[\s\S]{0,40}?<em[^>]*title=["'](\d{2,3})["']/i);
  if (m) return parseInt(m[1], 10);
  // Meta description fallback: "...overall rating is NN." — language-independent
  // when hl=en-US is honored, still matches the English meta on localized pages.
  m = html.match(/overall rating is (\d{2,3})/i);
  if (m) return parseInt(m[1], 10);
  // Last-resort: legacy whitespace-separated "Overall NN".
  m = html.match(/Overall[^<]*<\/?[^>]*>\s*(\d{2,3})/i);
  return m ? parseInt(m[1], 10) : '';
}

function getCategoryRating(html, category) {
  const re = new RegExp(`(\\d{2,3})[^\\d<]{0,40}<[^>]*>\\s*${category}\\b`, 'i');
  const m = html.match(re);
  if (m) return parseInt(m[1], 10);
  const re2 = new RegExp(`>${category}<[^<]*<[^>]*>\\s*(\\d{2,3})`, 'i');
  const m2 = html.match(re2);
  return m2 ? parseInt(m2[1], 10) : '';
}

// Pre-compile attribute regexes once at module load (~30 patterns × 3 each)
// instead of compiling them per-player (~13k regexes for a 150-icon scrape).
const ATTR_PATTERNS = (() => {
  const map = new Map();
  for (const [columnName, aliases] of Object.entries(ATTR_LABELS)) {
    const patterns = [];
    for (const label of aliases) {
      // Outfield "Positioning" must not match "GK Positioning".
      const labelRe = label === 'Positioning' ? `(?<!GK\\s)${escapeRe(label)}` : escapeRe(label);
      patterns.push(
        // Pattern A: <span class="bp3-tag …">VAL</span> Label
        new RegExp(`<span[^>]*class=["'][^"']*?(?:bp3-tag|p p-)[^"']*["'][^>]*>(\\d{1,3})</span>[^<]*${labelRe}\\b`, 'i'),
        // Pattern B: <em>VAL</em>Label
        new RegExp(`<em[^>]*>(\\d{1,3})</em>[^<]*${labelRe}\\b`, 'i'),
        // Pattern C: VAL within ~30 chars before Label (loose, no tag boundaries crossed)
        new RegExp(`(\\d{1,3})[^\\d<>]{0,30}${labelRe}\\b`, 'i'),
      );
    }
    map.set(columnName, patterns);
  }
  return map;
})();

function getAttribute(html, columnName) {
  const patterns = ATTR_PATTERNS.get(columnName);
  if (!patterns) return '';
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return '';
}

function getPositions(html) {
  // Tighten to position-class spans only; bp3-tag was over-greedy.
  const all = [...html.matchAll(/<span[^>]*class=["'][^"']*\bpos\s+pos\d+[^"']*["'][^>]*>([A-Z]{2,3})<\/span>/g)]
    .map((m) => m[1])
    .filter((p) => /^(GK|RWB|LWB|CB|RB|LB|CDM|CM|CAM|RM|LM|RW|LW|CF|ST)$/.test(p));
  const dedup = [...new Set(all)];
  return { primary: dedup[0] || '', alternates: dedup.slice(1) };
}

function getMeta(html) {
  const meta = {};
  const m = html.match(/(\d{2,3})\s*cm\s*\|\s*(\d+)['′]?(\d+)?["″]?/);
  if (m) {
    meta.height = `${m[1]}cm / ${m[2]}'${m[3] || '0'}"`;
  }
  const w = html.match(/(\d{2,3})\s*kg\s*\|\s*(\d+)\s*lbs?/);
  if (w) meta.weight = `${w[1]}kg / ${w[2]}lb`;
  const a = html.match(/(\d{1,2})\s*y\.o\./);
  if (a) meta.age = parseInt(a[1], 10);
  // Birth year (first 4-digit year in parens after a date)
  const by = html.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+(\d{4})\b/);
  if (by) meta.birthYear = parseInt(by[1], 10);
  return meta;
}

function getNation(html) {
  let m = html.match(/<a[^>]*href=["']\/players\?na=\d+["'][^>]*>(?:<[^>]+>)*?([A-Za-zÀ-ÿ' .-]+)/);
  if (m) return stripTags(m[1]);
  m = html.match(/<img[^>]*class=["']flag["'][^>]*title=["']([^"']+)["']/);
  return m ? m[1] : '';
}

function getStars(html, label) {
  // SoFIFA renders "5★ Skill Moves" — value FIRST, then star, then label.
  // Try value-before-label first (the actual SoFIFA layout), then label-before-value as fallback.
  const labelRe = escapeRe(label);
  // Pattern A (canonical): "5 ★ … Label" within ~30 chars
  const reA = new RegExp(`(\\d)\\s*[★\\*][^<]{0,30}${labelRe}\\b`, 'i');
  let m = html.match(reA);
  if (m) return parseInt(m[1], 10);
  // Pattern B: "<span ...>5</span>★ … Label"
  const reB = new RegExp(`>(\\d)<[^<]*[★\\*][^<]{0,30}${labelRe}\\b`, 'i');
  m = html.match(reB);
  if (m) return parseInt(m[1], 10);
  // Pattern C (fallback): "Label … 5★"
  const reC = new RegExp(`${labelRe}[^\\d]{0,30}(\\d)\\s*[★\\*]`, 'i');
  m = html.match(reC);
  return m ? parseInt(m[1], 10) : '';
}

function getFoot(html) {
  let m = html.match(/Preferred\s*Foot[^<]*<[^>]*>\s*(Right|Left)/i);
  if (m) return m[1];
  m = html.match(/>(Right|Left)\s*Foot</i);
  return m ? m[1] : '';
}

function getPlaystyles(html) {
  const styles = [...html.matchAll(/<a[^>]*href=["']\/players\?ps=\d+["'][^>]*>([^<]+)<\/a>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  return [...new Set(styles)].join(', ');
}

function getImageUrl(html) {
  // Player face images on SoFIFA: cdn.sofifa.net/players/<id>/<version>/<size>.png
  const m = html.match(/https?:\/\/cdn\.sofifa\.(?:net|com)\/players\/[^"'<\s]+/);
  return m ? m[0] : '';
}

function parsePlayer(html, id, fullUrl) {
  const positions = getPositions(html);
  const meta = getMeta(html);
  const isGK = positions.primary === 'GK';

  const row = {
    '': '',
    'Unnamed: 0': '',
    'Rank': '',
    'Name': getName(html),
    'OVR': getOVR(html),
    'PAC': isGK ? '' : getCategoryRating(html, 'PAC'),
    'SHO': isGK ? '' : getCategoryRating(html, 'SHO'),
    'PAS': isGK ? '' : getCategoryRating(html, 'PAS'),
    'DRI': isGK ? '' : getCategoryRating(html, 'DRI'),
    'DEF': isGK ? '' : getCategoryRating(html, 'DEF'),
    'PHY': isGK ? '' : getCategoryRating(html, 'PHY'),
    'Acceleration': isGK ? '' : getAttribute(html, 'Acceleration'),
    'Sprint Speed': isGK ? '' : getAttribute(html, 'Sprint Speed'),
    'Positioning': isGK ? '' : getAttribute(html, 'Positioning'),
    'Finishing': isGK ? '' : getAttribute(html, 'Finishing'),
    'Shot Power': isGK ? '' : getAttribute(html, 'Shot Power'),
    'Long Shots': isGK ? '' : getAttribute(html, 'Long Shots'),
    'Volleys': isGK ? '' : getAttribute(html, 'Volleys'),
    'Penalties': isGK ? '' : getAttribute(html, 'Penalties'),
    'Vision': getAttribute(html, 'Vision'),
    'Crossing': isGK ? '' : getAttribute(html, 'Crossing'),
    'Free Kick Accuracy': isGK ? '' : getAttribute(html, 'Free Kick Accuracy'),
    'Short Passing': isGK ? '' : getAttribute(html, 'Short Passing'),
    'Long Passing': isGK ? '' : getAttribute(html, 'Long Passing'),
    'Curve': isGK ? '' : getAttribute(html, 'Curve'),
    'Dribbling': isGK ? '' : getAttribute(html, 'Dribbling'),
    'Agility': isGK ? '' : getAttribute(html, 'Agility'),
    'Balance': isGK ? '' : getAttribute(html, 'Balance'),
    'Reactions': getAttribute(html, 'Reactions'),
    'Ball Control': isGK ? '' : getAttribute(html, 'Ball Control'),
    'Composure': getAttribute(html, 'Composure'),
    'Interceptions': isGK ? '' : getAttribute(html, 'Interceptions'),
    'Heading Accuracy': isGK ? '' : getAttribute(html, 'Heading Accuracy'),
    'Def Awareness': isGK ? '' : getAttribute(html, 'Def Awareness'),
    'Standing Tackle': isGK ? '' : getAttribute(html, 'Standing Tackle'),
    'Sliding Tackle': isGK ? '' : getAttribute(html, 'Sliding Tackle'),
    'Jumping': getAttribute(html, 'Jumping'),
    'Stamina': getAttribute(html, 'Stamina'),
    'Strength': getAttribute(html, 'Strength'),
    'Aggression': getAttribute(html, 'Aggression'),
    'Position': positions.primary,
    'Weak foot': getStars(html, 'Weak Foot'),
    'Skill moves': getStars(html, 'Skill Moves'),
    'Preferred foot': getFoot(html),
    'Height': meta.height || '',
    'Weight': meta.weight || '',
    'Alternative positions': positions.alternates.join(', '),
    'Age': meta.age || '',
    'Nation': getNation(html),
    'League': 'Icons',
    'Team': 'Icons',
    'play style': getPlaystyles(html),
    'url': fullUrl,
    'GK Diving': isGK ? getAttribute(html, 'GK Diving') : '',
    'GK Handling': isGK ? getAttribute(html, 'GK Handling') : '',
    'GK Kicking': isGK ? getAttribute(html, 'GK Kicking') : '',
    'GK Positioning': isGK ? getAttribute(html, 'GK Positioning') : '',
    'GK Reflexes': isGK ? getAttribute(html, 'GK Reflexes') : '',
  };

  const meta_ = {
    id,
    name: row.Name,
    ovr: row.OVR,
    position: row.Position,
    nation: row.Nation,
    birthYear: meta.birthYear || null,
    imageUrl: getImageUrl(html),
    sofifaUrl: fullUrl,
  };

  return { row, meta: meta_ };
}

// ── CSV writer ──
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s === '') return '';
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(row) {
  return CSV_COLUMNS.map((c) => csvEscape(row[c])).join(',');
}

function writeCsv(rows, path) {
  const header = CSV_COLUMNS.map((c) => csvEscape(c)).join(',');
  const body = rows.map(rowToCsv).join('\n');
  atomicWrite(path, header + '\n' + body + '\n');
}

// ── Atomic writes (Ctrl+C-safe) ──
function atomicWrite(path, content) {
  const tmp = `${path}.tmp`;
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

// ── Cache ──
function loadCache() {
  if (!existsSync(CACHE_FILE)) return { ids: [], rows: {}, meta: {} };
  try {
    const c = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    if (!c.meta) c.meta = {};
    return c;
  } catch {
    return { ids: [], rows: {}, meta: {} };
  }
}

function saveCache(cache) {
  atomicWrite(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ── ETA ──
function eta(startMs, done, total) {
  if (done === 0) return '?';
  const elapsed = Date.now() - startMs;
  const remaining = (elapsed / done) * (total - done);
  const sec = Math.round(remaining / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m${sec % 60}s`;
}

// ── Main ──
async function main() {
  console.log('SoFIFA Icons Scraper (Playwright Chromium)');
  console.log(`  output: ${OUTPUT_CSV}`);
  console.log(`  meta:   ${META_JSON}`);
  if (LIMIT !== Infinity) console.log(`  limit:  ${LIMIT}`);
  if (RETRY_FAILED) console.log(`  mode:   retry-failed`);
  else if (RESUME) console.log(`  mode:   resume`);
  console.log('');

  console.log('Launching headless Chromium…');
  const browser = await setupBrowser();
  console.log('  ✓ browser ready\n');

  try {
    return await runScrape();
  } finally {
    await browser.close();
  }
}

async function runScrape() {
  const cache = RESUME ? loadCache() : { ids: [], rows: {}, meta: {} };
  if (RETRY_FAILED) {
    let cleared = 0;
    for (const id of Object.keys(cache.rows)) {
      if (cache.rows[id]?.error) { delete cache.rows[id]; cleared++; }
    }
    console.log(`  cleared ${cleared} failed rows from cache\n`);
  }

  // ── Step 1: collect Icon URLs ──
  if (cache.ids.length === 0) {
    console.log('[1/2] Collecting Icon URLs…');
    const collected = new Map();
    let offset = 0;
    while (true) {
      const url = ICONS_LIST_URL(offset);
      console.log(`  fetch  offset=${offset}`);
      // Listing page is client-rendered — wait for at least one row in the
      // player table before snapshotting, else we'd see an empty tbody.
      const html = await get(url, { waitFor: 'tbody tr' });
      const found = parseListPage(html);
      const newOnes = found.filter((p) => !collected.has(p.id));
      if (newOnes.length === 0) {
        console.log(`  done — no new icons at offset ${offset}`);
        // If we never found any icons at all, dump the list HTML so the
        // operator can inspect whether it's a Cloudflare wall, an empty
        // league filter, or a markup change.
        if (collected.size === 0 && offset === 0) {
          const LIST_DEBUG = join(__dirname, '.icons-list-debug.html');
          atomicWrite(LIST_DEBUG, html);
          console.warn(`  ⚠  listing page produced 0 player hrefs — dumped HTML → ${LIST_DEBUG}`);
        }
        break;
      }
      for (const p of newOnes) collected.set(p.id, p);
      console.log(`         +${newOnes.length} (total ${collected.size})`);
      offset += 60;
      await sleep(DELAY_MS);
    }
    cache.ids = [...collected.values()];
    saveCache(cache);
    if (cache.ids.length < 30) {
      console.warn(`  ⚠  only ${cache.ids.length} icons indexed — SoFIFA's Icons league ID may have changed (currently lg=2118 in script).`);
    }
    console.log(`  ✓ ${cache.ids.length} unique icons indexed\n`);
  } else {
    console.log(`[1/2] Resuming with ${cache.ids.length} cached IDs (${Object.keys(cache.rows).length} already scraped)\n`);
  }

  // Append EXTRA_PLAYERS (non-Icon active players) to the same cache, dedup'd
  // by SoFIFA id. Runs on both fresh and resumed scrapes so adding new entries
  // to EXTRA_PLAYERS later picks them up via --resume.
  {
    const haveIds = new Set(cache.ids.map((p) => p.id));
    let added = 0;
    for (const p of EXTRA_PLAYERS) {
      if (!haveIds.has(p.id)) {
        cache.ids.push(p);
        console.log(`  +extra ${p.slug}`);
        added++;
      }
    }
    if (added > 0) saveCache(cache);
  }

  // ── Step 2: detail pages ──
  console.log('[2/2] Scraping detail pages…');
  const targets = cache.ids.slice(0, LIMIT);
  const startMs = Date.now();
  let count = 0;
  let debugDumped = false;

  for (const p of targets) {
    count++;
    if (cache.rows[p.id] && !cache.rows[p.id].error) {
      process.stdout.write(`  [${count}/${targets.length}] ✓ cached  ${p.slug}\n`);
      continue;
    }
    const fullUrl = withLang(`${BASE}${p.path}`);
    process.stdout.write(`  [${count}/${targets.length}] (${eta(startMs, count - 1, targets.length)} ETA) fetch  ${p.slug} … `);
    try {
      const html = await get(fullUrl);
      const { row, meta } = parsePlayer(html, p.id, fullUrl);
      if (!row.Name || !row.OVR) {
        console.log(`PARSE FAIL (name=${row.Name || '∅'} ovr=${row.OVR || '∅'})`);
        if (DEBUG && !debugDumped) {
          atomicWrite(DEBUG_HTML, html);
          console.log(`         debug HTML → ${DEBUG_HTML}`);
          debugDumped = true;
        }
      } else {
        console.log(`OK  ${row.Name} (${row.OVR} ${row.Position})`);
      }
      cache.rows[p.id] = row;
      cache.meta[p.id] = meta;
      saveCache(cache);
    } catch (err) {
      console.log(`ERROR ${err.message}`);
      cache.rows[p.id] = { error: err.message };
      saveCache(cache);
    }
    await sleep(DELAY_MS);
  }

  // ── Write outputs ──
  const valid = Object.entries(cache.rows)
    .filter(([, r]) => r && !r.error && r.Name && r.OVR)
    .sort(([, a], [, b]) => (b.OVR || 0) - (a.OVR || 0));

  // Populate sequential Rank by OVR-descending order (matches fc25_players.csv convention).
  valid.forEach(([, r], i) => { r['Rank'] = i + 1; r['Unnamed: 0'] = i; });

  writeCsv(valid.map(([, r]) => r), OUTPUT_CSV);

  const metaOut = {};
  for (const [id] of valid) {
    if (cache.meta[id]) metaOut[id] = cache.meta[id];
  }
  atomicWrite(META_JSON, JSON.stringify(metaOut, null, 2));

  console.log(`\n✓ Wrote ${valid.length} icons → ${OUTPUT_CSV}`);
  console.log(`✓ Wrote ${Object.keys(metaOut).length} meta entries → ${META_JSON}`);
  const errors = Object.values(cache.rows).filter((r) => r && r.error).length;
  if (errors) console.log(`  (${errors} errors — re-run with --retry-failed to retry)`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
