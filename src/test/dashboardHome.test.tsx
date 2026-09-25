/**
 * The Dashboard leads with the next thing to do.
 *
 * It used to be ~40 stacked sections with the actionable alerts (injuries,
 * expiring contracts) rendered below the XP bar, sagas, objectives,
 * achievements and cliffhangers, and three onboarding systems in week 1. It
 * now renders: one Continue button → "Needs your attention" → the next match
 * → a collapsed "More" section whose state is remembered per device.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import { useGameStore } from '@/store/gameStore';
import { getFlag, removeFlag, setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { resetPresentationLedger } from '@/hooks/usePresentationQueue';

const CLUB_ID = 'celtic';

function renderDashboard() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

/** The collapsible "More" toggle. */
function moreToggle(): HTMLElement {
  return document.querySelector('[aria-controls="dashboard-more"]') as HTMLElement;
}

/** True when `a` comes before `b` in document order. */
function before(a: Element, b: Element): boolean {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

beforeEach(() => {
  resetPresentationLedger();
  removeFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
  setFlag(STORAGE_KEYS.WELCOME_SHOWN);
  sessionStorage.clear();
  useGameStore.getState().initGame(CLUB_ID);
  const s = useGameStore.getState();
  // Week 5 of a settled career: no first-session walkthrough in the way.
  useGameStore.setState({
    week: 5, currentScreen: 'dashboard', weeklyDigest: null, pendingPressConference: null,
    pendingStoryline: null, pendingTransferTalk: null, pendingGemReveal: null, pendingFarewell: [],
    pendingAchievementIds: [], settings: { ...s.settings, hideOnboarding: true },
  });
});

describe('Dashboard — one Continue button first', () => {
  it('leads with exactly one primary action', () => {
    renderDashboard();
    const cta = screen.getAllByRole('button').filter(b => /^(Match Prep vs|Advance to Week|View Season Summary)/.test(b.textContent?.trim() ?? ''));
    expect(cta).toHaveLength(1);
  });

  it('advances a training week', () => {
    const s = useGameStore.getState();
    // Clear this week's fixtures for the player so it is a training week.
    useGameStore.setState({
      fixtures: s.fixtures.filter(f => !(f.week === 5 && (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId))),
    });
    renderDashboard();
    expect(screen.getByRole('button', { name: /Advance to Week 6/ })).toBeTruthy();
  });
});

describe('Dashboard — needs your attention', () => {
  it('shows an injury above everything else and taps through to the squad', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const benchId = club.playerIds.find(id => !club.lineup.includes(id))!;
    useGameStore.setState({ players: { ...s.players, [benchId]: { ...s.players[benchId], injured: true, injuryWeeks: 3 } } });
    renderDashboard();
    const heading = screen.getByRole('heading', { name: /Needs your attention/ });
    const row = screen.getByRole('button', { name: /Injuries \(1\)/ });
    expect(before(heading, moreToggle())).toBe(true);
    act(() => { fireEvent.click(row); });
    expect(useGameStore.getState().currentScreen).toBe('squad');
  });

  it('lists transfer offers and sends them to the market', () => {
    useGameStore.setState({ incomingOffers: [{ id: 'o1' } as never] });
    renderDashboard();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Transfer offers \(1\)/ })); });
    expect(useGameStore.getState().currentScreen).toBe('transfers');
  });

  it('is absent when nothing needs action', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const players = { ...s.players };
    for (const id of club.playerIds) players[id] = { ...players[id], injured: false, contractEnd: s.season + 2 };
    useGameStore.setState({
      players, incomingOffers: [], boardConfidence: 70, boardUltimatum: null, transferWindowOpen: false,
      youthAcademy: { ...s.youthAcademy, prospects: s.youthAcademy.prospects.map(p => ({ ...p, readyToPromote: false })) },
    });
    renderDashboard();
    expect(screen.queryByRole('heading', { name: /Needs your attention/ })).toBeNull();
  });
});

