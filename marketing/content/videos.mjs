/**
 * Every video in the 30-day calendar (content/30-day-calendar.md) plus the two
 * pilot series from PLAYBOOK §13, as data. `render-calendar.mjs` turns each
 * entry into `<id>-ios.mp4` and `<id>-android.mp4`.
 *
 * kind 'ad'  — the ad harness (capture.html) via capture-ad.mjs: pack scenes.
 * kind 'app' — the real app via capture-app.mjs + a scene in
 *              postproduction/scenes/. Captions are written by the scene from
 *              the save's actual state, so a Road to Glory episode says what
 *              really happened in that season.
 *
 * `post` is the TikTok/Reels/Shorts caption. Rules (calendar "Rules for every
 * post"): no real player names, end on a question, 4–5 hashtags.
 */
const TAGS = '#footballgame #packopening #footballtiktok #managergame #iphonegames';
const STORY_TAGS = '#footballmanager #footballtiktok #managergame #iphonegames #roadtoglory';
const SUNDAY_TAGS = '#sundayleague #footballtiktok #grassrootsfootball #managergame #iphonegames';

const ad = (id, day, params, extra = {}) => ({
  id, day, kind: 'ad', plan: 'pack', params, trim: [0.3, 13.6], style: 'anthem', cue: 'pack5', ...extra,
});

export const VIDEOS = [
  // ── Harness pack videos (A01–A05, two cuts each) ──
  ad('day01-legends', 1, { tier: 'rare', legend: '1', hook: "YOUR LEGENDS DON'T RETIRE", mid: 'THEY COME BACK AS CARDS', midPos: 'mid' },
    { post: `Retire in your save, come back as a card. Keep him or sell him? ${TAGS}` }),
  ad('day03-rate-my-pull', 3, { tier: 'rare', minHero: '90', hook: 'RATE MY PULL 1–10', mid: 'BE HONEST', midPos: 'mid' },
    { post: `Rate it 1–10. Be honest. ${TAGS}` }),
  ad('day06-no-energy', 6, { tier: 'premium', hook: 'NO ENERGY. NO TIMERS.', mid: 'JUST FOOTBALL', midPos: 'mid' },
    { post: `What's the worst energy system you've played? ${TAGS}` }),
  ad('day08-pack-animation', 8, { tier: 'rare', minHero: '88', hook: 'NAME A BETTER PACK ANIMATION', mid: "I'LL WAIT.", midPos: 'mid' },
    { post: `Name a better one. I'll wait. ${TAGS}` }),
  ad('day11-real-faces', 11, { tier: 'icon', hook: 'REAL PLAYERS. REAL FACES.', mid: 'IN A FULL MANAGER GAME', midPos: 'mid', hookUntil: '3', midFrom: '5.2', midUntil: '8' },
    { plan: 'icon', trim: [0, 11.5], env: { ICON_HOLD: '12500' }, cue: 'icon', post: `A full manager game with real squads. Which league do you manage? ${TAGS}` }),
  ad('day13-great-retired', 13, { tier: 'rare', legend: '1', hook: 'A GREAT RETIRED IN MY SAVE', mid: "NOW HE'S BACK IN MY SQUAD", midPos: 'mid' },
    { post: `He retired. Then he came back. Would you start him? ${TAGS}` }),
  ad('day16-rate-my-pull-2', 16, { tier: 'rare', minHero: '90', hook: 'RATE MY PULL · ROUND 2', mid: '1–10?', midPos: 'mid' },
    { post: `Round 2. Better or worse than last time? ${TAGS}` }),
  ad('day19-no-timers', 19, { tier: 'premium', hook: 'THE MANAGER GAME WITHOUT TIMERS', mid: 'PLAY AT YOUR OWN PACE', midPos: 'mid' },
    { post: `No energy bar, no waiting. How long do you play in one sitting? ${TAGS}` }),
  ad('day23-pack-animation-2', 23, { tier: 'rare', minHero: '88', hook: 'NAME A BETTER PACK ANIMATION', mid: 'ROUND 2', midPos: 'mid' },
    { post: `Still waiting. ${TAGS}` }),
  ad('day25-every-face', 25, { tier: 'icon', hook: 'EVERY PLAYER HAS A FACE', mid: '756 REAL CLUBS', midPos: 'mid', hookUntil: '3', midFrom: '5.2', midUntil: '8' },
    { plan: 'icon', trim: [0, 11.5], env: { ICON_HOLD: '12500' }, cue: 'icon', post: `756 real clubs. Which one are you taking? ${TAGS}` }),

  // ── Pack Luck (free streak pack, real streak band) ──
  ...[[2, 1], [4, 3], [7, 7], [14, 14], [21, 21], [28, 28]].map(([day, streak]) => ({
    id: `day${String(day).padStart(2, '0')}-pack-luck-d${streak}`, day, kind: 'app', scene: 'pack-luck.mjs',
    env: { DAY: String(streak) }, style: 'anthem',
    post: `Free pack, day ${streak} of the streak. Guess tomorrow's best pull 👇 ${TAGS}`,
  })),

  // ── Road to Glory (one Doncaster save, episode by episode) ──
  ...[[5, 1], [10, 2], [15, 3], [18, 4], [22, 5], [26, 6], [30, 7]].map(([day, ep]) => ({
    id: `day${String(day).padStart(2, '0')}-road-ep${ep}`, day, kind: 'app', scene: 'road-to-glory.mjs',
    env: { EP: String(ep) }, style: 'cinematic',
    post: `Road to Glory, episode ${ep}. 4th tier, no money, one save. ${STORY_TAGS}`,
  })),

  // ── Sunday League ──
  ...[[12, 1], [17, 2], [24, 3]].map(([day, ep]) => ({
    id: `day${day}-sunday-ep${ep}`, day, kind: 'app', scene: 'sunday.mjs',
    env: { EP: String(ep) }, style: 'phonk',
    post: `Sunday League, week by week. Who's this in your team? ${SUNDAY_TAGS}`,
  })),

  // ── Ballon d'Or night (day 27 — move to the real ceremony evening) ──
  { id: 'day27-ballon-dor', day: 27, kind: 'app', scene: 'ballon-dor.mjs', env: {}, style: 'cinematic',
    post: `Who wins the Ballon d'Or in my save? Guess before the end. ${TAGS}` },

  // ── Pilots (PLAYBOOK §13) ──
  ...['wrexham', 'sunderland', 'leeds-united'].map(club => ({
    id: `pilot-club-${club}`, day: null, kind: 'app', scene: 'club-five-seasons.mjs',
    env: { CLUB: club }, style: 'cinematic',
    post: `Can they win the league in 5 seasons? Simmed in my save. Which club next? ${STORY_TAGS}`,
  })),
  ...[['arsenal', 'tottenham-hotspur'], ['real-madrid', 'barcelona']].map(([home, away]) => ({
    id: `pilot-predict-${home}-${away}`, day: null, kind: 'app', scene: 'predict.mjs',
    env: { HOME_CLUB: home, AWAY_CLUB: away }, style: 'phonk',
    post: `Simulated this one 1,000 times in my game's engine. Is it wrong? ${TAGS}`,
  })),
];
