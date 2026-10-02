import type { MatchEvent, WeatherCondition, PitchCondition, Player } from '@/types/game';
import { pick } from '@/utils/helpers';
import {
  COMMENTARY_LATE_MINUTE, GOAL_DISPLAY_TYPES,
  WEATHER_COMMENTARY_CHANCE, DERBY_COMMENTARY_CHANCE,
} from '@/config/matchEngine';

interface CommentaryContext {
  homeGoals: number;
  awayGoals: number;
  homeClubId: string;
  isPlayerHome: boolean;
  minute: number;
}

const LATE_MINUTE = COMMENTARY_LATE_MINUTE;

function getScoreContext(ctx: CommentaryContext, scoringClubIsHome: boolean): string {
  const { homeGoals, awayGoals, minute } = ctx;
  const isLate = minute >= LATE_MINUTE;
  const scorerGoals = scoringClubIsHome ? homeGoals : awayGoals;
  const otherGoals = scoringClubIsHome ? awayGoals : homeGoals;

  if (scorerGoals === otherGoals) {
    if (isLate) return 'A late equalizer!';
    return 'They\'re level!';
  }
  if (scorerGoals === otherGoals + 1) {
    if (isLate) return 'A dramatic late winner!';
    return 'They take the lead!';
  }
  if (scorerGoals > otherGoals + 1) return 'Extending their lead!';
  if (scorerGoals < otherGoals) return 'They pull one back!';
  return '';
}


export function enrichDescription(event: MatchEvent, ctx: CommentaryContext): string {
  if (!(GOAL_DISPLAY_TYPES as readonly string[]).includes(event.type)) return event.description;
  // VAR rows must not get goal-context suffixes: var_disallowed means the
  // goal did NOT stand ("They take the lead!" would be a lie), and var_check
  // narration is already self-contained.
  if (event.type === 'var_disallowed' || event.type === 'var_check') return event.description;
  const scoringClubIsHome = event.clubId === ctx.homeClubId;
  const extra = getScoreContext(ctx, scoringClubIsHome);
  return extra ? `${event.description} ${extra}` : event.description;
}

// ── Commentary Generation ──

/** Who is on the pitch for one side, by role, as display surnames — so a
 *  filler line can name the players actually involved. */
export interface CommentaryCast {
  gk: string[]; def: string[]; mid: string[]; wide: string[]; fwd: string[];
}

const ROLE_OF: Record<string, keyof CommentaryCast> = {
  GK: 'gk', CB: 'def', LB: 'wide', RB: 'wide', LWB: 'wide', RWB: 'wide',
  CDM: 'mid', CM: 'mid', CAM: 'mid', LM: 'wide', RM: 'wide', LW: 'wide', RW: 'wide',
  ST: 'fwd', CF: 'fwd',
};

/** Group the players still on the pitch by role. */
export function commentaryCast(players: Player[]): CommentaryCast {
  const cast: CommentaryCast = { gk: [], def: [], mid: [], wide: [], fwd: [] };
  for (const p of players) cast[ROLE_OF[p.position] ?? 'mid'].push(p.lastName);
  return cast;
}

// Named lines: {mid} {mid2} {wide} {fwd} {def} {gk} are the side in
// possession; {oppDef} {oppGk} the side defending. A line is only used when
// every name it needs is on the pitch (and {mid}/{mid2} are two different
// players), so a back three or a side without a striker never reads wrong.
const NAMED_BUILDUP_LINES = [
  '{mid} picks it up in the centre circle and looks for options.',
  '{def} steps out from the back and plays it into {mid}.',
  '{mid} and {mid2} exchanging passes, waiting for the gap.',
  '{mid} switches the play out to {wide}.',
  '{wide} receives on the touchline and turns back inside.',
  '{gk} rolls it out to {def}. {team} starting again from the back.',
  '{mid} drops deep to collect, trying to set the tempo.',
  '{wide} overlaps and asks for it — {mid} chooses the safer pass.',
  '{fwd} drops off the front line to link the play.',
  '{mid} is finding pockets of space. {opp} need to pick him up.',
];

