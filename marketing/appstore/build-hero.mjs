/**
 * Dynasty Manager — "hero cluster" App Store screenshots.
 *
 * A second, more immersive screenshot system alongside `build.mjs` (which
 * renders the single-device 3D set). This one is modelled on the layered
 * poster style used by the top-grossing life/management sims: a bold two-line
 * headline with a gradient accent word, a centre hero device flanked by two
 * cropped, perspective-tilted secondary devices, floating gold/glass callout
 * pills, and emoji stickers orbiting the cluster.
 *
 * On-device pixels are the verbatim real game — we crop the device glass out
 * of `docs/ingame/*.png` (same CROP rect `build.mjs` measured with
 * detect-glass.mjs) and re-frame it. No mockups, no fake UI.
 *
 * Renders every App Store display size we upload:
 *   iphone-6.9  1284 × 2778  (6.7" canvas — see the note on TARGETS)
 *   iphone-6.5  1242 × 2688
 *   ipad-13     2064 × 2752
 *
 * Usage:
 *   node marketing/appstore/build-hero.mjs                 # all targets
 *   node marketing/appstore/build-hero.mjs ipad-13         # one target
 *   node marketing/appstore/build-hero.mjs --order 01,05,03 --suffix career
 *     --order   comma-separated panel ids; first = lead screenshot. This is
 *               how the Custom Product Pages (career/tactics/transfers/nation/
 *               brand/pro) are produced — one re-render per CPP ordering.
 *     --suffix  output folder suffix so a CPP set never overwrites the main set.
 *
 * Output: marketing/appstore/hero/<target>[-<suffix>]/01..05.png
 *
 * Requires Playwright + the bundled Chromium at /opt/pw-browsers/chromium-1194
 * (falls back to the default install). Fonts load from Google Fonts at render
 * time; the build explicitly awaits them, so it needs network.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..', '..');
const INGAME = join(ROOT, 'docs', 'ingame');
const OUT = join(DIR, 'hero');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* ── source screens ────────────────────────────────────────────────────── */

// Device-glass rectangle inside the docs/ingame composited shots (shared
// template geometry, measured by luminance scan — see detect-glass.mjs).
const NAT_W = 1284, NAT_H = 2778;
const CROP = { l: 196, t: 480, r: 1086, b: 2258 };
const CW = CROP.r - CROP.l, CH = CROP.b - CROP.t; // 890 × 1778 (≈2:1)

const SRC = {
  dynasty: 'dynasty-manager-01-dynasty.png',
  lineup: 'dynasty-manager-02-lineup.png',
  minute: 'dynasty-manager-03-minute.png',
  upgrade: 'dynasty-manager-04-upgrade.png',
  market: 'dynasty-manager-05-dominate.png',
  tactics: 'dynasty-manager-06-matters.png',
  battle: 'dynasty-manager-07-battle.png',
  training: 'dynasty-manager-08-stars.png',
  finance: 'dynasty-manager-09-books.png',
  nation: 'dynasty-manager-10-nation.png',
};

const imgCache = new Map();
const b64 = (f) => {
  if (!imgCache.has(f)) {
    imgCache.set(f, 'data:image/png;base64,' + readFileSync(join(INGAME, f)).toString('base64'));
  }
  return imgCache.get(f);
};

// DM Sans is inlined from the project's own @fontsource copy — a network miss
// on the Google stylesheet silently drops the body font to a serif, which is
// invisible in the console and obvious in the PNG.
const DM_SANS_FACES = [500, 600, 700]
  .map((w) => {
    const file = join(ROOT, 'node_modules', '@fontsource', 'dm-sans', 'files', `dm-sans-latin-${w}-normal.woff2`);
    const data = readFileSync(file).toString('base64');
    return `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${w};font-display:block;
      src:url(data:font/woff2;base64,${data}) format('woff2')}`;
  })
  .join('\n');

/* ── brand ─────────────────────────────────────────────────────────────── */

const GREEN = '#2fe6a4';
const GOLD = '#f5c542';

/* ── panels ────────────────────────────────────────────────────────────── */
//
// `hero` is the centre device; `left`/`right` are the cropped flankers.
// `pills` are the two floating callouts (gold = the brag, glass = the detail).
// `stickers` orbit the cluster: [emoji, x%, y%, size-multiplier, rotation deg].

