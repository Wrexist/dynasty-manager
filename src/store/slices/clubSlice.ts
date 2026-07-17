import { FormationType } from '@/types/game';
import type { GameState } from '../storeTypes';
import { selectBestLineup } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import { buildAutoFillContext } from '@/utils/autoFillContext';
import { isPro } from '@/utils/monetization';

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
    const { lineup, subs } = selectBestLineup(squad, formation, state.week);
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
    // Defensive copy to prevent external mutation of state arrays
    club.lineup = [...lineup];
    club.subs = [...subs];
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  autoFillTeam: () => {
    const state = get();

    // Pro entitlement guard — the Smart Optimizer is a Pro feature. UI is
    // already gated, but we re-check here so any non-UI caller (devtools,
    // future shortcuts, plug-in code) can't bypass the paywall.
    if (!isPro(state.monetization)) {
      return {
        changes: 0,
        chemistryLabel: 'Low',
        chemistryBonus: 0,
        undersized: false,
        proRequired: true,
      };
    }

    const club = { ...state.clubs[state.playerClubId] };
    const squad = club.playerIds.map(id => state.players[id]).filter(Boolean);
    const oldLineup = [...club.lineup];

    const context = buildAutoFillContext(state, state.playerClubId);
    const result = autoFillBestTeam(squad, club.formation, state.week, state.season, context);
    club.lineup = result.lineup.map(p => p.id);
    club.subs = result.subs.map(p => p.id);
    set({ clubs: { ...state.clubs, [club.id]: club } });

    // Return metadata so UI can show a single unified toast
    const changes = club.lineup.filter((id, i) => id !== oldLineup[i]).length;
    const undersized = result.lineup.length < 11;
    let undersizedDetail: string | undefined;
    if (undersized) {
      const injuredCount = squad.filter(p => p.injured).length;
      const suspendedCount = squad.filter(p => p.suspendedUntilWeek && state.week !== undefined && p.suspendedUntilWeek > state.week).length;
      const onLoanCount = squad.filter(p => p.onLoan).length;
      undersizedDetail = `Only ${result.lineup.length}/11 spots filled (${injuredCount} injured, ${suspendedCount} suspended, ${onLoanCount} on loan)`;
    }

    return {
      changes,
      chemistryLabel: result.chemistryLabel,
      chemistryBonus: result.chemistryBonus,
      undersized,
      undersizedDetail,
    };
  },

  setTrainingFocus: (f: GameState['trainingFocus']) => set({ trainingFocus: f }),

  setSetPieceTaker: (playerId: string | undefined) => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId], setPieceTakerId: playerId };
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  setPenaltyTaker: (playerId: string | undefined) => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId], penaltyTakerId: playerId };
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  setCaptain: (playerId: string | undefined) => {
    const state = get();
    const base = state.clubs[state.playerClubId];
    if (!base) return;
    // Only squad members can wear the armband. undefined clears it.
    if (playerId && !base.playerIds.includes(playerId)) return;
    const club = { ...base, captainId: playerId };
    // A player can't hold both roles — vacate the vice slot if it's the same id.
    if (playerId && club.viceCaptainId === playerId) club.viceCaptainId = undefined;
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  setViceCaptain: (playerId: string | undefined) => {
    const state = get();
    const base = state.clubs[state.playerClubId];
    if (!base) return;
    if (playerId && !base.playerIds.includes(playerId)) return;
    const club = { ...base, viceCaptainId: playerId };
    // Vice can't be the same player as captain.
    if (playerId && club.captainId === playerId) club.captainId = undefined;
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },
});
