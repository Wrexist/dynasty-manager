import type { MatchEvent } from '@/types/game';

interface CommentaryContext {
  homeGoals: number;
  awayGoals: number;
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
      return { textClass: 'text-foreground font-bold', prefix: '' };
    case 'save':
      return { textClass: 'text-blue-400', prefix: '' };
    case 'miss':
      return { textClass: 'text-muted-foreground', prefix: '' };
    case 'yellow_card':
      return { textClass: 'text-amber-400', prefix: '' };
    case 'red_card':
      return { textClass: 'text-destructive font-bold', prefix: '' };
    case 'injury':
      return { textClass: 'text-destructive', prefix: '' };
    case 'foul':
      return { textClass: 'text-muted-foreground/70', prefix: '' };
    case 'kickoff':
    case 'half_time':
    case 'full_time':
      return { textClass: 'text-primary font-semibold', prefix: '' };
    default:
      return { textClass: 'text-muted-foreground', prefix: '' };
  }
}

export function enrichDescription(event: MatchEvent, ctx: CommentaryContext): string {
  if (event.type !== 'goal') return event.description;
  const scoringClubIsHome = event.clubId ? true : false;
  const extra = getScoreContext(ctx, scoringClubIsHome);
  return extra ? `${event.description} ${extra}` : event.description;
}
