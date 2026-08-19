/**
 * Teamsheet — the first UI-level coverage the Sunday mode has.
 *
 * The screen shipped with a `<button>` (the captain control) nested inside
 * another `<button>` (the player row). React logs a `validateDOMNesting`
 * error for that, browsers do not agree on how to handle it, and the inner
 * control was unreachable by keyboard. Nothing in the suite noticed, because
 * no Sunday screen was ever rendered in a test.
 *
 * The assertion is deliberately console-based rather than structural: it is the
 * mechanism that failed, and React's own warning is the most direct statement
 * of "this DOM is invalid" available.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SundayTeamsheet from '@/pages/SundayTeamsheet';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_MIN_START } from '@/config/sundayLeague';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SEED = 4242;

let consoleError: ReturnType<typeof vi.spyOn>;
let errors: string[];

beforeEach(async () => {
  errors = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

afterEach(() => { consoleError.mockRestore(); });

describe('SundayTeamsheet renders valid, reachable DOM', () => {
  it('never nests a button inside a button', () => {
    render(<SundayTeamsheet />);
    const nesting = errors.filter(e => /validateDOMNesting/.test(e));
    expect(nesting, nesting.join('\n')).toEqual([]);
  });

  it('the captain control is a real, focusable button of its own', () => {
    render(<SundayTeamsheet />);
    // Every available (unpicked) player offers the armband. A fresh save names
    // nobody, so there is at least one.
    const armbands = screen.getAllByRole('button', { name: /armband/i });
    expect(armbands.length).toBeGreaterThan(0);
    for (const b of armbands) {
      expect(b.parentElement?.closest('button') ?? null).toBeNull();
      // `disabled` would take it out of the tab order; nothing here sets it.
      expect(b).not.toBeDisabled();
    }
  });

  it('says out loud that seven, not eleven, is the number that matters', () => {
    render(<SundayTeamsheet />);
    expect(screen.getByText(new RegExp(`${SUNDAY_MIN_START} is the number that matters`))).toBeTruthy();
  });
});
