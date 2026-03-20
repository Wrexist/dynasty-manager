import { Player, Match, Club, FacilitiesState, ScoutingState } from '@/types/game';

export interface PreviewItem {
  icon: string;
  text: string;
  type: 'positive' | 'neutral' | 'warning';
}

interface PreviewContext {
  playerClubId: string;
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  fixtures: Match[];
  facilities: FacilitiesState;
  scouting: ScoutingState;
  week: number;
  season: number;
}

/** Generate "Next Week Preview" teaser items from current state */
export function getWeekPreview(ctx: PreviewContext): PreviewItem[] {
  const items: PreviewItem[] = [];
  const club = ctx.clubs[ctx.playerClubId];
  if (!club) return items;

  // Injury returns (players returning in 1 week)
  const returningPlayers = club.playerIds
    .map(id => ctx.players[id])
    .filter(p => p && p.injured && p.injuryWeeks === 1);
  for (const p of returningPlayers) {
    items.push({ icon: '🏥', text: `${p.lastName} returns from injury next week!`, type: 'positive' });
  }

  // Suspensions ending
  const unsuspended = club.playerIds
    .map(id => ctx.players[id])
    .filter(p => p && p.suspendedUntilWeek === ctx.week + 1);
  for (const p of unsuspended) {
    items.push({ icon: '✅', text: `${p.lastName}'s suspension ends next week`, type: 'positive' });
  }

  // Facility upgrade completing soon
  if (ctx.facilities.upgradeInProgress && ctx.facilities.upgradeInProgress.weeksRemaining <= 2) {
    const remaining = ctx.facilities.upgradeInProgress.weeksRemaining;
    items.push({
      icon: '🏗️',
      text: `${ctx.facilities.upgradeInProgress.type} upgrade completes in ${remaining} week${remaining > 1 ? 's' : ''}!`,
      type: 'positive',
    });
  }

  // Scouting report arriving
  const completingScouts = ctx.scouting.assignments.filter(a => a.weeksRemaining <= 1);
  if (completingScouts.length > 0) {
    items.push({
      icon: '🔍',
      text: `Scout report arriving from ${completingScouts[0].region}`,
      type: 'positive',
    });
  }

  // Upcoming opponent preview
  const nextMatch = ctx.fixtures.find(
    m => !m.played && m.week === ctx.week + 1 &&
      (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  );
  if (nextMatch) {
    const isHome = nextMatch.homeClubId === ctx.playerClubId;
    const oppId = isHome ? nextMatch.awayClubId : nextMatch.homeClubId;
    const opp = ctx.clubs[oppId];
    if (opp) {
      items.push({
        icon: isHome ? '🏠' : '✈️',
        text: `${isHome ? 'Home' : 'Away'} vs ${opp.shortName} next week`,
        type: 'neutral',
      });
    }
  }

  // Contracts expiring warning
  const expiringContracts = club.playerIds
    .map(id => ctx.players[id])
    .filter(p => p && p.contractEnd <= ctx.season && p.overall >= 65);
  if (expiringContracts.length > 0 && ctx.week >= 20) {
    items.push({
      icon: '📋',
      text: `${expiringContracts.length} contract${expiringContracts.length > 1 ? 's' : ''} expiring — act soon!`,
      type: 'warning',
    });
  }

  return items.slice(0, 3); // Max 3 preview items
}
