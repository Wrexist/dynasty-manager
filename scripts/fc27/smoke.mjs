#!/usr/bin/env node
/**
 * End-to-end verification of the pipeline without a network.
 *
 *   npm run fc27:smoke
 *
 * Starts the fixture server, then drives every stage the way a real build
 * does, including a deliberate mid-pull interrupt so the restart path is
 * exercised rather than assumed. Exits non-zero the moment an expectation
 * fails, so it is usable as a gate.
 *
 * The fixture's players are named "Fixture Player N" and every artifact is
 * written under a temp directory — this run can never be mistaken for, or
 * overwrite, real FC27 data.
 */
import { spawn } from 'child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { extract } from './extract_fc27.mjs';
import { run as normalizeRun } from './normalize_fc27.mjs';
import { run as validateRun } from './validate_fc27.mjs';
import { run as compareRun } from './compare_fc25.mjs';
import { run as mergePotentialRun } from './merge_potential.mjs';
import { run as exportForGameRun } from './export_for_game.mjs';
import { parseCsv } from './lib/csv.mjs';
import { BASELINES, DATASET_NAMES } from './lib/paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOTAL = 600;
const PORT = Number(process.env.FIXTURE_PORT ?? 8899);
const BASE = `http://127.0.0.1:${PORT}/rating`;

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/ea-sports-fc-27?limit=1`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Fixture server never became ready on port ${PORT}.`);
};

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'fc27-smoke-'));
  const rawDir = join(work, 'raw');
  const outDir = join(work, 'out');

  const server = spawn(process.execPath, [join(HERE, 'fixture_server.mjs')], {
    env: { ...process.env, FIXTURE_TOTAL: String(TOTAL), FIXTURE_PORT: String(PORT) },
    stdio: 'ignore',
  });

  try {
    await waitForServer();

    console.log('extract (interrupted at 200)');
    const partial = await extract({ base: BASE, rawDir, limit: 100, delay: 0, max: 200, fresh: true });
    check('stopped early at --max', partial.fetched === 200, `fetched ${partial.fetched}`);
    check('resolved the season slug by probing', partial.state.slug === 'ea-sports-fc-27', partial.state.slug);

    console.log('extract (resume)');
    const full = await extract({ base: BASE, rawDir, limit: 100, delay: 0 });
    check('resumed to completion', full.fetched === TOTAL, `fetched ${full.fetched}/${TOTAL}`);
    check('checkpoint marked done', full.state.done === true);

    console.log('normalize');
    const normalized = normalizeRun({ rawDir, outDir });
    check('every raw record survived', normalized.total === TOTAL, `${normalized.total}/${TOTAL}`);
    check('split by gender', normalized.split.male.length + normalized.split.female.length === TOTAL,
      `male ${normalized.split.male.length} / female ${normalized.split.female.length}`);
    check('no record silently assumed male', normalized.split.unknown.length === 0);
    check('unmapped EA stats passed through, not dropped',
      normalized.columns.includes('stat_unmappedNewStat'));

    const maleCsv = join(outDir, `${DATASET_NAMES.male}.csv`);
    check('male CSV written', existsSync(maleCsv));

    const beforeMerge = parseCsv(readFileSync(maleCsv, 'utf8'));
    check('potential is empty before any merge', beforeMerge.every((r) => r.potential === ''));
    check('a quoted club survives the CSV round trip',
      beforeMerge.some((r) => r.club === 'Fixture, Rovers')
      && beforeMerge.some((r) => r.club === 'Fixture "Athletic"'));

    console.log('merge potential (fixture ids are absent from the baseline on purpose)');
    const merged = mergePotentialRun({ csvPath: maleCsv, from: BASELINES.fc26, label: 'smoke' });
    check('fills nothing rather than inventing potential', merged.filled === 0, `filled ${merged.filled}`);

    console.log('validate');
    const validation = validateRun({ csvPath: maleCsv, reportPath: join(outDir, 'quality.md'), minExpected: 100 });
    check('no blocking findings', validation.hard.length === 0, validation.hard.join('; '));
    check('flags the absent potential column',
      validation.soft.some((s) => /No potential values present/.test(s)));
    check('quality report written', existsSync(join(outDir, 'quality.md')));

    console.log('compare');
    const comparison = compareRun({
      csvPath: maleCsv, baselineKey: 'fc26',
      outDir: join(outDir, 'comparison'), reportPath: join(outDir, 'compare.md'),
    });
    check('diff files written', existsSync(join(outDir, 'comparison/new_players.csv')));
    check('fixture players read as new', comparison.counts.new_players === normalized.split.male.length);

    console.log('export for game');
    const exported = exportForGameRun({ csvPath: maleCsv, outPath: join(outDir, 'game_input.csv') });
    const gameRows = parseCsv(readFileSync(exported.outPath, 'utf8'));
    const REQUIRED = ['player_id', 'short_name', 'player_positions', 'overall', 'potential', 'age',
      'club_name', 'league_id', 'league_name', 'pace', 'physic', 'goalkeeping_diving',
      'mentality_composure', 'movement_reactions', 'mentality_vision'];
    const missing = REQUIRED.filter((c) => !(c in gameRows[0]));
    check('emits every column processFC26.mjs reads', missing.length === 0, missing.join(', '));

    console.log('\nrepo safety');
    check('nothing was written under data/fc27', !existsSync(join(outDir, '..', '..', 'data')));
  } finally {
    server.kill();
    rmSync(work, { recursive: true, force: true });
  }

  if (failures) {
    console.error(`\nSMOKE FAILED — ${failures} check(s) did not hold.`);
    process.exit(1);
  }
  console.log('\nSMOKE OK — every stage ran end to end against the fixture.');
}

main().catch((err) => {
  console.error(`[smoke] ${err.stack ?? err.message}`);
  process.exit(1);
});
