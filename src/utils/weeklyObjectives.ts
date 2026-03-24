import { Player, Match, LeagueTableEntry, ObjectiveRarity } from '@/types/game';
import { shuffle } from '@/utils/helpers';
import {
  RARE_OBJECTIVE_CHANCE, LEGENDARY_OBJECTIVE_CHANCE,
  OBJECTIVE_STREAK_THRESHOLD, OBJECTIVE_STREAK_MULTIPLIER,
  ALL_OBJECTIVES_BONUS_XP,
  RARE_OBJECTIVE_XP_MULTIPLIER, LEGENDARY_OBJECTIVE_XP_MULTIPLIER,
} from '@/config/gameBalance';

export interface WeeklyObjective {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  rarity: ObjectiveRarity;
  check: (ctx: ObjectiveContext) => boolean;
  progress?: (ctx: ObjectiveContext) => { current: number; target: number };
}

export interface ObjectiveInstance {
  objectiveId: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  completed: boolean;
  rarity?: ObjectiveRarity;
}

export interface ObjectiveContext {
  playerClubId: string;
  players: Record<string, Player>;
  playerIds: string[];
  fixtures: Match[];
  leagueTable: LeagueTableEntry[];
  week: number;
  season: number;
  lineup: string[];
}

// ── Objective Templates ──

const OBJECTIVE_TEMPLATES: WeeklyObjective[] = [
  // Common objectives
  {
    id: 'win-match',
    title: 'Get the Win',
    description: 'Win your match this week',
    icon: 'trophy',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      return gf > ga;
    },
  },
  {
    id: 'clean-sheet',
    title: 'Shut Them Out',
    description: 'Keep a clean sheet',
    icon: 'shield-check',
    xpReward: 15,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      return isHome ? match.awayGoals === 0 : match.homeGoals === 0;
    },
  },
  {
    id: 'score-2-plus',
    title: 'Fire Power',
    description: 'Score 2 or more goals',
    icon: 'circle',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      return (isHome ? match.homeGoals : match.awayGoals) >= 2;
    },
  },
  {
    id: 'win-by-2',
    title: 'Comfortable Victory',
    description: 'Win by 2 or more goals',
    icon: 'dumbbell',
    xpReward: 15,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      return gf - ga >= 2;
    },
  },
  {
    id: 'youth-start',
    title: 'Trust the Youth',
    description: 'Start a player aged 21 or under',
    icon: 'sprout',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      return ctx.lineup.some(id => {
        const p = ctx.players[id];
        return p && p.age <= 21;
      });
    },
  },
  {
    id: 'score-3-plus',
    title: 'Goal Fest',
    description: 'Score 3 or more goals',
    icon: 'flame',
    xpReward: 20,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      return (isHome ? match.homeGoals : match.awayGoals) >= 3;
    },
  },
  {
    id: 'no-cards',
    title: 'Fair Play',
    description: 'Finish the match with no cards',
    icon: 'handshake',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match || !match.events) return false;
      return !match.events.some(
        e => (e.type === 'yellow_card' || e.type === 'red_card') && e.clubId === ctx.playerClubId
      );
    },
  },
  {
    id: 'dont-lose',
    title: 'Stay Unbeaten',
    description: 'Avoid defeat this week',
    icon: 'shield',
    xpReward: 8,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      return gf >= ga;
    },
  },
  {
    id: 'full-fitness',
    title: 'Fit Squad',
    description: 'Have no injured players in your squad',
    icon: 'heart-pulse',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      return ctx.playerIds.every(id => {
        const p = ctx.players[id];
        return !p || !p.injured;
      });
    },
  },
  {
    id: 'high-morale',
    title: 'Happy Camp',
    description: 'Keep average squad morale above 70',
    icon: 'star',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      const players = ctx.playerIds.map(id => ctx.players[id]).filter(Boolean);
      if (players.length === 0) return false;
      const avg = players.reduce((s, p) => s + p.morale, 0) / players.length;
      return avg > 70;
    },
  },

  // ── Rare objectives (harder, 2x XP) ──
  {
    id: 'comeback-win',
    title: 'Never Say Die',
    description: 'Win after conceding the first goal',
    icon: 'rotate-ccw',
    xpReward: 30,
    rarity: 'rare',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match || !match.events) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      if (gf <= ga) return false;
      // Check if opponent scored first
      const firstGoal = match.events.find(e => e.type === 'goal' || e.type === 'penalty_scored');
      return !!firstGoal && firstGoal.clubId !== ctx.playerClubId;
    },
  },
  {
    id: 'late-drama',
    title: 'Last Gasp',
    description: 'Score a goal after the 85th minute',
    icon: 'clock',
    xpReward: 25,
    rarity: 'rare',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match || !match.events) return false;
      return match.events.some(
        e => (e.type === 'goal' || e.type === 'penalty_scored') &&
          e.clubId === ctx.playerClubId && e.minute >= 85
      );
    },
  },
  {
    id: 'away-clean-sheet',
    title: 'Fortress Away',
    description: 'Keep a clean sheet in an away match',
    icon: 'plane',
    xpReward: 25,
    rarity: 'rare',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isAway = match.awayClubId === ctx.playerClubId;
      if (!isAway) return false;
      return match.homeGoals === 0;
    },
  },
  {
    id: 'youth-scorer',
    title: 'Academy Star',
    description: 'Have a player aged 21 or under score a goal',
    icon: 'sparkles',
    xpReward: 25,
    rarity: 'rare',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match || !match.events) return false;
      return match.events.some(e => {
        if (e.type !== 'goal' || e.clubId !== ctx.playerClubId || !e.playerId) return false;
        const p = ctx.players[e.playerId];
        return p && p.age <= 21;
      });
    },
  },
  {
    id: 'high-possession',
    title: 'Total Control',
    description: 'Win the match with 60%+ possession',
    icon: 'bar-chart',
    xpReward: 25,
    rarity: 'rare',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match || !match.stats) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      if (gf <= ga) return false;
      const poss = isHome ? match.stats.homePossession : match.stats.awayPossession;
      return poss >= 60;
    },
  },

  // ── Legendary objectives (very hard, 5x XP) ──
  {
    id: 'win-by-5',
    title: 'Destruction',
    description: 'Win by 5 or more goals',
    icon: 'zap',
    xpReward: 50,
    rarity: 'legendary',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      return gf - ga >= 5;
    },
  },
];

