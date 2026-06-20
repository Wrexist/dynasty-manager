/**
 * World Cup launch poster generator.
 * Composites in-game screenshots into branded social ad creatives and renders
 * them to PNG. Run: `node marketing/world-cup/build.mjs`
 * Requires a Chromium (uses the sandbox's /opt build; falls back to PLAYWRIGHT).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DIR = dirname(fileURLToPath(import.meta.url));
const SCREENS = join(DIR, 'screens');
const OUT = join(DIR, 'posters');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(SCREENS, f)).toString('base64');

// Palette — matches the app: dark navy, gold, pitch green, accent blue.
const css = `
  *{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;600;700&family=DM+Sans:wght@400;500;700&display=swap');
  :root{--gold:#f2b50c;--gold2:#ffd24a;--green:#16a34a;--ink:#070b12;}
  .poster{position:relative;overflow:hidden;color:#fff;font-family:'Oswald','Arial Narrow',sans-serif;
    background:radial-gradient(120% 80% at 50% -10%,#16233f 0%,#0b1322 45%,#070b12 100%);}
  .grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:4px 4px;opacity:.5;}
  .glowtop{position:absolute;top:-30%;left:50%;transform:translateX(-50%);width:140%;height:60%;
    background:radial-gradient(closest-side,rgba(242,181,12,.28),transparent 70%);filter:blur(10px);}
  .pitch{position:absolute;bottom:-12%;left:50%;transform:translateX(-50%);width:160%;height:42%;
    background:radial-gradient(closest-side,rgba(22,163,74,.30),transparent 72%);filter:blur(8px);}
  .badge{display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(242,181,12,.5);
    background:rgba(242,181,12,.10);color:var(--gold2);font-family:'Oswald';font-weight:700;letter-spacing:.28em;
    text-transform:uppercase;border-radius:999px;}
  .wc{font-family:'Anton','Oswald',sans-serif;text-transform:uppercase;line-height:.92;letter-spacing:.005em;
    background:linear-gradient(180deg,#fff 30%,#ffe9a8 75%,var(--gold) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 6px 24px rgba(0,0,0,.55));}
  .sub{font-family:'Oswald';font-weight:600;color:#c7d2e0;letter-spacing:.02em;}
  .phone{position:relative;border-radius:42px;padding:0;overflow:hidden;
    border:2px solid rgba(255,255,255,.14);box-shadow:0 40px 90px -30px rgba(0,0,0,.85),0 0 0 10px rgba(255,255,255,.03);}
  .phone img{display:block;width:100%;height:100%;object-fit:cover;}
  .cta{display:inline-flex;align-items:center;gap:12px;background:linear-gradient(180deg,var(--gold2),var(--gold));
    color:#1a1206;font-family:'Oswald';font-weight:700;text-transform:uppercase;letter-spacing:.06em;
    border-radius:999px;box-shadow:0 14px 30px -10px rgba(242,181,12,.6);}
  .app{font-family:'Oswald';font-weight:700;letter-spacing:.04em;color:#fff;}
  .appsub{font-family:'DM Sans';color:#8ea0b6;font-weight:500;}
  .stars{color:var(--gold2);letter-spacing:3px;}
  .ribbon{font-family:'Oswald';font-weight:700;letter-spacing:.3em;color:var(--gold2);text-transform:uppercase;}
`;

// Each poster: format, headline lines, sub, screenshot, and footer CTA.
const posters = [
  { id: 'wc-story-hero', w: 1080, h: 1920, shot: '01-dashboard.png',
    kicker: 'New Game Mode', wc: ['LEAD YOUR', 'NATION TO', 'WORLD CUP', 'GLORY'],
    sub: 'Pick any nation. Survive the group. Lift the trophy.' },
  { id: 'wc-story-live', w: 1080, h: 1920, shot: '07-live-second-half.png',
    kicker: 'World Cup Mode', wc: ['LIVE', 'WORLD CUP', 'MATCHES'],
    sub: 'Manage every minute — team talks, subs, penalties.' },
  { id: 'wc-story-pick', w: 1080, h: 1920, shot: '04-prematch.png',
    kicker: 'World Cup 2026', wc: ['ONE NATION.', 'ONE DREAM.', 'THE WORLD', 'CUP.'],
    sub: '48 nations. 7 rounds. Can you go all the way?' },
  { id: 'wc-square-here', w: 1080, h: 1080, shot: '01-dashboard.png',
    kicker: 'Out Now', wc: ['THE WORLD', 'CUP IS HERE'],
    sub: 'Take charge of your country and chase World Cup glory.' },
  { id: 'wc-square-canyou', w: 1080, h: 1080, shot: '08-full-time.png',
    kicker: 'World Cup Mode', wc: ['CAN YOU WIN', 'THE WORLD CUP?'],
    sub: 'Group stage to the Final — every result is yours to write.' },
];

function html(p) {
  const isStory = p.h > p.w;
  const wcSize = isStory ? (p.wc.length >= 4 ? 132 : 150) : 112;
  const phoneH = isStory ? 980 : 540;
  return `<!doctype html><html><head><meta charset="utf8"><style>${css}
   .poster{width:${p.w}px;height:${p.h}px;display:flex;flex-direction:column;align-items:center;
     padding:${isStory ? '92px 70px 76px' : '70px 64px 60px'};}
   .badge{font-size:${isStory ? 26 : 24}px;padding:${isStory ? '12px 26px' : '10px 24px'};}
   .wc{font-size:${wcSize}px;margin-top:${isStory ? 34 : 22}px;text-align:center;}
   .sub{font-size:${isStory ? 34 : 30}px;margin-top:${isStory ? 26 : 18}px;text-align:center;max-width:${isStory ? 820 : 820}px;}
   .stage{flex:1;display:flex;align-items:center;justify-content:center;width:100%;margin:${isStory ? '40px 0' : '26px 0'};}
   .phone{height:${phoneH}px;aspect-ratio:390/844;}
   .footer{display:flex;align-items:center;justify-content:center;gap:22px;width:100%;}
   .cta{font-size:${isStory ? 34 : 30}px;padding:${isStory ? '22px 44px' : '18px 38px'};}
   .appwrap{display:flex;flex-direction:column;align-items:flex-start;gap:4px;}
   .app{font-size:${isStory ? 30 : 26}px;}.appsub{font-size:${isStory ? 20 : 18}px;}.stars{font-size:${isStory ? 22 : 20}px;}
  </style></head>
  <body><div class="poster">
    <div class="grain"></div><div class="glowtop"></div><div class="pitch"></div>
    <div class="badge">⚽ ${p.kicker}</div>
    <div class="wc">${p.wc.join('<br>')}</div>
    <div class="sub">${p.sub}</div>
    <div class="stage"><div class="phone"><img src="${b64(p.shot)}"></div></div>
    <div class="footer">
      <div class="cta">▶ Download Free</div>
      <div class="appwrap">
        <div class="app">Dynasty Manager: Football</div>
        <div class="stars">★★★★★ <span class="appsub">on the App Store</span></div>
      </div>
    </div>
  </div></body></html>`;
}

const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--no-sandbox'] });
for (const p of posters) {
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1 });
  const file = join(OUT, p.id + '.html');
  writeFileSync(file, html(p));
  await page.goto('file://' + file, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200); // let webfonts settle
  await page.screenshot({ path: join(OUT, p.id + '.png') });
  await page.close();
  console.log('rendered', p.id, `${p.w}x${p.h}`);
}
await browser.close();
console.log('DONE');
