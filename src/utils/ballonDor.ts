import { Player, Club, LeagueTableEntry, BallonDOrEntry } from '@/types/game';
import { BALLON_DOR_TOP_N, BALLON_DOR_WEIGHTS, BALLON_DOR_VALUE_BOOST } from '@/config/gameBalance';

/**
 * Calculate a player's Ballon d'Or score based on season performance.
 * Weighted formula considers goals, assists, overall rating, appearances,
 * form, and the finishing position of their team.
 */
function calculatePlayerScore(
  player: Player,
  teamPosition: number,
  totalTeams: number,
  teamCleanSheets: number,
): number {
  const w = BALLON_DOR_WEIGHTS;

  // Base score from overall rating (0-100 scale)
  const overallScore = player.overall * w.overall;

  // Goal contributions (attackers dominate here)
  const goalScore = player.goals * w.goals;
  const assistScore = player.assists * w.assists;

  // Appearance bonus — rewards consistent availability
  const appScore = Math.min(player.appearances, 46) * w.appearances;

  // Form bonus (0-100 scale)
  const formScore = (player.form / 100) * 20 * w.form;

  // Team position bonus — higher-finishing teams get more recognition
  // Normalized so 1st place gets full bonus, last place gets near zero
  const positionBonus = ((totalTeams - teamPosition) / Math.max(1, totalTeams - 1)) * 30 * w.teamPosition;

  // Clean sheet bonus for GKs and defenders (uses team clean sheets)
  const isDefensive = ['GK', 'CB', 'LB', 'RB'].includes(player.position);
  const cleanSheetScore = isDefensive ? teamCleanSheets * w.cleanSheets : 0;

  return overallScore + goalScore + assistScore + appScore + formScore + positionBonus + cleanSheetScore;
}

/**
 * Get the value boost multiplier for a given rank.
 * Uses the defined thresholds with linear interpolation.
 */
export function getBallonDOrValueBoost(rank: number): number {
  if (rank > BALLON_DOR_TOP_N) return 0;

  const thresholds = Object.entries(BALLON_DOR_VALUE_BOOST)
    .map(([k, v]) => ({ rank: Number(k), boost: v }))
    .sort((a, b) => a.rank - b.rank);

  // Exact match
  for (const t of thresholds) {
    if (rank === t.rank) return t.boost;
  }

  // Find surrounding thresholds and interpolate
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (rank > thresholds[i].rank && rank < thresholds[i + 1].rank) {
      const lower = thresholds[i];
      const upper = thresholds[i + 1];
      const t = (rank - lower.rank) / (upper.rank - lower.rank);
      return lower.boost + (upper.boost - lower.boost) * t;
    }
  }

  // Below lowest threshold
  if (rank < thresholds[0].rank) return thresholds[0].boost;
  // Above highest defined threshold but still in top 25
  return thresholds[thresholds.length - 1].boost;
}

/**
 * Calculate the Ballon d'Or top 25 for the season.
 * Returns the ranking entries and does NOT mutate any state.
 */
export function calculateBallonDOr(
  allPlayers: Player[],
  clubs: Record<string, Club>,
  leagueTable: LeagueTableEntry[],
  divisionTables: Record<string, LeagueTableEntry[]>,
): BallonDOrEntry[] {
  const totalTeams = leagueTable.length || 20;

  // Build a lookup: clubId → league position and clean sheets (across all divisions)
  const clubPositionMap: Record<string, { position: number; totalTeams: number; cleanSheets: number }> = {};
  for (const entry of leagueTable) {
    clubPositionMap[entry.clubId] = {
      position: leagueTable.indexOf(entry) + 1,
      totalTeams,
      cleanSheets: entry.cleanSheets || 0,
    };
  }
  // Also include other division tables
  for (const [, table] of Object.entries(divisionTables)) {
    const divTotal = table.length || 20;
    for (const entry of table) {
      if (!clubPositionMap[entry.clubId]) {
        clubPositionMap[entry.clubId] = {
          position: table.indexOf(entry) + 1,
          totalTeams: divTotal,
          cleanSheets: entry.cleanSheets || 0,
        };
      }
    }
  }

  // Score every player who made at least 5 appearances
  const scored = allPlayers
    .filter(p => p.appearances >= 5 && p.clubId)
    .map(p => {
      const clubPos = clubPositionMap[p.clubId] || { position: 10, totalTeams: 20, cleanSheets: 0 };
      const score = calculatePlayerScore(p, clubPos.position, clubPos.totalTeams, clubPos.cleanSheets);
      const club = clubs[p.clubId];
      return {
        playerId: p.id,
        playerName: `${p.firstName} ${p.lastName}`,
        clubName: club?.shortName || '',
        clubColor: club?.color || '#888',
        position: p.position,
        overall: p.overall,
        age: p.age,
        rank: 0,
        score: Math.round(score * 10) / 10,
        goals: p.goals,
        assists: p.assists,
        appearances: p.appearances,
      } as BallonDOrEntry;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, BALLON_DOR_TOP_N);

  // Assign ranks
  scored.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return scored;
}
