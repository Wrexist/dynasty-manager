import { FormationType } from '@/types/game';
import type { GameState } from '../storeTypes';
import { selectBestLineup } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import type { AutoFillContext } from '@/utils/autoFillLineup';
import { getDerbyIntensity } from '@/data/league';
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
    club.lineup = lineup;
    club.subs = subs;
    set({ clubs: { ...state.clubs, [club.id]: club } });
  },

  autoFillTeam: () => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId] };
    const squad = club.playerIds.map(id => state.players[id]).filter(Boolean);

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
      };
    }

    const result = autoFillBestTeam(squad, club.formation, state.week, state.season, context);
    club.lineup = result.lineup.map(p => p.id);
    club.subs = result.subs.map(p => p.id);
    set({ clubs: { ...state.clubs, [club.id]: club } });

    if (result.lineup.length < 11) {
      const injuredCount = squad.filter(p => p.injured).length;
      const suspendedCount = squad.filter(p => p.suspendedUntilWeek && state.week !== undefined && p.suspendedUntilWeek > state.week).length;
      const onLoanCount = squad.filter(p => p.onLoan).length;
      toast.warning(`Only ${result.lineup.length}/11 spots filled (${injuredCount} injured, ${suspendedCount} suspended, ${onLoanCount} on loan)`);
    } else {
      toast.success(`Lineup optimized — Chemistry: ${result.chemistryLabel} (+${(result.chemistryBonus * 100).toFixed(1)}%)`);
    }
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
