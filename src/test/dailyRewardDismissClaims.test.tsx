/**
 * Dismissing the daily reward claims it.
 *
 * The modal stamps itself shown for the day as soon as it opens, so a tap on
 * the backdrop or the X used to forfeit the day's claim — and the streak with
 * it — until the next cold launch. The reward is not a choice, so closing the
 * modal pays it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DailyRewardModal } from '@/components/game/DailyRewardModal';
import { PresentationQueueProvider, resetPresentationLedger } from '@/hooks/usePresentationQueue';
import { useGameStore } from '@/store/gameStore';
import { readDailyStreak, setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { evaluateDailyStreak } from '@/utils/dailyStreak';

function renderModal() {
  return render(
    <PresentationQueueProvider>
      <DailyRewardModal />
    </PresentationQueueProvider>,
  );
}

describe('DailyRewardModal — dismissing claims', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetPresentationLedger();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame('manchester-city');
    setFlag(STORAGE_KEYS.WELCOME_SHOWN);
  });

  it('a backdrop tap claims the day instead of forfeiting it', async () => {
    expect(evaluateDailyStreak(readDailyStreak()).canClaim).toBe(true);
    const xpBefore = useGameStore.getState().managerProgression.xp;
    renderModal();
    const dialog = await screen.findByRole('dialog');
    await act(async () => { fireEvent.click(dialog); });
    expect(evaluateDailyStreak(readDailyStreak()).canClaim).toBe(false);
    expect(useGameStore.getState().managerProgression.xp).toBeGreaterThan(xpBefore);
  });

  it('the close button claims too', async () => {
    renderModal();
    await screen.findByRole('dialog');
    const closeBtn = screen.getAllByRole('button').find(b => b.getAttribute('aria-label') && /close/i.test(b.getAttribute('aria-label')!));
    expect(closeBtn).toBeTruthy();
    await act(async () => { fireEvent.click(closeBtn!); });
    expect(evaluateDailyStreak(readDailyStreak()).canClaim).toBe(false);
  });
});
