/*
 * gen.mjs — generate App Store screenshots from REAL in-game captures.
 *
 *   node marketing/app-store/gen.mjs
 *
 * Each shot frames an actual screenshot of the running app (captured by
 * capture.mjs into dist/cap-*.png at 628×1308@2x) inside a device mockup,
 * with a headline + feature-highlight callouts. Emits two files per shot
 * that share markup and differ only by the canvas class:
 *   shot-NN-key.iphone.html → 1290×2796  (Apple 6.9")
 *   shot-NN-key.ipad.html   → 2048×2732  (Apple 12.9" iPad Pro)
 *
 * render-all.sh rasterises every *.html → dist/*.png at exact 1x size.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));

const STAR = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>`;

const callout = (slot, label, value, vclass = '', dot = '') =>
  `<div class="callout ${vclass ? 'gold-edge' : ''} ${slot}"><div class="label">${dot ? `<span class="d" style="background:${dot}"></span>` : ''}${label}</div><div class="value ${vclass}">${value}</div></div>`;
const chip = (txt, gold = false) =>
  `<div class="chip ${gold ? 'chip-gold' : ''}">${gold ? '<span class="ic"></span>' : ''}${txt}</div>`;
const pills = (items) => `<div class="pills">${items.map(([t, g]) => chip(t, g)).join('')}</div>`;
const badge = (label, sub) => `
  <div class="badge">
    <div class="laurel">
      <svg class="leaf" viewBox="0 0 60 110" fill="currentColor"><path d="M52 6C30 14 18 34 18 60c0 20 8 36 22 46-18-6-30-26-30-50C10 30 28 10 52 6z"/></svg>
      <div class="mid">
        <div class="stars">${STAR}${STAR}${STAR}${STAR}${STAR}</div>
        <div class="blab">${label}</div>
        <div class="bsub">${sub}</div>
      </div>
      <svg class="leaf" viewBox="0 0 60 110" fill="currentColor" style="transform:scaleX(-1)"><path d="M52 6C30 14 18 34 18 60c0 20 8 36 22 46-18-6-30-26-30-50C10 30 28 10 52 6z"/></svg>
    </div>
  </div>`;

const EM = '#22c98a'; // emerald dot
const GD = 'hsl(43 96% 52%)';
const BL = 'hsl(215 72% 66%)';

/* ── 10 shots, each over a real capture ────────────────────────────── */
const SHOTS = [
  { key: '01-dashboard', cap: 'dashboard', glow: 'glow-gold', kicker: 'your weekly hub',
    h: ['Build a', '<span class="em">football dynasty</span>'],
    lede: 'Train, transfer, and take your club through <strong>a multi-season career</strong> — every decision is yours.',
    extras: badge('Dynasty Manager', 'Football · Free on iOS') },

  { key: '02-clubs', cap: 'clubs', glow: 'glow-accent', kicker: '45 leagues · 37 countries',
    h: ['Manage the', '<span class="em">clubs you love</span>'],
    lede: 'Pick from <strong>756 real clubs</strong> — from the Premier League to Serie A, Brazil and the MLS.',
    extras: pills([['Premier League', true], ['La Liga'], ['Serie A'], ['Bundesliga', true], ['Ligue 1'], ['Brasileirão'], ['MLS']]) },

  { key: '03-squad', cap: 'squad', glow: 'glow-gold', kicker: 'real players · real ratings',
    h: ['Build your', '<span class="em">dream squad</span>'],
    lede: 'Thousands of <strong>real footballers</strong> with detailed attributes, form, fitness and morale.',
    extras: callout('slot-lt', 'Squad', '24 players', '') + callout('slot-rt', 'Avg rating', '82 OVR', 'gold') + callout('slot-rb', 'Depth vs league', '+8', 'green', EM) },

  { key: '04-tactics', cap: 'tactics', glow: 'glow-emerald', kicker: 'formations · roles · chemistry',
    h: ['Master', '<span class="em">your tactics</span>'],
    lede: 'Drag your XI into shape, build team chemistry and dictate the press with <strong>10 formations</strong>.',
    extras: callout('slot-lt', 'Chemistry', '+12%', 'green', EM) + callout('slot-rt', 'Mentality', '5 styles', 'blue') + callout('slot-lb', 'Formations', '10', 'gold') },

  { key: '05-live', cap: 'live', glow: 'glow-emerald', kicker: 'minute-by-minute match engine',
    h: ['Live', '<span class="em">every minute</span>'],
    lede: 'Watch matches unfold with live xG and momentum — change mentality and <strong>turn the game from the touchline</strong>.',
    extras: callout('slot-lt', 'Live xG', '0.15', 'green', EM) + callout('slot-rt', 'Momentum', '53%', 'gold') + callout('slot-lb', 'Half-time', 'Team talk', 'blue') },

  { key: '06-transfers', cap: 'transfers', glow: 'glow-gold', kicker: 'two windows · live negotiations',
    h: ['Win the', '<span class="em">transfer window</span>'],
    lede: 'Bid, haggle and hijack deals for world-class talent while you <strong>balance the wage bill</strong>.',
    extras: callout('slot-lt', 'Budget', '£120M', 'gold') + callout('slot-rt', 'Targets', 'POT 92', 'blue') + callout('slot-rb', 'Free agents', 'Live', 'green', EM) },

  { key: '07-packs', cap: 'packs', glow: 'glow-gold', kicker: 'FUT-style player packs',
    h: ['Chase', '<span class="em">the icons</span>'],
    lede: 'Open packs, hunt walkouts and pull <strong>rare gold and icon</strong> cards to upgrade your squad.',
    extras: callout('slot-lt', 'Top tier', 'RARE GOLD', 'gold') + callout('slot-rb', 'Reveal', 'Walkout', 'gold') },

  { key: '08-youth', cap: 'youth', glow: 'glow-violet', kicker: 'youth academy · scouting',
    h: ['Develop', '<span class="em">wonderkids</span>'],
    lede: 'Unearth teenage gems and grow them into <strong>generational talents</strong> season after season.',
    extras: callout('slot-lt', 'Dev speed', '+343%', 'green', EM) + callout('slot-rt', 'Prospects', '4 ready', 'gold') + callout('slot-rb', 'Top potential', '92', 'blue') },

  { key: '09-national', cap: 'national', glow: 'glow-accent', kicker: '51 nations · 5 confederations',
    h: ['Lead', '<span class="em">your nation</span>'],
    lede: 'Take a national-team job alongside your club, pick a 23-man squad and chase the <strong>World Cup</strong>.',
    extras: callout('slot-lt', 'Nations', '51', 'blue') + callout('slot-rb', 'Goal', 'WORLD CUP', 'gold') },

  { key: '10-league', cap: 'league', glow: 'glow-gold', kicker: 'promotion · relegation · cups',
    h: ['Climb', '<span class="em">every league</span>'],
    lede: 'Battle for the title, European places and survival across <strong>fully simulated pyramids</strong>.',
    extras: callout('slot-lt', 'Title race', 'Live table', 'gold') + callout('slot-rt', 'Europe', 'Top 4', 'blue') + callout('slot-rb', 'Relegation', 'Bottom 3', 'green', EM) },
];

const screen = (cap) =>
  `<div class="frame"><div class="screen"><img class="cap" src="dist/cap-${cap}.png" alt=""/><div class="island"></div></div></div>`;

const page = (shot, deviceClass) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Dynasty Manager — ${shot.h.join(' ').replace(/<[^>]+>/g, '')}</title>
<link rel="stylesheet" href="_appstore.css" />
</head>
<body>
<div class="shot${deviceClass ? ' ' + deviceClass : ''}">
  <div class="glow ${shot.glow}"></div>
  <div class="header">
    <div class="kicker">${shot.kicker}</div>
    <h1>${shot.h[0]}<br>${shot.h[1]}</h1>
    <p class="lede">${shot.lede}</p>
  </div>
  <div class="phone">${screen(shot.cap)}</div>
  ${shot.extras}
</div>
</body>
</html>
`;

let n = 0;
for (const shot of SHOTS) {
  writeFileSync(join(DIR, `shot-${shot.key}.iphone.html`), page(shot, ''));
  writeFileSync(join(DIR, `shot-${shot.key}.ipad.html`), page(shot, 'ipad'));
  n += 2;
}
console.log(`Generated ${n} files (${SHOTS.length} shots × 2 devices), all over real in-game captures.`);