const NAMED_CHANCE_LINES = [
  '{mid} threads it through for {fwd} — {oppDef} gets across just in time.',
  '{wide} whips one in, but {oppGk} comes and claims it.',
  '{fwd} spins {oppDef} but takes one touch too many.',
  '{wide} skips past his man and cuts it back — cleared by {oppDef}.',
  '{mid} tries his luck from distance. Well over.',
  '{fwd} holds it up well and lays it off to {mid}; the move fizzles out.',
  '{wide} drives at {oppDef}, who stands him up superbly.',
  'Lovely feet from {mid} on the edge of the area, but {opp} crowd him out.',
  '{fwd} gambles on the through ball — {oppGk} is out quickly to sweep.',
  '{mid} lofts it towards {fwd}. {oppDef} wins the header.',
];

const NAMED_DEFENSIVE_LINES = [
  'Big moment from {oppDef} — a perfectly timed tackle on {fwd}.',
  '{oppDef} reads it and intercepts. {opp} can breathe again.',
  '{oppGk} gathers comfortably. {team} reset.',
  '{oppDef} heads clear under pressure from {fwd}.',
];

/** Early and pre-half-time framing, which a broadcaster never misses. */
const OPENING_LINES = [
  'A cagey opening few minutes — both sides feeling each other out.',
  '{team} trying to settle into the game early on.',
  'Plenty of early ball-watching. Nobody wants to make the first mistake.',
];
const BEFORE_BREAK_LINES = [
  '{team} pushing for one more chance before the break.',
  'Not long until half-time now.',
  'The fourth official is getting ready for the end of the half.',
];

function fillNames(line: string, team: CommentaryCast | undefined, opp: CommentaryCast | undefined): string | null {
  if (!/\{(mid2?|wide|fwd|def|gk|oppDef|oppGk)\}/.test(line)) return line;
  if (!team || !opp) return null;
  const pickOf = (xs: string[]) => (xs.length ? xs[Math.floor(Math.random() * xs.length)] : null);
  const mid = /\{mid2?\}/.test(line) ? pickOf(team.mid) : '';
  const mid2 = line.includes('{mid2}') ? pickOf(team.mid.filter(n => n !== mid)) : '';
  const names: Record<string, string | null> = {
    mid, mid2,
    wide: line.includes('{wide}') ? pickOf(team.wide) : '',
    fwd: line.includes('{fwd}') ? pickOf(team.fwd) : '',
    def: line.includes('{def}') ? pickOf(team.def) : '',
    gk: line.includes('{gk}') ? pickOf(team.gk) : '',
    oppDef: line.includes('{oppDef}') ? pickOf(opp.def) : '',
    oppGk: line.includes('{oppGk}') ? pickOf(opp.gk) : '',
  };
  if (Object.values(names).some(v => v === null)) return null;
  return line.replace(/\{(mid2?|wide|fwd|def|gk|oppDef|oppGk)\}/g, (_, k: string) => names[k] as string);
}

// Pools are deliberately generous. `pickFreshLine` avoids repeats WITHIN a
// match, but `usedLines` resets at kickoff, so a thin pool reads as repetitive
// across a season — the player sees these lines 40+ times a campaign. Keep the
// register consistent when adding: present tense, British football broadcast
// voice, one sentence (two at most), no exclamation unless something happened.

const POSSESSION_LINES = [
  '{team} working the ball patiently in midfield.',
  'Patient build-up play from {team}.',
  '{team} keep possession, probing for an opening.',
  'Neat passing from {team} but no clear opening yet.',
  '{team} recycling the ball across the backline.',
  '{team} content to hold the ball and wait for the gap.',
  'Side to side from {team}, looking for a way in.',
  '{team} knocking it about with real composure.',
  'The ball comes back to the keeper — {team} in no rush at all.',
  '{team} controlling the rhythm of this match.',
  '{opp} chasing shadows while {team} keep it moving.',
];

