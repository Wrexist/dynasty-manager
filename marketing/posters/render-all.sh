#!/usr/bin/env bash
#
# render-all.sh — Batch-render every poster-*.html to PNG at 1080×1920.
#
# Uses Playwright's bundled Chromium for deterministic, high-DPI rendering.
# Cleaner than puppeteer for one-off scripts and Playwright is already a
# transitive dep elsewhere in this repo via the icons scraper.
#
# Usage:
#   bash marketing/posters/render-all.sh
#
# Output:
#   marketing/posters/dist/poster-*.png  (1080×1920)
#
# Tip: PNGs are good enough for Meta Ads Manager / TikTok static
# uploads. If you need 2x retina, edit RENDER_SCALE below to 2.

set -euo pipefail

cd "$(dirname "$0")"
mkdir -p dist

RENDER_SCALE=1   # bump to 2 for retina

command -v npx >/dev/null 2>&1 || {
  echo "ERROR: npx not found. Install Node.js." >&2
  exit 1
}

# Inline Node script — uses Playwright (npm install playwright if first run,
# or it'll auto-install via npx).
exec npx --yes playwright@latest -- node -e "
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCALE = $RENDER_SCALE;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: SCALE,
  });
  const page = await ctx.newPage();

  const files = fs.readdirSync('.').filter(f => /^poster-\\d+.*\\.html$/.test(f)).sort();
  console.log('Rendering ' + files.length + ' posters at scale ' + SCALE + 'x...');

  for (const f of files) {
    const inUrl = 'file://' + path.resolve(f);
    const outPng = 'dist/' + f.replace(/\\.html$/, '.png');
    await page.goto(inUrl, { waitUntil: 'networkidle' });
    // Give web fonts an extra moment to settle.
    await page.waitForTimeout(500);
    await page.screenshot({
      path: outPng,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
    });
    console.log('  → ' + outPng);
  }

  await browser.close();
  console.log('✅ Done. Outputs in marketing/posters/dist/');
})();
"
