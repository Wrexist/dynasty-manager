/**
 * Standalone "country ribbon" banner — the major footballing nations as a
 * branded World Cup strip. Renders a wide banner usable as a header/footer in
 * any creative. Run: `node marketing/world-cup/build-country-ribbon.mjs`
 */
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NATIONS, flag } from './flags.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'appstore');
mkdirSync(OUT, { recursive: true });
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Two variants: a full 20-nation strip, and a compact "World Cup" titled band.
const variants = [
  { id: 'country-ribbon-full', w: 1290, h: 150, title: null, size: 70 },
  { id: 'country-ribbon-titled', w: 1290, h: 220, title: 'WORLD CUP', size: 58 },
];

function html(v) {
  const flags = NATIONS.map(([, c]) => `<span style="font-size:${v.size}px;line-height:1">${flag(c)}</span>`).join('');
  const titleHtml = v.title ? `<div style="font-family:'Anton';font-size:96px;text-transform:uppercase;letter-spacing:.04em;
      background:linear-gradient(180deg,#fff,#ffd24a);-webkit-background-clip:text;background-clip:text;color:transparent;
      text-align:center;margin-bottom:14px">${v.title}</div>` : '';
  return `<!doctype html><html><head><meta charset="utf8">
  <style>
   @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
   *{margin:0;padding:0;box-sizing:border-box}
   .band{width:${v.w}px;height:${v.h}px;display:flex;flex-direction:column;justify-content:center;
     background:radial-gradient(120% 140% at 50% 0%,#16233f,#0b1322 70%,#070b12);
     border-top:4px solid rgba(242,181,12,.75);border-bottom:4px solid rgba(242,181,12,.5)}
   .flags{display:flex;align-items:center;justify-content:space-around;padding:0 28px}
  </style></head>
  <body><div class="band">${titleHtml}<div class="flags">${flags}</div></div></body></html>`;
}

const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--no-sandbox'] });
for (const v of variants) {
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
  const f = join(OUT, v.id + '.html');
  writeFileSync(f, html(v));
  await page.goto('file://' + f, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, v.id + '.png') });
  await page.close();
  console.log('rendered', v.id, `${v.w}x${v.h}`);
}
await browser.close();
console.log('DONE');
