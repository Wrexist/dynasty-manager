import type { Club, GameScreen, Match, ObjectiveInstance, Player, ScoutAssignment } from '@/types/game';

export interface CoachTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  screen?: GameScreen;
  priority: 'high' | 'medium' | 'low';
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
}

export function buildCoachTasks(ctx: BuildCoachTasksContext): CoachTask[] {
  const completedObjectives = ctx.objectives.filter(o => o.completed).length;
  const playedMatches = ctx.fixtures.filter(
    (m) => m.played && (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  ).length;

  const tasks: CoachTask[] = [
    {
      id: 'lineup',
      title: 'Set your best XI',
      description: 'Auto-fill or tweak your lineup before advancing.',
      completed: ctx.club.lineup.length >= 11,
      screen: 'squad',
      priority: 'high',
    },
    {
      id: 'first-match',
      title: 'Play your first match week',
      description: 'Advance week to start building momentum.',
      completed: playedMatches > 0,
      screen: 'dashboard',
      priority: 'high',
    },
    {
      id: 'objectives',
      title: 'Complete a weekly objective',
      description: 'Objectives are your fastest XP source early on.',
      completed: completedObjectives > 0,
      screen: 'dashboard',
      priority: 'high',
    },
    {
      id: 'scouting',
      title: 'Start scouting for hidden talent',
      description: 'Assign at least one scout to build future depth.',
      completed: ctx.scoutAssignments.length > 0 || ctx.scoutReportsCount > 0,
      screen: 'scouting',
      priority: 'medium',
    },
    {
      id: 'contracts',
      title: 'Review expiring contracts',
      description: 'Avoid losing key players for free at season end.',
      completed: ctx.club.playerIds
        .map((id) => ctx.players[id])
        .filter(Boolean)
        .every((player) => player.contractEnd > 1),
      screen: 'squad',
      priority: 'medium',
    },
    {
      id: 'transfers',
      title: 'Track transfer market targets',
      description: 'Add 1-2 shortlist options before deadline pressure hits.',
      completed: ctx.shortlistCount > 0,
      screen: ctx.transferWindowOpen ? 'transfers' : 'scouting',
      priority: 'low',
    },
    {
      id: 'inbox',
      title: 'Keep inbox clear',
      description: 'Unread messages often contain board and transfer updates.',
      completed: ctx.unreadMessages === 0,
      screen: 'inbox',
      priority: 'low',
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