const PANELS = [
  {
    id: '01',
    kicker: '45 LEAGUES · 756 CLUBS',
    white: 'Manage any',
    accent: 'club.',
    sub: 'Career mode: sign, scout, win, repeat.',
    hero: SRC.dynasty, left: SRC.upgrade, right: SRC.lineup,
    pills: { gold: '756 REAL CLUBS', glass: '45 leagues · 37 countries' },
    stickers: [['🏆', 8, 30, 1.0, -14], ['⚽', 88, 26, 0.86, 12], ['🔥', 91, 74, 0.8, -8], ['💎', 6, 72, 0.78, 10]],
  },
  {
    id: '02',
    kicker: 'MINUTE-BY-MINUTE MATCH DAY',
    white: 'Feel every',
    accent: 'minute.',
    sub: 'Live commentary. Team talks. Penalty shootouts.',
    hero: SRC.minute, left: SRC.lineup, right: SRC.battle,
    pills: { gold: "83' — 4-0 UP", glass: 'All-Out Attack armed' },
    stickers: [['⚽', 7, 28, 1.0, -12], ['🔥', 90, 30, 0.9, 14], ['📣', 89, 72, 0.78, -10], ['⏱️', 8, 70, 0.78, 8]],
  },
  {
    id: '03',
    kicker: 'SQUAD & FORMATION',
    white: 'Collect gold',
    accent: 'legends.',
    sub: 'Player cards, chemistry and your best XI.',
    hero: SRC.upgrade, left: SRC.lineup, right: SRC.market,
    pills: { gold: '91 OVR WALKOUT', glass: 'Chemistry +12.0%' },
    stickers: [['💎', 8, 27, 1.0, -12], ['👑', 89, 27, 0.92, 12], ['⭐', 91, 71, 0.78, -8], ['⚡', 6, 70, 0.8, 10]],
  },
  {
    id: '04',
    kicker: 'THE TRANSFER WINDOW',
    white: 'Own the',
    accent: 'market.',
    sub: 'Scout wonderkids. Negotiate fees and wages.',
    hero: SRC.market, left: SRC.finance, right: SRC.upgrade,
    pills: { gold: '£81.8M BID', glass: '67 free agents available' },
    stickers: [['💰', 7, 29, 1.0, -13], ['📈', 89, 28, 0.86, 11], ['🤝', 90, 72, 0.78, -9], ['🔍', 7, 71, 0.78, 9]],
  },
  {
    id: '05',
    kicker: 'NATIONAL TEAM & TOURNAMENTS',
    white: 'Lead your',
    accent: 'nation.',
    sub: 'Qualify, pick your 23, chase the trophy.',
    hero: SRC.nation, left: SRC.tactics, right: SRC.dynasty,
    pills: { gold: 'NATIONAL TEAM CALL-UP', glass: '51 national teams' },
    stickers: [['🏆', 8, 28, 1.05, -12], ['🌍', 89, 27, 0.9, 12], ['🎯', 90, 72, 0.78, -9], ['⭐', 7, 71, 0.78, 10]],
  },
];

/* ── targets + layout ──────────────────────────────────────────────────── */
//
// Every size is laid out from fractions of the canvas, so the composition
// holds at both phone (≈1:2.17) and tablet (≈1:1.33) aspect ratios. `kind`
// selects the proportion set: a tablet is relatively much wider, so the
// devices shrink and spread while the type scale drops off the width.

const TARGETS = [
  // 1284 × 2778 is the 6.7" canvas (iPhone 12–14 Pro Max). App Store Connect
  // accepts it in the 6.5" slot; the 6.9" slot itself only takes 1290 × 2796
  // or 1320 × 2868, so this folder is no longer a drop-in for that slot.
  { id: 'iphone-6.9', w: 1284, h: 2778, kind: 'phone' },
  { id: 'iphone-6.5', w: 1242, h: 2688, kind: 'phone' },
  { id: 'ipad-13', w: 2064, h: 2752, kind: 'tablet' },
];

