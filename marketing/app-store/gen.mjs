/*
 * gen.mjs — generate App Store screenshot HTML for both devices from one spec.
 *
 *   node marketing/app-store/gen.mjs
 *
 * Emits, per shot, two files that share identical markup and differ only by
 * the `.shot` / `.shot.ipad` canvas class (the stylesheet does the reflow):
 *   shot-NN-key.iphone.html   → 1290×2796  (Apple 6.9")
 *   shot-NN-key.ipad.html     → 2048×2732  (Apple 12.9" iPad Pro)
 *
 * render-all.sh rasterises every *.html in this directory to dist/*.png.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));

/* ── small markup helpers ──────────────────────────────────────────── */
const crest = (txt, c1, c2, cls = '') =>
  `<div class="crest ${cls}" style="background:linear-gradient(135deg,${c1},${c2})">${txt}</div>`;
const STAR = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>`;
const PERSON = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4.2"/><path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8z"/></svg>`;
const TROPHY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4zM4 5h2v2a2 2 0 0 1-2-2zm16 0a2 2 0 0 1-2 2V5h2zM10 12h4v3h-4zM8 17h8v3H8z"/></svg>`;
const COLORS = {
  red: ['hsl(0 75% 45%)', 'hsl(0 75% 30%)'],
  blue: ['hsl(212 70% 45%)', 'hsl(212 70% 28%)'],
  sky: ['hsl(202 70% 48%)', 'hsl(202 70% 30%)'],
  dark: ['hsl(0 0% 30%)', 'hsl(0 0% 14%)'],
  crimson: ['hsl(348 80% 48%)', 'hsl(348 80% 30%)'],
  silver: ['hsl(0 0% 88%)', 'hsl(0 0% 58%)'],
  navy: ['hsl(222 60% 45%)', 'hsl(222 60% 26%)'],
  green: ['hsl(150 60% 38%)', 'hsl(150 60% 22%)'],
  orange: ['hsl(28 85% 50%)', 'hsl(28 85% 32%)'],
};

/* tab bars shown at the bottom of each device screen */
const TAB_ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>`,
  squad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 21c0-2.5 1.5-4.5 4-5"/></svg>`,
  match: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l3 2-1 4h-4l-1-4z"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10v4a5 5 0 0 1-10 0zM5 5H4a2 2 0 0 0 2 2M19 5h1a2 2 0 0 1-2 2M9 18h6M8 21h8"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`,
};
const tabbar = (active) => {
  const items = [['home', 'Home'], ['squad', 'Squad'], ['match', 'Match'], ['trophy', 'Trophies'], ['more', 'More']];
  return `<div class="tabbar">${items.map(([k, l]) =>
    `<div class="t ${k === active ? 'on' : ''}">${TAB_ICONS[k]}<span>${l}</span></div>`).join('')}</div>`;
};

const statusbar = `<div class="statusbar"><span>9:41</span><span class="dots"><i></i><i></i><i></i></span></div>`;
const screen = (cls, inner, tab) =>
  `<div class="frame"><div class="screen"><div class="island"></div>${statusbar}<div class="scr ${cls}">${inner}</div>${tabbar(tab)}</div></div>`;

const callout = (slot, label, value, vclass = '', dot = '') =>
  `<div class="callout ${vclass ? 'gold-edge' : ''} ${slot}"><div class="label">${dot ? `<span class="d" style="background:${dot}"></span>` : ''}${label}</div><div class="value ${vclass}">${value}</div></div>`;
const chip = (txt, gold = false) =>
  `<div class="chip ${gold ? 'chip-gold' : ''}">${gold ? '<span class="ic"></span>' : ''}${txt}</div>`;

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

/* ── per-screen builders (the app UI inside the device) ────────────── */
const tableRow = (pos, txt, c1, c2, nm, pts, lead = false) =>
  `<div class="row ${lead ? 'lead' : ''}"><div class="pos">${pos}</div>${crest(txt, c1, c2, 'c')}<div class="nm">${nm}</div><div class="pts">${pts}</div></div>`;

const screenDash = () => screen('dash', `
  <div class="top">${crest('AR', ...COLORS.red)}<div><div class="club">Arsenal</div><div class="sub">Premier League · Season 3</div></div><div class="bal"><div class="v">£182M</div><div class="l">Transfer budget</div></div></div>
  <div class="panel panel-gold next">
    <div class="lab">Next match · Saturday</div>
    <div class="vs"><div class="side">${crest('AR', ...COLORS.red, 'c')}<div class="n">Arsenal</div></div><div class="mid">VS</div><div class="side">${crest('CH', ...COLORS.blue, 'c')}<div class="n">Chelsea</div></div></div>
  </div>
  <div class="sec-lab">League table</div>
  ${tableRow(1, 'AR', ...COLORS.red, 'Arsenal', 74, true)}
  ${tableRow(2, 'MC', ...COLORS.sky, 'Man City', 71)}
  ${tableRow(3, 'LI', ...COLORS.dark, 'Liverpool', 66)}
  ${tableRow(4, 'CH', ...COLORS.blue, 'Chelsea', 61)}
