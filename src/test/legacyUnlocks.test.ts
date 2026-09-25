/**
 * Legacy tier unlocks — the lifetime tier (total trophies across every
 * recorded dynasty) now unlocks cosmetics and a Manager Career job-market
 * reputation bonus. Before this the tier was a label and nothing else.
 *
 * The bonus is pinned to the job market: which vacancies are listed and how
 * high their bar is, which clubs approach the manager, and a new career's
 * starting offers. A source scan pins that nothing else reads it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEGACY_TIER_ORDER,
  legacyUnlockedRewardIds,
  legacyJobReputationBonus,
  readLegacyTier,
  getLegacyJobReputationBonus,
} from '@/utils/managerLegacy';
import { LEGACY_TIER_UNLOCKS, LEGACY_COSMETICS, LEGACY_START_OFFER_UPGRADE_BONUS, PROFILE_BANNER_STYLES } from '@/config/managerPass';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { CAREER_START_QUALITY_TIERS } from '@/config/managerCareer';
import { hasCosmetic } from '@/utils/monetization';
import { saveToHall, type HallEntry } from '@/utils/hallOfManagers';
import {
  generateJobVacancies,
  generateUnemployedOffer,
  generateStartingOffers,
  createDefaultManager,
} from '@/utils/managerCareer';
import { LEAGUES, CLUBS_DATA } from '@/data/league';
import { useGameStore } from '@/store/gameStore';
import type { Club, MonetizationState } from '@/types/game';

function hallEntry(id: string, titles: number): HallEntry {
  return {
    id, clubName: `Club ${id}`, seasons: 5, titles, cupWins: 0, bestPosition: 1, winRate: 60,
    totalWins: 100, totalMatches: 160, bestPoints: 90, prestigeLevel: 0, recordedAt: 1,
  };
}

const NOT_PRO: MonetizationState = {
  entitlements: [], activeCosmetics: {}, adRewardsClaimed: {}, firstLaunchTimestamp: 0,
  starterKitDismissed: false, subscription: null,
  adEngagement: { dayKey: '', watchedToday: 0, promptsToday: 0, consecutiveDismissals: 0, lastPromptAt: 0, totalWatched: 0 },
};

const tierOf = (divisionId: string) => LEAGUES.find(l => l.id === divisionId)?.qualityTier;

/** One real club from a league of each quality tier, as a minimal `clubs` record. */
function clubsForTiers(...qualityTiers: number[]): Record<string, Club> {
  const out: Record<string, Club> = {};
  for (const qt of qualityTiers) {
    const cd = CLUBS_DATA.find(c => tierOf(c.divisionId) === qt)!;
    out[cd.id] = { id: cd.id, name: cd.name, divisionId: cd.divisionId, reputation: cd.reputation, budget: cd.budget } as Club;
  }
  return out;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Legacy unlocks — config', () => {
  it('unlocks cumulatively, lowest tier first', () => {
    expect(LEGACY_TIER_ORDER).toEqual(['Rookie', 'Journeyman', 'Established', 'Elite', 'Legendary', 'Immortal']);
    expect(legacyUnlockedRewardIds('Rookie')).toEqual([]);
    expect(legacyUnlockedRewardIds('Established')).toEqual([
      ...LEGACY_TIER_UNLOCKS.Journeyman.rewardIds, ...LEGACY_TIER_UNLOCKS.Established.rewardIds,
    ]);
    expect(new Set(legacyUnlockedRewardIds('Immortal'))).toEqual(new Set(LEGACY_COSMETICS.map(c => c.id)));
  });

  it('pays only earned catalog cosmetics, each drawable', () => {
    for (const id of legacyUnlockedRewardIds('Immortal')) {
      const item = COSMETIC_ITEMS.find(c => c.id === id);
      expect(item, id).toBeDefined();
      expect(item!.earnedBy).toBe('legacy');
      expect(item!.pack).toBeUndefined();
      if (item!.category === 'profile_banner') expect(PROFILE_BANNER_STYLES[id], id).toBeTruthy();
    }
  });

  it('raises the job-market bonus with every tier, from nothing at Rookie', () => {
    const bonuses = LEGACY_TIER_ORDER.map(legacyJobReputationBonus);
    expect(bonuses[0]).toBe(0);
    for (let i = 1; i < bonuses.length; i++) expect(bonuses[i]).toBeGreaterThan(bonuses[i - 1]);
  });
});

