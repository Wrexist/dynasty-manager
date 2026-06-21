/**
 * World Cup in-game screenshot capture harness.
 *
 * Drives the running DEV server (npm run dev → http://localhost:8080) to a
 * World Cup game state and captures fresh in-game screens for the App Store
 * marketing panels. Uses the dev-only `window.__dynastyStore` hook (main.tsx)
 * to boot a World Cup directly, then sets `currentScreen` for the static
 * screens and drives MatchDay for the live ones.
 *
 * Output: marketing/world-cup/screens/*.png (780×1688 — iPhone 390×844 @2x),
 * the exact source assets build-appstore.mjs composites.
 *
 * Run (dev server must be up):
 *   VITE_DEV_HOST=127.0.0.1 npm run dev          # in one terminal
 *   WC_BASE=http://127.0.0.1:8080 node scripts/wc-capture.mjs
 *
 * (VITE_DEV_HOST forces an IPv4 bind for IPv6-less sandboxes; omit it on a
 *  normal machine and use the default http://localhost:8080.)
 *
 * Flags render because Noto Color Emoji is installed system-wide (Chromium
 * uses it as the emoji fallback). The script also injects it as an explicit
 * fallback as belt-and-braces.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, '..', 'marketing', 'world-cup', 'screens');
mkdirSync(OUT, { recursive: true });
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.WC_BASE || 'http://localhost:8080';
const NATION = 'Brazil';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Belt-and-braces emoji fallback (system font already provides it).
await page.addInitScript(() => {
  const s = document.createElement('style');
  s.textContent = "@import url('https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap');";
  document.documentElement.prepend(s);
  // Pre-answer the first-launch analytics consent so its modal never covers
  // the captured screens.
  try { localStorage.setItem('dynasty-analytics-consent', 'denied'); } catch { /* ignore */ }
});

// Wait for the dev server + app to boot and expose the store hook.
async function waitForStore() {
  for (let i = 0; i < 60; i++) {
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 5000 });
      const ok = await page.evaluate(() => !!(window).__dynastyStore);
      if (ok) return true;
    } catch { /* server not up yet */ }
    await sleep(1000);
  }
  return false;
}

const shot = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
  await page.screenshot({ path: join(OUT, name) });
  console.log('captured', name);
};

// Set currentScreen via the store and let GameShell re-render.
const goScreen = async (screen) => {
  await page.evaluate((s) => (window).__dynastyStore.getState().setScreen(s), screen);
  await sleep(500);
};

if (!(await waitForStore())) {
  console.error('ERROR: dev server / store hook not reachable at ' + BASE);
  await browser.close();
  process.exit(1);
}

// Boot a World Cup, then route the HashRouter into the game shell.
await page.evaluate((nat) => (window).__dynastyStore.getState().startWorldCup(nat), NATION);
await sleep(400);
await page.evaluate(() => { window.location.hash = '#/game'; });
await sleep(1200);

// Dismiss the first-launch analytics consent modal if it appears.
try {
  await page.getByRole('button', { name: /no thanks/i }).click({ timeout: 4000 });
  await sleep(400);
} catch { /* not shown */ }

// ── Static screens ──
// startWorldCup lands on the group-draw ceremony — capture it first.
await sleep(1400); await shot('09-draw.png');
await goScreen('dashboard'); await shot('01-dashboard.png');
await goScreen('squad');     await shot('02-squad.png');
await goScreen('tactics');   await shot('03-tactics.png');

// ── MatchDay states ──
// Enter the match screen — phase 'pre' shows "Ready to Kick Off?".
await goScreen('match');
await sleep(800);
await shot('04-prematch.png');

const clickByText = async (re, timeout = 3000) => {
  try { await page.getByRole('button', { name: re }).first().click({ timeout }); return true; }
  catch { return false; }
};
// Select the fastest free speed so the minute-by-minute reveal reaches
// half-time quickly, then kick off.
await clickByText(/^fast$/i, 2000);
await clickByText(/kick ?off/i, 5000);

// Let several minutes of events accumulate, then capture a rich live shot.
await sleep(14000);
await shot('07-live-second-half.png');

// Wait for the half-time team-talk screen (the "every call is yours" moment),
// dismissing any key-moment popups by continuing so the sim keeps advancing.
let reachedHalfTime = false;
for (let i = 0; i < 40; i++) {
  const ht = await page.getByText(/half[\s-]?time|team talk|your team talk/i).first().isVisible().catch(() => false);
  if (ht) { reachedHalfTime = true; break; }
  await clickByText(/continue|resume|play on|keep|stay/i, 600);
  await sleep(1000);
}
await sleep(600);
await shot('06-half-time.png');
console.log('reachedHalfTime:', reachedHalfTime);

await browser.close();
console.log('DONE');
