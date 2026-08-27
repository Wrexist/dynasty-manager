#!/usr/bin/env node
/**
 * Phase 5 — bulk extraction from the EA Drop API.
 *
 * Restartable by construction: every page is written to its own raw file the
 * moment it lands, and a checkpoint records which offsets are done. Re-running
 * after a crash, a rate-limit stall or a network drop resumes at the first
 * missing page instead of starting from zero. Raw files are never rewritten by
 * later stages — normalization reads them and writes elsewhere.
 *
 * Usage:
 *   node scripts/fc27/extract_fc27.mjs [--base <url>] [--slug <slug>]
 *                                      [--limit N] [--delay MS] [--max N]
 *                                      [--gender 0|1] [--fresh]
 *
 * --base exists so the pipeline can be exercised end to end against a local
 * fixture server without pretending fixture output is real FC27 data.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getJson, sleep, AccessDeniedError, EgressBlockedError } from './lib/http.mjs';
import { byId, pageUrl } from './lib/sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_RAW_DIR = join(ROOT, 'data/fc27/raw');

const BROWSERISH_HEADERS = {
  // EA's edge rejects requests with no UA. This identifies a normal client;
  // it does not defeat any access control, and no auth is sent.
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

export function parseArgs(argv) {
  const args = { limit: 100, delay: 1000, max: Infinity, fresh: false, locale: 'en' };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=');
    const next = () => (inline !== undefined ? inline : argv[++i]);
    switch (flag) {
      case '--base': args.base = next(); break;
      case '--slug': args.slug = next(); break;
      case '--limit': args.limit = Number(next()); break;
      case '--delay': args.delay = Number(next()); break;
      case '--max': args.max = Number(next()); break;
      case '--gender': args.gender = next(); break;
      case '--raw-dir': args.rawDir = next(); break;
      case '--locale': args.locale = next(); break;
      case '--fresh': args.fresh = true; break;
      default: break;
    }
  }
  return args;
}

const stateFile = (rawDir) => join(rawDir, '_state.json');

function loadState(rawDir, fresh) {
  const file = stateFile(rawDir);
  if (fresh || !existsSync(file)) {
    return { source: 'ea-drop-api', slug: null, base: null, total: null, pages: {}, done: false };
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const saveState = (rawDir, state) =>
  writeFileSync(stateFile(rawDir), `${JSON.stringify(state, null, 2)}\n`);

/**
 * Find the season slug that answers. EA renames the path each year, so the
 * pipeline probes rather than hardcoding, and records what it found.
 */
export async function resolveSlug(source, base, candidates, { locale, gender }) {
  for (const slug of candidates) {
    const url = pageUrl({ ...source, base }, slug, {
      offset: 0, limit: 1, locale, extra: { gender },
    });
    try {
      const body = await getJson(url, { headers: BROWSERISH_HEADERS, retries: 1 });
      const items = body?.[source.itemsKey];
      if (Array.isArray(items)) {
        return { slug, total: body?.[source.totalKey] ?? null, probeUrl: url };
      }
    } catch (err) {
      if (err instanceof EgressBlockedError) throw err;
      // A 404 just means "not this season's slug" — try the next one.
      if (!(err instanceof AccessDeniedError)) throw err;
    }
  }
  return null;
}

export async function extract(args) {
  const source = byId('ea-drop-api');
  const base = args.base ?? source.base;
  const rawDir = args.rawDir ?? DEFAULT_RAW_DIR;
  mkdirSync(rawDir, { recursive: true });

  const state = loadState(rawDir, args.fresh);
  state.base = base;

  if (!state.slug) {
    const candidates = args.slug ? [args.slug] : source.slugCandidates;
    console.log(`[discover] probing season slugs: ${candidates.join(', ')}`);
    const found = await resolveSlug(source, base, candidates, {
      locale: args.locale, gender: args.gender,
    });
    if (!found) {
      throw new Error(
        `No season slug answered at ${base}. Tried: ${candidates.join(', ')}. `
        + 'Re-run with --slug once EA\'s current path is known.',
      );
    }
    state.slug = found.slug;
    state.total = found.total;
    console.log(`[discover] slug=${found.slug} totalItems=${found.total ?? 'unknown'}`);
    saveState(rawDir, state);
  }

  let offset = 0;
  let fetched = 0;
  const limit = args.limit;

  for (;;) {
    if (state.total !== null && offset >= state.total) break;
    if (fetched >= args.max) {
      console.log(`[extract] stopping at --max ${args.max}`);
      break;
    }

    const key = String(offset);
    if (state.pages[key]) {
      // Already on disk from an earlier run — skip without a request.
      offset += limit;
      fetched += state.pages[key].count;
      continue;
    }

    const url = pageUrl({ ...source, base }, state.slug, {
      offset, limit, locale: args.locale, extra: { gender: args.gender },
    });
    const body = await getJson(url, { headers: BROWSERISH_HEADERS });
    const items = body?.[source.itemsKey] ?? [];

    if (state.total === null && body?.[source.totalKey] !== undefined) {
      state.total = body[source.totalKey];
      console.log(`[extract] total reported: ${state.total}`);
    }

    if (items.length === 0) break;

    const file = `source_${String(offset).padStart(6, '0')}.json`;
    writeFileSync(
      join(rawDir, file),
      `${JSON.stringify({ url, fetchedAt: new Date().toISOString(), items }, null, 0)}\n`,
    );
    state.pages[key] = { file, count: items.length };
    saveState(rawDir, state);

    fetched += items.length;
    offset += items.length;
    const totalLabel = state.total ?? '?';
    console.log(`[extract] ${fetched}/${totalLabel} (offset=${offset})`);

    if (items.length < limit) break;
    await sleep(args.delay);
  }

  state.done = state.total !== null && fetched >= state.total;
  saveState(rawDir, state);
  console.log(`[extract] complete: ${fetched} records across ${Object.keys(state.pages).length} pages`);
  return { fetched, state, rawDir };
}

/** Read every raw page back in offset order. */
export function readRawItems(rawDir = DEFAULT_RAW_DIR) {
  if (!existsSync(rawDir)) return [];
  const files = readdirSync(rawDir).filter((f) => f.startsWith('source_') && f.endsWith('.json')).sort();
  const items = [];
  for (const file of files) {
    const body = JSON.parse(readFileSync(join(rawDir, file), 'utf8'));
    items.push(...(body.items ?? []));
  }
  return items;
}

export { DEFAULT_RAW_DIR };

if (import.meta.url === `file://${process.argv[1]}`) {
  extract(parseArgs(process.argv.slice(2))).catch((err) => {
    if (err instanceof EgressBlockedError) {
      console.error(`\n[BLOCKED] ${err.message}`);
      console.error('This environment\'s egress policy denies the host. Run the pipeline '
        + 'from a network that permits it; nothing here works around the block.');
      process.exit(2);
    }
    console.error(`[error] ${err.message}`);
    process.exit(1);
  });
}
