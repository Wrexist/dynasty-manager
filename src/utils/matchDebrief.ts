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
  /** Player-perspective tactical line for the match as played — the latest
   *  segment's insight, phrased as a full-time review when it was half-time
   *  advice. */
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

/** The final score, from the player's side — lets the review say how the
 *  half-time position turned out. */
export interface DebriefOutcome {
  goalsFor: number;
  goalsAgainst: number;
}

type HalfTimeState = 'led' | 'trailed' | 'level';

/**
 * The engine's score-aware insights are half-time ADVICE ("Leading — SOU may
 * push forward, watch for counters"). They are stamped on the second-half (and
 * extra-time) kickoff, so after the final whistle they must be read as what
 * happened, not as what to do next. Keyed on the engine's stable phrasing
 * (`engine/match.ts`, second-half insights).
 */
function parseHalfTimeInsight(insight: string): { state: HalfTimeState; opp?: string; lowBlock?: boolean } | null {
  let m = /^Leading — (.+?) may push forward/.exec(insight);
  if (m) return { state: 'led', opp: m[1] };
  m = /^(.+?) sitting deep — /.exec(insight);
  if (m) return { state: 'trailed', opp: m[1], lowBlock: true };
  if (/^Trailing by \d+ — /.test(insight)) return { state: 'trailed' };
  if (/^Level at half-time/.test(insight)) return { state: 'level' };
  return null;
}

/** A half-time line rephrased as a full-time review, plus the lesson it holds. */
function reviewHalfTimeInsight(
  parsed: { state: HalfTimeState; opp?: string; lowBlock?: boolean },
  afterNinety: boolean,
  outcome?: DebriefOutcome,
): { line: string; lesson?: string } {
  const at = afterNinety ? 'after 90 minutes' : 'at half-time';
  const period = afterNinety ? 'in extra time' : 'in the second half';
  const opp = parsed.opp ?? 'they';
  const result = !outcome ? null
    : outcome.goalsFor > outcome.goalsAgainst ? 'W'
    : outcome.goalsFor < outcome.goalsAgainst ? 'L' : 'D';
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

  if (parsed.state === 'led') {
    if (result === 'W') return { line: `Led ${at} and saw the game out.`, lesson: 'Holding a lead worked — stay compact and guard the counter when a side has to chase the game.' };
    if (result === 'D') return { line: `Led ${at}, but ${opp} pulled level.`, lesson: 'Protect a lead: drop deeper and guard against the counter when they push.' };
    if (result === 'L') return { line: `Led ${at}, but ${opp} turned it around.`, lesson: 'Protect a lead: drop deeper and guard against the counter when they push.' };
    return { line: `Led ${at}.` };
  }
  if (parsed.state === 'trailed') {
    const lowBlock = parsed.lowBlock ? ` ${cap(opp)} sat deep after the break.` : '';
    const chaseLesson = parsed.lowBlock
      ? 'Against a low block, width and patience are what break it down.'
      : 'When behind, commit numbers forward sooner.';
    if (result === 'W') return { line: `Came from behind to win.${lowBlock}`, lesson: 'Committing numbers forward paid off.' };
    if (result === 'D') return { line: `Trailed ${at} and fought back for a draw.${lowBlock}`, lesson: chaseLesson };
    if (result === 'L') return { line: `Trailed ${at} and couldn't find a way back.${lowBlock}`, lesson: chaseLesson };
    return { line: `Trailed ${at}.${lowBlock}` };
  }
  if (result === 'W') return { line: `Level ${at} — won it ${period}.` };
  if (result === 'L') return { line: `Level ${at} — lost it ${period}.` };
  if (result === 'D') return { line: `Level ${at}, and nothing to separate the sides after it.` };
  return { line: `Level ${at}.` };
}

/**
 * Extract the debrief from a finished match's events. Returns null when the
 * match carries no tactical insight (e.g. an AI-only sim or a neutral
 * matchup) so the caller can hide the block.
 *
 * Selection: the LATEST kickoff with an insight — the one describing the
 * match as it ended. It used to take the first, so a match whose first half
 * had no matchup insight showed half-time advice ("Leading — SOU may push
 * forward, watch for counters") under a 4–0 full-time score (playthrough
 * 2026-09, R6). A half-time line is rephrased as a review of how it turned
 * out (`outcome`, when given). The takeaway prefers the first half's MATCHUP
 * lesson (a tactic that held all match), then the review's own lesson.
 */
export function extractMatchDebrief(
  events: MatchEvent[] | undefined,
  playerClubId: string,
  outcome?: DebriefOutcome,
): MatchDebrief | null {
  if (!events || events.length === 0) return null;

  // The engine stamps the player-perspective insight on each kickoff event
  // (match start, second half, extra time).
  const kickoffs = events.filter(e => e.type === 'kickoff' && !!e.tacticalInsight);
  if (kickoffs.length === 0) return null;
  const latest = kickoffs[kickoffs.length - 1];
  const latestInsight = latest.tacticalInsight as string;

  // First opposition (non-player-club) tactical reaction, framed for the player.
  const aiReaction = events.find(
    e => e.type === 'ai_tactical_change' && e.clubId !== playerClubId && !!e.description,
  )?.description;

  const parsed = parseHalfTimeInsight(latestInsight);
  if (!parsed) {
    const hint = HINT_RULES.find(r => r.test.test(latestInsight))?.hint;
    return { insight: latestInsight, aiReaction, hint };
  }

  const review = reviewHalfTimeInsight(parsed, latest.minute > 90, outcome);
  const matchupHint = kickoffs
    .map(k => k.tacticalInsight as string)
    .filter(text => !parseHalfTimeInsight(text))
    .map(text => HINT_RULES.find(r => r.test.test(text))?.hint)
    .find(Boolean);
  return { insight: review.line, aiReaction, hint: matchupHint ?? review.lesson };
}
