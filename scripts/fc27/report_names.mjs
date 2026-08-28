#!/usr/bin/env node
/**
 * Report every player whose name resolution changes, so the KEEP_MONONYM list
 * in lib/names.mjs can be reviewed against real data instead of memory.
 *
 *   node scripts/fc27/report_names.mjs [minOvr]
 */
import { readFileSync } from 'fs';
import { extractName } from '../lib/playerName.mjs';
import { parseCsv } from './lib/csv.mjs';

const MIN = Number(process.argv[2] ?? 0);
// The generators read this CSV, not the raw JSON: it is where `long_name`
// exists at all (built from first_name + last_name by export_for_game.mjs).
const src = parseCsv(readFileSync('data/fc27/FC27_community_pack_input.csv', 'utf8'));

const rows = [];
for (const p of src) {
  if (Number(p.overall ?? 0) < MIN) continue;
  const short = p.short_name || p.long_name || '';
  const { fn, ln } = extractName(p.long_name || '', short, p.nationality_name || '');
  const full = `${fn} ${ln}`.replace(/\s+/g, ' ').trim();
  const mono = fn.toLowerCase() === ln.toLowerCase();
  rows.push({ ovr: Number(p.overall), short, long: p.long_name, full: mono ? fn : full, mono, club: p.club_name });
}
// Only the ones EA labels with a single word, or with a bare suffix — the
// shapes where the family name can be lost.
const interesting = rows.filter(r => {
  const parts = r.short.trim().split(/\s+/);
  return parts.length === 1 || parts.slice(1).every(t => /^(Jr\.?|Sr\.?|J[uú]nior|Senior|I{1,3}|IV)$/i.test(t));
});
console.log(`candidates at ovr>=${MIN}: ${interesting.length}\n`);
for (const r of interesting.sort((a, b) => b.ovr - a.ovr)) {
  console.log(`${String(r.ovr).padStart(2)}  EA="${r.short}"${' '.repeat(Math.max(0, 16 - r.short.length))} long="${r.long}"${' '.repeat(Math.max(0, 34 - (r.long || '').length))} -> "${r.full}"`);
}
