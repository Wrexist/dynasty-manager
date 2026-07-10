/**
 * Board ultimatum lifecycle (G3 — mid-season board teeth).
 *
 * At a review week (BOARD_REVIEW_WEEKS) with critically low confidence the
 * board issues an ultimatum; at the deadline it either grants a reprieve
 * (position/confidence recovered), sacks the manager mid-season (career mode,
 * via the job-market machinery), or strips budget (sandbox). Season 1 has a
 * grace window. Drive pattern mirrors weekAdvanceContract.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  BOARD_REVIEW_WEEKS,
  ULTIMATUM_CONFIDENCE_THRESHOLD,
  ULTIMATUM_HORIZON_WEEKS,
  ULTIMATUM_SANDBOX_CONFIDENCE_FLOOR,
  ULTIMATUM_SURVIVE_CONFIDENCE,
} from '@/config/gameBalance';
import { createDefaultManager } from '@/utils/managerCareer';
import type { CareerManager } from '@/types/game';

const CLUB_ID = 'celtic';
const REVIEW_WEEK = BOARD_REVIEW_WEEKS[0];

beforeEach(async () => {
  await useGameStore.getState().initGame(CLUB_ID);
});

function lastBoardMessage(title: string) {
  return useGameStore.getState().messages.find(m => m.type === 'board' && m.title === title);
}

describe('board ultimatum — issue', () => {
  it('issues an ultimatum at a review week when confidence is critical (post season 1)', async () => {
    useGameStore.setState({ season: 2, week: REVIEW_WEEK - 1, boardConfidence: ULTIMATUM_CONFIDENCE_THRESHOLD });
    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.boardUltimatum).not.toBeNull();
    expect(s.boardUltimatum!.deadlineWeek).toBe(REVIEW_WEEK + ULTIMATUM_HORIZON_WEEKS);
    expect(s.boardUltimatum!.issuedSeason).toBe(2);
    expect(lastBoardMessage('Board Ultimatum')).toBeTruthy();
  });

  it('does NOT issue during the season-1 grace window', async () => {
    useGameStore.setState({ season: 1, week: REVIEW_WEEK - 1, boardConfidence: 10 });
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().boardUltimatum).toBeNull();
  });

  it('does NOT issue when confidence is healthy', async () => {
    useGameStore.setState({ season: 2, week: REVIEW_WEEK - 1, boardConfidence: 60 });
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().boardUltimatum).toBeNull();
  });
});

describe('board ultimatum — deadline', () => {
  it('grants a reprieve (confidence bump, ultimatum cleared) when confidence recovered', async () => {
    const deadline = 22;
    useGameStore.setState({
      season: 2, week: deadline - 1,
      boardConfidence: ULTIMATUM_SURVIVE_CONFIDENCE + 20,
      boardUltimatum: { issuedSeason: 2, issuedWeek: deadline - ULTIMATUM_HORIZON_WEEKS, deadlineWeek: deadline, targetPosition: 1 },
    });
    const confBefore = useGameStore.getState().boardConfidence;
    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.boardUltimatum).toBeNull();
    expect(s.boardConfidence).toBeGreaterThanOrEqual(confBefore);
    expect(lastBoardMessage('Ultimatum: Reprieve')).toBeTruthy();
  });

  it('sandbox failure strips budget and floors confidence instead of sacking', async () => {
    const deadline = 22;
    useGameStore.setState({
      season: 2, week: deadline - 1,
      boardConfidence: 10,
      // targetPosition 0 is unreachable — guarantees failure.
      boardUltimatum: { issuedSeason: 2, issuedWeek: deadline - ULTIMATUM_HORIZON_WEEKS, deadlineWeek: deadline, targetPosition: 0 },
    });
    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.boardUltimatum).toBeNull();
    expect(s.boardConfidence).toBeGreaterThanOrEqual(ULTIMATUM_SANDBOX_CONFIDENCE_FLOOR);
    expect(lastBoardMessage('Ultimatum: Consequences')).toBeTruthy();
    // Still employed — sandbox never ends the save.
    expect(s.currentScreen).not.toBe('job-market');
  });

  it('career failure sacks the manager mid-season through the job market', async () => {
    const deadline = 22;
    const manager: CareerManager = {
      ...createDefaultManager('Test Manager', 'England', 40, []),
      contract: { clubId: CLUB_ID, salary: 5000, startSeason: 1, endSeason: 4, bonuses: [] },
      careerHistory: [{ clubId: CLUB_ID, clubName: 'Celtic', startSeason: 1, endSeason: null, reason: null }] as CareerManager['careerHistory'],
    };
    useGameStore.setState({
      gameMode: 'career', careerManager: manager,
      season: 2, week: deadline - 1,
      boardConfidence: 10,
      boardUltimatum: { issuedSeason: 2, issuedWeek: deadline - ULTIMATUM_HORIZON_WEEKS, deadlineWeek: deadline, targetPosition: 0 },
    });
    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.boardUltimatum).toBeNull();
    expect(s.careerManager!.contract).toBeNull();
    expect(s.careerManager!.sackedCount).toBe(1);
    expect(s.careerManager!.careerHistory.some(e => e.reason === 'sacked')).toBe(true);
    expect(s.currentScreen).toBe('job-market');
    expect(lastBoardMessage('Sacked')).toBeTruthy();
  });

  it('a stale ultimatum from a previous season is discarded, not evaluated', async () => {
    useGameStore.setState({
      // Explicit sandbox: the preceding test's sacked career manager would
      // otherwise route advanceWeek down the unemployed-week path.
      gameMode: 'sandbox', careerManager: null,
      season: 3, week: 21, boardConfidence: 10,
      // Deadline already passed — would fail hard if evaluated, but it's from
      // season 2 so it must be silently discarded instead.
      boardUltimatum: { issuedSeason: 2, issuedWeek: 15, deadlineWeek: 21, targetPosition: 0 },
    });
    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.boardUltimatum).toBeNull();
    expect(lastBoardMessage('Ultimatum: Consequences')).toBeFalsy();
    expect(lastBoardMessage('Sacked')).toBeFalsy();
  });
});

describe('board ultimatum — short-league deadline clamp', () => {
  it('does NOT issue when the deadline could not mature before season end', async () => {
    // Deadline would be REVIEW_WEEK + horizon > totalWeeks — seasonEnd would
    // wipe the ultimatum before its deadline branch ever ran, so the board
    // must not make a threat it can never follow through on.
    useGameStore.setState({
      season: 2, week: REVIEW_WEEK - 1, boardConfidence: 10,
      totalWeeks: REVIEW_WEEK + ULTIMATUM_HORIZON_WEEKS - 1,
    });
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().boardUltimatum).toBeNull();
  });
});
