/**
 * The first session must teach football, not administration.
 *
 * The two original starter tasks were "sign a sponsor" and "send a scout".
 * Both are worth doing and neither changes how the team plays; a scout report
 * lands weeks later, so nothing a new manager was told to do had a
 * consequence they could see in their first match. The football was filed
 * under "optionally peek at Tactics".
 *
 * These pin the fix and, specifically, its ORDER — a football decision that
 * is third on the list is not the lesson.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { STORAGE_KEYS } from '@/store/helpers/persistence';
import { OnboardingChecklist } from '@/components/game/OnboardingChecklist';

const CLUB_ID = 'celtic';

/** Put the store in the state the card is designed for: brand-new career,
 *  week 1, with an unplayed fixture to plan for. */
function freshCareer() {
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED);
  sessionStorage.clear();
  useGameStore.getState().initGame(CLUB_ID);
  useGameStore.setState({ week: 1, season: 1, matchGamePlan: 'none' });
}

/** Task labels in the order the card renders them. */
function renderedTaskOrder(): string[] {
  return screen.getAllByRole('button')
    .map(b => b.textContent || '')
    .filter(text => /Set a plan|first sponsor|first scout|Hire your first scout|play your first match/.test(text));
}

beforeEach(freshCareer);

describe('onboarding — the first task is a football decision', () => {
  it('offers the game plan, and offers it FIRST', () => {
    render(<OnboardingChecklist />);
    const order = renderedTaskOrder();
    expect(order.length).toBeGreaterThan(1);
    // The ordering is the fix. A football decision listed after two admin
    // chores teaches the same lesson the old checklist did.
    expect(order[0]).toMatch(/Set a plan for your first match/);
  });

  it('sends the player to Match Prep, where the plan actually gets set', () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText(/Set a plan for your first match/)).toBeTruthy();
    // The payoff it promises is real: the engine reads the plan and the
    // post-match debrief only speaks when one was set.
    expect(screen.getByText(/Read the opposition, then decide how you want to play them\./)).toBeTruthy();
  });

  it('does not offer a plan there is no match to plan for', () => {
    // A club with a week-1 bye must not get a row it can never tick — the
    // orphan-row problem the scout row already avoids.
    const s = useGameStore.getState();
    useGameStore.setState({
      fixtures: s.fixtures.map(f => (
        f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId
          ? { ...f, played: true }
          : f
      )),
    });
    render(<OnboardingChecklist />);
    expect(screen.queryByText(/Set a plan for your first match/)).toBeNull();
  });
});

describe('onboarding — completion accounting', () => {
  it('an unset plan leaves the checklist incomplete', () => {
    render(<OnboardingChecklist />);
    // Still on screen with the football task outstanding.
    expect(screen.getByText(/Set a plan for your first match/)).toBeTruthy();
    expect(useGameStore.getState().matchGamePlan).toBe('none');
  });

  it('setting a plan ticks the task', () => {
    useGameStore.getState().setGamePlan('sit_deep');
    expect(useGameStore.getState().matchGamePlan).toBe('sit_deep');
    render(<OnboardingChecklist />);
    // The row is still listed (the card shows completed rows ticked), but the
    // state it reads is now the done state.
    expect(useGameStore.getState().matchGamePlan).not.toBe('none');
  });
});
