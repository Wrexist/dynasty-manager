import { Player, Club, LeagueTableEntry, BallonDOrEntry, ContinentalTournamentState } from '@/types/game';
import {
  BALLON_DOR_TOP_N, BALLON_DOR_MIN_APPEARANCES, BALLON_DOR_WEIGHTS,
  BALLON_DOR_VALUE_BOOST,
  BALLON_DOR_POSITION_MULTIPLIERS, BALLON_DOR_YELLOW_PENALTY,
  BALLON_DOR_RED_PENALTY, BALLON_DOR_DIVISION_BONUS,
  BALLON_DOR_DIVISION_COUNTING_SCALE,
  BALLON_DOR_CONTINENTAL_BONUS,
} from '@/config/gameBalance';
import { LEAGUES } from '@/data/league';

const DEFAULT_POSITION_MULTIPLIER = { goals: 1.0, assists: 1.5, cleanSheets: 0 };

/** Compute a player's average match rating, falling back to an estimate from overall. */
function getAvgRating(player: Player): number {
  if (player.seasonRatedMatches && player.seasonRatedMatches > 0) {
    return (player.seasonRatingTotal || 0) / player.seasonRatedMatches;
  }
  // Unrated players: estimate slightly below average based on overall
  return 4.5 + (player.overall / 100) * 2.0;
}

/**
 * Determine a club's deepest continental round and return the corresponding bonus.
 */
function getContinentalBonusForClub(
  clubId: string,
  championsCup: ContinentalTournamentState | null,
  shieldCup: ContinentalTournamentState | null,
  conferenceCup?: ContinentalTournamentState | null,
): number {
  let bonus = 0;

  for (const [tournament, config] of [
    [championsCup, BALLON_DOR_CONTINENTAL_BONUS.champions_cup] as const,
    [shieldCup, BALLON_DOR_CONTINENTAL_BONUS.shield_cup] as const,
    [conferenceCup || null, BALLON_DOR_CONTINENTAL_BONUS.conference_cup] as const,
  ]) {
    if (!tournament) continue;

    // Check if club won
    if (tournament.winnerId === clubId) {
      bonus = Math.max(bonus, config.winner);
      continue;
    }

    // Check knockout rounds (deepest first)
    const knockoutRounds: ('F' | 'SF' | 'QF' | 'R16')[] = ['F', 'SF', 'QF', 'R16'];
    let found = false;
    for (const round of knockoutRounds) {
      const tie = tournament.knockoutTies.find(t => t.round === round && (t.homeClubId === clubId || t.awayClubId === clubId));
      if (tie) {
        bonus = Math.max(bonus, config[round]);
        found = true;
        break;
      }
    }
    if (found) continue;

    // Group stage participation
    const group = tournament.groups.find(g => g.clubIds.includes(clubId));
    if (group) {
      bonus = Math.max(bonus, config.group);
    }
  }

  return bonus;
}

/**
 * Calculate a player's Ballon d'Or score based on season performance.
 * Position-aware formula considers goals, assists, overall rating, average
 * match rating, appearances, form, team finishing position, clean sheets,
 * discipline, division tier, and continental tournament performance.
 */
