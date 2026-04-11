import type { MatchEvent, WeatherCondition, PitchCondition } from '@/types/game';
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

export function getCommentaryStyle(event: MatchEvent): { textClass: string; prefix: string } {
  switch (event.type) {
    case 'goal':
    case 'penalty_scored':
    case 'free_kick_goal':
    case 'long_range_goal':
    case 'counter_attack_goal':
    case 'header_goal':
      return { textClass: 'text-foreground font-bold', prefix: '' };
    case 'goalkeeper_error':
      return { textClass: 'text-foreground font-bold', prefix: '' };
    case 'var_check':
      return { textClass: 'text-amber-400 font-semibold italic', prefix: '' };
    case 'own_goal':
      return { textClass: 'text-destructive font-bold', prefix: '' };
    case 'penalty_missed':
      return { textClass: 'text-amber-400', prefix: '' };
    case 'shot_saved':
      return { textClass: 'text-blue-400', prefix: '' };
    case 'shot_missed':
      return { textClass: 'text-muted-foreground', prefix: '' };
    case 'hit_woodwork':
      return { textClass: 'text-amber-400 font-semibold', prefix: '' };
    case 'goal_line_clearance':
      return { textClass: 'text-amber-400 font-semibold', prefix: '' };
    case 'yellow_card':
      return { textClass: 'text-amber-400', prefix: '' };
    case 'red_card':
      return { textClass: 'text-destructive font-bold', prefix: '' };
    case 'injury':
      return { textClass: 'text-destructive', prefix: '' };
    case 'extra_time_goal':
      return { textClass: 'text-primary font-bold', prefix: '' };
    case 'penalty_shootout':
      return { textClass: 'text-primary font-black', prefix: '' };
    case 'foul':
      return { textClass: 'text-muted-foreground/70', prefix: '' };
    case 'commentary':
      return { textClass: 'text-muted-foreground/60 italic', prefix: '' };
    case 'kickoff':
    case 'half_time':
    case 'full_time':
      return { textClass: 'text-primary font-semibold', prefix: '' };
    default:
      return { textClass: 'text-muted-foreground', prefix: '' };
  }
}

export function enrichDescription(event: MatchEvent, ctx: CommentaryContext): string {
  if (!(GOAL_DISPLAY_TYPES as readonly string[]).includes(event.type)) return event.description;
  const scoringClubIsHome = event.clubId === ctx.homeClubId;
  const extra = getScoreContext(ctx, scoringClubIsHome);
  return extra ? `${event.description} ${extra}` : event.description;
}

// ── Commentary Generation ──

const POSSESSION_LINES = [
  '{team} working the ball patiently in midfield.',
  'Patient build-up play from {team}.',
  '{team} keep possession, probing for an opening.',
  'Neat passing from {team} but no clear opening yet.',
  '{team} recycling the ball across the backline.',
];

const PRESSURE_LINES = [
  '{team} pressing high up the pitch.',
  'Relentless pressure from {team} here.',
  '{opp} pinned back under sustained pressure.',
  '{team} winning the ball back quickly in the opposition half.',
  'The tempo from {team} has been intense.',
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
];

const ATMOSPHERE_LINES = [
  'The crowd urges their team forward.',
  'Growing tension at the stadium.',
  'Both sets of fans making themselves heard.',
  'The noise levels rising here.',
  'The atmosphere is electric.',
];

const LEVEL_LINES = [
  'Neither side able to find a breakthrough so far.',
  'A cagey affair — both teams well organised.',
  'Evenly matched so far in this contest.',
  'Both teams cancelling each other out.',
];

const LEADING_LINES = [
  '{team} looking comfortable in possession now.',
  '{team} managing the game well from here.',
  '{opp} need to find a response quickly.',
  '{opp} searching desperately for a way back into the game.',
];

const TRAILING_LINES = [
  '{team} need to push forward if they want to get back into this.',
  'Growing urgency from {team} as the clock ticks on.',
  '{team} looking for a way back into the match.',
  '{team} throwing bodies forward but {opp} holding firm for now.',
  'Can {team} find a way through? {opp} defending resolutely.',
];

