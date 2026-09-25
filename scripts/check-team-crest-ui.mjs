import fs from 'node:fs';
import { chromium } from 'playwright';

const root = 'artifacts/team-crest-rollout';
fs.mkdirSync(`${root}/review`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const width of [375, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const mode of ['matrix', 'selection']) {
      await page.goto(`http://127.0.0.1:5180/${root}/validation.html${mode === 'selection' ? '?selection' : ''}`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForSelector('img[src*="team-crests"]', { timeout: 120000 });
      await page.locator('img[src*="team-crests"]').evaluateAll(async images => {
        for (const image of images) image.loading = 'eager';
        await Promise.all(images.map(image => image.decode()));
      });
      await page.screenshot({ path: `${root}/review/${mode}-${width}.png`, fullPage: true });
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        crestCount: document.querySelectorAll('img[src*="team-crests"]').length,
        broken: [...document.querySelectorAll('img[src*="team-crests"]')].filter(i => !i.complete || !i.naturalWidth).length,
      }));
      report.push({ mode, width, ...result, errors: [...errors] });
      if (result.overflow || result.broken || errors.length) throw Error(JSON.stringify(report));
    }
    await page.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${root}/ui-validation.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
