import { Club, LeagueInfo } from '@/types/game';
import { ELO_K_FACTORS, ELO_INITIAL_TIER_BONUS, ELO_REPUTATION_MULTIPLIER } from '@/config/gameBalance';

/**
 * Initialize power rankings for all clubs based on reputation and division tier.
 * Range: ~120 (tier-4 rep-1) to ~1600 (tier-1 rep-10).
 */
export function initializeClubPowerRankings(
  clubs: Record<string, Club>,
  leagues: LeagueInfo[],
): Record<string, number> {
  const tierMap: Record<string, number> = {};
  for (const league of leagues) {
    tierMap[league.id] = league.qualityTier;
  }
  const rankings: Record<string, number> = {};
  for (const club of Object.values(clubs)) {
    const tier = tierMap[club.divisionId] ?? 4;
    const tierBonus = ELO_INITIAL_TIER_BONUS[tier] ?? 0;
    rankings[club.id] = club.reputation * ELO_REPUTATION_MULTIPLIER + tierBonus;
  }
  return rankings;
}

/**
 * ELO expected score: probability that player A beats player B.
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update ELO ratings for two clubs after a match.
 * Returns updated ratings (mutates the passed object for efficiency).
 *
 * @param matchType - Determines K-factor: 'league' | 'cup' | 'continental'
 */
export function updateEloRatings(
  rankings: Record<string, number>,
  homeClubId: string,
  awayClubId: string,
  homeGoals: number,
  awayGoals: number,
  matchType: 'league' | 'cup' | 'continental' = 'league',
): Record<string, number> {
  const homeRating = rankings[homeClubId] ?? 800;
  const awayRating = rankings[awayClubId] ?? 800;
  const K = ELO_K_FACTORS[matchType] ?? ELO_K_FACTORS.league;

  // Actual score: 1 for win, 0.5 for draw, 0 for loss
  const homeActual = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const awayActual = 1 - homeActual;

  const homeExpected = expectedScore(homeRating, awayRating);
  const awayExpected = 1 - homeExpected;

  // Goal difference bonus: scale K slightly for dominant wins (capped at 1.5x)
  const goalDiff = Math.abs(homeGoals - awayGoals);
  const gdMultiplier = goalDiff <= 1 ? 1.0 : goalDiff === 2 ? 1.15 : 1.3;

  rankings[homeClubId] = Math.max(100, Math.round(homeRating + K * gdMultiplier * (homeActual - homeExpected)));
  rankings[awayClubId] = Math.max(100, Math.round(awayRating + K * gdMultiplier * (awayActual - awayExpected)));

  return rankings;
}

/**
 * Compute an opponent-quality bonus for match ratings.
 * Returns a value between -1.0 and +1.0 that should be added to the synthetic rating.
 * Positive when facing a stronger opponent, negative when facing a weaker one.
 */
export function getOpponentQualityBonus(
  playerClubRanking: number,
  opponentClubRanking: number,
): number {
  const diff = opponentClubRanking - playerClubRanking;
  // Scale: every 400 ELO difference gives ±1.0 rating bonus
  return Math.max(-1.0, Math.min(1.0, diff / 400));
}
