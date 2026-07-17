import type { GameState } from '@/store/storeTypes';
import { ACHIEVEMENT_XP_BRONZE, ACHIEVEMENT_XP_SILVER, ACHIEVEMENT_XP_GOLD } from '@/config/gameBalance';
import { LEAGUES } from '@/data/league';

type AchievementTier = 'bronze' | 'silver' | 'gold';

interface AchievementProgress {
  current: number;
  target: number;
  label?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  hidden?: boolean;
  check: (state: GameState) => boolean;
  /** Optional progress tracker for incomplete achievements */
  progress?: (state: GameState) => AchievementProgress | null;
}


/** Current unbeaten run (W/D) across the player's played league fixtures
 *  this season, newest backwards. The table builder caps `entry.form` at 5
 *  entries, so the old `form.length >= 10/20` checks could literally never
 *  pass — Fortress and Invincible Run were unobtainable. */
function currentUnbeatenRun(s: GameState): number {
  const played = s.fixtures
    .filter(m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId))
    .sort((a, b) => a.week - b.week);
  let run = 0;
  for (let i = played.length - 1; i >= 0; i--) {
    const m = played[i];
    const lost = m.homeClubId === s.playerClubId ? m.homeGoals < m.awayGoals : m.awayGoals < m.homeGoals;
    if (lost) break;
    run++;
  }
  return run;
}

/** Number of league titles won across the manager's whole recorded history. */
function leagueTitles(s: GameState): number {
  return s.seasonHistory.filter(h => h.position === 1).length;
}

/** Champions Cup wins across recorded history. */
function championsCupWins(s: GameState): number {
  return s.seasonHistory.filter(h => h.championsCupResult === 'Winner').length;
}

/** Every trophy won across recorded history (league + all cup competitions). */
function lifetimeTrophies(s: GameState): number {
  let n = 0;
  for (const h of s.seasonHistory) {
    if (h.position === 1) n++;
    if (h.cupResult === 'Winner') n++;
    if (h.leagueCupResult === 'Winner') n++;
    if (h.championsCupResult === 'Winner') n++;
    if (h.shieldCupResult === 'Winner') n++;
    if (h.conferenceCupResult === 'Winner') n++;
  }
  return n;
}

/** Seasons where league + domestic cup + Champions Cup were ALL won (a treble). */
function trebleSeasons(s: GameState): number {
  return s.seasonHistory.filter(h =>
    h.position === 1 && h.cupResult === 'Winner' && h.championsCupResult === 'Winner').length;
}

