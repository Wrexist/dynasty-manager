import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from 'playwright';

const root = 'artifacts/team-crest-rollout/top-teams';
fs.mkdirSync(root, { recursive: true });
const read = file => {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
};
const { TEAM_CRESTS } = read('src/data/teamCrests.ts');
const files = [...fs.readFileSync('src/data/leagues/index.ts', 'utf8').matchAll(/from '\.\/([^']+)'/g)].map(m => m[1]);
const teams = files.map(file => {
  const { CLUBS, LEAGUE_INFO } = read(`src/data/leagues/${file}.ts`);
  const club = [...CLUBS].sort((a, b) => b.squadQuality - a.squadQuality || b.reputation - a.reputation || b.budget - a.budget || a.id.localeCompare(b.id))[0];
  return { id: club.id, name: club.name, rating: club.squadQuality, league: LEAGUE_INFO.name, country: LEAGUE_INFO.country, runtime: TEAM_CRESTS[club.id] };
});
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cards = teams.map(c => `<article><div class="league">${escape(c.country)} · ${escape(c.league)}</div><img src="data:image/svg+xml;base64,${fs.readFileSync(`public${c.runtime}`).toString('base64')}"/><h2>${escape(c.name)}</h2><p>Squad rating ${c.rating}</p></article>`);
const style = `*{box-sizing:border-box}body{background:#101827;color:#f4f7fc;font:15px Arial,sans-serif;margin:0;padding:28px}h1{font-size:27px;margin:0 0 8px}header p{color:#a9bbd3;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}article{background:#1e2b3e;border:1px solid #42536b;border-radius:14px;padding:14px 8px;text-align:center}.league{height:36px;font-size:12px;line-height:17px;color:#b7c7dc}img{width:144px;height:144px;display:block;margin:10px auto}h2{font-size:16px;line-height:20px;min-height:40px;margin:8px 0 0}article p{font-size:12px;color:#9bb0cb;margin:6px 0 0}`;
const document = (subset, title) => `<!doctype html><html lang="en"><meta charset="utf-8"><style>${style}</style><header><h1>${title}</h1><p>Highest squad rating in the game data · Existing team names and colors</p></header><main class="grid">${subset.join('')}</main></html>`;
fs.writeFileSync(`${root}/index.html`, document(cards, 'Top team from every league'));
fs.writeFileSync(`${root}/selection.json`, JSON.stringify({ selection: 'Highest squadQuality; ties: reputation, budget, ID', teams }, null, 2));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1060 }, deviceScaleFactor: 1 });
  for (let i = 0; i < cards.length; i += 15) {
    await page.setContent(document(cards.slice(i, i + 15), `Top team from every league — ${i / 15 + 1} / 3`));
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    await page.screenshot({ path: `${root}/examples-${i / 15 + 1}.png`, fullPage: true });
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ count: teams.length, output: root }));
