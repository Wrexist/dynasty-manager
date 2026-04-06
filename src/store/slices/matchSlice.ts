import type { GameState } from '../storeTypes';
import type { TeamTalkType, PenaltyKick } from '@/types/game';
import { MAX_SUBSTITUTIONS } from '@/config/matchEngine';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createMatchSlice = (set: Set, get: Get) => ({
  currentMatchResult: null as GameState['currentMatchResult'],
  matchSubsUsed: 0,
  matchPlayerRatings: [] as GameState['matchPlayerRatings'],
  halfTimeState: null as GameState['halfTimeState'],
  matchPhase: 'none' as GameState['matchPhase'],
  matchTeamTalk: 'none' as TeamTalkType,
  preMatchLeaguePosition: 10,
  lastMatchXPGain: 0,
  currentCupTieId: null as GameState['currentCupTieId'],
  penaltyShootoutKicks: [] as PenaltyKick[],
  penaltyShootoutRevealIndex: 0,

  clearMatchResult: () => set({ currentMatchResult: null, halfTimeState: null, matchPhase: 'none', matchTeamTalk: 'none', currentCupTieId: null, penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0 }),

  setTeamTalk: (talk: TeamTalkType) => set({ matchTeamTalk: talk }),

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
    const outPlayer = state.players[outId];
    const subEvent = {
      minute: 45,
      type: 'substitution' as const,
      playerId: inId,
      assistPlayerId: outId,
      clubId: state.playerClubId,
      description: `${inPlayer.firstName} ${inPlayer.lastName} replaces ${outPlayer ? `${outPlayer.firstName} ${outPlayer.lastName}` : 'Unknown'}`,
    };
    const updates: Partial<GameState> = { clubs: { ...state.clubs, [club.id]: club }, matchSubsUsed: state.matchSubsUsed + 1 };
    if (state.currentMatchResult) {
      updates.currentMatchResult = {
        ...state.currentMatchResult,
        events: [...state.currentMatchResult.events, subEvent],
      };
    } else if (state.halfTimeState) {
      // At half-time: record sub event in halfTimeState so it carries into the second half
      updates.halfTimeState = {
        ...state.halfTimeState,
        events: [...state.halfTimeState.events, subEvent],
      };
    }
    set(updates);
  },
});
