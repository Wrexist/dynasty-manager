import { SeasonHistory } from '@/types/game';

export interface PrestigeOption {
  id: 'rival' | 'drop-division' | 'restart-perks';
  label: string;
  description: string;
  icon: string;
  bonuses: string[];
}

export interface PrestigeStats {
  totalSeasons: number;
  titles: number;
  cupWins: number;
  bestPosition: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  winRate: number;
  prestigeLevel: number;
}

export const PRESTIGE_OPTIONS: PrestigeOption[] = [
  {
    id: 'rival',
    label: 'Manage a Rival',
    description: 'Take over a rival club in the same division and prove you can do it with anyone.',
    icon: 'wrench',
    bonuses: ['Keep your manager level & perks', '1.5x XP multiplier', 'Carry over career timeline'],
  },
  {
    id: 'drop-division',
    label: 'Drop a Division',
    description: 'Move down to a lower-tier club with a budget bonus. Can you climb back to the top?',
    icon: 'trending-down',
    bonuses: ['Keep your manager level & perks', '+50% starting budget', '2x XP multiplier'],
  },
  {
    id: 'restart-perks',
    label: 'Fresh Start+',
    description: 'Restart from scratch with your experience. Unlock prestige cosmetics and bonus perks.',
    icon: 'star',
    bonuses: ['Reset to Season 1', 'Prestige star badge', '2x XP multiplier', '+1 starting perk point'],
  },
];

/** Calculate prestige stats from career history */
export function calculatePrestigeStats(
  seasonHistory: SeasonHistory[],
  managerStats: { totalWins: number; totalDraws: number; totalLosses: number },
  currentPrestigeLevel: number,
): PrestigeStats {
  const totalMatches = managerStats.totalWins + managerStats.totalDraws + managerStats.totalLosses;
  return {
    totalSeasons: seasonHistory.length,
    titles: seasonHistory.filter(h => h.position === 1).length,
    cupWins: seasonHistory.filter(h => h.cupResult === 'Winner').length,
    bestPosition: seasonHistory.length > 0 ? Math.min(...seasonHistory.map(h => h.position)) : 20,
    totalWins: managerStats.totalWins,
    totalDraws: managerStats.totalDraws,
    totalLosses: managerStats.totalLosses,
    winRate: totalMatches > 0 ? Math.round((managerStats.totalWins / totalMatches) * 100) : 0,
    prestigeLevel: currentPrestigeLevel + 1,
  };
}

/** Get XP multiplier based on prestige level */
export function getPrestigeXPMultiplier(prestigeLevel: number): number {
  return 1 + prestigeLevel * 0.5; // 1x, 1.5x, 2x, 2.5x...
}
