import { describe, it, expect } from 'vitest';
import { computeManagerLegacy, legacyTier, tierProgress } from '@/utils/managerLegacy';
import type { HallEntry } from '@/utils/hallOfManagers';

function entry(o: Partial<HallEntry> = {}): HallEntry {
  return {
    id: o.id ?? 'e',
    clubName: o.clubName ?? 'Club',
    seasons: o.seasons ?? 1,
    titles: o.titles ?? 0,
    cupWins: o.cupWins ?? 0,
    bestPosition: o.bestPosition ?? 10,
    winRate: o.winRate ?? 50,
    totalWins: o.totalWins ?? 20,
    totalMatches: o.totalMatches ?? 40,
    bestPoints: o.bestPoints ?? 60,
    prestigeLevel: o.prestigeLevel ?? 0,
    recordedAt: o.recordedAt ?? 1,
    leagueCupWins: o.leagueCupWins,
    continentalWins: o.continentalWins,
  };
}

describe('legacyTier', () => {
  it('maps trophy counts to the right tier', () => {
    expect(legacyTier(0)).toBe('Rookie');
    expect(legacyTier(1)).toBe('Journeyman');
    expect(legacyTier(3)).toBe('Established');
    expect(legacyTier(7)).toBe('Elite');
    expect(legacyTier(15)).toBe('Legendary');
    expect(legacyTier(30)).toBe('Immortal');
    expect(legacyTier(49)).toBe('Immortal');
    expect(legacyTier(50)).toBe('Titan');
    expect(legacyTier(99)).toBe('Titan');
    expect(legacyTier(100)).toBe('Godlike');
    expect(legacyTier(999)).toBe('Godlike');
  });
});

describe('tierProgress', () => {
  it('reports the next tier and trophies remaining', () => {
    expect(tierProgress(0)).toEqual({ next: 'Journeyman', remaining: 1 });
    expect(tierProgress(2)).toEqual({ next: 'Established', remaining: 1 });
    expect(tierProgress(6)).toEqual({ next: 'Elite', remaining: 1 });
    expect(tierProgress(14)).toEqual({ next: 'Legendary', remaining: 1 });
    expect(tierProgress(29)).toEqual({ next: 'Immortal', remaining: 1 });
    expect(tierProgress(30)).toEqual({ next: 'Titan', remaining: 20 });
    expect(tierProgress(49)).toEqual({ next: 'Titan', remaining: 1 });
    expect(tierProgress(50)).toEqual({ next: 'Godlike', remaining: 50 });
  });

  it('returns null once the top tier is reached', () => {
    expect(tierProgress(100)).toBeNull();
    expect(tierProgress(500)).toBeNull();
  });

  it('stays consistent with legacyTier at every threshold', () => {
    for (let t = 0; t <= 120; t++) {
      const prog = tierProgress(t);
      if (prog) expect(legacyTier(t)).not.toBe(prog.next); // haven't reached next yet
      else expect(legacyTier(t)).toBe('Godlike');
    }
  });
});

describe('computeManagerLegacy', () => {
  it('returns an empty Rookie legacy for no entries', () => {
    const l = computeManagerLegacy([]);
    expect(l.dynasties).toBe(0);
    expect(l.totalTrophies).toBe(0);
    expect(l.tier).toBe('Rookie');
    expect(l.bestPosition).toBe(0); // 0 = "no career yet" sentinel
    expect(l.winRate).toBe(0);
    expect(l.clubsManaged).toEqual([]);
  });

  it('sums every trophy type into totalTrophies', () => {
    const l = computeManagerLegacy([
      entry({ titles: 2, cupWins: 1, leagueCupWins: 1, continentalWins: 1 }),
      entry({ titles: 1, cupWins: 0, leagueCupWins: 0, continentalWins: 2 }),
    ]);
    expect(l.totalTitles).toBe(3);
    expect(l.totalCupWins).toBe(1);
    expect(l.totalLeagueCupWins).toBe(1);
    expect(l.totalContinentalWins).toBe(3);
    expect(l.totalTrophies).toBe(8); // 3+1+1+3
    expect(l.tier).toBe('Elite'); // 8 trophies
  });

  it('treats missing optional trophy fields as zero (back-compat with old entries)', () => {
    const l = computeManagerLegacy([entry({ titles: 1 })]); // no leagueCupWins/continentalWins
    expect(l.totalLeagueCupWins).toBe(0);
    expect(l.totalContinentalWins).toBe(0);
    expect(l.totalTrophies).toBe(1);
  });

  it('dedupes clubs and tracks the distinct set', () => {
    const l = computeManagerLegacy([
      entry({ clubName: 'Arsenal' }),
      entry({ clubName: 'Arsenal' }),
      entry({ clubName: 'Barcelona' }),
    ]);
    expect(l.dynasties).toBe(3);
    expect(l.clubsManaged.sort()).toEqual(['Arsenal', 'Barcelona']);
  });

  it('computes lifetime win rate from summed wins and matches', () => {
    const l = computeManagerLegacy([
      entry({ totalWins: 30, totalMatches: 50 }),
      entry({ totalWins: 20, totalMatches: 50 }),
    ]);
    expect(l.totalWins).toBe(50);
    expect(l.totalMatches).toBe(100);
    expect(l.winRate).toBe(50);
  });

  it('takes best (lowest) finish, best points, and highest prestige across dynasties', () => {
    const l = computeManagerLegacy([
      entry({ bestPosition: 4, bestPoints: 70, prestigeLevel: 1 }),
      entry({ bestPosition: 1, bestPoints: 95, prestigeLevel: 3 }),
      entry({ bestPosition: 8, bestPoints: 55, prestigeLevel: 2 }),
    ]);
    expect(l.bestPosition).toBe(1);
    expect(l.bestPoints).toBe(95);
    expect(l.highestPrestige).toBe(3);
  });
});
