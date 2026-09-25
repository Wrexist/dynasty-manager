import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveBackTarget, resolveHardwareBack } from '@/utils/backNavigation';
import { hasOpenOverlay, dismissTopOverlay } from '@/hooks/useHardwareBack';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';

// Back used to follow a fixed BACK_TARGET table and ignore the path you took:
// Market → Player → back landed on Squad (audit 2026-09-25, navigation rework).

describe('resolveBackTarget', () => {
  const base = { root: 'dashboard' as const };

  it('prefers the screen you came from over the table', () => {
    expect(resolveBackTarget({
      ...base, currentScreen: 'player-detail', previousScreen: 'transfers', previousScreenFor: 'player-detail',
    })).toBe('transfers');
    expect(resolveBackTarget({
      ...base, currentScreen: 'finance', previousScreen: 'board', previousScreenFor: 'finance',
    })).toBe('board');
  });

  it('falls back to BACK_TARGET when there is no trail', () => {
    expect(resolveBackTarget({
      ...base, currentScreen: 'player-detail', previousScreen: null, previousScreenFor: null,
    })).toBe('squad');
  });

  it('ignores a stale trail recorded for a different screen', () => {
    // previousScreen was recorded on arrival at 'finance'; a direct
    // currentScreen assignment then jumped to season-summary.
    expect(resolveBackTarget({
      ...base, currentScreen: 'season-summary', previousScreen: 'board', previousScreenFor: 'finance',
    })).toBe('dashboard');
  });

  it('ignores a trail equal to the current screen', () => {
    expect(resolveBackTarget({
      ...base, currentScreen: 'team-detail', previousScreen: 'team-detail', previousScreenFor: 'team-detail',
    })).toBe('league-table');
  });

  it('never returns to the live match screen', () => {
    expect(resolveBackTarget({
      ...base, currentScreen: 'match-review', previousScreen: 'match', previousScreenFor: 'match-review',
    })).toBe('dashboard');
  });

  it('uses the mode root when neither trail nor table has an answer', () => {
    expect(resolveBackTarget({
      currentScreen: 'inbox', previousScreen: null, previousScreenFor: null, root: 'sunday-hub',
    })).toBe('sunday-hub');
  });

  it('keeps an unemployed manager off club screens', () => {
    expect(resolveBackTarget({
      root: 'job-market', isUnemployed: true,
      currentScreen: 'player-detail', previousScreen: 'transfers', previousScreenFor: 'player-detail',
    })).toBe('job-market');
    expect(resolveBackTarget({
      root: 'job-market', isUnemployed: true,
      currentScreen: 'team-detail', previousScreen: 'league-table', previousScreenFor: 'team-detail',
    })).toBe('league-table');
  });
});

describe('store goBack', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameMode: 'sandbox', careerManager: null, matchPhase: 'none',
      currentScreen: 'dashboard', previousScreen: null, previousScreenFor: null,
    } as Partial<GameState>);
  });

  it('returns to the Market after opening a player from it', () => {
    const s = useGameStore.getState();
    s.setScreen('transfers');
    s.selectPlayer('p1');
    expect(useGameStore.getState().currentScreen).toBe('player-detail');
    useGameStore.getState().goBack();
    expect(useGameStore.getState().currentScreen).toBe('transfers');
  });

  it('consumes the trail so two detail screens never ping-pong', () => {
    const s = useGameStore.getState();
    s.setScreen('league-table');
    s.selectClub('c1');
    s.selectPlayer('p1');
    useGameStore.getState().goBack();
    expect(useGameStore.getState().currentScreen).toBe('team-detail');
    useGameStore.getState().goBack();
    // Not back to player-detail: the table takes over once the trail is spent.
    expect(useGameStore.getState().currentScreen).toBe('league-table');
  });

  it('falls back to the table after a direct currentScreen jump', () => {
    useGameStore.getState().setScreen('finance');
    useGameStore.setState({ currentScreen: 'season-summary' });
    useGameStore.getState().goBack();
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });
});

describe('resolveHardwareBack', () => {
  it('closes an overlay before anything else', () => {
    expect(resolveHardwareBack({ overlayOpen: true, matchLocked: true, onTab: true })).toBe('dismiss-overlay');
  });
  it('does nothing during a locked match', () => {
    expect(resolveHardwareBack({ overlayOpen: false, matchLocked: true, onTab: false })).toBe('ignore');
  });
  it('backgrounds the app from a bottom-nav tab instead of leaving the game', () => {
    expect(resolveHardwareBack({ overlayOpen: false, matchLocked: false, onTab: true })).toBe('minimize');
  });
  it('navigates back from a detail screen', () => {
    expect(resolveHardwareBack({ overlayOpen: false, matchLocked: false, onTab: false })).toBe('back');
  });
});

describe('hardware back overlay helpers', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('detects dialogs and hand-rolled fixed inset-0 layers, not decoration', () => {
    expect(hasOpenOverlay()).toBe(false);
    document.body.innerHTML = '<div class="fixed inset-0" style="pointer-events: none"></div>';
    expect(hasOpenOverlay()).toBe(false);
    document.body.innerHTML = '<div class="fixed inset-0 z-50"></div>';
    expect(hasOpenOverlay()).toBe(true);
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(hasOpenOverlay()).toBe(true);
  });

  it('dismisses through an Escape keydown that reaches document listeners', () => {
    const onEscape = vi.fn();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    document.addEventListener('keydown', handler);
    dismissTopOverlay();
    document.removeEventListener('keydown', handler);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
