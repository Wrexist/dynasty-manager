import type { ChallengeScenario } from '@/types/game';
import { LEAGUES } from '@/data/league';

/** Manager XP paid on completion, scaled by difficulty. Consistent with the
 *  season-end / trophy XP scale in `managerPerks.XP_REWARDS` (title = 100). */
export const CHALLENGE_XP_BY_DIFFICULTY: Record<ChallengeScenario['difficulty'], number> = {
  easy: 60,
  medium: 100,
  hard: 175,
  extreme: 300,
};

/** Extra XP multiplier for completing the weekly Featured Challenge. */
export const FEATURED_CHALLENGE_XP_MULTIPLIER = 1.5;

export const CHALLENGES: ChallengeScenario[] = [
  {
    id: 'great-escape',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.medium,
    badgeId: 'badge-survivor',
    name: 'The Great Escape',
    // NOTE: an earlier version advertised a mid-season start ("week 23 with
    // 15 points") that was never implemented — the copy below describes what
    // the challenge actually is: a full season at a weak club on half budget.
    description: 'Take over a struggling club with a slashed budget. Avoid relegation.',
    icon: 'rocket',
    difficulty: 'medium',
    startingClubId: undefined, // Will be assigned to lowest-rep club
    seasonLimit: 1,
    winCondition: 'Finish above the relegation zone at the end of the season',
    constraints: ['Lowest-reputation club in the league', 'Budget reduced by 50%'],
    budgetModifier: 0.5,
  },
  {
    id: 'invincibles',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.extreme,
    badgeId: 'badge-invincible',
    name: 'The Invincibles',
    description: 'Go an entire season unbeaten. A single defeat ends the challenge.',
    icon: 'shield',
    difficulty: 'extreme',
    seasonLimit: 1,
    winCondition: 'Complete a 38-match season without losing',
    constraints: ['Any league defeat = challenge failed', 'No special advantages'],
    budgetModifier: 1.0,
  },
  {
    id: 'youth-revolution',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.hard,
    badgeId: 'badge-youth-guru',
    name: 'Youth Revolution',
    description: 'Build a squad entirely from players under 23. Finish in the top half.',
    icon: 'sprout',
    difficulty: 'hard',
    seasonLimit: 3,
    winCondition: 'Finish in the top 10 using only U23 players in the starting lineup',
    constraints: ['Starting lineup must be all under 23', 'No transfers over £5M', 'Can only buy players under 21'],
    budgetModifier: 0.7,
    youthOnly: true,
  },
  {
    id: 'penny-pincher',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.hard,
    badgeId: 'badge-frugal',
    name: 'Penny Pincher',
    description: 'Win the league without spending a single penny on transfers.',
    icon: 'coins',
    difficulty: 'hard',
    seasonLimit: 3,
    winCondition: 'Win the league title',
    constraints: ['Cannot buy any players', 'Must use existing squad + youth academy', 'Free agents allowed'],
    budgetModifier: 1.0,
    noTransfers: true,
  },
  {
    id: 'giant-killer',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.hard,
    badgeId: 'badge-giant-killer',
    name: 'Giant Killer',
    description: 'Take the lowest-rated club and win the league within 5 seasons.',
    icon: 'swords',
    difficulty: 'hard',
    seasonLimit: 5,
    winCondition: 'Win the league with the lowest-reputation club',
    constraints: ['Must pick the lowest-rated club', 'No constraints on transfers'],
    budgetModifier: 1.0,
  },
  {
    id: 'cup-specialist',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.medium,
    badgeId: 'badge-cup-king',
    name: 'Cup Specialist',
    description: 'Win the Dynasty Cup in your first season. League form doesn\'t matter.',
    icon: 'trophy',
    difficulty: 'medium',
    seasonLimit: 1,
    winCondition: 'Win the Dynasty Cup',
    constraints: ['Only cup results matter', 'League position is irrelevant'],
    budgetModifier: 1.0,
  },
  {
    id: 'fortress',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.hard,
    badgeId: 'badge-fortress',
    name: 'Fortress',
    description: 'Go an entire season without losing a home match. Your ground must be impregnable.',
    icon: 'shield',
    difficulty: 'hard',
    seasonLimit: 1,
    winCondition: 'Complete the season unbeaten at home',
    constraints: ['Any home defeat = challenge failed', 'Away results do not matter'],
    budgetModifier: 1.0,
  },
  {
    id: 'goal-machine',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.hard,
    badgeId: 'badge-goal-machine',
    name: 'Goal Machine',
    description: 'Score 100+ league goals in a single season. Attack is the best form of defence.',
    icon: 'flame',
    difficulty: 'hard',
    seasonLimit: 1,
    winCondition: 'Score 100 or more league goals in one season',
    constraints: ['Only league goals count', 'Defensive record is irrelevant'],
    budgetModifier: 1.0,
  },
  {
    id: 'double-winner',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.extreme,
    badgeId: 'badge-double',
    name: 'The Double',
    description: 'Win both the league title and the Dynasty Cup in the same season.',
    icon: 'medal',
    difficulty: 'extreme',
    seasonLimit: 1,
    winCondition: 'Win the league AND the Dynasty Cup',
    constraints: ['Must win both competitions', 'No budget advantage'],
    budgetModifier: 1.0,
  },
  {
    id: 'promotion-express',
    rewardXp: CHALLENGE_XP_BY_DIFFICULTY.hard,
    badgeId: 'badge-express',
    name: 'Promotion Express',
    description: 'Get promoted to the top flight within 2 seasons starting from the third tier.',
    icon: 'rocket',
    difficulty: 'hard',
    seasonLimit: 2,
    winCondition: 'Reach the top division within 2 seasons',
    constraints: ['Must start in the third tier or lower', 'Budget reduced by 30%'],
    budgetModifier: 0.7,
  },
];