const PROPS = {
  phone: {
    padX: 0.075, topPad: 0.052,
    kicker: 0.0235, head: 0.129, sub: 0.0355,
    stageTop: 0.345, heroW: 0.60,
    sideScale: 0.78, sideDX: 0.445, sideDY: 0.05,
    pillA: { x: 0.035, y: 0.357, size: 0.031, rot: -4 },
    pillB: { x: 0.375, y: 0.866, size: 0.027, rot: 3 },
    sticker: 0.082,
  },
  tablet: {
    padX: 0.11, topPad: 0.058,
    kicker: 0.0165, head: 0.088, sub: 0.0245,
    stageTop: 0.34, heroW: 0.40,
    sideScale: 0.8, sideDX: 0.315, sideDY: 0.04,
    pillA: { x: 0.115, y: 0.352, size: 0.0215, rot: -4 },
    pillB: { x: 0.415, y: 0.885, size: 0.019, rot: 3 },
    sticker: 0.056,
  },
};

/* ── html ──────────────────────────────────────────────────────────────── */

const FONTS = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=DM+Sans:wght@500;600;700&display=swap" rel="stylesheet">`;

/** <img> geometry that cover-fits the CROP region into a screen box. */
function screenImg(src, sw, sh) {
  const s = Math.max(sw / CW, sh / CH);
  const iw = NAT_W * s, ih = NAT_H * s;
  const tx = -CROP.l * s + (sw - CW * s) / 2;
  const ty = -CROP.t * s + (sh - CH * s) / 2;
  return `<img src="${b64(src)}" style="position:absolute;width:${iw}px;height:${ih}px;left:${tx}px;top:${ty}px;max-width:none">`;
}

/** One framed device: bezel, rim light, screen glare, contact shadow. */
function device(src, w, cls, transform, extra = '') {
  const bezel = Math.round(w * 0.021);
  const scrW = w - bezel * 2;
  const scrH = Math.round(scrW * (CH / CW));
  const h = scrH + bezel * 2;
  const rOuter = Math.round(w * 0.098);
  const rInner = rOuter - bezel;
  return `<div class="dev ${cls}" style="width:${w}px;height:${h}px;padding:${bezel}px;border-radius:${rOuter}px;transform:${transform};${extra}">
    <div class="scr" style="width:${scrW}px;height:${scrH}px;border-radius:${rInner}px">${screenImg(src, scrW, scrH)}</div>
    <div class="rim" style="border-radius:${rOuter}px"></div>
    <div class="glare" style="inset:${bezel}px;border-radius:${rInner}px"></div>
  </div>`;
}

