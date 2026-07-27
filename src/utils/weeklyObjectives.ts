import { Player, Match, LeagueTableEntry, ObjectiveRarity, ContinentalTournamentState, CupTie, SuperCupMatch } from '@/types/game';
import { shuffle } from '@/utils/helpers';
import {
  RARE_OBJECTIVE_CHANCE, LEGENDARY_OBJECTIVE_CHANCE,
  OBJECTIVE_STREAK_THRESHOLD, OBJECTIVE_STREAK_MULTIPLIER,
  ALL_OBJECTIVES_BONUS_XP,
  RARE_OBJECTIVE_XP_MULTIPLIER, LEGENDARY_OBJECTIVE_XP_MULTIPLIER,
} from '@/config/gameBalance';
import { GOAL_SCORING_TYPES, GOAL_SHOT_TYPES } from '@/config/matchEngine';

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
  /** True once the player has tapped "Claim" to collect the XP. Base XP is
   *  granted on claim (not on completion), so completing an objective leaves
   *  it `completed: true, claimed: false` until the reward is collected. */
  claimed?: boolean;
  rarity?: ObjectiveRarity;
  progress?: { current: number; target: number };
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
  // Optional additional match sources. When provided, `getThisWeekMatch`
  // searches them too — without them, only league fixtures count, which
  // means pre-season friendlies, cup ties, league cup ties, and
  // continental matches were silently invisible to every match-based
  // objective. Audit finding: user scored 5 goals in a pre-season
  // friendly and "Goal Fest 0/3" never moved.
  friendlies?: Match[];
  cupTies?: CupTie[];
  leagueCupTies?: CupTie[];
  championsCup?: ContinentalTournamentState | null;
  shieldCup?: ContinentalTournamentState | null;
  conferenceCup?: ContinentalTournamentState | null;
  domesticSuperCup?: SuperCupMatch | null;
  continentalSuperCup?: SuperCupMatch | null;
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
    progress: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return { current: 0, target: 2 };
      const isHome = match.homeClubId === ctx.playerClubId;
      return { current: isHome ? match.homeGoals : match.awayGoals, target: 2 };
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
    progress: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return { current: 0, target: 2 };
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      return { current: Math.max(0, gf - ga), target: 2 };
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
      const match = getThisWeekMatch(ctx);
      if (!match) return false;
      return ctx.lineup.some(id => {
        const p = ctx.players[id];
        return p && p.age <= 21;
      });
    },
    progress: (ctx) => {
      if (!getThisWeekMatch(ctx)) return { current: 0, target: 1 };
      const youthInLineup = ctx.lineup.filter(id => {
        const p = ctx.players[id];
        return p && p.age <= 21;
      }).length;
      return { current: Math.min(youthInLineup, 1), target: 1 };
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
    progress: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return { current: 0, target: 3 };
      const isHome = match.homeClubId === ctx.playerClubId;
      return { current: isHome ? match.homeGoals : match.awayGoals, target: 3 };
    },
  },
  {
    id: 'no-cards',
    title: 'Fair Play',
    // Retuned for the corrected card rate. Cards per match rose ~2.4x when the
    // foul band was widened to reach real-football volume (yellows ~3.67/match,
    // was 1.47), which dropped "no cards at all" from roughly 48% achievable to
    // ~16% — a 'common' objective the player fails five times in six. One booking
    // is now tolerated; a red never is.
    description: 'Finish the match with no red card and at most one booking',
    icon: 'handshake',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      const match = getThisWeekMatch(ctx);
      // Require a non-empty events source: synthetic cup/continental
      // matches are rebuilt with `events: []`, and an empty array would
      // auto-complete this objective for free (empty .some() → false).
      if (!match || !match.events || match.events.length === 0) return false;
      const mine = match.events.filter(e => e.clubId === ctx.playerClubId);
      if (mine.some(e => e.type === 'red_card')) return false;
      return mine.filter(e => e.type === 'yellow_card').length <= 1;
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
    progress: (ctx) => {
      const players = ctx.playerIds.map(id => ctx.players[id]).filter(Boolean);
      const healthy = players.filter(p => !p.injured).length;
      return { current: healthy, target: players.length };
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
    progress: (ctx) => {
      const players = ctx.playerIds.map(id => ctx.players[id]).filter(Boolean);
      if (players.length === 0) return { current: 0, target: 70 };
      const avg = Math.round(players.reduce((s, p) => s + p.morale, 0) / players.length);
      return { current: avg, target: 70 };
    },
  },

  // ── Non-match passive objectives ──
  {
    id: 'top-half-table',
    title: 'Top Half',
    description: 'Be in the top half of the league table',
    icon: 'trending-up',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      const pos = ctx.leagueTable.findIndex(e => e.clubId === ctx.playerClubId) + 1;
      return pos > 0 && pos <= Math.ceil(ctx.leagueTable.length / 2);
    },
    progress: (ctx) => {
      const pos = ctx.leagueTable.findIndex(e => e.clubId === ctx.playerClubId) + 1;
      const half = Math.ceil(ctx.leagueTable.length / 2);
      return { current: Math.max(0, half - pos + 1), target: 1 };
    },
  },
  {
    id: 'youth-in-squad',
    title: 'Academy Focus',
    description: 'Have 4 or more players aged 21 or under in your squad',
    icon: 'users',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      return ctx.playerIds.filter(id => ctx.players[id]?.age <= 21).length >= 4;
    },
    progress: (ctx) => {
      const count = ctx.playerIds.filter(id => ctx.players[id]?.age <= 21).length;
      return { current: Math.min(count, 4), target: 4 };
    },
  },
  {
    id: 'veteran-presence',
    title: 'Experience Counts',
    description: 'Have 3 or more players aged 29 or over in your squad',
    icon: 'crown',
    xpReward: 8,
    rarity: 'common',
    check: (ctx) => {
      return ctx.playerIds.filter(id => ctx.players[id]?.age >= 29).length >= 3;
    },
    progress: (ctx) => {
      const count = ctx.playerIds.filter(id => ctx.players[id]?.age >= 29).length;
      return { current: Math.min(count, 3), target: 3 };
    },
  },
  {
    id: 'deep-bench',
    title: 'No Weaknesses',
    description: 'Have 18 or more fit players available',
    icon: 'shield-check',
    xpReward: 10,
    rarity: 'common',
    check: (ctx) => {
      return ctx.playerIds.filter(id => !ctx.players[id]?.injured).length >= 18;
    },
    progress: (ctx) => {
      const count = ctx.playerIds.filter(id => !ctx.players[id]?.injured).length;
      return { current: Math.min(count, 18), target: 18 };
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
      const firstGoal = match.events.find(e => (GOAL_SCORING_TYPES as readonly string[]).includes(e.type));
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
        e => (GOAL_SCORING_TYPES as readonly string[]).includes(e.type) &&
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
      // GOAL_SHOT_TYPES covers penalties/headers/free kicks etc. but excludes
      // own goals — an own-goal event carries the OPPONENT defender's
      // playerId, which would wrongly satisfy the objective.
      return match.events.some(e => {
        if (!(GOAL_SHOT_TYPES as readonly string[]).includes(e.type) || e.clubId !== ctx.playerClubId || !e.playerId) return false;
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
    progress: (ctx) => {
      const match = getThisWeekMatch(ctx);
      if (!match) return { current: 0, target: 5 };
      const isHome = match.homeClubId === ctx.playerClubId;
      const gf = isHome ? match.homeGoals : match.awayGoals;
      const ga = isHome ? match.awayGoals : match.homeGoals;
      return { current: Math.max(0, gf - ga), target: 5 };
    },
  },
];

/** Count of unique weekly objective templates (for tests / content audits). */
export const WEEKLY_OBJECTIVE_TEMPLATE_COUNT = OBJECTIVE_TEMPLATES.length;

const MATCH_OBJECTIVE_IDS = [
  'win-match', 'clean-sheet', 'score-2-plus', 'win-by-2', 'score-3-plus',
  'no-cards', 'dont-lose', 'comeback-win', 'late-drama', 'away-clean-sheet',
  'youth-scorer', 'high-possession', 'win-by-5', 'youth-start',
];

function getThisWeekMatch(ctx: ObjectiveContext): Match | undefined {
  // Search every match source the user could have played this week, not
  // just league fixtures. Without this, pre-season friendlies, cup ties,
  // continental matches, and super cups never moved match-based
  // objectives (e.g. the "Goal Fest 0/3" bug where the user scored 5 in
  // a pre-season friendly and progress never updated). Priority mirrors
  // the user-facing match priority chain in matchActions.ts so a week
  // with multiple matches reports the one the user actually played.
  const inPlayerWeek = (m: { week: number; played?: boolean; homeClubId: string; awayClubId: string }) =>
    m.played === true && m.week === ctx.week
    && (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId);

  // Continental tournaments — rebuild a Match-shaped object from the
  // group/knockout structures the objectives can read uniformly.
  const continentalMatch = (() => {
    const tourneys = [ctx.championsCup, ctx.shieldCup, ctx.conferenceCup];
    for (const t of tourneys) {
      if (!t) continue;
      for (const g of t.groups || []) {
        const m = g.matches.find(inPlayerWeek);
        if (m) {
          return { id: m.id, week: m.week, homeClubId: m.homeClubId, awayClubId: m.awayClubId, played: true, homeGoals: m.homeGoals ?? 0, awayGoals: m.awayGoals ?? 0, events: [] } as Match;
        }
      }
      for (const tie of t.knockoutTies || []) {
        if (tie.homeClubId !== ctx.playerClubId && tie.awayClubId !== ctx.playerClubId) continue;
        if (tie.week1 === ctx.week && tie.leg1Played) {
          return { id: `${tie.id}-l1`, week: tie.week1, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, played: true, homeGoals: tie.leg1HomeGoals ?? 0, awayGoals: tie.leg1AwayGoals ?? 0, events: [] } as Match;
        }
        if (tie.week2 === ctx.week && tie.leg2Played && tie.round !== 'F') {
          return { id: `${tie.id}-l2`, week: tie.week2, homeClubId: tie.awayClubId, awayClubId: tie.homeClubId, played: true, homeGoals: tie.leg2HomeGoals ?? 0, awayGoals: tie.leg2AwayGoals ?? 0, events: [] } as Match;
        }
      }
    }
    return undefined;
  })();
  if (continentalMatch) return continentalMatch;

  const cupTie = ctx.cupTies?.find(inPlayerWeek);
  if (cupTie) {
    return { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: true, homeGoals: cupTie.homeGoals, awayGoals: cupTie.awayGoals, events: [] } as Match;
  }
  const leagueCupTie = ctx.leagueCupTies?.find(inPlayerWeek);
  if (leagueCupTie) {
    return { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: true, homeGoals: leagueCupTie.homeGoals, awayGoals: leagueCupTie.awayGoals, events: [] } as Match;
  }

  const superCup = [ctx.domesticSuperCup, ctx.continentalSuperCup].find(s => s && inPlayerWeek(s));
  if (superCup) {
    return { id: `super-${superCup.type}`, week: superCup.week, homeClubId: superCup.homeClubId, awayClubId: superCup.awayClubId, played: true, homeGoals: superCup.homeGoals ?? 0, awayGoals: superCup.awayGoals ?? 0, events: [] } as Match;
  }

  return ctx.fixtures.find(inPlayerWeek)
    || ctx.friendlies?.find(inPlayerWeek);
}

/** Generate 3 random monthly objectives, with variable rarity.
 *  Objectives persist for 4 weeks before cycling. */
export function generateMonthlyObjectives(hasMatch: boolean): ObjectiveInstance[] {
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
    claimed: false,
    rarity: obj.rarity,
  }));
}

