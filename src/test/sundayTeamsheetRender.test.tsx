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
import { fireEvent, render, screen } from '@testing-library/react';
import SundayTeamsheet from '@/pages/SundayTeamsheet';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_FULL_XI, SUNDAY_MIN_START } from '@/config/sundayLeague';
import { sundayTacticFit } from '@/utils/sunday/match';
import { en } from '@/i18n/locales/en';

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

  /**
   * The cliff used to be a 103-character sentence under a chip that read
   * "0 of 11", which made ELEVEN look like the constraint. It is drawn now —
   * eleven pips with a rule after the seventh — so the assertions are on the
   * meter's ARIA contract and on the label at the line, not on prose.
   */
  it('says out loud that seven, not eleven, is the number that matters', () => {
    render(<SundayTeamsheet />);
    expect(screen.getByText(en['sunday.sheet.minToPlay'].replace('{min}', String(SUNDAY_MIN_START)))).toBeTruthy();
    const meter = screen.getByRole('meter', { name: new RegExp(`fewer than ${SUNDAY_MIN_START}`, 'i') });
    expect(meter.getAttribute('aria-valuemax')).toBe(String(SUNDAY_FULL_XI));
  });

  /**
   * The coach is an ADVERTISED effect ('tactical-fit'), applied by
   * `buildMatchdayTeam` on the morning and by the half-time switcher. The
   * teamsheet used to call `sundayTacticFit` with the default coachLevel of 0,
   * so a club that had paid for him was shown a LOWER number than the one the
   * match went on to use.
   */
  /**
   * The armband belongs to the man, not to whether he happens to be named yet.
   * It used to render only on the available-but-unpicked list, so handing it
   * to a starter meant leaving this screen for the Squad screen and coming
   * back — on the one screen where the decision is actually made.
   */
  it('offers the armband to a man who is already in the XI', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const sunday = useGameStore.getState().sunday!;
    expect(sunday.teamsheet.length).toBeGreaterThanOrEqual(SUNDAY_MIN_START);

    render(<SundayTeamsheet />);
    // A named man is a token on the board now, not a row in a list. Picking him
    // up is what opens the controls that belong to him — so the assertion is
    // that the armband is TWO taps away for a starter and never nested inside
    // the token's own button.
    for (const id of sunday.teamsheet) {
      const p = useGameStore.getState().players[id];
      const token = screen.getByRole('button', { name: new RegExp(`^${p.firstName} ${p.lastName},`) });
      expect(token.parentElement?.closest('button') ?? null).toBeNull();
      fireEvent.click(token);
      const armband = screen.getAllByRole('button', { name: /armband/i })[0];
      expect(armband, id).toBeTruthy();
      expect(armband.parentElement?.closest('button') ?? null).toBeNull();
      fireEvent.click(token);
    }
  });

  it('shows the fit the match will actually use, coach included', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const s = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s.sunday!, upgrades: [{ id: 'coach', level: 1 }] } });

    const sunday = useGameStore.getState().sunday!;
    const xi = sunday.teamsheet.map(id => useGameStore.getState().players[id]).filter(Boolean);
    expect(xi.length).toBeGreaterThan(0);
    const withCoach = Math.round(sundayTacticFit(sunday.tactic, xi, 1) * 100);
    const withoutCoach = Math.round(sundayTacticFit(sunday.tactic, xi, 0) * 100);
    // If these were equal the assertion below would pass for the wrong reason.
    expect(withCoach).toBeGreaterThan(withoutCoach);

    render(<SundayTeamsheet />);
    // The fit is a meter now, not a sentence: read the value off the ARIA
    // contract rather than off a formatted string, so a layout change cannot
    // silently drop the assertion.
    const meter = screen.getByRole('meter', { name: en['sunday.sheet.tacticFit'] });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(withCoach));
  });

  it('says the side is settled once the morning has happened', async () => {
    // The screen and the store have to lock together. The screen used to ask
    // "have guests been paid for?" — which is null whenever there were no
    // optional guests to decide about — so on most weeks it stayed editable
    // while the store refused every edit, and the tap vanished with no reason
    // given.
    await useGameStore.getState().autoPickSundayTeamsheet();
    const arrival = await useGameStore.getState().arriveSundayMatch();
    expect(arrival).not.toBeNull();
    expect(arrival!.ringersHired).toBeNull();

    render(<SundayTeamsheet />);
    // The refusal is a state on the screen now, not a line in the warning
    // list: a settled side is settled, it is not something going wrong.
    expect(screen.getByText(en['sunday.sheet.settled'])).toBeTruthy();
  });
});
