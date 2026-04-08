import type { FormationType, NationalTeamState, InternationalTournamentState, NationalTeamOffer } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { NT_JOB_OFFER_DURATION_WEEKS } from '@/config/gameBalance';
import { generateNationalTeamPool, autoSelectNationalSquad } from '@/utils/international';
import { selectBestLineup } from '@/utils/playerGen';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createNationalTeamSlice = (_set: Set, _get: Get) => ({
  nationalTeam: null as NationalTeamState | null,
  internationalTournament: null as InternationalTournamentState | null,
  managerNationality: null as string | null,
  nationalTeamOffer: null as NationalTeamOffer | null,
  showNationalTeamOffer: false,

  initNationalTeam: (nationality: string) => {
    const state = _get();
    const formation = '4-3-3' as FormationType;

    // Generate national team candidate pool (sandbox mode starts with full squad)
    const poolPlayers = generateNationalTeamPool(nationality, state.players, state.season || 1);
    const allPlayers = { ...state.players, ...poolPlayers };
    const poolPlayerIds = Object.keys(poolPlayers);

    // Auto-select best 23-man squad
    const squad = autoSelectNationalSquad(nationality, allPlayers);
    const squadPlayerObjs = squad.map(id => allPlayers[id]).filter(Boolean);
    let lineup: string[] = [];
    let subs: string[] = [];
    if (squadPlayerObjs.length >= 7) {
      const best = selectBestLineup(squadPlayerObjs, formation);
      lineup = best.lineup.map(p => p.id);
      subs = best.subs.map(p => p.id).slice(0, 7);
    }

    _set({
      managerNationality: nationality,
      players: allPlayers,
      nationalTeam: {
        nationality,
        squad,
        lineup,
        subs,
        formation,
        fifaRanking: 25,
        caps: {},
        internationalGoals: {},
        results: [],
        poolPlayerIds,
      },
    });
  },

  setManagerNationality: (nationality: string) => {
    const state = _get();
    // Career mode: immediately offer the national team job (shown as popup)
    if (state.gameMode === 'career') {
      const offer: NationalTeamOffer = {
        id: crypto.randomUUID(),
        nationality,
        reason: 'initial',
        offerSeason: 1,
        offerWeek: 1,
        expiresSeason: 1,
        expiresWeek: 1 + NT_JOB_OFFER_DURATION_WEEKS,
        status: 'pending',
      };
      const messages = addMsg(state.messages, {
        week: 1, season: 1, type: 'national_team',
        title: `${nationality} FA: National Team Position`,
        body: `The ${nationality} Football Association would like to offer you the position of national team manager alongside your club duties.`,
      });
      _set({
        managerNationality: nationality,
        nationalTeamOffer: offer,
        showNationalTeamOffer: true,
        messages,
      });
    } else {
      _set({ managerNationality: nationality });
    }
  },

  acceptNationalTeamOffer: () => {
    const state = _get();
    const offer = state.nationalTeamOffer;
    if (!offer || offer.status !== 'pending' || !state.managerNationality) return;

    const nationality = state.managerNationality;
    const formation = '4-3-3' as FormationType;

    // Generate national team candidate pool so there are enough eligible players
    const poolPlayers = generateNationalTeamPool(nationality, state.players, state.season);
    const allPlayers = { ...state.players, ...poolPlayers };

    // Auto-select best 23-man squad from all eligible players
    const squad = autoSelectNationalSquad(nationality, allPlayers);

    // Auto-select best lineup and subs from the squad
    const squadPlayerObjs = squad.map(id => allPlayers[id]).filter(Boolean);
    let lineup: string[] = [];
    let subs: string[] = [];
    if (squadPlayerObjs.length >= 7) {
      const best = selectBestLineup(squadPlayerObjs, formation);
      lineup = best.lineup.map(p => p.id);
      subs = best.subs.map(p => p.id).slice(0, 7);
    }

    const nationalTeam: NationalTeamState = {
      nationality,
      squad,
      lineup,
      subs,
      formation,
      fifaRanking: 25,
      caps: {},
      internationalGoals: {},
      results: [],
      poolPlayerIds: Object.keys(poolPlayers),
    };

    const messages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'national_team',
      title: `${nationality} National Team — Appointed!`,
      body: `You have accepted the position of ${nationality} national team manager. Your ${squad.length}-man squad has been selected — review and edit it on the National Team page.`,
    });

    const careerTimeline = state.gameMode === 'career' ? [
      ...state.careerTimeline,
      {
        id: crypto.randomUUID(),
        type: 'national_team_appointed' as const,
        title: `${nationality} Manager`,
        description: `Appointed as ${nationality} national team manager.`,
        season: state.season,
        week: state.week,
        icon: 'Globe',
      },
    ] : state.careerTimeline;

    const careerManager = state.careerManager ? {
      ...state.careerManager,
      nationalTeamAppointedSeason: state.season,
    } : null;

    _set({
      nationalTeam,
      nationalTeamOffer: null,
      showNationalTeamOffer: false,
      players: allPlayers,
      messages,
      careerTimeline,
      careerManager,
    });
  },

  declineNationalTeamOffer: () => {
    const state = _get();
    if (!state.nationalTeamOffer || !state.managerNationality) return;

    const messages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'national_team',
      title: 'National Team Offer Declined',
      body: `You have declined the ${state.managerNationality} national team position. The FA will consider other candidates.`,
    });

    _set({
      nationalTeamOffer: null,
      showNationalTeamOffer: false,
      messages,
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
