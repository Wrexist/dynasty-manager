/**
 * World Cup App Store screenshot generator (iPhone 6.7" — 1290×2796).
 * Composites in-game screenshots into branded, store-ready marketing panels,
 * topped with a "country ribbon" of the major footballing nations.
 * Run: `node marketing/world-cup/build-appstore.mjs`
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { flagRibbon } from './flags.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const SCREENS = join(DIR, 'screens');
const OUT = join(DIR, 'appstore');
mkdirSync(OUT, { recursive: true });
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(SCREENS, f)).toString('base64');

const W = 1290, H = 2796;

// Deterministic confetti specks so panels render identically every run.
function confetti(seed) {
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cols = ['#f2b50c', '#16a34a', '#ffffff', '#e11d2a', '#ffd24a'];
  let out = '';
  for (let i = 0; i < 42; i++) {
    const x = rnd() * W, y = 180 + rnd() * (H * 0.55), r = 6 + rnd() * 12, rot = rnd() * 360;
    const c = cols[(rnd() * cols.length) | 0], op = 0.10 + rnd() * 0.26;
    const sq = rnd() > 0.5;
    out += `<div style="position:absolute;left:${x}px;top:${y}px;width:${r}px;height:${r * (sq ? 1 : 0.5)}px;background:${c};opacity:${op};transform:rotate(${rot}deg);border-radius:${sq ? 2 : 6}px"></div>`;
  }
  return out;
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;600;700&family=DM+Sans:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
.panel{width:${W}px;height:${H}px;position:relative;overflow:hidden;color:#fff;font-family:'Oswald',sans-serif;
  background:radial-gradient(125% 70% at 50% -8%,#1a2c4f 0%,#0c1526 46%,#070b12 100%);}
.pitchglow{position:absolute;left:50%;bottom:-14%;transform:translateX(-50%);width:170%;height:46%;
  background:radial-gradient(closest-side,rgba(22,163,74,.34),transparent 72%);filter:blur(10px)}
.goldglow{position:absolute;left:50%;top:4%;transform:translateX(-50%);width:150%;height:44%;
  background:radial-gradient(closest-side,rgba(242,181,12,.26),transparent 70%);filter:blur(12px)}
.wctag{position:absolute;top:188px;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
  letter-spacing:.42em;text-transform:uppercase;color:#ffd24a;font-size:38px}
.headline{position:absolute;left:0;right:0;text-align:center;font-family:'Anton';text-transform:uppercase;
  line-height:.92;letter-spacing:.01em;
  background:linear-gradient(180deg,#fff 32%,#ffe9a8 72%,#f2b50c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 8px 30px rgba(0,0,0,.5))}
.sub{position:absolute;left:120px;right:120px;text-align:center;font-family:'Oswald';font-weight:600;color:#cdd8e6;font-size:46px}
.stage{position:absolute;left:50%;transform:translateX(-50%);}
.phone{position:relative;border-radius:66px;padding:14px;background:linear-gradient(160deg,#222c3c,#0e1420);
  box-shadow:0 60px 120px -40px rgba(0,0,0,.9),0 0 0 2px rgba(255,255,255,.06);}
.phone .scr{border-radius:52px;overflow:hidden;display:block}
.phone .scr img{display:block;width:100%;height:100%;object-fit:cover}
.notch{position:absolute;top:26px;left:50%;transform:translateX(-50%);width:150px;height:30px;background:#0a0f18;border-radius:18px;z-index:3}
.foot{position:absolute;bottom:96px;left:0;right:0;text-align:center}
.stars{color:#ffd24a;font-size:40px;letter-spacing:6px}
.footsub{font-family:'DM Sans';color:#8ea0b6;font-weight:500;font-size:34px;margin-top:6px}
.dots{position:absolute;bottom:54px;left:50%;transform:translateX(-50%);display:flex;gap:14px}
.dot{width:16px;height:16px;border-radius:999px;background:rgba(255,255,255,.25)}
.dot.on{background:#f2b50c;width:42px}
`;

const PHONE_W = 760;
const phoneH = Math.round((PHONE_W - 28) * (844 / 390)) + 28;

// Six-panel App Store story arc, World Cup-led. Order matters: the first
// 2-3 panels are what most users see in search results, so the hook + the
// core "manage the matches" promise come first, glory lands last.
const panels = [
  { id: 'appstore-1-here', seed: 7, tag: 'World Cup 2026', hl: ['THE', 'WORLD CUP', 'IS HERE'],
    sub: 'Take any nation. Survive the group. Lift the trophy.', shot: '01-dashboard.png' },
  { id: 'appstore-2-live', seed: 23, tag: 'Live World Cup', hl: ['LIVE', 'WORLD CUP', 'MATCHES'],
    sub: 'Manage every minute — shouts, subs, penalties.', shot: '07-live-second-half.png' },
  { id: 'appstore-3-squad', seed: 88, tag: 'Your Nation', hl: ['NAME', 'YOUR 23'],
    sub: 'Pick the squad to carry a nation to glory.', shot: '02-squad.png' },
  { id: 'appstore-4-group', seed: 34, tag: 'The Group Stage', hl: ['SURVIVE', 'THE GROUP'],
    sub: '48 nations. 12 groups. One dream.', shot: '04-prematch.png' },
  { id: 'appstore-5-halftime', seed: 65, tag: 'Every Decision', hl: ['EVERY CALL', 'IS YOURS'],
    sub: 'Team talks that turn the tie at half-time.', shot: '06-half-time.png' },
  { id: 'appstore-6-glory', seed: 51, tag: 'World Cup Glory', hl: ['WIN THE', 'WORLD CUP'],
    sub: 'From the group stage to the World Cup Final.', shot: '08-full-time.png' },
];

function html(p, idx, total) {
  const hlSize = p.hl.length >= 3 ? 158 : 178;
  const hlTop = 260;
  const subTop = hlTop + p.hl.length * (hlSize * 0.92) + 38;
  const stageTop = Math.min(subTop + 120, 940);
  return `<!doctype html><html><head><meta charset="utf8"><style>${css}
   .headline{font-size:${hlSize}px;top:${hlTop}px}
   .sub{top:${subTop}px}
   .stage{top:${stageTop}px}
   .phone{width:${PHONE_W}px;height:${phoneH}px}
  </style></head><body>
   <div class="panel">
     <div class="goldglow"></div><div class="pitchglow"></div>
     ${confetti(p.seed)}
     ${flagRibbon({ width: W })}
     <div class="wctag">★ ${p.tag} ★</div>
     <div class="headline">${p.hl.join('<br>')}</div>
     <div class="sub">${p.sub}</div>
     <div class="stage">
       <div class="phone"><div class="notch"></div><div class="scr" style="height:${phoneH - 28}px"><img src="${b64(p.shot)}"></div></div>
     </div>
     <div class="foot"><div class="stars">★★★★★</div><div class="footsub">Dynasty Manager: Football — on the App Store</div></div>
     <div class="dots">${Array.from({ length: total }, (_, i) => `<div class="dot ${i === idx ? 'on' : ''}"></div>`).join('')}</div>
   </div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--no-sandbox'] });
for (let idx = 0; idx < panels.length; idx++) {
  const p = panels[idx];
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const f = join(OUT, p.id + '.html');
  writeFileSync(f, html(p, idx, panels.length));
  await page.goto('file://' + f, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(OUT, p.id + '.png') });
  await page.close();
  console.log('rendered', p.id, `${W}x${H}`);
}
await browser.close();
console.log('DONE');
