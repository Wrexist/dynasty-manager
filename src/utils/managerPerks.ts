import { ManagerPerk, PerkId, ManagerProgression, TalentBranch } from '@/types/game';
import { getPrestigeXPMultiplier } from '@/utils/prestige';
import { MANAGER_XP_BASE, MANAGER_XP_PER_LEVEL, CAPSTONE_MIN_BRANCHES, PRESTIGE_PERK_TIER_6_COST, PRESTIGE_PERK_TIER_7_COST, MASTERY_MAX_RANKS, MASTERY_BASE_COST, MASTERY_COST_GROWTH, MASTERY_BONUS_PER_RANK } from '@/config/gameBalance';

export const MANAGER_PERKS: ManagerPerk[] = [
  // ── Tactician Branch (match day & formations) ──
  { id: 'set_piece_coach', name: 'Set Piece Coach', description: 'Set piece goals +15% more likely', icon: 'target', cost: 80, tier: 1, branch: 'tactician', row: 0 },
  { id: 'tactical_genius', name: 'Tactical Genius', description: 'Tactical familiarity increases 30% faster', icon: 'brain', cost: 200, tier: 2, prerequisite: 'set_piece_coach', branch: 'tactician', row: 1 },
  { id: 'disciplinarian', name: 'Disciplinarian', description: 'Players get 30% fewer yellow/red cards', icon: 'clipboard', cost: 400, tier: 3, prerequisite: 'tactical_genius', branch: 'tactician', row: 2 },
  { id: 'formation_master', name: 'Formation Master', description: 'Unlock 3 additional formation variations', icon: 'layout-grid', cost: 600, tier: 4, prerequisite: 'disciplinarian', branch: 'tactician', row: 3 },
  { id: 'iron_will', name: 'Iron Will', description: 'No morale penalty from defeats', icon: 'shield', cost: 800, tier: 5, prerequisite: 'formation_master', branch: 'tactician', row: 4 },

  // ── Motivator Branch (morale & media) ──
  { id: 'motivator', name: 'Motivator', description: 'Pre-match team talks give +5 morale boost', icon: 'megaphone', cost: 80, tier: 1, branch: 'motivator', row: 0 },
  { id: 'media_savvy', name: 'Media Savvy', description: 'Press conference effects doubled', icon: 'mic', cost: 200, tier: 2, prerequisite: 'motivator', branch: 'motivator', row: 1 },
  { id: 'fan_favourite', name: 'Fan Favourite', description: 'Stadium income +15% from fan mood bonus', icon: 'building', cost: 400, tier: 3, prerequisite: 'media_savvy', branch: 'motivator', row: 2 },
  { id: 'fortress_mentality', name: 'Fortress Mentality', description: 'Home wins give +3 squad morale bonus', icon: 'castle', cost: 600, tier: 4, prerequisite: 'fan_favourite', branch: 'motivator', row: 3 },
  { id: 'invincible', name: 'The Invincible', description: '1 free match rewind per season — undo a loss', icon: 'rotate-ccw', cost: 800, tier: 5, prerequisite: 'fortress_mentality', branch: 'motivator', row: 4 },

  // ── Dealmaker Branch (transfers & finances) ──
  { id: 'scout_network', name: 'Scout Network', description: 'Scouting assignments complete 1 week faster', icon: 'search', cost: 80, tier: 1, branch: 'dealmaker', row: 0 },
  { id: 'loan_master', name: 'Loan Master', description: 'Loaned-out players develop 30% faster', icon: 'repeat', cost: 200, tier: 2, prerequisite: 'scout_network', branch: 'dealmaker', row: 1 },
  { id: 'deadline_dealer', name: 'Deadline Dealer', description: 'Transfer fees -20% during deadline week', icon: 'clock', cost: 400, tier: 3, prerequisite: 'loan_master', branch: 'dealmaker', row: 2 },
  { id: 'transfer_shark', name: 'Transfer Shark', description: 'Transfer fees are 15% lower when buying', icon: 'badge-dollar', cost: 600, tier: 4, prerequisite: 'deadline_dealer', branch: 'dealmaker', row: 3 },
  { id: 'galactico', name: 'Galactico', description: 'Can sign 1 player above budget per season (20% over)', icon: 'star', cost: 800, tier: 5, prerequisite: 'transfer_shark', branch: 'dealmaker', row: 4 },

  // ── Developer Branch (youth & training) ──
  { id: 'fitness_guru', name: 'Fitness Guru', description: 'Reduce injury risk by 20% during training', icon: 'dumbbell', cost: 80, tier: 1, branch: 'developer', row: 0 },
  { id: 'youth_developer', name: 'Youth Developer', description: 'Youth academy prospects develop 25% faster', icon: 'sprout', cost: 200, tier: 2, prerequisite: 'fitness_guru', branch: 'developer', row: 1 },
  { id: 'training_ground', name: 'Training Ground', description: 'Training effectiveness +20% for all players', icon: 'dumbbell', cost: 400, tier: 3, prerequisite: 'youth_developer', branch: 'developer', row: 2 },
  { id: 'wonder_coach', name: 'Wonder Coach', description: 'Youth prospect potential +5 on intake', icon: 'sparkles', cost: 600, tier: 4, prerequisite: 'training_ground', branch: 'developer', row: 3 },
  { id: 'golden_generation', name: 'Golden Generation', description: '1 guaranteed high-potential youth per season', icon: 'gem', cost: 800, tier: 5, prerequisite: 'wonder_coach', branch: 'developer', row: 4 },

  // ── Capstone (requires 2+ branches at row 3+) ──
  { id: 'dynasty_builder', name: 'Dynasty Builder', description: 'All perk effects boosted by 10%', icon: 'crown', cost: 1200, tier: 5, branch: 'capstone', row: 5 },

  // ── Prestige-Exclusive Perks (Tier 6: Prestige 1+, Tier 7: Prestige 2+) ──
  { id: 'counter_master', name: 'Counter-Master', description: 'AI tactical advantage reduced by 25%', icon: 'shield-off', cost: PRESTIGE_PERK_TIER_6_COST, tier: 6, prerequisite: 'iron_will', branch: 'tactician', row: 5, prestigeRequired: 1 },
  { id: 'puppet_master', name: 'Puppet Master', description: 'Key moments trigger 50% more frequently', icon: 'sliders-horizontal', cost: PRESTIGE_PERK_TIER_7_COST, tier: 7, prerequisite: 'counter_master', branch: 'tactician', row: 6, prestigeRequired: 2 },

  { id: 'cult_hero', name: 'Cult Hero', description: 'Fan mood never drops below 40', icon: 'heart', cost: PRESTIGE_PERK_TIER_6_COST, tier: 6, prerequisite: 'invincible', branch: 'motivator', row: 5, prestigeRequired: 1 },
  { id: 'icon_status', name: 'Icon Status', description: 'Contract negotiations start at +20% acceptance', icon: 'badge', cost: PRESTIGE_PERK_TIER_7_COST, tier: 7, prerequisite: 'cult_hero', branch: 'motivator', row: 6, prestigeRequired: 2 },

  { id: 'war_chest', name: 'War Chest', description: 'Starting budget +15% each season', icon: 'vault', cost: PRESTIGE_PERK_TIER_6_COST, tier: 6, prerequisite: 'galactico', branch: 'dealmaker', row: 5, prestigeRequired: 1 },
  { id: 'kingmaker', name: 'Kingmaker', description: 'Sell players for 20% above market value', icon: 'trending-up', cost: PRESTIGE_PERK_TIER_7_COST, tier: 7, prerequisite: 'war_chest', branch: 'dealmaker', row: 6, prestigeRequired: 2 },

  { id: 'prodigy_factory', name: 'Prodigy Factory', description: 'Youth intake produces 2 extra prospects', icon: 'users', cost: PRESTIGE_PERK_TIER_6_COST, tier: 6, prerequisite: 'golden_generation', branch: 'developer', row: 5, prestigeRequired: 1 },
  { id: 'dna_coach', name: 'DNA Coach', description: 'Training gains +10% for under-24 players', icon: 'dna', cost: PRESTIGE_PERK_TIER_7_COST, tier: 7, prerequisite: 'prodigy_factory', branch: 'developer', row: 6, prestigeRequired: 2 },
];

