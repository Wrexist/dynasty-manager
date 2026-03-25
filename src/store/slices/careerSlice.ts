import type { GameState } from '../storeTypes';
import type { CareerManager, JobVacancy, JobOffer, GameMode } from '@/types/game';
import { generateJobVacancies, getRetirementAge } from '@/utils/managerCareer';
import { STARTING_BOARD_CONFIDENCE } from '@/config/gameBalance';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createCareerSlice = (set: Set, get: Get) => ({
  // State defaults
  gameMode: 'sandbox' as GameMode,
  careerManager: null as CareerManager | null,
  jobVacancies: [] as JobVacancy[],
  jobOffers: [] as JobOffer[],

  initCareerGame: (manager: CareerManager, clubId: string) => {
    const state = get();

    // First initialize the regular game
    state.initGame(clubId);

    // Then overlay career-specific state
    const updatedState = get();
    const club = updatedState.clubs[clubId];

    // Create contract from the first career entry
    const contract = manager.contract;

    // Add initial career history entry
    const historyEntry = {
      clubId,
      clubName: club?.name || clubId,
      divisionId: updatedState.playerDivision,
      startSeason: 1,
      endSeason: null as number | null,
      reason: 'hired' as const,
      bestFinish: 0,
      titlesWon: 0,
    };

    set({
      gameMode: 'career',
      careerManager: {
        ...manager,
        contract,
        careerHistory: [historyEntry],
      },
    });
  },

  applyForJob: (vacancyId: string): { success: boolean; message: string } => {
    const state = get();
    const manager = state.careerManager;
    if (!manager) return { success: false, message: 'Not in career mode.' };

    const vacancy = state.jobVacancies.find(v => v.id === vacancyId);
    if (!vacancy) return { success: false, message: 'Vacancy no longer available.' };

    if (manager.reputationScore < vacancy.minReputation) {
      return { success: false, message: 'Your reputation is not high enough for this position.' };
    }

    // Reputation check — higher reputation = better chance
    const repRatio = Math.min(1, manager.reputationScore / Math.max(1, vacancy.minReputation + 100));
    const accepted = Math.random() < (0.4 + repRatio * 0.5);

    if (!accepted) {
      // Mark as applied
      set({
        jobVacancies: state.jobVacancies.map(v =>
          v.id === vacancyId ? { ...v, applied: true } : v
        ),
      });
      return { success: false, message: `${vacancy.clubName} has chosen another candidate.` };
    }

    // Convert vacancy to offer
    const offer: JobOffer = {
      id: `offer-${Date.now()}`,
      clubId: vacancy.clubId,
      clubName: vacancy.clubName,
      divisionId: vacancy.divisionId,
      salary: vacancy.salary,
      contractLength: vacancy.contractLength,
      bonuses: [],
      boardExpectations: vacancy.boardExpectations,
      expiresWeek: vacancy.expiresWeek,
      expiresSeason: vacancy.expiresSeason,
    };

    set({
      jobOffers: [...state.jobOffers, offer],
      jobVacancies: state.jobVacancies.filter(v => v.id !== vacancyId),
    });

    return { success: true, message: `${vacancy.clubName} wants to hire you!` };
  },

  respondToJobOffer: (offerId: string, accept: boolean) => {
    const state = get();
    const manager = state.careerManager;
    if (!manager) return;

    const offer = state.jobOffers.find(o => o.id === offerId);
    if (!offer) return;

    if (!accept) {
      set({ jobOffers: state.jobOffers.filter(o => o.id !== offerId) });
      return;
    }

    // Block retired managers from accepting
    if (manager.age >= getRetirementAge(manager)) return;

    // Accept — move to new club
    state.moveToNewClub(offer.clubId, offer);
  },

  resignFromClub: () => {
    const state = get();
    const manager = state.careerManager;
    if (!manager || !manager.contract) return;

    // Close current career history entry
    const updatedHistory = manager.careerHistory.map(entry =>
      entry.endSeason === null
        ? { ...entry, endSeason: state.season, reason: 'resigned' as const }
        : entry
    );

    const updatedManager: CareerManager = {
      ...manager,
      contract: null,
      careerHistory: updatedHistory,
      resignedCount: manager.resignedCount + 1,
      unemployedWeeks: 0,
    };

    // Generate job vacancies
    const vacancies = generateJobVacancies(
      state.clubs,
      updatedManager.reputationScore,
      state.season,
      state.week
    );

    set({
      careerManager: updatedManager,
      jobVacancies: vacancies,
      jobOffers: [],
      currentScreen: 'job-market',
    });
  },

  moveToNewClub: (clubId: string, offer: JobOffer) => {
    const state = get();
    const manager = state.careerManager;
    if (!manager) return;

    // Close current career history entry if employed
    const updatedHistory = manager.careerHistory.map(entry =>
      entry.endSeason === null
        ? { ...entry, endSeason: state.season, reason: 'moved' as const }
        : entry
    );

    // Re-initialize the game with the new club
    state.initGame(clubId);
    const newState = get();
    const club = newState.clubs[clubId];

    // Create new contract
    const contract = {
      clubId,
      salary: offer.salary,
      startSeason: newState.season,
      endSeason: newState.season + offer.contractLength - 1,
      bonuses: offer.bonuses,
    };

    // Add new career history entry
    const newEntry = {
      clubId,
      clubName: club?.name || clubId,
      divisionId: newState.playerDivision,
      startSeason: newState.season,
      endSeason: null as number | null,
      reason: 'hired' as const,
      bestFinish: 0,
      titlesWon: 0,
    };

    set({
      gameMode: 'career',
      careerManager: {
        ...manager,
        contract,
        careerHistory: [...updatedHistory, newEntry],
        unemployedWeeks: 0,
      },
      jobVacancies: [],
      jobOffers: [],
      boardConfidence: STARTING_BOARD_CONFIDENCE,
      currentScreen: 'dashboard',
    });
  },

  retireManager: () => {
    const state = get();
    const manager = state.careerManager;
    if (!manager) return;

    const updatedHistory = manager.careerHistory.map(entry =>
      entry.endSeason === null
        ? { ...entry, endSeason: state.season, reason: 'retired' as const }
        : entry
    );

    set({
      careerManager: { ...manager, contract: null, careerHistory: updatedHistory },
      currentScreen: 'hall-of-managers',
    });
  },
});