const PRESSURE_LINES = [
  '{team} pressing high up the pitch.',
  'Relentless pressure from {team} here.',
  '{opp} pinned back under sustained pressure.',
  '{team} winning the ball back quickly in the opposition half.',
  'The tempo from {team} has been intense.',
  '{team} camped in the {opp} half now.',
  'Wave after wave of {team} attacks.',
  '{opp} cannot get out — every clearance comes straight back.',
  '{team} hunting in packs the moment they lose it.',
  'Corner after corner for {team}. Something has to give.',
  '{opp} look rattled under this {team} pressure.',
];

const CHANCE_LINES = [
  'A promising move from {team} breaks down in the final third.',
  'Good combination play but the final ball is overhit.',
  '{team} almost create something there, but the defense holds.',
  'A dangerous cross from {team} is cleared by the defense.',
  'Quick counter from {team} but the pass is cut out.',
  '{team} work an opening but the shot is blocked.',
  'A ball over the top from {team} — just too much pace on it.',
  'Neat one-two on the edge of the box but {opp} scramble it clear.',
  'Whipped in from the right by {team} — nobody attacks it.',
  '{team} switch it wide but the cross is claimed at the near post.',
  'A half-chance for {team}, dragged wide of the far post.',
  'The {team} striker gets a yard but the effort is smothered.',
  '{team} break at pace, three on two — and the final pass is heavy.',
  'A clever dink into the box from {team}, headed behind for a corner.',
  '{opp} throw a body in the way and block it brilliantly.',
  '{team} win a free kick in a dangerous area — this looks inviting.',
  'Deflected behind off a {opp} boot. Another set piece for {team}.',
  '{team} work it to the byline but the pull-back finds nobody.',
];

const ATMOSPHERE_LINES = [
  'The crowd urges their team forward.',
  'Growing tension at the stadium.',
  'Both sets of fans making themselves heard.',
  'The noise levels rising here.',
  'The atmosphere is electric.',
  'You can feel the nerves in this stadium.',
  'The home end is on its feet.',
  'A wall of noise every time the ball goes forward.',
  'The bench is up, urging them on.',
  'Every touch is being cheered now.',
  'The clock is the enemy for somebody here.',
];

const LEVEL_LINES = [
  'Neither side able to find a breakthrough so far.',
  'A cagey affair — both teams well organised.',
  'Evenly matched so far in this contest.',
  'Both teams cancelling each other out.',
  'Nothing between these two sides at the moment.',
  'A game of fine margins. Whoever blinks first loses this.',
  'Two well-drilled sides. Space is at a premium.',
  'Still all square, and still anybody\'s game.',
  'It is being fought out in the middle of the pitch, this one.',
];

const LEADING_LINES = [
  '{team} looking comfortable in possession now.',
  '{team} managing the game well from here.',
  '{opp} need to find a response quickly.',
  '{opp} searching desperately for a way back into the game.',
  '{team} happy to slow this down and see it out.',
  '{team} taking the sting out of the match.',
  '{opp} are running out of ideas — and time.',
  'The {team} bench looks calm. They can see this one out.',
  '{opp} pushing bodies forward and leaving gaps behind.',
  '{team} content to sit in and defend the lead.',
];

const TRAILING_LINES = [
  '{team} need to push forward if they want to get back into this.',
  'Growing urgency from {team} as the clock ticks on.',
  '{team} looking for a way back into the match.',
  '{team} throwing bodies forward but {opp} holding firm for now.',
  'Can {team} find a way through? {opp} defending resolutely.',
  '{team} committing everything forward now — it is all or nothing.',
  'The {team} manager is on the touchline demanding more.',
  '{team} launching it long and hoping for a mistake.',
  'Time is against {team}, and they know it.',
  '{team} pouring forward — but they are wide open at the back.',
  'Everything {team} try is running into a {opp} shirt.',
];

