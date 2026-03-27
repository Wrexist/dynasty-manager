import type { CupState, LeagueCupState, ContinentalTournamentState, ContinentalCompetition, VirtualClub, SuperCupMatch } from '@/types/game';
import type { GameState } from '../storeTypes';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

const INITIAL_CUP: CupState = {
  ties: [],
  currentRound: null,
  eliminated: false,
  winner: null,
};

const INITIAL_LEAGUE_CUP: LeagueCupState = {
  ties: [],
  currentRound: null,
  eliminated: false,
  winner: null,
};

/**
 * Cup slice — state-only. Cup advancement logic (simulate cup ties, advance
 * rounds, determine winner) is handled inside orchestrationSlice.advanceWeek()
 * because it is tightly coupled with the weekly game loop (e.g., AI match
 * events, player injuries, messages). Cup draw generation happens in
 * orchestrationSlice.initGame() and endSeason() via the @/data/cup utility.
 *
 * This slice provides the initial cup state and any cup-specific queries.
 * Also provides initial state for League Cup, Continental tournaments, and Super Cups.
 */
export const createCupSlice = (_set: Set, _get: Get) => ({
  cup: INITIAL_CUP as CupState,

  // League Cup (secondary domestic cup)
  leagueCup: INITIAL_LEAGUE_CUP as LeagueCupState,

  // Continental tournaments
  championsCup: null as ContinentalTournamentState | null,
  shieldCup: null as ContinentalTournamentState | null,
  virtualClubs: {} as Record<string, VirtualClub>,
  continentalQualification: null as { champions: string[]; shield: string[] } | null,

  // Super Cups
  domesticSuperCup: null as SuperCupMatch | null,
  continentalSuperCup: null as SuperCupMatch | null,

  // Current match tracking for interactive play
  currentContinentalMatchId: null as string | null,
  currentContinentalCompetition: null as ContinentalCompetition | null,
  currentLeagueCupTieId: null as string | null,
});
