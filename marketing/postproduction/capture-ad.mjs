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
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const DIR = process.argv[2];
const URL = process.argv[3];
const SLOW = Number(process.argv[4] || 4);
const PLAN = process.argv[5] || 'pack';
mkdirSync(DIR, { recursive: true });

// Device pixel ratio of the capture. 2 is the phone's own ratio and gives a
// 780x1688 frame — fine for a full-frame shot, but the App Preview is 886 wide
// and an edit that punches in on a single card is then upscaling past 1:1 and
// showing render pixels. CAP_SCALE=3 gives 1170x2532, which is 1.3x the
// delivery width and leaves real room to crop into a card or a number.
const SCALE = Number(process.env.CAP_SCALE || 2);
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [`--force-device-scale-factor=${SCALE}`],
});
// deviceScaleFactor matters for `page.screenshot` (the still plan): the
// launch-arg forced factor reaches the screencast but not screenshots.
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE, hasTouch: true });

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

// ── Flags come from disk, not from luck ──
// FlagIcon loads from flagcdn.com, and through this container's proxy that
// host resets transiently. In-page retries and preloads only shrink the
// window — a take can still catch a blank flag, and did. So the rig
// intercepts every flag request and serves it from a persistent disk cache
// (.cache/flags), fetching each file once via node with its own retries.
// After the first success a flag never touches the network again, and every
// take is deterministic.
const FLAG_CACHE = join(process.cwd(), '.cache', 'flags');
mkdirSync(FLAG_CACHE, { recursive: true });
await page.route('https://flagcdn.com/**', async route => {
  // NB: this script's own `URL` argv binding shadows the global constructor,
  // so parse the path textually.
  const href = route.request().url();
  const path = href.split('flagcdn.com')[1] || '/unknown.png';
  const file = join(FLAG_CACHE, path.replace(/\//g, '_'));
  if (!existsSync(file)) {
    // curl, not node fetch: node's fetch only honours HTTPS_PROXY when the
    // process starts with NODE_USE_ENV_PROXY=1, and this environment's
    // egress requires the proxy — fetch here fails silently while curl
    // succeeds. Retried because the upstream host resets transiently.
    for (let i = 0; i < 5 && !existsSync(file); i++) {
      try { execFileSync('curl', ['-sf', '--max-time', '10', '-o', file, href]); } catch { /* retry */ }
      if (!existsSync(file)) await new Promise(res => setTimeout(res, 500));
    }
  }
  if (existsSync(file)) await route.fulfill({ body: readFileSync(file), contentType: 'image/png' });
  else await route.abort(); // FlagIcon's own fallback handles it — same as today, never worse
});
page.on('pageerror', e => console.log('PAGE ERR:', String(e).slice(0, 200)));
page.on('console', m => { const t = m.text(); if (t.startsWith('[capture]') || m.type() === 'error') console.log('[page]', t.slice(0, 160)); });
await page.goto(URL, { waitUntil: 'networkidle' });
// Pre-roll before the screencast starts, so the scene has mounted and is not
// mid-layout on frame 1. The single-card Legends pack is the exception: it
// auto-plays its rip and walkout the moment it mounts, with no tap, so a 6s
// pre-roll swallows the entire animation and the take opens on the summary
// card. Start recording almost immediately there and trim the blank lead-in
// at encode time instead.
await page.waitForTimeout((PLAN === 'icon' ? 120 : 1500) * SLOW);

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

if (PLAN === 'preview') {
  // App Store App Preview take. Differences from the ad plan are all Apple
  // rules: 15-30s required length, pure app footage (the harness URL must
  // pass NO caption params), and the first ~4s autoplay muted in search
  // results — so the take opens on the sealed packet for a beat before the
  // rip, which is the strongest silent opener the app has.
  await wait(1400);
  for (let i = 0; i < 8; i++) {
    if (await page.getByText('TAP ALL TO REVEAL').count()) break;
    await tap(195, 422); await wait(750);
  }
  await wait(1200);
  // Reveal one at a time with room to breathe — a store visitor is judging
  // the app, not chasing a hook, so the pacing is calmer than the ad cut.
  for (const [x, y] of [[113, 150], [276, 150], [113, 392], [276, 392]]) {
    await tap(x, y); await wait(1050);
  }
  await wait(500);
  await tap(195, 620);
  // Ride the full walkout, then hold the summary long enough for the total
  // to clear Apple's 15s floor with margin.
  await wait(10500);
}

if (PLAN === 'icon') {
  // Single-card Legends take. The 5-card packs deal four unknowns beside the
  // hero — forcing every card above 84 succeeds 0.8% of the time and still
  // deals Tapsoba and Burkardt, because rating is not fame. The Icon tier
  // deals ONE card at a guaranteed 88+, and the whole 88+ band is Salah,
  // Mbappe, Bellingham, Haaland. One card, every name a household name.
  //
  // NO TAPS. A one-card pack rips and walks out on its own as soon as it
  // mounts; the blind tap loop the 5-card plans use skipped straight past the
  // walkout to the summary. Just hold and let it play.
  await wait(9000);
}

if (PLAN === 'squad') {
  // The lineup board: your XI of real stars. Held, not driven — the beat
  // exists to say "this is a management game", and a cursor jumping around
  // the pitch reads as a demo rather than a game.
  await wait(2500);
  // One considered tap on a starter opens the detail sheet, which is where
  // the card art and the rating actually read at phone size.
  await tap(195, 300); await wait(3000);
  await tap(195, 300); await wait(2500);
}

if (PLAN === 'tall') {
  // One FULL-PAGE screenshot, for shots that pan rather than animate.
  // Scrolling in the browser under time dilation yields one repaint per
  // discrete jump — measured at 7.7fps, which judders at 60. Panning a tall
  // still in the encoder is perfectly smooth at any frame rate, the same
  // reason `still` exists for push-ins.
  await wait(15000);
  const mounted = await page.evaluate(() => document.body.innerText.length > 200);
  if (!mounted) console.error('[capture] tall: scene did not mount');
  // Walk the whole page before shooting. A fullPage screenshot does NOT
  // trigger lazy loading, so card art below the fold stayed unloaded and
  // rendered as black cards in the lower half of the pan.
  const pageH = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollHeight);
  for (let y = 0; y < pageH; y += 700) {
    await page.evaluate(v => {
      const sc = document.scrollingElement || document.documentElement;
      sc.scrollTop = v;
      document.querySelectorAll('*').forEach(el => {
        if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = v;
      });
    }, y);
    await wait(160);
  }
  await page.evaluate(() => {
    const sc = document.scrollingElement || document.documentElement;
    sc.scrollTop = 0;
    document.querySelectorAll('*').forEach(el => { if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = 0; });
  });
  // Let every warmed image decode before the frame is taken.
  await page.evaluate(() => Promise.all(
    [...document.images].filter(i => !i.complete).map(i => i.decode().catch(() => {})),
  ));
  await wait(1500);
  await page.screenshot({ path: `${DIR}/tall.png`, fullPage: true });
  console.log('tall ->', `${DIR}/tall.png`);
  await b.close();
  process.exit(0);
}

if (PLAN === 'grid') {
  // A slow scroll down the squad grid. Better than a push-in on a still: the
  // cards are the content, and scrolling shows eight of them instead of two.
  // Driven from here in small steps rather than by CSS smooth-scroll, because
  // the page clock is dilated and a scroll animation would stretch with it.
  const startY = Number((URL.match(/[?&]scroll=(\d+)/) || [])[1] || 560);
  await page.evaluate(y => {
    const sc = document.scrollingElement || document.documentElement;
    sc.scrollTop = y;
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = y;
    });
  }, startY);
  await wait(1200);
  for (let i = 0; i < 44; i++) {
    await page.evaluate(dy => {
      const sc = document.scrollingElement || document.documentElement;
      sc.scrollTop += dy;
      document.querySelectorAll('*').forEach(el => {
        if (el.scrollHeight > el.clientHeight + 40) el.scrollTop += dy;
      });
    }, 26);
    await wait(105);
  }
  await wait(900);
}