describe('Legacy unlocks — reading the Hall', () => {
  it('derives the tier from the device-global Hall and follows it as it changes', () => {
    expect(readLegacyTier()).toBe('Rookie');
    expect(getLegacyJobReputationBonus()).toBe(0);
    saveToHall(hallEntry('a', 3));
    expect(readLegacyTier()).toBe('Established');
    saveToHall(hallEntry('b', 5));
    expect(readLegacyTier()).toBe('Elite');
    expect(getLegacyJobReputationBonus()).toBe(LEGACY_TIER_UNLOCKS.Elite.jobReputationBonus);
  });

  it('owns a Legacy cosmetic exactly while its tier is held', () => {
    expect(hasCosmetic(NOT_PRO, 'badge-the-journeyman')).toBe(false);
    saveToHall(hallEntry('a', 1)); // Journeyman
    expect(hasCosmetic(NOT_PRO, 'badge-the-journeyman')).toBe(true);
    expect(hasCosmetic(NOT_PRO, 'badge-elite-manager')).toBe(false);
  });

  it('can be worn through the store once unlocked', () => {
    useGameStore.setState({ monetization: NOT_PRO });
    expect(useGameStore.getState().equipEarnedCosmetic('banner-legacy-bronze')).toBe(false);
    saveToHall(hallEntry('a', 1));
    expect(useGameStore.getState().equipEarnedCosmetic('banner-legacy-bronze')).toBe(true);
    expect(useGameStore.getState().monetization.activeCosmetics.profile_banner).toBe('banner-legacy-bronze');
  });
});

describe('Legacy unlocks — job-market reputation', () => {
  it('lists bigger clubs and lowers their bar by the bonus', () => {
    const clubs = clubsForTiers(2, 4);
    const t2 = Object.values(clubs).find(c => tierOf(c.divisionId) === 2)!;

    // A fresh career (30) cannot see a second-tier job: it lists from 125.
    const plain = generateJobVacancies(clubs, 30, 1, 1, undefined, 0);
    expect(plain.some(v => v.clubId === t2.id)).toBe(false);

    const legacy = generateJobVacancies(clubs, 30, 1, 1, undefined, 125);
    const listed = legacy.find(v => v.clubId === t2.id);
    expect(listed).toBeDefined();
    expect(listed!.minReputation).toBe(250 - 125);
  });

  it('the lowered bar is what the apply gate compares against', () => {
    const clubs = clubsForTiers(2);
    const rep = 130;
    const without = generateJobVacancies(clubs, rep, 1, 1, undefined, 0)[0];
    const withBonus = generateJobVacancies(clubs, rep, 1, 1, undefined, 125)[0];
    expect(rep >= without.minReputation).toBe(false);
    expect(rep >= withBonus.minReputation).toBe(true);
  });

  it('defaults to the player\'s own Legacy (the hook needs no caller change)', () => {
    const clubs = clubsForTiers(2);
    expect(generateJobVacancies(clubs, 30, 1, 1)).toHaveLength(0);
    saveToHall(hallEntry('a', 30)); // Immortal
    const listed = generateJobVacancies(clubs, 30, 1, 1);
    expect(listed).toHaveLength(1);
    expect(listed[0].minReputation).toBe(250 - LEGACY_TIER_UNLOCKS.Immortal.jobReputationBonus);
  });

  it('draws unemployed approaches from a higher tier', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const manager = { ...createDefaultManager('Legacy Tester', 'England', 40, []), reputationScore: 60, contract: null };
    const plain = generateUnemployedOffer(manager, {}, 1, 1, [], undefined, 0)!;
    const legacy = generateUnemployedOffer(manager, {}, 1, 1, [], undefined, 125)!;
    expect(tierOf(plain.divisionId)).toBe(3);
    expect(tierOf(legacy.divisionId)).toBe(2);
  });

  it('upgrades one starting offer from Elite up', () => {
    const clubs = Object.fromEntries(CLUBS_DATA.map(c => [c.id, { id: c.id, name: c.name, divisionId: c.divisionId, reputation: c.reputation }]));
    const bestStart = Math.min(...CAREER_START_QUALITY_TIERS);
    for (let i = 0; i < 5; i++) {
      const below = generateStartingOffers(clubs, LEGACY_START_OFFER_UPGRADE_BONUS - 1);
      expect(below.every(o => (tierOf(o.divisionId) ?? 9) >= bestStart)).toBe(true);
      const elite = generateStartingOffers(clubs, LEGACY_START_OFFER_UPGRADE_BONUS);
      expect(elite.filter(o => tierOf(o.divisionId) === bestStart - 1)).toHaveLength(1);
    }
  });
});

describe('Legacy unlocks — never a sim parameter', () => {
  it('only the job market and the Legacy page read the bonus', () => {
    const root = join(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== 'test') walk(full);
        } else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const readers = files
      .filter(f => /JobReputationBonus|jobReputationBonus/.test(readFileSync(f, 'utf8')))
      .map(f => f.slice(root.length + 1).replace(/\\/g, '/'))
      .sort();
    // The config defines it, managerLegacy resolves it, managerCareer's
    // job-market helpers apply it, and the Legacy page displays it.
    const ALLOWED = new Set(['config/managerPass.ts', 'utils/managerLegacy.ts', 'utils/managerCareer.ts', 'pages/DynastyLegacy.tsx']);
    expect(readers.filter(f => !ALLOWED.has(f))).toEqual([]);
    expect(readers).toContain('utils/managerCareer.ts');
  });
});
