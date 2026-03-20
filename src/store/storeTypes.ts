import { Club, Player, Match, LeagueTableEntry, FormationType, TransferListing, BoardObjective, GameScreen, Message, SeasonHistory, IncomingOffer, PlayerAttributes, GameSettings, TacticalInstructions, TrainingState, TrainingModule, StaffMember, ScoutingState, ScoutRegion, YouthAcademyState, FacilitiesState, FinanceRecord, PlayerMatchRating, SlotSummary, LoanDeal, IncomingLoanOffer, CupState, PressConference, ContractOffer, ActiveChallenge, DivisionId, PlayoffState, PromotionRelegation, DerbyRivalry, ClubRecords, SeasonPhase, CareerMilestone, ManagerProgression, PerkId, StorylineEvent, ActiveStorylineChain } from '@/types/game';
import type { ObjectiveInstance } from '@/utils/weeklyObjectives';
import type { HalfState } from '@/engine/match';

export interface GameState {
  // Core
  gameStarted: boolean;
  playerClubId: string;
  currentScreen: GameScreen;
  previousScreen: GameScreen | null;
  selectedPlayerId: string | null;
  season: number;
  week: number;
  totalWeeks: number;
  transferWindowOpen: boolean;
  messages: Message[];
  boardObjectives: BoardObjective[];
  boardConfidence: number;
  seasonHistory: SeasonHistory[];
  settings: GameSettings;
  activeSlot: number;

  // Club & Squad
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Match[];
  leagueTable: LeagueTableEntry[];
  trainingFocus: 'fitness' | 'attacking' | 'defending' | 'mentality';

  // Division System
  divisionFixtures: Record<DivisionId, Match[]>;
  divisionTables: Record<DivisionId, LeagueTableEntry[]>;
  divisionClubs: Record<DivisionId, string[]>;
  playerDivision: DivisionId;
  seasonPhase: SeasonPhase;
  playoffs: PlayoffState[];
  lastPromotionRelegation: PromotionRelegation | null;
  derbies: DerbyRivalry[];

  // Transfer & Loans
  transferMarket: TransferListing[];
  shortlist: string[];
  incomingOffers: IncomingOffer[];
  activeLoans: LoanDeal[];
  incomingLoanOffers: IncomingLoanOffer[];

  // Match
  currentMatchResult: Match | null;
  matchSubsUsed: number;
  matchPlayerRatings: PlayerMatchRating[];
  halfTimeState: HalfState | null;
  matchPhase: 'none' | 'first_half' | 'half_time' | 'second_half' | 'full_time';

  // Systems
  tactics: TacticalInstructions;
  training: TrainingState;
  staff: { members: StaffMember[]; availableHires: StaffMember[] };
  scouting: ScoutingState;
  youthAcademy: YouthAcademyState;
  facilities: FacilitiesState;
  financeHistory: FinanceRecord[];
  unlockedAchievements: string[];
  managerStats: { totalWins: number; totalDraws: number; totalLosses: number; totalSpent: number; totalEarned: number };
  clubRecords: ClubRecords;
  careerTimeline: CareerMilestone[];
  managerProgression: ManagerProgression;
  cup: CupState;

  // Press, Storylines & Contracts
  pendingPressConference: PressConference | null;
  pendingStoryline: StorylineEvent | null;
  fanMood: number; // 0-100, affects stadium income
  activeNegotiation: ContractOffer | null;

  // Weekly Objectives
  weeklyObjectives: ObjectiveInstance[];

  // Storyline Chains
  activeStorylineChains: ActiveStorylineChain[];

  // Challenge Mode
  activeChallenge: ActiveChallenge | null;

  // Actions — Core
  initGame: (clubId: string) => void;
  setScreen: (screen: GameScreen) => void;
  selectPlayer: (id: string | null) => void;
  advanceWeek: () => void;
  endSeason: () => void;
  saveGame: (slot?: number) => void;
  loadGame: (slot?: number) => boolean;
  resetGame: (slot?: number) => void;
  markMessageRead: (id: string) => void;
  markAllRead: () => void;
  updateSettings: (partial: Partial<GameSettings>) => void;

  // Actions — Club
  setFormation: (f: FormationType) => void;
  setDefensiveFormation: (f: FormationType | null) => void;
  updateLineup: (lineup: string[], subs: string[]) => void;
  setTrainingFocus: (f: 'fitness' | 'attacking' | 'defending' | 'mentality') => void;

  // Actions — Transfer
  makeOffer: (playerId: string, fee: number) => { success: boolean; message: string };
  addToShortlist: (id: string) => void;
  removeFromShortlist: (id: string) => void;
  listPlayerForSale: (playerId: string) => void;
  unlistPlayer: (playerId: string) => void;
  respondToOffer: (offerId: string, accept: boolean) => { success: boolean; message: string };

  // Actions — Loans
  loanOut: (playerId: string, toClubId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => { success: boolean; message: string };
  recallLoan: (loanId: string) => { success: boolean; message: string };
  respondToLoanOffer: (offerId: string, accept: boolean) => { success: boolean; message: string };
  processLoanReturns: () => void;
  renewContract: (playerId: string, years: number, newWage: number) => { success: boolean; message: string };

  // Actions — Match
  playCurrentMatch: () => Match | null;
  playFirstHalf: () => HalfState | null;
  playSecondHalf: () => Match | null;
  clearMatchResult: () => void;
  makeMatchSub: (outId: string, inId: string) => void;

  // Actions — Systems
  setTactics: (partial: Partial<TacticalInstructions>) => void;
  updateTraining: (schedule: Partial<TrainingState['schedule']>, intensity?: TrainingState['intensity']) => void;
  setIndividualTraining: (playerId: string, focus: TrainingModule | null) => void;
  hireStaff: (staffId: string) => void;
  fireStaff: (staffId: string) => void;
  assignScout: (region: ScoutRegion) => void;
  cancelAssignment: (assignmentId: string) => void;
  promoteYouth: (playerId: string) => void;
  releaseYouth: (playerId: string) => void;
  startUpgrade: (type: 'training' | 'youth' | 'stadium' | 'medical') => void;

  // Actions — Press Conferences & Storylines
  respondToPress: (tone: 'confident' | 'humble' | 'deflect') => void;
  dismissPress: () => void;
  respondToStoryline: (optionIndex: number) => void;
  dismissStoryline: () => void;

  // Actions — Contract Negotiation
  startNegotiation: (playerId: string, isRenewal: boolean) => void;
  submitWageOffer: (wage: number) => void;
  cancelNegotiation: () => void;

  // Actions — Challenge Mode
  startChallenge: (scenarioId: string, clubId: string) => void;

  // Actions — Manager Progression
  unlockPerk: (perkId: PerkId) => { success: boolean; message: string };

  // Actions — Prestige
  startPrestige: (optionId: 'rival' | 'drop-division' | 'restart-perks') => void;

  // Actions — Farewell
  pendingFarewell: { playerId: string; playerName: string; seasonsServed: number; stats: { label: string; value: string }[] } | null;
  dismissFarewell: () => void;
}

// @deprecated — Import directly from '@/utils/helpers' instead. This re-export exists only for backward compatibility.
export { addMsg, getSuffix, pick, clamp } from '@/utils/helpers';
