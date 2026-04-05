import type { GameState } from '../storeTypes';
import type { CareerManager, JobVacancy, JobOffer, GameMode } from '@/types/game';
import { generateJobVacancies, getRetirementAge, generateDefaultBonuses, estimateSquadValue, calculateExpectedPosition } from '@/utils/managerCareer';
import { LEAGUES, CLUBS_DATA } from '@/data/league';
import { STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY } from '@/config/gameBalance';
import { generateAIManagerProfile } from '@/config/aiManager';
import { generateInitialStaff, generateStaffMarket } from '@/utils/staff';
import { selectBestLineup } from '@/utils/playerGen';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createCareerSlice = (set: Set, get: Get) => ({
  // State defaults
  gameMode: 'sandbox' as GameMode,
  careerManager: null as CareerManager | null,
  jobVacancies: [] as JobVacancy[],
  jobOffers: [] as JobOffer[],

  initCareerGame: (manager: CareerManager, clubId: string) => {
    // Initialize the regular game first (triggers its own set())
    get().initGame(clubId);

    // Immediately merge career-specific state into a single follow-up set()
    // to avoid cascading re-renders from two sequential set() calls
    const updatedState = get();
    const club = updatedState.clubs[clubId];
    const contract = manager.contract;

    set({
      gameMode: 'career',
      careerManager: {
        ...manager,
        contract,
        careerHistory: [{
          clubId,
          clubName: club?.name || clubId,
          divisionId: updatedState.playerDivision,
          startSeason: 1,
          endSeason: null as number | null,
          reason: 'hired' as const,
          bestFinish: 0,
          titlesWon: 0,
        }],
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

    // Convert vacancy to offer with bonuses and enriched club data
    const league = LEAGUES.find(l => l.id === vacancy.divisionId);
    const clubData = CLUBS_DATA.find(c => c.id === vacancy.clubId);
    const offer: JobOffer = {
      id: `offer-${Date.now()}`,
      clubId: vacancy.clubId,
      clubName: vacancy.clubName,
      divisionId: vacancy.divisionId,
      salary: vacancy.salary,
      contractLength: vacancy.contractLength,
      bonuses: generateDefaultBonuses(league?.qualityTier || 4),
      boardExpectations: vacancy.boardExpectations,
      expiresWeek: vacancy.expiresWeek,
      expiresSeason: vacancy.expiresSeason,
      // Enriched club profile
      leagueName: league?.name || '',
      country: league?.country || '',
      clubColor: clubData?.color || '#888888',
      reputation: clubData?.reputation || 3,
      budget: clubData?.budget || 0,
      estimatedSquadValue: estimateSquadValue(clubData?.squadQuality || 50),
      expectedPosition: calculateExpectedPosition(vacancy.clubId, vacancy.divisionId),
      facilities: clubData?.facilities || 5,
      youthRating: clubData?.youthRating || 5,
      boardPatience: clubData?.boardPatience || 5,
      stadiumName: clubData?.stadiumName || '',
      stadiumCapacity: clubData?.stadiumCapacity || 0,
      fanBase: clubData?.fanBase || 50,
      initialSalary: vacancy.salary,
      negotiationRound: 0,
      negotiationStatus: 'pending',
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
      state.week,
      state.playerClubId
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

    // Determine if club is in the same loaded league
    const targetClub = state.clubs[clubId];
    const isSameLeague = !!targetClub && offer.divisionId === state.playerDivision;

    if (isSameLeague) {
      // Same league: swap playerClubId, preserve season/fixtures state
      const oldClubId = state.playerClubId;
      const newClubs = { ...state.clubs };

      // Assign AI manager to old club
      if (oldClubId && newClubs[oldClubId]) {
        const oldClubData = CLUBS_DATA.find(c => c.id === oldClubId);
        newClubs[oldClubId] = {
          ...newClubs[oldClubId],
          aiManagerProfile: generateAIManagerProfile(oldClubId, oldClubData?.reputation || 3),
        };
      }
      // Remove AI manager from new club (player takes over)
      if (newClubs[clubId]) {
        const clubObj = newClubs[clubId];
        newClubs[clubId] = { ...clubObj, aiManagerProfile: undefined };
      }

      // Recalculate best lineup for the new club
      const clubPlayers = newClubs[clubId].playerIds
        .map(id => state.players[id])
        .filter(Boolean);
      const { lineup, subs } = selectBestLineup(clubPlayers, newClubs[clubId].formation || '4-3-3');
      newClubs[clubId] = {
        ...newClubs[clubId],
        lineup: lineup.map(p => p.id),
        subs: subs.map(p => p.id),
      };

      const contract = {
        clubId,
        salary: offer.salary,
        startSeason: state.season,
        endSeason: state.season + offer.contractLength - 1,
        bonuses: offer.bonuses,
      };

      const newEntry = {
        clubId,
        clubName: targetClub.name,
        divisionId: state.playerDivision,
        startSeason: state.season,
        endSeason: null as number | null,
        reason: 'hired' as const,
        bestFinish: 0,
        titlesWon: 0,
      };

      // Reset club-specific state for the new club
      const newInitialStaff = generateInitialStaff(targetClub.reputation);
      const newScoutCount = newInitialStaff.filter(s => s.role === 'scout').length;

      set({
        playerClubId: clubId,
        clubs: newClubs,
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
        transferMarket: [],
        incomingOffers: [],
        incomingLoanOffers: [],
        shortlist: [],
        scoutWatchList: [],
        training: {
          schedule: state.training.schedule,
          intensity: 'medium',
          individualPlans: [],
          tacticalFamiliarity: STARTING_TACTICAL_FAMILIARITY,
        },
        scouting: {
          ...state.scouting,
          assignments: [],
          reports: [],
          discoveredPlayers: [],
          maxAssignments: newScoutCount,
        },
        staff: {
          members: newInitialStaff,
          availableHires: generateStaffMarket(),
        },
      });
    } else {
      // Different league: must reinitialize game for the new league
      // Preserve the season number for career continuity
      const lastEntry = updatedHistory[updatedHistory.length - 1];
      const continuedSeason = (lastEntry?.endSeason || 0) + 1;

      state.initGame(clubId);
      const newState = get();
      const club = newState.clubs[clubId];

      const contract = {
        clubId,
        salary: offer.salary,
        startSeason: continuedSeason,
        endSeason: continuedSeason + offer.contractLength - 1,
        bonuses: offer.bonuses,
      };

      const newEntry = {
        clubId,
        clubName: club?.name || clubId,
        divisionId: newState.playerDivision,
        startSeason: continuedSeason,
        endSeason: null as number | null,
        reason: 'hired' as const,
        bestFinish: 0,
        titlesWon: 0,
      };

      set({
        season: continuedSeason,
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
    }
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
