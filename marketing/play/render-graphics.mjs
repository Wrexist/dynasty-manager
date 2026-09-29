#!/usr/bin/env node
/**
 * Render the Google Play graphics from HTML templates.
 *
 *   node marketing/play/render-graphics.mjs
 *
 * - feature.html          -> graphics/feature-1024x500.png
 * - shot.html × SHOTS     -> graphics/phone-0N.png (1080x1920, 9:16 — Play
 *                            rejects a long side over 2x the short side, which
 *                            is why the 1242x2688 App Store set cannot be reused)
 *
 * The app captures the shots frame are produced by
 * `capture-app.mjs marketing/postproduction/scenes/play-screens.mjs <dir>`
 * into graphics/raw/. Nothing here needs the dev server.
 */
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const G = join(HERE, 'graphics');

/** Order is the store order: the first two are all most visitors see. */
export const SHOTS = [
  { raw: 'pack.png', cap: 'Open *real player* packs', sub: 'Three free packs every day' },
  { raw: 'match.png', cap: 'Every minute. *Your call.*', sub: 'Live subs, team talks, tactics' },
  { raw: 'tactics.png', cap: 'Pick *your XI*', sub: 'Ten formations, your instructions' },
  { raw: 'table.png', cap: '*756 real clubs*', sub: '45 leagues, promotion and relegation' },
  { raw: 'transfers.png', cap: 'Work the *window*', sub: 'Bids, counters, contracts, wages' },
  { raw: 'sunday.png', cap: 'Or run a *Sunday League* side', sub: 'Nine turned up. Kit money\'s gone.' },
  { raw: 'dashboard.png', cap: '*No energy.* No timers.', sub: 'Play as long as you want' },
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const feature = await b.newPage({ viewport: { width: 1024, height: 500 } });
await feature.goto(pathToFileURL(join(G, 'feature.html')).href, { waitUntil: 'networkidle' });
await feature.evaluate(() => document.fonts.ready);
await feature.screenshot({ path: join(G, 'feature-1024x500.png') });
console.log('feature-1024x500.png');

const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
let n = 0;
for (const s of SHOTS) {
  if (!existsSync(join(G, 'raw', s.raw))) { console.warn('missing raw capture', s.raw); continue; }
  n++;
  const q = new URLSearchParams({ img: `raw/${s.raw}`, cap: s.cap, sub: s.sub });
  await page.goto(`${pathToFileURL(join(G, 'shot.html')).href}?${q}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(G, `phone-0${n}.png`) });
  console.log(`phone-0${n}.png  <- ${s.raw}`);
}
await b.close();
