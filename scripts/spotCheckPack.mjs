#!/usr/bin/env node
/**
 * One-off spot-check script (Phase E.3): sample 30 real players from the
 * community pack and dump their identifying fields so a human can eyeball
 * them for mojibake, truncation, nationality mismatches, and impossible ages.
 * Not wired into npm scripts — run with `node scripts/spotCheckPack.mjs`.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CP = join(ROOT, 'src/data/communityPack');

function extractLiteral(path) {
  const src = readFileSync(path, 'utf8');
  const eq = src.indexOf('=');
  let start = -1;
  for (let i = eq + 1; i < src.length; i++) {
    if (src[i] === '{' || src[i] === '[') { start = i; break; }
  }
  let depth = 0, inStr = false, escape = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return JSON.parse(src.slice(start, i + 1));
    }
  }
  throw new Error('unbalanced');
}

const byClub = extractLiteral(join(CP, 'byClub.ts'));
const freeAgents = extractLiteral(join(CP, 'freeAgents.ts'));
const newLeagues = extractLiteral(join(CP, 'newLeagues.ts'));

const all = [];
for (const [clubId, players] of Object.entries(byClub)) {
  for (const p of players) all.push({ bucket: `byClub[${clubId}]`, ...p });
}
for (const p of freeAgents) all.push({ bucket: 'freeAgents', ...p });
for (const [lid, lg] of Object.entries(newLeagues)) {
  for (const club of lg.clubs) {
    for (const p of club.players) all.push({ bucket: `newLeagues[${lid}].${club.id}`, ...p });
  }
}

function* rng(seed) {
  let s = seed >>> 0;
  while (true) {
    s = (s * 1664525 + 1013904223) >>> 0;
    yield s;
  }
}
const r = rng(42);
const N = 30;
const picked = new Set();
while (picked.size < N) {
  const idx = r.next().value % all.length;
  picked.add(idx);
}

// True-mojibake signatures: UTF-8 double-encoded as Latin-1.
// `Ã<letter>` catches é/è/à/ñ/etc. misencoded; `â€` catches smart quotes.
// `Â ` (followed by space or Latin-1 symbol) catches NBSP + C1 misencoding.
// Bare `Â<letter>` is NOT included — Portuguese "Â" is legitimate.
const TRUE_MOJIBAKE = /Ã[a-zA-Z]|â€|Â[\s£©®¢§¥]/;

console.log('── 30-player spot-check ───────────────────────────────────────────');
for (const idx of picked) {
  const p = all[idx];
  const flags = [];
  const name = `${p.fn || ''} ${p.ln || ''}`.trim();
  if (TRUE_MOJIBAKE.test(name)) flags.push('MOJIBAKE');
  if (name.length === 0) flags.push('EMPTY-NAME');
  if (p.fn && p.fn.length === 1 && p.fn === p.ln?.charAt(0)) flags.push('MONONYM-SPLIT');
  if (p.fn && p.fn.length > 40) flags.push('LONG-FN');
  if (p.ln && p.ln.length > 40) flags.push('LONG-LN');
  const flagStr = flags.length ? ` [${flags.join(',')}]` : '';
  console.log(
    `  [${String(idx).padStart(5)}] age ${p.age}  ovr ${p.ovr}  ${name.padEnd(32)} | ` +
    `nat=${(p.nat || '?').padEnd(20)} | pos=${p.pos} | fcId=${p.fcId} | ${p.bucket}${flagStr}`
  );
}

// Whole-pack sweep: true mojibake.
let mojibakeHits = 0;
const mojibakeExamples = [];
for (const p of all) {
  const text = `${p.fn || ''} ${p.ln || ''} ${p.nat || ''}`;
  if (TRUE_MOJIBAKE.test(text)) {
    mojibakeHits++;
    if (mojibakeExamples.length < 10) {
      mojibakeExamples.push(`${p.fn} ${p.ln} | nat=${p.nat} | ${p.bucket} | fcId=${p.fcId}`);
    }
  }
}
console.log(`\n── True mojibake sweep (narrow): ${mojibakeHits}/${all.length}`);
for (const ex of mojibakeExamples) console.log(`  HIT: ${ex}`);

// Mononym split: fn is a single char that equals the first char of ln.
// Indicates the single-word-name branch in buildPlayer() emitted garbage fn.
let mononymHits = 0;
const mononymExamples = [];
for (const p of all) {
  if (p.fn && p.fn.length === 1 && p.ln && p.fn === p.ln.charAt(0)) {
    mononymHits++;
    if (mononymExamples.length < 15) {
      mononymExamples.push(`fn="${p.fn}" ln="${p.ln}" | ${p.bucket} | fcId=${p.fcId}`);
    }
  }
}
console.log(`\n── Mononym-split sweep (fn==ln[0], 1 char): ${mononymHits}/${all.length}`);
for (const ex of mononymExamples) console.log(`  HIT: ${ex}`);

// Empty/whitespace-only fn but non-empty ln — legitimate after fix, but
// good to report the existing count baseline.
let emptyFnCount = 0;
for (const p of all) {
  if (typeof p.fn === 'string' && p.fn.trim().length === 0 && p.ln) emptyFnCount++;
}
console.log(`\n── Existing empty-fn + non-empty-ln count: ${emptyFnCount}`);

// Age sanity.
const ages = all.map((p) => p.age).filter((a) => typeof a === 'number');
ages.sort((a, b) => a - b);
console.log(`\n── Age distribution — min ${ages[0]}  p10 ${ages[Math.floor(ages.length*0.1)]}  median ${ages[Math.floor(ages.length/2)]}  p90 ${ages[Math.floor(ages.length*0.9)]}  max ${ages[ages.length-1]}`);
console.log(`  age<=16: ${ages.filter((a) => a <= 16).length}`);
console.log(`  age>=40: ${ages.filter((a) => a >= 40).length}`);
