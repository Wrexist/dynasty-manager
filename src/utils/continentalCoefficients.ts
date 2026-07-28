/**
 * Continental Coefficient System
 * Tracks club performance across seasons for tournament seeding.
 */
import type { ContinentalTournamentState, ContinentalCoefficient } from '@/types/game';
import {
  COEFF_GROUP_WIN, COEFF_GROUP_DRAW, COEFF_QUALIFY_KNOCKOUT,
  COEFF_R16_WIN, COEFF_QF_WIN, COEFF_SF_WIN, COEFF_FINAL_WIN,
  COEFF_SHIELD_MULTIPLIER, COEFF_CONFERENCE_MULTIPLIER,
  COEFF_SEASON_WINDOW, COEFF_SEASON_WEIGHTS,
  COEFF_SEEDING_BLEND,
  isPlaceholderClubId,
} from '@/config/continental';

/** Calculate coefficient points earned by a club in a single continental tournament */
export function calculateTournamentPoints(
  tournament: ContinentalTournamentState,
  clubId: string,
): number {
  let points = 0;
  const multiplier = tournament.competition === 'shield_cup' ? COEFF_SHIELD_MULTIPLIER
    : tournament.competition === 'conference_cup' ? COEFF_CONFERENCE_MULTIPLIER
    : 1;

  // Group stage points (wins + draws)
  for (const group of tournament.groups) {
    for (const match of group.matches) {
      if (!match.played) continue;
      const isHome = match.homeClubId === clubId;
      const isAway = match.awayClubId === clubId;
      if (!isHome && !isAway) continue;

      const clubGoals = isHome ? match.homeGoals : match.awayGoals;
      const oppGoals = isHome ? match.awayGoals : match.homeGoals;
      if (clubGoals > oppGoals) points += COEFF_GROUP_WIN;
      else if (clubGoals === oppGoals) points += COEFF_GROUP_DRAW;
    }
  }

  // Knockout stage points
  for (const tie of tournament.knockoutTies) {
    if (!tie.winnerId) continue;
    if (tie.winnerId !== clubId) continue;

    switch (tie.round) {
      case 'R16': points += COEFF_R16_WIN; break;
      case 'QF': points += COEFF_QF_WIN; break;
      case 'SF': points += COEFF_SF_WIN; break;
      case 'F': points += COEFF_FINAL_WIN; break;
    }
  }

  // Bonus for qualifying to knockouts
  const inKnockouts = tournament.knockoutTies.some(
    t => t.homeClubId === clubId || t.awayClubId === clubId
  );
  if (inKnockouts) points += COEFF_QUALIFY_KNOCKOUT;

  return Math.round(points * multiplier * 10) / 10;
}

/** Update coefficients after a continental tournament completes */
export function updateCoefficients(
  existing: Record<string, ContinentalCoefficient>,
  tournament: ContinentalTournamentState,
  season: number,
): Record<string, ContinentalCoefficient> {
  const updated = { ...existing };

  // Collect all club IDs from the tournament. Legacy `placeholder-*` filler
  // (fabricated when the qualification tables came up short of 32 — see
  // continentalDraw.ts) is excluded: it belongs to no league, so crediting it
  // with coefficient points both persists a dead id forever and, because
  // `leagueRanking` averages coefficients over a league's clubs, could not be
  // attributed to anything meaningful anyway.
  const clubIds = new Set<string>();
  for (const group of tournament.groups) {
    for (const clubId of group.clubIds) {
      if (isPlaceholderClubId(clubId)) continue;
      clubIds.add(clubId);
    }
  }

  for (const clubId of clubIds) {
    const seasonPts = calculateTournamentPoints(tournament, clubId);
    const prev = updated[clubId] || { clubId, points: 0, seasonPoints: {} };
    const newSeasonPoints = { ...prev.seasonPoints, [season]: (prev.seasonPoints[season] || 0) + seasonPts };

    // Recalculate weighted total across the season window
    const weightedTotal = Object.entries(newSeasonPoints)
      .filter(([s]) => Number(s) > season - COEFF_SEASON_WINDOW)
      .reduce((sum, [s, pts]) => {
        const age = season - Number(s);
        const weight = COEFF_SEASON_WEIGHTS[age] ?? 0;
        return sum + (pts as number) * weight;
      }, 0);

    updated[clubId] = { clubId, points: Math.round(weightedTotal * 10) / 10, seasonPoints: newSeasonPoints };
  }

  // Prune old season data beyond the window AND recompute the weighted total
  // for EVERY club (immutable — create new objects). Previously `points` was
  // only recomputed for this tournament's participants, so a club that
  // stopped qualifying kept its last high total frozen at its old weighting
  // forever — permanently inflating its league's coefficient ranking and
  // continental spot allocation.
  for (const [clubId, coeff] of Object.entries(updated)) {
    // Drop legacy fabricated filler carried in from an older save.
    if (isPlaceholderClubId(clubId)) {
      delete updated[clubId];
      continue;
    }
    const pruned: Record<number, number> = {};
    for (const [s, pts] of Object.entries(coeff.seasonPoints)) {
      if (Number(s) > season - COEFF_SEASON_WINDOW) pruned[Number(s)] = pts;
    }
    const weightedTotal = Object.entries(pruned).reduce((sum, [s, pts]) => {
      const age = season - Number(s);
      const weight = COEFF_SEASON_WEIGHTS[age] ?? 0;
      return sum + (pts as number) * weight;
    }, 0);
    updated[clubId] = { ...coeff, points: Math.round(weightedTotal * 10) / 10, seasonPoints: pruned };
  }

  return updated;
}

/** Get a seeding score that blends coefficient and reputation */
export function getSeedingScore(
  clubId: string,
  reputation: number,
  coefficients: Record<string, ContinentalCoefficient>,
): number {
  const coeff = coefficients[clubId]?.points || 0;
  // Normalize coefficient to a 0-10 scale (max realistic ~40 points over 5 seasons)
  const normalizedCoeff = Math.min(10, coeff / 4);
  return reputation * (1 - COEFF_SEEDING_BLEND) + normalizedCoeff * COEFF_SEEDING_BLEND;
}
