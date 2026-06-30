/*
 * capture.mjs — drive the running app and screenshot real in-game screens
 * into dist/cap-*.png (628×1308 @2x), which gen.mjs frames into the final
 * App Store screenshots.
 *
 * Prereqs:
 *   1. Dev server running on 127.0.0.1:8080:
 *        npx vite --host 127.0.0.1 --port 8080
 *   2. Playwright + a Chromium available (CHROME env overrides the path).
 *
 * Run:  node marketing/app-store/capture.mjs
 *
 * It starts a new Sandbox save (England → Premier League → Arsenal, real
 * players enabled), then visits each feature screen. The community-pack
 * import on first launch takes ~60–90s — be patient.
 */
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:8080/#/';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CAP = process.env.CAP_DIR || 'marketing/app-store/dist'; // output dir, relative to repo root

const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 628, height: 1308 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

const shot = async (n) => { await p.waitForTimeout(900); await p.screenshot({ path: `${CAP}/cap-${n}.png` }); console.log('  ✓', n); };
const clk = async (t, exact = false, to = 1500) => { try { await p.getByText(t, { exact }).first().click({ timeout: to }); return true; } catch { return false; } };
const dismiss = async () => { await p.keyboard.press('Escape').catch(() => {}); await p.locator('[aria-label*="lose" i]').first().click({ timeout: 500 }).catch(() => {}); await clk('Maybe later', false, 500); await clk('Not now', false, 500); };
const bottom = async (label) => { await dismiss(); await p.getByRole('button', { name: label, exact: true }).first().click({ timeout: 2500 }).catch(async () => { await clk(label, true, 1500); }); await p.waitForTimeout(900); };
const more = async (item) => { await bottom('More'); await p.waitForTimeout(400); await clk(item, true, 1800); await p.waitForTimeout(900); };

// ── New game: Sandbox · England · Premier League · Arsenal · real players ──
await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await clk('No thanks');
await clk('New Game'); await p.waitForTimeout(700);
await clk('Enable Real Players'); await p.waitForTimeout(1500);
await p.getByLabel('Close paywall').click({ timeout: 5000 }).catch(() => {});
await clk('Sandbox Mode'); await p.waitForTimeout(1200);
await shot('nation');                                   // FUT cards by nation
await clk('England'); await p.waitForTimeout(600);
await clk('League', true); await p.waitForTimeout(700);
await clk('Premier League'); await p.waitForTimeout(600);
await clk('Club', true); await p.waitForTimeout(800);
await shot('clubs');                                    // club picker
await clk('Arsenal'); await p.waitForTimeout(900);
await clk('Begin');
try { await p.getByText('Loading community pack', { exact: false }).waitFor({ state: 'detached', timeout: 90000 }); } catch {}
await p.waitForTimeout(2500); await clk('Skip'); await p.waitForTimeout(600); await dismiss();

// ── In-game feature screens ──
await p.mouse.wheel(0, 700); await shot('dashboard');
await bottom('Squad'); await dismiss(); await shot('squad');
await clk('Training', true, 1800); await shot('training');
await bottom('Squad'); await clk('Youth', true, 1800); await shot('youth');
await bottom('Tactics'); await dismiss(); await shot('tactics');
await bottom('Market'); await dismiss(); await shot('transfers');
await clk('Packs', true, 1800); await shot('packs');
await more('League'); await shot('league');
await more('National Team'); await shot('national');

// ── Live match (kick off, then capture mid-match) ──
await bottom('Home'); await dismiss();
await clk('Match Prep', false, 2500); await p.waitForTimeout(1200); await dismiss();
await clk('Ready to Play', false, 3000); await p.waitForTimeout(1800); await dismiss();
await clk('Fast', true, 1500);
await p.getByRole('button', { name: /kick off/i }).first().click({ timeout: 3000 }).catch(() => {});
for (let i = 0; i < 24; i++) {
  await p.waitForTimeout(1200);
  const min = await p.evaluate(() => { const m = document.body.innerText.match(/(\d{1,2})['’]/); return m ? +m[1] : 0; });
  if (min >= 8) { await shot('live'); break; }
}

await b.close();
console.log('Done. Next: node marketing/app-store/gen.mjs && bash marketing/app-store/render-all.sh');
