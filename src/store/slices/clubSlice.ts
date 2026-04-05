import { FormationType } from '@/types/game';
import type { GameState } from '../storeTypes';
import { selectBestLineup } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import type { AutoFillContext } from '@/utils/autoFillLineup';
import { getDerbyIntensity } from '@/data/league';

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
    const club = { ...state.clubs[state.playerClubId] };
    const squad = club.playerIds.map(id => state.players[id]).filter(Boolean);
    const oldLineup = [...club.lineup];

    // ── Build match context for opponent-aware optimization ──
    const leagueMatch = state.fixtures.find(
      m => m.week === state.week && !m.played &&
        (m.homeClubId === state.playerClubId || m.awayClubId === state.playerClubId)
    );

    let matchHomeId = leagueMatch?.homeClubId;
    let matchAwayId = leagueMatch?.awayClubId;
    let isCupMatch = false;

    // Check cup/tournament matches if no league match this week
    if (!leagueMatch) {
      const cupTie = state.cup?.ties?.find(t =>
        t.week === state.week && !t.played &&
        (t.homeClubId === state.playerClubId || t.awayClubId === state.playerClubId)
      );
      if (cupTie) {
        matchHomeId = cupTie.homeClubId;
        matchAwayId = cupTie.awayClubId;
        isCupMatch = true;
      }
      if (!cupTie && state.leagueCup?.ties) {
        const lcTie = state.leagueCup.ties.find(t =>
          t.week === state.week && !t.played &&
          (t.homeClubId === state.playerClubId || t.awayClubId === state.playerClubId)
        );
        if (lcTie) {
          matchHomeId = lcTie.homeClubId;
          matchAwayId = lcTie.awayClubId;
          isCupMatch = true;
        }
      }
    }

    let context: AutoFillContext | undefined;
    if (matchHomeId && matchAwayId) {
      const isHome = matchHomeId === state.playerClubId;
      const oppClubId = isHome ? matchAwayId : matchHomeId;
      const oppClub = state.clubs[oppClubId];
      const derbyInt = getDerbyIntensity(matchHomeId, matchAwayId);

      // Detect congested fixtures: match next week too?
      const hasMatchNextWeek = state.fixtures.some(
        m => m.week === state.week + 1 && !m.played &&
          (m.homeClubId === state.playerClubId || m.awayClubId === state.playerClubId)
      ) || (state.cup?.ties?.some(t =>
        t.week === state.week + 1 && !t.played &&
        (t.homeClubId === state.playerClubId || t.awayClubId === state.playerClubId)
      ) ?? false);

      context = {
        tactics: state.tactics,
        opponentFormation: oppClub?.formation,
        opponentStyle: oppClub?.aiManagerProfile?.style,
        opponentReputation: oppClub?.reputation,
        isHome,
        derbyIntensity: derbyInt,
        isCupMatch,
        hasMatchNextWeek,
        setPieceTakerId: club.setPieceTakerId,
        penaltyTakerId: club.penaltyTakerId,
        defensiveFormation: club.defensiveFormation,
      };
    }

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
});
