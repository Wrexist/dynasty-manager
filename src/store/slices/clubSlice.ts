import { FormationType } from '@/types/game';
import type { GameState } from '../storeTypes';
import { selectBestLineup } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import { buildAutoFillContext } from '@/utils/autoFillContext';
import { isPro } from '@/utils/monetization';
import { isAwayOnLoan } from '@/utils/helpers';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/** A live match is in progress for the user: lineup changes are substitutions
 *  then, not team selection. */
function isLiveMatchPhase(phase: GameState['matchPhase']): boolean {
  return phase === 'first_half' || phase === 'half_time' || phase === 'second_half' || phase === 'extra_time';
}

export const createClubSlice = (set: Set, get: Get) => ({
  clubs: {} as GameState['clubs'],
  players: {} as GameState['players'],
  fixtures: [] as GameState['fixtures'],
  leagueTable: [] as GameState['leagueTable'],
  trainingFocus: 'fitness' as GameState['trainingFocus'],

  setFormation: (formation: FormationType) => {
    const state = get();
    const club = { ...state.clubs[state.playerClubId] };
    // During a live match a formation change re-shapes the eleven on the
    // pitch — it re-slots the SAME players. Re-picking the best XI from the
    // whole squad here (right before kickoff) handed out free, uncounted
    // substitutions mid-match, since the next segment resumes from
    // club.lineup.
    if (isLiveMatchPhase(state.matchPhase)) {
      const onPitch = [...new Set(club.lineup || [])].map(id => state.players[id]).filter(Boolean);
      const ids = selectBestLineup(onPitch, formation, state.week).lineup.map(p => p.id);
      // Whoever the picker left out (it skips players it deems unavailable)
      // stays on the pitch all the same — nobody silently disappears.
      for (const p of onPitch) if (!ids.includes(p.id)) ids.push(p.id);
      club.formation = formation;
      club.lineup = ids;
      set({ clubs: { ...state.clubs, [club.id]: club } });
      return;
    }
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
    const oldLineup = [...club.lineup];
    // During a live match the optimiser chooses only from the MATCHDAY squad
    // (the XI + bench, minus anyone already substituted off). Picking from the
    // whole squad let it bring on reserves who were never on the bench —
    // uncounted against the substitution limit, since the sheet only routes
    // bench players through makeMatchSub.
    const live = isLiveMatchPhase(state.matchPhase);
    const matchday = [...new Set([...(club.lineup || []), ...(club.subs || [])])];
    const subbedOff = new Set(state.matchSubbedOffIds || []);
    const squad = (live ? matchday.filter(id => !subbedOff.has(id)) : club.playerIds)
      .map(id => state.players[id]).filter(Boolean);

    const context = buildAutoFillContext(state, state.playerClubId);
    const result = autoFillBestTeam(squad, club.formation, state.week, state.season, context);
    club.lineup = result.lineup.map(p => p.id);
    // Live: the rest of the matchday squad stays on the bench (subbed-off
    // players included — post-match processing reads them from there).
    club.subs = live
      ? matchday.filter(id => !club.lineup.includes(id))
      : result.subs.map(p => p.id);
    set({ clubs: { ...state.clubs, [club.id]: club } });

    // Return metadata so UI can show a single unified toast
    const changes = club.lineup.filter((id, i) => id !== oldLineup[i]).length;
    const undersized = result.lineup.length < 11;
    let undersizedDetail: string | undefined;
    if (undersized) {
      const injuredCount = squad.filter(p => p.injured).length;
      const suspendedCount = squad.filter(p => p.suspendedUntilWeek && state.week !== undefined && p.suspendedUntilWeek > state.week).length;
      const onLoanCount = squad.filter(p => isAwayOnLoan(p, club.id)).length;
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