/** Longest run of consecutive league titles. seasonHistory is chronological. */
function maxConsecutiveTitles(s: GameState): number {
  let run = 0;
  let best = 0;
  for (const h of s.seasonHistory) {
    if (h.position === 1) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Wins ──
  { id: 'first-win', title: 'First Victory', description: 'Win your first match', icon: 'trophy', tier: 'bronze',
    check: (s) => { const e = s.leagueTable.find(e => e.clubId === s.playerClubId); return (e?.won || 0) >= 1; } },
  { id: 'wins-10', title: '10 Wins', description: 'Win 10 matches', icon: 'trophy', tier: 'silver',
    check: (s) => s.managerStats.totalWins >= 10,
    progress: (s) => ({ current: Math.min(s.managerStats.totalWins, 10), target: 10 }) },
  { id: 'wins-50', title: 'Half Century', description: 'Win 50 matches', icon: 'trophy', tier: 'gold',
    check: (s) => s.managerStats.totalWins >= 50,
    progress: (s) => ({ current: Math.min(s.managerStats.totalWins, 50), target: 50 }) },

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
    check: (s) => currentUnbeatenRun(s) >= 5 },
  { id: 'unbeaten-10', title: 'Fortress', description: 'Go 10 matches without a loss', icon: 'shield', tier: 'silver',
    check: (s) => currentUnbeatenRun(s) >= 10 },
  { id: 'unbeaten-20', title: 'Invincible Run', description: 'Go 20 matches without a loss', icon: 'shield', tier: 'gold', hidden: true,
    check: (s) => currentUnbeatenRun(s) >= 20 },

  // ── Goals ──
  { id: 'goal-machine-10', title: 'Sharpshooter', description: 'Have a player score 10+ goals in a season', icon: 'circle', tier: 'bronze',
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => (s.players[id]?.goals || 0) >= 10) : false;
    },
    progress: (s) => {
      const club = s.clubs[s.playerClubId];
      if (!club) return null;
      const best = Math.max(0, ...club.playerIds.map(id => s.players[id]?.goals || 0));
      return { current: Math.min(best, 10), target: 10, label: 'goals' };
    } },
  { id: 'goal-machine-20', title: 'Goal Machine', description: 'Have a player score 20+ goals in a season', icon: 'circle', tier: 'silver',
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => (s.players[id]?.goals || 0) >= 20) : false;
    },
    progress: (s) => {
      const club = s.clubs[s.playerClubId];
      if (!club) return null;
      const best = Math.max(0, ...club.playerIds.map(id => s.players[id]?.goals || 0));
      return { current: Math.min(best, 20), target: 20, label: 'goals' };
    } },
  { id: 'goal-machine-30', title: 'Golden Boot', description: 'Have a player score 30+ goals in a season', icon: 'footprints', tier: 'gold', hidden: true,
    check: (s) => {
      const club = s.clubs[s.playerClubId];
      return club ? club.playerIds.some(id => (s.players[id]?.goals || 0) >= 30) : false;
    },
    progress: (s) => {
      const club = s.clubs[s.playerClubId];
      if (!club) return null;
      const best = Math.max(0, ...club.playerIds.map(id => s.players[id]?.goals || 0));
      return { current: Math.min(best, 30), target: 30, label: 'goals' };
    } },

  // ── Transfers ──
  { id: 'big-spender', title: 'Big Spender', description: 'Spend £50M+ on transfers', icon: 'coins', tier: 'silver',
    check: (s) => s.managerStats.totalSpent >= 50_000_000,
    progress: (s) => ({ current: Math.min(Math.round(s.managerStats.totalSpent / 1_000_000), 50), target: 50, label: '£M spent' }) },
  { id: 'transfer-mogul', title: 'Transfer Mogul', description: 'Spend £200M+ on transfers', icon: 'badge-dollar', tier: 'gold',
    check: (s) => s.managerStats.totalSpent >= 200_000_000,
    progress: (s) => ({ current: Math.min(Math.round(s.managerStats.totalSpent / 1_000_000), 200), target: 200, label: '£M spent' }) },
  { id: 'shrewd-seller', title: 'Shrewd Seller', description: 'Earn £30M+ from player sales', icon: 'trending-up', tier: 'silver',
    check: (s) => s.managerStats.totalEarned >= 30_000_000,
    progress: (s) => ({ current: Math.min(Math.round(s.managerStats.totalEarned / 1_000_000), 30), target: 30, label: '£M earned' }) },

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
    },
    progress: (s) => {
      const myFixtures = s.fixtures.filter(m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId));
      const cs = myFixtures.filter(m => (m.homeClubId === s.playerClubId ? m.awayGoals : m.homeGoals) === 0).length;
      return { current: Math.min(cs, 5), target: 5, label: 'clean sheets' };
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
    },
    progress: (s) => {
      const myFixtures = s.fixtures.filter(m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId));
      const cs = myFixtures.filter(m => (m.homeClubId === s.playerClubId ? m.awayGoals : m.homeGoals) === 0).length;
      return { current: Math.min(cs, 15), target: 15, label: 'clean sheets' };
    } },

  // ── Career ──
  { id: 'dynasty-3', title: 'Dynasty Builder', description: 'Manage for 3+ seasons', icon: 'crown', tier: 'bronze',
    check: (s) => s.season >= 4 },
  { id: 'dynasty-10', title: 'Legend', description: 'Manage for 10+ seasons', icon: 'crown', tier: 'gold', hidden: true,
    check: (s) => s.season >= 11 },
  { id: 'survive-sacking', title: 'Great Escape', description: 'Finish above relegation after a poor season', icon: 'rocket', tier: 'silver',
    check: (s) => s.seasonHistory.some(h => {
      // Safe line derives from the league actually played that season —
      // the old hardcoded `<= 17` was wrong for 18- and 24-team leagues.
      const league = LEAGUES.find(l => l.id === (h.divisionId ?? s.playerDivision));
      if (!league) return false;
      const dropSpots = league.relegationSpots || league.replacedSlots || 0;
      if (dropSpots <= 0) return false; // league has no relegation zone to escape
      return h.position <= league.teamCount - dropSpots && h.boardVerdict === 'poor';
    }) },
  { id: 'promotion', title: 'Going Up!', description: 'Get promoted to a higher division', icon: 'rocket', tier: 'silver',
    check: (s) => s.seasonHistory.some(h => h.promoted) },

  // ── Cup ──
  { id: 'cup-winner', title: 'Cup Winner', description: 'Win the Dynasty Cup', icon: 'medal', tier: 'gold',
    check: (s) => s.cup?.winner === s.playerClubId },

  // ── Tournaments ──
  { id: 'league-cup-winner', title: 'Cup Collector', description: 'Win the League Cup', icon: 'medal', tier: 'bronze',
    check: (s) => s.seasonHistory.some(h => h.leagueCupResult === 'Winner') },
  { id: 'champions-cup-winner', title: 'European Champion', description: 'Win the Champions Cup', icon: 'trophy', tier: 'gold',
    check: (s) => s.seasonHistory.some(h => h.championsCupResult === 'Winner') },
  { id: 'shield-cup-winner', title: 'Shield Bearer', description: 'Win the Shield Cup', icon: 'shield', tier: 'silver',
    check: (s) => s.seasonHistory.some(h => h.shieldCupResult === 'Winner') },
  { id: 'conference-cup-winner', title: 'Conference Champion', description: 'Win the Conference Cup', icon: 'award', tier: 'silver',
    check: (s) => s.seasonHistory.some(h => h.conferenceCupResult === 'Winner') },
  { id: 'continental-debut', title: 'Continental Debut', description: 'Play in a continental competition', icon: 'globe', tier: 'bronze',
    check: (s) => !!((s.championsCup && !s.championsCup.playerEliminated) || (s.shieldCup && !s.shieldCup.playerEliminated) || (s.conferenceCup && !s.conferenceCup.playerEliminated)) },
  { id: 'continental-treble', title: 'The Treble', description: 'Win League + Domestic Cup + Champions Cup in one season', icon: 'star', tier: 'gold', hidden: true,
    check: (s) => {
      return s.seasonHistory.some(h => h.position === 1 && h.cupResult === 'Winner' && h.championsCupResult === 'Winner');
    } },

  // ── Staff ──
  { id: 'full-house', title: 'Full House', description: 'Hire staff for all 7 roles', icon: 'building', tier: 'bronze',
    check: (s) => new Set(s.staff.members.map(m => m.role)).size >= 7 },

  // ── International ──
  { id: 'national-team-appointed', title: 'International Duty', description: 'Get appointed as national team manager', icon: 'globe', tier: 'silver',
    check: (s) => !!s.nationalTeam },
  { id: 'intl-tournament-win', title: 'World Beater', description: 'Win an international tournament as manager', icon: 'trophy', tier: 'gold', hidden: true,
    check: (s) => {
      if (!s.nationalTeam) return false;
      // Knockout rounds are recorded as 'R16'|'QF'|'SF'|'F' (never 'Final'),
      // and a final won on penalties has goalsFor === goalsAgainst — both
      // made this unobtainable. `won` is stamped on knockout results.
      return s.nationalTeam.results.some(r =>
        (r.round === 'F' || r.round === 'Final') && (r.won ?? r.goalsFor > r.goalsAgainst));
    } },

  // ── Hidden ──
  { id: 'double', title: 'The Double', description: 'Win the league and cup in the same season', icon: 'trophy', tier: 'gold', hidden: true,
    check: (s) => {
      const pos = s.leagueTable.findIndex(e => e.clubId === s.playerClubId) + 1;
      return pos === 1 && s.cup?.winner === s.playerClubId;
    } },

  // ── Player Packs ──
  { id: 'pack-first-open', title: 'Pack Hunter', description: 'Open your first player pack', icon: 'package', tier: 'bronze',
    check: (s) => (s.openedPacks?.length || 0) >= 1 },
  { id: 'pack-rare-pull', title: 'Rare Find', description: 'Pull a player rated 84 or higher from a pack', icon: 'star', tier: 'silver',
    check: (s) => {
      for (const rec of (s.openedPacks || [])) if ((rec.topOvr || 0) >= 84) return true;
      return false;
    } },
  { id: 'pack-legendary-pull', title: 'Legendary Pull', description: 'Pull a player rated 90 or higher from a pack', icon: 'crown', tier: 'gold',
    check: (s) => {
      for (const rec of (s.openedPacks || [])) if ((rec.topOvr || 0) >= 90) return true;
      return false;
    } },
  { id: 'pack-collector', title: 'Pack Collector', description: 'Open 25 player packs', icon: 'package', tier: 'silver',
    check: (s) => (s.openedPacks?.length || 0) >= 25,
    progress: (s) => ({ current: Math.min(s.openedPacks?.length || 0, 25), target: 25 }) },

  // ── Endless Progression — high-ceiling, tiered lifetime chases ──
  // Career wins (managerStats.totalWins accumulates across the whole career).
  { id: 'wins-100', title: 'Centurion', description: 'Win 100 matches', icon: 'trophy', tier: 'silver',
    check: (s) => s.managerStats.totalWins >= 100,
    progress: (s) => ({ current: Math.min(s.managerStats.totalWins, 100), target: 100 }) },
  { id: 'wins-250', title: 'Double Century', description: 'Win 250 matches', icon: 'trophy', tier: 'gold',
    check: (s) => s.managerStats.totalWins >= 250,
    progress: (s) => ({ current: Math.min(s.managerStats.totalWins, 250), target: 250 }) },
  { id: 'wins-500', title: 'The 500 Club', description: 'Win 500 matches', icon: 'crown', tier: 'gold', hidden: true,
    check: (s) => s.managerStats.totalWins >= 500,
    progress: (s) => ({ current: Math.min(s.managerStats.totalWins, 500), target: 500 }) },

  // League titles across the career.
  { id: 'titles-3', title: 'Serial Winner', description: 'Win 3 league titles', icon: 'medal', tier: 'silver',
    check: (s) => leagueTitles(s) >= 3,
    progress: (s) => ({ current: Math.min(leagueTitles(s), 3), target: 3, label: 'titles' }) },
  { id: 'titles-5', title: 'Dynasty', description: 'Win 5 league titles', icon: 'medal', tier: 'gold',
    check: (s) => leagueTitles(s) >= 5,
    progress: (s) => ({ current: Math.min(leagueTitles(s), 5), target: 5, label: 'titles' }) },
  { id: 'titles-10', title: 'Decade of Dominance', description: 'Win 10 league titles', icon: 'crown', tier: 'gold', hidden: true,
    check: (s) => leagueTitles(s) >= 10,
    progress: (s) => ({ current: Math.min(leagueTitles(s), 10), target: 10, label: 'titles' }) },

  // Longevity — total seasons managed (completed season records).
  { id: 'seasons-25', title: 'Quarter Century', description: 'Manage 25 full seasons', icon: 'crown', tier: 'silver',
    check: (s) => s.seasonHistory.length >= 25,
    progress: (s) => ({ current: Math.min(s.seasonHistory.length, 25), target: 25, label: 'seasons' }) },
  { id: 'seasons-50', title: 'Lifer', description: 'Manage 50 full seasons', icon: 'crown', tier: 'gold', hidden: true,
    check: (s) => s.seasonHistory.length >= 50,
    progress: (s) => ({ current: Math.min(s.seasonHistory.length, 50), target: 50, label: 'seasons' }) },

  // Continental pedigree.
  { id: 'champions-cup-3', title: 'Kings of Europe', description: 'Win the Champions Cup 3 times', icon: 'trophy', tier: 'gold',
    check: (s) => championsCupWins(s) >= 3,
    progress: (s) => ({ current: Math.min(championsCupWins(s), 3), target: 3, label: 'wins' }) },
  { id: 'continental-collector', title: 'Continental Collector', description: 'Win the Champions, Shield, and Conference Cup at least once each', icon: 'globe', tier: 'gold', hidden: true,
    check: (s) =>
      s.seasonHistory.some(h => h.championsCupResult === 'Winner') &&
      s.seasonHistory.some(h => h.shieldCupResult === 'Winner') &&
      s.seasonHistory.some(h => h.conferenceCupResult === 'Winner') },

  // Elite single-season feats, accumulated over a career.
  { id: 'domestic-treble', title: 'Domestic Treble', description: 'Win the league, Cup, and League Cup in one season', icon: 'star', tier: 'gold', hidden: true,
    check: (s) => s.seasonHistory.some(h => h.position === 1 && h.cupResult === 'Winner' && h.leagueCupResult === 'Winner') },
  { id: 'double-treble', title: 'Double Treble', description: 'Win the continental treble in two different seasons', icon: 'star', tier: 'gold', hidden: true,
    check: (s) => trebleSeasons(s) >= 2,
    progress: (s) => ({ current: Math.min(trebleSeasons(s), 2), target: 2, label: 'trebles' }) },
  { id: 'three-peat', title: 'Three-Peat', description: 'Win the league title three seasons in a row', icon: 'medal', tier: 'gold', hidden: true,
    check: (s) => maxConsecutiveTitles(s) >= 3,
    progress: (s) => ({ current: Math.min(maxConsecutiveTitles(s), 3), target: 3, label: 'in a row' }) },

  // Lifetime trophy haul + pack devotion.
  { id: 'trophy-hoarder', title: 'Trophy Hoarder', description: 'Win 20 trophies across your career', icon: 'award', tier: 'gold',
    check: (s) => lifetimeTrophies(s) >= 20,
    progress: (s) => ({ current: Math.min(lifetimeTrophies(s), 20), target: 20, label: 'trophies' }) },
  { id: 'pack-whale', title: 'Pack Whale', description: 'Open 100 player packs', icon: 'package', tier: 'gold',
    check: (s) => (s.openedPacks?.length || 0) >= 100,
    progress: (s) => ({ current: Math.min(s.openedPacks?.length || 0, 100), target: 100 }) },
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
    case 'gold': return 'text-[hsl(var(--gold))]';
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
