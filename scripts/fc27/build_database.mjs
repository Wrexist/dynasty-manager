#!/usr/bin/env node
/**
 * Phase 12 — one command that rebuilds the whole FC27 dataset.
 *
 *   npm run fc27:build
 *
 * discover -> extract (restartable) -> normalize -> split by gender ->
 * dedupe -> validate -> CSV + JSON -> comparison -> run report.
 *
 * Re-runnable: extraction resumes from its checkpoint, so a second run after
 * a failure costs only the pages that never landed. Pass --fresh to start the
 * pull over from offset 0.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extract, parseArgs, DEFAULT_RAW_DIR } from './extract_fc27.mjs';
import { run as normalizeRun, OUT_DIR } from './normalize_fc27.mjs';
import { run as validateRun } from './validate_fc27.mjs';
import { run as compareRun } from './compare_fc25.mjs';
import { EgressBlockedError } from './lib/http.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN_REPORT = join(ROOT, 'data/fc27/last-run.json');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const skipCompare = process.argv.includes('--no-compare');
  const startedAt = new Date().toISOString();
  const steps = [];
  const record = (name, detail) => {
    steps.push({ name, ...detail });
    return detail;
  };

  console.log('== 1/4 extract ==');
  const extraction = await extract(args);
  record('extract', { fetched: extraction.fetched, rawDir: extraction.rawDir, slug: extraction.state.slug, reportedTotal: extraction.state.total });

  console.log('== 2/4 normalize ==');
  const normalized = normalizeRun({ rawDir: args.rawDir ?? DEFAULT_RAW_DIR, outDir: args.outDir ?? OUT_DIR });
  record('normalize', {
    unique: normalized.total,
    male: normalized.split.male.length,
    female: normalized.split.female.length,
    unknownGender: normalized.split.unknown.length,
    duplicateIdsCollapsed: normalized.duplicates.length,
    columns: normalized.columns.length,
  });
  console.log(`   male=${normalized.split.male.length} female=${normalized.split.female.length} unknown=${normalized.split.unknown.length}`);

  const maleCsv = normalized.written.male?.csvPath;
  if (!maleCsv) throw new Error('Normalization produced no male players — nothing to validate.');

  console.log('== 3/4 validate ==');
  const validation = validateRun({ csvPath: maleCsv, minExpected: args.minExpected });
  record('validate', { total: validation.stats.total, blocking: validation.hard, advisory: validation.soft, report: validation.reportPath });
  for (const s of validation.soft) console.log(`   ⚠️  ${s}`);
  for (const h of validation.hard) console.error(`   ❌ ${h}`);

  console.log('== 4/4 compare ==');
  if (skipCompare) {
    console.log('   skipped (--no-compare)');
  } else {
    const comparison = compareRun({ csvPath: maleCsv, baselineKey: 'fc26' });
    record('compare', { matched: comparison.matched, tiers: comparison.tiers, counts: comparison.counts });
    console.log(`   matched=${comparison.matched} new=${comparison.counts.new_players} removed=${comparison.counts.removed_players}`);
  }

  mkdirSync(dirname(RUN_REPORT), { recursive: true });
  writeFileSync(RUN_REPORT, `${JSON.stringify({
    startedAt, finishedAt: new Date().toISOString(), args, steps,
  }, null, 2)}\n`, 'utf8');

  console.log(`\nOutputs:\n  ${maleCsv}\n  ${normalized.written.male.jsonPath}\n  run report: ${RUN_REPORT}`);
  if (validation.hard.length) {
    console.error('\nBuild finished but the dataset FAILED validation — see the blocking findings above.');
    process.exit(1);
  }
}

main().catch((err) => {
  if (err instanceof EgressBlockedError) {
    console.error(`\n[BLOCKED] ${err.message}`);
    console.error('The source host is refused by this network\'s egress policy. '
      + 'Run from a network that permits it — the pipeline does not work around blocks.');
    process.exit(2);
  }
  console.error(`[error] ${err.stack ?? err.message}`);
  process.exit(1);
});
