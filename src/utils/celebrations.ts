import { Player, Match, LeagueTableEntry } from '@/types/game';

export type CelebrationSeverity = 'minor' | 'major' | 'legendary';

export interface Celebration {
  title: string;
  description: string;
  type: 'milestone' | 'streak' | 'record';
  severity: CelebrationSeverity;
  icon?: string;
}

/** Check for celebration-worthy milestones after a match week.
 *  Returns an array of celebrations to show as toasts or modals. */
export function checkCelebrations(
  playerClubId: string,
  players: Record<string, Player>,
  playerIds: string[],
  fixtures: Match[],
  leagueTable: LeagueTableEntry[],
  season: number,
): Celebration[] {
  const celebrations: Celebration[] = [];

  // Player goal milestones (10, 15, 20, 25, 30)
  const goalThresholds = [10, 15, 20, 25, 30];
  for (const pid of playerIds) {
    const p = players[pid];
    if (!p) continue;
    for (const t of goalThresholds) {
      if (p.goals === t) {
        celebrations.push({
          title: `${p.lastName} — ${t} Goals!`,
          description: `${p.firstName} ${p.lastName} reaches ${t} goals this season.`,
          type: 'milestone',
          severity: t >= 25 ? 'major' : 'minor',
          icon: '⚽',
        });
      }
    }
    // Assists milestones (10, 15, 20)
    const assistThresholds = [10, 15, 20];
    for (const t of assistThresholds) {
      if (p.assists === t) {
        celebrations.push({
          title: `${p.lastName} — ${t} Assists!`,
          description: `${p.firstName} ${p.lastName} reaches ${t} assists this season.`,
          type: 'milestone',
          severity: t >= 20 ? 'major' : 'minor',
          icon: '🎯',
        });
      }
    }
  }

  // Unbeaten run check
  const playedMatches = fixtures
    .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    .sort((a, b) => b.week - a.week);

  let unbeatenRun = 0;
  for (const m of playedMatches) {
    const isHome = m.homeClubId === playerClubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (ga > gf) break;
    unbeatenRun++;
  }
  const unbeatenMilestones = [5, 10, 15, 20];
  for (const t of unbeatenMilestones) {
    if (unbeatenRun === t) {
      celebrations.push({
        title: `${t}-Match Unbeaten Run!`,
        description: `Your team hasn't lost in ${t} consecutive matches.`,
        type: 'streak',
        severity: t >= 15 ? 'major' : 'minor',
        icon: '🛡️',
      });
    }
  }

  // Win streak check
  let winStreak = 0;
  for (const m of playedMatches) {
    const isHome = m.homeClubId === playerClubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (gf <= ga) break;
    winStreak++;
  }
  const winMilestones = [3, 5, 8, 10];
  for (const t of winMilestones) {
    if (winStreak === t) {
      celebrations.push({
        title: `${t} Wins in a Row!`,
        description: `An incredible run of ${t} consecutive victories.`,
        type: 'streak',
        severity: t >= 8 ? 'major' : 'minor',
        icon: '🔥',
      });
    }
  }

  // Clean sheet milestones
  const cleanSheets = playedMatches.filter(m => {
    const isHome = m.homeClubId === playerClubId;
    return isHome ? m.awayGoals === 0 : m.homeGoals === 0;
  }).length;
  const csMilestones = [5, 10, 15];
  for (const t of csMilestones) {
    if (cleanSheets === t) {
      celebrations.push({
        title: `${t} Clean Sheets!`,
        description: `Your defense has kept ${t} clean sheets this season.`,
        type: 'milestone',
        severity: t >= 15 ? 'major' : 'minor',
        icon: '🧤',
      });
    }
  }

  // League position breakthroughs
  const myEntry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = myEntry ? leagueTable.indexOf(myEntry) + 1 : 0;
  if (pos === 1 && playedMatches.length >= 5) {
    celebrations.push({
      title: 'Top of the Table!',
      description: 'Your club sits at the summit of the league.',
      type: 'record',
      severity: 'major',
      icon: '👑',
    });
  }

  return celebrations;
}

/** Get current win streak count (useful for streak bonus display) */
export function getWinStreak(playerClubId: string, fixtures: Match[]): number {
  const playedMatches = fixtures
    .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    .sort((a, b) => b.week - a.week);

  let streak = 0;
  for (const m of playedMatches) {
    const isHome = m.homeClubId === playerClubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (gf <= ga) break;
    streak++;
  }
  return streak;
}
