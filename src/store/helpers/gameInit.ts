/**
 * Game Initialization Logic — extracted from orchestrationSlice.ts
 * Sets up a new game: club setup, squad generation, league creation, initial state.
 */
import type { Club, Player, Match, TransferListing, Message, LeagueTableEntry, BoardObjective, LeagueId } from '@/types/game';
import type { GameState } from '../storeTypes';
import { ALL_CLUBS, buildLeagueTable, generateDivisionFixtures, DERBIES, LEAGUES, clearLeagueTableCache } from '@/data/league';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { generateInitialStaff, generateStaffMarket, getStaffBonus } from '@/utils/staff';
import { generateYouthProspects, generateIntakePreview } from '@/utils/youth';
import { addMsg, shuffle } from '@/utils/helpers';
import { generateCupDraw } from '@/data/cup';
import { generateInitialMarket, generateInitialFreeAgents } from '@/utils/transferMarketGen';
import { createEmptyRecords } from '@/utils/records';
import { getDefaultMerchState } from '@/utils/merchandise';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';
import {
  TOTAL_WEEKS, STARTING_BOARD_CONFIDENCE, STARTING_TACTICAL_FAMILIARITY,
  STADIUM_LEVEL_DIVISOR, MEDICAL_LEVEL_FACTOR, RECOVERY_LEVEL_FACTOR, FACILITY_MAX_LEVEL,
  LISTING_PRICE_MIN_MULTIPLIER, LISTING_PRICE_RANDOM_RANGE, INITIAL_LISTINGS_MIN, INITIAL_LISTINGS_RANGE,
} from '@/config/gameBalance';
import { INITIAL_FAMILIARITY_SEED } from '@/config/chemistry';
import { LEAGUE_CUP_WEEKS } from '@/config/continental';
import { CUP_BYE_MARKER } from '@/data/cup';
import { generateAIManagerProfile } from '@/config/aiManager';
import { resetSeasonGrowth } from '@/store/helpers/development';
import { createMilestone } from '@/utils/milestones';
import { createDefaultProgression } from '@/utils/managerPerks';
import { generateStarterDeals } from '@/store/slices/sponsorSlice';
import { generateMonthlyObjectives } from '@/utils/weeklyObjectives';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

function generateObjectives(club: Club, leagueId?: LeagueId): BoardObjective[] {
  const objectives: BoardObjective[] = [];
  const lid = leagueId || club.divisionId;
  const league = LEAGUES.find(l => l.id === lid);
  const teamCount = league?.teamCount || 20;
  const replacedSlots = league?.replacedSlots || 0;
  const safePos = teamCount - replacedSlots;

  if (club.reputation >= 5) {
    objectives.push({ id: '1', description: 'Win the League', priority: 'critical', completed: false });
    objectives.push({ id: '2', description: 'Finish in Top 3', priority: 'important', completed: false });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '1', description: 'Finish in Top 6', priority: 'critical', completed: false });
    objectives.push({ id: '2', description: 'Reach Top Half', priority: 'important', completed: false });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '1', description: 'Reach Top Half', priority: 'critical', completed: false });
  } else {
    objectives.push({ id: '1', description: replacedSlots > 0 ? `Avoid Replacement (Top ${safePos})` : 'Finish in Top Half', priority: 'critical', completed: false });
  }
  if (club.reputation >= 5) {
    objectives.push({ id: '4', description: 'Win the Cup', priority: 'important', completed: false });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '4', description: 'Reach Cup Semi-Final', priority: 'important', completed: false });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '4', description: 'Reach Cup Quarter-Final', priority: 'optional', completed: false });
  }
  objectives.push({ id: '3', description: 'Stay within budget', priority: 'optional', completed: false });
  return objectives;
}

function generateLeagueCupDraw(clubIds: string[]): import('@/types/game').LeagueCupState {
  const ties: import('@/types/game').CupTie[] = [];
  const shuffled = shuffle([...clubIds]);

  let startRound: import('@/types/game').CupRound = 'R1';
  if (shuffled.length <= 8) startRound = 'R3';
  else if (shuffled.length <= 16) startRound = 'R2';

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    ties.push({
      id: crypto.randomUUID(),
      round: startRound,
      homeClubId: shuffled[i],
      awayClubId: shuffled[i + 1],
      played: false, homeGoals: 0, awayGoals: 0,
      week: LEAGUE_CUP_WEEKS[startRound],
    });
  }

  // Bye for odd number of clubs
  if (shuffled.length % 2 === 1) {
    ties.push({
      id: crypto.randomUUID(),
      round: startRound,
      homeClubId: shuffled[shuffled.length - 1],
      awayClubId: CUP_BYE_MARKER,
      played: true,
      homeGoals: 1,
      awayGoals: 0,
      week: LEAGUE_CUP_WEEKS[startRound],
    });
  }

  return { ties, currentRound: startRound, eliminated: false, winner: null };
}

export { generateObjectives, generateLeagueCupDraw };