if (PLAN === 'still') {
  // Single full-quality frame, no screencast — the source for encoder-side
  // motion (a zoompan push-in beats a screencast of a static page, whose
  // compositor emits a handful of frames and steps visibly at 60fps).
  // The transfer scene loads the lazy player pool and retries flaky flag
  // loads before mounting — give it real headroom, then confirm the scene
  // actually mounted rather than shipping a frame of empty backdrop.
  await wait(15000);
  // Scroll past page chrome when the URL asks for it — a squad grid's cards
  // start well below the header, filters and advice banners.
  const scrollTo = Number((URL.match(/[?&]scroll=(\d+)/) || [])[1] || 0);
  if (scrollTo) {
    await page.evaluate(y => {
      const sc = document.scrollingElement || document.documentElement;
      sc.scrollTop = y;
      document.querySelectorAll('*').forEach(el => {
        if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = y;
      });
    }, scrollTo);
    await wait(700);
  }
  const mounted = await page.evaluate(() => document.body.innerText.length > 200);
  if (!mounted) console.error('[capture] still: scene did not mount — frame is likely empty');
  await page.screenshot({ path: `${DIR}/still.png` });
  console.log('still ->', `${DIR}/still.png`);
  await b.close();
  process.exit(0);
}

if (PLAN === 'transfer') {
  // One continuous tension-frozen shot — the POV text-wall formula. The
  // negotiation modal's entrance plays in luxurious slow motion under the
  // dilation, then the shot just holds; the text does the storytelling.
  await wait(11000);
}

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
  await wait(15000);
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
