import type { GameState } from '../storeTypes';
import { MAX_SUBSTITUTIONS } from '@/config/matchEngine';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createMatchSlice = (set: Set, get: Get) => ({
  currentMatchResult: null as GameState['currentMatchResult'],
  matchSubsUsed: 0,
  matchPlayerRatings: [] as GameState['matchPlayerRatings'],
  halfTimeState: null as GameState['halfTimeState'],
  matchPhase: 'none' as GameState['matchPhase'],
  preMatchLeaguePosition: 10,
  lastMatchXPGain: 0,
  currentCupTieId: null as GameState['currentCupTieId'],

  clearMatchResult: () => set({ currentMatchResult: null, halfTimeState: null, matchPhase: 'none', currentCupTieId: null }),

  makeMatchSub: (outId: string, inId: string) => {
    const state = get();
    if (state.matchSubsUsed >= MAX_SUBSTITUTIONS) return;
    const club = { ...state.clubs[state.playerClubId] };
    if (!club.lineup.includes(outId)) return;
    if (!club.subs.includes(inId)) return;
    club.lineup = club.lineup.map(id => id === outId ? inId : id);
    club.subs = [...club.subs.filter(id => id !== inId), outId];
    set({ clubs: { ...state.clubs, [club.id]: club }, matchSubsUsed: state.matchSubsUsed + 1 });
  },
});
