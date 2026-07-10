/**
 * Pre-kickoff team talk (G3).
 *
 * A pre-match talk sets `matchTeamTalk` before kickoff; `playFirstHalf`
 * consumes it (applying the talk's modifiers to the first half) and then
 * clears it so the half-time team-talk sheet starts fresh — the pre-match and
 * half-time talks are independent one-shots.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { teamTalkModifiers } from '@/config/teamTalk';

const CLUB_ID = 'manchester-city';

describe('teamTalkModifiers', () => {
  it('returns undefined for no talk', () => {
    expect(teamTalkModifiers('none')).toBeUndefined();
  });

  it('produces an attacking boost for motivate/demand and a defensive boost for calm', () => {
    expect(teamTalkModifiers('motivate')!.attackMod).toBeGreaterThan(0);
    expect(teamTalkModifiers('demand')!.attackMod).toBeGreaterThan(0);
    expect(teamTalkModifiers('calm')!.defenseMod).toBeGreaterThan(0);
    // Demand trades defence for attack.
    expect(teamTalkModifiers('demand')!.defenseMod).toBeLessThan(0);
  });
});

describe('playFirstHalf — pre-kickoff team talk consumption', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('clears matchTeamTalk after the first half (half-time starts fresh)', () => {
    // Simulate the pre-kickoff sheet picking a talk.
    useGameStore.setState({ matchTeamTalk: 'motivate' });
    expect(useGameStore.getState().matchTeamTalk).toBe('motivate');

    const result = useGameStore.getState().playFirstHalf();
    expect(result).not.toBeNull();

    const s = useGameStore.getState();
    // The pre-match talk was consumed for the first half, then reset so the
    // half-time team-talk sheet opens at 'none' (half-time budget unaffected).
    expect(s.matchTeamTalk).toBe('none');
    expect(s.matchPhase).toBe('half_time');
  });

  it('a fresh match with no pre-talk leaves matchTeamTalk at none', () => {
    expect(useGameStore.getState().matchTeamTalk).toBe('none');
    const result = useGameStore.getState().playFirstHalf();
    expect(result).not.toBeNull();
    expect(useGameStore.getState().matchTeamTalk).toBe('none');
  });
});