`, 'home');

const clubCard = (txt, c1, c2, nm, lg, fill, sel = false) =>
  `<div class="card ${sel ? 'sel' : ''}">${crest(txt, c1, c2)}<div class="nm">${nm}</div><div class="lg">${lg}</div><div class="stars">${Array.from({ length: 5 }, (_, i) => `<i class="${i < fill ? '' : 'off'}"></i>`).join('')}</div></div>`;
const screenClubs = () => screen('cg', `
  <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><span>Search 756 clubs…</span></div>
  <div class="grid">
    ${clubCard('AR', ...COLORS.red, 'Arsenal', 'England', 4, true)}
    ${clubCard('BA', ...COLORS.crimson, 'Barcelona', 'Spain', 5)}
    ${clubCard('JU', ...COLORS.silver, 'Juventus', 'Italy', 4)}
    ${clubCard('BM', 'hsl(0 80% 50%)', 'hsl(0 80% 30%)', 'Bayern', 'Germany', 5)}
    ${clubCard('PSG', ...COLORS.navy, 'Paris SG', 'France', 4)}
    ${clubCard('MC', ...COLORS.sky, 'Man City', 'England', 5)}
  </div>
`, 'home');

const screenMatch = () => screen('mt', `
  <div class="board">
    <div class="comp">Premier League · Matchday 28</div>
    <div class="line"><div class="side">${crest('AR', ...COLORS.red, 'c')}<div class="n">Arsenal</div></div><div class="sc">2&nbsp;–&nbsp;1</div><div class="side">${crest('CH', ...COLORS.blue, 'c')}<div class="n">Chelsea</div></div></div>
    <div class="min"><i></i> 78' &nbsp;LIVE</div>
  </div>
  <div class="feed">
    <div class="sec-lab">Key moments</div>
    <div class="ev goal"><div class="m">76'</div><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="hsl(152 68% 50%)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l3 2-1 4h-4l-1-4z"/></svg></div><div class="t"><strong>Goal!</strong> Saka makes it 2–1</div></div>
    <div class="ev"><div class="m">71'</div><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" stroke-width="2"><path d="M7 4v16M17 4v16M7 8l10 8M17 8L7 16"/></svg></div><div class="t">Substitution · Ødegaard on</div></div>
    <div class="ev"><div class="m">63'</div><div class="ic"><svg viewBox="0 0 24 24" fill="var(--gold)"><rect x="6" y="3" width="12" height="18" rx="2"/></svg></div><div class="t">Yellow card · Chelsea</div></div>
  </div>
