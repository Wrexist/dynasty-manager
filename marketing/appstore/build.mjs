/**
 * Dynasty Manager — 3D App Store screenshots (iPhone 6.7", 1290×2796).
 *
 * Takes the real in-game screens from the current App Store set
 * (`docs/ingame/*.png` — real clubs, real players, evergreen) and re-composites
 * their device content into a premium, perspective-tilted 3D device (depth
 * shadow, screen glare, rim light) on the green Dynasty Manager brand system.
 *
 * The source PNGs are already-composited (flat) marketing shots; we crop out
 * just their device glass (measured once — see CROP) and re-frame it in 3D, so
 * the on-device pixels are the verbatim real game.
 *
 * Usage:
 *   node marketing/appstore/build.mjs            # English base set
 *   (localization pass adds per-locale captions later, once the look is signed off)
 *
 * Output: marketing/appstore/out/en/01..05.png
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..', '..');
const INGAME = join(ROOT, 'docs', 'ingame');
const OUT = join(DIR, 'out');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const W = 1290, H = 2796;
const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(INGAME, f)).toString('base64');

// Device-glass rectangle inside the docs/ingame composited shots (shared
// template geometry, measured by luminance scan). Natural source = 1284×2778.
const NAT_W = 1284, NAT_H = 2778;
const CROP = { l: 196, t: 480, r: 1086, b: 2258 };
const CW = CROP.r - CROP.l, CH = CROP.b - CROP.t; // 890 × 1778 (≈18:9)

// Green brand palette (matches the current real-game listing).
const GREEN = '#2fe6a4', GREEN_DEEP = '#10b981';

// Five strongest real-game screens + their evergreen captions (green accent =
// the second headline line, mirroring the current set).
const PANELS = [
  { id: '01', src: 'dynasty-manager-04-upgrade.png', white: 'COLLECT &',    green: 'UPGRADE',  sub: 'Real player cards, real stats, real ratings.', tilt: -8,  rz: -0.4 },
  { id: '02', src: 'dynasty-manager-02-lineup.png',  white: 'SET YOUR',     green: 'LINEUP',   sub: 'Player cards. Chemistry links. Full control.', tilt: 13,  rz: 0.6 },
  { id: '03', src: 'dynasty-manager-03-minute.png',  white: 'FEEL EVERY',   green: 'MINUTE',   sub: 'Live commentary. Tactical calls. Real drama.',  tilt: -13, rz: -0.6 },
  { id: '04', src: 'dynasty-manager-06-matters.png', white: 'EVERY DETAIL', green: 'MATTERS',  sub: 'Mentality. Tempo. Pressing. Your call.',        tilt: 12,  rz: 0.5 },
  { id: '05', src: 'dynasty-manager-08-stars.png',   white: 'TRAIN YOUR',   green: 'STARS',    sub: 'Weekly drills. Fitness. Player growth.',        tilt: -12, rz: -0.5 },
];

const PHONE_W = 772;
const SCR_W = PHONE_W - 32;
const SCR_H = Math.round(SCR_W * (CH / CW));   // match crop aspect → whole screen shows, no loss
const PHONE_H = SCR_H + 32;

// Cover-fit the crop region into the screen box (here aspect matches, so it's a
// clean fill), returning the <img> geometry.
function coverImg(src) {
  const s = Math.max(SCR_W / CW, SCR_H / CH);
  const iw = NAT_W * s, ih = NAT_H * s;
  const tx = -CROP.l * s + (SCR_W - CW * s) / 2;
  const ty = -CROP.t * s + (SCR_H - CH * s) / 2;
  return `<img src="${b64(src)}" style="position:absolute;width:${iw}px;height:${ih}px;left:${tx}px;top:${ty}px;max-width:none">`;
}

const FONTS_LINK = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=DM+Sans:wght@500;600&display=swap" rel="stylesheet">`;

const css = `
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.panel{width:${W}px;height:${H}px;position:relative;overflow:hidden;color:#fff;font-family:'DM Sans',sans-serif;
  background:radial-gradient(140% 80% at 50% 34%,#0e1a1c 0%,#0a1118 40%,#070b11 100%)}
.glowtop{position:absolute;left:50%;top:-6%;transform:translateX(-50%);width:150%;height:56%;
  background:radial-gradient(closest-side,rgba(16,185,129,.30),transparent 68%);filter:blur(20px)}
.spotlight{position:absolute;left:50%;top:640px;transform:translateX(-50%);width:1000px;height:1500px;pointer-events:none;
  background:radial-gradient(50% 42% at 50% 40%,rgba(47,230,164,.18),rgba(16,185,129,.06) 55%,transparent 72%);filter:blur(8px)}
.glowbot{position:absolute;left:50%;bottom:-18%;transform:translateX(-50%);width:150%;height:48%;
  background:radial-gradient(closest-side,rgba(16,185,129,.16),transparent 70%);filter:blur(22px)}
.vignette{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 92% at 50% 40%,transparent 54%,rgba(0,0,0,.6) 100%)}
.grain{position:absolute;inset:0;opacity:.045;pointer-events:none;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

.kicker{position:absolute;top:146px;left:0;right:0;text-align:center;font-family:'Montserrat',sans-serif;font-weight:700;
  letter-spacing:.42em;text-transform:uppercase;color:${GREEN};font-size:32px;text-shadow:0 2px 20px rgba(16,185,129,.5)}
/* 3D captions — the headline block tilts subtly in space; each word is a real
   extruded 3D solid (stacked darker layers = depth, lit from the top). */
