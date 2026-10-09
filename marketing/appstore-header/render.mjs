#!/usr/bin/env node
/**
 * Render the App Store "Header and Search Results" creative assets.
 *
 *   node marketing/appstore-header/render.mjs
 *
 * scene.html is a 16:9 stage that cover-fits each viewport, so one scene
 * produces every size App Store Connect accepts (as listed in ASC, 2026-10):
 *   header-5244x2950.png   universal 16:9 — header AND search results
 *   header-3840x1646.png   wide header crop
 *   search-3840x2560.png   3:2 search results
 *   search-1920x1280.png   3:2 search results, small
 * Uses the repo's Playwright and its default Chromium install.
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

// [file, css width, css height, device scale] — css x scale = exact pixels.
const SIZES = [
  ['header-5244x2950.png', 2622, 1475, 2],
  ['header-3840x1646.png', 1920, 823, 2],
  ['search-3840x2560.png', 1920, 1280, 2],
  ['search-1920x1280.png', 1920, 1280, 1],
];

// Big screenshots exceed the default GPU raster budget and come back with
// missing tiles (cards cut off on a straight line); lift the budget.
const browser = await chromium.launch({ args: ['--force-gpu-mem-available-mb=8192', '--disable-gpu-rasterization'] });
for (const [file, width, height, deviceScaleFactor] of SIZES) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor });
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: join(OUT, file) });
  console.log(file);
  await page.close();
}
await browser.close();