/** Base XP for a single completed objective, including its rarity multiplier.
 *  Used when the player claims an objective's reward. */
export function objectiveClaimXP(inst: ObjectiveInstance): number {
  const rarityMult = inst.rarity === 'legendary' ? LEGENDARY_OBJECTIVE_XP_MULTIPLIER
    : inst.rarity === 'rare' ? RARE_OBJECTIVE_XP_MULTIPLIER : 1;
  return Math.round(inst.xpReward * rarityMult);
}

/** Detect newly-completed objectives. NO XP is granted or returned here:
 *  a newly-completed objective is left { completed: true, claimed: false }
 *  and its base XP is paid when the player claims it on the dashboard
 *  (featureSlice.claimObjective) — or by weekAdvance's month-end safety
 *  net for completed-but-unclaimed objectives. Month-end bonus XP
 *  (all-complete + streak extra) is computed by calculateCompletedXP. */
export function evaluateObjectives(
  objectives: ObjectiveInstance[],
  ctx: ObjectiveContext,
  streakCount: number = 0,
): { updated: ObjectiveInstance[]; allCompleted: boolean; newStreak: number } {
  const updated = objectives.map(inst => {
    if (inst.completed) return inst;
    const template = OBJECTIVE_TEMPLATES.find(t => t.id === inst.objectiveId);
    if (!template) return inst;
    return template.check(ctx) ? { ...inst, completed: true } : inst;
  });

  const allCompleted = updated.every(o => o.completed);
  const newStreak = allCompleted ? streakCount + 1 : 0;

  return { updated, allCompleted, newStreak };
}

