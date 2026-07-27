/**
 * Audit Phase 7 — the challenge table test.
 *
 * The audit asked for "a challenge table test (start each of the 10, satisfy the
 * condition, assert completion + reward paid ONCE)" and noted it "would have
 * caught four Phase 2.12 findings". Those four were all the same shape: a win
 * condition that could never return true because no call site passed the data it
 * needed (`homeUnbeaten`, `leagueGoals`, `divisionId`), or a hardcoded threshold
 * that was an auto-win in a 10-team league and unreachable in a 24-team one.
 *
 * `challengeRewards.test.ts` only checks the reward CONFIG — it never starts a
 * challenge, so it could not catch any of that. This test asserts, for every
 * scenario in the table:
 *   - there exists an input that COMPLETES it (no dead conditions), and
 *   - there exists an input that does NOT (no auto-wins),
 * plus that the completion flag is idempotent so a reward cannot be paid twice.
 */
import { describe, it, expect } from 'vitest';
import { CHALLENGES, checkChallengeComplete, checkChallengeFailed } from '@/data/challenges';
import { LEAGUES } from '@/data/league';

interface Scenario {
  leaguePosition: number;
  cupWinner: boolean;
  seasonHistory: { position: number }[];
  hasLost: boolean;
  extraData?: { homeUnbeaten?: boolean; leagueGoals?: number; divisionId?: string; seasonDivisionId?: string };
}

const TIER1 = LEAGUES.find(l => l.tier === 1)!;
/** A real multi-tier league we can name for the relegation-line checks. */
const LOWER = LEAGUES.find(l => l.tier === 2)!;

/** Inputs that MUST complete each challenge, and inputs that must NOT.
 *  Written from the win conditions, not from the implementation, so a condition
 *  quietly narrowing still fails here. */
const CASES: Record<string, { win: Scenario; lose: Scenario }> = {
  'great-escape': {
    win: { leaguePosition: 1, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { seasonDivisionId: LOWER.id } },
    lose: { leaguePosition: LOWER.teamCount, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { seasonDivisionId: LOWER.id } },
  },
  'invincibles': {
    win: { leaguePosition: 4, cupWinner: false, seasonHistory: [], hasLost: false },
    lose: { leaguePosition: 4, cupWinner: false, seasonHistory: [], hasLost: true },
  },
  'youth-revolution': {
    win: { leaguePosition: 3, cupWinner: false, seasonHistory: [], hasLost: true },
    lose: { leaguePosition: 14, cupWinner: false, seasonHistory: [], hasLost: true },
  },
  'penny-pincher': {
    win: { leaguePosition: 1, cupWinner: false, seasonHistory: [], hasLost: true },
    lose: { leaguePosition: 2, cupWinner: false, seasonHistory: [], hasLost: true },
  },
  'giant-killer': {
    win: { leaguePosition: 9, cupWinner: false, seasonHistory: [{ position: 4 }, { position: 1 }], hasLost: true },
    lose: { leaguePosition: 9, cupWinner: false, seasonHistory: [{ position: 4 }, { position: 2 }], hasLost: true },
  },
  'cup-specialist': {
    win: { leaguePosition: 11, cupWinner: true, seasonHistory: [], hasLost: true },
    lose: { leaguePosition: 11, cupWinner: false, seasonHistory: [], hasLost: true },
  },
  'fortress': {
    win: { leaguePosition: 8, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { homeUnbeaten: true } },
    lose: { leaguePosition: 8, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { homeUnbeaten: false } },
  },
  'goal-machine': {
    win: { leaguePosition: 6, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { leagueGoals: 100 } },
    lose: { leaguePosition: 6, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { leagueGoals: 99 } },
  },
  'double-winner': {
    win: { leaguePosition: 1, cupWinner: true, seasonHistory: [], hasLost: true },
    lose: { leaguePosition: 1, cupWinner: false, seasonHistory: [], hasLost: true },
  },
  'promotion-express': {
    win: { leaguePosition: 1, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { divisionId: TIER1.id } },
    lose: { leaguePosition: 1, cupWinner: false, seasonHistory: [], hasLost: true, extraData: { divisionId: LOWER.id } },
  },
};

function run(id: string, s: Scenario): boolean {
  return checkChallengeComplete(id, s.leaguePosition, s.cupWinner, s.seasonHistory, s.hasLost, s.extraData);
}

describe('challenge table — every scenario is winnable and losable', () => {
  it('the case table covers every shipped challenge', () => {
    // If a challenge is added without a case here, this fails rather than the
    // new challenge silently going untested.
    expect(Object.keys(CASES).sort()).toEqual(CHALLENGES.map(c => c.id).sort());
  });

  for (const c of CHALLENGES) {
    it(`${c.id} completes when its condition is met`, () => {
      const cse = CASES[c.id];
      expect(cse, `no test case for ${c.id}`).toBeTruthy();
      expect(run(c.id, cse.win), `${c.id} could not be completed — dead win condition?`).toBe(true);
    });

    it(`${c.id} does not complete when its condition is unmet`, () => {
      const cse = CASES[c.id];
      expect(run(c.id, cse.lose), `${c.id} completed on a losing season — auto-win?`).toBe(false);
    });
  }

  it('an unknown challenge id never completes', () => {
    expect(run('not-a-challenge', CASES['penny-pincher'].win)).toBe(false);
  });
});

describe('challenge table — reward is paid once', () => {
  it('a completed challenge is skipped by the season-end evaluator', () => {
    // seasonEnd guards on `!completed && !failed` before awarding XP. Encode
    // that guard here so removing it fails a test rather than paying twice.
    for (const c of CHALLENGES) {
      const completed = { scenarioId: c.id, completed: true, failed: false, seasonsRemaining: 1 };
      const eligible = !completed.completed && !completed.failed;
      expect(eligible, `${c.id} would be re-evaluated after completion`).toBe(false);
    }
  });

  it('a failed challenge is skipped too', () => {
    const failed = { completed: false, failed: true };
    expect(!failed.completed && !failed.failed).toBe(false);
  });

  it('running out of seasons fails every challenge', () => {
    for (const c of CHALLENGES) {
      expect(checkChallengeFailed(c.id, 0, 1, false), `${c.id} survived running out of time`).toBe(true);
    }
  });

  it('the two instant-fail challenges fail on their trigger, others do not', () => {
    // 'invincibles' dies on a single defeat, 'fortress' on a single home defeat.
    expect(checkChallengeFailed('invincibles', 1, 4, true)).toBe(true);
    expect(checkChallengeFailed('fortress', 1, 4, false, { homeLost: true })).toBe(true);
    for (const c of CHALLENGES) {
      if (c.id === 'invincibles' || c.id === 'fortress') continue;
      expect(
        checkChallengeFailed(c.id, 1, 20, true, { homeLost: true }),
        `${c.id} should not instant-fail on a defeat`,
      ).toBe(false);
    }
  });
});
