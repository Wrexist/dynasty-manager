import type { GameScreen, Player, Club, Match } from '@/types/game';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { LINEUP_SIZE, LOW_FITNESS_THRESHOLD } from '@/config/gameBalance';

export interface ManagerTip {
  icon: string;
  text: string;
  action?: GameScreen;
  priority: number;
}

interface TipContext {
  week: number;
  season: number;
  club: Club;
  players: Record<string, Player>;
  fixtures: Match[];
  transferWindowOpen: boolean;
  boardConfidence: number;
  incomingOffers: number;
  tacticalFamiliarity: number;
}

export function getManagerTips(ctx: TipContext): ManagerTip[] {
  const tips: ManagerTip[] = [];
  const { week, season, club, players, transferWindowOpen, boardConfidence, incomingOffers, tacticalFamiliarity } = ctx;

  const squadPlayers = club.playerIds.map(id => players[id]).filter(Boolean);
  const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);

  // Season 1, week 1: set tactics
  if (season === 1 && week === 1) {
    tips.push({ icon: 'Target', text: 'Set your tactics before your first match.', action: 'tactics', priority: 10 });
  }

  // Lineup too small
  if (club.lineup.filter(id => players[id]).length < LINEUP_SIZE) {
    tips.push({ icon: 'Users', text: 'Your starting lineup is incomplete — set your team.', action: 'tactics', priority: 9 });
  }

  // Injured player in lineup
  const injuredStarters = lineupPlayers.filter(p => p.injured);
  if (injuredStarters.length > 0) {
    tips.push({
      icon: 'AlertTriangle',
      text: `${injuredStarters[0].lastName} is injured but in your lineup — update your team.`,
      action: 'tactics',
      priority: 8,
    });
  }

  // Low-fitness starter
  const lowFitness = lineupPlayers.filter(p => !p.injured && p.fitness < LOW_FITNESS_THRESHOLD);
  if (lowFitness.length > 0) {
    tips.push({
      icon: 'Heart',
      text: `${lowFitness[0].lastName} has low fitness (${lowFitness[0].fitness}%) — consider resting them.`,
      action: 'squad',
      priority: 7,
    });
  }

  // Transfer window closing soon
  if (transferWindowOpen) {
    const weeksLeft = week <= SUMMER_WINDOW_END
      ? SUMMER_WINDOW_END - week
      : week >= WINTER_WINDOW_START && week <= WINTER_WINDOW_END
        ? WINTER_WINDOW_END - week
        : 0;

    if (weeksLeft > 0 && weeksLeft <= 3) {
      tips.push({
        icon: 'Clock',
        text: `Transfer window closes in ${weeksLeft} week${weeksLeft > 1 ? 's' : ''} — make your final moves.`,
        action: 'transfers',
        priority: 6,
      });
    }
  }

  // Window about to open
  if (!transferWindowOpen && week >= WINTER_WINDOW_START - 2 && week < WINTER_WINDOW_START) {
    tips.push({
      icon: 'ShoppingCart',
      text: `Winter transfer window opens in ${WINTER_WINDOW_START - week} week${WINTER_WINDOW_START - week > 1 ? 's' : ''}.`,
      action: 'transfers',
      priority: 3,
    });
  }

  // Incoming offers
  if (incomingOffers > 0) {
    tips.push({
      icon: 'DollarSign',
      text: `You have ${incomingOffers} incoming offer${incomingOffers > 1 ? 's' : ''} to respond to.`,
      action: 'transfers',
      priority: 7,
    });
  }

  // Board confidence low
  if (boardConfidence < 40) {
    tips.push({
      icon: 'TrendingDown',
      text: 'Board confidence is low — prioritize winning matches.',
      priority: 5,
    });
  }

  // Expiring contracts
  if (week > 20) {
    const expiring = squadPlayers.filter(p => p.contractEnd <= season);
    if (expiring.length > 0) {
      tips.push({
        icon: 'FileText',
        text: `${expiring.length} contract${expiring.length > 1 ? 's' : ''} expiring at season end — renew or sell.`,
        action: 'squad',
        priority: 4,
      });
    }
  }

  // Low tactical familiarity
  if (tacticalFamiliarity < 40) {
    tips.push({
      icon: 'Zap',
      text: 'Tactical familiarity is low — train "Tactical" to improve match performance.',
      action: 'training',
      priority: 3,
    });
  }

  // Sort by priority descending, return top 3
  return tips.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
