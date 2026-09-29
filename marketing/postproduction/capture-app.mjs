/**
 * Capture rig for the REAL APP (not the ad harness).
 *
 *   node marketing/postproduction/capture-app.mjs <scene.mjs> <outDir> [--dry]
 *
 * `capture-ad.mjs` films components mounted in `capture.html`. That covers the
 * pack walkout, but not a season: the Road to Glory, Pack Luck and Sunday
 * League series need a real save moving through real weeks. This rig drives
 * `index.html` itself, with the game state set through the SAME store modules
 * the app runs (Vite dev serves `/src/store/gameStore.ts`, and a dynamic
 * import of that URL returns the app's own instance). Nothing is mocked:
 * matches are simulated by the engine, packs are rolled by the generator.
 *
 * A scene module exports:
 *   profile   — name of the persistent browser profile (saves carry across
 *               scenes that share it, e.g. every Road to Glory episode)
 *   setup(h)  — un-recorded: start a save, sim weeks, set streaks. Runs at
 *               real speed.
 *   shoot(h)  — recorded: navigate, tap, caption. Runs under time dilation.
 *
 * Output is the same frame dump as capture-ad (`f00000.jpg` + `times.json`),
 * so `encode-ad.mjs` encodes it unchanged. The viewport is 390x693 — exactly
 * 9:16 — so the encoder's centre crop removes nothing and the app's top bar
 * survives (the ad harness uses 390x844 and loses ~75px top and bottom).
 *
 * Needs `npm run dev -- --host 127.0.0.1` (port 8080, or APP_URL=...).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const [SCENE_PATH, OUT_DIR] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
if (!SCENE_PATH || !OUT_DIR) {
  console.error('usage: capture-app.mjs <scene.mjs> <outDir> [--dry]');
  process.exit(1);
}
const APP = process.env.APP_URL || 'http://127.0.0.1:8080';
const SLOW = Number(process.env.SLOW || 3);
// 1080/390: the screencast then delivers 1080x1920 directly, no upscale.
const SCALE = Number(process.env.CAP_SCALE || 1080 / 390);

const scene = await import(pathToFileURL(resolve(SCENE_PATH)).href);
mkdirSync(OUT_DIR, { recursive: true });
const profileDir = join(process.cwd(), '.cache', 'profiles', scene.profile || 'default');
if (scene.fresh) rmSync(profileDir, { recursive: true, force: true });
mkdirSync(profileDir, { recursive: true });

const ctx = await chromium.launchPersistentContext(profileDir, {
  // The pinned path is the Linux capture rig's; CHROME_PATH overrides it, and
  // elsewhere Playwright's own bundled Chromium is used.
  executablePath: process.env.CHROME_PATH
    || (process.platform === 'linux' ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined),
  args: [`--force-device-scale-factor=${SCALE}`],
  viewport: { width: 390, height: 693 },
  deviceScaleFactor: SCALE,
  hasTouch: true,
  isMobile: true,
});

// Variable-rate virtual clock. Setup runs at 1x (a season of sims must not
// crawl), the take runs at 1/SLOW. Continuity is kept across rate changes so
// no animation sees time jump backwards.
await ctx.addInitScript(`(() => {
  const realNow = performance.now.bind(performance);
  let k = 1, r0 = realNow(), v0 = r0;
  const vnow = () => v0 + (realNow() - r0) / k;
  const d0 = Date.now(), p0 = realNow();
  performance.now = vnow;
  Date.now = () => d0 + (vnow() - p0);
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (fn, d, ...a) => st(fn, (d || 0) * k, ...a);
  window.setInterval = (fn, d, ...a) => si(fn, (d || 0) * k, ...a);
  window.__setSlow = (next) => { v0 = vnow(); r0 = realNow(); k = next; };
})()`);

const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGE ERR:', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) console.log('[page]', m.text().slice(0, 160)); });
page.on('requestfailed', r => { if (process.env.DEBUG_REQ) console.log('[req failed]', r.url().slice(0, 140)); });
// Flags come from an external CDN that resets through this container's proxy.
// Same disk cache as capture-ad (.cache/flags), fetched once with curl.
const FLAG_CACHE = join(process.cwd(), '.cache', 'flags');
mkdirSync(FLAG_CACHE, { recursive: true });
await page.route('https://flagcdn.com/**', async route => {
  const href = route.request().url();
  const file = join(FLAG_CACHE, (href.split('flagcdn.com')[1] || '/x.png').replace(/\//g, '_'));
  for (let i = 0; i < 4 && !existsSync(file); i++) {
    try { execFileSync('curl', ['-sf', '--max-time', '10', '-o', file, href]); } catch { /* retry */ }
  }
  if (existsSync(file)) await route.fulfill({ body: readFileSync(file), contentType: 'image/png' });
  else await route.abort();
});

let slow = 1;
let cdp = null;
const frames = [];
/** Page-time seconds of named beats in the take (drop, flips, ...), written to
 *  marks.json so the score can hit them. */
const marks = {};
let recStart = 0;

