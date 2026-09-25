/**
 * An identical veteran declines at the same expected rate at the user's club
 * as at an AI club.
 *
 * The user's squad runs `applyPlayerDevelopment` every week; an AI club runs it
 * once every `aiDevelopmentSlices(totalWeeks)` weeks. Growth is capped per
 * season, decline was not, so the user's 33-year-olds aged ~3.8x faster than
 * identical rivals. `playerClubDeclineRate` scales the weekly decline roll.
 *
 * This mirrors the two call patterns in `advanceWeekImpl` with a seeded RNG.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyPlayerDevelopment } from '@/store/helpers/development';
import { aiDevelopmentSlices, playerClubDeclineRate } from '@/config/aiSimulation';
import { TOTAL_WEEKS } from '@/config/gameBalance';
import type { Player } from '@/types/game';
import { buildPlayer } from './helpers/seasonFixtures';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const COHORT = 400;
const attrSum = (p: Player) => Object.values(p.attributes).reduce((a, b) => a + b, 0);

function veteran(i: number): Player {
  return buildPlayer({
    id: `vet${i}`,
    age: 33,
    position: 'CM',
    attributes: { pace: 75, shooting: 75, passing: 80, defending: 70, physical: 75, mental: 82 },
    overall: 80,
  });
}

/** Mean attribute points lost across one season, for one cohort. */
function seasonDecline(atUsersClub: boolean): number {
  const slices = aiDevelopmentSlices(TOTAL_WEEKS);
  let lost = 0;
  for (let i = 0; i < COHORT; i++) {
    let p = veteran(i);
    const start = attrSum(p);
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      if (atUsersClub) {
        p = applyPlayerDevelopment(p, 'balanced', 0, 0, playerClubDeclineRate(TOTAL_WEEKS));
      } else if (week % slices === 0) {
        p = applyPlayerDevelopment(p, 'balanced');
      }
    }
    lost += start - attrSum(p);
  }
  return lost / COHORT;
}

describe('veteran decline parity', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("a 33-year-old's season decline at the user's club matches an AI club's", () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(33));
    const user = seasonDecline(true);
    const ai = seasonDecline(false);
    expect(ai).toBeGreaterThan(1); // the cohort genuinely declines
    // Within 15%: the AI's pass count is totalWeeks / slices rounded to whole
    // weeks, so the two budgets can differ by one pass in twelve.
    expect(user / ai, `user ${user.toFixed(2)} vs AI ${ai.toFixed(2)} attr points/season`).toBeGreaterThan(0.85);
    expect(user / ai).toBeLessThan(1.15);
  });

  it('the default decline rate is unchanged for AI passes', () => {
    expect(playerClubDeclineRate(TOTAL_WEEKS)).toBeCloseTo(1 / aiDevelopmentSlices(TOTAL_WEEKS));
    expect(playerClubDeclineRate(TOTAL_WEEKS)).toBeLessThan(1);
  });
});
