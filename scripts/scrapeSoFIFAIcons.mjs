#!/usr/bin/env node
/**
 * SoFIFA Icons Scraper → fc25_icons.csv
 *
 * Fetches every Icon player from sofifa.com and writes a CSV that matches
 * the 58-column schema of fc25_players.csv. Output is intended to feed a
 * future pack-opening system; this script does NOT integrate icons into
 * the live game.
 *
 * Usage:
 *   node scripts/scrapeSoFIFAIcons.mjs              # full scrape
 *   node scripts/scrapeSoFIFAIcons.mjs --limit 10   # first 10 icons only
 *   node scripts/scrapeSoFIFAIcons.mjs --resume     # continue from cache
 *
 * Zero npm dependencies. Requires Node 18+ for native fetch.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_CSV = join(ROOT, 'fc25_icons.csv');
const CACHE_FILE = join(__dirname, '.icons-cache.json');

// ── CLI args ──
const args = process.argv.slice(2);
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();
const RESUME = args.includes('--resume');

// ── HTTP config ──
const BASE = 'https://sofifa.com';
const ICONS_LIST_URL = (offset) => `${BASE}/players?type=all&lg%5B0%5D=2118&offset=${offset}`;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="126", "Not.A/Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const SLEEP_MS = 1000;
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

// ── Attribute label aliases (SoFIFA uses these label strings on detail pages) ──
const ATTR_LABELS = {
  'Acceleration': ['Acceleration'],
  'Sprint Speed': ['Sprint Speed'],
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

// ── HTTP with retry ──
async function get(url, attempt = 1) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (res.status === 403) {
    throw new Error(`403 Forbidden from ${url} — SoFIFA is blocking the request. Try updating User-Agent or running from a different IP.`);
  }
  if ((res.status === 429 || res.status >= 500) && attempt <= 3) {
    const wait = Math.pow(2, attempt) * 1000;
    console.warn(`  ! ${res.status} on ${url} — backoff ${wait}ms (attempt ${attempt}/3)`);
    await sleep(wait);
    return get(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
  return res.text();
}

// ── List-page parser: extract player URL paths ──
function parseListPage(html) {
  // Player anchors look like: href="/player/<id>/<slug>/<version>/"
  const re = /href="(\/player\/(\d+)\/([a-z0-9-]+)\/(\d+)\/)"/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, path, id, slug, version] = m;
    if (!seen.has(id)) seen.set(id, { id, slug, version, path });
  }
  return [...seen.values()];
}

// ── Detail-page parsers ──
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function getName(html) {
  // <h1>Pelé</h1>  or  <title>Pelé FC 25 - rating ... - SoFIFA</title>
  let m = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (m) return stripTags(m[1]);
  m = html.match(/<title>([^|<]+?)\s+(?:FC|FIFA)\s/i);
  return m ? stripTags(m[1]) : '';
}

function getOVR(html) {
  // Looks for <em title="Overall Rating"...>VALUE</em> or similar
  let m = html.match(/<em[^>]*title=["']Overall(?: Rating)?["'][^>]*>(?:<[^>]+>)*?(\d{2,3})/i);
  if (m) return parseInt(m[1], 10);
  // Fallback: first <em> after "Overall"
  m = html.match(/Overall[^<]*<\/?[^>]*>\s*(\d{2,3})/i);
  return m ? parseInt(m[1], 10) : '';
}

function getCategoryRating(html, category) {
  // Categories: PAC/SHO/PAS/DRI/DEF/PHY shown as e.g. <em>97</em>...PAC
  // Robust pattern: look for "<em ...>NUM</em>...<span>CATEGORY</span>" within ~200 chars
  const re = new RegExp(`(\\d{2,3})[^\\d<]{0,40}<[^>]*>\\s*${category}\\b`, 'i');
  const m = html.match(re);
  if (m) return parseInt(m[1], 10);
  // Inverse pattern (category first, value after)
  const re2 = new RegExp(`>${category}<[^<]*<[^>]*>\\s*(\\d{2,3})`, 'i');
  const m2 = html.match(re2);
  return m2 ? parseInt(m2[1], 10) : '';
}

function getAttribute(html, columnName) {
  const aliases = ATTR_LABELS[columnName] || [columnName];
  for (const label of aliases) {
    // Pattern A: <span class="bp3-tag ...">VALUE</span> Label
    const reA = new RegExp(`<span[^>]*class=["'][^"']*?(?:bp3-tag|p p-)[^"']*["'][^>]*>(\\d{1,3})<\\/span>[^<]*${escapeRe(label)}\\b`, 'i');
    let m = html.match(reA);
    if (m) return parseInt(m[1], 10);
    // Pattern B: <em>VALUE</em>Label
    const reB = new RegExp(`<em[^>]*>(\\d{1,3})<\\/em>[^<]*${escapeRe(label)}\\b`, 'i');
    m = html.match(reB);
    if (m) return parseInt(m[1], 10);
    // Pattern C: VALUE followed by label within ~30 chars (loose)
    const reC = new RegExp(`(\\d{1,3})[^\\d<>]{0,30}${escapeRe(label)}\\b`, 'i');
    m = html.match(reC);
    if (m) return parseInt(m[1], 10);
  }
  return '';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getProfileField(html, label) {
  // Profile rows: <label>Foot</label> <span>Right</span> or "Foot Right"
  const re = new RegExp(`${escapeRe(label)}\\s*<\\/label>\\s*<[^>]*>\\s*([^<]+?)\\s*<`, 'i');
  let m = html.match(re);
  if (m) return stripTags(m[1]);
  const re2 = new RegExp(`>${escapeRe(label)}<\\/[^>]+>\\s*<[^>]+>\\s*([^<]+)`, 'i');
  m = html.match(re2);
  return m ? stripTags(m[1]) : '';
}

function getPositions(html) {
  // Primary position: <span class="pos pos25">ST</span> in header
  const all = [...html.matchAll(/<span[^>]*class=["'](?:pos|bp3-tag[^"']*)[^"']*["'][^>]*>([A-Z]{2,3})<\/span>/g)]
    .map((m) => m[1])
    .filter((p) => /^(GK|RWB|LWB|CB|RB|LB|CDM|CM|CAM|RM|LM|RW|LW|CF|ST)$/.test(p));
  // Dedup, preserve order
  const dedup = [...new Set(all)];
  return { primary: dedup[0] || '', alternates: dedup.slice(1) };
}

function getMeta(html) {
  // SoFIFA meta line: "ST  31 y.o.  (Oct 23, 1940)  175cm | 5'9"  77kg | 170lbs"
  const meta = {};
  const m = html.match(/(\d{2,3})\s*cm\s*\|\s*(\d+)['′]?(\d+)?["″]?/);
  if (m) {
    const cm = m[1];
    const ft = m[2];
    const inch = m[3] || '0';
    meta.height = `${cm}cm / ${ft}'${inch}"`;
  }
  const w = html.match(/(\d{2,3})\s*kg\s*\|\s*(\d+)\s*lbs?/);
  if (w) meta.weight = `${w[1]}kg / ${w[2]}lb`;
  const a = html.match(/(\d{1,2})\s*y\.o\./);
  if (a) meta.age = parseInt(a[1], 10);
  return meta;
}

function getNation(html) {
  // Flag image with title or alt = nation name
  let m = html.match(/<a[^>]*href=["']\/players\?na=\d+["'][^>]*>(?:<[^>]+>)*?([A-Za-zÀ-ÿ' .-]+)/);
  if (m) return stripTags(m[1]);
  m = html.match(/<img[^>]*class=["']flag["'][^>]*title=["']([^"']+)["']/);
  return m ? m[1] : '';
}

function getStars(html, label) {
  // "Skill moves 5★" or "Weak Foot 4★" — SoFIFA renders count of stars
  const re = new RegExp(`${escapeRe(label)}[^\\d]{0,30}(\\d)\\s*[★\\*]`, 'i');
  const m = html.match(re);
  return m ? parseInt(m[1], 10) : '';
}

function getFoot(html) {
  let m = html.match(/Preferred\s*Foot[^<]*<[^>]*>\s*(Right|Left)/i);
  if (m) return m[1];
  m = html.match(/>(Right|Left)\s*Foot</i);
  return m ? m[1] : '';
}

function getPlaystyles(html) {
  // PlayStyles section: <a href="/players?ps=...">Name</a>
  const styles = [...html.matchAll(/<a[^>]*href=["']\/players\?ps=\d+["'][^>]*>([^<]+)<\/a>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  // PlayStyles+ are sometimes rendered with a trailing "+"
  return [...new Set(styles)].join(', ');
}

function parsePlayer(html, fullUrl) {
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
  return row;
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

function writeCsv(rows) {
  const header = CSV_COLUMNS.map((c) => csvEscape(c)).join(',');
  const body = rows.map(rowToCsv).join('\n');
  writeFileSync(OUTPUT_CSV, header + '\n' + body + '\n', 'utf8');
}

// ── Cache (resume support) ──
function loadCache() {
  if (!existsSync(CACHE_FILE)) return { ids: [], rows: {} };
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return { ids: [], rows: {} };
  }
}

function saveCache(cache) {
  if (!existsSync(dirname(CACHE_FILE))) mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// ── Main ──
async function main() {
  console.log('SoFIFA Icons Scraper');
  console.log(`  output: ${OUTPUT_CSV}`);
  if (LIMIT !== Infinity) console.log(`  limit:  ${LIMIT}`);
  console.log('');

  const cache = RESUME ? loadCache() : { ids: [], rows: {} };

  // ── Step 1: collect Icon URLs from list pages ──
  if (cache.ids.length === 0) {
    console.log('[1/2] Collecting Icon URLs…');
    const collected = new Map();
    let offset = 0;
    while (true) {
      const url = ICONS_LIST_URL(offset);
      console.log(`  fetch  ${url}`);
      const html = await get(url);
      const found = parseListPage(html);
      const newOnes = found.filter((p) => !collected.has(p.id));
      if (newOnes.length === 0) {
        console.log(`  done — no new icons at offset ${offset}`);
        break;
      }
      for (const p of newOnes) collected.set(p.id, p);
      console.log(`         +${newOnes.length} (total ${collected.size})`);
      offset += 60;
      await sleep(SLEEP_MS);
    }
    cache.ids = [...collected.values()];
    saveCache(cache);
    console.log(`  ✓ ${cache.ids.length} unique icons indexed\n`);
  } else {
    console.log(`[1/2] Resuming with ${cache.ids.length} cached IDs (${Object.keys(cache.rows).length} already scraped)\n`);
  }

  // ── Step 2: fetch detail pages ──
  console.log('[2/2] Scraping detail pages…');
  const targets = cache.ids.slice(0, LIMIT);
  let count = 0;
  for (const p of targets) {
    count++;
    if (cache.rows[p.id]) {
      process.stdout.write(`  [${count}/${targets.length}] ✓ cached  ${p.slug}\n`);
      continue;
    }
    const fullUrl = `${BASE}${p.path}`;
    process.stdout.write(`  [${count}/${targets.length}] fetch  ${p.slug} … `);
    try {
      const html = await get(fullUrl);
      const row = parsePlayer(html, fullUrl);
      if (!row.Name || !row.OVR) {
        console.log(`PARSE FAIL (name=${row.Name} ovr=${row.OVR})`);
      } else {
        console.log(`OK  ${row.Name} (${row.OVR} ${row.Position})`);
      }
      cache.rows[p.id] = row;
      saveCache(cache);
    } catch (err) {
      console.log(`ERROR ${err.message}`);
      cache.rows[p.id] = { error: err.message };
      saveCache(cache);
    }
    await sleep(SLEEP_MS);
  }

  // ── Write CSV ──
  const rows = Object.values(cache.rows).filter((r) => r && !r.error && r.Name && r.OVR);
  rows.sort((a, b) => (b.OVR || 0) - (a.OVR || 0));
  writeCsv(rows);
  console.log(`\n✓ Wrote ${rows.length} icons → fc25_icons.csv`);
  const errors = Object.values(cache.rows).filter((r) => r && r.error).length;
  if (errors) console.log(`  (${errors} errors — see ${CACHE_FILE})`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