`, 'match');

const screenPack = () => screen('pk', `
  <div class="head"><div class="lab">Icon pack · Walkout</div><div class="nm">You pulled…</div></div>
  <div class="pcard">
    <div class="hd"><div><div class="ovr">94</div><div class="pos">ST</div></div><div class="flag">★</div></div>
    <div class="sil">${PERSON}</div>
    <div class="name">R. CARLOS</div>
    <div class="stats">
      <div><div class="v">96</div><div class="k">PAC</div></div>
      <div><div class="v">92</div><div class="k">SHO</div></div>
      <div><div class="v">88</div><div class="k">PAS</div></div>
      <div><div class="v">90</div><div class="k">PHY</div></div>
    </div>
  </div>
  <div class="tier"><span class="t"><span class="dot"></span> Icon</span></div>
`, 'home');

const pdot = (x, y, num, name) => `<div class="dot-p" style="left:${x}%;top:${y}%"><div class="pp">${num}</div><div class="pn">${name}</div></div>`;
const screenTactics = () => screen('tc', `
  <div class="title"><div class="f">4-3-3</div><div class="l">Gegenpress</div></div>
  <div class="pitch">
    <div class="mark halfway"></div><div class="mark circle"></div>
    <div class="mark box top"></div><div class="mark box bot"></div>
    ${pdot(50, 92, 'GK', 'Raya')}
    ${pdot(16, 74, 'LB', 'Zinch.')}${pdot(38, 78, 'CB', 'Saliba')}${pdot(62, 78, 'CB', 'Gabriel')}${pdot(84, 74, 'RB', 'White')}
    ${pdot(30, 52, 'CM', 'Rice')}${pdot(50, 46, 'CM', 'Ødeg.')}${pdot(70, 52, 'CM', 'Havertz')}
    ${pdot(20, 24, 'LW', 'Martin.')}${pdot(50, 18, 'ST', 'Jesus')}${pdot(80, 24, 'RW', 'Saka')}
  </div>
`, 'squad');

const screenTransfer = () => screen('tf', `
  <div class="head"><div class="lab">Transfer · Bid accepted</div><div class="nm">Incoming signing</div></div>
  <div class="panel player"><div class="av">${PERSON}</div><div><div class="pn">V. Osimhen</div><div class="pm">ST · 26 · Napoli</div></div><div class="ov">89</div></div>
  <div class="lineitem"><div class="k">Transfer fee</div><div class="v gold-text">£94M</div></div>
  <div class="lineitem"><div class="k">Wage</div><div class="v">£310k / wk</div></div>
  <div class="lineitem"><div class="k">Contract</div><div class="v">5 years</div></div>
  <div class="lineitem"><div class="k">Squad rating after</div><div class="v" style="color:var(--emerald)">+3</div></div>
  <div class="accept">✓ Confirm signing</div>
`, 'home');

const troph = (count, name) => `<div class="tro">${TROPHY}<div class="c">×${count}</div><div class="n">${name}</div></div>`;
const screenCabinet = () => screen('cab', `
  <div class="head"><div class="lab">Career · Honours</div><div class="nm">Trophy cabinet</div></div>
  <div class="grid">
    ${troph(6, 'Premier League')}
    ${troph(3, 'Champions Cup')}
    ${troph(4, 'FA Cup')}
    ${troph(2, 'Super Cup')}
  </div>
  <div class="sec-lab" style="margin-top:20px">Manager prestige</div>
  ${tableRow('★', 'YOU', ...COLORS.red, 'Legendary · 9 seasons', 'Lv 24', true)}
`, 'trophy');

const tie = (txt, c1, c2, nm, sc, win = false) =>
  `<div class="tie ${win ? 'win' : ''}">${crest(txt, c1, c2, 'c')}<div class="nm">${nm}</div><div class="sc">${sc}</div></div>`;
const screenBracket = () => screen('br', `
  <div class="head"><div class="lab">Champions Cup · Knockout</div><div class="nm">Road to the final</div></div>
  <div class="round"><div class="rl">Quarter-final</div>${tie('AR', ...COLORS.red, 'Arsenal', '3–1', true)}${tie('RM', ...COLORS.silver, 'Real Madrid', '1–3')}</div>
  <div class="round"><div class="rl">Semi-final</div>${tie('AR', ...COLORS.red, 'Arsenal', '2–2 (4-2p)', true)}${tie('BM', 'hsl(0 80% 50%)', 'hsl(0 80% 30%)', 'Bayern', '2–2')}</div>
  <div class="round"><div class="rl">Final · Wembley</div>${tie('AR', ...COLORS.red, 'Arsenal', '2–0', true)}${tie('PSG', ...COLORS.navy, 'Paris SG', '0–2')}</div>
