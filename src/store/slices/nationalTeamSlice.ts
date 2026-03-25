import type { FormationType, NationalTeamState, InternationalTournamentState } from '@/types/game';
import type { GameState } from '../storeTypes';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createNationalTeamSlice = (_set: Set, _get: Get) => ({
  nationalTeam: null as NationalTeamState | null,
  internationalTournament: null as InternationalTournamentState | null,
  managerNationality: null as string | null,

  initNationalTeam: (nationality: string) => {
    _set({
      managerNationality: nationality,
      nationalTeam: {
        nationality,
        squad: [],
        lineup: [],
        subs: [],
        formation: '4-3-3' as FormationType,
        fifaRanking: 25, // will be set properly during tournament generation
        caps: {},
        internationalGoals: {},
        results: [],
      },
    });
  },

  updateNationalSquad: (squad: string[], lineup: string[], subs: string[]) => {
    const state = _get();
    if (!state.nationalTeam) return;
    _set({
      nationalTeam: {
        ...state.nationalTeam,
        squad,
        lineup,
        subs,
      },
    });
  },

  setNationalFormation: (f: FormationType) => {
    const state = _get();
    if (!state.nationalTeam) return;
    _set({
      nationalTeam: {
        ...state.nationalTeam,
        formation: f,
      },
    });
  },

  // advanceInternationalWeek and playInternationalMatch are handled by
  // orchestrationSlice (advanceInternationalWeekImpl). These slice-level
  // stubs are intentionally omitted — orchestration owns the game loop.
});
