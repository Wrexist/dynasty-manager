import type { CupState } from '@/types/game';
import type { GameState } from '../storeTypes';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

const INITIAL_CUP: CupState = {
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
 */
export const createCupSlice = (_set: Set, _get: Get) => ({
  cup: INITIAL_CUP as CupState,
});
