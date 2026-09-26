/**
 * The first session has to deliver the first pack.
 *
 * Every ad and the store page lead with a pack walkout, and a new player can
 * open three free packs on day one — but the Getting Started checklist never
 * pointed at the Market. These pin the row that does, and the orphan-row rule
 * every other row follows: a task the player cannot complete is not shown.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { STORAGE_KEYS, currentDayIndex, writeDailyPackOpens, getFlag } from '@/store/helpers/persistence';
import { OnboardingChecklist } from '@/components/game/OnboardingChecklist';
import type { OpenedPackRecord } from '@/types/game';

const CLUB_ID = 'celtic';
const ROW = /Open your free pack/;

function freshCareer() {
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED);
  localStorage.removeItem(STORAGE_KEYS.DAILY_PACK_OPENS);
  sessionStorage.clear();
  useGameStore.getState().initGame(CLUB_ID);
  useGameStore.setState({ week: 1, season: 1, matchGamePlan: 'none', openedPacks: [] });
}

/** Every other starter task done, so the pack row alone decides completion. */
function finishOtherTasks() {
  const s = useGameStore.getState();
  useGameStore.setState({
    matchGamePlan: 'sit_deep',
    sponsorOffers: [],
    scouting: { ...s.scouting, maxAssignments: Math.max(1, s.scouting.maxAssignments), assignments: [{ id: 'a1' } as never] },
  });
}

beforeEach(freshCareer);

describe('onboarding — first pack', () => {
  it('offers the free pack to a brand-new career', () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText(ROW)).toBeTruthy();
  });

  it('hides the row when today\'s free opens are already spent', () => {
    // The allowance is device-wide, so a second career on the same day can
    // start with nothing to open. That row could never tick.
    writeDailyPackOpens({ dayIndex: currentDayIndex(), free: { daily: 1, bronze: 1, silver: 1 }, ad: {} });
    render(<OnboardingChecklist />);
    expect(screen.queryByText(ROW)).toBeNull();
  });

  it('keeps the checklist open until a pack is opened', () => {
    finishOtherTasks();
    render(<OnboardingChecklist />);
    expect(getFlag(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED)).toBe(false);
  });

  it('completes the checklist once a pack has been opened', () => {
    finishOtherTasks();
    useGameStore.setState({ openedPacks: [{ id: 'p1' } as unknown as OpenedPackRecord] });
    render(<OnboardingChecklist />);
    expect(getFlag(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED)).toBe(true);
  });
});