/** Branch display metadata */
export const TALENT_BRANCHES: { id: TalentBranch; name: string; icon: string; color: string }[] = [
  { id: 'tactician', name: 'Tactician', icon: 'swords', color: 'text-blue-400' },
  { id: 'motivator', name: 'Motivator', icon: 'megaphone', color: 'text-amber-400' },
  { id: 'dealmaker', name: 'Dealmaker', icon: 'handshake', color: 'text-emerald-400' },
  { id: 'developer', name: 'Developer', icon: 'sprout', color: 'text-teal-400' },
];

/** Get perks for a specific branch, sorted by row */
export function getBranchPerks(branch: TalentBranch): ManagerPerk[] {
  return MANAGER_PERKS.filter(p => p.branch === branch).sort((a, b) => a.row - b.row);
}

/** Get the capstone perk */
export function getCapstonePerk(): ManagerPerk {
  return MANAGER_PERKS.find(p => p.branch === 'capstone')!;
}

/** Count how many branches have a perk unlocked at row 3 or higher */
export function countHighBranches(prog: ManagerProgression): number {
  const branches: TalentBranch[] = ['tactician', 'motivator', 'dealmaker', 'developer'];
  return branches.filter(branch => {
    const branchPerks = MANAGER_PERKS.filter(p => p.branch === branch && p.row >= 3);
    return branchPerks.some(p => prog.unlockedPerks.includes(p.id));
  }).length;
}

