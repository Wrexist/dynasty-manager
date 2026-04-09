import type { ChallengeScenario } from '@/types/game';

export const CHALLENGES: ChallengeScenario[] = [
  {
    id: 'great-escape',
    name: 'The Great Escape',
    description: 'Take over a struggling club 10 points from safety with 15 weeks left. Avoid relegation.',
    icon: 'rocket',
    difficulty: 'medium',
    startingClubId: undefined, // Will be assigned to lowest-rep club
    seasonLimit: 1,
    winCondition: 'Finish in the top 17 at the end of the season',
    constraints: ['Start at week 23 with 15 points', 'Budget reduced by 50%'],
    budgetModifier: 0.5,
  },
  {
    id: 'invincibles',
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
    name: 'Cup Specialist',
    description: 'Win the Dynasty Cup in your first season. League form doesn\'t matter.',
    icon: 'trophy',
    difficulty: 'medium',
    seasonLimit: 1,
    winCondition: 'Win the Dynasty Cup',
    constraints: ['Only cup results matter', 'League position is irrelevant'],
    budgetModifier: 1.0,
  },
];

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
): boolean {
  switch (challengeId) {
    case 'great-escape':
      return leaguePosition <= 17;
    case 'invincibles':
      return !hasLost && leaguePosition > 0; // Checked at season end, hasLost tracked separately
    case 'youth-revolution':
      return leaguePosition <= 10;
    case 'penny-pincher':
      return leaguePosition === 1;
    case 'giant-killer':
      return seasonHistory.some(h => h.position === 1);
    case 'cup-specialist':
      return cupWinner;
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
): boolean {
  if (seasonsRemaining <= 0) return true;

  switch (challengeId) {
    case 'invincibles':
      return hasLost;
    default:
      return false;
  }
}
