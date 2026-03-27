import { Club, Player, Match, LeagueTableEntry, FormationType, TransferListing, BoardObjective, GameScreen, Message, SeasonHistory, IncomingOffer, GameSettings, TacticalInstructions, TrainingState, TrainingModule, StaffMember, ScoutingState, ScoutRegion, YouthAcademyState, FacilitiesState, FinanceRecord, PlayerMatchRating, LoanDeal, IncomingLoanOffer, OutgoingLoanRequest, CupState, PressConference, ContractOffer, ActiveChallenge, LeagueId, SeasonTurnover, DerbyRivalry, ClubRecords, SeasonPhase, CareerMilestone, ManagerProgression, PerkId, StorylineEvent, ActiveStorylineChain, SponsorDeal, SponsorOffer, SponsorSlotId, MerchState, MerchProductLine, MerchPricingTier, MerchCampaignType, CliffhangerItem, MatchDramaType, SessionStats, HeadToHeadRecord, MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo, TransferNewsEntry, NationalTeamState, InternationalTournamentState, GameMode, CareerManager, JobVacancy, JobOffer } from '@/types/game';
import type { ObjectiveInstance } from '@/utils/weeklyObjectives';
import type { HalfState } from '@/engine/match';

export interface GameState {
  // Core
  gameStarted: boolean;
  playerClubId: string;
  currentScreen: GameScreen;
  previousScreen: GameScreen | null;
  selectedPlayerId: string | null;
  selectedClubId: string | null;
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

  // League System
  divisionFixtures: Record<string, Match[]>;
  divisionTables: Record<string, LeagueTableEntry[]>;
  divisionClubs: Record<string, string[]>;
  playerDivision: LeagueId;
  seasonPhase: SeasonPhase;
  lastSeasonTurnover: SeasonTurnover | null;
  derbies: DerbyRivalry[];

  // Transfer & Loans
  transferMarket: TransferListing[];
  shortlist: string[];
  scoutWatchList: string[];
  incomingOffers: IncomingOffer[];
  activeLoans: LoanDeal[];
  incomingLoanOffers: IncomingLoanOffer[];
  outgoingLoanRequests: OutgoingLoanRequest[];
  freeAgents: string[];

  // Transfer News Feed
  transferNews: TransferNewsEntry[];

  // Match
  currentMatchResult: Match | null;
  matchSubsUsed: number;
  matchPlayerRatings: PlayerMatchRating[];
  halfTimeState: HalfState | null;
  matchPhase: 'none' | 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time' | 'penalties';
  preMatchLeaguePosition: number;
  lastMatchXPGain: number;
  currentCupTieId: string | null;

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
  pairFamiliarity: Record<string, number>;

  // Press, Storylines & Contracts
  pendingPressConference: PressConference | null;
  pendingStoryline: StorylineEvent | null;
  pendingGemReveal: { playerId: string; region: string } | null;
  fanMood: number; // 0-100, affects stadium income
  activeNegotiation: ContractOffer | null;

  // Weekly Objectives
  weeklyObjectives: ObjectiveInstance[];

  // Storyline Chains
  activeStorylineChains: ActiveStorylineChain[];

  // Sponsorship
  sponsorDeals: SponsorDeal[];
  sponsorOffers: SponsorOffer[];
  sponsorSlotCooldowns: Partial<Record<SponsorSlotId, number>>;

  // Merchandise
  merchandise: MerchState;

  // Head-to-head rivalry records across seasons
  rivalries: Record<string, HeadToHeadRecord>;

  // Cliffhangers (post-advanceWeek "one more week" hooks)
  weekCliffhangers: CliffhangerItem[];

  // Objective streak tracking
  objectiveStreak: number;

  // Match drama type from last played match
  lastMatchDrama: MatchDramaType;

  // Session stats for session summary
  sessionStats: SessionStats;

  // Newly unlocked achievements (for modal display, cleared after shown)
  pendingAchievementIds: string[];

  // Monetization
  monetization: MonetizationState;

  // Weekly Digest (post-advanceWeek summary)
  weeklyDigest: {
    incomeEarned: number;
    expensesPaid: number;
    injuriesThisWeek: string[];
    recoveriesThisWeek: string[];
    offersReceived: number;
    moraleChange: number;
  } | null;

  // Challenge Mode
  activeChallenge: ActiveChallenge | null;

  // Game Mode
  gameMode: GameMode;

  // Career Mode (null in sandbox)
  careerManager: CareerManager | null;
  jobVacancies: JobVacancy[];
  jobOffers: JobOffer[];

  // National Team
  nationalTeam: NationalTeamState | null;
  internationalTournament: InternationalTournamentState | null;
  managerNationality: string | null;

  // Actions — Core
  initGame: (clubId: string) => void;
  setScreen: (screen: GameScreen) => void;
  selectPlayer: (id: string | null) => void;
  selectClub: (id: string | null) => void;
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
  autoFillTeam: () => void;
  setTrainingFocus: (f: 'fitness' | 'attacking' | 'defending' | 'mentality') => void;
  setSetPieceTaker: (playerId: string | undefined) => void;
  setPenaltyTaker: (playerId: string | undefined) => void;

