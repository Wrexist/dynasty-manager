#!/usr/bin/env node
/**
 * Phase 10 — diff the FC27 dataset against the baseline already in the repo.
 *
 * Two baselines ship here and they use different schemas:
 *   - `FC26_20250921.csv`  SoFIFA-shaped (player_id, overall, potential, dob…)
 *   - `fc25_players.csv`   EA-ratings-shaped (Name, OVR, Team…, url ending /<id>)
 *
 * Both carry the same persistent player id — SoFIFA's `player_id` and the
 * trailing segment of an EA ratings URL are the same id space — so id
 * matching is tried first. It is not assumed to work: every pair records the
 * tier it matched on, and the report prints the tier histogram so a collapsed
 * id space is visible instead of silently degrading into name matching.
 *
 * Name-only matching is deliberately NOT used when a name is ambiguous
 * (more than one player on either side shares it).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseCsv, toCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'data/fc27/comparison');
const REPORT = join(ROOT, 'docs/fc25-vs-fc27.md');

export const BASELINES = {
  fc26: join(ROOT, 'FC26_20250921.csv'),
  fc25: join(ROOT, 'fc25_players.csv'),
};

/** Strip accents/punctuation so "Nicolò Barella" and "Nicolo Barella" agree. */
export function normName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const idFromEaUrl = (url) => {
  const m = String(url ?? '').match(/\/(\d+)\/?$/);
  return m ? m[1] : '';
};

/** Coerce either baseline schema into one comparison shape. */
export function readBaseline(path) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length === 0) return [];
  const isSofifa = 'player_id' in rows[0];
  return rows.map((r) => (isSofifa
    ? {
      id: String(r.player_id ?? ''),
      name: r.short_name || r.long_name || '',
      longName: r.long_name || '',
      dob: r.dob || '',
      club: r.club_name || '',
      league: r.league_name || '',
      position: String(r.player_positions || '').split(',')[0].trim(),
      overall: r.overall === '' ? null : Number(r.overall),
      potential: r.potential === '' ? null : Number(r.potential),
    }
    : {
      id: idFromEaUrl(r.url),
      name: r.Name || '',
      longName: r.Name || '',
      dob: '',
      club: r.Team || '',
      league: r.League || '',
      position: r.Position || '',
      overall: r.OVR === '' ? null : Number(r.OVR),
      potential: null,
    }));
}

/** FC27 normalized rows -> the same comparison shape. */
export function readCurrent(path) {
  return parseCsv(readFileSync(path, 'utf8')).map((r) => ({
    id: String(r.player_id ?? ''),
    name: r.name || '',
    longName: [r.first_name, r.last_name].filter(Boolean).join(' '),
    dob: r.date_of_birth || '',
    club: r.club || '',
    league: r.league || '',
    position: r.position || '',
    overall: r.overall === '' ? null : Number(r.overall),
    potential: r.potential === '' ? null : Number(r.potential),
  }));
}

/** Index by key, dropping keys that collide (ambiguous -> unusable). */
function uniqueIndex(rows, keyFn) {
  const map = new Map();
  const collided = new Set();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (map.has(key)) { collided.add(key); continue; }
    map.set(key, row);
  }
  for (const key of collided) map.delete(key);
  return map;
}

/**
 * Match current rows to baseline rows across descending-confidence tiers.
 * @returns {{ pairs: {current:object, base:object, tier:string}[],
 *             newPlayers: object[], removed: object[], tiers: Record<string, number> }}
 */
export function matchPlayers(current, baseline) {
  const pairs = [];
  const usedBase = new Set();
  const unmatched = [];

  const tiers = [
    ['id', (r) => r.id],
    ['name+dob', (r) => (r.dob ? `${normName(r.name)}|${r.dob}` : '')],
    ['longname+dob', (r) => (r.dob ? `${normName(r.longName)}|${r.dob}` : '')],
    ['name+club', (r) => (r.club ? `${normName(r.name)}|${normName(r.club)}` : '')],
  ];

  const indices = tiers.map(([label, keyFn]) => [label, keyFn, uniqueIndex(baseline, keyFn)]);

  for (const row of current) {
    let matched = null;
    for (const [label, keyFn, index] of indices) {
      const key = keyFn(row);
      if (!key) continue;
      const candidate = index.get(key);
      if (candidate && !usedBase.has(candidate)) {
        matched = { current: row, base: candidate, tier: label };
        break;
      }
    }
    if (matched) { pairs.push(matched); usedBase.add(matched.base); } else { unmatched.push(row); }
  }

  const tierCounts = {};
  for (const p of pairs) tierCounts[p.tier] = (tierCounts[p.tier] ?? 0) + 1;

  return {
    pairs,
    newPlayers: unmatched,
    removed: baseline.filter((b) => !usedBase.has(b)),
    tiers: tierCounts,
  };
}