/** Helpers handed to the scene. */
const h = {
  APP,
  page,
  /** Real-time-scaled wait, in PAGE milliseconds. */
  wait: ms => page.waitForTimeout(ms * slow),
  /** Run `fn(store, persistence, extra)` inside the page with the app's own
   *  store instance. `fn` is serialised — pass data through `arg`. */
  store: (fn, arg) => page.evaluate(async ([src, a]) => {
    const { useGameStore } = await import('/src/store/gameStore.ts');
    const persistence = await import('/src/store/helpers/persistence.ts');
    const f = new Function('return (' + src + ')')();
    return f(useGameStore, persistence, a);
  }, [fn.toString(), arg]),
  /** Import any app module by path, e.g. h.mod('/src/utils/packs.ts'). */
  go: async (hash) => {
    await page.goto(`${APP}/${hash}`, { waitUntil: 'networkidle' });
  },
  screen: (id) => h.store((s, _p, a) => s.getState().setScreen(a), id),
  /** Caption overlay drawn in the DOM, in the app's own font. `pos` is
   *  top | mid | low. Pass '' to clear. `|` breaks lines. */
  caption: (text, pos = 'top', opts = {}) => page.evaluate(([t, p, o]) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      document.body.appendChild(el);
    }
    const top = p === 'top' ? '9%' : p === 'mid' ? '40%' : '70%';
    el.style.cssText = `position:fixed;left:6%;right:6%;top:${top};z-index:2147483647;`
      + 'pointer-events:none;text-align:center;';
    el.innerHTML = t ? t.split('|').map(line =>
      `<div style="display:inline-block;margin:3px 0;padding:6px 12px;border-radius:10px;`
      + `background:${o.bg || 'rgba(8,11,18,.86)'};color:${o.color || '#fff'};`
      + `font-family:Oswald,system-ui,sans-serif;font-weight:700;letter-spacing:.02em;`
      + `font-size:${o.size || 27}px;line-height:1.12;text-transform:uppercase;`
      + `box-shadow:0 4px 18px rgba(0,0,0,.5)">${line}</div>`).join('<br>') : '';
  }, [text, pos, opts]),
  tapText: async (text, opts = {}) => {
    const loc = page.getByText(text, { exact: !!opts.exact }).first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.tap({ timeout: opts.timeout || 8000 * slow });
  },
  tap: (x, y) => page.touchscreen.tap(x, y),
  /** Smooth scroll by `dy` CSS px over `ms` page-ms, in small steps. */
  scroll: async (dy, ms = 1200, steps = 30) => {
    for (let i = 0; i < steps; i++) {
      await page.evaluate(d => {
        const els = [document.scrollingElement, ...document.querySelectorAll('main, [data-scroll], .overflow-y-auto')];
        for (const el of els) if (el && el.scrollHeight > el.clientHeight + 40) el.scrollTop += d;
      }, dy / steps);
      await h.wait(ms / steps);
    }
  },
  /** Wait until every <img> on the page has decoded. */
  settleImages: () => page.evaluate(() => Promise.race([
    Promise.all([...document.images].filter(i => !i.complete).map(i => i.decode().catch(() => {}))),
    new Promise(r => setTimeout(r, 4000)),
  ])),
  still: async (file) => {
    await h.settleImages();
    await page.screenshot({ path: file });
    console.log('still ->', file);
  },
  /** Record a named beat at the current page time (seconds into the take). */
  mark: (name) => {
    if (!recStart) return;
    const t = (Date.now() - recStart) / 1000 / SLOW;
    (marks[name] ||= []).push(+t.toFixed(3));
  },
  record: async () => {
    if (DRY) return;
    slow = SLOW;
    await page.evaluate(k => window.__setSlow(k), SLOW);
    cdp = await ctx.newCDPSession(page);
    await cdp.send('Animation.enable').catch(() => {});
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW }).catch(() => {});
    cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
      frames.push({ data, ts: metadata.timestamp });
      try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* closed */ }
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
    recStart = Date.now();
  },
  stop: async () => {
    if (!cdp) return;
    await cdp.send('Page.stopScreencast');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }).catch(() => {});
    await page.evaluate(() => window.__setSlow(1));
    slow = 1;
    cdp = null;
  },
};

console.log('[rig] loading app');
await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
console.log('[rig] app loaded');
if (scene.setup) await scene.setup(h);
if (scene.shoot) {
  await h.record();
  await scene.shoot(h);
  await h.stop();
}
if (frames.length) {
  const t0 = frames[0].ts;
  frames.forEach((f, i) => writeFileSync(join(OUT_DIR, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64')));
  writeFileSync(join(OUT_DIR, 'times.json'), JSON.stringify(frames.map(f => +((f.ts - t0) / SLOW).toFixed(4))));
  writeFileSync(join(OUT_DIR, 'marks.json'), JSON.stringify(marks));
  const span = (frames[frames.length - 1].ts - t0) / SLOW;
  console.log(`${frames.length} frames / ${span.toFixed(2)}s page-time = ${(frames.length / span).toFixed(1)} fps`);
}
await ctx.close();
