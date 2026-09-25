/**
 * One onboarding checklist, not three.
 *
 * Week 1 used to stack a welcome modal, the first-session checklist and a
 * separate coach checklist with XP claims. They are one card now: the
 * first-session walkthrough in season 1 week 1, then the claimable coach tasks
 * through season 2, behind a single dismiss control that persists with the
 * save (`settings.hideOnboarding`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { getFlag, removeFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { OnboardingChecklist } from '@/components/game/OnboardingChecklist';
import { selectChecklistStage } from '@/utils/dashboardSelectors';
import { COACH_CHECKLIST_MAX_SEASON } from '@/config/gameBalance';
import { en } from '@/i18n/locales/en';

const CLUB_ID = 'celtic';

function freshCareer(week = 1, season = 1) {
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED);
  removeFlag(STORAGE_KEYS.WELCOME_SHOWN);
  sessionStorage.clear();
  useGameStore.getState().initGame(CLUB_ID);
  const s = useGameStore.getState();
  useGameStore.setState({
    week, season, matchGamePlan: 'none', completedCoachTaskIds: [],
    settings: { ...s.settings, hideOnboarding: false },
  });
}

const stageBase = {
  season: 1, week: 1, prestigeLevel: 0, hideOnboarding: false, firstSessionDone: false,
  seasonOver: false, coachTaskCount: 3, coachTasksClaimed: 0,
};

describe('selectChecklistStage', () => {
  it('is the first-session walkthrough in week 1 of a first career', () => {
    expect(selectChecklistStage(stageBase)).toBe('first-session');
  });

  it('hands over to the coach tasks once the first session is done or over', () => {
    expect(selectChecklistStage({ ...stageBase, firstSessionDone: true })).toBe('coach');
    expect(selectChecklistStage({ ...stageBase, week: 2 })).toBe('coach');
    expect(selectChecklistStage({ ...stageBase, prestigeLevel: 1 })).toBe('coach');
  });

  it('ends when every coach task is claimed, the season is over, or after the last coached season', () => {
    expect(selectChecklistStage({ ...stageBase, week: 5, coachTasksClaimed: 3 })).toBeNull();
    expect(selectChecklistStage({ ...stageBase, week: 5, seasonOver: true })).toBeNull();
    expect(selectChecklistStage({ ...stageBase, week: 5, season: COACH_CHECKLIST_MAX_SEASON + 1 })).toBeNull();
  });

  it('one dismissal hides both stages', () => {
    expect(selectChecklistStage({ ...stageBase, hideOnboarding: true })).toBeNull();
    expect(selectChecklistStage({ ...stageBase, week: 5, hideOnboarding: true })).toBeNull();
  });

  it('the Settings toggle describes the same span the checklist runs for', () => {
    // Settings → New-career walkthrough used to say "week 1 of a new career"
    // after the checklist started running through season 2.
    const words: Record<number, string> = { 1: 'first season', 2: 'first two seasons', 3: 'first three seasons' };
    expect(selectChecklistStage({ ...stageBase, week: 5, season: COACH_CHECKLIST_MAX_SEASON })).toBe('coach');
    expect(en['settingsPage.showTheGettingStartedChecklist']).toContain(words[COACH_CHECKLIST_MAX_SEASON]);
  });
});

describe('Getting Started — one card', () => {
  beforeEach(() => freshCareer());

  it('week 1: the walkthrough rows and the tour, and no second coach card', () => {
    render(<OnboardingChecklist />);
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getByText(/Set a plan for your first match/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Take the tour/ })).toBeTruthy();
    // The coach tasks are not a second list alongside it any more.
    expect(screen.queryByText('Set your best XI')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Dismiss checklist/ })).toHaveLength(1);
  });

  it('the welcome is a line in the card, not a blocking modal', () => {
    render(<OnboardingChecklist />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/Welcome, Manager!/)).toBeTruthy();
  });

  it('opens the full tour on request', () => {
    render(<OnboardingChecklist />);
    fireEvent.click(screen.getByRole('button', { name: /Take the tour/ }));
    expect(screen.getByRole('button', { name: /Skip tutorial/i })).toBeTruthy();
  });

  it('after week 1: the coach tasks, claimable for XP', () => {
    freshCareer(5, 1);
    render(<OnboardingChecklist />);
    expect(screen.queryByText(/Set a plan for your first match/)).toBeNull();
    expect(screen.getByText('Set your best XI')).toBeTruthy();
    const claim = screen.getAllByRole('button', { name: /^Claim \d+ XP for/ })[0];
    const xpBefore = useGameStore.getState().managerProgression.xp;
    act(() => { fireEvent.click(claim); });
    expect(useGameStore.getState().completedCoachTaskIds.length).toBe(1);
    expect(useGameStore.getState().managerProgression.xp).toBeGreaterThan(xpBefore);
  });

  it('dismissing hides the whole checklist and persists with the save', () => {
    freshCareer(5, 1);
    const { unmount } = render(<OnboardingChecklist />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Dismiss checklist/ })); });
    expect(useGameStore.getState().settings.hideOnboarding).toBe(true);
    expect(screen.queryByRole('region')).toBeNull();
    unmount();
    // Came back on every launch when the dismissal was session-only.
    sessionStorage.clear();
    render(<OnboardingChecklist />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('holds back the first-launch gate during the first session, then sets it', () => {
    const { unmount } = render(<OnboardingChecklist />);
    expect(getFlag(STORAGE_KEYS.WELCOME_SHOWN)).toBe(false);
    unmount();
    act(() => { useGameStore.setState({ week: 2 }); });
    render(<OnboardingChecklist />);
    expect(getFlag(STORAGE_KEYS.WELCOME_SHOWN)).toBe(true);
  });

  it('is gone after the last coached season', () => {
    freshCareer(5, COACH_CHECKLIST_MAX_SEASON + 1);
    render(<OnboardingChecklist />);
    expect(screen.queryByRole('region')).toBeNull();
  });
});