/** Compute progress for all uncompleted objectives */
export function computeObjectiveProgress(
  objectives: ObjectiveInstance[],
  ctx: ObjectiveContext,
): ObjectiveInstance[] {
  return objectives.map(inst => {
    if (inst.completed) return inst;
    const template = OBJECTIVE_TEMPLATES.find(t => t.id === inst.objectiveId);
    if (!template?.progress) return inst;
    const progress = template.progress(ctx);
    return { ...inst, progress };
  });
}

/** Calculate month-end BONUS XP only — base objective XP is paid separately
 *  on claim (featureSlice.claimObjective) or by the month-end safety net.
 *  Returns the all-complete bonus and the streak multiplier extra (the base
 *  is recomputed below purely to size the streak extra without double-pay). */
export function calculateCompletedXP(
  objectives: ObjectiveInstance[],
  streakCount: number = 0,
): { xpEarned: number; allCompleted: boolean; newStreak: number } {
  const allCompleted = objectives.length > 0 && objectives.every(o => o.completed);
  const newStreak = allCompleted ? streakCount + 1 : 0;

  if (!allCompleted) return { xpEarned: 0, allCompleted, newStreak };

  // Recompute base XP (paid separately via claims / safety net) so the
  // streak extra can be sized without double-counting it
  let baseXP = 0;
  for (const inst of objectives) {
    if (!inst.completed) continue;
    const rarityMult = inst.rarity === 'legendary' ? LEGENDARY_OBJECTIVE_XP_MULTIPLIER
      : inst.rarity === 'rare' ? RARE_OBJECTIVE_XP_MULTIPLIER : 1;
    baseXP += inst.xpReward * rarityMult;
  }

  if (newStreak >= OBJECTIVE_STREAK_THRESHOLD) {
    // Total correct = (baseXP + bonus) * multiplier; base already paid → owe the remainder
    const total = Math.round((baseXP + ALL_OBJECTIVES_BONUS_XP) * OBJECTIVE_STREAK_MULTIPLIER);
    return { xpEarned: total - baseXP, allCompleted, newStreak };
  }

  return { xpEarned: ALL_OBJECTIVES_BONUS_XP, allCompleted, newStreak };
}