  // Actions — Transfer
  executeTransfer: (playerId: string, fee: number) => { success: boolean; message: string };
  makeOffer: (playerId: string, fee: number) => { success: boolean; message: string };
  evaluateOffer: (playerId: string, fee: number) => { acceptChance: number; wouldTriggerSellOn: boolean; sellOnPct: number; budgetAfter: number; wageImpact: number; ratio: number; positionCount: number; totalSquadSize: number } | null;
  makeOfferWithNegotiation: (playerId: string, fee: number) => { outcome: 'accepted' | 'rejected' | 'counter'; counterFee?: number; message: string };
  addToShortlist: (id: string) => void;
  removeFromShortlist: (id: string) => void;
  listPlayerForSale: (playerId: string) => { appeased: boolean };
  unlistPlayer: (playerId: string) => void;
  respondToOffer: (offerId: string, accept: boolean) => { success: boolean; message: string };
  negotiateIncomingOffer: (offerId: string, counterFee: number) => { outcome: 'accepted' | 'rejected' | 'counter'; counterFee?: number; message: string };
  acceptIncomingOfferAtFee: (offerId: string, fee: number) => { success: boolean; message: string };
  evaluateIncomingCounter: (offerId: string, counterFee: number) => { acceptChance: number; budgetAfter: number; squadSizeAfter: number; positionCountAfter: number } | null;
  signFreeAgent: (playerId: string, wage: number, years: number) => { success: boolean; message: string };

  // Actions — Loans
  loanOut: (playerId: string, toClubId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => { success: boolean; message: string };
  recallLoan: (loanId: string) => { success: boolean; message: string };
  respondToLoanOffer: (offerId: string, accept: boolean) => { success: boolean; message: string };
  processLoanReturns: () => void;
  buyLoanedPlayer: (loanId: string) => { success: boolean; message: string };
  terminateLoan: (loanId: string) => { success: boolean; message: string };
  requestLoan: (playerId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => { outcome: 'accepted' | 'rejected' | 'counter'; counterWageSplit?: number; counterDuration?: number; message: string };
  evaluateLoanRequest: (playerId: string, duration: number, wageSplit: number) => { acceptChance: number; ownerClubName: string } | null;
  cancelLoanRequest: (requestId: string) => void;
  renewContract: (playerId: string, years: number, newWage: number) => { success: boolean; message: string };

  // Actions — Match
  playCurrentMatch: () => Match | null;
  playFirstHalf: () => HalfState | null;
  playSecondHalf: () => Match | null;
  playExtraTime: () => Match | null;
  playPenalties: () => Match | null;
  clearMatchResult: () => void;
  makeMatchSub: (outId: string, inId: string) => void;

  // Actions — Systems
  setTactics: (partial: Partial<TacticalInstructions>) => void;
  updateTraining: (schedule: Partial<TrainingState['schedule']>, intensity?: TrainingState['intensity']) => void;
  updateDrillSchedule: (drills: Partial<TrainingState['drillSchedule']>) => void;
  setIndividualTraining: (playerId: string, focus: TrainingModule | null) => void;
  hireStaff: (staffId: string) => void;
  fireStaff: (staffId: string) => void;
  assignScout: (region: ScoutRegion) => void;
  cancelAssignment: (assignmentId: string) => void;
  addToWatchList: (playerId: string) => void;
  removeFromWatchList: (playerId: string) => void;
  promoteYouth: (playerId: string) => void;
  releaseYouth: (playerId: string) => void;
  startUpgrade: (type: 'training' | 'youth' | 'stadium' | 'medical' | 'recovery') => void;

  // Actions — Achievements
  clearPendingAchievements: () => void;

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

  // Actions — Sponsorship
  acceptSponsorOffer: (offerId: string) => void;
  rejectSponsorOffer: (offerId: string) => void;
  terminateSponsorDeal: (dealId: string) => void;

  // Actions — Merchandise
  toggleProductLine: (line: MerchProductLine) => { success: boolean; message: string };
  setMerchPricing: (tier: MerchPricingTier) => void;
  launchCampaign: (type: MerchCampaignType) => { success: boolean; message: string };
  cancelCampaign: () => void;

  // Actions — Manager Progression
  unlockPerk: (perkId: PerkId) => { success: boolean; message: string };

  // Actions — Prestige
  startPrestige: (optionId: 'rival' | 'drop-division' | 'restart-perks') => void;

  // Actions — Monetization
  grantEntitlement: (productId: ProductId) => void;
  restoreEntitlements: (productIds: ProductId[]) => void;
  setCosmetic: (category: CosmeticCategory, cosmeticId: string) => void;
  clearCosmetic: (category: CosmeticCategory) => void;
  claimAdReward: (rewardType: AdRewardType) => boolean;
  dismissStarterKit: () => void;
  initMonetizationTimestamp: () => void;
  applyTransferBudgetBonus: () => void;
  applySeasonBonus: () => void;
  updateSubscription: (info: SubscriptionInfo | null) => void;

  // Actions — National Team
  initNationalTeam: (nationality: string) => void;
  updateNationalSquad: (squad: string[], lineup: string[], subs: string[]) => void;
  setNationalFormation: (f: FormationType) => void;
  // advanceInternationalWeek and playInternationalMatch are handled
  // internally by orchestrationSlice.advanceWeek() — no public actions needed.

  // Actions — Career Mode
  initCareerGame: (manager: CareerManager, clubId: string) => void;
  applyForJob: (vacancyId: string) => { success: boolean; message: string };
  respondToJobOffer: (offerId: string, accept: boolean) => void;
  resignFromClub: () => void;
  moveToNewClub: (clubId: string, offer: JobOffer) => void;
  retireManager: () => void;

  // Actions — Farewell
  pendingFarewell: { playerId: string; playerName: string; seasonsServed: number; stats: { label: string; value: string }[] }[];
  dismissFarewell: () => void;
}
