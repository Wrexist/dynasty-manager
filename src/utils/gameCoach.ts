import type { Club, GameScreen, Match, ObjectiveInstance, Player, ScoutAssignment } from '@/types/game';
import { COACH_TASK_XP } from '@/config/gameBalance';

export interface CoachTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  screen?: GameScreen;
  priority: 'high' | 'medium' | 'low';
  xpReward: number;
}

interface BuildCoachTasksContext {
  club: Club;
  fixtures: Match[];
  playerClubId: string;
  unreadMessages: number;
  objectives: ObjectiveInstance[];
  players: Record<string, Player>;
  transferWindowOpen: boolean;
  scoutAssignments: ScoutAssignment[];
  scoutReportsCount: number;
  shortlistCount: number;
  week: number;
  completedTaskIds: string[];
}

export function buildCoachTasks(ctx: BuildCoachTasksContext): CoachTask[] {
  const completedObjectives = ctx.objectives.filter(o => o.completed).length;
  const playedMatches = ctx.fixtures.filter(
    (m) => m.played && (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  ).length;

  const done = (id: string) => ctx.completedTaskIds.includes(id);

  const tasks: CoachTask[] = [
    {
      id: 'lineup',
      title: 'Set your best XI',
      description: 'Auto-fill or tweak your lineup before advancing.',
      completed: done('lineup') || ctx.club.lineup.length >= 11,
      screen: 'squad',
      priority: 'high',
      xpReward: COACH_TASK_XP['lineup'] ?? 5,
    },
    {
      id: 'first-match',
      title: 'Play your first match week',
      description: 'Advance week to start building momentum.',
      completed: done('first-match') || playedMatches > 0,
      screen: 'dashboard',
      priority: 'high',
      xpReward: COACH_TASK_XP['first-match'] ?? 5,
    },
    {
      id: 'objectives',
      title: 'Complete a monthly objective',
      description: 'Objectives are your fastest XP source early on.',
      completed: done('objectives') || completedObjectives > 0,
      screen: 'dashboard',
      priority: 'high',
      xpReward: COACH_TASK_XP['objectives'] ?? 5,
    },
    {
      id: 'scouting',
      title: 'Start scouting for hidden talent',
      description: 'Assign at least one scout to build future depth.',
      completed: done('scouting') || ctx.scoutAssignments.length > 0 || ctx.scoutReportsCount > 0,
      screen: 'scouting',
      priority: 'medium',
      xpReward: COACH_TASK_XP['scouting'] ?? 5,
    },
    {
      id: 'contracts',
      title: 'Review expiring contracts',
      description: 'Avoid losing key players for free at season end.',
      completed: done('contracts') || ctx.club.playerIds
        .map((id) => ctx.players[id])
        .filter(Boolean)
        .every((player) => player.contractEnd > 1),
      screen: 'squad',
      priority: 'medium',
      xpReward: COACH_TASK_XP['contracts'] ?? 5,
    },
    {
      id: 'transfers',
      title: 'Track transfer market targets',
      description: 'Add 1-2 shortlist options before deadline pressure hits.',
      completed: done('transfers') || ctx.shortlistCount > 0,
      screen: ctx.transferWindowOpen ? 'transfers' : 'scouting',
      priority: 'low',
      xpReward: COACH_TASK_XP['transfers'] ?? 5,
    },
    {
      id: 'inbox',
      title: 'Keep inbox clear',
      description: 'Unread messages often contain board and transfer updates.',
      completed: done('inbox') || ctx.unreadMessages === 0,
      screen: 'inbox',
      priority: 'low',
      xpReward: COACH_TASK_XP['inbox'] ?? 5,
    },
  ];

  if (ctx.week > 10) {
    return tasks.filter((task) => task.id !== 'first-match');
  }

  // Week 1: focus on the essentials — only show high-priority tasks
  if (ctx.week <= 1) {
    return tasks.filter(t => t.priority === 'high');
  }

  return tasks;
}
