import { ManagerPerk, PerkId, ManagerProgression } from '@/types/game';
import { getPrestigeXPMultiplier } from '@/utils/prestige';

export const MANAGER_PERKS: ManagerPerk[] = [
  // Tier 1 — 100 XP each
  { id: 'motivator', name: 'Motivator', description: 'Pre-match team talks give +5 morale boost', icon: '📣', cost: 100, tier: 1 },
  { id: 'fitness_guru', name: 'Fitness Guru', description: 'Reduce injury risk by 20% during training', icon: '💪', cost: 100, tier: 1 },
  { id: 'scout_network', name: 'Scout Network', description: 'Scouting assignments complete 1 week faster', icon: '🔍', cost: 100, tier: 1 },
  { id: 'fan_favourite', name: 'Fan Favourite', description: 'Stadium income +15% from fan mood bonus', icon: '🏟️', cost: 100, tier: 1 },

  // Tier 2 — 250 XP each, require a Tier 1 perk
  { id: 'tactical_genius', name: 'Tactical Genius', description: 'Tactical familiarity increases 30% faster', icon: '🧠', cost: 250, tier: 2, prerequisite: 'motivator' },
  { id: 'youth_developer', name: 'Youth Developer', description: 'Youth academy prospects develop 25% faster', icon: '🌱', cost: 250, tier: 2, prerequisite: 'fitness_guru' },

  // Tier 3 — 500 XP each, require a Tier 2 perk
  { id: 'transfer_shark', name: 'Transfer Shark', description: 'Transfer fees are 15% lower when buying', icon: '🦈', cost: 500, tier: 3, prerequisite: 'scout_network' },
  { id: 'disciplinarian', name: 'Disciplinarian', description: 'Players get 30% fewer yellow/red cards', icon: '📋', cost: 500, tier: 3, prerequisite: 'tactical_genius' },
];

export function createDefaultProgression(): ManagerProgression {
  return { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 };
}

/** XP needed for next level */
export function xpForLevel(level: number): number {
  return 50 + level * 30;
}

/** Grant XP and handle level-ups. Returns updated progression. */
export function grantXP(prog: ManagerProgression, amount: number): ManagerProgression {
  const multiplier = getPrestigeXPMultiplier(prog.prestigeLevel || 0);
  let xp = prog.xp + Math.round(amount * multiplier);
  let level = prog.level;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return { ...prog, xp, level };
}

/** XP rewards for game events */
export const XP_REWARDS = {
  win: 15,
  draw: 5,
  cupWin: 50,
  seasonEnd: 30,
  youthPromote: 10,
  titleWin: 100,
} as const;

/** Check if a perk can be unlocked */
export function canUnlockPerk(perk: ManagerPerk, prog: ManagerProgression): { canUnlock: boolean; reason?: string } {
  if (prog.unlockedPerks.includes(perk.id)) return { canUnlock: false, reason: 'Already unlocked' };
  if (perk.prerequisite && !prog.unlockedPerks.includes(perk.prerequisite)) {
    const prereqPerk = MANAGER_PERKS.find(p => p.id === perk.prerequisite);
    return { canUnlock: false, reason: `Requires "${prereqPerk?.name}"` };
  }
  const totalXP = getTotalXP(prog);
  if (totalXP < perk.cost) return { canUnlock: false, reason: `Need ${perk.cost - totalXP} more XP` };
  return { canUnlock: true };
}

/** Total available XP (current XP pool that can be spent) */
export function getTotalXP(prog: ManagerProgression): number {
  // Total accumulated XP = sum of all levels completed + current XP
  let total = prog.xp;
  for (let i = 1; i < prog.level; i++) {
    total += xpForLevel(i);
  }
  // Subtract cost of already unlocked perks
  const spent = prog.unlockedPerks.reduce((sum, id) => {
    const perk = MANAGER_PERKS.find(p => p.id === id);
    return sum + (perk?.cost || 0);
  }, 0);
  return total - spent;
}

/** Check if a specific perk is active */
export function hasPerk(prog: ManagerProgression, perkId: PerkId): boolean {
  return prog.unlockedPerks.includes(perkId);
}

/** Get XP progress toward next level */
export function getXPProgress(prog: ManagerProgression): { current: number; needed: number; percentage: number } {
  const needed = xpForLevel(prog.level);
  const percentage = needed > 0 ? Math.round((prog.xp / needed) * 100) : 100;
  return { current: prog.xp, needed, percentage: Math.min(100, percentage) };
}