/** ISO-8601 week number (1-53) for a date. Weeks start Monday; the week
 *  containing the year's first Thursday is week 1. Deterministic and locale-
 *  independent — the same basis the pack rotation uses to key by real time. */
export function isoWeek(now: Date = new Date()): number {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** The Featured Challenge id for the real ISO week containing `now`.
 *  Deterministic rotation across all scenarios so every player sees the same
 *  weekly highlight without any server. Completing the featured one pays a
 *  small XP bonus (see FEATURED_CHALLENGE_XP_MULTIPLIER). */
export function getFeaturedChallengeId(now: Date = new Date()): string {
  // Combine ISO week with the ISO week-year so the index keeps advancing across
  // the year boundary instead of snapping back to week 1's challenge.
  const idx = (isoWeek(now) + now.getFullYear()) % CHALLENGES.length;
  return CHALLENGES[idx].id;
}

/** Get difficulty color for UI */
export function getDifficultyColor(difficulty: ChallengeScenario['difficulty']): string {
  switch (difficulty) {
    case 'easy': return 'text-emerald-400 bg-emerald-400/10';
    case 'medium': return 'text-amber-400 bg-amber-400/10';
    case 'hard': return 'text-orange-400 bg-orange-400/10';
    case 'extreme': return 'text-destructive bg-destructive/10';
  }
}

/** Check if a challenge's win condition has been met */
export function checkChallengeComplete(
  challengeId: string,
  leaguePosition: number,
  cupWinner: boolean,
  seasonHistory: { position: number }[],
  hasLost: boolean,
  extraData?: { homeUnbeaten?: boolean; leagueGoals?: number; divisionId?: string; seasonDivisionId?: string },
): boolean {
  switch (challengeId) {
    case 'great-escape': {
      // Finish above the relegation zone of the division the season was
      // PLAYED in (seasonDivisionId; `divisionId` is the post-turnover
      // division used by 'promotion-express'). The old hardcoded `<= 17`
      // was an auto-win in 10-18-team leagues and wrong in 24-team ones.
      const league = LEAGUES.find(l => l.id === (extraData?.seasonDivisionId ?? extraData?.divisionId));
      if (!league) return false;
      const dropSpots = league.relegationSpots || league.replacedSlots || 0;
      const safeLine = league.teamCount - dropSpots;
      return leaguePosition > 0 && leaguePosition <= safeLine;
    }
    case 'invincibles':
      return !hasLost && leaguePosition > 0;
    case 'youth-revolution':
      return leaguePosition <= 10;
    case 'penny-pincher':
      return leaguePosition === 1;
    case 'giant-killer':
      return seasonHistory.some(h => h.position === 1);
    case 'cup-specialist':
      return cupWinner;
    case 'fortress':
      return extraData?.homeUnbeaten === true;
    case 'goal-machine':
      return (extraData?.leagueGoals || 0) >= 100;
    case 'double-winner':
      return leaguePosition === 1 && cupWinner;
    case 'promotion-express':
      return LEAGUES.find(l => l.id === extraData?.divisionId)?.tier === 1;
    default:
      return false;
  }
}

/** Check if a challenge has been failed */
export function checkChallengeFailed(
  challengeId: string,
  seasonsRemaining: number,
  leaguePosition: number,
  hasLost: boolean,
  extraData?: { homeLost?: boolean },
): boolean {
  if (seasonsRemaining <= 0) return true;

  switch (challengeId) {
    case 'invincibles':
      return hasLost;
    case 'fortress':
      return extraData?.homeLost === true;
    default:
      return false;
  }
}
