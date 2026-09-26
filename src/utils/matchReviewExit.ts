import type { Match } from '@/types/game';
import type { GameState } from '@/store/storeTypes';
import { findTournamentMatch } from '@/store/slices/orchestration/helpers';

/**
 * What Match Review's primary button does — and therefore what it says.
 *
 *   - `dashboard`  — reviewing a past week's match: leave, never advance.
 *   - `next-match` — the player's club has another unplayed match THIS week
 *                    (a friendly sharing a pre-season week, a cup tie): return
 *                    to the Dashboard without advancing.
 *   - `advance`    — nothing left to play this week: advance the week.
 *
 * Review has two exits. Back / swipe / hardware back always leave WITHOUT
 * advancing (store `goBack`); only this button can advance, and when it does
 * its label says so. Label and handler both read this one function — they
 * used to compute "another match this week" separately (the label counted
 * friendlies, the handler did not), so a label promising "Next Match This
 * Week" could advance past an unplayed friendly.
 */
export type MatchReviewExit = 'dashboard' | 'next-match' | 'advance';

type ExitState = Pick<GameState,
  'week' | 'playerClubId' | 'fixtures' | 'friendlies' | 'cup' | 'leagueCup' |
  'championsCup' | 'shieldCup' | 'conferenceCup' | 'domesticSuperCup' | 'continentalSuperCup'>;

export function resolveMatchReviewExit(s: ExitState, match: Pick<Match, 'id' | 'week'>): MatchReviewExit {
  if (match.week !== s.week) return 'dashboard';
  const pid = s.playerClubId;
  const anotherOfMine = (m: Match) =>
    m.week === s.week && !m.played && m.id !== match.id &&
    (m.homeClubId === pid || m.awayClubId === pid);
  if (s.friendlies?.some(anotherOfMine)) return 'next-match';
  if (s.fixtures.some(anotherOfMine)) return 'next-match';
  if (findTournamentMatch(s)) return 'next-match';
  return 'advance';
}
