#!/usr/bin/env bash
#
# render-all.sh — Batch-render every poster-*.html to PNG at 1080×1920.
#
# Uses the already-installed Playwright (a project dependency, see
# package.json) — not @latest from the network. Browsers are downloaded
# once via `npm run scrape:icons:setup` (which is `playwright install
# chromium`); rerunning this script reuses the cached binary.
#
# Usage:
#   bash marketing/posters/render-all.sh
#
# Output:
#   marketing/posters/dist/poster-*.png  (1080×1920)
#
# Tips:
#   - Bump RENDER_SCALE to 2 for retina (2160×3840) PNGs.
#   - To render to mp4 instead of PNG (animations preserved), use
#     `--video` and ffmpeg with the resulting webm output.

set -euo pipefail

cd "$(dirname "$0")"
mkdir -p dist

RENDER_SCALE=1   # bump to 2 for retina

# Resolve repo root so we can require Playwright from node_modules.
REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)

# Ensure Playwright + Chromium are available. If Playwright isn't installed
# we can't proceed; if the browser binary isn't downloaded we fetch it.
if [[ ! -d "$REPO_ROOT/node_modules/playwright" ]]; then
  echo "ERROR: Playwright not installed. Run \`npm install\` in repo root." >&2
  exit 1
fi
if [[ ! -d "$HOME/.cache/ms-playwright" && ! -d "/root/.cache/ms-playwright" ]]; then
  echo "Downloading Chromium for Playwright (~150MB, one-time)..."
  (cd "$REPO_ROOT" && npx playwright install chromium)
fi

# Write the renderer to a temp file (cleaner than passing a multi-line script
# through node -e, which mangles quoting on some shells).
SCRIPT=$(mktemp -t render-posters-XXXX.mjs)
trap 'rm -f "$SCRIPT"' EXIT

cat > "$SCRIPT" <<'NODE'
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCALE = Number(process.env.RENDER_SCALE || 1);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: SCALE,
});
const page = await ctx.newPage();

const files = readdirSync('.')
  .filter((f) => /^poster-\d+.*\.html$/.test(f))
  .sort();

console.log(`Rendering ${files.length} posters at scale ${SCALE}x...`);

for (const f of files) {
  const url = pathToFileURL(resolve(f)).href;
  const out = `dist/${f.replace(/\.html$/, '.png')}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  // Allow web fonts + entrance animations to settle into their final frame.
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: out,
    clip: { x: 0, y: 0, width: 1080, height: 1920 },
  });
  console.log(`  → ${out}`);
}

await browser.close();
console.log('✅ Done. Outputs in marketing/posters/dist/');
NODE

RENDER_SCALE="$RENDER_SCALE" node --experimental-vm-modules "$SCRIPT"
