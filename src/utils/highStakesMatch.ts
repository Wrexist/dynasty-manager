/**
 * High-stakes match classifier (G3).
 *
 * Decides whether a fixture warrants a pre-kickoff team talk. Kept as a pure
 * function of already-computed context so MatchDay stays logic-free and the
 * rule is unit-testable. Thresholds live in `config/teamTalk.ts`.
 *
 * A match is high-stakes when ANY of:
 *   - derby: the two clubs are listed rivals (`getDerbyIntensity` > 0);
 *   - knockout: a domestic-cup / league-cup / super-cup / continental
 *     knockout tie (single-elimination pressure);
 *   - six-pointer: a league match where BOTH clubs sit in the top N (title
 *     race) or BOTH in the bottom N (relegation battle) of the table.
 */
import { DERBY_INTENSITY_MIN, SIX_POINTER_TOP_N, SIX_POINTER_BOTTOM_N } from '@/config/teamTalk';

export type HighStakesReason = 'derby' | 'knockout' | 'six-pointer';

export interface HighStakesResult {
  highStakes: boolean;
  reason: HighStakesReason | null;
}

export interface HighStakesParams {
  derbyIntensity: number;
  isKnockout: boolean;
  isLeagueMatch: boolean;
  homeClubId: string;
  awayClubId: string;
  /** League standings (ordered best→worst); only entries' clubIds are read. */
  leagueTable: { clubId: string }[];
}

export function evaluateHighStakes(params: HighStakesParams): HighStakesResult {
  const { derbyIntensity, isKnockout, isLeagueMatch, homeClubId, awayClubId, leagueTable } = params;

  if (derbyIntensity >= DERBY_INTENSITY_MIN) return { highStakes: true, reason: 'derby' };
  if (isKnockout) return { highStakes: true, reason: 'knockout' };

  if (isLeagueMatch && leagueTable.length > 0) {
    const homeIdx = leagueTable.findIndex(e => e.clubId === homeClubId);
    const awayIdx = leagueTable.findIndex(e => e.clubId === awayClubId);
    if (homeIdx >= 0 && awayIdx >= 0) {
      const n = leagueTable.length;
      const bothTop = homeIdx < SIX_POINTER_TOP_N && awayIdx < SIX_POINTER_TOP_N;
      const bothBottom =
        homeIdx >= n - SIX_POINTER_BOTTOM_N && awayIdx >= n - SIX_POINTER_BOTTOM_N;
      if (bothTop || bothBottom) return { highStakes: true, reason: 'six-pointer' };
    }
  }

  return { highStakes: false, reason: null };
}

/** Short player-facing label for the high-stakes banner. */
export function highStakesLabel(reason: HighStakesReason | null): string {
  switch (reason) {
    case 'derby':
      return 'Derby Day';
    case 'knockout':
      return 'Knockout Tie';
    case 'six-pointer':
      return 'Six-Pointer';
    default:
      return '';
  }
}
