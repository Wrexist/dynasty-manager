#!/usr/bin/env node
/**
 * Phase 9 — data quality validation.
 *
 * Exits non-zero on a HARD failure (the dataset is not shippable) and merely
 * reports SOFT findings (things a human should look at). "The script finished"
 * is not success: a run that produces 400 players exits 1.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parseCsv } from './lib/csv.mjs';
import { parseArgs } from './lib/args.mjs';
import { MALE_CSV, QUALITY_REPORT_PATH } from './lib/paths.mjs';

/** Below this, assume the extraction was truncated rather than complete. */
export const MIN_EXPECTED_PLAYERS = 15_000;

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export function analyse(rows, { minExpected = MIN_EXPECTED_PLAYERS } = {}) {
  const hard = [];
  const soft = [];

  if (rows.length < minExpected) {
    hard.push(`Only ${rows.length} players — expected at least ${minExpected}. `
      + 'Treat this as a truncated extraction, not a small database, until the '
      + "source's own reported total says otherwise.");
  }

  // -- duplicate ids -------------------------------------------------------
  const idCounts = new Map();
  for (const r of rows) idCounts.set(r.player_id, (idCounts.get(r.player_id) ?? 0) + 1);
  const dupIds = [...idCounts.entries()].filter(([, c]) => c > 1);
  if (dupIds.length) hard.push(`${dupIds.length} duplicate player_id values.`);

  const blankIds = rows.filter((r) => !r.player_id).length;
  if (blankIds) hard.push(`${blankIds} rows have no player_id.`);

  // -- duplicate names are legitimate; report, never delete -----------------
  const nameCounts = new Map();
  for (const r of rows) {
    const key = (r.name ?? '').trim().toLowerCase();
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const dupNames = [...nameCounts.entries()].filter(([, c]) => c > 1);

  // -- missing values per column -------------------------------------------
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const missing = columns
    .map((c) => ({ column: c, missing: rows.filter((r) => r[c] === '' || r[c] === undefined).length }))
    .sort((a, b) => b.missing - a.missing);

  for (const critical of ['player_id', 'name', 'overall', 'position']) {
    const entry = missing.find((m) => m.column === critical);
    if (entry && entry.missing > 0) hard.push(`${entry.missing} rows missing critical field '${critical}'.`);
  }

  // -- rating sanity -------------------------------------------------------
  const badOverall = rows.filter((r) => {
    const v = num(r.overall);
    return v === null || v < 1 || v > 99;
  });
  if (badOverall.length) hard.push(`${badOverall.length} rows have overall outside 1..99.`);

  // Potential is only checkable when a source actually supplied it. EA's
  // ratings API does not, so an all-null column is expected, not a failure.
  const withPotential = rows.filter((r) => num(r.potential) !== null);
  const potentialBelowOverall = withPotential.filter((r) => num(r.potential) < num(r.overall));
  if (withPotential.length === 0) {
    soft.push('No potential values present. Expected when EA is the only source — '
      + 'potential must be merged from a career-mode source before the game can use this data.');
  } else if (potentialBelowOverall.length) {
    soft.push(`${potentialBelowOverall.length} rows have potential < overall. Check whether the `
      + "merged source defines potential the same way career mode does.");
  }

  // -- age sanity ----------------------------------------------------------
  const ages = rows.map((r) => num(r.derived_age)).filter((a) => a !== null);
  const impossibleAge = ages.filter((a) => a < 14 || a > 55).length;
  if (impossibleAge) soft.push(`${impossibleAge} rows have an implausible derived_age (<14 or >55).`);

  const badDob = rows.filter((r) => r.date_of_birth && Number.isNaN(new Date(r.date_of_birth).getTime())).length;
  if (badDob) soft.push(`${badDob} rows have an unparseable date_of_birth.`);

  // -- preferred-foot sanity: real squads run roughly 3:1 right-footed ------
  const right = rows.filter((r) => r.preferred_foot === 'Right').length;
  const left = rows.filter((r) => r.preferred_foot === 'Left').length;
  if (right + left > 100) {
    const rightShare = right / (right + left);
    if (rightShare < 0.55 || rightShare > 0.9) {
      soft.push(`Right-footed share is ${(rightShare * 100).toFixed(1)}% (right=${right}, left=${left}). `
        + 'Football squads sit near 75%. A share far off that suggests the numeric '
        + "preferredFoot code mapping in lib/schema.mjs is inverted for this season.");
    }
  }

  // -- club sanity ---------------------------------------------------------
  const freeAgents = rows.filter((r) => !r.club).length;
  const clubs = new Set(rows.map((r) => r.club).filter(Boolean));
  const leagues = new Set(rows.map((r) => r.league).filter(Boolean));
  const nations = new Set(rows.map((r) => r.nationality).filter(Boolean));
  const positions = new Map();
  for (const r of rows) {
    if (r.position) positions.set(r.position, (positions.get(r.position) ?? 0) + 1);
  }
  const malformedClubs = [...clubs].filter((c) => /[<>{}]|&[a-z]+;/i.test(c));
  if (malformedClubs.length) soft.push(`${malformedClubs.length} club names contain markup-ish characters.`);

  // -- unmapped stat passthroughs -----------------------------------------
  const passthrough = columns.filter((c) => c.startsWith('stat_'));
  if (passthrough.length) {
    soft.push(`${passthrough.length} EA stat keys had no schema slot and passed through as `
      + `columns: ${passthrough.join(', ')}. Add them to STAT_ALIASES if they are renames.`);
  }

  const overalls = rows.map((r) => num(r.overall)).filter((v) => v !== null);
  const potentials = withPotential.map((r) => num(r.potential));

  return {
    hard,
    soft,
    stats: {
      total: rows.length,
      duplicateIds: dupIds.length,
      duplicateNames: dupNames.length,
      topDuplicateNames: dupNames.sort((a, b) => b[1] - a[1]).slice(0, 10),
      clubs: clubs.size,
      leagues: leagues.size,
      nations: nations.size,
      freeAgents,
      positions: [...positions.entries()].sort((a, b) => b[1] - a[1]),
      overallMin: overalls.length ? Math.min(...overalls) : null,
      overallMax: overalls.length ? Math.max(...overalls) : null,
      potentialMin: potentials.length ? Math.min(...potentials) : null,
      potentialMax: potentials.length ? Math.max(...potentials) : null,
      ageMin: ages.length ? Math.min(...ages) : null,
      ageMax: ages.length ? Math.max(...ages) : null,
      withPlaystyles: rows.filter((r) => r.playstyles).length,
      withPlaystylesPlus: rows.filter((r) => r.playstyles_plus).length,
      missing,
    },
  };
}

export function renderReport(result, { csvPath, generatedAt }) {
  const s = result.stats;
  const lines = [
    '# FC27 data quality report',
    '',
    `> Generated by \`scripts/fc27/validate_fc27.mjs\` on ${generatedAt}.`,
    `> Source file: \`${csvPath}\``,
    '',
    '## Totals',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Players | ${s.total} |`,
    `| Unique clubs | ${s.clubs} |`,
    `| Unique leagues | ${s.leagues} |`,
    `| Unique nations | ${s.nations} |`,
    `| Free agents (no club) | ${s.freeAgents} |`,
    `| Duplicate player_id | ${s.duplicateIds} |`,
    `| Duplicate names (legitimate, reported only) | ${s.duplicateNames} |`,
    `| Rows with PlayStyles | ${s.withPlaystyles} |`,
    `| Rows with PlayStyles+ | ${s.withPlaystylesPlus} |`,
    `| Overall range | ${s.overallMin} – ${s.overallMax} |`,
    `| Potential range | ${s.potentialMin ?? 'n/a'} – ${s.potentialMax ?? 'n/a'} |`,
    `| Derived age range | ${s.ageMin ?? 'n/a'} – ${s.ageMax ?? 'n/a'} |`,
    '',
    '## Positions',
    '',
    '| Position | Players |',
    '| --- | ---: |',
    ...s.positions.map(([p, c]) => `| ${p} | ${c} |`),
    '',
    '## Missing values per column',
    '',
    '| Column | Missing | % |',
    '| --- | ---: | ---: |',
    ...s.missing.map((m) => `| ${m.column} | ${m.missing} | ${s.total ? ((m.missing / s.total) * 100).toFixed(1) : '0.0'}% |`),
    '',
    '## Findings',
    '',
    result.hard.length ? '### Blocking' : '### Blocking\n\nNone.',
    ...result.hard.map((h) => `- ❌ ${h}`),
    '',
    result.soft.length ? '### Advisory' : '### Advisory\n\nNone.',
    ...result.soft.map((h) => `- ⚠️ ${h}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function run({ csvPath = MALE_CSV, reportPath = QUALITY_REPORT_PATH, minExpected } = {}) {
  if (!existsSync(csvPath)) {
    throw new Error(`No dataset at ${csvPath}. Run the extract + normalize stages first.`);
  }
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const result = analyse(rows, { minExpected });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, renderReport(result, { csvPath, generatedAt: new Date().toISOString() }), 'utf8');
  return { ...result, reportPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const result = run({ csvPath: args.csv, reportPath: args.report, minExpected: args.min });
  console.log(`[validate] ${result.stats.total} players -> ${result.reportPath}`);
  for (const s of result.soft) console.log(`  ⚠️  ${s}`);
  for (const h of result.hard) console.error(`  ❌ ${h}`);
  process.exit(result.hard.length ? 1 : 0);
}
