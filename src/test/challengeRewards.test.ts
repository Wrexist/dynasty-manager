import { describe, it, expect } from 'vitest';
import {
  CHALLENGES,
  CHALLENGE_XP_BY_DIFFICULTY,
  getFeaturedChallengeId,
  isoWeek,
} from '@/data/challenges';

describe('challenge rewards config', () => {
  it('every scenario carries a difficulty-scaled reward and a cosmetic badge', () => {
    for (const c of CHALLENGES) {
      expect(c.rewardXp).toBe(CHALLENGE_XP_BY_DIFFICULTY[c.difficulty]);
      expect(typeof c.badgeId).toBe('string');
      expect(c.badgeId!.length).toBeGreaterThan(0);
    }
  });

  it('badge ids are unique across scenarios', () => {
    const ids = CHALLENGES.map(c => c.badgeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('featured challenge rotation', () => {
  it('is deterministic for a given ISO week', () => {
    const d = new Date(2026, 6, 10); // fixed date
    expect(getFeaturedChallengeId(d)).toBe(getFeaturedChallengeId(new Date(2026, 6, 10)));
  });

  it('always resolves to a real scenario id', () => {
    const ids = new Set(CHALLENGES.map(c => c.id));
    for (let day = 1; day <= 365; day += 7) {
      const d = new Date(2026, 0, day);
      expect(ids.has(getFeaturedChallengeId(d))).toBe(true);
    }
  });

  it('rotates the highlight as the ISO week advances', () => {
    // Over a run of consecutive weeks the featured id should not be constant.
    const seen = new Set<string>();
    for (let w = 0; w < CHALLENGES.length; w++) {
      seen.add(getFeaturedChallengeId(new Date(2026, 0, 1 + w * 7)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('computes ISO week within range', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBeGreaterThanOrEqual(1);
    expect(isoWeek(new Date(2026, 11, 31))).toBeLessThanOrEqual(53);
  });
});

describe('device-global completion gate (XP farming guard)', () => {
  it('addCompletedChallenge is true on first insert, false on repeat', async () => {
    const { addCompletedChallenge, readCompletedChallenges } = await import('@/store/helpers/persistence');
    const id = 'test-farm-guard';
    expect(readCompletedChallenges().includes(id)).toBe(false);
    expect(addCompletedChallenge(id)).toBe(true);
    expect(readCompletedChallenges().includes(id)).toBe(true);
    // Replaying the same scenario on this device must not read as a first
    // completion — seasonEnd gates the XP grant on exactly this.
    expect(addCompletedChallenge(id)).toBe(false);
  });
});