export function run({ csvPath = join(ROOT, 'data/fc27/FC27_male_players.csv'),
  baselineKey = 'fc26', outDir = OUT_DIR, reportPath = REPORT } = {}) {
  const baselinePath = BASELINES[baselineKey] ?? baselineKey;
  if (!existsSync(csvPath)) throw new Error(`No FC27 dataset at ${csvPath}.`);
  if (!existsSync(baselinePath)) throw new Error(`No baseline at ${baselinePath}.`);

  const current = readCurrent(csvPath);
  const baseline = readBaseline(baselinePath);
  const { pairs, newPlayers, removed, tiers } = matchPlayers(current, baseline);

  const changedRatings = pairs
    .filter((p) => p.current.overall !== null && p.base.overall !== null && p.current.overall !== p.base.overall)
    .map((p) => ({
      player_id: p.current.id, name: p.current.name, match_tier: p.tier,
      overall_before: p.base.overall, overall_after: p.current.overall,
      delta: p.current.overall - p.base.overall,
    }))
    .sort((a, b) => b.delta - a.delta);

  const changedPotential = pairs
    .filter((p) => p.current.potential !== null && p.base.potential !== null && p.current.potential !== p.base.potential)
    .map((p) => ({
      player_id: p.current.id, name: p.current.name, match_tier: p.tier,
      potential_before: p.base.potential, potential_after: p.current.potential,
      delta: p.current.potential - p.base.potential,
    }));

  const changedClubs = pairs
    .filter((p) => normName(p.current.club) !== normName(p.base.club))
    .map((p) => ({
      player_id: p.current.id, name: p.current.name, match_tier: p.tier,
      club_before: p.base.club, club_after: p.current.club,
      league_before: p.base.league, league_after: p.current.league,
    }));

  const changedPositions = pairs
    .filter((p) => p.current.position && p.base.position && p.current.position !== p.base.position)
    .map((p) => ({
      player_id: p.current.id, name: p.current.name, match_tier: p.tier,
      position_before: p.base.position, position_after: p.current.position,
    }));

  mkdirSync(outDir, { recursive: true });
  const dump = (name, cols, rows) => {
    writeFileSync(join(outDir, `${name}.csv`), toCsv(cols, rows), 'utf8');
    return rows.length;
  };

  const counts = {
    new_players: dump('new_players', ['id', 'name', 'club', 'league', 'position', 'overall'], newPlayers),
    removed_players: dump('removed_players', ['id', 'name', 'club', 'league', 'position', 'overall'], removed),
    changed_ratings: dump('changed_ratings', ['player_id', 'name', 'match_tier', 'overall_before', 'overall_after', 'delta'], changedRatings),
    changed_potential: dump('changed_potential', ['player_id', 'name', 'match_tier', 'potential_before', 'potential_after', 'delta'], changedPotential),
    changed_clubs: dump('changed_clubs', ['player_id', 'name', 'match_tier', 'club_before', 'club_after', 'league_before', 'league_after'], changedClubs),
    changed_positions: dump('changed_positions', ['player_id', 'name', 'match_tier', 'position_before', 'position_after'], changedPositions),
  };

  const report = [
    `# ${baselineKey.toUpperCase()} vs FC27`,
    '',
    `> Generated by \`scripts/fc27/compare_fc25.mjs\` on ${new Date().toISOString()}.`,
    `> Baseline: \`${baselinePath}\` · Current: \`${csvPath}\``,
    '',
    '## Match quality',
    '',
    '| Tier | Pairs |',
    '| --- | ---: |',
    ...Object.entries(tiers).map(([t, c]) => `| ${t} | ${c} |`),
    `| **unmatched (treated as new)** | ${newPlayers.length} |`,
    '',
    'A healthy run matches the overwhelming majority on `id`. Heavy reliance on',
    'the name tiers means the two id spaces do not line up and the diff below',
    'should be read as indicative, not exact.',
    '',
    '## Changes',
    '',
    '| Set | Rows | File |',
    '| --- | ---: | --- |',
    ...Object.entries(counts).map(([k, v]) => `| ${k.replaceAll('_', ' ')} | ${v} | \`data/fc27/comparison/${k}.csv\` |`),
    '',
    '## Biggest rating movers',
    '',
    '| Player | Before | After | Δ |',
    '| --- | ---: | ---: | ---: |',
    ...changedRatings.slice(0, 15).map((r) => `| ${r.name} | ${r.overall_before} | ${r.overall_after} | +${r.delta} |`),
    ...changedRatings.slice(-15).reverse().map((r) => `| ${r.name} | ${r.overall_before} | ${r.overall_after} | ${r.delta} |`),
    '',
  ].join('\n');

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${report}\n`, 'utf8');

  return { counts, tiers, reportPath, matched: pairs.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const result = run({ csvPath: arg('--csv'), baselineKey: arg('--baseline') ?? 'fc26', outDir: arg('--out-dir'), reportPath: arg('--report') });
  console.log(`[compare] matched ${result.matched}; tiers=${JSON.stringify(result.tiers)}`);
  console.log(`[compare] ${JSON.stringify(result.counts)} -> ${result.reportPath}`);
}
