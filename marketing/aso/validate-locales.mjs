// Validate marketing/aso/locales/*.md against Apple's field limits.
// Fields are the backticked single-line values under each "## <Field> [n/limit]" heading.
//
//   node marketing/aso/validate-locales.mjs               # validate
//   node marketing/aso/validate-locales.mjs --fix-counts  # restamp [n/limit] from the real values
//
// Beyond Apple's hard limits this also guards two things that have bitten us:
//   * Seasonal rot — a campaign window closes and its token keeps sitting in
//     the highest-weighted fields we own. See EXPIRED_CAMPAIGNS.
//   * Screenshot captions — Apple OCR-indexes screenshot text as metadata
//     (since June 2025), so the captions are a ranked field and are validated
//     like one, not treated as art direction.
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = new URL('./locales', import.meta.url).pathname;
const LIMITS = { 'App Name': 30, 'Subtitle': 30, 'Promotional Text': 170, 'Keywords': 100 };
const FIX = process.argv.includes('--fix-counts');

// Campaign tokens that have passed their window. Any locale still carrying one
// in an indexed field is burning that field. `until` is the last day the token
// was worth holding; add the next tournament here when its window opens.
const EXPIRED_CAMPAIGNS = [
  {
    campaign: 'World Cup 2026 (final was 2026-07-19)',
    until: '2026-07-19',
    // Matches the seasonal token in every locale we ship, not the evergreen
    // in-game mode name used in Description/Captions prose.
    pattern:
      /(world cup|mundial|copa do mundo|coupe du monde|coppa del mondo|weltmeisterschaft|wm)\s*2026|2026\s*(dünya kupası|piala dunia)|dünya kupası\s*2026|piala dunia\s*2026/i,
    // Indexed/consumer-visible fields only — the Description and rationale may
    // legitimately mention the in-game World Cup mode.
    fields: ['App Name', 'Subtitle', 'Promotional Text', 'Keywords'],
  },
];

// Registered tournament marks. APP_STORE_LISTING.md risk #4 rules these out of
// *listing* copy (the in-game mode names are a separate, tracked IP item), so
// every consumer-visible store field must use a generic descriptor instead.
const TRADEMARKS_ANY =
  /\b(world cup|copa am[eé]rica|afcon|gold cup|euros?\s*20\d\d|european championship|copa do mundo|coupe du monde|coppa del mondo|weltmeisterschaft|dünya kupası|piala dunia|world championship)\b/i;
// "Mundial"/"Mondiale" are ordinary adjectives in ES/PT/IT ("torneo mundial")
// and only a mark when used as a capitalised proper noun, so these are matched
// case-sensitively to avoid flagging the generic replacements themselves.
const TRADEMARKS_PROPER = /\b(Mundial|Mondiale)\b/;
const trademarkHit = (s) => (s.match(TRADEMARKS_ANY) || s.match(TRADEMARKS_PROPER) || [null])[0];

const today = new Date('2026-07-28'); // stamped: bump when re-running a seasonal audit

let failures = 0;
const rows = [];
const stale = [];
const trademarks = [];

