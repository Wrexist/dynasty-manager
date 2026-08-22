/**
 * Club history — the mode's memory.
 *
 * WHAT THIS FILE IS FOR. Everything on this screen is authored: the moment of
 * the season, the highlights, the sentence that makes a record a story, the
 * reason a man is remembered, and the reason the club folded. A redesign that
 * summarised, truncated or dropped any of it would look tidier and would be
 * the one unforgivable change, so the cases below assert the WHOLE string is
 * in the document — not that a card rendered.
 *
 * The other two are the actions that exist on this screen and nowhere else:
 * `endSundaySeason`, which rolls the club into the next year and then sends it
 * home, and the main-menu exit a folded club leaves by.
 *
 * STORE WRITES ARE ASYNC — `sundaySlice` dynamic-imports its actions — so every
 * tap is awaited through `act`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SundayHistory from '@/pages/SundayHistory';
import { useGameStore } from '@/store/gameStore';
import type { SundayLegend, SundayRecordEntry, SundaySeasonRecord } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const SEED = 3390;

const sunday = () => useGameStore.getState().sunday!;
const tap = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

const MOMENT = 'Nine men, two down at the Rec, and Deano hit the bar twice before the winner went in off the keeper.';
const HIGHLIGHTS = ['Won six on the bounce over Christmas.', 'Beat the Fox & Hounds home and away.'];
const RECORD_DETAIL = 'With eight men and two ringers off the Sunday morning car park.';
const LEGEND_REASON = 'Never missed a Sunday in three seasons, including the one after his wedding.';

const season = (n: number, promoted: boolean): SundaySeasonRecord => ({
  season: n,
  divisionId: sunday().divisionId,
  divisionName: 'Sunday League Division Four',
  position: promoted ? 2 : 6,
  played: 18, won: 11, drawn: 3, lost: 4, goalsFor: 44, goalsAgainst: 27, points: 36,
  promoted, relegated: false, folded: false,
  cupResult: 'Lost the Sunday Cup final',
  topScorer: { name: 'Deano Marsh', goals: 17 },
  playerOfTheSeason: { name: 'Kev Yates', rating: 7.4 },
  momentOfTheSeason: MOMENT,
  balanceEnd: 410,
  highlights: HIGHLIGHTS,
});

const record: SundayRecordEntry = {
  id: 'biggest-win',
  label: 'Biggest win',
  value: '9-1 vs Dog & Duck',
  season: 2,
  week: 14,
  detail: RECORD_DETAIL,
};

let legend: SundayLegend;

async function givenAPast() {
  legend = {
    playerId: sunday().squad[0].playerId,
    name: 'Pawel Naylor',
    reason: LEGEND_REASON,
    apps: 54, goals: 9, seasons: 3,
  };
  await act(async () => {
    useGameStore.setState({
      sunday: {
        ...sunday(),
        history: [season(1, false), season(2, true)],
        records: [record],
        legends: [legend],
      },
      season: 3,
    });
  });
}

let consoleError: ReturnType<typeof vi.spyOn>;
let errors: string[];

beforeEach(async () => {
  errors = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  navigate.mockClear();
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

afterEach(() => { consoleError.mockRestore(); });

describe('club history keeps every word it was given', () => {
  it('logs nothing and nests no button inside a button', async () => {
    await givenAPast();
    const { container } = render(<SundayHistory />);
    expect(errors, errors.join('\n')).toEqual([]);
    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('button'), 'a button inside a button').toBeNull();
    }
  });

  /** The authored text, verbatim. `getByText` matches the whole node, so a
   *  truncated or summarised line fails here. */
  it('shows the moment, the highlights, the record\'s story and the citation whole', async () => {
    await givenAPast();
    render(<SundayHistory />);
    expect(screen.getAllByText(MOMENT).length, 'moment of the season').toBe(2);
    for (const highlight of HIGHLIGHTS) {
      expect(screen.getAllByText(highlight).length, highlight).toBe(2);
    }
    expect(screen.getByText(RECORD_DETAIL), 'record detail').toBeTruthy();
    expect(screen.getByText(LEGEND_REASON), 'legend citation').toBeTruthy();
  });

  /** Two facts that were in the save and had never reached a screen. */
  it('draws the numbers the old lists threw away', async () => {
    await givenAPast();
    render(<SundayHistory />);
    // A legend's career, which used to be a name and a sentence.
    expect(screen.getByText(`${legend.apps} apps · ${legend.goals} goals · ${legend.seasons} seasons`)).toBeTruthy();
    // The player of the season, written into every season record and drawn by
    // nothing.
    expect(screen.getAllByText(/Kev Yates \(7\.4\)/).length).toBe(2);
    // When a record was set.
    expect(screen.getByText('S2 W14')).toBeTruthy();
  });

  it('gives every season its own card, newest first', async () => {
    await givenAPast();
    const { container } = render(<SundayHistory />);
    const cards = [...container.querySelectorAll('li')].filter(li => li.textContent?.includes('Division Four'));
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Promoted');
  });

  /** Two different absences used to share one sentence. */
  it('has a different thing to say about each kind of nothing', () => {
    render(<SundayHistory />);
    const empties = new Set([
      screen.getByText(/first season is still going/i).textContent,
      screen.getByText(/nothing worth recording yet/i).textContent,
      screen.getByText(/nobody has been here long enough/i).textContent,
    ]);
    expect(empties.size).toBe(3);
  });

  /** `endSundaySeason` exists on this screen and nowhere else. */
  it('rolls the season over and goes home', async () => {
    await givenAPast();
    await act(async () => {
      useGameStore.setState({ sunday: { ...sunday(), seasonComplete: true } });
    });
    render(<SundayHistory />);
    const before = useGameStore.getState().season;
    await tap(screen.getByRole('button', { name: /start next season/i }));
    expect(useGameStore.getState().season, 'the season did not roll').toBe(before + 1);
    expect(useGameStore.getState().currentScreen).toBe('sunday-hub');
  });

  /** The other ending. The fold reason is authored per-run and is the last
   *  thing the club ever says. */
  it('lets a folded club out through the front door, with its reason intact', async () => {
    await givenAPast();
    const reason = 'Four men turned up in February and the treasurer stopped answering.';
    await act(async () => {
      useGameStore.setState({ sunday: { ...sunday(), folded: true, foldReason: reason } });
    });
    render(<SundayHistory />);
    expect(screen.getByText(reason)).toBeTruthy();
    await tap(screen.getByRole('button', { name: /main menu/i }));
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
