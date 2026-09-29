#!/usr/bin/env node
// Checks the Play listing fields in listing-en.md against Google Play's limits
// and the marketing "never" list. Run: node marketing/play/check-listing.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const md = readFileSync(fileURLToPath(new URL('./listing-en.md', import.meta.url)), 'utf8');
const field = (heading) => {
  const m = md.match(new RegExp(`## ${heading}[^\\n]*\\n\`\`\`\\n([\\s\\S]*?)\\n\`\`\``));
  if (!m) throw new Error(`missing field: ${heading}`);
  return m[1];
};
const LIMITS = { 'App name': 30, 'Short description': 80, 'Full description': 4000, 'Release notes': 500 };
const BANNED_TITLE = /\b(free|best|#1|top|sale|new)\b/i;
const BANNED_ANY = /\b(FIFA|FUT|EA FC|FC Mobile|Premier League|Champions League|TOTY|official|licensed)\b/i;

let failed = false;
for (const [name, max] of Object.entries(LIMITS)) {
  const text = field(name);
  const len = [...text].length;
  const ok = len <= max;
  failed ||= !ok;
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}: ${len}/${max}`);
  const hit = text.match(BANNED_ANY);
  if (hit) { failed = true; console.log(`BAD ${name}: contains "${hit[0]}"`); }
}
const title = field('App name');
if (BANNED_TITLE.test(title)) { failed = true; console.log('BAD App name: promotional word in title'); }
process.exit(failed ? 1 : 0);
