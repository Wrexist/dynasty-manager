/**
 * Recruitment — the board, and how much of it is true.
 *
 * WHAT THIS FILE IS FOR. The screen's mechanic is that an unwatched recruit's
 * numbers are wrong by up to `SUNDAY_RECRUIT_RUMOUR_ERROR`, and the one thing
 * that must never happen is those wrong numbers CHANGING: a card that re-rolls
 * its estimate on every render reads as a bug, and lets a player re-roll a bad
 * report by leaving the screen and coming back until the numbers look better.
 * So the first case here renders the same board three times — twice into the
 * same tree and once into a fresh one — and demands the identical estimate.
 *
 * The rest is what the redesign could plausibly have broken: `signSundayRecruit`
 * exists on no other screen and has to stay reachable, the per-season allowance
 * has to be visible without the two banners that used to state it in prose, and
 * a rumour has to still be marked as one now that the sentence saying so is
 * gone.
 *
 * STORE WRITES ARE ASYNC — `sundaySlice` dynamic-imports its actions — so every
 * tap is awaited through `act`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SundayRecruit from '@/pages/SundayRecruit';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_RECRUIT_SIGNINGS_PER_SEASON } from '@/config/sundayLeague';
import type { SundayRecruit as SundayRecruitType } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const SEED = 8812;

let consoleError: ReturnType<typeof vi.spyOn>;
let errors: string[];

const sunday = () => useGameStore.getState().sunday!;
const tap = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

/**
 * A recruit built from a man who already exists in the save.
 *
 * Recruits only arrive on a weekly roll, and driving twenty weeks of season to
 * get two of them would make this file a simulation test. Cloning a generated
 * squad member gives a recruit whose `player` and `member` are exactly the
 * shapes the real generator produces.
 */
function makeRecruit(index: number, revealed: boolean): SundayRecruitType {
  const source = sunday().squad[index];
  const player = useGameStore.getState().players[source.playerId];
  const id = `test-recruit-${index}`;
  return {
    id,
    player: { ...player, id: `${id}-player`, clubId: '' },
    member: { ...source, job: source.job },
    source: revealed ? 'trial' : 'mate',
    sourceText: revealed
      ? `Turned up to training on his own and did not stop running.`
      : `${source.job} at the same place as one of the lads.`,
    voucherId: null,
    fee: 40,
    expiresWeek: useGameStore.getState().week + 3,
    revealed,
  };
}

async function putTwoOnTheBoard() {
  const rumour = makeRecruit(0, false);
  const trialist = makeRecruit(1, true);
  await act(async () => {
    useGameStore.setState({
      sunday: { ...sunday(), recruits: [rumour, trialist], balance: 900, signingsThisSeason: 0 },
    });
  });
  return { rumour, trialist };
}

beforeEach(async () => {
  errors = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

afterEach(() => { consoleError.mockRestore(); });

/** The six attribute numbers on one card, in order. */
const numbersOn = (card: HTMLElement) =>
  [...card.querySelectorAll('.tabular-nums')].map(n => n.textContent?.trim() ?? '');

const cardFor = (recruit: SundayRecruitType) =>
  screen.getByText(`${recruit.player.firstName} ${recruit.player.lastName}`).closest('div.rounded-xl') as HTMLElement;

describe('the recruit board says what is known and what is only heard', () => {
  it('logs nothing and nests no button inside a button', async () => {
    await putTwoOnTheBoard();
    const { container } = render(<SundayRecruit />);
    expect(errors, errors.join('\n')).toEqual([]);
    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('button'), 'a button inside a button').toBeNull();
    }
  });

  /**
   * THE ONE THAT MATTERS. The estimate is seeded off the recruit's id, so it
   * has to survive a re-render and a completely fresh mount.
   */
  it('reports the same estimate every time it is drawn', async () => {
    const { rumour } = await putTwoOnTheBoard();
    const first = render(<SundayRecruit />);
    const once = numbersOn(cardFor(rumour));
    expect(once.some(n => n.startsWith('~')), 'a rumour is not marked as one').toBe(true);

    first.rerender(<SundayRecruit />);
    expect(numbersOn(cardFor(rumour)), 'the estimate moved on re-render').toEqual(once);

    first.unmount();
    render(<SundayRecruit />);
    expect(numbersOn(cardFor(rumour)), 'the estimate moved on a fresh mount').toEqual(once);
  });

  /** A man who has been watched is reported exactly, with no tilde on him. */
  it('reports a trialist as fact and a rumour as an estimate', async () => {
    const { rumour, trialist } = await putTwoOnTheBoard();
    render(<SundayRecruit />);
    expect(numbersOn(cardFor(trialist)).every(n => !n.startsWith('~'))).toBe(true);
    expect(numbersOn(cardFor(trialist))).toContain(String(trialist.player.overall));
    expect(numbersOn(cardFor(rumour)).filter(n => n.startsWith('~')).length).toBe(7);
  });

  /** The authored line about how the club heard of him is the only prose left
   *  on the card, and it is per-recruit rather than the same disclaimer twice. */
  it('keeps each recruit\'s own source line', async () => {
    const { rumour, trialist } = await putTwoOnTheBoard();
    render(<SundayRecruit />);
    expect(screen.getByText(rumour.sourceText)).toBeTruthy();
    expect(screen.getByText(trialist.sourceText)).toBeTruthy();
  });

  /** `signSundayRecruit` lives on this screen and nowhere else. */
  it('signs the man whose button was pressed', async () => {
    const { trialist } = await putTwoOnTheBoard();
    render(<SundayRecruit />);
    const before = sunday().squad.length;
    const button = cardFor(trialist).querySelector('button')!;
    await tap(button);
    expect(sunday().squad.length, 'nobody was signed').toBe(before + 1);
    expect(sunday().signingsThisSeason).toBe(1);
    expect(sunday().recruits.map(r => r.id)).not.toContain(trialist.id);
  });

  /** The allowance used to be a line of prose, and a longer line of prose once
   *  it ran out. It is a count in the header now, and the button says why it
   *  is off. */
  it('shows the season allowance and blocks the button when it is gone', async () => {
    await putTwoOnTheBoard();
    await act(async () => {
      useGameStore.setState({
        sunday: { ...sunday(), signingsThisSeason: SUNDAY_RECRUIT_SIGNINGS_PER_SEASON },
      });
    });
    render(<SundayRecruit />);
    expect(screen.getByText(`0 of ${SUNDAY_RECRUIT_SIGNINGS_PER_SEASON} signings left`)).toBeTruthy();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });

  it('says he is out of reach rather than going quietly dead', async () => {
    await putTwoOnTheBoard();
    await act(async () => {
      useGameStore.setState({ sunday: { ...sunday(), balance: 5 } });
    });
    render(<SundayRecruit />);
    expect(screen.getAllByRole('button', { name: /afford/i }).length).toBe(2);
  });
});
