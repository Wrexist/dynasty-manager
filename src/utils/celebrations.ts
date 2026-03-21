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
  _season: number,
): Celebration[] {
  const celebrations: Celebration[] = [];

  // Player goal milestones (10, 15, 20, 25, 30)
  // Use >= with upper bound to handle cases where a player scores multiple goals
  // in one match and jumps past the exact threshold (e.g., 9 → 11 skips 10).
  const goalThresholds = [10, 15, 20, 25, 30];
  for (const pid of playerIds) {
    const p = players[pid];
    if (!p) continue;
    for (let i = 0; i < goalThresholds.length; i++) {
      const t = goalThresholds[i];
      const nextT = goalThresholds[i + 1] ?? t + 5;
      if (p.goals >= t && p.goals < nextT) {
        celebrations.push({
          title: `${p.lastName} — ${t} Goals!`,
          description: `${p.firstName} ${p.lastName} reaches ${t} goals this season.`,
          type: 'milestone',
          severity: t >= 25 ? 'major' : 'minor',
          icon: 'circle',
        });
      }
    }
    // Assists milestones (10, 15, 20)
    const assistThresholds = [10, 15, 20];
    for (let i = 0; i < assistThresholds.length; i++) {
      const t = assistThresholds[i];
      const nextT = assistThresholds[i + 1] ?? t + 5;
      if (p.assists >= t && p.assists < nextT) {
        celebrations.push({
          title: `${p.lastName} — ${t} Assists!`,
          description: `${p.firstName} ${p.lastName} reaches ${t} assists this season.`,
          type: 'milestone',
          severity: t >= 20 ? 'major' : 'minor',
          icon: 'target',
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
  // Streaks use >= so milestones fire even if a bye week caused a skip
  const unbeatenMilestones = [5, 10, 15, 20];
  for (const t of unbeatenMilestones) {
    const nextT = unbeatenMilestones[unbeatenMilestones.indexOf(t) + 1] || t + 5;
    if (unbeatenRun >= t && unbeatenRun < nextT) {
      celebrations.push({
        title: `${t}-Match Unbeaten Run!`,
        description: `Your team hasn't lost in ${unbeatenRun} consecutive matches.`,
        type: 'streak',
        severity: t >= 15 ? 'major' : 'minor',
        icon: 'shield',
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
    const nextT = winMilestones[winMilestones.indexOf(t) + 1] || t + 5;
    if (winStreak >= t && winStreak < nextT) {
      celebrations.push({
        title: `${t} Wins in a Row!`,
        description: `An incredible run of ${winStreak} consecutive victories.`,
        type: 'streak',
        severity: t >= 8 ? 'major' : 'minor',
        icon: 'flame',
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
    const nextT = csMilestones[csMilestones.indexOf(t) + 1] || t + 5;
    if (cleanSheets >= t && cleanSheets < nextT) {
      celebrations.push({
        title: `${t} Clean Sheets!`,
        description: `Your defense has kept ${cleanSheets} clean sheets this season.`,
        type: 'milestone',
        severity: t >= 15 ? 'major' : 'minor',
        icon: 'shield-check',
      });
    }
  }

  // League position breakthroughs
  const myEntry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = myEntry ? leagueTable.indexOf(myEntry) + 1 : 999;
  if (pos === 1 && playedMatches.length >= 5) {
    celebrations.push({
      title: 'Top of the Table!',
      description: 'Your club sits at the summit of the league.',
      type: 'record',
      severity: 'major',
      icon: 'crown',
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