// ── Weather-Specific Pools ──

const RAIN_LINES = [
  'The rain is relentless. {team} struggling to keep their passing crisp.',
  'Conditions are deteriorating — the ball skidding off the wet surface.',
  'Players soaked through. {team} adapting their game to the conditions.',
  'The rain making every tackle a gamble on this slippery surface.',
  'The ball zips off the wet grass — {team} are overhitting everything.',
  'A {team} defender loses his footing in the downpour. Nervy stuff.',
  'The rain is sheeting down across the stand now.',
  '{team} keeping it simple in these conditions, and you cannot blame them.',
];

const SNOW_LINES = [
  'Visibility is a real problem in this snow. {team} resorting to shorter passes.',
  'The pitch markings are barely visible under the snow.',
  'Heavy snow making it difficult for {team} to pick out runners.',
  '{team} battling the elements as much as the opposition in these conditions.',
  'The ball stops dead in the snow. Nothing runs true out there.',
  'The groundstaff are out clearing the lines again.',
  '{team} have gone to the long ball — you can hardly see the far touchline.',
  'Football in the snow. Everyone just wants to get to full time.',
];

const WIND_LINES = [
  'The wind is playing havoc with the long balls. {team} keeping it on the deck.',
  'A gust catches that cross and carries it away. Nightmare conditions.',
  '{team} playing into the wind this half — every clearance is a battle.',
  'The swirling wind making life miserable for both sides out there.',
  'The corner flags are horizontal. Brutal conditions.',
  'A {team} goal kick barely clears the halfway line in that gale.',
  'The wind holds the ball up and {opp} nick it back.',
  'Impossible to judge a flight in this. Both keepers look uneasy.',
];

const POOR_PITCH_LINES = [
  'The surface is cutting up badly. Neither side can get the ball to run true.',
  'A bobble on this poor pitch almost gifts {opp} a chance.',
  'The divots on this surface are causing problems for both sides.',
  'A big chunk of turf comes up as a {team} player turns.',
  'The centre circle is more sand than grass now.',
  'You cannot play a passing game on a pitch like this.',
];

const WATERLOGGED_LINES = [
  'The ball holds up in standing water near the touchline. Awful conditions.',
  'Players slipping and sliding on the waterlogged pitch. Something has to give.',
  'There are genuine concerns about whether this pitch is playable.',
  'Spray everywhere as a {team} player slides in. The pitch is soaked.',
  'The referee has had a look at the surface — the game goes on for now.',
  'Every pass dies in the water. This is a lottery.',
];

// ── Derby-Specific Pools ──

const DERBY_LINES = [
  'The rivalry adds an edge to every challenge. This is no ordinary match.',
  'Both sets of fans at boiling point. The noise is deafening!',
  'You can feel the hostility from the stands. Every 50-50 is a war.',
  'Neither side willing to give an inch in this derby. The tackles are flying in.',
  'Handbags in the middle of the pitch. Tempers are short today.',
  'The referee has a word with both captains. He can feel it too.',
  'Bragging rights on the line, and both sets of players know it.',
  'Another crunching challenge. This is a proper derby.',
];

const DERBY_INTENSE_LINES = [
  'This is one of the fiercest derbies in football. No quarter given or expected.',
  'The hatred between these two sides is palpable. Every ball is contested.',
  'Absolute bedlam in the stands! This is what this rivalry is all about!',
  'Form goes out the window in matches like these. Pure passion on display.',
  'The whole city stops for this fixture. You can hear why.',
  'That will be remembered long after the final whistle.',
  'Bodies on the line in every single duel. Remarkable intensity.',
  'This is not a football match any more. This is personal.',
];

