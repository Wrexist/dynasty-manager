// Validate marketing/aso/locales/*.md against Apple's field limits.
// Fields are the backticked single-line values under each "## <Field> [n/limit]" heading.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = new URL('./locales', import.meta.url).pathname;
const LIMITS = { 'App Name': 30, 'Subtitle': 30, 'Promotional Text': 170, 'Keywords': 100 };

let failures = 0;
const rows = [];

for (const f of readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort()) {
  const text = readFileSync(join(DIR, f), 'utf8');
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
    if (len > limit) { console.error(`FAIL ${locale}: ${field} is ${len} > ${limit}: "${value}"`); failures++; }
    if (field === 'App Name' && !value.startsWith('Dynasty Manager')) {
      console.error(`FAIL ${locale}: App Name must start with brand: "${value}"`); failures++;
    }
    if (field === 'Keywords') {
      if (/,\s/.test(value)) { console.error(`FAIL ${locale}: keywords contain space after comma`); failures++; }
      const kws = value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const dupes = kws.filter((k, i) => kws.indexOf(k) !== i);
      if (dupes.length) { console.error(`FAIL ${locale}: duplicate keywords: ${[...new Set(dupes)].join(', ')}`); failures++; }
      if (len < 70) console.warn(`WARN ${locale}: keywords only ${len}/100 — leaving search coverage on the table`);
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
  }

  rows.push(row);
}

console.log(`\n${rows.length} locale files checked`);
console.table(rows);
process.exit(failures ? 1 : 0);
