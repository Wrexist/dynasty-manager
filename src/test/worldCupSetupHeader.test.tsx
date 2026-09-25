/**
 * World Cup setup's back button must be reachable (playthrough 2026-09).
 *
 * It was the one new-game setup page without `safe-area-top` — with
 * viewport-fit=cover its 20px-tall "Modes" button sat under a notched
 * iPhone's status bar. Chromium reports a zero inset, so this pins the class
 * and the 44px target rather than a measured position.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorldCupSetup from '@/pages/WorldCupSetup';

afterEach(cleanup);

describe('World Cup setup header', () => {
  it('clears the status bar and gives the back button a 44px target', () => {
    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/world-cup', state: { slot: 1 } }]}>
        <WorldCupSetup />
      </MemoryRouter>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('safe-area-top');
    const back = screen.getByRole('button', { name: /Modes/ });
    expect(back.className).toContain('min-h-[44px]');
  });
});