/** Get the dominant branch for specialization title */
export function getSpecializationTitle(prog: ManagerProgression): string {
  const branches: TalentBranch[] = ['tactician', 'motivator', 'dealmaker', 'developer'];
  const counts = branches.map(branch => ({
    branch,
    count: MANAGER_PERKS.filter(p => p.branch === branch && prog.unlockedPerks.includes(p.id)).length,
  }));
  const maxCount = counts.reduce((m, c) => c.count > m ? c.count : m, 0);
  if (maxCount === 0) return '';
  const topBranches = counts.filter(c => c.count === maxCount);
  if (topBranches.length > 1) return 'The All-Rounder';
  const titleMap: Record<TalentBranch, string> = {
    tactician: 'The Tactician',
    motivator: 'The Motivator',
    dealmaker: 'The Dealmaker',
    developer: 'The Developer',
  };
  return titleMap[topBranches[0].branch];
}

export function createDefaultProgression(): ManagerProgression {
  return { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0, masteryRanks: {} };
}

/** XP needed for next level */
export function xpForLevel(level: number): number {
  return MANAGER_XP_BASE + level * MANAGER_XP_PER_LEVEL;
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
  championsCupWin: 500,
  shieldCupWin: 300,
  conferenceCupWin: 200,
  leagueCupWin: 150,
  continentalGroupAdvance: 100,
  /** Pack pull granted XP: 84-89 OVR walkout-tier pull. */
  packRarePull: 25,
  /** Pack pull granted XP: 90+ OVR legendary-tier pull. */
  packLegendaryPull: 75,
} as const;

/** Check if a perk can be unlocked */
export function canUnlockPerk(perk: ManagerPerk, prog: ManagerProgression): { canUnlock: boolean; reason?: string } {
  if (prog.unlockedPerks.includes(perk.id)) return { canUnlock: false, reason: 'Already unlocked' };
  // Prestige requirement check
  if (perk.prestigeRequired && (prog.prestigeLevel || 0) < perk.prestigeRequired) {
    return { canUnlock: false, reason: `Requires Prestige ${perk.prestigeRequired}` };
  }
  // Capstone requires 2+ branches at row 3+
  if (perk.branch === 'capstone') {
    const highBranches = countHighBranches(prog);
    if (highBranches < CAPSTONE_MIN_BRANCHES) {
      return { canUnlock: false, reason: `Need ${CAPSTONE_MIN_BRANCHES} branches at tier 4+` };
    }
  }
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
  // Subtract cost of every mastery rank bought across all branches. Ranks are
  // cumulative (rank 3 means ranks 1+2+3 were all paid for).
  let masterySpent = 0;
  const ranks = prog.masteryRanks;
  if (ranks) {
    for (const branch of Object.keys(ranks) as TalentBranch[]) {
      const r = ranks[branch] || 0;
      for (let i = 1; i <= r; i++) masterySpent += masteryRankCost(i);
    }
  }
  return total - spent - masterySpent;
}

/** Check if a specific perk is active */
export function hasPerk(prog: ManagerProgression, perkId: PerkId): boolean {
  return prog.unlockedPerks.includes(perkId);
}

/** Get the dynasty builder multiplier (1.1x if Dynasty Builder perk is active, 1.0x otherwise) */
export function dynastyMult(prog: ManagerProgression): number {
  return prog.unlockedPerks.includes('dynasty_builder') ? 1.1 : 1;
}

// ── Mastery Ranks (endless per-branch progression) ──

