/**
 * PitchBoard, and the tactics screen that now sits on top of it.
 *
 * The extraction is the risky half of this change: `LineupEditor` is the
 * 45-league game's tactics board, not a Sunday-only surface, so the second
 * describe block is a regression harness rather than a unit test — it drives
 * the real component against the real store and checks that a tap-to-select →
 * tap-to-swap still writes the lineup it always wrote.
 *
 * The first block pins the contract the board now owes its callers, including
 * the accessibility it took over from them: one real button per slot, labelled,
 * reachable, and never wrapped around a token that brings its own.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PitchBoard } from '@/components/game/PitchBoard';
import { LineupEditor } from '@/components/game/LineupEditor';
import { useGameStore } from '@/store/gameStore';
import { FORMATION_POSITIONS } from '@/types/game';
import { pitchSlotPoint, SLOT_Y_BOTTOM, SLOT_Y_RANGE } from '@/config/ui';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SLOTS = FORMATION_POSITIONS['4-4-2'];

describe('PitchBoard', () => {
  it('draws one real button per slot, whether or not it is occupied', () => {
    const occupants = SLOTS.map((_, i) => (i < 5 ? `p${i}` : null));
    render(
      <PitchBoard
        slots={SLOTS}
        occupants={occupants}
        onSlotTap={() => {}}
        renderToken={({ occupantId }) => <span>{occupantId}</span>}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(SLOTS.length);
    for (const b of buttons) {
      // Real buttons, so keyboard and switch users get them for free — and
      // never nested, which would be two tab stops for one action.
      expect(b.tagName).toBe('BUTTON');
      expect(b.parentElement?.closest('button')).toBeNull();
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('reports which slot was tapped and who was standing in it', () => {
    const taps: { index: number; occupantId: string | null }[] = [];
    const occupants = SLOTS.map((_, i) => (i === 0 ? 'keeper' : null));
    render(
      <PitchBoard
        slots={SLOTS}
        occupants={occupants}
        onSlotTap={({ index, occupantId }) => taps.push({ index, occupantId })}
        renderToken={({ occupantId }) => <span>{occupantId}</span>}
        slotLabel={({ index }) => `slot ${index}`}
      />,
    );
    fireEvent.click(screen.getByLabelText('slot 0'));
    fireEvent.click(screen.getByLabelText('slot 7'));
    expect(taps).toEqual([
      { index: 0, occupantId: 'keeper' },
      { index: 7, occupantId: null },
    ]);
  });

  it('treats an empty string as an empty slot, and keeps the hole', () => {
    // A lineup array carries `''` where a player was removed. Compacting it
    // would shift everyone else onto the wrong slot.
    const occupants = SLOTS.map((_, i) => (i === 3 ? '' : `p${i}`));
    render(
      <PitchBoard
        slots={SLOTS}
        occupants={occupants}
        onSlotTap={() => {}}
        renderToken={({ occupantId }) => <span data-testid="token">{occupantId}</span>}
      />,
    );
    expect(screen.getAllByTestId('token')).toHaveLength(SLOTS.length - 1);
    expect(screen.getAllByRole('button')).toHaveLength(SLOTS.length);
  });

  it('marks the selected occupant, and only when he is on the board', () => {
    const occupants = SLOTS.map((_, i) => `p${i}`);
    const { rerender } = render(
      <PitchBoard
        slots={SLOTS}
        occupants={occupants}
        selectedId="p4"
        onSlotTap={() => {}}
        renderToken={({ occupantId }) => <span>{occupantId}</span>}
        slotLabel={({ index }) => `slot ${index}`}
      />,
    );
    expect(screen.getByLabelText('slot 4').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('slot 3').getAttribute('aria-pressed')).toBe('false');

    // A bench player can be selected while this board holds nobody selected —
    // that is the move the board exists for, so nothing may light up.
    rerender(
      <PitchBoard
        slots={SLOTS}
        occupants={occupants}
        selectedId="someone-on-the-bench"
        onSlotTap={() => {}}
        renderToken={({ occupantId }) => <span>{occupantId}</span>}
        slotLabel={({ index }) => `slot ${index}`}
      />,
    );
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('paints the underlay inside the pitch SVG, under the tokens', () => {
    const { container } = render(
      <PitchBoard
        slots={SLOTS}
        occupants={SLOTS.map(() => null)}
        onSlotTap={() => {}}
        renderToken={() => null}
        underlay={<line data-testid="chem" x1="0" y1="0" x2="1" y2="1" />}
      />,
    );
    const line = container.querySelector('[data-testid="chem"]')!;
    expect(line.closest('svg')).toBeTruthy();
  });

  it('positions a slot with the shared mapping, not a private copy', () => {
    // `pitchSlotPoint` is what the chemistry lines use too. If these two ever
    // disagree the lines land half a tile off the players they connect.
    const slot = SLOTS[0];
    expect(pitchSlotPoint(slot)).toEqual({
      x: 2 + (slot.x / 100) * 64,
      y: SLOT_Y_BOTTOM - (slot.y / 100) * SLOT_Y_RANGE,
    });
  });
});

describe('LineupEditor on the extracted board (elite regression)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let errors: string[];

  beforeEach(async () => {
    errors = [];
    consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('arsenal');
  });

  afterEach(() => { consoleError.mockRestore(); });

  /**
   * Give a player a name nothing else in the squad shares.
   *
   * `initGame` builds squads with unseeded randomness, so two men CAN come out
   * of the name pool sharing a surname — and a query that matches two elements
   * throws, or worse, drives the wrong tile. Renaming the two players a test
   * actually touches makes the query exact without pinning the whole squad.
   */
  const rename = (id: string, firstName: string, lastName: string) => {
    const s = useGameStore.getState();
    useGameStore.setState({
      players: { ...s.players, [id]: { ...s.players[id], firstName, lastName } },
    });
    return useGameStore.getState().players[id];
  };

  it('renders the club\'s XI on the board with valid DOM', () => {
    const club = useGameStore.getState().clubs[useGameStore.getState().playerClubId];
    render(<LineupEditor />);
    // A named, tappable control for every man in the XI…
    const named = club.lineup.filter(Boolean);
    expect(named.length).toBe(FORMATION_POSITIONS[club.formation].length);
    for (const id of named) {
      const p = useGameStore.getState().players[id];
      const found = screen.getAllByRole('button')
        .filter(b => (b.getAttribute('aria-label') ?? '').startsWith(`${p.firstName} ${p.lastName},`));
      expect(found.length, `${p.firstName} ${p.lastName}`).toBeGreaterThan(0);
    }
    // …and no nested interactive elements, which is what handing the button to
    // PitchBoard while the tile keeps its own role would have produced.
    expect(errors.filter(e => /validateDOMNesting/.test(e))).toEqual([]);
    for (const b of screen.getAllByRole('button')) {
      expect(b.querySelector('[role="button"], button')).toBeNull();
    }
  });

  it('still swaps two starters with two taps', () => {
    const before = [...useGameStore.getState().clubs[useGameStore.getState().playerClubId].lineup];
    const a = rename(before[3], 'Aaa', 'Zzzdefender');
    const b = rename(before[9], 'Bbb', 'Zzzforward');
    render(<LineupEditor />);
    const slotOf = (p: typeof a) =>
      screen.getByRole('button', { name: new RegExp(`^${p.firstName} ${p.lastName},`) });
    fireEvent.click(slotOf(a));
    fireEvent.click(slotOf(b));

    const after = useGameStore.getState().clubs[useGameStore.getState().playerClubId].lineup;
    expect(after[3]).toBe(b.id);
    expect(after[9]).toBe(a.id);
    // Nobody else moved.
    for (let i = 0; i < before.length; i++) {
      if (i === 3 || i === 9) continue;
      expect(after[i]).toBe(before[i]);
    }
  });

  it('lets a bench player be placed into an emptied slot', () => {
    const club0 = useGameStore.getState().clubs[useGameStore.getState().playerClubId];
    // Punch a hole in the XI the way removing a player does, and drop the man
    // who was there onto the bench.
    const lineup = [...club0.lineup];
    const displacedId = lineup[10];
    lineup[10] = '';
    useGameStore.setState({
      clubs: {
        ...useGameStore.getState().clubs,
        [club0.id]: { ...club0, lineup, subs: [displacedId, ...club0.subs] },
      },
    });
    const displaced = rename(displacedId, 'Ccc', 'Zzzsubstitute');

    render(<LineupEditor />);
    fireEvent.click(screen.getByLabelText(`${displaced.firstName} ${displaced.lastName}`));
    // The empty slot is a real button with a label that says what it is for —
    // before the extraction it was a div with a hand-rolled role and key
    // handler, which is exactly the thing that had already been got wrong once.
    const empty = screen.getByRole('button', { name: /Empty .* slot — place selected player here/ });
    fireEvent.click(empty);

    expect(useGameStore.getState().clubs[club0.id].lineup[10]).toBe(displacedId);
  });
});
