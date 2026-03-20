import type { GameState } from '../storeTypes';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createMatchSlice = (set: Set, get: Get) => ({
  currentMatchResult: null as GameState['currentMatchResult'],
  matchSubsUsed: 0,
  matchPlayerRatings: [] as GameState['matchPlayerRatings'],
  halfTimeState: null as GameState['halfTimeState'],
  matchPhase: 'none' as GameState['matchPhase'],

  clearMatchResult: () => set({ currentMatchResult: null, halfTimeState: null, matchPhase: 'none' }),

  makeMatchSub: (outId: string, inId: string) => {
    const state = get();
    if (state.matchSubsUsed >= 3) return;
    const club = { ...state.clubs[state.playerClubId] };
    club.lineup = club.lineup.map(id => id === outId ? inId : id);
    club.subs = club.subs.filter(id => id !== inId);
    set({ clubs: { ...state.clubs, [club.id]: club }, matchSubsUsed: state.matchSubsUsed + 1 });
  },
});
