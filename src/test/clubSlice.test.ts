/**
 * clubSlice — formation/lineup/training actions (previously untested). All
 * deterministic and synchronous. Notable: setFormation rebuilds the XI for the
 * new shape, updateLineup defensively copies, and autoFillTeam is Pro-gated.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { FormationType } from '@/types/game';

const CLUB_ID = 'celtic';

function club() {
  const s = useGameStore.getState();
  return s.clubs[s.playerClubId];
}
function setPro(on: boolean) {
  const s = useGameStore.getState();
  useGameStore.setState({
    monetization: { ...s.monetization, entitlements: on ? ['com.dynastymanager.pro'] : [] },
  });
}

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('clubSlice — setFormation', () => {
  it('changes formation and rebuilds a valid 11-man lineup for it', () => {
    const current = club().formation;
    const next: FormationType = current === '4-3-3' ? '4-4-2' : '4-3-3';

    useGameStore.getState().setFormation(next);

    const c = club();
    expect(c.formation).toBe(next);
    expect(c.lineup).toHaveLength(11);
    expect(c.lineup.every(id => c.playerIds.includes(id))).toBe(true);
    // No player appears in both lineup and subs.
    expect(c.lineup.some(id => c.subs.includes(id))).toBe(false);
  });
});

describe('clubSlice — setDefensiveFormation', () => {
  it('sets then clears the defensive formation', () => {
    useGameStore.getState().setDefensiveFormation('5-3-2');
    expect(club().defensiveFormation).toBe('5-3-2');
    useGameStore.getState().setDefensiveFormation(null);
    expect(club().defensiveFormation).toBeUndefined();
  });
});

describe('clubSlice — updateLineup', () => {
  it('stores a defensive copy of the provided arrays', () => {
    const lineup = club().lineup.slice(0, 11);
    const subs = club().subs.slice(0, 5);

    useGameStore.getState().updateLineup(lineup, subs);

    const c = club();
    expect(c.lineup).toEqual(lineup);
    expect(c.subs).toEqual(subs);
    // Stored arrays must not be the same references we passed in.
    expect(c.lineup).not.toBe(lineup);
    expect(c.subs).not.toBe(subs);
  });
});

describe('clubSlice — autoFillTeam (Pro gate)', () => {
  it('refuses and reports proRequired when not Pro', () => {
    setPro(false);
    const res = useGameStore.getState().autoFillTeam();
    expect(res.proRequired).toBe(true);
    expect(res.changes).toBe(0);
  });

  it('runs and returns optimizer metadata when Pro', () => {
    setPro(true);
    const res = useGameStore.getState().autoFillTeam();
    expect(res.proRequired).toBeFalsy();
    expect(typeof res.chemistryLabel).toBe('string');
    // A full, healthy squad fills all 11 spots.
    expect(res.undersized).toBe(false);
    expect(club().lineup).toHaveLength(11);
  });
});

describe('clubSlice — focus & set-piece takers', () => {
  it('setTrainingFocus updates the focus', () => {
    useGameStore.getState().setTrainingFocus('attacking');
    expect(useGameStore.getState().trainingFocus).toBe('attacking');
  });

  it('set/clear set-piece and penalty takers', () => {
    const pid = club().playerIds[0];
    useGameStore.getState().setSetPieceTaker(pid);
    useGameStore.getState().setPenaltyTaker(pid);
    expect(club().setPieceTakerId).toBe(pid);
    expect(club().penaltyTakerId).toBe(pid);

    useGameStore.getState().setSetPieceTaker(undefined);
    useGameStore.getState().setPenaltyTaker(undefined);
    expect(club().setPieceTakerId).toBeUndefined();
    expect(club().penaltyTakerId).toBeUndefined();
  });
});
