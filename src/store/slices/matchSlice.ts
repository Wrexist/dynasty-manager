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
    const inPlayer = state.players[inId];
    if (!inPlayer) return;
    if (inPlayer.injured) return;
    if (inPlayer.suspendedUntilWeek != null && inPlayer.suspendedUntilWeek > state.week) return;
    club.lineup = [...club.lineup.map(id => id === outId ? inId : id)];
    club.subs = [...club.subs.filter(id => id !== inId), outId];
    const updates: Partial<GameState> = { clubs: { ...state.clubs, [club.id]: club }, matchSubsUsed: state.matchSubsUsed + 1 };
    if (state.currentMatchResult) {
      const outPlayer = state.players[outId];
      updates.currentMatchResult = {
        ...state.currentMatchResult,
        events: [...state.currentMatchResult.events, {
          minute: 0,
          type: 'substitution' as const,
          playerId: inId,
          assistPlayerId: outId,
          clubId: state.playerClubId,
          description: `${inPlayer.name} replaces ${outPlayer?.name || 'Unknown'}`,
        }],
      };
    }
    set(updates);
  },
});
