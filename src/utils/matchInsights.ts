import type { Match, MatchEvent } from '@/types/game';

export interface MatchInsight {
  icon: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}

/**
 * Analyze a completed match and generate 2-4 key insights explaining the result.
 * Helps new players understand WHY they won or lost.
 */
export function generateMatchInsights(
  match: Match,
  playerClubId: string,
): MatchInsight[] {
  if (!match.played || !match.stats) return [];

  const insights: MatchInsight[] = [];
  const isHome = match.homeClubId === playerClubId;
  const playerGoals = isHome ? match.homeGoals : match.awayGoals;
  const opponentGoals = isHome ? match.awayGoals : match.homeGoals;
  const won = playerGoals > opponentGoals;
  const lost = playerGoals < opponentGoals;
  const stats = match.stats;

  const playerPossession = isHome ? stats.homePossession : stats.awayPossession;
  const opponentPossession = isHome ? stats.awayPossession : stats.homePossession;
  const playerShots = isHome ? stats.homeShots : stats.awayShots;
  const opponentShots = isHome ? stats.awayShots : stats.homeShots;
  const playerXG = isHome ? stats.homeXG : stats.awayXG;
  const opponentXG = isHome ? stats.awayXG : stats.homeXG;

  // Possession dominance
  if (opponentPossession > 58 && lost) {
    insights.push({ icon: 'circle-dot', text: `Opponent dominated possession (${opponentPossession}%). Consider adjusting tempo or formation to win back the ball.`, type: 'negative' });
  } else if (playerPossession > 58 && won) {
    insights.push({ icon: 'circle-dot', text: `Controlled the game with ${playerPossession}% possession. Great tactical setup.`, type: 'positive' });
  } else if (playerPossession > 58 && lost) {
    insights.push({ icon: 'circle-dot', text: `Had ${playerPossession}% possession but still lost. Need to be more clinical with chances.`, type: 'negative' });
  }

  // Shot efficiency
  if (playerShots > 0) {
    const conversionRate = playerGoals / playerShots;
    const opponentConversion = opponentShots > 0 ? opponentGoals / opponentShots : 0;
    if (conversionRate < 0.08 && playerShots >= 10 && lost) {
      insights.push({ icon: 'target', text: `Created ${playerShots} shots but only scored ${playerGoals}. Poor finishing cost you the match.`, type: 'negative' });
    }
    if (opponentConversion > 0.25 && opponentGoals >= 2) {
      insights.push({ icon: 'shield-alert', text: `Opponent was ruthlessly efficient — scoring ${opponentGoals} from just ${opponentShots} shots. Tighten your defence.`, type: 'negative' });
    }
  }

  // xG analysis
  if (playerXG !== undefined && opponentXG !== undefined) {
    if (playerGoals < playerXG - 1) {
      insights.push({ icon: 'trending-down', text: `Underperformed expected goals (${playerGoals} scored vs ${playerXG.toFixed(1)} xG). Better finishing would have changed the result.`, type: 'negative' });
    } else if (playerGoals > playerXG + 1) {
      insights.push({ icon: 'trending-up', text: `Outperformed expected goals (${playerGoals} scored vs ${playerXG.toFixed(1)} xG). Clinical finishing made the difference.`, type: 'positive' });
    }
  }

  // Injury impact
  const injuries = match.events.filter((e: MatchEvent) => e.type === 'injury');
  const playerInjuries = injuries.filter(e => {
    const isPlayerTeam = isHome ? e.clubId === match.homeClubId : e.clubId === match.awayClubId;
    return isPlayerTeam;
  });
  if (playerInjuries.length >= 2) {
    insights.push({ icon: 'heart-crack', text: `${playerInjuries.length} injuries disrupted your squad. Check player fitness before the next match.`, type: 'negative' });
  }

  // Red cards
  const redCards = match.events.filter((e: MatchEvent) => e.type === 'red_card');
  const playerReds = redCards.filter(e => {
    const isPlayerTeam = isHome ? e.clubId === match.homeClubId : e.clubId === match.awayClubId;
    return isPlayerTeam;
  });
  if (playerReds.length > 0) {
    insights.push({ icon: 'alert-triangle', text: `Playing with ${11 - playerReds.length} men after a red card made things much harder.`, type: 'negative' });
  }

  // Late drama
  const lateGoals = match.events.filter((e: MatchEvent) => e.type === 'goal' && e.minute >= 85);
  if (lateGoals.length > 0) {
    const playerLateGoals = lateGoals.filter(e => {
      return isHome ? e.clubId === match.homeClubId : e.clubId === match.awayClubId;
    });
    if (playerLateGoals.length > 0 && won) {
      insights.push({ icon: 'zap', text: `Late drama! A goal after the 85th minute sealed the win. Substitutions and fitness made the difference.`, type: 'positive' });
    } else if (playerLateGoals.length === 0 && lateGoals.length > 0 && lost) {
      insights.push({ icon: 'zap', text: `Conceded a late goal after the 85th minute. Consider defensive substitutions to protect a lead.`, type: 'negative' });
    }
  }

  // Positive win insight
  if (won && insights.length === 0) {
    insights.push({ icon: 'trophy', text: 'Solid performance across the board. Keep this momentum going!', type: 'positive' });
  }

  // Draw insight
  if (!won && !lost && insights.length === 0) {
    insights.push({ icon: 'minus', text: 'An even contest. Small tactical tweaks could tip the balance in your favour next time.', type: 'neutral' });
  }

  return insights.slice(0, 4);
}
