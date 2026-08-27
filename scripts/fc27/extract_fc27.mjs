#!/usr/bin/env node
/**
 * Phase 5 — bulk extraction from the EA Drop API.
 *
 * Restartable by construction: every page is written to its own raw file the
 * moment it lands, and a checkpoint records which offsets are done. Re-running
 * after a crash, a rate-limit stall or a network drop resumes at the first
 * missing page instead of starting over.
 *
 * Usage:
 *   node scripts/fc27/extract_fc27.mjs [--base <url>] [--slug <slug>]
 *                                      [--limit N] [--delay MS] [--max N]
 *                                      [--gender 0|1] [--raw-dir <dir>] [--fresh]
 *
 * `--base` exists so the pipeline can be exercised end to end against the
 * local fixture server without pretending fixture output is real FC27 data.
 */
import { sleep, getJson, AccessDeniedError, EgressBlockedError } from './lib/http.mjs';
import { byId, pageUrl } from './lib/sources.mjs';
import { loadState, saveState, writeRawPage } from './lib/raw.mjs';
import { parseArgs } from './lib/args.mjs';
import { RAW_DIR } from './lib/paths.mjs';

const BROWSERISH_HEADERS = {
  // EA's edge rejects requests with no User-Agent. This identifies a normal
  // client; it defeats no access control, and no credentials are ever sent.
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

/**
 * Raised when every season slug was refused rather than merely absent.
 *
 * The distinction is the whole message: a 404 means EA renamed the path and
 * `--slug` is the fix; a 403 on every slug means the request never reached EA
 * at all, and no slug will help. Reporting the first as the second sends
 * people hunting for a path that was never the problem.
 */
export class SourceRefusedError extends Error {
  constructor(base, statuses) {
    const list = statuses.map(({ slug, status }) => `${slug} -> HTTP ${status}`).join(', ');
    super(
      `Every season slug at ${base} was REFUSED, not missing (${list}).\n`
      + 'A 403 on every slug means the requests are being blocked before they reach EA — '
      + 'typically a network egress policy or a proxy. Renaming the slug will not help.\n'
      + 'Run `npm run fc27:discover` to confirm, then run from a network that permits the host.',
    );
    this.name = 'SourceRefusedError';
    this.statuses = statuses;
  }
}

/**
 * Find the season slug that answers. EA renames the path each year, so the
 * pipeline probes rather than hardcoding, and records what it found.
 *
 * @returns {Promise<{slug: string, total: number|null} | null>} null when every
 *   slug replied 404 (genuinely absent). Throws SourceRefusedError when they
 *   were all refused.
 */
export async function resolveSlug(source, base, candidates, { locale, gender } = {}) {
  const refusals = [];

  for (const slug of candidates) {
    const url = pageUrl({ ...source, base }, slug, { offset: 0, limit: 1, locale, extra: { gender } });
    try {
      const body = await getJson(url, { headers: BROWSERISH_HEADERS, retries: 1 });
      if (Array.isArray(body?.[source.itemsKey])) {
        return { slug, total: body?.[source.totalKey] ?? null };
      }
    } catch (err) {
      if (err instanceof EgressBlockedError) throw err;
      if (!(err instanceof AccessDeniedError)) throw err;
      if (err.status !== 404) refusals.push({ slug, status: err.status });
    }
  }

  if (refusals.length === candidates.length) throw new SourceRefusedError(base, refusals);
  return null;
}

export async function extract(args = {}) {
  const source = byId('ea-drop-api');
  const base = args.base ?? source.base;
  const rawDir = args.rawDir ?? RAW_DIR;
  const limit = args.limit ?? 100;
  const delay = args.delay ?? 1000;
  const max = args.max ?? Infinity;

  const state = loadState(rawDir, { fresh: args.fresh });
  state.base = base;

  if (!state.slug) {
    const candidates = args.slug ? [args.slug] : source.slugCandidates;
    console.log(`[discover] probing season slugs: ${candidates.join(', ')}`);
    const found = await resolveSlug(source, base, candidates, { locale: args.locale, gender: args.gender });
    if (!found) {
      throw new Error(
        `No season slug answered at ${base} (all returned 404). Tried: ${candidates.join(', ')}. `
        + 'EA renames this path each season — re-run with --slug once the current one is known.',
      );
    }
    state.slug = found.slug;
    state.total = found.total;
    console.log(`[discover] slug=${found.slug} totalItems=${found.total ?? 'unknown'}`);
    saveState(rawDir, state);
  }

  let offset = 0;
  let fetched = 0;

  for (;;) {
    if (state.total !== null && offset >= state.total) break;

    const key = String(offset);
    const cached = state.pages[key];
    if (cached) {
      // Already on disk from an earlier run — resume past it with no request.
      offset += cached.count;
      fetched += cached.count;
      continue;
    }

    if (fetched >= max) {
      console.log(`[extract] stopping at --max ${max}`);
      break;
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

    state.pages[key] = writeRawPage(rawDir, offset, { url, items });
    saveState(rawDir, state);

    fetched += items.length;
    offset += items.length;
    console.log(`[extract] ${fetched}/${state.total ?? '?'} (offset=${offset})`);

    if (items.length < limit) break;
    await sleep(delay);
  }

  state.done = state.total !== null && fetched >= state.total;
  saveState(rawDir, state);
  console.log(`[extract] complete: ${fetched} records across ${Object.keys(state.pages).length} pages`);
  return { fetched, state, rawDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  extract(parseArgs(process.argv.slice(2))).catch((err) => {
    if (err instanceof EgressBlockedError || err instanceof SourceRefusedError) {
      console.error(`\n[BLOCKED] ${err.message}`);
      process.exit(2);
    }
    console.error(`[error] ${err.message}`);
    process.exit(1);
  });
}