export function initGameImpl(set: Set, get: Get, clubId: string) {
  resetSeasonGrowth();
  clearLeagueTableCache();
  const allPlayers: Record<string, Player> = {};
  const clubs: Record<string, Club> = {};

  const selectedClubData = ALL_CLUBS.find(c => c.id === clubId);
  const playerDivision = selectedClubData?.divisionId || 'eng';
  const league = LEAGUES.find(l => l.id === playerDivision);

  const leagueClubData = ALL_CLUBS.filter(cd => cd.divisionId === playerDivision);

  leagueClubData.forEach(cd => {
    const club: Club = {
      id: cd.id, name: cd.name, shortName: cd.shortName,
      color: cd.color, secondaryColor: cd.secondaryColor,
      budget: cd.budget, wageBill: 0, reputation: cd.reputation,
      facilities: cd.facilities, youthRating: cd.youthRating,
      fanBase: cd.fanBase, boardPatience: cd.boardPatience,
      playerIds: [], formation: '4-3-3', lineup: [], subs: [],
      divisionId: cd.divisionId,
      stadiumName: cd.stadiumName,
      stadiumCapacity: cd.stadiumCapacity,
    };

    const squad = generateSquad(club.id, cd.squadQuality, 1, playerDivision);
    let totalWages = 0;
    squad.forEach(p => {
      allPlayers[p.id] = p;
      club.playerIds.push(p.id);
      totalWages += p.wage;
    });
    club.wageBill = totalWages;

    const { lineup, subs } = selectBestLineup(squad, '4-3-3');
    club.lineup = lineup.map(p => p.id);
    club.subs = subs.map(p => p.id);
    if (club.id !== clubId) {
      club.aiManagerProfile = generateAIManagerProfile(club.id, cd.reputation);
    }
    clubs[club.id] = club;
  });

  const leagueClubIds = leagueClubData.map(cd => cd.id);
  const leagueTotalWeeks = league?.totalWeeks || TOTAL_WEEKS;
  const divisionClubs: Record<string, string[]> = { [playerDivision]: leagueClubIds };
  const divisionFixtures: Record<string, Match[]> = { [playerDivision]: generateDivisionFixtures(leagueClubIds, leagueTotalWeeks) };
  const divisionTables: Record<string, LeagueTableEntry[]> = { [playerDivision]: buildLeagueTable(divisionFixtures[playerDivision], leagueClubIds) };
  const fixtures = divisionFixtures[playerDivision];
  const leagueTable = divisionTables[playerDivision];

  const transferMarket: TransferListing[] = [];
  Object.values(clubs).forEach(c => {
    const clubPlayers = c.playerIds.map(id => allPlayers[id]).filter(Boolean);
    const benched = clubPlayers.filter(p => !c.lineup.includes(p.id));
    if (benched.length > 2) {
      const listed = shuffle(benched).slice(0, INITIAL_LISTINGS_MIN + Math.floor(Math.random() * INITIAL_LISTINGS_RANGE));
      listed.forEach(p => {
        transferMarket.push({ playerId: p.id, askingPrice: Math.round(p.value * (LISTING_PRICE_MIN_MULTIPLIER + Math.random() * LISTING_PRICE_RANDOM_RANGE)), sellerClubId: c.id, listedWeek: 1, listedSeason: 1, divisionId: c.divisionId });
      });
    }
  });

  const initialMarket = generateInitialMarket(1, 1);
  Object.assign(allPlayers, initialMarket.players);
  transferMarket.push(...initialMarket.listings);

  const initialFreeAgents = generateInitialFreeAgents(1);
  Object.assign(allPlayers, initialFreeAgents.players);
  const initialFreeAgentIds = initialFreeAgents.freeAgentIds;

  const initClub = clubs[clubId];
  const objectives = generateObjectives(initClub);

  const startingPlayers = initClub.playerIds.map(id => allPlayers[id]).filter(Boolean);
  const startAvgOVR = startingPlayers.length > 0
    ? Math.round(startingPlayers.reduce((s, p) => s + p.overall, 0) / startingPlayers.length)
    : 0;

  const messages: Message[] = [
    { id: crypto.randomUUID(), week: 1, season: 1, type: 'board', title: 'Welcome, Manager!', body: `The board of ${initClub.name} welcomes you. We expect great things this season. Check your objectives in the Club tab.`, read: false },
    { id: crypto.randomUUID(), week: 1, season: 1, type: 'general', title: 'Transfer Window Open', body: 'The transfer window is now open. Scout the market and strengthen your squad before it closes in Week 8.', read: false },
  ];

  const pcInit = clubs[clubId];
  const pcData = leagueClubData.find(cd => cd.id === clubId);
  const initialStaff = generateInitialStaff(pcInit.reputation);
  const availableHires = generateStaffMarket();
  const youthCoachQuality = getStaffBonus(initialStaff, 'youth-coach');
  const { prospects: youthProspects, players: youthPlayers } = generateYouthProspects(
    clubId, pcInit.youthRating, youthCoachQuality, 1, 3 + Math.floor(Math.random() * 2), pcData?.squadQuality
  );
  youthPlayers.forEach(p => { allPlayers[p.id] = p; });
  const nextIntakePreview = generateIntakePreview(pcInit.youthRating);
  const scoutCount = initialStaff.filter(s => s.role === 'scout').length;

  const cup = generateCupDraw(leagueClubIds);
  const leagueCup = generateLeagueCupDraw(leagueClubIds);

  set({
    gameStarted: true, playerClubId: clubId, season: 1, week: 1, totalWeeks: leagueTotalWeeks,
    gameMode: get().gameMode || 'sandbox',
    transferWindowOpen: true, clubs, players: allPlayers, fixtures, leagueTable,
    divisionFixtures, divisionTables, divisionClubs, playerDivision,
    lastSeasonTurnover: null, derbies: DERBIES,
    activeLoans: [], incomingLoanOffers: [], outgoingLoanRequests: [],
    transferMarket, shortlist: [], scoutWatchList: [], freeAgents: initialFreeAgentIds, transferNews: [], boardObjectives: objectives, boardConfidence: STARTING_BOARD_CONFIDENCE,
    currentScreen: 'dashboard', previousScreen: null, currentMatchResult: null, trainingFocus: 'fitness',
    messages, seasonHistory: [], incomingOffers: [], matchSubsUsed: 0, matchPhase: 'none', matchTeamTalk: 'none', currentCupTieId: null,
    settings: { matchSpeed: 'normal', showOverallOnPitch: true, autoSave: true, hapticsEnabled: true },
    tactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
    training: {
      schedule: { mon: 'fitness', tue: 'attacking', wed: 'defending', thu: 'mentality', fri: 'tactical' },
      intensity: 'medium', individualPlans: [], tacticalFamiliarity: STARTING_TACTICAL_FAMILIARITY,
    },
    staff: { members: initialStaff, availableHires },
    scouting: { maxAssignments: scoutCount, assignments: [], reports: [], discoveredPlayers: [] },
    youthAcademy: { prospects: youthProspects, nextIntakePreview, youthPreviewEnhanced: false },
    facilities: {
      trainingLevel: pcInit.facilities, youthLevel: pcInit.youthRating,
      stadiumStands: (() => { const lvl = Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.fanBase / STADIUM_LEVEL_DIVISOR)); return { north: lvl, south: lvl, east: lvl, west: lvl }; })(),
      medicalLevel: Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.facilities * MEDICAL_LEVEL_FACTOR)),
      recoveryLevel: Math.min(FACILITY_MAX_LEVEL, Math.round(pcInit.facilities * RECOVERY_LEVEL_FACTOR)),
      upgradeInProgress: null,
    },
    financeHistory: [], matchPlayerRatings: [],
    unlockedAchievements: [], pendingAchievementIds: [],
    managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
    clubRecords: createEmptyRecords(),
    careerTimeline: [createMilestone('season_start', 'Career Begins', `Started managing ${ALL_CLUBS.find(c => c.id === clubId)?.name || 'a club'}.`, 1, 1, 'calendar')],
    managerProgression: createDefaultProgression(),
    cup,
    leagueCup,
    championsCup: null,
    shieldCup: null,
    virtualClubs: {},
    continentalQualification: null,
    continentalCoefficients: {},
    domesticSuperCup: null,
    continentalSuperCup: null,
    currentContinentalMatchId: null,
    currentContinentalCompetition: null,
    currentLeagueCupTieId: null,
    weeklyObjectives: generateMonthlyObjectives(true),
    objectiveStreak: 0,
    objectivesStartWeek: 1,
    completedCoachTaskIds: [],
    weekCliffhangers: [],
    rivalries: {},
    pairFamiliarity: (() => {
      const fam: Record<string, number> = {};
      const ids = initClub.lineup.filter(id => allPlayers[id]);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = ids[i] < ids[j] ? `${ids[i]}-${ids[j]}` : `${ids[j]}-${ids[i]}`;
          fam[key] = INITIAL_FAMILIARITY_SEED;
        }
      }
      return fam;
    })(),
    lastMatchDrama: null,
    lastMatchCompetition: null,
    seasonStartAvgOVR: startAvgOVR,
    seasonTransfersBought: [],
    seasonTransfersSold: [],
    seasonTotalIncome: 0,
    seasonTotalExpenses: 0,
    sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 },
    weeklyDigest: null,
    pendingStoryline: null,
    activeStorylineChains: [],
    completedStorylineChainIds: [],
    pendingFarewell: [],
    sponsorDeals: generateStarterDeals(pcInit.reputation, 1),
    sponsorOffers: [],
    sponsorSlotCooldowns: {},
    merchandise: getDefaultMerchState(),
    fanMood: 50,
    pendingPressConference: null,
    halfTimeState: null,
    preMatchLeaguePosition: 0,
    seasonPhase: 'regular',
    activeNegotiation: null,
    pendingTransferTalk: null,
    pendingGemReveal: null,
    activeChallenge: null,
    selectedPlayerId: null,
    lastMatchXPGain: 0,
    seasonGrowthTracker: {},
    monetization: {
      ...DEFAULT_MONETIZATION_STATE,
      entitlements: get().monetization?.entitlements || [],
      firstLaunchTimestamp: get().monetization?.firstLaunchTimestamp || Date.now(),
      subscription: get().monetization?.subscription || null,
    },
  });
}
