#!/usr/bin/env node
/**
 * Phase 12 — one command that rebuilds the whole FC27 dataset.
 *
 *   npm run fc27:build
 *
 * Stages: extract (restartable) -> normalize + gender split + dedupe ->
 * [merge potential] -> validate -> [compare] -> [export for game] -> run report.
 * The bracketed stages run only when asked for, so the step counter is derived
 * from the plan rather than hardcoded — a run that says "3/6" really has six.
 *
 * Re-runnable: extraction resumes from its checkpoint, so a second run after a
 * failure costs only the pages that never landed. `--fresh` re-pulls from zero.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { extract, SourceRefusedError } from './extract_fc27.mjs';
import { run as normalizeRun } from './normalize_fc27.mjs';
import { run as validateRun } from './validate_fc27.mjs';
import { run as compareRun } from './compare_fc25.mjs';
import { run as mergePotentialRun } from './merge_potential.mjs';
import { run as exportForGameRun } from './export_for_game.mjs';
import { EgressBlockedError } from './lib/http.mjs';
import { parseArgs } from './lib/args.mjs';
import { sidecarFor, RAW_DIR, DATA_DIR } from './lib/paths.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawDir = args.rawDir ?? RAW_DIR;
  const outDir = args.outDir ?? DATA_DIR;
  // A run redirected with --out-dir must not write its reports over the repo's
  // committed ones, so every downstream artifact follows the dataset.
  const paths = sidecarFor(args.outDir);

  const plan = [
    'extract', 'normalize',
    ...(args.mergePotential ? ['merge potential'] : []),
    'validate',
    ...(args.noCompare ? [] : ['compare']),
    ...(args.exportForGame ? ['export for game'] : []),
  ];
  let step = 0;
  const announce = (name) => console.log(`== ${++step}/${plan.length} ${name} ==`);

  const startedAt = new Date().toISOString();
  const steps = [];
  const record = (name, detail) => { steps.push({ name, ...detail }); return detail; };

  announce('extract');
  const extraction = await extract({ ...args, rawDir });
  record('extract', {
    fetched: extraction.fetched, rawDir: extraction.rawDir,
    slug: extraction.state.slug, reportedTotal: extraction.state.total,
  });

  announce('normalize');
  const normalized = normalizeRun({ rawDir, outDir });
  record('normalize', {
    unique: normalized.total,
    male: normalized.split.male.length,
    female: normalized.split.female.length,
    unknownGender: normalized.split.unknown.length,
    duplicateIdsCollapsed: normalized.duplicates.length,
    columns: normalized.columns.length,
  });
  console.log(`   male=${normalized.split.male.length} female=${normalized.split.female.length}`
    + ` unknown=${normalized.split.unknown.length}`);

  const maleCsv = normalized.written.male?.csvPath;
  if (!maleCsv) throw new Error('Normalization produced no male players — nothing to validate.');

  if (args.mergePotential) {
    announce('merge potential');
    const merged = mergePotentialRun({
      csvPath: maleCsv,
      from: args.mergePotential,
      label: args.potentialLabel,
      clamp: Boolean(args.clamp),
    });
    record('merge-potential', {
      provider: merged.providerPath, filled: merged.filled, clamped: merged.clamped,
      unmatched: merged.unmatched, tiers: merged.tiers,
    });
    console.log(`   filled ${merged.filled}/${merged.total} (tiers ${JSON.stringify(merged.tiers)})`);
  }

  announce('validate');
  const validation = validateRun({
    csvPath: maleCsv, reportPath: paths.qualityReport, minExpected: args.min,
  });
  record('validate', {
    total: validation.stats.total, blocking: validation.hard,
    advisory: validation.soft, report: validation.reportPath,
  });
  for (const s of validation.soft) console.log(`   ⚠️  ${s}`);
  for (const h of validation.hard) console.error(`   ❌ ${h}`);

  if (!args.noCompare) {
    announce('compare');
    const comparison = compareRun({
      csvPath: maleCsv, baselineKey: args.baseline ?? 'fc26',
      outDir: paths.comparisonDir, reportPath: paths.comparisonReport,
    });
    record('compare', { matched: comparison.matched, tiers: comparison.tiers, counts: comparison.counts });
    console.log(`   matched=${comparison.matched} new=${comparison.counts.new_players}`
      + ` removed=${comparison.counts.removed_players}`);
  }

  if (args.exportForGame) {
    announce('export for game');
    const exported = exportForGameRun({ csvPath: maleCsv, outPath: args.gameOut ?? paths.gameInput });
    record('export-for-game', {
      out: exported.outPath, rows: exported.total,
      unresolvedLeagues: exported.unresolvedLeagues.length, missingPotential: exported.missingPotential,
    });
    console.log(`   ${exported.total} rows -> ${exported.outPath}`
      + ` (${exported.unresolvedLeagues.length} leagues unresolved)`);
  }

  mkdirSync(dirname(paths.runReport), { recursive: true });
  writeFileSync(paths.runReport, `${JSON.stringify({
    startedAt, finishedAt: new Date().toISOString(), args, steps,
  }, null, 2)}\n`, 'utf8');

  console.log(`\nOutputs:\n  ${maleCsv}\n  ${normalized.written.male.jsonPath}`
    + `\n  run report: ${paths.runReport}`);

  if (validation.hard.length) {
    console.error('\nBuild finished but the dataset FAILED validation — see the blocking findings above.');
    process.exit(1);
  }
}

main().catch((err) => {
  if (err instanceof EgressBlockedError || err instanceof SourceRefusedError) {
    console.error(`\n[BLOCKED] ${err.message}`);
    process.exit(2);
  }
  console.error(`[error] ${err.stack ?? err.message}`);
  process.exit(1);
});