describe('Dashboard — More', () => {
  it('is collapsed by default: no objectives, sagas or club overview on the first screen', () => {
    renderDashboard();
    expect(moreToggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Club Overview')).toBeNull();
    expect(screen.queryByText('Monthly Objectives')).toBeNull();
  });

  it('expands on tap and remembers it on this device', () => {
    const first = renderDashboard();
    act(() => { fireEvent.click(moreToggle()); });
    expect(screen.getByText('Club Overview')).toBeTruthy();
    expect(getFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED)).toBe(true);
    first.unmount();
    renderDashboard();
    expect(screen.getByText('Club Overview')).toBeTruthy();
    act(() => { fireEvent.click(moreToggle()); });
    expect(getFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED)).toBe(false);
  });

  it('keeps every former Dashboard destination reachable from inside More', () => {
    setFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
    renderDashboard();
    const more = document.getElementById('dashboard-more')!;
    for (const name of [/Navigate to Schedule/, /Navigate to Finance/, /Navigate to Facilities/, /Navigate to Scouting/,
      /Navigate to Packs/, /Navigate to Youth/, /Navigate to Cup/, /Open the board room/, /Open the budget breakdown/]) {
      expect(within(more).getByRole('button', { name })).toBeTruthy();
    }
  });

  it('counts objective rewards waiting to be claimed on the toggle', () => {
    const s = useGameStore.getState();
    useGameStore.setState({
      weeklyObjectives: s.weeklyObjectives.map((o, i) => (i === 0 ? { ...o, completed: true, claimed: false } : o)),
    });
    renderDashboard();
    expect(moreToggle().textContent).toMatch(/1 to claim/);
  });
});

describe('Dashboard — interaction hygiene', () => {
  it('never nests an interactive element inside another', () => {
    setFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
    renderDashboard();
    const nested = [...document.querySelectorAll('button, [role="button"], a')]
      .filter(el => el.parentElement?.closest('button, [role="button"], a'));
    expect(nested.map(el => el.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('gives the "this week" chips a 44px tap target', () => {
    setFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
    renderDashboard();
    const training = screen.getByRole('button', { name: /Training:/ });
    expect(training.className).toMatch(/min-h-11/);
  });
});

// Playthrough 2026-09 (R17): an active storyline (e.g. Youth Prodigy, three
// choices) rendered as a big card ABOVE the Continue card and pushed it to
// y≈650. The decision is a "Needs your attention" row that opens the choice.
describe('Dashboard — a storyline decision waits in "Needs your attention"', () => {
  const STORY = {
    id: 'test-story',
    title: 'Big Club Scouts Spotted',
    body: 'Scouts from rival clubs have been watching your prodigy in training.',
    icon: 'Eye',
    options: [
      { label: 'Shield him from the media', text: 'You protect the youngster.', effects: { morale: 3 } },
      { label: 'Use the attention', text: 'You let the hype build.', effects: { fanMood: 5 } },
      { label: 'Tie him to a long contract', text: 'You move quickly.', effects: { boardConfidence: 5 } },
    ],
  };

  function continueButton(): HTMLElement {
    return screen.getAllByRole('button').find(b => /^(Match Prep vs|Advance to Week|View Season Summary)/.test(b.textContent?.trim() ?? ''))!;
  }

  it('the Continue button comes first; the story is a compact row, not a card of choices', () => {
    useGameStore.setState({ pendingStoryline: STORY });
    renderDashboard();
    const row = screen.getByRole('button', { name: /Decision: Big Club Scouts Spotted/ });
    expect(row.textContent).toMatch(/3 choices/);
    expect(before(continueButton(), row)).toBe(true);
    // No choices and no story body on the page until the row is opened.
    expect(screen.queryByText('Shield him from the media')).toBeNull();
    expect(screen.queryByText(STORY.body)).toBeNull();
  });

  it('the row opens the choice; answering it resolves the story and closes the sheet', () => {
    useGameStore.setState({ pendingStoryline: STORY });
    renderDashboard();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Decision: Big Club Scouts Spotted/ })); });
    const sheet = screen.getByRole('dialog', { name: 'Storyline Event' });
    expect(within(sheet).getByText(STORY.body)).toBeTruthy();
    act(() => { fireEvent.click(within(sheet).getByText('Use the attention')); });
    expect(useGameStore.getState().pendingStoryline).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Storyline Event' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Decision:/ })).toBeNull();
  });

  it('"Decide later" closes the sheet and keeps the decision waiting', () => {
    useGameStore.setState({ pendingStoryline: STORY });
    renderDashboard();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Decision: Big Club Scouts Spotted/ })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Decide later' })); });
    expect(screen.queryByRole('dialog', { name: 'Storyline Event' })).toBeNull();
    expect(useGameStore.getState().pendingStoryline?.id).toBe('test-story');
    expect(screen.getByRole('button', { name: /Decision: Big Club Scouts Spotted/ })).toBeTruthy();
  });

  it('"Ignore this story" is the old dismiss', () => {
    useGameStore.setState({ pendingStoryline: STORY });
    renderDashboard();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Decision: Big Club Scouts Spotted/ })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Ignore this story' })); });
    expect(useGameStore.getState().pendingStoryline).toBeNull();
  });
});
