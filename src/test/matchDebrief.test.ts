import { describe, it, expect } from 'vitest';
import { extractMatchDebrief } from '@/utils/matchDebrief';
import type { MatchEvent } from '@/types/game';

const PLAYER = 'my-club';
const OPP = 'opp-club';

function kickoff(insight?: string): MatchEvent {
  return { minute: 0, type: 'kickoff', clubId: PLAYER, description: 'Kick off!', tacticalInsight: insight };
}
function aiChange(clubId: string, description: string, minute = 60): MatchEvent {
  return { minute, type: 'ai_tactical_change', clubId, description };
}
function goal(): MatchEvent {
  return { minute: 20, type: 'goal', clubId: PLAYER, description: 'Goal!' };
}

describe('extractMatchDebrief', () => {
  it('returns null for no events', () => {
    expect(extractMatchDebrief(undefined, PLAYER)).toBeNull();
    expect(extractMatchDebrief([], PLAYER)).toBeNull();
  });

  it('returns null when the match carries no tactical insight', () => {
    expect(extractMatchDebrief([kickoff(), goal()], PLAYER)).toBeNull();
  });

  it('extracts the insight from the kickoff event', () => {
    const d = extractMatchDebrief([kickoff('High press countering Foo’s slow tempo (+14%)'), goal()], PLAYER);
    expect(d).not.toBeNull();
    expect(d!.insight).toContain('High press');
  });

  it('maps a known insight to an actionable hint', () => {
    const wide = extractMatchDebrief([kickoff('Wide play exploiting Foo’s narrow shape (+10%)')], PLAYER);
    expect(wide!.hint).toBeTruthy();
    expect(wide!.hint).toMatch(/wingers|width/i);

    const formEdge = extractMatchDebrief([kickoff('Formation edge: 4-3-3 vs 4-4-2 (+8%)')], PLAYER);
    expect(formEdge!.hint).toMatch(/stick with/i);
  });

  it('leaves hint undefined for an unmapped insight', () => {
    const d = extractMatchDebrief([kickoff('Some novel unmapped tactical note')], PLAYER);
    expect(d!.insight).toBe('Some novel unmapped tactical note');
    expect(d!.hint).toBeUndefined();
  });

  it('surfaces the first OPPOSITION tactical reaction, ignoring the player club', () => {
    const events = [
      kickoff('High press countering Foo’s slow tempo (+14%)'),
      aiChange(PLAYER, 'My club switches to attacking mentality.', 50),
      aiChange(OPP, 'Opponent switches to defensive mentality.', 62),
    ];
    const d = extractMatchDebrief(events, PLAYER);
    expect(d!.aiReaction).toBe('Opponent switches to defensive mentality.');
  });

  it('leaves aiReaction undefined when only the player club reacted', () => {
    const events = [
      kickoff('High press countering Foo’s slow tempo (+14%)'),
      aiChange(PLAYER, 'My club switches to attacking mentality.', 50),
    ];
    const d = extractMatchDebrief(events, PLAYER);
    expect(d!.aiReaction).toBeUndefined();
  });
});

// Playthrough 2026-09 (R6): when the first half had no matchup insight, the
// debrief showed HALF-TIME advice after the final whistle ("Leading — SOU may
// push forward, watch for counters" / "Protect the lead…" under a 4–0). It now
// reads the latest segment's insight and phrases it as a full-time review.
describe('extractMatchDebrief — phrased for full time', () => {
  const secondHalf = (insight: string, minute = 46): MatchEvent =>
    ({ minute, type: 'kickoff', clubId: PLAYER, description: 'Second half underway!', tacticalInsight: insight });
  const LEADING = 'Leading — SOU may push forward, watch for counters';

  it('never shows half-time advice after the whistle', () => {
    const d = extractMatchDebrief([kickoff(), goal(), secondHalf(LEADING)], PLAYER, { goalsFor: 4, goalsAgainst: 0 });
    expect(d!.insight).toBe('Led at half-time and saw the game out.');
    expect(d!.insight).not.toMatch(/may push forward|watch for counters/);
    expect(d!.hint).not.toMatch(/^Protect the lead/);
  });

  it('uses the LATEST segment\'s insight, reviewed against the final score', () => {
    const events = [kickoff(), secondHalf(LEADING)];
    expect(extractMatchDebrief(events, PLAYER, { goalsFor: 2, goalsAgainst: 2 })!.insight).toBe('Led at half-time, but SOU pulled level.');
    expect(extractMatchDebrief(events, PLAYER, { goalsFor: 2, goalsAgainst: 3 })!.insight).toBe('Led at half-time, but SOU turned it around.');
    const trailing = [kickoff(), secondHalf('Trailing by 1 — pushing forward could create chances')];
    expect(extractMatchDebrief(trailing, PLAYER, { goalsFor: 2, goalsAgainst: 1 })!.insight).toBe('Came from behind to win.');
    expect(extractMatchDebrief(trailing, PLAYER, { goalsFor: 0, goalsAgainst: 1 })!.insight).toBe("Trailed at half-time and couldn't find a way back.");
    const lowBlock = [kickoff(), secondHalf('SOU sitting deep — consider wide play to stretch them')];
    const lb = extractMatchDebrief(lowBlock, PLAYER, { goalsFor: 0, goalsAgainst: 1 })!;
    expect(lb.insight).toBe("Trailed at half-time and couldn't find a way back. SOU sat deep after the break.");
    expect(lb.hint).toMatch(/low block/);
    const level = [kickoff(), secondHalf('Level at half-time — tactical balance is key')];
    expect(extractMatchDebrief(level, PLAYER, { goalsFor: 1, goalsAgainst: 0 })!.insight).toBe('Level at half-time — won it in the second half.');
  });

  it('an extra-time kickoff reads "after 90 minutes"', () => {
    const events = [kickoff(), secondHalf(LEADING), secondHalf('Level at half-time — tactical balance is key', 91)];
    expect(extractMatchDebrief(events, PLAYER, { goalsFor: 1, goalsAgainst: 1 })!.insight)
      .toBe('Level after 90 minutes, and nothing to separate the sides after it.');
  });

  it('keeps the first half\'s matchup lesson as the takeaway', () => {
    const events = [kickoff('High press countering Foo’s slow tempo (+14%)'), secondHalf(LEADING)];
    const d = extractMatchDebrief(events, PLAYER, { goalsFor: 3, goalsAgainst: 0 })!;
    expect(d.insight).toBe('Led at half-time and saw the game out.');
    expect(d.hint).toMatch(/pressing intensity/i);
  });

  it('without a score it still reads as a review, not advice', () => {
    expect(extractMatchDebrief([kickoff(), secondHalf(LEADING)], PLAYER)!.insight).toBe('Led at half-time.');
  });
});