function css(W, H, P) {
  const px = (f) => Math.round(f * W);
  const py = (f) => Math.round(f * H);
  return `
${DM_SANS_FACES}
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body{width:${W}px;height:${H}px;overflow:hidden}
.panel{position:relative;width:${W}px;height:${H}px;overflow:hidden;color:#fff;font-family:'DM Sans',sans-serif;
  background:#05070d}

/* Aurora background — violet shoulder, emerald core, warm gold floor. */
.bg{position:absolute;inset:0}
.bg::before{content:'';position:absolute;inset:-20%;
  background:
    radial-gradient(58% 42% at 12% 8%,rgba(126,58,232,.46),transparent 62%),
    radial-gradient(52% 38% at 92% 16%,rgba(28,112,222,.36),transparent 64%),
    radial-gradient(70% 46% at 50% 46%,rgba(16,185,129,.30),transparent 66%),
    radial-gradient(64% 40% at 84% 88%,rgba(20,180,160,.30),transparent 66%),
    radial-gradient(60% 36% at 14% 92%,rgba(245,197,66,.16),transparent 66%);
  filter:blur(${px(0.012)}px)}
.spot{position:absolute;left:50%;top:${py(P.stageTop - 0.05)}px;transform:translateX(-50%);
  width:${px(1.05)}px;height:${py(0.5)}px;pointer-events:none;
  background:radial-gradient(50% 50% at 50% 50%,rgba(47,230,164,.26),rgba(47,230,164,.06) 55%,transparent 72%);
  filter:blur(${px(0.02)}px)}
.vig{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(118% 86% at 50% 42%,transparent 46%,rgba(2,4,9,.72) 100%)}
.grain{position:absolute;inset:0;opacity:.05;pointer-events:none;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* Type block — kicker / headline / subline stack in flow so a one- or
   two-line headline never collides with the subline. */
.top{position:absolute;left:${px(P.padX)}px;right:${px(P.padX)}px;top:${py(P.topPad)}px;text-align:center;z-index:5}
.kicker{font-family:'DM Sans',system-ui,sans-serif;font-weight:700;font-size:${px(P.kicker)}px;letter-spacing:.42em;
  text-transform:uppercase;color:rgba(211,226,240,.72);text-shadow:0 ${px(0.002)}px ${px(0.02)}px rgba(0,0,0,.6)}
.head{margin-top:${py(0.019)}px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:${px(P.head)}px;
  line-height:.96;letter-spacing:-.035em;color:#fff;
  text-shadow:0 ${px(0.006)}px ${px(0.03)}px rgba(0,0,0,.55)}
.head .a{background:linear-gradient(96deg,${GREEN} 0%,#8ef2ce 34%,${GOLD} 96%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 ${px(0.004)}px ${px(0.026)}px rgba(47,230,164,.4))}
.sub{margin-top:${py(0.016)}px;font-family:'DM Sans',system-ui,sans-serif;font-weight:600;font-size:${px(P.sub)}px;
  letter-spacing:-.005em;color:rgba(178,196,215,.94);text-shadow:0 ${px(0.003)}px ${px(0.016)}px rgba(0,0,0,.6)}

/* Device cluster */
.stage{position:absolute;left:50%;top:${py(P.stageTop)}px;width:0;height:0;
  perspective:${px(2.6)}px;perspective-origin:50% 34%;z-index:3}
.dev{position:absolute;left:0;top:0;transform-style:preserve-3d;isolation:isolate;
  background:linear-gradient(152deg,#2b3648 0%,#141b27 46%,#080d16 100%);
  box-shadow:0 ${py(0.024)}px ${py(0.05)}px -${py(0.014)}px rgba(0,0,0,.85),
    0 0 0 ${px(0.0014)}px rgba(255,255,255,.06),
    inset 0 ${px(0.0016)}px ${px(0.003)}px rgba(255,255,255,.16),
    inset 0 -${px(0.002)}px ${px(0.005)}px rgba(0,0,0,.6)}
.scr{position:relative;overflow:hidden;background:#080d14}
.rim{position:absolute;inset:0;pointer-events:none;z-index:4;
  box-shadow:inset 0 0 0 ${px(0.0013)}px rgba(255,255,255,.14),
    inset ${px(0.0025)}px 0 ${px(0.01)}px rgba(47,230,164,.12),
    inset -${px(0.0025)}px 0 ${px(0.01)}px rgba(140,170,255,.10)}
.glare{position:absolute;pointer-events:none;z-index:6;mix-blend-mode:screen;
  background:linear-gradient(124deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.045) 20%,transparent 40%)}
.side{filter:saturate(.98) brightness(.9)}
.side::after{content:'';position:absolute;inset:0;border-radius:inherit;z-index:7;
  background:linear-gradient(180deg,rgba(5,8,14,.06),rgba(5,8,14,.38))}

/* Floating callouts */
.pill{position:absolute;z-index:6;display:inline-flex;align-items:center;white-space:nowrap;
  font-family:'DM Sans',system-ui,sans-serif;font-weight:700;letter-spacing:.01em}
.pill.gold{left:${px(P.pillA.x)}px;top:${py(P.pillA.y)}px;transform:rotate(${P.pillA.rot}deg);
  font-size:${px(P.pillA.size)}px;color:#241a02;
  padding:${px(0.019)}px ${px(0.036)}px;border-radius:999px;
  background:linear-gradient(160deg,#ffe08a 0%,${GOLD} 42%,#e0a516 100%);
  box-shadow:0 ${py(0.012)}px ${py(0.026)}px -${py(0.006)}px rgba(0,0,0,.62),
    0 0 ${px(0.06)}px rgba(245,197,66,.34),inset 0 ${px(0.002)}px 0 rgba(255,255,255,.6)}
.pill.glass{left:${px(P.pillB.x)}px;top:${py(P.pillB.y)}px;transform:rotate(${P.pillB.rot}deg);
  font-size:${px(P.pillB.size)}px;color:#eaf3fb;gap:${px(0.014)}px;
  padding:${px(0.017)}px ${px(0.032)}px;border-radius:999px;
  background:rgba(10,16,26,.72);border:${px(0.0016)}px solid rgba(255,255,255,.16);
  backdrop-filter:blur(${px(0.012)}px);
  box-shadow:0 ${py(0.01)}px ${py(0.024)}px -${py(0.006)}px rgba(0,0,0,.6)}
.pill.glass .dot{width:${px(0.014)}px;height:${px(0.014)}px;border-radius:999px;background:${GREEN};
  box-shadow:0 0 ${px(0.02)}px ${GREEN}}

/* Emoji stickers */
.stk{position:absolute;z-index:7;font-family:'Noto Color Emoji','Apple Color Emoji',sans-serif;
  line-height:1;filter:drop-shadow(0 ${py(0.008)}px ${py(0.014)}px rgba(0,0,0,.65))}
`;
}

