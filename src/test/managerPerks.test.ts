import { describe, expect, it } from 'vitest';
import { MANAGER_PERKS, canUnlockPerk } from '@/utils/managerPerks';
import type { ManagerProgression } from '@/types/game';

describe('manager perks affordability', () => {
  it('allows unlocking at least one tier-1 branch perk right after reaching level 2', () => {
    const progression: ManagerProgression = {
      level: 2,
      xp: 18,
      unlockedPerks: [],
      prestigeLevel: 0,
    };

    const tierOnePerks = MANAGER_PERKS.filter(perk => perk.tier === 1 && perk.branch !== 'capstone');
    const unlockableCount = tierOnePerks.filter(perk => canUnlockPerk(perk, progression).canUnlock).length;

    expect(unlockableCount).toBeGreaterThan(0);
  });
});
