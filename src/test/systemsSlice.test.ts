/**
 * systemsSlice — tactics, training, scouting and watch-list actions
 * (468 LOC, previously untested). Match/AI-coupled systems (staff XP from
 * advanceWeek, scout report delivery) are out of scope; this covers the
 * deterministic, synchronous actions and their guards.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { MAX_TACTICAL_PRESETS } from '@/config/monetization';
import type { FormationType } from '@/types/game';

const CLUB_ID = 'celtic';

function club() {
  const s = useGameStore.getState();
  return s.clubs[s.playerClubId];
}

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
  // initGame does not reset these cross-game user-state fields, so clear the
  // ones these tests mutate to keep each case isolated.
  useGameStore.setState({ tacticalPresets: [], scoutWatchList: [] });
});

describe('systemsSlice — setTactics', () => {
  it('merges a partial into tactics without dropping other fields', () => {
    const beforeMentality = useGameStore.getState().tactics.mentality;
    useGameStore.getState().setTactics({ pressingIntensity: 77 });
    const t = useGameStore.getState().tactics;
    expect(t.pressingIntensity).toBe(77);
    expect(t.mentality).toBe(beforeMentality);
  });
});

describe('systemsSlice — tactical presets', () => {
  it('saves a preset capturing the current formation and tactics', () => {
    useGameStore.getState().setTactics({ pressingIntensity: 42 });
    const formation = club().formation;

    useGameStore.getState().saveTacticalPreset('High Press');

    const presets = useGameStore.getState().tacticalPresets;
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({ name: 'High Press', formation });
    expect(presets[0].tactics.pressingIntensity).toBe(42);
  });

  it('caps the number of presets at MAX_TACTICAL_PRESETS', () => {
    for (let i = 0; i < MAX_TACTICAL_PRESETS + 2; i++) {
      useGameStore.getState().saveTacticalPreset(`P${i}`);
    }
    expect(useGameStore.getState().tacticalPresets).toHaveLength(MAX_TACTICAL_PRESETS);
  });

  it('loadTacticalPreset restores the saved tactics', () => {
    useGameStore.getState().setTactics({ pressingIntensity: 20 });
    useGameStore.getState().saveTacticalPreset('Snapshot');
    const presetId = useGameStore.getState().tacticalPresets[0].id;

    useGameStore.getState().setTactics({ pressingIntensity: 90 });
    expect(useGameStore.getState().tactics.pressingIntensity).toBe(90);

    useGameStore.getState().loadTacticalPreset(presetId);
    expect(useGameStore.getState().tactics.pressingIntensity).toBe(20);
  });

  it('loadTacticalPreset rebuilds a valid XI when the formation differs', () => {
    useGameStore.getState().saveTacticalPreset('Base');
    const preset = useGameStore.getState().tacticalPresets[0];
    const other: FormationType = preset.formation === '4-3-3' ? '4-4-2' : '4-3-3';

    // Move the club onto a different formation, then load the preset back.
    const s = useGameStore.getState();
    useGameStore.setState({ clubs: { ...s.clubs, [s.playerClubId]: { ...club(), formation: other } } });

    useGameStore.getState().loadTacticalPreset(preset.id);

    const after = club();
    expect(after.formation).toBe(preset.formation);
    expect(after.lineup).toHaveLength(11);
    // Rebuilt lineup must reference real squad members.
    expect(after.lineup.every(id => after.playerIds.includes(id))).toBe(true);
  });

  it('deleteTacticalPreset removes the named preset', () => {
    useGameStore.getState().saveTacticalPreset('Throwaway');
    const id = useGameStore.getState().tacticalPresets[0].id;
    useGameStore.getState().deleteTacticalPreset(id);
    expect(useGameStore.getState().tacticalPresets).toHaveLength(0);
  });
});

describe('systemsSlice — individual training', () => {
  it('sets then clears an individual training plan', () => {
    const pid = club().playerIds[0];

    useGameStore.getState().setIndividualTraining(pid, 'fitness');
    let plans = useGameStore.getState().training.individualPlans || [];
    expect(plans).toContainEqual({ playerId: pid, focus: 'fitness' });

    useGameStore.getState().setIndividualTraining(pid, null);
    plans = useGameStore.getState().training.individualPlans || [];
    expect(plans.some(p => p.playerId === pid)).toBe(false);
  });
});

describe('systemsSlice — scout watch list', () => {
  it('adds without duplicating and removes', () => {
    const api = () => useGameStore.getState();
    api().addToWatchList('pX');
    api().addToWatchList('pX');
    expect(api().scoutWatchList.filter(id => id === 'pX')).toHaveLength(1);

    api().removeFromWatchList('pX');
    expect(api().scoutWatchList).not.toContain('pX');
  });
});

describe('systemsSlice — scouting assignments', () => {
  it('assigns within the slot limit, rejects at the limit, and cancels', () => {
    // Give exactly one scouting slot, none used.
    const s = useGameStore.getState();
    useGameStore.setState({ scouting: { ...s.scouting, maxAssignments: 1, assignments: [] } });

    const first = useGameStore.getState().assignScout('domestic');
    expect(first.success).toBe(true);
    expect(useGameStore.getState().scouting.assignments).toHaveLength(1);

    const second = useGameStore.getState().assignScout('asia');
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already on assignment/i);

    const id = useGameStore.getState().scouting.assignments[0].id;
    useGameStore.getState().cancelAssignment(id);
    expect(useGameStore.getState().scouting.assignments).toHaveLength(0);
  });
});