for (const f of readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()) {
  const path = join(DIR, f);
  let text = readFileSync(path, 'utf8');
  const locale = f.replace('.md', '');
  const row = { locale };

  for (const [field, limit] of Object.entries(LIMITS)) {
    // Match "## App Name [n/30]" then the next backticked line.
    const re = new RegExp(`##\\s*${field}[^\\n]*\\n+\\s*\`([^\`]+)\``, 'i');
    const m = text.match(re);
    if (!m) { console.error(`FAIL ${locale}: missing field "${field}"`); failures++; continue; }
    const value = m[1].trim();
    const len = [...value].length; // code points — matches Apple's counting closely
    row[field] = `${len}/${limit}`;

    if (FIX) {
      text = text.replace(
        new RegExp(`(##\\s*${field})[^\\n]*`, 'i'),
        `$1 [${len}/${limit}]`,
      );
    }

    if (len > limit) { console.error(`FAIL ${locale}: ${field} is ${len} > ${limit}: "${value}"`); failures++; }
    if (field === 'App Name' && !value.startsWith('Dynasty Manager')) {
      console.error(`FAIL ${locale}: App Name must start with brand: "${value}"`); failures++;
    }
    if (field === 'Keywords') {
      if (/,\s/.test(value)) { console.error(`FAIL ${locale}: keywords contain space after comma`); failures++; }
      const kws = value.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
      const dupes = kws.filter((k, i) => kws.indexOf(k) !== i);
      if (dupes.length) { console.error(`FAIL ${locale}: duplicate keywords: ${[...new Set(dupes)].join(', ')}`); failures++; }
      if (len < 70) console.warn(`WARN ${locale}: keywords only ${len}/100 — leaving search coverage on the table`);
      // Apple indexes App Name + Subtitle + Keywords as one set, so any word
      // repeated from the first two is a wasted character here.
      const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const owned = new Set(
        [row._name, row._subtitle].filter(Boolean).flatMap((v) => norm(v).split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length > 2),
      );
      const repeats = [...new Set(kws.flatMap((k) => norm(k).split(/\s+/)).filter((w) => owned.has(w)))];
      if (repeats.length) {
        console.error(`FAIL ${locale}: keywords repeat App Name/Subtitle words: ${repeats.join(', ')}`); failures++;
      }
    }
    if (field === 'App Name') row._name = value;
    if (field === 'Subtitle') row._subtitle = value;

    // Seasonal rot: an expired campaign token sitting in an indexed field.
    for (const c of EXPIRED_CAMPAIGNS) {
      if (new Date(c.until) >= today) continue;
      if (!c.fields.includes(field)) continue;
      if (c.pattern.test(value)) {
        stale.push({ locale, field, campaign: c.campaign, value });
      }
    }
  }

  // Description present and under 4000
  const desc = text.match(/##\s*Description[^\n]*\n([\s\S]*?)(?=\n## )/i);
  if (!desc) { console.error(`FAIL ${locale}: missing Description`); failures++; }
  else {
    const dlen = [...desc[1].trim()].length;
    row.Description = `${dlen}/4000`;
    if (dlen > 4000) { console.error(`FAIL ${locale}: Description ${dlen} > 4000`); failures++; }
    if (dlen < 400) console.warn(`WARN ${locale}: Description only ${dlen} chars — thin`);
    if (FIX) {
      text = text.replace(/(##\s*Description)[^\n]*/i, `$1 [${dlen}/4000]`);
    }
  }

  // Screenshot captions are an indexed field since June 2025 — require five.
  const caps = text.match(/##\s*Screenshot Captions[^\n]*\n([\s\S]*?)(?=\n## |$)/i);
  if (!caps) { console.error(`FAIL ${locale}: missing Screenshot Captions`); failures++; }
  else {
    const lines = caps[1].split('\n').map((l) => l.match(/^\s*\d+\.\s*(.+?)\s*$/)).filter(Boolean);
    row.Captions = `${lines.length}/5`;
    if (lines.length !== 5) {
      console.error(`FAIL ${locale}: expected 5 screenshot captions, got ${lines.length}`); failures++;
    }
  }

  // Trademarked tournament names anywhere in the consumer-visible copy.
  for (const heading of ['App Name', 'Subtitle', 'Promotional Text', 'Keywords', 'Description', 'Screenshot Captions']) {
    const sec = text.match(new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i'));
    const hit = sec && trademarkHit(sec[1]);
    if (hit) trademarks.push({ locale, field: heading, match: hit });
  }

  if (FIX) writeFileSync(path, text);
  rows.push(row);
}

console.log(`\n${rows.length} locale files checked${FIX ? ' (counts restamped)' : ''}`);
console.table(rows);

if (trademarks.length) {
  console.error(`\n❌ ${trademarks.length} trademarked tournament name(s) in listing copy (APP_STORE_LISTING.md risk #4):`);
  console.table(trademarks);
  console.error('Listing copy must use generic descriptors — the in-game mode name is a separate, tracked IP item.');
  failures += trademarks.length;
}

if (stale.length) {
  console.warn(`\n⚠️  ${stale.length} expired-campaign token(s) still in indexed fields:`);
  console.table(stale);
  console.warn('These fields are editable in App Store Connect without a build — refresh them.');
}

process.exit(failures ? 1 : 0);