.head{position:absolute;left:70px;right:70px;top:206px;text-align:center;font-family:'Montserrat',sans-serif;font-weight:900;
  text-transform:uppercase;line-height:.96;letter-spacing:-.015em;
  transform:perspective(1400px) rotateX(11deg);transform-origin:50% 0}
.head .w{color:#f4f8fc;
  text-shadow:0 2px 0 #cfd8e2,0 4px 0 #aeb9c6,0 6px 0 #8b96a4,0 8px 0 #6d788700,
    0 3px 1px rgba(0,0,0,.2),0 14px 26px rgba(0,0,0,.55)}
.head .g{color:${GREEN};
  text-shadow:0 2px 0 #23b985,0 4px 0 #1c9f72,0 6px 0 #16855f,0 8px 0 #11694b,0 11px 0 #0c4f39,
    0 3px 1px rgba(0,0,0,.25),0 20px 34px rgba(10,60,44,.6),0 0 46px rgba(47,230,164,.35)}
.sub{position:absolute;left:110px;right:110px;top:500px;text-align:center;font-family:'DM Sans';font-weight:600;
  color:#aebccb;font-size:42px;letter-spacing:.005em;filter:drop-shadow(0 3px 10px rgba(0,0,0,.5))}

.stage{position:absolute;left:50%;top:720px;transform:translateX(-50%);perspective:3100px;perspective-origin:50% 38%}
.floor{position:absolute;left:50%;top:${PHONE_H - 46}px;transform:translateX(-50%);width:${PHONE_W + 150}px;height:160px;
  background:radial-gradient(closest-side,rgba(0,0,0,.6),transparent 74%);filter:blur(32px)}
.phone{position:relative;width:${PHONE_W}px;height:${PHONE_H}px;border-radius:78px;padding:16px;isolation:isolate;
  background:linear-gradient(150deg,#243041 0%,#131a26 48%,#0a0f19 100%);transform-style:preserve-3d;
  box-shadow:0 72px 135px -42px rgba(0,0,0,.92),0 0 0 2px rgba(255,255,255,.05),
    inset 0 2px 3px rgba(255,255,255,.14),inset 0 -3px 6px rgba(0,0,0,.6)}
.scr{position:relative;width:${SCR_W}px;height:${SCR_H}px;border-radius:60px;overflow:hidden;background:#0a0f16}
.rim{position:absolute;inset:0;border-radius:78px;pointer-events:none;z-index:4;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.12),inset 3px 0 12px rgba(47,230,164,.10),inset -3px 0 12px rgba(120,160,255,.08)}
.glare{position:absolute;inset:16px;border-radius:60px;pointer-events:none;z-index:6;mix-blend-mode:screen;
  background:linear-gradient(122deg,rgba(255,255,255,.20) 0%,rgba(255,255,255,.05) 22%,transparent 42%,transparent 100%)}

/* Conversion strip — rating + the app's real value props (free, no pay-to-win,
   no energy timers), the objections that most lift installs for this genre. */
.vp{position:absolute;bottom:104px;left:0;right:0;text-align:center}
.vp .stars{color:${GREEN};font-size:40px;letter-spacing:8px;filter:drop-shadow(0 2px 12px rgba(47,230,164,.5))}
.vp .props{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:22px;
  font-family:'DM Sans';font-weight:600;font-size:30px;color:#8ea0b6}
.vp .props .p{color:#d6e0ea}
.vp .props .sep{width:7px;height:7px;border-radius:999px;background:${GREEN};opacity:.8}
`;

function headSize(white, green) {
  const n = Math.max(white.length, green.length);
  if (n <= 8) return 150;
  if (n <= 11) return 132;
  if (n <= 14) return 116;
  return 100;
}

function html(appName, p, idx, total) {
  const hs = headSize(p.white, p.green);
  const transform = `rotateX(4deg) rotateY(${p.tilt}deg) rotateZ(${p.rz}deg)`;
  return `<!doctype html><html><head><meta charset="utf8">${FONTS_LINK}<style>${css}
   .head{font-size:${hs}px}
   .phone{transform:${transform}}
  </style></head><body>
   <div class="panel">
     <div class="glowtop"></div><div class="glowbot"></div><div class="spotlight"></div>
     <div class="kicker">— DYNASTY MANAGER —</div>
     <div class="head"><span class="w">${p.white}</span><br><span class="g">${p.green}</span></div>
     <div class="sub">${p.sub}</div>
     <div class="stage">
       <div class="floor"></div>
       <div class="phone"><div class="rim"></div><div class="glare"></div>
         <div class="scr">${coverImg(p.src)}</div></div>
     </div>
     <div class="vp"><div class="stars">★★★★★</div>
       <div class="props"><span class="p">Free</span><span class="sep"></span><span class="p">No Pay-to-Win</span><span class="sep"></span><span class="p">No Energy Timers</span></div>
     </div>
     <div class="vignette"></div><div class="grain"></div>
   </div>
  </body></html>`;
}

const locale = process.argv[2] || 'en';
const appName = 'Dynasty Manager';
const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const dir = join(OUT, locale);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (let i = 0; i < PANELS.length; i++) {
  const p = PANELS[i];
  const f = join(dir, `${p.id}.html`);
  writeFileSync(f, html(appName, p, i, PANELS.length));
  await page.goto('file://' + f, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load("900 100px 'Montserrat'"),
      document.fonts.load("700 100px 'Montserrat'"),
      document.fonts.load("500 100px 'DM Sans'"),
    ]);
    await document.fonts.ready;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, `${p.id}.png`) });
  rmSync(f, { force: true });
  console.log('✓', p.id, `${p.white} ${p.green}`);
}
await browser.close();
console.log('DONE →', join(OUT, locale));
