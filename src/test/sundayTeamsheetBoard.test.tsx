/**
 * The teamsheet's tactics board.
 *
 * WHY THIS FILE IS SEPARATE FROM `sundayTeamsheetRender.test.tsx`. That file
 * pins DOM hygiene — no nested buttons, the armband reachable, the fit the
 * match will use. This one pins the BOARD's contract: that the shape on screen
 * is the shape the match will field, that a tap moves a man the way the save
 * format allows, that the seven-man cliff is announced and not merely drawn,
 * and that a settled side says so.
 *
 * IT DRIVES THE REAL SCREEN AGAINST THE REAL STORE. The board sits on the
 * SHARED `PitchBoard`, which is also the 45-league game's tactics surface, so
 * a unit test of the Sunday token would prove nothing about the thing that can
 * break. Every assertion below goes through a click on a rendered button and
 * reads the result out of `sunday.teamsheet`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import SundayTeamsheet from '@/pages/SundayTeamsheet';
import { useGameStore } from '@/store/gameStore';
import {
  SUNDAY_FULL_XI, SUNDAY_MIN_START, SUNDAY_TACTICS, getSundayTactic,
} from '@/config/sundayLeague';
import { FORMATION_POSITIONS } from '@/types/game';
import { sundayTacticFit } from '@/utils/sunday/match';
import { en } from '@/i18n/locales/en';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SEED = 9182;

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

const sunday = () => useGameStore.getState().sunday!;
/**
 * Tap, and let the write land.
 *
 * `sundaySlice` dynamic-imports its action module (`(await actions()).…`) so
 * the mode stays off the eager bundle — which means EVERY teamsheet write
 * resolves a promise before it reaches the store. A synchronous
 * `fireEvent.click` followed by a synchronous read of `sunday.teamsheet` reads
 * the state from before the tap, and the assertion passes or fails for reasons
 * that have nothing to do with the board.
 */
const tap = async (el: HTMLElement) => {
  await act(async () => { fireEvent.click(el); });
};
const board = () => screen.getByRole('group', { name: /your side/i });
const slots = () => within(board()).getAllByRole('button');
/** The men not yet named, as the rows that offer them. */
const availableRow = (name: RegExp) => screen.getByRole('button', { name });

describe('the board draws the shape the match will field', () => {
  it('draws one slot per position in the current tactic', async () => {
    render(<SundayTeamsheet />);
    // A fresh save names nobody, so the mode is short-handed and the shape is
    // the tactic's SHORT formation — which is what `buildMatchdayTeam` and
    // `sundayOpponentXI` both use below eleven.
    const shape = getSundayTactic(sunday().tactic).shortFormation;
    const expected = FORMATION_POSITIONS[shape];
    expect(expected.length).toBe(SUNDAY_FULL_XI);
    expect(slots()).toHaveLength(expected.length);
    for (const [i, slot] of expected.entries()) {
      expect(slots()[i].getAttribute('aria-label'), `slot ${i}`).toContain(slot.pos);
    }
  });

  it('re-slots the board when the tactic changes', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const full = sunday().teamsheet.length >= SUNDAY_FULL_XI;
    render(<SundayTeamsheet />);

    const shapeOf = (id: string) => {
      const tac = getSundayTactic(id as never);
      return full ? tac.formation : tac.shortFormation;
    };
    const before = slots().map(b => b.getAttribute('aria-label'));

    // Pick whichever of the four does not share the current shape, so the
    // assertion cannot pass by accident.
    const other = SUNDAY_TACTICS.find(t => shapeOf(t.id) !== shapeOf(sunday().tactic));
    expect(other, 'the four tactics all resolve to one shape').toBeTruthy();
    await tap(screen.getByRole('radio', { name: new RegExp(other!.name, 'i') }));

    expect(sunday().tactic).toBe(other!.id);
    const after = slots().map(b => b.getAttribute('aria-label'));
    expect(after).not.toEqual(before);
    const expected = FORMATION_POSITIONS[shapeOf(other!.id)];
    for (const [i, slot] of expected.entries()) {
      expect(after[i], `slot ${i}`).toContain(slot.pos);
    }
  });

  it('leaves an empty shirt for every man who did not turn up', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const named = sunday().teamsheet.length;
    render(<SundayTeamsheet />);
    const empty = slots().filter(b => /nobody named|name the selected/i.test(b.getAttribute('aria-label') ?? ''));
    expect(empty).toHaveLength(SUNDAY_FULL_XI - named);
  });
});