const MATCH_OBJECTIVE_IDS = [
  'win-match', 'clean-sheet', 'score-2-plus', 'win-by-2', 'score-3-plus',
  'no-cards', 'dont-lose', 'comeback-win', 'late-drama', 'away-clean-sheet',
  'youth-scorer', 'high-possession', 'win-by-5',
];

function getThisWeekMatch(ctx: ObjectiveContext): Match | undefined {
  return ctx.fixtures.find(
    m => m.played && m.week === ctx.week &&
      (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  );
}

/** Generate 3 random weekly objectives, with variable rarity */
export function generateWeeklyObjectives(hasMatch: boolean): ObjectiveInstance[] {
  const pool = hasMatch
    ? OBJECTIVE_TEMPLATES
    : OBJECTIVE_TEMPLATES.filter(o => !MATCH_OBJECTIVE_IDS.includes(o.id));

  const commonPool = pool.filter(o => o.rarity === 'common');
  const rarePool = pool.filter(o => o.rarity === 'rare');
  const legendaryPool = pool.filter(o => o.rarity === 'legendary');

  const selected: WeeklyObjective[] = [];

  // Roll for legendary slot (replaces first pick)
  if (legendaryPool.length > 0 && Math.random() < LEGENDARY_OBJECTIVE_CHANCE) {
    selected.push(shuffle([...legendaryPool])[0]);
  }
  // Roll for rare slot (replaces second pick)
  else if (rarePool.length > 0 && Math.random() < RARE_OBJECTIVE_CHANCE) {
    selected.push(shuffle([...rarePool])[0]);
  }

  // Fill remaining slots with common objectives
  const remaining = 3 - selected.length;
  const availableCommon = shuffle([...commonPool]).filter(o => !selected.some(s => s.id === o.id));
  selected.push(...availableCommon.slice(0, remaining));

  // Fallback: if still under 3 (e.g., non-match week with very few options), pull from full pool
  if (selected.length < 3) {
    const allFallback = shuffle([...OBJECTIVE_TEMPLATES])
      .filter(o => !selected.some(s => s.id === o.id));
    selected.push(...allFallback.slice(0, 3 - selected.length));
  }

  return selected.map(obj => ({
    objectiveId: obj.id,
    title: obj.title,
    description: obj.description,
    icon: obj.icon,
    xpReward: obj.xpReward,
    completed: false,
    rarity: obj.rarity,
  }));
}

/** Check which objectives are completed and return updated list + total XP earned.
 *  streakCount is the current consecutive-weeks-all-completed streak. */
export function evaluateObjectives(
  objectives: ObjectiveInstance[],
  ctx: ObjectiveContext,
  streakCount: number = 0,
): { updated: ObjectiveInstance[]; xpEarned: number; allCompleted: boolean; newStreak: number } {
  let xpEarned = 0;
  const updated = objectives.map(inst => {
    if (inst.completed) return inst;
    const template = OBJECTIVE_TEMPLATES.find(t => t.id === inst.objectiveId);
    if (!template) return inst;
    const done = template.check(ctx);
    if (done) {
      const rarityMult = inst.rarity === 'legendary' ? LEGENDARY_OBJECTIVE_XP_MULTIPLIER
        : inst.rarity === 'rare' ? RARE_OBJECTIVE_XP_MULTIPLIER : 1;
      xpEarned += inst.xpReward * rarityMult;
      return { ...inst, completed: true };
    }
    return inst;
  });

  const allCompleted = updated.every(o => o.completed);

  // Bonus for completing all objectives
  if (allCompleted && updated.length > 0) {
    xpEarned += ALL_OBJECTIVES_BONUS_XP;
  }

  // Streak multiplier
  const newStreak = allCompleted ? streakCount + 1 : 0;
  if (newStreak >= OBJECTIVE_STREAK_THRESHOLD) {
    xpEarned = Math.round(xpEarned * OBJECTIVE_STREAK_MULTIPLIER);
  }

  return { updated, xpEarned, allCompleted, newStreak };
}
