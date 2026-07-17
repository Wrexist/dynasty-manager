/**
 * Pre-Season Focus — one strategic offseason choice, armed at season end and
 * consumed by the new season's first advanceWeek. Verifies each of the three
 * focuses applies its documented deltas and then clears itself. Drive pattern
 * mirrors boardUltimatum.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { PRESEASON_FOCUS } from '@/config/gameBalance';
import type { PreseasonEffect } from '@/types/game';

const CLUB_ID = 'celtic';

const arm = (focus: PreseasonEffect['focus']): PreseasonEffect => ({
  focus, consumed: false, injuryGuardUntilWeek: 0,
});

beforeEach(async () => {
  await useGameStore.getState().initGame(CLUB_ID);
});

function focusMessage(title: string) {
  return useGameStore.getState().messages.find(m => m.title === title);
}

describe('Pre-Season Focus — SUMMER_TOUR', () => {
  it('injects the transfer budget, bumps the fanbase, and clears itself', async () => {
    const clubBefore = useGameStore.getState().clubs[CLUB_ID];
    const fanBefore = clubBefore.fanBase;
    useGameStore.setState({ season: 1, week: 1, preseasonEffect: arm('summer_tour') });

    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    // Budget boost folded into this week's income.
    const lastFinance = s.financeHistory[s.financeHistory.length - 1];
    expect(lastFinance.income).toBeGreaterThanOrEqual(PRESEASON_FOCUS.summer_tour.budgetBoost);
    // Fanbase grew (only this effect touches fanBase during a week tick).
    expect(s.clubs[CLUB_ID].fanBase).toBeGreaterThan(fanBefore);
    // One-shot consumed and cleared.
    expect(s.preseasonEffect).toBeNull();
    expect(focusMessage('Pre-Season: Summer Tour')).toBeTruthy();
  });
});

describe('Pre-Season Focus — FRIENDLY_CIRCUIT', () => {
  it('boosts tactical familiarity and lineup chemistry, then clears itself', async () => {
    useGameStore.setState({
      season: 1, week: 1,
      preseasonEffect: arm('friendly_circuit'),
      pairFamiliarity: {},
      training: { ...useGameStore.getState().training, tacticalFamiliarity: 30 },
    });
    const lineup = useGameStore.getState().clubs[CLUB_ID].lineup.filter(Boolean);
    expect(lineup.length).toBeGreaterThanOrEqual(2);

    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    // Tactical familiarity gained at least the documented head start.
    expect(s.training.tacticalFamiliarity).toBeGreaterThanOrEqual(30 + PRESEASON_FOCUS.friendly_circuit.tacticalFamiliarityBoost);
    // Every current lineup pair gained chemistry.
    const [a, b] = lineup;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    expect(s.pairFamiliarity[key]).toBeGreaterThanOrEqual(PRESEASON_FOCUS.friendly_circuit.pairFamiliarityBoost);
    // Non-camp focus clears immediately after consumption.
    expect(s.preseasonEffect).toBeNull();
    expect(focusMessage('Pre-Season: Friendly Circuit')).toBeTruthy();
  });
});

describe('Pre-Season Focus — TRAINING_CAMP', () => {
  it('stamps the injury-guard window on consumption and keeps the effect alive', async () => {
    useGameStore.setState({ season: 1, week: 1, preseasonEffect: arm('training_camp') });

    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.preseasonEffect).not.toBeNull();
    expect(s.preseasonEffect!.consumed).toBe(true);
    // Window covers weeks 1..N (injuryGuardWeeks), stamped as an absolute expiry.
    expect(s.preseasonEffect!.injuryGuardUntilWeek).toBe(PRESEASON_FOCUS.training_camp.injuryGuardWeeks);
    expect(focusMessage('Pre-Season: Training Camp')).toBeTruthy();
  });

  it('clears itself once the injury-guard window has passed', async () => {
    const guardEnd = PRESEASON_FOCUS.training_camp.injuryGuardWeeks;
    useGameStore.setState({
      season: 1, week: guardEnd,
      preseasonEffect: { focus: 'training_camp', consumed: true, injuryGuardUntilWeek: guardEnd },
    });

    await useGameStore.getState().advanceWeek();

    // newWeek (guardEnd + 1) is past the window → cleared.
    expect(useGameStore.getState().preseasonEffect).toBeNull();
  });
});

describe('Pre-Season Focus — chooser action', () => {
  it('setPreseasonFocus swaps a pending choice', () => {
    useGameStore.setState({ preseasonEffect: arm('friendly_circuit') });
    useGameStore.getState().setPreseasonFocus('summer_tour');
    expect(useGameStore.getState().preseasonEffect!.focus).toBe('summer_tour');
  });

  it('setPreseasonFocus is a no-op once the effect is consumed', () => {
    useGameStore.setState({ preseasonEffect: { focus: 'training_camp', consumed: true, injuryGuardUntilWeek: 6 } });
    useGameStore.getState().setPreseasonFocus('summer_tour');
    expect(useGameStore.getState().preseasonEffect!.focus).toBe('training_camp');
  });

  it('does nothing when no effect is armed', () => {
    useGameStore.setState({ preseasonEffect: null });
    useGameStore.getState().setPreseasonFocus('summer_tour');
    expect(useGameStore.getState().preseasonEffect).toBeNull();
  });
});
