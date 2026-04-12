import type { GameState } from '../storeTypes';
import type { CareerManager, JobVacancy, JobOffer, GameMode, ActiveInterview, PitchTone, ManagerBonus } from '@/types/game';
import { generateJobVacancies, getRetirementAge, generateDefaultBonuses, estimateSquadValue, calculateExpectedPosition, generateCompetitors, selectPitchQuestions, calculateInterviewResult, negotiateContract } from '@/utils/managerCareer';
import { LEAGUES, CLUBS_DATA } from '@/data/league';
import { STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY } from '@/config/gameBalance';
import { PITCH_SCORE_BASE, BOARD_TOLERANCE_START } from '@/config/managerCareer';
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
  activeInterview: null as ActiveInterview | null,

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
    // Delegate to startInterview for the full interview flow
    return get().startInterview(vacancyId);
  },

  startInterview: (vacancyId: string): { success: boolean; message: string } => {
    const state = get();
    const manager = state.careerManager;
    if (!manager) return { success: false, message: 'Not in career mode.' };

    const vacancy = state.jobVacancies.find(v => v.id === vacancyId);
    if (!vacancy) return { success: false, message: 'Vacancy no longer available.' };

    if (manager.reputationScore < vacancy.minReputation) {
      return { success: false, message: 'Your reputation is not high enough for this position.' };
    }

    if (state.activeInterview) {
      return { success: false, message: 'You already have an interview in progress.' };
    }

    // Generate competitors and pitch questions
    const league = LEAGUES.find(l => l.id === vacancy.divisionId);
    const qualityTier = (league?.qualityTier || 4) as 1 | 2 | 3 | 4;
    const competitors = vacancy.competitors || generateCompetitors(vacancy.minReputation, qualityTier);
    const pitchQuestions = selectPitchQuestions(qualityTier);

    const interview: ActiveInterview = {
      vacancyId,
      clubId: vacancy.clubId,
      clubName: vacancy.clubName,
      divisionId: vacancy.divisionId,
      step: 'pitch',
      pitchQuestions,
      currentQuestionIndex: 0,
      pitchScore: PITCH_SCORE_BASE,
      responses: [],
      competitors,
      result: 'pending',
      resultMessage: '',
    };

    set({
      activeInterview: interview,
      jobVacancies: state.jobVacancies.map(v =>
        v.id === vacancyId ? { ...v, interviewActive: true } : v
      ),
    });

    return { success: true, message: `Interview started with ${vacancy.clubName}` };
  },

  submitPitchResponse: (tone: PitchTone) => {
    const state = get();
    const interview = state.activeInterview;
    if (!interview || interview.step !== 'pitch') return;

    // Guard against double-click: responses length should match current index
    if (interview.responses.length !== interview.currentQuestionIndex) return;

    const question = interview.pitchQuestions[interview.currentQuestionIndex];
    if (!question) return;

    const option = question.options.find(o => o.tone === tone);
    if (!option) return;

    // Calculate score modifier with tier bonus
    const league = LEAGUES.find(l => l.id === interview.divisionId);
    const qualityTier = league?.qualityTier || 4;
    let modifier = option.scoreModifier;
    if (option.bestForTier === qualityTier) modifier += 3;

    const newScore = interview.pitchScore + modifier;
    const newResponses = [...interview.responses, tone];
    const nextIndex = interview.currentQuestionIndex + 1;

    // Check if all questions answered
    if (nextIndex >= interview.pitchQuestions.length) {
      // Calculate result
      const manager = state.careerManager;
      const vacancy = state.jobVacancies.find(v => v.id === interview.vacancyId);
      const result = calculateInterviewResult(
        newScore,
        manager?.reputationScore || 0,
        vacancy?.minReputation || 0,
        interview.competitors,
      );

      if (result.hired && vacancy) {
        // Convert vacancy to enriched offer
        const clubData = CLUBS_DATA.find(c => c.id === vacancy.clubId);
        const offer: JobOffer = {
          id: `offer-${Date.now()}`,
          clubId: vacancy.clubId,
          clubName: vacancy.clubName,
          divisionId: vacancy.divisionId,
          salary: vacancy.salary,
          contractLength: vacancy.contractLength,
          bonuses: generateDefaultBonuses(qualityTier as 1 | 2 | 3 | 4),
          boardExpectations: vacancy.boardExpectations,
          expiresWeek: vacancy.expiresWeek,
          expiresSeason: vacancy.expiresSeason,
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
          initialContractLength: vacancy.contractLength,
          negotiationRound: 0,
          negotiationStatus: 'pending',
          boardTolerance: BOARD_TOLERANCE_START,
        };
        set({
          activeInterview: {
            ...interview,
            pitchScore: newScore,
            responses: newResponses,
            currentQuestionIndex: nextIndex,
            step: 'result',
            result: 'hired',
            resultMessage: result.message,
          },
          jobOffers: [...state.jobOffers, offer],
        });
      } else {
        // Rejected, or hired but vacancy was removed (race condition — treat as filled)
        const message = (result.hired && !vacancy)
          ? 'The position was filled before the board could finalize your appointment.'
          : result.message;
        set({
          activeInterview: {
            ...interview,
            pitchScore: newScore,
            responses: newResponses,
            currentQuestionIndex: nextIndex,
            step: 'result',
            result: 'rejected',
            resultMessage: message,
          },
        });
      }
    } else {
      // More questions to go
      set({
        activeInterview: {
          ...interview,
          pitchScore: newScore,
          responses: newResponses,
          currentQuestionIndex: nextIndex,
        },
      });
    }
  },

  completeInterview: () => {
    const state = get();
    const interview = state.activeInterview;
    if (!interview) return;

    // Remove vacancy if hired, mark as applied if rejected
    const vacancies = interview.result === 'hired'
      ? state.jobVacancies.filter(v => v.id !== interview.vacancyId)
      : state.jobVacancies.map(v =>
        v.id === interview.vacancyId ? { ...v, applied: true, interviewActive: false } : v
      );

    set({ activeInterview: null, jobVacancies: vacancies });
  },

  dismissInterview: () => {
    const state = get();
    const interview = state.activeInterview;
    if (!interview) return;

    set({
      activeInterview: null,
      jobVacancies: state.jobVacancies.map(v =>
        v.id === interview.vacancyId ? { ...v, interviewActive: false } : v
      ),
    });
  },

  negotiateContractOffer: (offerId: string, salary: number, contractLength: number, bonuses: ManagerBonus[]) => {
    const state = get();
    const manager = state.careerManager;
    if (!manager) return;

    const offer = state.jobOffers.find(o => o.id === offerId);
    if (!offer) return;

    const updated = negotiateContract(offer, salary, contractLength, bonuses, manager.attributes.negotiation);
    set({ jobOffers: state.jobOffers.map(o => o.id === offerId ? updated : o) });
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

    // Generate job vacancies with competitors
    const vacancies = generateJobVacancies(
      state.clubs,
      updatedManager.reputationScore,
      state.season,
      state.week,
      state.playerClubId
    ).map(v => {
      const vLeague = LEAGUES.find(l => l.id === v.divisionId);
      return { ...v, competitors: generateCompetitors(v.minReputation, (vLeague?.qualityTier || 4) as 1 | 2 | 3 | 4) };
    });

    set({
      careerManager: updatedManager,
      jobVacancies: vacancies,
      jobOffers: [],
      activeInterview: null,
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
        activeInterview: null,
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
        activeInterview: null,
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
      activeInterview: null,
      currentScreen: 'hall-of-managers',
    });
  },
});
