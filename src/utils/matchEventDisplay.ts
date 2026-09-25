import type { MatchEvent, MatchHighlightTone } from '@/types/game';

/** Short uppercase label shown as a pill next to the minute on each event row. */
export const EVENT_LABELS: Partial<Record<MatchEvent['type'], string>> = {
  goal: 'GOAL',
  free_kick_goal: 'FREE KICK',
  long_range_goal: 'LONG RANGE',
  counter_attack_goal: 'COUNTER',
  header_goal: 'HEADER',
  solo_goal: 'SOLO GOAL',
  penalty_scored: 'PENALTY',
  penalty_missed: 'PEN MISSED',
  own_goal: 'OWN GOAL',
  goalkeeper_error: 'GK ERROR',
  extra_time_goal: 'EXTRA TIME',
  shot_saved: 'SAVED',
  shot_missed: 'SHOT WIDE',
  hit_woodwork: 'WOODWORK',
  goal_line_clearance: 'CLEARED',
  yellow_card: 'YELLOW',
  red_card: 'RED CARD',
  foul: 'FOUL',
  injury: 'INJURY',
  substitution: 'SUB',
  var_check: 'VAR',
  var_disallowed: 'DISALLOWED',
  ai_tactical_change: 'TACTICAL',
  kickoff: 'KICKOFF',
  half_time: 'HALF TIME',
  // '+X minutes added time' announcements. Legacy saves carry these typed
  // 'half_time' — that mapping above stays so old events still render.
  added_time: 'ADDED TIME',
  full_time: 'FULL TIME',
  penalty_shootout: 'SHOOTOUT',
};

/** Map an event to a color tone — reused by MatchReview highlights and live commentary. */
export const EVENT_TONE: Partial<Record<MatchEvent['type'], MatchHighlightTone>> = {
  goal: 'goal',
  penalty_scored: 'goal',
  free_kick_goal: 'goal',
  long_range_goal: 'goal',
  counter_attack_goal: 'goal',
  header_goal: 'goal',
  solo_goal: 'goal',
  goalkeeper_error: 'goal',
  extra_time_goal: 'goal',
  red_card: 'card',
  var_check: 'var',
  var_disallowed: 'disallowed',
  own_goal: 'own-goal',
  substitution: 'sub',
};

/** Tailwind classes for each tone — dot (key-highlights bullet), text, pill bg. */
export const EVENT_TONE_CLASS: Record<MatchHighlightTone, { dot: string; text: string; pill: string }> = {
  goal:       { dot: 'bg-emerald-400', text: 'text-emerald-400', pill: 'bg-emerald-500/10 border-emerald-500/30' },
  card:       { dot: 'bg-red-500',     text: 'text-red-400',     pill: 'bg-red-500/10 border-red-500/30' },
  var:        { dot: 'bg-blue-400',    text: 'text-blue-400',    pill: 'bg-blue-500/10 border-blue-500/30' },
  disallowed: { dot: 'bg-red-500',     text: 'text-red-400',     pill: 'bg-red-500/10 border-red-500/30' },
  neutral:    { dot: 'bg-amber-400',   text: 'text-amber-400',   pill: 'bg-amber-500/10 border-amber-500/30' },
  'own-goal': { dot: 'bg-amber-500',   text: 'text-amber-400',   pill: 'bg-amber-500/10 border-amber-500/30' },
  sub:        { dot: 'bg-sky-400',     text: 'text-sky-400',     pill: 'bg-sky-500/10 border-sky-500/30' },
};

/** Extra per-type tone overrides for live commentary where MatchReview's map doesn't cover. */
const LIVE_TONE: Partial<Record<MatchEvent['type'], MatchHighlightTone>> = {
  yellow_card: 'neutral',
  hit_woodwork: 'neutral',
  goal_line_clearance: 'neutral',
  penalty_missed: 'neutral',
  injury: 'card',
  shot_saved: 'var',        // blue — defensive action
  shot_missed: 'neutral',
  foul: 'neutral',
};

/** Resolve an event to its tone, falling back sensibly for live commentary. */
export function getEventTone(type: MatchEvent['type']): MatchHighlightTone {
  return EVENT_TONE[type] ?? LIVE_TONE[type] ?? 'neutral';
}

/** Resolve the short label (returns empty string for ambient `commentary` events). */
export function getEventLabel(type: MatchEvent['type']): string {
  return EVENT_LABELS[type] ?? '';
}

/** Event types that should render as structured rows (player chip + label)
 *  rather than as verbose prose. Ambient `commentary`/`kickoff`/`half_time`/
 *  `added_time`/`full_time` and `ai_tactical_change` keep their prose style. */
export function isStructuredEvent(type: MatchEvent['type']): boolean {
  if (type === 'commentary' || type === 'ai_tactical_change') return false;
  if (type === 'kickoff' || type === 'half_time' || type === 'added_time' || type === 'full_time') return false;
  return !!EVENT_LABELS[type];
}

/**
 * The live match Log's rows, NEWEST FIRST, each with its index in `events`
 * (a stable key — a reversed list keyed by position would re-key every row on
 * each new event). The Log listed oldest first with no scroll-to-latest, so by
 * 61' the events the player was watching for were below the fold (playthrough
 * 2026-09, R13). Newest-first needs no auto-scroll, so there is no motion for
 * reduced-motion to suppress. Kickoff events are the pitch's, not the log's.
 */
export function liveLogRows(events: MatchEvent[]): { event: MatchEvent; index: number }[] {
  const rows: { event: MatchEvent; index: number }[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type !== 'kickoff') rows.push({ event: events[i], index: i });
  }
  return rows;
}