function html(p, t) {
  const P = PROPS[t.kind];
  const W = t.w, H = t.h;
  const px = (f) => Math.round(f * W);
  const py = (f) => Math.round(f * H);

  const heroW = px(P.heroW);
  const sideW = Math.round(heroW * P.sideScale);
  const heroT = `translate(-50%,0) rotateX(3deg) rotateY(-4deg) rotateZ(-.6deg)`;
  const leftT = `translate(-50%,${py(P.sideDY)}px) translateX(-${px(P.sideDX)}px) rotateX(3deg) rotateY(19deg) rotateZ(-5deg)`;
  const rightT = `translate(-50%,-${py(P.sideDY * 0.55)}px) translateX(${px(P.sideDX)}px) rotateX(3deg) rotateY(-19deg) rotateZ(5deg)`;

  // On tablet the three devices span nearly the full width and stay bright, so
  // the two lower stickers would land on live UI and read as clutter — keep
  // only the pair that floats in the open band beside the subline.
  const stickers = (t.kind === 'tablet' ? p.stickers.slice(0, 2) : p.stickers)
    .map(([e, x, y, s, r]) => `<div class="stk" style="left:${(x / 100) * W}px;top:${(y / 100) * H}px;font-size:${Math.round(px(P.sticker) * s)}px;transform:translate(-50%,-50%) rotate(${r}deg)">${e}</div>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf8">${FONTS}<style>${css(W, H, P)}</style></head><body>
  <div class="panel">
    <div class="bg"></div><div class="spot"></div>
    <div class="top">
      <div class="kicker">${p.kicker}</div>
      <div class="head">${p.white}<br><span class="a">${p.accent}</span></div>
      <div class="sub">${p.sub}</div>
    </div>
    <div class="stage">
      ${device(p.left, sideW, 'side', leftT, 'z-index:1')}
      ${device(p.right, sideW, 'side', rightT, 'z-index:1')}
      ${device(p.hero, heroW, 'hero', heroT, 'z-index:2')}
    </div>
    <div class="pill gold">${p.pills.gold}</div>
    <div class="pill glass"><span class="dot"></span>${p.pills.glass}</div>
    ${stickers}
    <div class="vig"></div><div class="grain"></div>
  </div></body></html>`;
}

/* ── render ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const orderArg = argValue('--order');
const suffixArg = argValue('--suffix') || '';
const only = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--order' && argv[i - 1] !== '--suffix');

let panels = PANELS;
if (orderArg !== undefined) {
  const ids = orderArg.split(',').map((s) => s.trim()).filter(Boolean);
  const byId = new Map(PANELS.map((p) => [p.id, p]));
  const unknown = ids.filter((id) => !byId.has(id));
  if (ids.length === 0 || unknown.length > 0) {
    console.error(`Bad --order "${orderArg}". Known panel ids: ${PANELS.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }
  panels = ids.map((id) => byId.get(id));
}

const targets = only ? TARGETS.filter((t) => t.id === only) : TARGETS;
if (!targets.length) {
  console.error(`Unknown target "${only}". Known: ${TARGETS.map((t) => t.id).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: existsSync(EXE) ? EXE : undefined,
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

for (const t of targets) {
  const dir = join(OUT, suffixArg ? `${t.id}-${suffixArg}` : t.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  for (const p of panels) {
    const f = join(dir, `${p.id}.html`);
    writeFileSync(f, html(p, t));
    await page.goto('file://' + f, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load("800 120px 'Montserrat'"),
        document.fonts.load("700 40px 'DM Sans'"),
        document.fonts.load("600 40px 'DM Sans'"),
      ]);
      await document.fonts.ready;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(dir, `${p.id}.png`) });
    rmSync(f, { force: true });
    console.log(`✓ ${t.id} ${p.id}  ${p.white} ${p.accent}`);
  }
  await page.close();
}

await browser.close();
console.log('DONE →', OUT);
