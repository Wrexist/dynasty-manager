// Read-only inventory of the checked-in top-five-league roster sources.
// Run: node scripts/audit-portrait-readiness.mjs
// Does not claim to inventory instantiated saves, fillers, or licensed assets.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function readData(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // Trusted local data only. No require/network/filesystem exposed to data modules.
  const context = { exports: {} };
  vm.runInNewContext(compiled, context, { filename: relative, timeout: 10000 });
  return context.exports;
}
const { byClub } = readData('src/data/communityPack/byClub.ts');
const { CLUB_TEMPLATE_ALIASES: aliases } = readData('src/data/clubTemplateAliases.ts');
const canonicalId = (id) => id?.replace(/^fc\d{2}-/, '');
const all = [];
const leagues = ['england', 'spain', 'italy', 'germany', 'france'].map((name) => {
  const { CLUBS, LEAGUE_INFO } = readData(`src/data/leagues/${name}.ts`);
  const { SQUADS } = readData(`src/data/squads/${name}.ts`);
  const rows = CLUBS.flatMap((club) => {
    const base = SQUADS[aliases[club.id] || club.id] ?? [];
    const cp = byClub[club.id];
    const effective = cp?.length ? cp : base;
    all.push(...effective.map((player) => ({ ...player, clubId: club.id, league: LEAGUE_INFO.id })));
    return [{ club: club.id, base: base.length, community: cp?.length ?? 0, effective: effective.length }];
  });
  const players = all.filter((player) => player.league === LEAGUE_INFO.id);
  return {
    league: LEAGUE_INFO.name, clubs: CLUBS.length,
    baseTemplates: rows.reduce((n, r) => n + r.base, 0),
    communityTemplates: rows.reduce((n, r) => n + r.community, 0),
    effectiveTemplates: players.length,
    uniqueIds: new Set(players.map((p) => canonicalId(p.fcId)).filter(Boolean)).size,
    missingIds: players.filter((p) => !p.fcId).length,
    missingRosters: rows.filter((r) => !r.effective).map((r) => r.club),
    idFormats: [...new Set(players.map((p) => p.fcId?.match(/^fc\d{2}-/)?.[0] ?? (p.fcId ? 'unprefixed' : 'missing')))],
  };
});
const groups = new Map();
for (const p of all) {
  const id = canonicalId(p.fcId);
  if (!id) continue;
  groups.set(id, [...(groups.get(id) ?? []), p]);
}
console.log(JSON.stringify({
  scope: 'Checked-in top-five-league templates, community-pack precedence; excludes runtime fillers and save changes',
  leagues,
  totalTemplates: all.length,
  uniqueIds: groups.size,
  duplicateIds: [...groups].filter(([, rows]) => rows.length > 1).map(([id, rows]) => ({
    id, entries: rows.map((p) => ({ club: p.clubId, name: `${p.fn} ${p.ln}` })),
  })),
}, null, 2));