`, 'trophy');

const screenYouth = () => screen('yt', `
  <div class="head"><div class="lab">Youth Academy · Prospect</div><div class="nm">Wonderkid rising</div></div>
  <div class="panel prospect"><div class="av">${PERSON}</div><div><div class="pn">L. Mendes</div><div class="pm">AM · 17 · Academy</div></div><div class="pot"><div class="v">→ 91</div><div class="l">Potential</div></div></div>
  <div class="attr"><div class="row2"><span>Dribbling</span><span class="g">78 ▲ +6</span></div><div class="bar"><i class="grow" style="width:78%"></i></div></div>
  <div class="attr"><div class="row2"><span>Pace</span><span class="g">84 ▲ +4</span></div><div class="bar"><i class="grow" style="width:84%"></i></div></div>
  <div class="attr"><div class="row2"><span>Passing</span><span class="g">80 ▲ +5</span></div><div class="bar"><i class="grow" style="width:80%"></i></div></div>
  <div class="attr"><div class="row2"><span>Vision</span><span style="color:var(--muted-foreground)">75</span></div><div class="bar"><i style="width:75%"></i></div></div>
  <div class="attr"><div class="row2"><span>Finishing</span><span class="g">72 ▲ +3</span></div><div class="bar"><i class="grow" style="width:72%"></i></div></div>
`, 'squad');

const ntp = (n, nm, po, ov) => `<div class="pl"><div class="num">${n}</div><div class="pn">${nm}</div><div class="po">${po}</div><div class="ov">${ov}</div></div>`;
const screenNational = () => screen('nt', `
  <div class="head"><div class="lab">National team · Job offer</div></div>
  <div class="flagbig" style="background:linear-gradient(135deg,${COLORS.navy[0]},${COLORS.navy[1]})">EN</div>
  <div class="nm">England</div>
  <div class="comp">World Cup · Group stage</div>
  <div class="squad">
    ${ntp(9, 'H. Kane', 'ST', 90)}
    ${ntp(7, 'B. Saka', 'RW', 87)}
    ${ntp(10, 'J. Bellingham', 'CM', 89)}
    ${ntp(4, 'D. Rice', 'CM', 86)}
  </div>
