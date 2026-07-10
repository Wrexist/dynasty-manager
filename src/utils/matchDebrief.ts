/**
 * Post-match tactical debrief (G3).
 *
 * The match engine computes tactical-matchup insights and emits them on the
 * kickoff event (`tacticalInsight`, from the player's perspective) plus
 * `ai_tactical_change` events when the opposition manager reacts. The UI used
 * to throw both away. This util extracts a compact, free-for-all debrief so
 * the choice→outcome loop that makes tactics matter is actually visible.
 *
 * The insight→hint mapping lives here (a table, not inline JSX) so it can be
 * tuned and tested independently of the popup.
 */
import type { MatchEvent } from '@/types/game';

export interface MatchDebrief {
  /** Player-perspective tactical line taken from the (first-half) kickoff event. */
  insight: string;
  /** First opposition tactical reaction, if the AI switched during the match. */
  aiReaction?: string;
  /** One actionable takeaway derived from the insight. */
  hint?: string;
}

/**
 * Maps an insight phrase to a single actionable hint. Ordered — first match
 * wins. Keyed on the stable phrasing the engine produces (see
 * `engine/match.ts` tacticalInsights).
 */
const HINT_RULES: { test: RegExp; hint: string }[] = [
  { test: /high press/i, hint: 'Keep pressing intensity high against slow build-up sides.' },
  { test: /wide play/i, hint: 'Width stretched a narrow defence — favour wingers in this matchup.' },
  { test: /deep line/i, hint: 'A deep line smothered their high-line runners — hold it against attacking sides.' },
  { test: /fast tempo/i, hint: 'Quick tempo unsettled a cautious side — keep the pace high.' },
  { test: /formation edge/i, hint: 'Your shape had the edge — stick with this formation here.' },
  { test: /formation mismatch/i, hint: 'Poor formation matchup — consider switching shape next time.' },
  { test: /sitting deep/i, hint: 'They parked the bus — width and patience beat a low block.' },
  { test: /pushing forward/i, hint: 'Chasing the game left space — commit numbers forward when behind.' },
  { test: /watch for counters/i, hint: 'Protect the lead — drop deeper and guard against the counter.' },
];

/**
 * Extract the debrief from a finished match's events. Returns null when the
 * match carries no tactical insight (e.g. an AI-only sim or a neutral
 * matchup) so the caller can hide the block.
 */
export function extractMatchDebrief(
  events: MatchEvent[] | undefined,
  playerClubId: string,
): MatchDebrief | null {
  if (!events || events.length === 0) return null;

  // The engine stamps the player-perspective insight on the kickoff event.
  const insight = events.find(e => e.type === 'kickoff' && !!e.tacticalInsight)?.tacticalInsight;
  if (!insight) return null;

  // First opposition (non-player-club) tactical reaction, framed for the player.
  const aiReaction = events.find(
    e => e.type === 'ai_tactical_change' && e.clubId !== playerClubId && !!e.description,
  )?.description;

  const hint = HINT_RULES.find(r => r.test.test(insight))?.hint;

  return { insight, aiReaction, hint };
}
