import { Player, Match, LeagueTableEntry, Club, MatchDramaType } from '@/types/game';
import {
  DRAMA_LATE_MINUTE, DRAMA_THRASHING_MARGIN, DRAMA_UNDERDOG_REP_GAP,
  GOAL_MILESTONES, ASSIST_MILESTONES, UNBEATEN_MILESTONES, WIN_MILESTONES,
  CLEAN_SHEET_MILESTONES, CAREER_GOAL_MILESTONES, CAREER_APP_MILESTONES,
} from '@/config/gameBalance';

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

  // Player goal milestones
  // Use >= with upper bound to handle cases where a player scores multiple goals
  // in one match and jumps past the exact threshold (e.g., 9 → 11 skips 10).
  const goalThresholds = GOAL_MILESTONES;
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
    // Assists milestones
    const assistThresholds = ASSIST_MILESTONES;
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
  const unbeatenMilestones = UNBEATEN_MILESTONES;
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
  const winMilestones = WIN_MILESTONES;
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
  const csMilestones = CLEAN_SHEET_MILESTONES;
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

  // Career-cumulative player milestones (goals + appearances for the club)
  const careerGoalMilestones = CAREER_GOAL_MILESTONES;
  const careerAppMilestones = CAREER_APP_MILESTONES;
  for (const pid of playerIds) {
    const p = players[pid];
    if (!p) continue;
    const totalGoals = (p.careerGoals || 0) + p.goals;
    const totalApps = (p.careerAppearances || 0) + p.appearances;

    for (let i = 0; i < careerGoalMilestones.length; i++) {
      const t = careerGoalMilestones[i];
      const nextT = careerGoalMilestones[i + 1] ?? t * 2;
      if (totalGoals >= t && totalGoals < nextT) {
        celebrations.push({
          title: `${p.lastName} — ${t} Career Goals!`,
          description: `${p.firstName} ${p.lastName} has scored ${t} goals for the club across all seasons.`,
          type: 'milestone',
          severity: t >= 100 ? 'major' : 'minor',
          icon: 'circle',
        });
      }
    }

    for (let i = 0; i < careerAppMilestones.length; i++) {
      const t = careerAppMilestones[i];
      const nextT = careerAppMilestones[i + 1] ?? t * 2;
      if (totalApps >= t && totalApps < nextT) {
        celebrations.push({
          title: `${p.lastName} — ${t} Appearances!`,
          description: `${p.firstName} ${p.lastName} has made ${t} appearances for the club. A true servant!`,
          type: 'milestone',
          severity: t >= 200 ? 'major' : 'minor',
          icon: 'user',
        });
      }
    }
  }

  return celebrations;
}

/** Detect the dramatic context of a match result for emotional amplification */
export function detectMatchDrama(
  match: Match,
  playerClubId: string,
  clubs: Record<string, Club>,
): MatchDramaType {
  if (!match.played) return null;

  const isHome = match.homeClubId === playerClubId;
  const gf = isHome ? match.homeGoals : match.awayGoals;
  const ga = isHome ? match.awayGoals : match.homeGoals;
  const won = gf > ga;
  const lost = gf < ga;
  const margin = Math.abs(gf - ga);

  const oppId = isHome ? match.awayClubId : match.homeClubId;
  const playerClub = clubs[playerClubId];
  const oppClub = clubs[oppId];
  const repGap = (oppClub?.reputation || 0) - (playerClub?.reputation || 0);

  // Late winner (85+ minute winning goal by player's team)
  if (won && match.events) {
    const lateGoals = match.events.filter(
      e => (e.type === 'goal' || e.type === 'penalty_scored') &&
        e.clubId === playerClubId && e.minute >= DRAMA_LATE_MINUTE
    );
    // Check if the late goal was the decisive one
    if (lateGoals.length > 0 && margin <= 1) {
      return 'late_winner';
    }
  }

  // Heartbreak loss (opponent scores late winner)
  if (lost && match.events) {
    const lateOppGoals = match.events.filter(
      e => (e.type === 'goal' || e.type === 'penalty_scored') &&
        e.clubId !== playerClubId && e.minute >= DRAMA_LATE_MINUTE
    );
    if (lateOppGoals.length > 0 && margin <= 1) {
      return 'heartbreak_loss';
    }
  }

  // Comeback win (was losing, ended up winning)
  if (won && match.events) {
    let playerGoals = 0;
    let oppGoals = 0;
    let wasLosing = false;
    for (const e of match.events) {
      if (e.type === 'goal' || e.type === 'penalty_scored') {
        if (e.clubId === playerClubId) playerGoals++;
        else oppGoals++;
      } else if (e.type === 'own_goal') {
        // Own goals benefit the opposing team
        if (e.clubId === playerClubId) oppGoals++;
        else playerGoals++;
      }
      if (oppGoals > playerGoals) wasLosing = true;
    }
    if (wasLosing) return 'comeback_win';
  }

  // Thrashing (won by 4+ goals)
  if (won && margin >= DRAMA_THRASHING_MARGIN) {
    return 'thrashing';
  }

  // Underdog upset (beat a much higher-rep team)
  if (won && repGap >= DRAMA_UNDERDOG_REP_GAP) {
    return 'underdog_upset';
  }

  return null;
}

/** Get a celebration-worthy description for a match drama type */
export function getDramaCelebration(drama: MatchDramaType): Celebration | null {
  switch (drama) {
    case 'late_winner':
      return { title: 'SCENES! Late Winner!', description: 'A dramatic last-gasp winner sends the crowd wild!', type: 'record', severity: 'legendary', icon: 'clock' };
    case 'comeback_win':
      return { title: 'What a Comeback!', description: 'Down and out, but never beaten — an incredible turnaround!', type: 'record', severity: 'major', icon: 'rotate-ccw' };
    case 'thrashing':
      return { title: 'Total Domination!', description: 'A commanding performance — the opposition had no answer.', type: 'record', severity: 'major', icon: 'zap' };
    case 'underdog_upset':
      return { title: 'Giant Killing!', description: 'The underdog triumphs! Nobody saw this coming.', type: 'record', severity: 'major', icon: 'swords' };
    case 'heartbreak_loss':
      return { title: 'Heartbreak...', description: 'A cruel last-minute blow. Pick yourselves up and go again.', type: 'record', severity: 'minor', icon: 'heart-crack' };
    default:
      return null;
  }
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

/** Get current unbeaten run count */
export function getUnbeatenRun(playerClubId: string, fixtures: Match[]): number {
  const playedMatches = fixtures
    .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    .sort((a, b) => b.week - a.week);

  let run = 0;
  for (const m of playedMatches) {
    const isHome = m.homeClubId === playerClubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (ga > gf) break;
    run++;
  }
  return run;
}

/** Get current consecutive clean sheet streak */
export function getCleanSheetStreak(playerClubId: string, fixtures: Match[]): number {
  const playedMatches = fixtures
    .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    .sort((a, b) => b.week - a.week);

  let streak = 0;
  for (const m of playedMatches) {
    const isHome = m.homeClubId === playerClubId;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (ga > 0) break;
    streak++;
  }
  return streak;
}
