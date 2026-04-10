import { Club, Player, Match, LeagueTableEntry, FormationType, TransferListing, BoardObjective, GameScreen, Message, SeasonHistory, IncomingOffer, GameSettings, TacticalInstructions, TrainingState, TrainingModule, StaffMember, ScoutingState, ScoutRegion, YouthAcademyState, FacilitiesState, FinanceRecord, PlayerMatchRating, LoanDeal, IncomingLoanOffer, OutgoingLoanRequest, CupState, PressConference, ContractOffer, ActiveChallenge, LeagueId, SeasonTurnover, DerbyRivalry, ClubRecords, SeasonPhase, CareerMilestone, ManagerProgression, PerkId, StorylineEvent, ActiveStorylineChain, SponsorDeal, SponsorOffer, SponsorSlotId, MerchState, MerchProductLine, MerchPricingTier, MerchCampaignType, CliffhangerItem, MatchDramaType, SessionStats, HeadToHeadRecord, MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo, TransferNewsEntry, NationalTeamState, NationalTeamOffer, InternationalTournamentState, GameMode, CareerManager, JobVacancy, JobOffer, LeagueCupState, ContinentalTournamentState, ContinentalCompetition, VirtualClub, SuperCupMatch, TransferTalk, TeamTalkType, PenaltyKick, MatchShout, ShoutType, NegotiationStrike } from '@/types/game';
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
  friendlies: Match[];
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
  galacticoUsedThisSeason: boolean;
  invincibleUsedThisSeason: boolean;
  preMatchSnapshot: { fixtures: Match[]; divisionFixtures: Record<string, Match[]>; players: Record<string, Player>; boardConfidence: number; leagueTable: LeagueTableEntry[] } | null;
  shortlist: string[];
  scoutWatchList: string[];
  incomingOffers: IncomingOffer[];
  activeLoans: LoanDeal[];
  incomingLoanOffers: IncomingLoanOffer[];
  outgoingLoanRequests: OutgoingLoanRequest[];
  freeAgents: string[];
  negotiationStrikes: Record<string, NegotiationStrike>;

  // Transfer News Feed
  transferNews: TransferNewsEntry[];

  // Match
  currentMatchResult: Match | null;
  matchSubsUsed: number;
  matchPlayerRatings: PlayerMatchRating[];
  halfTimeState: HalfState | null;
  matchPhase: 'none' | 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time' | 'penalties';
  matchTeamTalk: TeamTalkType;
  penaltyShootoutKicks: PenaltyKick[];
  penaltyShootoutRevealIndex: number;
  matchShouts: MatchShout[];
  preMatchLeaguePosition: number;
  lastMatchXPGain: number;
  currentCupTieId: string | null;

  // Systems
  tactics: TacticalInstructions;
  tacticalPresets: import('@/types/game').TacticalPreset[];
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
  seasonGrowthTracker: Record<string, number>;
  transferFilters: {
    tab: 'market' | 'deals' | 'freeAgents' | 'news';
    posFilter: number;
    searchQuery: string;
    sortBy: 'overall' | 'price' | 'age' | 'potential';
    faSortBy: 'overall' | 'age' | 'potential' | 'wage';
    divFilter: string;
    newsTypeFilter: 'all' | 'transfer' | 'loan' | 'free_agent';
    hideUnaffordable: boolean;
    showShortlistOnly: boolean;
  };
  setTransferFilter: (updates: Partial<GameState['transferFilters']>) => void;

  // Press, Storylines & Contracts
  pendingPressConference: PressConference | null;
  pendingStoryline: StorylineEvent | null;
  pendingGemReveal: { playerId: string; region: string } | null;
  fanMood: number; // 0-100, affects stadium income
  activeNegotiation: ContractOffer | null;
  pendingTransferTalk: TransferTalk | null;

  // Monthly Objectives (evaluated each week, cycled every 4 weeks)
  weeklyObjectives: ObjectiveInstance[];
  objectivesStartWeek: number;

  // Storyline Chains
  activeStorylineChains: ActiveStorylineChain[];
  completedStorylineChainIds: string[];

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

  // Coach checklist — persisted completion IDs (once done, stays done)
  completedCoachTaskIds: string[];

  // Match drama type from last played match
  lastMatchDrama: MatchDramaType;

  // Competition name for the last played match (e.g. 'Champions Cup - Group A, MD3')
  lastMatchCompetition: string | null;

  // Season tracking fields for SeasonHistory enrichment
  seasonStartAvgOVR: number;
  seasonTransfersBought: { playerName: string; fee: number }[];
  seasonTransfersSold: { playerName: string; fee: number }[];
  seasonTotalIncome: number;
  seasonTotalExpenses: number;

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
    playerDevelopment: { playerName: string; attribute: string; newValue: number }[];
    trainingGains: { playerName: string; attribute: string }[];
    scoutReportsCompleted: number;
    contractWarnings: string[];
    objectiveProgress: { title: string; completed: boolean; xpEarned: number }[];
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
  nationalTeamOffer: NationalTeamOffer | null;
  showNationalTeamOffer: boolean;

  // Continental Tournaments
  championsCup: ContinentalTournamentState | null;
  shieldCup: ContinentalTournamentState | null;
  conferenceCup: ContinentalTournamentState | null;
  virtualClubs: Record<string, VirtualClub>;
  continentalQualification: { champions: string[]; shield: string[]; conference: string[] } | null;
  /** Multi-season continental coefficients for seeding (clubId → coefficient) */
  continentalCoefficients: Record<string, import('@/types/game').ContinentalCoefficient>;

  // League Cup (secondary domestic cup)
  leagueCup: LeagueCupState;

  // Super Cups
  domesticSuperCup: SuperCupMatch | null;
  continentalSuperCup: SuperCupMatch | null;

  // Global Team Power Rankings (ELO-based, updated after every match)
  clubPowerRankings: Record<string, number>;

  // Current continental match tracking
  currentContinentalMatchId: string | null;
  currentContinentalCompetition: ContinentalCompetition | null;
  currentLeagueCupTieId: string | null;

  // Actions — Core
  initGame: (clubId: string) => void;
  initializeLeague: (leagueId: string) => void;
  setScreen: (screen: GameScreen) => void;
  selectPlayer: (id: string | null) => void;
  selectClub: (id: string | null) => void;
  advanceWeek: () => void;
  advanceToNextMatch: () => void;
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
  autoFillTeam: () => { changes: number; chemistryLabel: string; chemistryBonus: number; undersized: boolean; undersizedDetail?: string };
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
  listPlayerForSale: (playerId: string, customAskingPrice?: number) => { appeased: boolean };
  unlistPlayer: (playerId: string) => void;
  respondToOffer: (offerId: string, accept: boolean) => { success: boolean; message: string };
  negotiateIncomingOffer: (offerId: string, counterFee: number) => { outcome: 'accepted' | 'rejected' | 'counter'; counterFee?: number; message: string };
  acceptIncomingOfferAtFee: (offerId: string, fee: number) => { success: boolean; message: string };
  evaluateIncomingCounter: (offerId: string, counterFee: number) => { acceptChance: number; budgetAfter: number; squadSizeAfter: number; positionCountAfter: number } | null;
  getPlayerStrikes: (playerId: string) => number;
  isNegotiationLocked: (playerId: string) => { locked: boolean; weeksRemaining: number };
  recordNegotiationStrike: (playerId: string) => number;
  clearNegotiationStrikes: (playerId: string) => void;
  clearExpiredCooldowns: () => void;
  signFreeAgent: (playerId: string, wage: number, years: number) => { success: boolean; message: string };
  releasePlayer: (playerId: string) => { success: boolean; message: string };

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
  playPenalties: () => void;
  revealNextPenaltyKick: () => void;
  skipPenaltyShootout: () => void;
  clearMatchResult: () => void;
  rewindMatch: () => void;
  loadMatchForReview: (week: number) => void;
  cleanupAbandonedMatch: () => void;
  makeMatchSub: (outId: string, inId: string) => void;
  setTeamTalk: (talk: TeamTalkType) => void;
  useShout: (type: ShoutType, minute: number) => boolean;
  getActiveShout: (minute: number) => MatchShout | null;

  // Actions — Systems
  setTactics: (partial: Partial<TacticalInstructions>) => void;
  saveTacticalPreset: (name: string) => void;
  loadTacticalPreset: (presetId: string) => void;
  deleteTacticalPreset: (presetId: string) => void;
  updateTraining: (schedule: Partial<TrainingState['schedule']>, intensity?: TrainingState['intensity']) => void;
  updateDrillSchedule: (drills: Partial<TrainingState['drillSchedule']>) => void;
  setIndividualTraining: (playerId: string, focus: TrainingModule | null) => void;
  hireStaff: (staffId: string) => void;
  fireStaff: (staffId: string) => void;
  assignScout: (region: ScoutRegion) => void;
  cancelAssignment: (assignmentId: string) => void;
  boostScoutReports: () => void;
  dismissScoutReport: (reportId: string) => void;
  addToWatchList: (playerId: string) => void;
  removeFromWatchList: (playerId: string) => void;
  promoteYouth: (playerId: string) => { success: boolean; message?: string };
  releaseYouth: (playerId: string) => void;
  startUpgrade: (type: 'training' | 'youth' | 'medical' | 'recovery' | 'stadium-north' | 'stadium-south' | 'stadium-east' | 'stadium-west') => void;

  // Actions — Achievements
  clearPendingAchievements: () => void;

  // Actions — Coach Checklist
  markCoachTaskComplete: (taskId: string) => void;

  // Actions — Press Conferences & Storylines
  respondToPress: (tone: import('@/types/game').PressResponseTone) => void;
  dismissPress: () => void;
  respondToStoryline: (optionIndex: number) => void;
  dismissStoryline: () => void;

  // Actions — Transfer Talk
  respondToTransferTalk: (optionIndex: number) => { tone: string; succeeded?: boolean; playerName: string; msgTitle: string; msgBody: string } | null;
  dismissTransferTalk: () => { playerName: string; msgTitle: string; msgBody: string } | null;
  openTransferTalk: (playerId: string) => void;

  // Actions — Contract Negotiation
  startNegotiation: (playerId: string, isRenewal: boolean) => void;
  submitWageOffer: (wage: number, years?: number) => void;
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
  claimAdReward: (rewardType: AdRewardType, contextKey?: string) => boolean;
  dismissStarterKit: () => void;
  initMonetizationTimestamp: () => void;
  applyTransferBudgetBonus: () => void;
  applySeasonBonus: () => void;
  applyYouthPreview: () => void;
  applyDoubleXP: () => void;
  updateSubscription: (info: SubscriptionInfo | null) => void;

  // Actions — National Team
  initNationalTeam: (nationality: string) => void;
  setManagerNationality: (nationality: string) => void;
  acceptNationalTeamOffer: () => void;
  declineNationalTeamOffer: () => void;
  updateNationalSquad: (squad: string[], lineup: string[], subs: string[]) => void;
  setNationalFormation: (f: FormationType) => void;
  replaceInjuredInternationalPlayer: (outId: string, inId: string) => void;
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
