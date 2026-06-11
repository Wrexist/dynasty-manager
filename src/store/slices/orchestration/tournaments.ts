/**
 * Pure tournament helpers extracted from orchestrationSlice.ts.
 *
 * These are domestic-cup and continental-knockout utilities that can be
 * computed without reaching back into the Zustand store. The slice still
 * owns the broader processTournamentResult flow because it touches state.
 */
import type {
  CupRound,
  CupTie,
  LeagueCupState,
  ContinentalTournamentState,
} from '@/types/game';
import type { GameState } from '../../storeTypes';
import { CUP_BYE_MARKER } from '@/data/cup';
import { getCompetitionCalendar } from '@/config/continental';
import { shuffle, safeRandomUUID } from '@/utils/helpers';
import { findPlayerContinentalMatch } from '@/utils/continental';

/**
 * Generate a League Cup (secondary domestic cup) draw.
 * Same structure as the main cup but scheduled on different weeks.
 */
export function generateLeagueCupDraw(clubIds: string[], totalWeeks?: number): LeagueCupState {
  const ties: CupTie[] = [];
  const shuffled = shuffle([...clubIds]);
  const leagueCupWeeks = getCompetitionCalendar(totalWeeks).leagueCupWeeks;

  let startRound: CupRound = 'R1';
  if (shuffled.length <= 8) startRound = 'R3';
  else if (shuffled.length <= 16) startRound = 'R2';

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    ties.push({
      id: safeRandomUUID(),
      round: startRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: leagueCupWeeks[startRound],
    });
  }

  if (shuffled.length % 2 === 1) {
    ties.push({
      id: safeRandomUUID(),
      round: startRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: CUP_BYE_MARKER,
      played: true,
      homeGoals: 1,
      awayGoals: 0,
      week: leagueCupWeeks[startRound],
    });
  }

  return { ties, currentRound: startRound, eliminated: false, winner: null };
}

/**
 * Build a descriptive label for a continental match (e.g. "Champions Cup — Group A MD3").
 */
export function getContinentalMatchLabel(
  compName: string,
  matchInfo: { type: 'group'; groupIdx: number; matchIdx: number } | { type: 'knockout'; tieIdx: number; leg: 1 | 2 },
  tourney: ContinentalTournamentState,
): string {
  if (matchInfo.type === 'group') {
    return `${compName} — Group ${String.fromCharCode(65 + matchInfo.groupIdx)} MD${matchInfo.matchIdx + 1}`;
  }
  const tie = tourney.knockoutTies[matchInfo.tieIdx];
  const roundNames: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Final', SF: 'Semi-Final', F: 'Final' };
  const roundLabel = roundNames[tie.round] || tie.round;
  if (tie.round === 'F') return `${compName} — ${roundLabel}`;
  return `${compName} — ${roundLabel} Leg ${matchInfo.leg}`;
}

/**
 * Check if a continental knockout leg 2 aggregate is already decided (not tied).
 * Returns true if the aggregate is NOT tied (i.e., extra time is NOT needed).
 * For non-knockout, non-leg-2, or missing data, returns false (allow normal extra time logic).
 */
export function isAggregateDecided(state: GameState, leg2HomeGoals: number, leg2AwayGoals: number): boolean {
  if (!state.currentContinentalMatchId || !state.currentContinentalCompetition) return false;
  const tourney = state.currentContinentalCompetition === 'champions_cup' ? state.championsCup : state.currentContinentalCompetition === 'shield_cup' ? state.shieldCup : state.conferenceCup;
  if (!tourney) return false;
  const matchInfo = findPlayerContinentalMatch(tourney, state.week, state.playerClubId);
  if (!matchInfo || matchInfo.type !== 'knockout' || matchInfo.leg !== 2) return false;
  const tie = tourney.knockoutTies[matchInfo.tieIdx];
  // Aggregate: tie.homeClubId's total = leg1Home + leg2Away, tie.awayClubId's total = leg1Away + leg2Home
  // In leg 2, home/away are swapped from the tie's perspective
  const homeAgg = tie.leg1HomeGoals + leg2AwayGoals;
  const awayAgg = tie.leg1AwayGoals + leg2HomeGoals;
  return homeAgg !== awayAgg;
}

/**
 * A drawn cup-flagged match where the draw STANDS (no extra time):
 * continental group matches, and knockout leg 1 of a two-leg tie (the
 * aggregate is decided after leg 2). Mirrors the instant-sim exemptions in
 * playCurrentMatchImpl for the interactive match path.
 */
export function isContinentalDrawValid(state: GameState): boolean {
  if (!state.currentContinentalMatchId || !state.currentContinentalCompetition) return false;
  const tourney = state.currentContinentalCompetition === 'champions_cup' ? state.championsCup : state.currentContinentalCompetition === 'shield_cup' ? state.shieldCup : state.conferenceCup;
  if (!tourney) return false;
  const matchInfo = findPlayerContinentalMatch(tourney, state.week, state.playerClubId);
  if (!matchInfo) return false;
  if (matchInfo.type === 'group') return true;
  if (matchInfo.leg === 1 && tourney.knockoutTies[matchInfo.tieIdx]?.round !== 'F') return true;
  return false;
}

/**
 * Advance the League Cup to the next round (mirrors advanceCupRound but on the League Cup week slots).
 */
export function advanceLeagueCupRound(cup: LeagueCupState, totalWeeks?: number): LeagueCupState {
  const ROUND_ORDER: CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];
  const leagueCupWeeks = getCompetitionCalendar(totalWeeks).leagueCupWeeks;
  const currentRound = cup.currentRound;
  if (!currentRound || currentRound === 'F') return cup;

  const roundIdx = ROUND_ORDER.indexOf(currentRound);
  const nextRound = ROUND_ORDER[roundIdx + 1];
  if (!nextRound) return cup;

  const currentTies = cup.ties.filter(t => t.round === currentRound && t.played);
  const winners = currentTies.map(t => {
    if (t.awayClubId === CUP_BYE_MARKER) return t.homeClubId;
    if (t.winnerId) return t.winnerId;
    return t.homeGoals > t.awayGoals ? t.homeClubId :
      t.awayGoals > t.homeGoals ? t.awayClubId :
      Math.random() < 0.5 ? t.homeClubId : t.awayClubId;
  });

  const shuffled = shuffle([...winners]);
  const newTies: CupTie[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    newTies.push({
      id: safeRandomUUID(),
      round: nextRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: leagueCupWeeks[nextRound],
    });
  }
  if (shuffled.length % 2 === 1) {
    newTies.push({
      id: safeRandomUUID(),
      round: nextRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: CUP_BYE_MARKER,
      played: true,
      homeGoals: 1,
      awayGoals: 0,
      week: leagueCupWeeks[nextRound],
    });
  }

  return { ...cup, ties: [...cup.ties, ...newTies], currentRound: nextRound };
}
