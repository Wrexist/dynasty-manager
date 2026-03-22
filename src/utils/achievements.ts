import type { GameState } from '@/store/storeTypes';
import { ACHIEVEMENT_XP_BRONZE, ACHIEVEMENT_XP_SILVER, ACHIEVEMENT_XP_GOLD } from '@/config/gameBalance';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  hidden?: boolean;
  check: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Wins ──
  { id: 'first-win', title: 'First Victory', description: 'Win your first match', icon: 'trophy', tier: 'bronze',
    check: (s) => { const e = s.leagueTable.find(e => e.clubId === s.playerClubId); return (e?.won || 0) >= 1; } },
  { id: 'wins-10', title: '10 Wins', description: 'Win 10 matches', icon: 'trophy', tier: 'silver',
    check: (s) => s.managerStats.totalWins >= 10 },
  { id: 'wins-50', title: 'Half Century', description: 'Win 50 matches', icon: 'trophy', tier: 'gold',
    check: (s) => s.managerStats.totalWins >= 50 },

  // ── League ──
  { id: 'league-champion', title: 'League Champion', description: 'Win the league title', icon: 'medal', tier: 'gold',
    check: (s) => s.seasonHistory.some(h => h.position === 1) },
  { id: 'top-3', title: 'Podium Finish', description: 'Finish in the top 3', icon: 'medal', tier: 'bronze',
    check: (s) => s.seasonHistory.some(h => h.position <= 3) },
  { id: 'back-to-back', title: 'Back to Back', description: 'Win the league two seasons in a row', icon: 'medal', tier: 'gold', hidden: true,
    check: (s) => {
      const h = s.seasonHistory;
      return h.length >= 2 && h[h.length - 1]?.position === 1 && h[h.length - 2]?.position === 1;
    } },

  // ── Streaks ──
  { id: 'unbeaten-5', title: 'Unbeaten Streak', description: 'Go 5 matches without a loss', icon: 'flame', tier: 'bronze',
    check: (s) => {
      const entry = s.leagueTable.find(e => e.clubId === s.playerClubId);
      if (!entry || entry.form.length < 5) return false;
      return entry.form.slice(-5).every(r => r === 'W' || r === 'D');
    } },
  { id: 'unbeaten-10', title: 'Fortress', description: 'Go 10 matches without a loss', icon: 'shield', tier: 'silver',
    check: (s) => {
      const entry = s.leagueTable.find(e => e.clubId === s.playerClubId);
      if (!entry || entry.form.length < 10) return false;
      return entry.form.slice(-10).every(r => r === 'W' || r === 'D');
    } },
  { id: 'unbeaten-20', title: 'Invincible Run', description: 'Go 20 matches without a loss', icon: 'shield', tier: 'gold', hidden: true,
    check: (s) => {
      const entry = s.leagueTable.find(e => e.clubId === s.playerClubId);
      if (!entry || entry.form.length < 20) return false;
      return entry.form.slice(-20).every(r => r === 'W' || r === 'D');
    } },

  // ── Goals ──
  { id: 'goal-machine-10', title: 'Sharpshooter', description: 'Have a player score 10+ goals in a season', icon: 'circle', tier: 'bronze',
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => (s.players[id]?.goals || 0) >= 10) : false;
    } },
  { id: 'goal-machine-20', title: 'Goal Machine', description: 'Have a player score 20+ goals in a season', icon: 'circle', tier: 'silver',
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => (s.players[id]?.goals || 0) >= 20) : false;
    } },
  { id: 'goal-machine-30', title: 'Golden Boot', description: 'Have a player score 30+ goals in a season', icon: 'footprints', tier: 'gold', hidden: true,
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => (s.players[id]?.goals || 0) >= 30) : false;
    } },

  // ── Transfers ──
  { id: 'big-spender', title: 'Big Spender', description: 'Spend £50M+ on transfers', icon: 'coins', tier: 'silver',
    check: (s) => s.managerStats.totalSpent >= 50_000_000 },
  { id: 'transfer-mogul', title: 'Transfer Mogul', description: 'Spend £200M+ on transfers', icon: 'badge-dollar', tier: 'gold',
    check: (s) => s.managerStats.totalSpent >= 200_000_000 },
  { id: 'shrewd-seller', title: 'Shrewd Seller', description: 'Earn £30M+ from player sales', icon: 'trending-up', tier: 'silver',
    check: (s) => s.managerStats.totalEarned >= 30_000_000 },

  // ── Youth ──
  { id: 'youth-graduate', title: 'Academy Product', description: 'Give a youth player 10+ appearances', icon: 'star', tier: 'bronze',
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => {
        const p = s.players[id];
        return p && p.age <= 20 && p.appearances >= 10;
      }) : false;
    } },
  { id: 'youth-star', title: 'Youth Star', description: 'Have a youth academy player rated 75+', icon: 'star', tier: 'gold',
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => {
        const p = s.players[id];
        return p && p.age <= 21 && p.overall >= 75;
      }) : false;
    } },

  // ── Defense ──
  { id: 'clean-sheet-5', title: 'Clean Sheet King', description: 'Keep 5 clean sheets in a season', icon: 'shield-check', tier: 'bronze',
    check: (s) => {
      const myFixtures = s.fixtures.filter(m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId));
      let cs = 0;
      for (const m of myFixtures) {
        const isHome = m.homeClubId === s.playerClubId;
        if ((isHome ? m.awayGoals : m.homeGoals) === 0) cs++;
      }
      return cs >= 5;
    } },
  { id: 'clean-sheet-15', title: 'Impenetrable', description: 'Keep 15 clean sheets in a season', icon: 'shield', tier: 'gold',
    check: (s) => {
      const myFixtures = s.fixtures.filter(m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId));
      let cs = 0;
      for (const m of myFixtures) {
        const isHome = m.homeClubId === s.playerClubId;
        if ((isHome ? m.awayGoals : m.homeGoals) === 0) cs++;
      }
      return cs >= 15;
    } },

  // ── Career ──
  { id: 'dynasty-3', title: 'Dynasty Builder', description: 'Manage for 3+ seasons', icon: 'crown', tier: 'bronze',
    check: (s) => s.season >= 4 },
  { id: 'dynasty-10', title: 'Legend', description: 'Manage for 10+ seasons', icon: 'crown', tier: 'gold', hidden: true,
    check: (s) => s.season >= 11 },
  { id: 'survive-sacking', title: 'Great Escape', description: 'Finish above relegation after a poor season', icon: 'rocket', tier: 'silver',
    check: (s) => s.seasonHistory.some(h => h.position <= 17 && h.boardVerdict === 'poor') },
  { id: 'promotion', title: 'Going Up!', description: 'Get promoted to a higher division', icon: 'rocket', tier: 'silver',
    check: (s) => s.seasonHistory.some(h => h.promoted) },

  // ── Cup ──
  { id: 'cup-winner', title: 'Cup Winner', description: 'Win the Dynasty Cup', icon: 'medal', tier: 'gold',
    check: (s) => s.cup?.winner === s.playerClubId },

  // ── Staff ──
  { id: 'full-house', title: 'Full House', description: 'Hire staff for all 7 roles', icon: 'building', tier: 'bronze',
    check: (s) => new Set(s.staff.members.map(m => m.role)).size >= 7 },

  // ── Hidden ──
  { id: 'double', title: 'The Double', description: 'Win the league and cup in the same season', icon: 'trophy', tier: 'gold', hidden: true,
    check: (s) => {
      const pos = s.leagueTable.findIndex(e => e.clubId === s.playerClubId) + 1;
      return pos === 1 && s.cup?.winner === s.playerClubId;
    } },
];

export function checkAchievements(state: GameState, unlockedIds: string[]): string[] {
  const newUnlocks: string[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!unlockedIds.includes(achievement.id) && achievement.check(state)) {
      newUnlocks.push(achievement.id);
    }
  }
  return newUnlocks;
}

/** Get tier badge color */
export function getTierColor(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze': return 'text-amber-600';
    case 'silver': return 'text-gray-300';
    case 'gold': return 'text-primary';
  }
}

/** Get XP reward for an achievement tier */
export function getAchievementXP(tier: AchievementTier): number {
  switch (tier) {
    case 'bronze': return ACHIEVEMENT_XP_BRONZE;
    case 'silver': return ACHIEVEMENT_XP_SILVER;
    case 'gold': return ACHIEVEMENT_XP_GOLD;
  }
}

/** Get tier badge background color class */
export function getTierBgColor(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze': return 'bg-amber-600/20 border-amber-600/40';
    case 'silver': return 'bg-gray-300/20 border-gray-300/40';
    case 'gold': return 'bg-primary/20 border-primary/40';
  }
}
