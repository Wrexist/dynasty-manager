/**
 * Every route starts at the top of the page (playthrough 2026-09).
 *
 * The router swaps pages inside one document, so the window kept the offset
 * of the page you left: Mode Select scrolled down to its World Cup card opened
 * World Cup setup scrolled down, its "Modes" back button above the fold.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));
vi.mock('@/pages/TitleScreen', () => ({ default: () => <div>title</div> }));
vi.mock('@/components/SaveRecoveryDialog', () => ({ SaveRecoveryDialog: () => null }));

import App from '@/App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('route change scroll reset (App.tsx)', () => {
  it('scrolls the window to the top when the route changes', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.location.hash = '#/';
    render(<App />);
    scrollTo.mockClear();

    await act(async () => {
      window.location.hash = '#/no-such-route';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
