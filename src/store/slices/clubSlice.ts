import { FormationType } from '@/types/game';
import type { GameState } from '../storeTypes';
import { selectBestLineup } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import { toast } from 'sonner';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createClubSlice = (set: Set, get: Get) => ({
  clubs: {} as GameState['clubs'],
  players: {} as GameState['players'],
  fixtures: [] as GameState['fixtures'],
  leagueTable: [] as GameState['leagueTable'],
  trainingFocus: 'fitness' as GameState['trainingFocus'],

  setFormation: (formation: FormationType) => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId] };
    const squad = club.playerIds.map(id => state.players[id]).filter(Boolean);
    const { lineup, subs } = selectBestLineup(squad, formation);
    club.formation = formation;
    club.lineup = lineup.map(p => p.id);
    club.subs = subs.map(p => p.id);
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  setDefensiveFormation: (formation: FormationType | null) => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId] };
    club.defensiveFormation = formation || undefined;
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  updateLineup: (lineup: string[], subs: string[]) => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId] };
    club.lineup = lineup;
    club.subs = subs;
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  autoFillTeam: () => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId] };
    const squad = club.playerIds.map(id => state.players[id]).filter(Boolean);
    const result = autoFillBestTeam(squad, club.formation, state.currentWeek);
    club.lineup = result.lineup.map(p => p.id);
    club.subs = result.subs.map(p => p.id);
    set({ clubs: { ...state.clubs, [club.id]: club } });

    if (result.lineup.length < 11) {
      toast.warning('Not enough available players to fill all positions');
    } else {
      toast.success(`Lineup optimized — Chemistry: ${result.chemistryLabel} (+${(result.chemistryBonus * 100).toFixed(1)}%)`);
    }
  },

  setTrainingFocus: (f: GameState['trainingFocus']) => set({ trainingFocus: f }),
});
