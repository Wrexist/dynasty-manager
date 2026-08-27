#!/usr/bin/env node
/**
 * Phase 2 — probe every candidate source and record what actually answers.
 *
 * This is the step that decides whether a pipeline run is even possible from
 * the current network. It writes a machine-readable result so the selection
 * in docs/fc27-data-investigation.md is backed by a probe rather than an
 * assumption, and so a blocked run reports the blocked host by name.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { probe } from './lib/http.mjs';
import { SOURCES, pageUrl } from './lib/sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data/fc27/discovery.json');

const UA = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

export async function discover() {
  const results = [];

  for (const source of SOURCES) {
    const entry = {
      id: source.id,
      label: source.label,
      official: source.official,
      tier: source.tier,
      usableByDesign: source.usable,
      hasPotential: source.hasPotential,
      hasGender: source.hasGender,
      hasPlaystyles: source.hasPlaystyles,
      notes: source.notes,
      probes: [],
      reachable: false,
      reportedTotal: null,
      resolvedSlug: null,
    };

    if (source.kind === 'json-api') {
      for (const slug of source.slugCandidates) {
        const url = pageUrl(source, slug, { offset: 0, limit: 1 });
        const result = await probe(url, { headers: UA });
        entry.probes.push({ slug, ...result });
        if (result.ok) {
          entry.reachable = true;
          entry.resolvedSlug ??= slug;
        }
      }
    } else {
      entry.probes.push(await probe(source.base, { headers: UA }));
      entry.reachable = entry.probes.some((p) => p.ok);
    }

    results.push(entry);
  }

  const payload = {
    probedAt: new Date().toISOString(),
    anyReachable: results.some((r) => r.reachable),
    results,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  discover().then((payload) => {
    for (const r of payload.results) {
      const status = r.reachable ? `REACHABLE (${r.resolvedSlug ?? 'base'})` : 'unreachable';
      console.log(`${r.id.padEnd(14)} ${status}`);
      for (const p of r.probes) {
        console.log(`   ${p.status ?? 'ERR'}  ${p.url}${p.error ? `  (${p.error})` : ''}`);
      }
    }
    console.log(`\nwritten: ${OUT}`);
    if (!payload.anyReachable) {
      console.error('\nNo candidate source is reachable from this network. '
        + 'The hosts above were refused by the egress policy — report them rather '
        + 'than routing around them.');
      process.exit(2);
    }
  });
}