// ── Weather-Specific Pools ──

const RAIN_LINES = [
  'The rain is relentless. {team} struggling to keep their passing crisp.',
  'Conditions are deteriorating — the ball skidding off the wet surface.',
  'Players soaked through. {team} adapting their game to the conditions.',
  'The rain making every tackle a gamble on this slippery surface.',
];

const SNOW_LINES = [
  'Visibility is a real problem in this snow. {team} resorting to shorter passes.',
  'The pitch markings are barely visible under the snow.',
  'Heavy snow making it difficult for {team} to pick out runners.',
  '{team} battling the elements as much as the opposition in these conditions.',
];

const WIND_LINES = [
  'The wind is playing havoc with the long balls. {team} keeping it on the deck.',
  'A gust catches that cross and carries it away. Nightmare conditions.',
  '{team} playing into the wind this half — every clearance is a battle.',
  'The swirling wind making life miserable for both sides out there.',
];

const POOR_PITCH_LINES = [
  'The surface is cutting up badly. Neither side can get the ball to run true.',
  'A bobble on this poor pitch almost gifts {opp} a chance.',
  'The divots on this surface are causing problems for both sides.',
];

const WATERLOGGED_LINES = [
  'The ball holds up in standing water near the touchline. Awful conditions.',
  'Players slipping and sliding on the waterlogged pitch. Something has to give.',
  'There are genuine concerns about whether this pitch is playable.',
];

// ── Derby-Specific Pools ──

const DERBY_LINES = [
  'The rivalry adds an edge to every challenge. This is no ordinary match.',
  'Both sets of fans at boiling point. The noise is deafening!',
  'You can feel the hostility from the stands. Every 50-50 is a war.',
  'Neither side willing to give an inch in this derby. The tackles are flying in.',
];

const DERBY_INTENSE_LINES = [
  'This is one of the fiercest derbies in football. No quarter given or expected.',
  'The hatred between these two sides is palpable. Every ball is contested.',
  'Absolute bedlam in the stands! This is what this rivalry is all about!',
  'Form goes out the window in matches like these. Pure passion on display.',
];

// ── Repetition Prevention ──
// Tracks which gap-filler templates have been used this match to reduce repetition.
let usedCommentaryLines: Set<string> = new Set();

/** Reset used lines at the start of each match */
export function resetCommentaryTracking(): void {
  usedCommentaryLines = new Set();
}

/** Pick a line from a pool, preferring unused lines. Falls back to any line if all are used. */
function pickFreshLine(pool: string[]): string {
  const fresh = pool.filter(l => !usedCommentaryLines.has(l));
  const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
  usedCommentaryLines.add(chosen);
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
): string {
  const team = isHome ? homeShortName : awayShortName;
  const opp = isHome ? awayShortName : homeShortName;
  const teamGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;

  // Weight pools based on game state
  const pools: string[][] = [];

  // Always include general pools
  pools.push(POSSESSION_LINES, CHANCE_LINES);

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

  // Weather-specific pools (when weather is not clear)
  if (weather && weather !== 'clear' && Math.random() < WEATHER_COMMENTARY_CHANCE) {
    if (weather === 'rain') pools.push(RAIN_LINES);
    else if (weather === 'snow') pools.push(SNOW_LINES);
    else if (weather === 'wind') pools.push(WIND_LINES);
  }

  // Pitch condition pools (always added when poor/waterlogged since they're rare)
  if (pitch === 'poor') pools.push(POOR_PITCH_LINES);
  else if (pitch === 'waterlogged') pools.push(WATERLOGGED_LINES);

  // Derby-specific pools
  if (derbyIntensity && derbyIntensity > 0 && Math.random() < DERBY_COMMENTARY_CHANCE) {
    pools.push(DERBY_LINES);
    if (derbyIntensity === 3) pools.push(DERBY_INTENSE_LINES);
  }

  // Pick from a random pool, then a fresh line (avoiding recent repeats)
  const pool = pick(pools);
  const line = pickFreshLine(pool);

  return line.replace(/\{team\}/g, team).replace(/\{opp\}/g, opp);
}
