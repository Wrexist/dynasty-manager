import { Club, Player, Match, MatchWeather, LeagueTableEntry, FormationType, TransferListing, BoardObjective, GameScreen, Message, SeasonHistory, IncomingOffer, GameSettings, TacticalInstructions, TrainingState, TrainingModule, StaffMember, ScoutingState, ScoutRegion, YouthAcademyState, FacilitiesState, FinanceRecord, PlayerMatchRating, LoanDeal, IncomingLoanOffer, OutgoingLoanRequest, CupState, PressConference, ContractOffer, ActiveChallenge, LeagueId, SeasonTurnover, DerbyRivalry, ClubRecords, SeasonPhase, CareerMilestone, ManagerProgression, PerkId, StorylineEvent, ActiveStorylineChain, SponsorDeal, SponsorOffer, SponsorNegotiationProposal, SponsorSlotId, MerchState, MerchProductLine, MerchPricingTier, MerchCampaignType, CliffhangerItem, MatchDramaType, SessionStats, HeadToHeadRecord, MonetizationState, ProductId, CosmeticCategory, AdRewardType, SubscriptionInfo, TransferNewsEntry, NationalTeamState, NationalTeamOffer, InternationalTournamentState, GameMode, CareerManager, JobVacancy, JobOffer, ActiveInterview, PitchTone, ManagerBonus, LeagueCupState, ContinentalTournamentState, ContinentalCompetition, VirtualClub, SuperCupMatch, TransferTalk, TeamTalkType, PenaltyKick, PenaltyShootoutCtx, MatchShout, ShoutType, NegotiationStrike, OpenedPackRecord, OpenPackResult, ReleasePackedPlayerResult, QuickSellPackedPlayerResult, PackTierKey, PackUnlockMethod, LoadError } from '@/types/game';
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

  // Autosave status (UI-only — not persisted)
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  lastSavedAt: number | null;
  saveFailureMessage: string | null;

  // Capture Studio: true while a staged marketing-footage session is active.
  // performSave refuses to write while set, so a capture session can never
  // reach a save slot. Session-only — never persisted; cleared by
  // loadGame/resetGame.
  captureSession: boolean;

  // Corrupted-save / version-mismatch banner state. Populated by loadGame()
  // when a slot can't be loaded cleanly; consumed by SaveRecoveryDialog.
  // Not persisted.
  loadError: LoadError | null;

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
  preMatchSnapshot: {
    fixtures: Match[];
    divisionFixtures: Record<string, Match[]>;
    divisionTables: Record<string, LeagueTableEntry[]>;
    players: Record<string, Player>;
    boardConfidence: number;
    leagueTable: LeagueTableEntry[];
    // Optional fields (added post-v71): everything else playCurrentMatch
    // writes, so rewindMatch doesn't leave double-counted stats/messages/
    // rivalries or mid-match sub changes behind. Older snapshots lack them —
    // rewindMatch restores them only when present (no migration needed).
    clubs?: Record<string, Club>;
    managerStats?: GameState['managerStats'];
    managerProgression?: ManagerProgression;
    careerTimeline?: CareerMilestone[];
    rivalries?: Record<string, HeadToHeadRecord>;
    pairFamiliarity?: Record<string, number>;
    clubPowerRankings?: Record<string, number>;
    sessionStats?: SessionStats;
    messages?: Message[];
    pendingPressConference?: PressConference | null;
  } | null;
  shortlist: string[];
  scoutWatchList: string[];
  incomingOffers: IncomingOffer[];
  activeLoans: LoanDeal[];
  incomingLoanOffers: IncomingLoanOffer[];
  outgoingLoanRequests: OutgoingLoanRequest[];
  freeAgents: string[];
  negotiationStrikes: Record<string, NegotiationStrike>;
  contractStrikes: Record<string, NegotiationStrike>;

  // Transfer News Feed
  transferNews: TransferNewsEntry[];

  // Match
  currentMatchResult: Match | null;
  matchSubsUsed: number;
  /** Player ids substituted OFF during the current match (transient — NOT
   *  persisted; reset each match alongside matchSubsUsed). makeMatchSub
   *  rejects bringing one of these back on — a substituted player cannot
   *  re-enter the match. */
  matchSubbedOffIds: string[];
  matchPlayerRatings: PlayerMatchRating[];
  halfTimeState: HalfState | null;
  currentMatchWeather: MatchWeather | null;
  matchPhase: 'none' | 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time' | 'penalties';
  matchTeamTalk: TeamTalkType;
  penaltyShootoutKicks: PenaltyKick[];
  // Interactive shootout context (tap-to-aim). Transient — never persisted.
  penaltyShootoutCtx: PenaltyShootoutCtx | null;
  penaltyShootoutRevealIndex: number;
  matchShouts: MatchShout[];
  preMatchLeaguePosition: number;
  lastMatchXPGain: number;
  currentCupTieId: string | null;

  // Systems
  tactics: TacticalInstructions;
  tacticalPresets: import('@/types/game').TacticalPreset[];
  training: TrainingState;
  staff: { members: StaffMember[]; availableHires: StaffMember[]; lastMarketRefreshWeek?: number; lastMarketRefreshSeason?: number };
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
  activeInterview: ActiveInterview | null;

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
  initGame: (clubId: string, options?: { communityPackEnabled?: boolean }) => Promise<void> | void;
  initializeLeague: (leagueId: string) => void;
  setScreen: (screen: GameScreen) => void;
  selectPlayer: (id: string | null) => void;
  selectClub: (id: string | null) => void;
  advanceWeek: () => Promise<void> | void;
  advanceToNextMatch: () => Promise<void> | void;
  endSeason: () => void;
  saveGame: (slot?: number) => void;
  flushSave: () => void;
  flushPendingOnly: () => void;
  flushForLifecycle: () => void;
  loadGame: (slot?: number) => boolean;
  /** Attempt to load from the per-slot backup, bypassing the primary. Used
   *  by the SaveRecoveryDialog when the primary save is unrecoverable. */
  attemptSaveRecovery: (slot: number) => boolean;
  /** Dismiss any pending `loadError` banner (user clicked "Skip"). */
  clearLoadError: () => void;
  resetGame: (slot?: number) => void;
  markMessageRead: (id: string) => void;
  markAllRead: () => void;
  updateSettings: (partial: Partial<GameSettings>) => void;

  // Actions — Club
  setFormation: (f: FormationType) => void;
  setDefensiveFormation: (f: FormationType | null) => void;
  updateLineup: (lineup: string[], subs: string[]) => void;
  autoFillTeam: () => { changes: number; chemistryLabel: string; chemistryBonus: number; undersized: boolean; undersizedDetail?: string; proRequired?: boolean };
  setTrainingFocus: (f: 'fitness' | 'attacking' | 'defending' | 'mentality') => void;
  setSetPieceTaker: (playerId: string | undefined) => void;
  setPenaltyTaker: (playerId: string | undefined) => void;

  // Actions — Transfer
  executeTransfer: (playerId: string, fee: number) => { success: boolean; message: string };
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

  // Actions — Contract Strikes
  getContractStrikes: (playerId: string) => number;
  isContractLocked: (playerId: string) => { locked: boolean; weeksRemaining: number };
  recordContractStrike: (playerId: string) => number;
  clearContractStrikes: (playerId: string) => void;

  // Actions — Loans
  loanOut: (playerId: string, toClubId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => { success: boolean; message: string };
  recallLoan: (loanId: string) => { success: boolean; message: string };
  respondToLoanOffer: (offerId: string, accept: boolean) => { success: boolean; message: string };
  processLoanReturns: (forceAll?: boolean) => void;
  buyLoanedPlayer: (loanId: string) => { success: boolean; message: string };
  terminateLoan: (loanId: string) => { success: boolean; message: string };
  requestLoan: (playerId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => { outcome: 'accepted' | 'rejected' | 'counter'; counterWageSplit?: number; counterDuration?: number; message: string };
  evaluateLoanRequest: (playerId: string, duration: number, wageSplit: number) => { acceptChance: number; ownerClubName: string } | null;
  /** Accept a pending counter-offer (status 'counter') — executes the loan
   *  at the counter terms and clears the request record. */
  acceptLoanCounter: (requestId: string) => { success: boolean; message: string };
  cancelLoanRequest: (requestId: string) => void;
  renewContract: (playerId: string, years: number, newWage: number) => { success: boolean; message: string };

  // Actions — Match
  playCurrentMatch: () => Match | null;
  playFirstHalf: () => HalfState | null;
  playSecondHalf: () => Match | null;
  playExtraTime: () => Match | null;
  playPenalties: () => void;
  revealNextPenaltyKick: () => void;
  /** Interactive shootout: resolve the player's aimed kick. Returns the kick
   *  or null when it isn't the player's turn / taker is invalid. */
  takeAimedPenalty: (takerId: string, aimX: number, aimY: number, rattled?: boolean) => PenaltyKick | null;
  /** Interactive shootout: resolve the opponent's next (auto-aimed) kick. */
  revealOpponentPenalty: () => PenaltyKick | null;
  // World Cup mode — interactive national-team matches (Phase D).
  playWorldCupFirstHalf: () => HalfState | null;
  playWorldCupSecondHalf: () => Match | null;
  playWorldCupExtraTime: () => Match | null;
  playWorldCupPenalties: () => Match | null;
  finalizeWorldCupPenalties: () => void;
  skipPenaltyShootout: () => void;
  clearMatchResult: () => void;
  rewindMatch: () => void;
  loadMatchForReview: (week: number) => void;
  cleanupAbandonedMatch: () => void;
  /** Returns `{ success: false, message }` when the sub is rejected (max
   *  subs used, stale out-player, suspended/injured in-player, re-entry
   *  attempt) so the UI can surface the reason instead of toasting a
   *  false success. */
  makeMatchSub: (outId: string, inId: string, minute?: number) => { success: boolean; message?: string };
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
  praiseStaff: (staffId: string) => { success: boolean; message: string };
  criticizeStaff: (staffId: string) => { success: boolean; message: string };
  renewStaffContract: (staffId: string) => { success: boolean; message: string };
  refreshStaffMarket: () => { success: boolean; message: string };
  assignScout: (region: ScoutRegion) => { success: boolean; message?: string };
  cancelAssignment: (assignmentId: string) => void;
  boostScoutReports: () => void;
  dismissScoutReport: (reportId: string) => void;
  addToWatchList: (playerId: string) => void;
  removeFromWatchList: (playerId: string) => void;
  promoteYouth: (playerId: string) => { success: boolean; message?: string };
  releaseYouth: (playerId: string) => void;
  setYouthFocus: (playerId: string, focus: import('@/types/game').YouthFocus) => void;
  spotlightYouth: (playerId: string) => { success: boolean; message: string };
  startUpgrade: (type: 'training' | 'youth' | 'medical' | 'recovery' | 'stadium-north' | 'stadium-south' | 'stadium-east' | 'stadium-west') => void;

  // Actions — Achievements
  clearPendingAchievements: () => void;

  // Actions — Coach Checklist
  markCoachTaskComplete: (taskId: string) => void;
  // Grant the one-off XP reward for finishing the first-session onboarding
  // checklist. Idempotent (persisted flag); returns true only when it paid out.
  completeOnboardingChecklist: () => boolean;
  // Claim the XP for a completed weekly/monthly objective.
  claimObjective: (objectiveId: string) => void;
  // Claim today's daily login-streak reward (manager XP). The streak itself is
  // device-global (persisted outside the save); returns the resulting status,
  // or null if today has already been claimed.
  claimDailyStreakReward: () => import('@/utils/dailyStreak').DailyStreakStatus | null;
  // Redeem a signed offline code (money / manager XP). Verifies the signature,
  // blocks reuse (device-global), applies the reward to the current save, and
  // returns the outcome for the UI to surface.
  redeemCode: (code: string) => Promise<import('@/types/game').RedeemResult>;
  // Take the active live event's daily Festival check-in (device-global points).
  // Returns the updated progress, or null if no event is live / already checked
  // in today.
  festivalCheckIn: () => import('@/utils/liveEvents').LiveEventProgress | null;
  // Claim a Festival reward tier (grants manager XP into the active save).
  // Returns the updated progress + XP granted, or null if the tier is locked,
  // unknown, already claimed, or no event is live.
  claimFestivalTier: (tierId: string) => { progress: import('@/utils/liveEvents').LiveEventProgress; xp: number } | null;

  // Actions — Press Conferences & Storylines
  respondToPress: (tone: import('@/types/game').PressResponseTone) => void;
  dismissPress: () => void;
  respondToStoryline: (optionIndex: number) => void;
  dismissStoryline: () => void;

  // Actions — Weekly Digest
  dismissWeeklyDigest: () => void;

  // Actions — Transfer Talk
  respondToTransferTalk: (optionIndex: number) => { tone: string; succeeded?: boolean; playerName: string; msgTitle: string; msgBody: string } | null;
  dismissTransferTalk: () => { playerName: string; msgTitle: string; msgBody: string } | null;
  openTransferTalk: (playerId: string) => void;

  // Actions — Contract Negotiation
  startNegotiation: (playerId: string, isRenewal: boolean) => { success: boolean; lockedWeeks?: number } | void;
  /** Returns a failure object when the deal is blocked up-front (e.g. the
   *  club can't afford the agent fee + loyalty bonus); void otherwise —
   *  round results flow through `activeNegotiation.status`. */
  submitWageOffer: (wage: number, years?: number) => { success: false; message: string } | void;
  cancelNegotiation: () => void;

  // Actions — Challenge Mode
  startChallenge: (scenarioId: string, clubId: string) => void;

  // Actions — Sponsorship
  acceptSponsorOffer: (offerId: string) => void;
  rejectSponsorOffer: (offerId: string) => void;
  negotiateSponsorOffer: (offerId: string, proposal: SponsorNegotiationProposal) => void;
  terminateSponsorDeal: (dealId: string) => void;

  // Actions — Merchandise
  toggleProductLine: (line: MerchProductLine) => { success: boolean; message: string };
  setMerchPricing: (tier: MerchPricingTier) => void;
  launchCampaign: (type: MerchCampaignType) => { success: boolean; message: string };
  cancelCampaign: () => void;
  launchSignatureDrop: (playerId: string) => { success: boolean; message: string };
  cancelSignatureDrop: () => void;

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
  startFreeTrial: () => void;

  // Actions — National Team
  initNationalTeam: (nationality: string) => void;
  // Boot a standalone World Cup game (gameMode 'world-cup') with the chosen
  // nation — no club/league. Generates squad + tournament, lands on the picker.
  startWorldCup: (nationality: string) => void;
  // Capture Studio: boot a throwaway (never-saved) World Cup session staged at
  // a Final between two star nations. Returns false for an unknown scenario id.
  startCaptureScenario: (scenarioId: string) => boolean;
  // Wipe the in-memory session to a fresh state WITHOUT touching the save
  // slot on disk (resetGame deletes the slot; this doesn't).
  clearActiveSession: () => void;
  setManagerNationality: (nationality: string) => void;
  acceptNationalTeamOffer: () => void;
  declineNationalTeamOffer: () => void;
  updateNationalSquad: (squad: string[], lineup: string[], subs: string[]) => void;
  setNationalFormation: (f: FormationType) => void;
  /** Lock in the pre-tournament squad and start the tournament. */
  confirmNationalSquad: (squad: string[], lineup: string[], subs: string[]) => void;
  replaceInjuredInternationalPlayer: (outId: string, inId: string) => void;
  // advanceInternationalWeek and playInternationalMatch are handled
  // internally by orchestrationSlice.advanceWeek() — no public actions needed.

  // Actions — Career Mode
  initCareerGame: (manager: CareerManager, clubId: string, options?: { communityPackEnabled?: boolean }) => Promise<void> | void;
  applyForJob: (vacancyId: string) => { success: boolean; message: string };
  respondToJobOffer: (offerId: string, accept: boolean) => { success: boolean; message?: string };
  resignFromClub: () => void;
  moveToNewClub: (clubId: string, offer: JobOffer) => void;
  retireManager: () => void;

  // Interview flow
  startInterview: (vacancyId: string) => { success: boolean; message: string };
  submitPitchResponse: (tone: PitchTone) => void;
  completeInterview: () => void;
  dismissInterview: () => void;

  // Enhanced negotiation
  negotiateContractOffer: (offerId: string, salary: number, contractLength: number, bonuses: ManagerBonus[]) => void;

  // Actions — Farewell
  pendingFarewell: { playerId: string; playerName: string; seasonsServed: number; stats: { label: string; value: string }[] }[];
  dismissFarewell: () => void;

  // Pack Opening
  openedPacks: OpenedPackRecord[];
  packPityCounter: number;
  /** Legacy fields — last (season, week) a pack was opened. The
   *  once-per-week throttle has been removed; these are kept for save
   *  compatibility and analytics but no longer gate opening. */
  lastPackWeek: number;
  lastPackSeason: number;
  /** Per-real-day open counts for free + ad pack methods. `date` is an
   *  ISO `YYYY-MM-DD` keyed off the device clock; both `free` and `ad`
   *  bucket opens by tier. Resets implicitly when the date rolls over.
   *  IAP and currency opens are NOT tracked here — they have no daily cap. */
  dailyPackOpens: {
    date: string;
    free: Partial<Record<PackTierKey, number>>;
    ad: Partial<Record<PackTierKey, number>>;
  };
  /** Open a pack via a specific method. The page is responsible for
   *  picking the right method (free → ad → iap → currency priority) and
   *  for completing any out-of-band cost (showing the rewarded ad,
   *  running the consumable IAP) BEFORE invoking openPack. Pass
   *  `skipPayment: true` for `ad` and `iap` methods so the slice doesn't
   *  charge in-game funds. The slice still re-validates eligibility and
   *  daily caps as defence in depth. */
  openPack: (
    tier: PackTierKey,
    opts?: { method?: PackUnlockMethod; skipPayment?: boolean },
  ) => OpenPackResult;
  /** Eligibility pre-flight. Run this BEFORE charging real money or
   *  starting a rewarded ad so the user can never pay/watch and then be
   *  rejected by `openPack` (e.g. an active challenge that blocks
   *  signings). Returns the same blocking message `openPack` would. */
  canOpenPack: (
    tier: PackTierKey,
    method?: PackUnlockMethod,
  ) => { ok: true } | { ok: false; message: string };
  releasePackedPlayer: (playerId: string) => ReleasePackedPlayerResult;
  quickSellPackedPlayer: (playerId: string) => QuickSellPackedPlayerResult;
  /** Revert the most recent quick-sell (only valid immediately after). */
  undoLastQuickSell: () => boolean;

  // Community Pack
  communityPackEnabled: boolean;
  cpPool: {
    shuffleSeed: number;
    cursor: number;
    usedFcIds: string[];
    marketListings: string[];
    lastMarketRefreshWeek: number;
    lastSeedSeason: number;
  };
}