/** Pick a line from a pool, preferring unused lines. Falls back to any line if all are used.
 *  usedLines is a plain array (not Set) so HalfState survives JSON serialization on save.
 *  The dedupe-on-push guard keeps `usedLines` bounded by the pool size even across the
 *  fallback path, so `.includes()` checks stay cheap for the length of a match. */
function pickFreshLine(pool: string[], usedLines: string[]): string {
  const fresh = pool.filter(l => !usedLines.includes(l));
  const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
  if (!usedLines.includes(chosen)) usedLines.push(chosen);
  return chosen;
}

export function generateCommentary(
  minute: number,
  homeShortName: string,
  awayShortName: string,
  homeGoals: number,
  awayGoals: number,
  isHome: boolean,
  momentum: number,
  weather?: WeatherCondition,
  pitch?: PitchCondition,
  derbyIntensity?: number,
  usedLines?: string[],
  /** Who is on the pitch, home and away — enables the player-named lines. */
  cast?: { home: CommentaryCast; away: CommentaryCast },
): string {
  const team = isHome ? homeShortName : awayShortName;
  const opp = isHome ? awayShortName : homeShortName;
  const teamGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;
  const used = usedLines ?? [];
  const fmt = (line: string) => line.replace(/\{team\}/g, team).replace(/\{opp\}/g, opp);

  // Weather short-circuit: configured chance directly selects a weather line
  if (weather && weather !== 'clear' && Math.random() < WEATHER_COMMENTARY_CHANCE) {
    const weatherPool = weather === 'rain' ? RAIN_LINES : weather === 'snow' ? SNOW_LINES : WIND_LINES;
    return fmt(pickFreshLine(weatherPool, used));
  }

  // Derby short-circuit: configured chance directly selects a derby line
  if (derbyIntensity && derbyIntensity > 0 && Math.random() < DERBY_COMMENTARY_CHANCE) {
    const derbyPool = derbyIntensity === 3 && Math.random() < 0.5 ? DERBY_INTENSE_LINES : DERBY_LINES;
    return fmt(pickFreshLine(derbyPool, used));
  }

  // Weight general pools based on game state
  const pools: string[][] = [];

  // Always include general pools
  pools.push(POSSESSION_LINES, CHANCE_LINES);

  // Player-named play — weighted in twice, so most filler names somebody.
  if (cast) pools.push(NAMED_BUILDUP_LINES, NAMED_CHANCE_LINES, NAMED_BUILDUP_LINES, NAMED_CHANCE_LINES, NAMED_DEFENSIVE_LINES);

  // Time framing
  if (minute <= 8) pools.push(OPENING_LINES);
  else if (minute >= 40 && minute <= 45) pools.push(BEFORE_BREAK_LINES);

  // Momentum-based: dominant team presses
  if (Math.abs(momentum) > 15) {
    pools.push(PRESSURE_LINES);
  }

  // Score-based context
  if (teamGoals === oppGoals) {
    pools.push(LEVEL_LINES);
  } else if (teamGoals > oppGoals) {
    pools.push(LEADING_LINES);
  } else {
    pools.push(TRAILING_LINES);
  }

  // Late game atmosphere
  if (minute > 70) {
    pools.push(ATMOSPHERE_LINES);
  }

  // Pitch condition pools (always added when poor/waterlogged since they're rare)
  if (pitch === 'poor') pools.push(POOR_PITCH_LINES);
  else if (pitch === 'waterlogged') pools.push(WATERLOGGED_LINES);

  // Pick from a random pool, then a fresh line (avoiding recent repeats).
  // A named line whose roles this side can't fill falls back to a team line.
  const pool = pick(pools);
  const line = pickFreshLine(pool, used);
  const teamCast = cast ? (isHome ? cast.home : cast.away) : undefined;
  const oppCast = cast ? (isHome ? cast.away : cast.home) : undefined;
  const named = fillNames(line, teamCast, oppCast);
  return fmt(named ?? pickFreshLine(POSSESSION_LINES, used));
}
