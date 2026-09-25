import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = 'artifacts/team-crest-rollout';
const { clubs } = JSON.parse(fs.readFileSync(`${root}/manifest.json`, 'utf8'));
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const ready = clubs.filter(c => c.runtime && fs.existsSync(`public${c.runtime}`));
const cards = ready.map(c => {
  const mime = c.runtime.endsWith('.svg') ? 'image/svg+xml' : 'image/webp';
  const image = `data:${mime};base64,${fs.readFileSync(`public${c.runtime}`).toString('base64')}`;
  return `<article data-search="${escape(`${c.name} ${c.league}`.toLowerCase())}"><img width="144" height="144" src="${image}" alt="${escape(c.name)}"><h2>${escape(c.name)}</h2><small>${escape(c.league)} · ${escape(c.id)}</small><div class="sizes">${[24,36,48,64].map(n=>`<img data-mini width="${n}" height="${n}" alt="${n}px">`).join('')}</div></article>`;
});
const style = `*{box-sizing:border-box}body{background:#111827;color:#f0f4fa;font:14px system-ui;margin:0;padding:24px}h1{font-size:26px}header{margin-bottom:24px}button,input{padding:12px;margin-right:12px;border-radius:8px;border:1px solid #54657d}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}article{border:1px solid #435065;border-radius:12px;background:#202c3d;text-align:center;padding:12px}img{object-fit:contain}h2{font-size:14px;margin:8px 0;min-height:34px}small{font-size:10px;color:#9cabbe}.sizes{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px}.light{background:#edf1f7;color:#16243a}.light article{background:white}.light small{color:#46566d}`;
fs.writeFileSync(`${root}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Team crest rollout</title><style>${style}</style><header><h1>Team crests — ${ready.length} / ${clubs.length}</h1><p>Original artwork. Existing team names and palettes. Not a legal clearance report.</p><button onclick="document.body.classList.toggle('light')">Light / dark</button><input placeholder="Search team or league" oninput="document.querySelectorAll('article').forEach(c=>c.hidden=!c.dataset.search.includes(this.value.toLowerCase()))"></header><main class="grid">${cards.join('')}</main><script>document.querySelectorAll('[data-mini]').forEach(i=>i.src=i.closest('article').querySelector('img').src)</script></html>`);
if (process.argv.includes('--screenshots')) {
  fs.mkdirSync(`${root}/review`, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
    for (let i = 0; i < cards.length; i += 24) {
      await page.setContent(`<style>${style}.grid{grid-template-columns:repeat(6,1fr)}.sizes{display:none}article img{width:112px;height:112px}</style><main class="grid">${cards.slice(i,i+24).join('')}</main>`);
      await page.evaluate(() => Promise.all([...document.images].filter(img => img.hasAttribute('src')).map(img => img.decode())));
      await page.screenshot({ path: `${root}/review/${String(i/24+1).padStart(2,'0')}.png`, fullPage: true });
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ reviewedGalleryEntries: ready.length, gallery: pathToFileURL(path.resolve(`${root}/index.html`)).href }));