`, 'trophy');

/* ── 10 shot specs ─────────────────────────────────────────────────── */
const SHOTS = [
  { key: '01-build', glow: 'glow-gold', kicker: '45 leagues · 756 real clubs',
    h: ['Built to win', '<span class="em">every season</span>'],
    lede: 'Take a club from the lower divisions to the top of the table — squads, tactics, transfers and <strong>a multi-season career</strong> in your pocket.',
    screen: screenDash, extras: badge('Dynasty Manager', 'Football · Free on iOS') },

  { key: '02-clubs', glow: 'glow-accent', kicker: '37 countries · real teams',
    h: ['Manage the', '<span class="em">clubs you love</span>'],
    lede: 'From the Premier League to Serie A, Brazil and the MLS — pick from <strong>756 real clubs</strong> and start your story anywhere.',
    screen: screenClubs,
    extras: `<div class="pills">${chip('Premier League', true)}${chip('La Liga')}${chip('Serie A')}${chip('Bundesliga', true)}${chip('Ligue 1')}${chip('Brasileirão')}${chip('MLS')}</div>` },

  { key: '03-match', glow: 'glow-emerald', kicker: 'minute-by-minute match engine',
    h: ['Live', '<span class="em">every minute</span>'],
    lede: 'Watch matches unfold in real time. Make subs, switch tactics and <strong>turn the game on its head</strong> from the touchline.',
    screen: screenMatch,
    extras: callout('slot-lt', 'Possession', '64%', 'green', 'var(--emerald)') + callout('slot-rt', 'Clock', "78'") + callout('slot-lb', 'Expected goals', '2.7', 'gold') },

  { key: '04-packs', glow: 'glow-gold', kicker: 'FUT-style player packs',
    h: ['Chase', '<span class="em">the icons</span>'],
    lede: 'Open packs, hunt walkouts and build a squad of legends — with <strong>real players</strong> from across the football world.',
    screen: screenPack,
    extras: callout('slot-lt', 'Walkout', '94', 'gold') + callout('slot-rb', 'Pull rarity', 'ICON', 'gold') },

  { key: '05-tactics', glow: 'glow-emerald', kicker: 'formations · roles · instructions',
    h: ['Master', '<span class="em">your tactics</span>'],
    lede: 'Set your shape, drag your XI into place and dictate the press — <strong>10 formations</strong> and custom instructions to outsmart any rival.',
    screen: screenTactics,
    extras: `<div class="pills">${chip('4-3-3', true)}${chip('4-2-3-1')}${chip('3-5-2')}${chip('Gegenpress', true)}${chip('Tiki-taka')}${chip('Counter')}</div>` },

  { key: '06-transfers', glow: 'glow-gold', kicker: 'two windows · live negotiations',
    h: ['Win the', '<span class="em">transfer window</span>'],
    lede: 'Bid, haggle and hijack deals. Sign world-class talent, balance the wage bill and <strong>build a squad of galácticos</strong>.',
    screen: screenTransfer,
    extras: callout('slot-lt', 'Bid', '£94M', 'gold') + callout('slot-rt', 'Rating', '89', 'blue') + callout('slot-rb', 'Squad boost', '+3', 'green') },

  { key: '07-career', glow: 'glow-gold', kicker: 'manage forever · build a legacy',
    h: ['Build a', '<span class="em">dynasty</span>'],
    lede: 'Stack silverware across the decades, climb the prestige ladder and earn your place in the <strong>Hall of Managers</strong>.',
    screen: screenCabinet, extras: badge('15 major trophies', '9-season career') },

  { key: '08-continental', glow: 'glow-violet', kicker: 'champions cup · 32 teams',
    h: ['Conquer', '<span class="em">Europe</span>'],
    lede: 'Battle through the groups and knockouts of three continental cups — <strong>and lift the trophy</strong> under the lights.',
    screen: screenBracket,
    extras: callout('slot-lt', 'Continental titles', '3', 'gold') + callout('slot-rb', 'Final', '2–0', 'gold') },

  { key: '09-youth', glow: 'glow-violet', kicker: 'youth academy · scouting · training',
    h: ['Develop', '<span class="em">wonderkids</span>'],
    lede: 'Unearth teenage gems, train them up and watch their attributes climb season after season into <strong>generational talents</strong>.',
    screen: screenYouth,
    extras: callout('slot-lt', 'Potential', '91', 'gold') + callout('slot-rt', 'Age', '17', 'blue') + callout('slot-rb', 'Growth', '+6 ▲', 'green') },

  { key: '10-national', glow: 'glow-accent', kicker: '51 nations · 5 confederations',
    h: ['Lead', '<span class="em">your nation</span>'],
    lede: 'Take a national-team job alongside your club, pick a 23-man squad and chase glory at the <strong>World Cup</strong>.',
    screen: screenNational,
    extras: callout('slot-lt', 'Squad size', '23', 'blue') + callout('slot-rb', 'Tournament', 'WORLD CUP', 'gold') },
];

/* ── emit ──────────────────────────────────────────────────────────── */
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
  <div class="phone">${shot.screen()}</div>
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
console.log(`Generated ${n} files (${SHOTS.length} shots × 2 devices).`);