/** Current mastery rank for a branch (0 when none / field missing). */
export function getMasteryRank(prog: ManagerProgression, branch: TalentBranch): number {
  return prog.masteryRanks?.[branch] ?? 0;
}

/** Multiplicative bonus a branch's mastery ranks apply to its scaled perk
 *  effects: 1 + MASTERY_BONUS_PER_RANK per rank (1.0x when unranked). */
export function masteryMult(prog: ManagerProgression, branch: TalentBranch): number {
  return 1 + MASTERY_BONUS_PER_RANK * getMasteryRank(prog, branch);
}

/** Combined multiplier for a branch's scalable perk effects: the global
 *  Dynasty Builder capstone bonus times this branch's mastery bonus. Drop-in
 *  replacement for `dynastyMult` at any branch-specific application site. */
export function branchMult(prog: ManagerProgression, branch: TalentBranch): number {
  return dynastyMult(prog) * masteryMult(prog, branch);
}

/** The 5 core (non-prestige) perks of a branch — rows 0–4. */
export function getCoreBranchPerks(branch: TalentBranch): ManagerPerk[] {
  return MANAGER_PERKS.filter(p => p.branch === branch && p.row <= 4).sort((a, b) => a.row - b.row);
}

/** A branch is "mastered-eligible" once all 5 of its core perks are unlocked. */
export function branchFullyUnlocked(prog: ManagerProgression, branch: TalentBranch): boolean {
  return getCoreBranchPerks(branch).every(p => prog.unlockedPerks.includes(p.id));
}

/** XP cost to buy the given mastery rank (1-indexed: rank 1 is the first).
 *  Geometric escalation from MASTERY_BASE_COST by MASTERY_COST_GROWTH. */
export function masteryRankCost(rank: number): number {
  return Math.round(MASTERY_BASE_COST * Math.pow(MASTERY_COST_GROWTH, rank - 1));
}

/** Cost to buy the NEXT mastery rank for a branch, or null if capped. */
export function nextMasteryCost(prog: ManagerProgression, branch: TalentBranch): number | null {
  const rank = getMasteryRank(prog, branch);
  if (rank >= MASTERY_MAX_RANKS) return null;
  return masteryRankCost(rank + 1);
}

/** Can the manager buy the next mastery rank for a branch right now? */
export function canUnlockMastery(prog: ManagerProgression, branch: TalentBranch): { canUnlock: boolean; reason?: string; cost?: number } {
  if (!branchFullyUnlocked(prog, branch)) {
    return { canUnlock: false, reason: 'Unlock all 5 branch perks first' };
  }
  const rank = getMasteryRank(prog, branch);
  if (rank >= MASTERY_MAX_RANKS) {
    return { canUnlock: false, reason: 'Mastery maxed' };
  }
  const cost = masteryRankCost(rank + 1);
  const available = getTotalXP(prog);
  if (available < cost) {
    return { canUnlock: false, reason: `Need ${cost - available} more XP`, cost };
  }
  return { canUnlock: true, cost };
}

/** Get the full prerequisite chain for a perk (bottom to top, excluding the perk itself) */
export function getPrerequisiteChain(perk: ManagerPerk): ManagerPerk[] {
  const chain: ManagerPerk[] = [];
  let current = perk;
  while (current.prerequisite) {
    const prereq = MANAGER_PERKS.find(p => p.id === current.prerequisite);
    if (!prereq) break;
    chain.unshift(prereq);
    current = prereq;
  }
  return chain;
}

/** Get the perk that requires this perk as a prerequisite (the "next" perk in the branch) */
export function getNextPerk(perk: ManagerPerk): ManagerPerk | undefined {
  return MANAGER_PERKS.find(p => p.prerequisite === perk.id);
}

/** Check if a branch has reached row 3+ (needed for capstone tracking) */
export function branchHasHighTier(branch: TalentBranch, prog: ManagerProgression): boolean {
  const branchPerks = MANAGER_PERKS.filter(p => p.branch === branch && p.row >= 3);
  return branchPerks.some(p => prog.unlockedPerks.includes(p.id));
}

/** Get XP progress toward next level */
export function getXPProgress(prog: ManagerProgression): { current: number; needed: number; percentage: number } {
  const needed = xpForLevel(prog.level);
  const percentage = needed > 0 ? Math.round((prog.xp / needed) * 100) : 100;
  return { current: prog.xp, needed, percentage: Math.min(100, percentage) };
}
