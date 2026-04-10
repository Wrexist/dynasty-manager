/**
 * League Ranking System — determines continental qualification spots per league.
 *
 * Leagues are ranked 1-30 based on a blend of:
 *  - Quality tier (initial baseline)
 *  - Average club reputation (within-tier differentiation)
 *  - Continental coefficient (evolves over seasons)
 *
 * The ranking drives how many Champions Cup, Shield Cup, and Conference Cup
 * spots each league receives — mirroring real UEFA coefficient rankings.
 */
import type { QualificationZones, ContinentalCoefficient, LeagueInfo } from '@/types/game';
import { ALL_LEAGUES, CLUBS_BY_LEAGUE } from '@/data/leagues';
import {
  CHAMPIONS_CUP_SPOTS_BY_RANK,
  SHIELD_CUP_SPOTS_BY_RANK,
  CONFERENCE_CUP_SPOTS_BY_RANK,
} from '@/config/continental';

export interface RankedLeague {
  leagueId: string;
  rank: number;
  score: number;
  championsCupSpots: number;
  shieldCupSpots: number;
  conferenceCupSpots: number;
}

/**
 * Compute a ranking score for a league. Higher = better ranked.
 *
 * Base score comes from quality tier (tier 1 = 400, tier 2 = 300, tier 3 = 200, tier 4 = 100).
 * Within-tier differentiation uses average club reputation (0-10 scale, adds up to 50 pts).
 * Continental coefficient average (across all clubs in competition) adds up to 50 pts.
 */
function computeLeagueScore(
  league: LeagueInfo,
  coefficients?: Record<string, ContinentalCoefficient>,
): number {
  const tierBase = (5 - league.qualityTier) * 100; // T1=400, T2=300, T3=200, T4=100

  const clubs = CLUBS_BY_LEAGUE[league.id] || [];
  const avgRep = clubs.length > 0
    ? clubs.reduce((sum, c) => sum + c.reputation, 0) / clubs.length
    : 0;
  const repScore = avgRep * 5; // 0-50 range (reputation is 1-10)

  // Coefficient bonus: average coefficient points across clubs that participated
  let coeffScore = 0;
  if (coefficients) {
    const clubCoeffs = clubs
      .map(c => coefficients[c.id]?.points || 0)
      .filter(p => p > 0);
    if (clubCoeffs.length > 0) {
      const avgCoeff = clubCoeffs.reduce((s, p) => s + p, 0) / clubCoeffs.length;
      coeffScore = Math.min(50, avgCoeff * 2.5); // cap at 50
    }
  }

  return tierBase + repScore + coeffScore;
}

/**
 * Rank all 30 leagues from 1-30 and assign qualification spots per competition.
 */
export function getLeagueRankings(
  coefficients?: Record<string, ContinentalCoefficient>,
): RankedLeague[] {
  const scored = ALL_LEAGUES.map(league => ({
    leagueId: league.id,
    score: computeLeagueScore(league, coefficients),
  }));

  // Sort by score descending, with alphabetical league ID as tiebreaker for determinism
  scored.sort((a, b) => b.score - a.score || a.leagueId.localeCompare(b.leagueId));

  return scored.map((entry, i) => {
    const rank = i + 1;
    return {
      leagueId: entry.leagueId,
      rank,
      score: entry.score,
      championsCupSpots: CHAMPIONS_CUP_SPOTS_BY_RANK[rank] || 0,
      shieldCupSpots: SHIELD_CUP_SPOTS_BY_RANK[rank] || 0,
      conferenceCupSpots: CONFERENCE_CUP_SPOTS_BY_RANK[rank] || 0,
    };
  });
}

/**
 * Get the ranked entry for a specific league.
 */
export function getLeagueRank(
  leagueId: string,
  coefficients?: Record<string, ContinentalCoefficient>,
): RankedLeague | undefined {
  return getLeagueRankings(coefficients).find(r => r.leagueId === leagueId);
}

/**
 * Compute qualification zones for a given league, suitable for league table display.
 *
 * Returns which positions qualify for Champions Cup, Shield Cup, Conference Cup,
 * and which are in the replaced (relegated) zone.
 *
 * Example for England (rank 1): { championsCup: [1,2,3,4], shieldCup: [5,6], conferenceCup: [7], replaced: [18,19,20] }
 * Example for Romania (rank ~23): { championsCup: [], shieldCup: [], conferenceCup: [1], replaced: [15,16] }
 */
export function getQualificationZones(
  leagueId: string,
  rankings?: RankedLeague[],
  coefficients?: Record<string, ContinentalCoefficient>,
): QualificationZones {
  const allRankings = rankings || getLeagueRankings(coefficients);
  const entry = allRankings.find(r => r.leagueId === leagueId);
  const league = ALL_LEAGUES.find(l => l.id === leagueId);

  if (!entry || !league) {
    return { championsCup: [], shieldCup: [], conferenceCup: [], replaced: [] };
  }

  const teamCount = league.teamCount;
  const clSpots = entry.championsCupSpots;
  const slSpots = entry.shieldCupSpots;
  const ccSpots = entry.conferenceCupSpots;

  // Positions are 1-indexed
  const championsCup: number[] = [];
  const shieldCup: number[] = [];
  const conferenceCup: number[] = [];

  // Don't let qualification zones extend into the replaced zone
  const safeMax = teamCount - (league.replacedSlots || 0);
  let pos = 1;

  // Champions Cup positions (top of table)
  for (let i = 0; i < clSpots && pos <= safeMax; i++) {
    championsCup.push(pos++);
  }

  // Shield Cup positions (next after CL)
  for (let i = 0; i < slSpots && pos <= safeMax; i++) {
    shieldCup.push(pos++);
  }

  // Conference Cup positions (next after Shield)
  for (let i = 0; i < ccSpots && pos <= safeMax; i++) {
    conferenceCup.push(pos++);
  }

  // Replaced zone (bottom of table)
  const replaced: number[] = [];
  if (league.replacedSlots > 0) {
    for (let i = 0; i < league.replacedSlots; i++) {
      replaced.push(teamCount - i);
    }
    replaced.sort((a, b) => a - b);
  }

  return { championsCup, shieldCup, conferenceCup, replaced };
}
