/**
 * Setup — the screen before the mode exists.
 *
 * WHAT THIS FILE IS FOR. This is the player's first contact with Sunday
 * League and it holds exactly one decision, so the things that can break here
 * are expensive and quiet:
 *
 *   1. THE SLOT ORDERING. `startSundayLeague` calls `resetGame` internally,
 *      which wipes whatever `activeSlot` points at. The screen therefore sets
 *      `activeSlot` to the slot it was navigated with BEFORE it boots. Get
 *      that backwards and starting a Sunday club deletes the player's elite
 *      save. Nothing about the redesign should have touched it, which is
 *      exactly why it is pinned.
 *   2. EIGHT CHOICES THAT ARE REALLY EIGHT CHOICES. The description now lives
 *      behind selection, so a card that renders someone else's copy — or a
 *      handler that always boots `pub` — would look completely correct.
 *   3. THE WALL STAYING DOWN. Only the chosen club's paragraph may be in the
 *      DOM. Eight at once is the thing this screen was rebuilt to stop.
 *
 * STORE WRITES ARE ASYNC — `sundaySlice` dynamic-imports its actions — so the
 * real boot is stubbed here rather than awaited: this file is about what the
 * screen asks for, not about what the mode builds. `sundayCore` already owns
 * the boot itself.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SundaySetup from '@/pages/SundaySetup';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_PERSONALITIES } from '@/config/sundayLeague';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: '/sunday-setup', state: { slot: 3 }, search: '', hash: '', key: 'k' }),
  };
});

let consoleError: ReturnType<typeof vi.spyOn>;
let errors: string[];
let boot: ReturnType<typeof vi.fn>;
/** What `activeSlot` was when the boot was called — the whole point of case 1. */
let slotAtBoot: number | null;

beforeEach(() => {
  errors = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  navigate.mockClear();
  slotAtBoot = null;
  boot = vi.fn(() => {
    slotAtBoot = useGameStore.getState().activeSlot;
    return Promise.resolve();
  });
  useGameStore.setState({ activeSlot: 1, startSundayLeague: boot as never });
});

afterEach(() => { consoleError.mockRestore(); });

const setup = () => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <SundaySetup />
  </MemoryRouter>,
);

/** The radio for one club. Its accessible name starts with the club's name and
 *  then carries everything else on the card, so the match is anchored. */
const card = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name}`) });
const tap = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

describe('the setup screen asks one question and shows the answer', () => {
  it('logs nothing and nests no button inside a button', () => {
    const { container } = setup();
    expect(errors, errors.join('\n')).toEqual([]);
    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('button'), 'a button inside a button').toBeNull();
    }
  });

  it('offers all eight clubs, every one of them selectable', async () => {
    setup();
    expect(screen.getAllByRole('radio')).toHaveLength(SUNDAY_PERSONALITIES.length);
    for (const p of SUNDAY_PERSONALITIES) {
      await tap(card(p.name));
      expect(card(p.name).getAttribute('aria-checked'), p.name).toBe('true');
    }
  });

  /**
   * The wall. Eight descriptions rendered at once was the screen's whole
   * problem; exactly one may be in the DOM at a time, and it must be the one
   * belonging to the club that is chosen.
   */
  it('shows one description at a time, and it is the chosen club\'s', async () => {
    setup();
    for (const p of SUNDAY_PERSONALITIES) {
      await tap(card(p.name));
      const shown = SUNDAY_PERSONALITIES.filter(q => screen.queryByText(q.description));
      expect(shown.map(q => q.id), `while ${p.id} is chosen`).toEqual([p.id]);
    }
  });

  /** The tagline is the club's voice and stays on every row, chosen or not. */
  it('keeps every tagline visible without being asked', () => {
    setup();
    for (const p of SUNDAY_PERSONALITIES) {
      expect(screen.getByText(p.tagline), p.id).toBeTruthy();
    }
  });

  it('boots the club that was actually chosen', async () => {
    setup();
    await tap(card('Chaos FC'));
    await tap(screen.getByRole('button', { name: /get started/i }));
    expect(boot).toHaveBeenCalledTimes(1);
    expect(boot.mock.calls[0][0]).toMatchObject({ personality: 'chaos' });
  });

  /**
   * The expensive bug: `startSundayLeague` resets the game, so the slot has to
   * be pointed at the Sunday save BEFORE the boot runs. If this ever reads 1
   * (the default) the boot is wiping the wrong slot.
   */
  it('points the save slot at the new club before it boots, not after', async () => {
    setup();
    await tap(screen.getByRole('button', { name: /get started/i }));
    expect(slotAtBoot).toBe(3);
  });

  /** A different draw is a different club — the reroll has to move the name,
   *  the ground and the colours together, because they are one seed. */
  it('rolls a whole new club, kit included', async () => {
    const { container } = setup();
    const kit = () => container.querySelector('svg[aria-label*="kit"]')!.outerHTML;
    // Exact, not a pattern: the reroll button's own label is "Generate a
    // different club NAME and colours".
    const name = () => (screen.getByLabelText('Club name') as HTMLInputElement).placeholder;
    const before = { kit: kit(), name: name() };
    // A reroll is a fresh random seed, so one draw can repeat a colour; four
    // rolls that all match would be the seed not moving.
    let changed = false;
    for (let i = 0; i < 4 && !changed; i += 1) {
      await tap(screen.getByRole('button', { name: /generate a different club/i }));
      changed = kit() !== before.kit || name() !== before.name;
    }
    expect(changed, 'four rolls produced the same club').toBe(true);
  });
});
