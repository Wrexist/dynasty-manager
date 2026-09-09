/** Refresh the source snapshot from a complete official EA pull, preserving labelled potential. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { normalize, splitByGender, dedupeById } from './normalize_fc27.mjs';
import { sameNationality } from './lib/nationality.mjs';
import { MALE_CSV, RAW_DIR } from './lib/paths.mjs';
import { isMain } from '../lib/isMain.mjs';

export function refreshSnapshot({ rawDir = RAW_DIR, csv = MALE_CSV } = {}) {
  const state = JSON.parse(readFileSync(join(rawDir, '_state.json'), 'utf8'));
  if (!state.done || state.base !== 'https://drop-api.ea.com/rating') {
    throw new Error('A complete extraction from the official EA endpoint is required.');
  }
  const pages = Object.values(state.pages).map(({ file }) => {
    if (!/^source_\d+\.json$/.test(file)) throw new Error('Invalid source page filename');
    const page = JSON.parse(readFileSync(join(rawDir, file), 'utf8'));
    if (new URL(page.url).origin !== 'https://drop-api.ea.com') throw new Error('Unexpected source host');
    return page;
  });
  const items = pages.flatMap(page => page.items);
  if (items.length !== state.total || new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error('Incomplete or duplicate source identities');
  }
  const scrapedAt = pages.map(page => page.fetchedAt).sort().at(-1);
  if (!scrapedAt || !Number.isFinite(Date.parse(scrapedAt))) throw new Error('Missing extraction date');
  const old = parseCsv(readFileSync(csv, 'utf8'));
  const byId = new Map(old.map(row => [row.player_id, row]));
  const normalized = normalize(items, { scrapedAt, dataVersion: `ea-live-${scrapedAt.slice(0, 10)}` });
  const fresh = splitByGender(dedupeById(normalized).rows).male;
  for (const row of fresh) row.player_id = String(row.player_id);
  // A changed source scope must be reviewed before replacing the shipped data.
  if (fresh.length !== old.length || fresh.some(row => !byId.has(row.player_id))) {
    throw new Error('Source identity coverage changed; review additions/removals before refreshing');
  }
  for (const row of fresh) {
    const previous = byId.get(row.player_id);
    if (!sameNationality(row.nationality, previous.nationality)) {
      throw new Error(`Nationality changed for ${row.player_id}; review identity before importing`);
    }
    row.potential = previous.potential;
    row.potential_source = previous.potential_source;
  }
  writeFileSync(csv, toCsv(Object.keys(fresh[0]), fresh));
  return { players: fresh.length, source: state.base, slug: state.slug, scrapedAt };
}

if (isMain(import.meta.url)) console.log(refreshSnapshot(parseArgs(process.argv.slice(2))));
