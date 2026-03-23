import type { MatchEvent } from '@/types/game';
import { pick } from '@/utils/helpers';

interface CommentaryContext {
  homeGoals: number;
  awayGoals: number;
  homeClubId: string;
  isPlayerHome: boolean;
  minute: number;
}

const LATE_MINUTE = 80;

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
      return { textClass: 'text-foreground font-bold', prefix: '' };
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
  if (event.type !== 'goal' && event.type !== 'penalty_scored' && event.type !== 'own_goal') return event.description;
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
  'Time ticking away for {opp} to find an equalizer.',
];

const TRAILING_LINES = [
  '{team} need to push forward if they want to get back into this.',
  'Growing urgency from {team} as the clock ticks on.',
  '{team} looking for a way back into the match.',
];

export function generateCommentary(
  minute: number,
  homeShortName: string,
  awayShortName: string,
  homeGoals: number,
  awayGoals: number,
  isHome: boolean,
  momentum: number,
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

  // Pick from a random pool, then a random line
  const pool = pick(pools);
  const line = pick(pool);

  return line.replace(/\{team\}/g, team).replace(/\{opp\}/g, opp);
}
