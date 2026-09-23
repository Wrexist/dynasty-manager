import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1800 }, deviceScaleFactor: 1 });
  await page.goto(new URL('./index.html', import.meta.url).href);
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(i => i.decode())));
  const result = await page.locator('img').evaluateAll(imgs => ({
    count: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
  }));
  if (result.count !== 25 || result.loaded !== 25) throw new Error(JSON.stringify(result));
  await page.screenshot({ path: fileURLToPath(new URL('./gallery-preview.png', import.meta.url)), fullPage: true });
  await page.getByRole('button', { name: 'Hide names to judge recognizability' }).click();
  if (await page.locator('body').getAttribute('class') !== 'hide-names') throw new Error('Name toggle failed');
  console.log(JSON.stringify({ ...result, nameToggle: 'passed' }));
} finally {
  await browser.close();
}
