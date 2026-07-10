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
