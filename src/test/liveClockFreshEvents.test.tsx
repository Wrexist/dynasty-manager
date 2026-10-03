/**
 * The live clock shows a minute's events on the tick that simulates it.
 *
 * The clock simulates one minute ahead of itself (the segment for minute M is
 * played on the tick that shows M) and then moves its event cursor up to M.
 * It used to move that cursor over the events array from the render BEFORE the
 * segment was played — `setAllEvents` only lands on the next render — so a goal
 * at M appeared, and its key moment was checked, one tick late, after M+1 had
 * already been simulated. A decision prompted by that moment then shaped M+2.
 *
 * Also pinned: the first segment always carries the minute-0 kickoff, so the
 * clock has an event to start from even when minute 1 itself is quiet.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { FIRST_HALF_SEGMENTS, GOAL_EVENT_TYPES } from '@/config/matchEngine';
import type { MatchEvent } from '@/types/game';
import type { HalfState } from '@/engine/match';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));
vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

import MatchDay from '@/pages/MatchDay';

const CLUB_ID = 'everton';
/** The minute the injected goal is scored. */
const GOAL_MIN = 3;

type StoreState = ReturnType<typeof useGameStore.getState>;
let original: StoreState['playFirstHalf'];
let base: Record<string, unknown>;

beforeAll(async () => {
  useGameStore.getState().initGame(CLUB_ID);
  for (let i = 0; i < 12; i++) {
    const cur = useGameStore.getState();
    if (cur.fixtures.some(m => m.week === cur.week && !m.played
      && (m.homeClubId === cur.playerClubId || m.awayClubId === cur.playerClubId))) break;
    await useGameStore.getState().advanceWeek();
  }
  original = useGameStore.getState().playFirstHalf;
  base = {};
  for (const [k, v] of Object.entries(useGameStore.getState())) if (typeof v !== 'function') base[k] = structuredClone(v);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useGameStore.setState({ playFirstHalf: original } as Partial<StoreState>);
});

const SCORING: readonly string[] = [...GOAL_EVENT_TYPES, 'own_goal'];
const goalsIn = (events: MatchEvent[], upTo: number) => events.filter(e => SCORING.includes(e.type) && e.minute <= upTo).length;

describe('the live clock', () => {
  it('the first segment always opens with the kickoff', () => {
    useGameStore.setState(structuredClone(base) as Partial<StoreState>);
    const half = useGameStore.getState().playFirstHalf(FIRST_HALF_SEGMENTS[0]);
    expect(half?.events[0]).toMatchObject({ minute: 0, type: 'kickoff' });
  });

  it('shows a goal on the tick that simulates its minute, not the next one', () => {
    useGameStore.setState(structuredClone(base) as Partial<StoreState>);
    vi.useFakeTimers();
    // Every segment that reaches GOAL_MIN carries one home goal there, and the
    // real engine's own goals are stripped, so the score is known minute by minute.
    let latest: HalfState | null = null;
    const st = useGameStore.getState();
    const homeClubId = st.fixtures.find(f => f.week === st.week && !f.played
      && (f.homeClubId === st.playerClubId || f.awayClubId === st.playerClubId))!.homeClubId;
    let simulatedTo = 0;
    useGameStore.setState({
      playFirstHalf: (until?: number) => {
        const m = original(until);
        if (!m) return m;
        simulatedTo = until ?? 45;
        const events = m.events.filter(e => !SCORING.includes(e.type));
        if ((until ?? 45) >= GOAL_MIN) {
          const at = events.findIndex(e => e.minute > GOAL_MIN);
          const goal = { minute: GOAL_MIN, type: 'goal', clubId: homeClubId, description: 'Goal!' } as MatchEvent;
          events.splice(at < 0 ? events.length : at, 0, goal);
        }
        latest = { ...m, events };
        return latest;
      },
    } as Partial<StoreState>);

    render(<MatchDay />);
    fireEvent.click(screen.getByRole('button', { name: /Kick Off/ }));
    const score = () => screen.getAllByRole('status')[0].textContent?.replace(/\s/g, '') ?? '';
    // Each tick simulates the minute it shows; the score must already count it.
    for (let i = 0; i < 40 && simulatedTo < GOAL_MIN + 2; i++) {
      // A key moment pauses the clock; carry on untouched.
      const cont = screen.queryByRole('button', { name: /Continue Match/ });
      if (cont) fireEvent.click(cont);
      act(() => { vi.advanceTimersByTime(3300); });
      expect(score(), `score after simulating ${simulatedTo}'`).toBe(`${goalsIn(latest!.events, simulatedTo)}-0`);
    }
    expect(simulatedTo).toBeGreaterThanOrEqual(GOAL_MIN + 2);
    expect(score()).toBe('1-0');
  });
});
