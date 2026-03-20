import { Player, Club, LeagueTableEntry, SeasonAward, Position } from '@/types/game';

export function calculateSeasonAwards(
  allPlayers: Player[],
  clubs: Record<string, Club>,
  leagueTable: LeagueTableEntry[],
  playerClubId: string,
): SeasonAward[] {
  const awards: SeasonAward[] = [];

  // Golden Boot (top scorer)
  const topScorer = allPlayers.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  if (topScorer) {
    awards.push({ name: 'Golden Boot', recipientName: `${topScorer.firstName} ${topScorer.lastName}`, recipientClub: clubs[topScorer.clubId]?.shortName || '', stat: topScorer.goals });
  }

  // Golden Glove (GK whose club conceded fewest goals)
  const bestGK = [...allPlayers].filter(p => p.position === 'GK').sort((a, b) => {
    return (leagueTable.find(e => e.clubId === a.clubId)?.goalsAgainst ?? 999) - (leagueTable.find(e => e.clubId === b.clubId)?.goalsAgainst ?? 999);
  })[0];
  if (bestGK) {
    awards.push({ name: 'Golden Glove', recipientName: `${bestGK.firstName} ${bestGK.lastName}`, recipientClub: clubs[bestGK.clubId]?.shortName || '', stat: leagueTable.find(e => e.clubId === bestGK.clubId)?.goalsAgainst ?? 0 });
  }

  // Playmaker of the Season (top assists)
  const topAssister = allPlayers.filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists)[0];
  if (topAssister) {
    awards.push({ name: 'Playmaker of the Season', recipientName: `${topAssister.firstName} ${topAssister.lastName}`, recipientClub: clubs[topAssister.clubId]?.shortName || '', stat: topAssister.assists });
  }

  // Young Player of the Season (U23, highest overall)
  const youngStar = allPlayers.filter(p => p.age <= 23).sort((a, b) => b.overall - a.overall)[0];
  if (youngStar) {
    awards.push({ name: 'Young Player of the Season', recipientName: `${youngStar.firstName} ${youngStar.lastName}`, recipientClub: clubs[youngStar.clubId]?.shortName || '', stat: youngStar.overall });
  }

  // Manager of the Season (most overperformed vs expected position)
  let bestOverperf = -Infinity;
  let bestMgrClubId = '';
  for (const entry of leagueTable) {
    const c = clubs[entry.clubId];
    if (!c) continue;
    const exp = c.reputation >= 5 ? 3 : c.reputation >= 4 ? 8 : c.reputation >= 3 ? 12 : 17;
    const overperf = exp - (leagueTable.indexOf(entry) + 1);
    if (overperf > bestOverperf) { bestOverperf = overperf; bestMgrClubId = entry.clubId; }
  }
  if (bestMgrClubId) {
    const mClub = clubs[bestMgrClubId];
    awards.push({ name: 'Manager of the Season', recipientName: bestMgrClubId === playerClubId ? 'You' : `${mClub.shortName} Manager`, recipientClub: mClub.shortName });
  }

  // Team of the Season (Best XI by positional group)
  const posGroups: { positions: Position[]; count: number }[] = [
    { positions: ['GK'], count: 1 },
    { positions: ['CB', 'LB', 'RB'], count: 4 },
    { positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'], count: 3 },
    { positions: ['LW', 'RW', 'ST'], count: 3 },
  ];
  for (const group of posGroups) {
    const candidates = allPlayers
      .filter(p => group.positions.includes(p.position))
      .sort((a, b) => (b.overall + b.goals * 2 + b.assists) - (a.overall + a.goals * 2 + a.assists));
    for (let i = 0; i < Math.min(group.count, candidates.length); i++) {
      const p = candidates[i];
      awards.push({ name: 'Team of the Season', recipientName: `${p.firstName} ${p.lastName}`, recipientClub: clubs[p.clubId]?.shortName || '', stat: p.overall });
    }
  }

  return awards;
}
