/**
 * R1 — the Weekly Digest, the finance history and the budget must tell the
 * same story, and the board must judge the club on the weekly average.
 *
 * THE BUG (playthrough 2026-09, Liverpool Sandbox). The Digest read
 * "Net Income −£3,091K" every week, Finance read "+£1.9M/week", and the budget
 * fell £126.9M → £118.6M over six weeks with no signings. Three causes:
 *
 *  1. The gate is paid 2x on home weeks and 0 on away weeks, and the fixture
 *     generator gave every club ~10 away games in a row (fixed in
 *     `data/league.ts`, pinned in seasonFixtureGeneration.test.ts). The Digest
 *     showed the realised week, the Finance page the season average, and
 *     neither said which.
 *  2. The FFP check read the REALISED week, so a top club was "FFP critical"
 *     (costs 300% of revenue) on every away week while the Finance page said
 *     "Healthy".
 *  3. The Digest stated merch net while the page stated it gross, and a
 *     random event's cash moved the budget without appearing in the week.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { mulberry32 } from '@/utils/communityPackPool';
import { getFinanceBreakdown } from '@/utils/financeHelpers';

const CLUB = 'liverpool';
const WEEKS = 10;

function projection() {
  const s = useGameStore.getState();
  return getFinanceBreakdown({
    club: s.clubs[s.playerClubId], facilities: s.facilities, staffMembers: s.staff.members,
    scoutingAssignmentCount: s.scouting.assignments.length, fanMood: s.fanMood,
    leagueTable: s.leagueTable, managerProgression: s.managerProgression,
    sponsorDeals: s.sponsorDeals || [], merchandise: s.merchandise, players: s.players,
    division: s.playerDivision, managerSalary: s.careerManager?.contract?.salary ?? 0,
  });
}

describe('R1: realised week reconciles with the budget', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(7));
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });
  afterEach(() => vi.restoreAllMocks());

  it(`budget change == Digest net == finance-history net for ${WEEKS} weeks`, { timeout: 120_000 }, async () => {
    let homeWeeks = 0;
    let awayWeeks = 0;
    for (let w = 0; w < WEEKS; w++) {
      useGameStore.getState().playCurrentMatch();
      const before = useGameStore.getState();
      const budgetBefore = before.clubs[CLUB].budget;
      await useGameStore.getState().advanceWeek();
      const after = useGameStore.getState();
      const budgetAfter = after.clubs[CLUB].budget;
      const digest = after.weeklyDigest!;
      const entry = after.financeHistory[after.financeHistory.length - 1];

      const digestNet = digest.incomeEarned - digest.expensesPaid;
      expect(budgetAfter - budgetBefore, `week ${before.week}: budget moved by something the Digest did not report`)
        .toBeCloseTo(digestNet, 0);
      expect(entry.income).toBe(digest.incomeEarned);
      expect(entry.expenses).toBe(digest.expensesPaid);
      expect(entry.balance).toBe(budgetAfter);

      expect(digest.matchdayIncome).toBeDefined();
      if ((digest.matchdayIncome ?? 0) > 0) homeWeeks++; else awayWeeks++;
    }
    // Venues alternate, so ten weeks hold both kinds.
    expect(homeWeeks).toBeGreaterThanOrEqual(4);
    expect(awayWeeks).toBeGreaterThanOrEqual(4);
  });

  it('states merch on the Finance page basis (gross income, operating cost as an expense)', async () => {
    const page = projection();
    useGameStore.getState().playCurrentMatch();
    await useGameStore.getState().advanceWeek();
    const digest = useGameStore.getState().weeklyDigest!;
    const pageExpenseLines = page.expenses.reduce((sum, e) => sum + e.amount, 0);
    // Expenses are not lumpy: the realised week charges exactly what the page projects.
    expect(digest.expensesPaid).toBe(pageExpenseLines);
  });
});

describe('R1: the board reads the weekly average, not the lumpy week', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(11));
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });
  afterEach(() => vi.restoreAllMocks());

  it('a healthy top club is not "FFP critical" on an away week', async () => {
    const s0 = useGameStore.getState();
    // Week 3 advances into week 4, a 4-week FFP message boundary. Make the
    // club's league fixture that week an away game.
    const WEEK = 3;
    const fixtures = s0.fixtures.map(m => {
      if (m.week !== WEEK || m.homeClubId !== CLUB) return m;
      return { ...m, homeClubId: m.awayClubId, awayClubId: CLUB };
    });
    expect(fixtures.some(m => m.week === WEEK && m.awayClubId === CLUB)).toBe(true);
    useGameStore.setState({ week: WEEK, fixtures });

    const before = projection();
    expect(before.totalExpenses / before.totalIncome, 'precondition: projected costs are not critical')
      .toBeLessThan(0.9);

    await useGameStore.getState().advanceWeek();
    const s = useGameStore.getState();
    const critical = s.messages.filter(m => m.title === 'FFP: Critical Warning!' && m.week === WEEK + 1);
    expect(critical).toEqual([]);
  });
});
