import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = 'artifacts/team-crest-rollout';
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, 'utf8'));
const read = file => {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
};
const files = [...fs.readFileSync('src/data/leagues/index.ts', 'utf8').matchAll(/from '\.\/([^']+)'/g)].map(m => m[1]);
const clubs = files.flatMap(f => read(`src/data/leagues/${f}.ts`).CLUBS);
const { TEAM_CRESTS } = read('src/data/teamCrests.ts');
const ids = new Set(clubs.map(c => c.id));
const records = new Map(manifest.clubs.map(c => [c.id, c]));
const errors = [];
if (ids.size !== clubs.length || records.size !== manifest.clubs.length) errors.push('Duplicate IDs');
for (const c of clubs) {
  const entry = records.get(c.id);
  if (!entry) { errors.push(`Missing inventory: ${c.id}`); continue; }
  if (entry.name !== c.name || entry.color !== c.color || entry.secondaryColor !== c.secondaryColor) errors.push(`Identity or palette changed: ${c.id}`);
  const src = TEAM_CRESTS[c.id];
  if (src && (!fs.existsSync(`public${src}`) || entry.runtime !== src)) errors.push(`Missing or mismatched runtime file: ${c.id}`);
}
for (const id of Object.keys(TEAM_CRESTS)) if (!ids.has(id)) errors.push(`Unknown catalog ID: ${id}`);
const pending = clubs.filter(c => !TEAM_CRESTS[c.id]).map(c => c.id);
if (process.argv.includes('--complete') && pending.length) errors.push(`${pending.length} clubs still lack integrated crests`);
const bytes = Object.values(TEAM_CRESTS).reduce((n, src) => n + (fs.existsSync(`public${src}`) ? fs.statSync(`public${src}`).size : 0), 0);
const result = { total: clubs.length, integrated: Object.keys(TEAM_CRESTS).length, pending, bytes, errors };
fs.writeFileSync(`${root}/audit.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, pending: pending.length }));
if (errors.length) process.exitCode = 1;
