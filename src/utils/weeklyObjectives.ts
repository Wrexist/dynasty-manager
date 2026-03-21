import { Player, Match, LeagueTableEntry } from '@/types/game';
import { shuffle } from '@/utils/helpers';

export interface WeeklyObjective {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
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
  {
    id: 'win-match',
    title: 'Get the Win',
    description: 'Win your match this week',
    icon: 'trophy',
    xpReward: 10,
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
    check: (ctx) => {
      const players = ctx.playerIds.map(id => ctx.players[id]).filter(Boolean);
      if (players.length === 0) return false;
      const avg = players.reduce((s, p) => s + p.morale, 0) / players.length;
      return avg > 70;
    },
  },
];

function getThisWeekMatch(ctx: ObjectiveContext): Match | undefined {
  return ctx.fixtures.find(
    m => m.played && m.week === ctx.week &&
      (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  );
}

/** Generate 3 random weekly objectives, biased toward match-related ones on match weeks */
export function generateWeeklyObjectives(hasMatch: boolean): ObjectiveInstance[] {
  const pool = hasMatch
    ? OBJECTIVE_TEMPLATES
    : OBJECTIVE_TEMPLATES.filter(o => !['win-match', 'clean-sheet', 'score-2-plus', 'win-by-2', 'score-3-plus', 'no-cards', 'dont-lose'].includes(o.id));

  // Pick 3 unique objectives
  const shuffled = shuffle([...pool]);
  const selected = shuffled.slice(0, Math.min(3, shuffled.length));

  return selected.map(obj => ({
    objectiveId: obj.id,
    title: obj.title,
    description: obj.description,
    icon: obj.icon,
    xpReward: obj.xpReward,
    completed: false,
  }));
}

/** Check which objectives are completed and return updated list + total XP earned */
export function evaluateObjectives(
  objectives: ObjectiveInstance[],
  ctx: ObjectiveContext,
): { updated: ObjectiveInstance[]; xpEarned: number } {
  let xpEarned = 0;
  const updated = objectives.map(inst => {
    if (inst.completed) return inst;
    const template = OBJECTIVE_TEMPLATES.find(t => t.id === inst.objectiveId);
    if (!template) return inst;
    const done = template.check(ctx);
    if (done) {
      xpEarned += inst.xpReward;
      return { ...inst, completed: true };
    }
    return inst;
  });
  return { updated, xpEarned };
}
