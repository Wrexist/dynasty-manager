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
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;600;700&family=DM+Sans:wght@500;700&family=Noto+Color+Emoji&display=swap');
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

/* Faithful recreation of the in-game World Cup champion result screen
   (src/pages/WorldCupResult.tsx), rendered as panel 6's device content.
   Mirrors the app: dark bg, gold radial wash, trophy badge, "World
   Champions!", the Your Road stat card, and Tournament Awards. */
.appscreen{position:relative;width:100%;height:100%;background:radial-gradient(125% 60% at 50% -6%,#12203a 0%,#0b111d 52%,#080c14 100%);
  font-family:'Oswald',sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:0 56px;gap:34px;overflow:hidden}
.appscreen .wash{position:absolute;left:50%;top:0;transform:translateX(-50%);width:150%;height:46%;
  background:radial-gradient(closest-side,rgba(242,181,12,.30),transparent 70%);filter:blur(10px);pointer-events:none}
.glass{position:relative;width:100%;background:rgba(18,26,42,.62);border:2px solid rgba(255,255,255,.08);
  border-radius:40px;box-shadow:inset 0 2px 0 rgba(255,255,255,.06),0 30px 60px -30px rgba(0,0,0,.8)}
.hero{padding:54px 30px;text-align:center;overflow:hidden}
.hero .badge{margin:0 auto 30px;width:150px;height:150px;border-radius:42px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(180deg,rgba(245,180,12,.42),rgba(245,180,12,.14));color:#fcd34d;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.28),inset 0 -2px 0 rgba(0,0,0,.3),0 0 50px 6px rgba(245,180,12,.45)}
.hero .badge svg{width:78px;height:78px}
.hero .natrow{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:12px}
.hero .natrow .flag{font-family:'Noto Color Emoji',sans-serif;font-size:46px;line-height:1}
.hero .natrow .name{font-weight:600;font-size:34px;color:rgba(255,255,255,.82)}
.hero h1{font-family:'Anton';text-transform:uppercase;font-size:72px;line-height:.94;letter-spacing:.005em;
  background:linear-gradient(180deg,#ffe9a8 10%,#fcd34d 60%,#f2b50c 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin-top:18px;font-size:30px;color:rgba(252,211,77,.72);font-family:'DM Sans';font-weight:500}
.card{padding:34px 38px}
.card .lbl{font-family:'Oswald';font-weight:700;text-transform:uppercase;letter-spacing:.18em;font-size:24px;color:#8ea0b6;margin-bottom:26px}
.stats{display:flex;justify-content:space-between;text-align:center}
.stats .col{flex:1}
.stats .big{font-family:'Anton';font-size:62px;line-height:1}
.stats .wdl .w{color:#34d399}.stats .wdl .d{color:#9aa7b8}.stats .wdl .l{color:#f87171}.stats .sep{color:rgba(255,255,255,.45);font-size:34px;margin:0 6px;vertical-align:middle}
.stats .cap{font-size:24px;color:#8ea0b6;margin-top:8px;font-family:'DM Sans'}
.award{display:flex;align-items:center;gap:24px}
.award + .award{margin-top:26px}
.award .ico{width:74px;height:74px;border-radius:26px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.2),inset 0 -2px 0 rgba(0,0,0,.3)}
.award .ico svg{width:36px;height:36px}
.award .ico.gold{background:linear-gradient(180deg,rgba(245,180,12,.42),rgba(245,180,12,.14));color:#fcd34d}
.award .ico.plain{background:rgba(255,255,255,.06);color:rgba(255,255,255,.7)}
.award .meta{flex:1;min-width:0}
.award .meta .k{font-family:'Oswald';font-weight:700;text-transform:uppercase;letter-spacing:.16em;font-size:21px;color:#8ea0b6}
.award .meta .who{font-weight:700;font-size:36px;margin-top:4px}
.award .val{font-weight:600;font-size:26px;color:#9aa7b8;white-space:nowrap}
.cta{width:100%;height:96px;border-radius:30px;display:flex;align-items:center;justify-content:center;gap:16px;
  font-family:'Oswald';font-weight:700;font-size:34px;color:#3a2c05;
  background:linear-gradient(180deg,#fbbf24,#f59e0b);box-shadow:0 14px 40px -10px rgba(245,178,5,.5)}
.cta svg{width:34px;height:34px}
`;

// Lucide line icons (same set the app uses) as inline SVG.
const SVG = {
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
};

// Faithful recreation of the champion result screen for panel 6. Matches
// the layout of src/pages/WorldCupResult.tsx for a won World Cup run.
function championScreen({ nat, flag, played, w, d, l, gf, ga, goldenBoot, youngStar }) {
  return `<div class="appscreen">
    <div class="wash"></div>
    <div class="glass hero">
      <div class="badge">${SVG.trophy}</div>
      <div class="natrow"><span class="flag">${flag}</span><span class="name">${nat}</span></div>
      <h1>World<br>Champions!</h1>
      <p>You conquered the world.</p>
    </div>
    <div class="glass card">
      <div class="lbl">Your Road</div>
      <div class="stats">
        <div class="col"><div class="big">${played}</div><div class="cap">Played</div></div>
        <div class="col"><div class="big wdl"><span class="w">${w}</span><span class="sep">·</span><span class="d">${d}</span><span class="sep">·</span><span class="l">${l}</span></div><div class="cap">W · D · L</div></div>
        <div class="col"><div class="big">${gf}<span class="sep">:</span>${ga}</div><div class="cap">Goals</div></div>
      </div>
    </div>
    <div class="glass card">
      <div class="lbl">Tournament Awards</div>
      <div class="award"><div class="ico gold">${SVG.award}</div><div class="meta"><div class="k">Golden Boot</div><div class="who">${goldenBoot.name}</div></div><div class="val">${goldenBoot.goals} goals</div></div>
      <div class="award"><div class="ico plain">${SVG.star}</div><div class="meta"><div class="k">Young Star</div><div class="who">${youngStar.name}</div></div><div class="val">${youngStar.goals} goals · age ${youngStar.age}</div></div>
    </div>
    <div class="cta">${SVG.replay} Play Another World Cup</div>
  </div>`;
}

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
    sub: 'Lift the trophy. Claim the Golden Boot.',
    screenHtml: championScreen({
      nat: 'Brazil', flag: '🇧🇷', played: 7, w: 6, d: 1, l: 0, gf: 14, ga: 4,
      goldenBoot: { name: 'Silva', goals: 6 },
      youngStar: { name: 'Costa', goals: 3, age: 20 },
    }) },
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
       <div class="phone"><div class="notch"></div><div class="scr" style="height:${phoneH - 28}px">${p.screenHtml ? p.screenHtml : `<img src="${b64(p.shot)}">`}</div></div>
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
  // Wait for webfonts (incl. the larger Noto Color Emoji flag font) to finish
  // loading, otherwise flags fall back to plain code boxes.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, p.id + '.png') });
  await page.close();
  console.log('rendered', p.id, `${W}x${H}`);
}
await browser.close();
console.log('DONE');