function calculatePlayerScore(
  player: Player,
  teamPosition: number,
  totalTeams: number,
  teamCleanSheets: number,
  divisionTier: number,
  continentalBonus: number,
): number {
  const w = BALLON_DOR_WEIGHTS;
  const pm = BALLON_DOR_POSITION_MULTIPLIERS[player.position] || DEFAULT_POSITION_MULTIPLIER;

  // Counting-stat scale by division tier. Goals/assists/clean sheets in
  // lower tiers count progressively less — a 30-goal Foundation League
  // striker shouldn't outrank a 25-goal Premier League elite. Avg rating
  // uses a softer sqrt of the same scale because it's already context-aware
  // (match sim accounts for opponent strength).
  const countingScale = BALLON_DOR_DIVISION_COUNTING_SCALE[divisionTier] ?? 0.25;
  const ratingScale = Math.sqrt(countingScale);

  // Base score from overall rating (0-100 scale)
  const overallScore = player.overall * w.overall;

  // Position-scaled and division-scaled goal/assist contributions
  const goalScore = player.goals * w.goals * pm.goals * countingScale;
  const assistScore = player.assists * w.assists * pm.assists * countingScale;

  // Appearance bonus — rewards consistent availability
  const appScore = Math.min(player.appearances, 46) * w.appearances;

  // Form bonus (0-100 scale → 0-20 range)
  const formScore = (player.form / 100) * 20 * w.form;

  // Team position bonus — sqrt curve flattens top-team advantage
  const positionNorm = (totalTeams - teamPosition) / Math.max(1, totalTeams - 1);
  const positionBonus = Math.sqrt(Math.max(0, positionNorm)) * 30 * w.teamPosition;

  // Position-scaled and division-scaled clean sheet bonus
  const cleanSheetScore = teamCleanSheets * w.cleanSheets * pm.cleanSheets * countingScale;

  // Average match rating (0-10 scale, scaled up for meaningful impact).
  // Softer division scale (sqrt) — match sim already accounts for opponent
  // strength so we don't double-penalise lower-tier ratings.
  const ratingScore = getAvgRating(player) * 10 * w.avgRating * ratingScale;

  // Discipline penalty — yellow and red cards hurt ranking
  const disciplineScore = -(player.yellowCards * BALLON_DOR_YELLOW_PENALTY + player.redCards * BALLON_DOR_RED_PENALTY) * w.discipline;

  // Division tier bonus — higher divisions rewarded (additive, on top of
  // the counting-stat scale)
  const divisionScore = (BALLON_DOR_DIVISION_BONUS[divisionTier] ?? 0) * w.divisionTier;

  // Continental tournament bonus — deep runs in Champions Cup / Shield Cup
  const continentalScore = continentalBonus * w.continentalBonus;

  return overallScore + goalScore + assistScore + appScore + formScore
    + positionBonus + cleanSheetScore + ratingScore + disciplineScore + divisionScore + continentalScore;
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
  championsCup?: ContinentalTournamentState | null,
  shieldCup?: ContinentalTournamentState | null,
  conferenceCup?: ContinentalTournamentState | null,
): BallonDOrEntry[] {
  // No ranking possible without league data or players
  if (leagueTable.length === 0 && Object.keys(divisionTables).length === 0) return [];
  if (allPlayers.length === 0) return [];

  const totalTeams = leagueTable.length || 20;

  // Build a lookup: clubId → league position, clean sheets, and division tier
  const clubPositionMap: Record<string, { position: number; totalTeams: number; cleanSheets: number; divisionTier: number }> = {};

  // Map division IDs to quality tiers
  const divisionTierMap: Record<string, number> = {};
  for (const league of LEAGUES) {
    divisionTierMap[league.id] = league.qualityTier;
  }

  for (let i = 0; i < leagueTable.length; i++) {
    const entry = leagueTable[i];
    const club = clubs[entry.clubId];
    clubPositionMap[entry.clubId] = {
      position: i + 1,
      totalTeams,
      cleanSheets: entry.cleanSheets || 0,
      divisionTier: club ? (divisionTierMap[club.divisionId] ?? 4) : 4,
    };
  }
  // Also include other division tables
  for (const [, table] of Object.entries(divisionTables)) {
    const divTotal = table.length || 20;
    for (let i = 0; i < table.length; i++) {
      const entry = table[i];
      if (!clubPositionMap[entry.clubId]) {
        const club = clubs[entry.clubId];
        clubPositionMap[entry.clubId] = {
          position: i + 1,
          totalTeams: divTotal,
          cleanSheets: entry.cleanSheets || 0,
          divisionTier: club ? (divisionTierMap[club.divisionId] ?? 4) : 4,
        };
      }
    }
  }

  // Score every player who made at least 5 appearances
  const scored = allPlayers
    .filter(p => p.appearances >= BALLON_DOR_MIN_APPEARANCES && p.clubId)
    .map(p => {
      const clubPos = clubPositionMap[p.clubId] || { position: 10, totalTeams: 20, cleanSheets: 0, divisionTier: 4 };
      const contBonus = getContinentalBonusForClub(p.clubId, championsCup || null, shieldCup || null, conferenceCup || null);
      const score = calculatePlayerScore(p, clubPos.position, clubPos.totalTeams, clubPos.cleanSheets, clubPos.divisionTier, contBonus);
      const club = clubs[p.clubId];
      const avgRating = Math.round(getAvgRating(p) * 10) / 10;
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
        avgRating,
      } as BallonDOrEntry;
    })
    .sort((a, b) => {
      // Primary: score descending
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreakers: goals → assists → appearances → overall
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return b.overall - a.overall;
    })
    .slice(0, BALLON_DOR_TOP_N);

  // Assign ranks
  scored.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return scored;
}
