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
 * Cup slice — state-only for now. All cup advancement logic lives in
 * orchestrationSlice (advanceWeek / endSeason). A future refactor should
 * move cup actions here for proper separation of concerns.
 */
export const createCupSlice = (_set: Set, _get: Get) => ({
  cup: INITIAL_CUP as CupState,
});
