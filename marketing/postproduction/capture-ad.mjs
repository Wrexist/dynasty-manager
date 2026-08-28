/**
 * Marketing capture rig.
 *
 * The container's screencast encoder tops out around 28fps at 2x resolution,
 * so real-time capture cannot produce a true 60fps 1080p asset. Instead the
 * page is slowed down: `performance.now`/`Date.now` are scaled, JS timers are
 * stretched, and the CDP Animation domain playback rate is dropped by the same
 * factor. 28 real frames/sec of a page running at 1/SLOW speed is 28*SLOW
 * frames/sec of page time, which is resampled to an exact 60fps timeline
 * afterwards. Every frame is genuinely rendered — nothing is duplicated.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const DIR = process.argv[2];
const URL = process.argv[3];
const SLOW = Number(process.argv[4] || 4);
const PLAN = process.argv[5] || 'pack';
mkdirSync(DIR, { recursive: true });

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--force-device-scale-factor=2'],
});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.addInitScript(`(() => {
  const SLOW = ${SLOW};
  const t0 = performance.now();
  const realNow = performance.now.bind(performance);
  // Virtual clock: page time advances at 1/SLOW of wall time.
  performance.now = () => t0 + (realNow() - t0) / SLOW;
  const dateT0 = Date.now();
  const RealDate = Date;
  Date.now = () => dateT0 + (realNow() - t0) / SLOW;
  // Timer-driven phase changes (the pack overlay schedules its phases with
  // setTimeout) must stretch by the same factor or they fire early relative
  // to the animations they are meant to bracket.
  const st = window.setTimeout.bind(window);
  const si = window.setInterval.bind(window);
  window.setTimeout = (fn, d, ...a) => st(fn, (d || 0) * SLOW, ...a);
  window.setInterval = (fn, d, ...a) => si(fn, (d || 0) * SLOW, ...a);
  void RealDate;
})()`);

const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE ERR:', String(e).slice(0, 200)));
page.on('console', m => { if (m.text().startsWith('[capture]')) console.log(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500 * SLOW);

const cdp = await ctx.newCDPSession(page);
// CSS keyframes/transitions run on the compositor clock, which the JS patch
// above cannot reach — the Animation domain is what slows those.
await cdp.send('Animation.enable').catch(() => {});
await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW }).catch(() => {});

const frames = [];
cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
  frames.push({ data, ts: metadata.timestamp });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch (e) { void e; }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
// Zero the harness's caption clock to the start of the take, so caption
// timings are expressed in the same seconds the finished file uses.
await page.evaluate(() => (window).__adClockStart?.());

const wait = ms => page.waitForTimeout(ms * SLOW);
const tap = async (x, y) => { await page.mouse.click(x, y); };

if (PLAN === 'pack') {
  // Rip the packet, then reveal the ordinary cards before the legend so the
  // walkout is the closing beat.
  for (let i = 0; i < 8; i++) {
    if (await page.getByText('TAP ALL TO REVEAL').count()) break;
    await tap(195, 422); await wait(700);
  }
  await wait(900);
  for (const [x, y] of [[113, 150], [276, 150], [113, 392], [276, 392]]) {
    await tap(x, y); await wait(700);
  }
  await wait(400);
  await tap(195, 620);
  await wait(9000);
}

await cdp.send('Page.stopScreencast');
const t0 = frames.length ? frames[0].ts : 0;
// Timestamps are wall-clock; divide by SLOW to get the page-time timeline the
// animations were authored against.
frames.forEach((f, i) => writeFileSync(`${DIR}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64')));
writeFileSync(`${DIR}/times.json`, JSON.stringify(frames.map(f => +((f.ts - t0) / SLOW).toFixed(4))));
const span = frames.length ? (frames[frames.length - 1].ts - t0) / SLOW : 0;
console.log(`${frames.length} frames / ${span.toFixed(2)}s page-time = ${(frames.length / span).toFixed(1)} effective fps`);
await b.close();