describe('placing and lifting a man', () => {
  it('names an unpicked player into the first empty shirt', async () => {
    render(<SundayTeamsheet />);
    expect(sunday().teamsheet).toHaveLength(0);

    // The first man who could actually be named — `setSundayTeamsheet` drops
    // anyone who is `out`, so picking `squad[0]` blind makes this test's result
    // depend on the seed's availability roll rather than on the board.
    const member = sunday().squad.find(m => m.availability.status !== 'out');
    expect(member, 'the whole squad cried off').toBeTruthy();
    const first = useGameStore.getState().players[member!.playerId];
    await tap(availableRow(new RegExp(`${first.firstName} ${first.lastName}`)));
    // Every empty shirt is a live target; only one of them can be where he
    // lands, because `teamsheet` is compact. That one is announced differently.
    const target = slots().findIndex(b => /name the selected/i.test(b.getAttribute('aria-label') ?? ''));
    expect(target).toBe(0);

    await tap(slots()[target]);
    expect(sunday().teamsheet).toEqual([first.id]);
    expect(slots()[0].getAttribute('aria-label')).toContain(first.lastName);
  });

  it('swaps two starters, and never leaves a hole behind', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const before = [...sunday().teamsheet];
    expect(before.length).toBeGreaterThanOrEqual(SUNDAY_MIN_START);
    render(<SundayTeamsheet />);

    await tap(slots()[0]);
    await tap(slots()[3]);

    const after = sunday().teamsheet;
    expect(after[0]).toBe(before[3]);
    expect(after[3]).toBe(before[0]);
    expect(after).toHaveLength(before.length);
    // The set is unchanged — a swap moves shirts, it does not drop anybody.
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('takes a named man off the sheet entirely', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const before = [...sunday().teamsheet];
    render(<SundayTeamsheet />);

    await tap(slots()[2]);
    await tap(screen.getByRole('button', { name: en['sunday.sheet.dropHim'] }));

    expect(sunday().teamsheet).not.toContain(before[2]);
    expect(sunday().bench).not.toContain(before[2]);
    expect(sunday().teamsheet).toHaveLength(before.length - 1);
  });

  it('lifts the man standing in a shirt when nobody is being held', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    render(<SundayTeamsheet />);
    const slot = slots()[1];
    await tap(slot);
    expect(slot.getAttribute('aria-pressed')).toBe('true');
    // Tapping him again puts him back rather than doing anything to the sheet.
    const before = [...sunday().teamsheet];
    await tap(slot);
    expect(slots()[1].getAttribute('aria-pressed')).toBe('false');
    expect(sunday().teamsheet).toEqual(before);
  });
});

describe('the seven-man cliff', () => {
  it('is announced, not merely drawn', async () => {
    render(<SundayTeamsheet />);
    const meter = screen.getByRole('meter', { name: new RegExp(`fewer than ${SUNDAY_MIN_START}`, 'i') });
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe(String(SUNDAY_FULL_XI));
    // And the line itself is labelled on screen, in the place the sentence used
    // to be.
    expect(screen.getByText(en['sunday.sheet.minToPlay'].replace('{min}', String(SUNDAY_MIN_START)))).toBeTruthy();
  });

  it('tracks the count as men are named', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    render(<SundayTeamsheet />);
    const meter = screen.getByRole('meter', { name: new RegExp(`fewer than ${SUNDAY_MIN_START}`, 'i') });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(sunday().teamsheet.length));
  });
});

describe('the rest of the screen still works', () => {
  it('shows the fit the match will use, coach included', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const s = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s.sunday!, upgrades: [{ id: 'coach', level: 1 }] } });
    const xi = sunday().teamsheet.map(id => useGameStore.getState().players[id]).filter(Boolean);
    const withCoach = Math.round(sundayTacticFit(sunday().tactic, xi, 1) * 100);
    expect(withCoach).toBeGreaterThan(Math.round(sundayTacticFit(sunday().tactic, xi, 0) * 100));

    render(<SundayTeamsheet />);
    expect(screen.getByRole('meter', { name: en['sunday.sheet.tacticFit'] }).getAttribute('aria-valuenow'))
      .toBe(String(withCoach));
  });

  it('keeps the ring-round reachable, two taps behind an unavailable man', async () => {
    // The mode's only way to talk somebody round. It costs money and a morale
    // point, so it is deliberately double-gated — but gated is not the same as
    // buried, and nothing else in the game can reach it.
    const withOut = sunday().squad.find(m => m.availability.status === 'out')
      ?? (() => {
        const s = sunday();
        const squad = s.squad.map((m, i) => (i === 0
          ? { ...m, availability: { ...m.availability, status: 'out' as const, warned: false } }
          : m));
        useGameStore.setState({ sunday: { ...s, squad } });
        return useGameStore.getState().sunday!.squad[0];
      })();
    const player = useGameStore.getState().players[withOut.playerId];

    render(<SundayTeamsheet />);
    expect(screen.queryByRole('button', { name: /ring round/i })).toBeNull();
    await tap(screen.getByRole('button', { name: new RegExp(`${player.firstName} ${player.lastName}`) }));
    expect(screen.getByRole('button', { name: /ring round/i })).toBeTruthy();
  });

  it('says the side is settled, and stops moving men, once the morning has happened', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const before = [...sunday().teamsheet];
    expect(await useGameStore.getState().arriveSundayMatch()).not.toBeNull();

    render(<SundayTeamsheet />);
    expect(screen.getByText(en['sunday.sheet.settled'])).toBeTruthy();
    // Not merely announced: the taps are inert rather than silently refused by
    // the store, which is the bug the shared `sundaySideIsSettled` predicate
    // exists to prevent.
    await tap(slots()[0]);
    await tap(slots()[3]);
    expect(sunday().teamsheet).toEqual(before);
  });

  it('never nests a button inside a button, board included', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    render(<SundayTeamsheet />);
    for (const b of screen.getAllByRole('button')) {
      expect(b.parentElement?.closest('button'), b.getAttribute('aria-label') ?? b.textContent ?? '').toBeNull();
    }
    const nesting = errors.filter(e => /validateDOMNesting/.test(e));
    expect(nesting, nesting.join('\n')).toEqual([]);
  });
});
