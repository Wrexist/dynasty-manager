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

export const createCupSlice = (_set: Set, _get: Get) => ({
  cup: INITIAL_CUP as CupState,
});
