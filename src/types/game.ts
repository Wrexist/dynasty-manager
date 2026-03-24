// ── Division System ──
export type DivisionId = 'div-1' | 'div-2' | 'div-3' | 'div-4';

export interface DivisionInfo {
  id: DivisionId;
  name: string;
  shortName: string;
  tier: 1 | 2 | 3 | 4;
  teamCount: number;
  totalWeeks: number;
  autoPromoteSlots: number;
  playoffSlots: number;
  autoRelegateSlots: number;
  replacedSlots: number;
  description: string;
  difficulty: string;
  colorClass: string;
  prizeMoney: number;
  averageWage: number;
}

export interface PlayoffTie {
  id: string;
  round: 'semi-leg1' | 'semi-leg2' | 'final';
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
}

export interface PlayoffState {
  divisionId: DivisionId;
  bracket: PlayoffTie[];
  currentRound: 'semi-leg1' | 'semi-leg2' | 'final' | null;
  promotedClubId: string | null;
}

export interface PromotionRelegation {
  promoted: { clubId: string; fromDivision: DivisionId; toDivision: DivisionId }[];
  relegated: { clubId: string; fromDivision: DivisionId; toDivision: DivisionId }[];
  playoffWinners: { clubId: string; fromDivision: DivisionId; toDivision: DivisionId }[];
  replacedClubs: string[];
  newClubs: string[];
}

export interface DerbyRivalry {
  clubIdA: string;
  clubIdB: string;
  name: string;
  intensity: 1 | 2 | 3;
}

export interface HeadToHeadRecord {
  wins: number;
  draws: number;
  losses: number;
  lastResult: 'W' | 'D' | 'L' | null;
  grudgeLevel: number; // 0-5, increases on losses, decreases on wins
}

export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';

export type FormationType = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '4-1-4-1' | '3-4-3' | '5-3-2';

export type SeasonPhase = 'regular' | 'playoffs' | 'offseason' | 'international';

export type GameScreen = 'dashboard' | 'squad' | 'tactics' | 'transfers' | 'club' | 'match' | 'player-detail' | 'league-table' | 'inbox' | 'season-summary' | 'calendar' | 'training' | 'scouting' | 'staff' | 'youth-academy' | 'facilities' | 'finance' | 'merchandise' | 'match-prep' | 'match-review' | 'board' | 'settings' | 'comparison' | 'manager-profile' | 'cup' | 'perks' | 'trophy-cabinet' | 'prestige' | 'hall-of-managers' | 'team-detail' | 'shop' | 'help' | 'national-team' | 'international-tournament';

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  mental: number;
}

export interface PlayerPersonality {
  professionalism: number;  // 1-20: affects training effectiveness & discipline
  ambition: number;         // 1-20: affects growth speed & transfer demands
  temperament: number;      // 1-20: affects card risk & morale stability
  loyalty: number;          // 1-20: affects contract demands & transfer requests
  leadership: number;       // 1-20: affects team morale & mentoring
}

export type PersonalityLabel = 'Model Professional' | 'Born Leader' | 'Club Legend' | 'Maverick' | 'Loyal Servant' | 'Steady Hand' | 'Hot Head' | 'Enigma' | 'Ambitious' | 'Laid Back' | 'Determined';

// ── Injury System ──
export type InjuryType = 'knock' | 'muscle_strain' | 'hamstring' | 'ligament' | 'fracture' | 'concussion' | 'acl';
export type InjurySeverity = 'minor' | 'moderate' | 'severe';

export interface InjuryDetails {
  type: InjuryType;
  severity: InjurySeverity;
  weeksRemaining: number;
  totalWeeks: number;
  /** Elevated re-injury risk (0-1) for several weeks after return */
  reinjuryRisk: number;
  /** Weeks of elevated re-injury risk remaining after return */
  reinjuryWeeksRemaining: number;
  /** Fitness level the player returns at (0-100) */
  fitnessOnReturn: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  nationality: string;
  position: Position;
  attributes: PlayerAttributes;
  overall: number;
  potential: number;
  clubId: string;
  wage: number;
  value: number;
  contractEnd: number;
  fitness: number;
  morale: number;
  form: number;
  injured: boolean;
  injuryWeeks: number;
  injuryDetails?: InjuryDetails;
  goals: number;
  assists: number;
  appearances: number;
  careerGoals: number;
  careerAssists: number;
  careerAppearances: number;
  yellowCards: number;
  redCards: number;
  suspendedUntilWeek?: number;
  growthDelta?: number;
  listedForSale?: boolean;
  onLoan?: boolean;
  loanFromClubId?: string;
  loanToClubId?: string;
  personality?: PlayerPersonality;
  releaseClause?: number; // if set, any club can sign by paying this fee
  sellOnPercentage?: number; // 0-50, % of future sale profit owed to previous club
  sellOnClubId?: string; // club owed the sell-on fee
  joinedSeason?: number; // season when the player joined this club
  isFromYouthAcademy?: boolean; // true if player was promoted from youth academy
  wantsToLeave?: boolean; // player has submitted a transfer request
  lowMoraleWeeks?: number; // consecutive weeks with morale below threshold
  internationalCaps?: number;
  internationalGoals?: number;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  color: string;
  secondaryColor: string;
  budget: number;
  wageBill: number;
  reputation: number;
  facilities: number;
  youthRating: number;
  fanBase: number;
  boardPatience: number;
  playerIds: string[];
  formation: FormationType;
  defensiveFormation?: FormationType; // out-of-possession formation
  lineup: string[];
  subs: string[];
  divisionId: DivisionId;
  aiManagerProfile?: AIManagerProfile;
  /** Player ID assigned as corner/free-kick taker */
  setPieceTakerId?: string;
  /** Player ID assigned as penalty taker */
  penaltyTakerId?: string;
  stadiumName?: string;
  stadiumCapacity?: number;
}

export interface ClubData {
  id: string;
  name: string;
  shortName: string;
  color: string;
  secondaryColor: string;
  budget: number;
  reputation: number;
  facilities: number;
  youthRating: number;
  fanBase: number;
  boardPatience: number;
  squadQuality: number;
  league: string;
  divisionId: DivisionId;
  stadiumName: string;
  stadiumCapacity: number;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'own_goal' | 'penalty_scored' | 'penalty_missed' | 'shot_saved' | 'shot_missed' | 'hit_woodwork' | 'goal_line_clearance' | 'foul' | 'yellow_card' | 'red_card' | 'injury' | 'substitution' | 'half_time' | 'full_time' | 'kickoff' | 'extra_time_goal' | 'penalty_shootout' | 'commentary';
  playerId?: string;
  assistPlayerId?: string;
  clubId: string;
  description: string;
  momentum?: number;
}

export interface MatchStats {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeFouls: number;
  awayFouls: number;
  homeCorners: number;
  awayCorners: number;
  homeXG?: number;
  awayXG?: number;
}

export interface Match {
  id: string;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats?: MatchStats;
  penaltyShootout?: { home: number; away: number };
}

export interface LeagueTableEntry {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
  cleanSheets: number;
}

export interface TransferListing {
  playerId: string;
  askingPrice: number;
  sellerClubId: string;
}

export interface IncomingOffer {
  id: string;
  playerId: string;
  buyerClubId: string;
  fee: number;
  week: number;
}

// ── Loans ──
export interface LoanDeal {
  id: string;
  playerId: string;
  fromClubId: string;
  toClubId: string;
  startWeek: number;
  startSeason: number;
  durationWeeks: number;
  wageSplit: number; // 0-100, percentage of wage paid by borrowing club
  recallClause: boolean;
  obligatoryBuyFee?: number; // if set, buying club must purchase at loan end
}

export interface IncomingLoanOffer {
  id: string;
  playerId: string;
  fromClubId: string;
  durationWeeks: number;
  wageSplit: number;
  recallClause: boolean;
  week: number;
  obligatoryBuyFee?: number;
}

export interface TransferNewsEntry {
  id: string;
  week: number;
  season: number;
  type: 'transfer' | 'loan' | 'free_agent';
  playerName: string;
  playerPosition: Position;
  playerOverall: number;
  playerAge: number;
  fromClubId: string;
  toClubId: string;
  fee?: number;
  loanDuration?: number;
}

export interface BoardObjective {
  id: string;
  description: string;
  priority: 'critical' | 'important' | 'optional';
  completed: boolean;
}

export interface Message {
  id: string;
  week: number;
  season: number;
  type: 'match_preview' | 'match_result' | 'board' | 'injury' | 'transfer' | 'contract' | 'development' | 'general' | 'sponsorship';
  title: string;
  body: string;
  read: boolean;
}

export interface CareerMilestone {
  id: string;
  type: 'first_win' | 'first_trophy' | 'promotion' | 'cup_win' | 'record_signing' | 'biggest_win' | 'milestone_matches' | 'unbeaten_run' | 'youth_graduate' | 'season_start' | 'prestige' | 'custom';
  title: string;
  description: string;
  season: number;
  week: number;
  icon?: string;
}

export type PerkId =
  | 'tactical_genius' | 'youth_developer' | 'transfer_shark' | 'motivator'
  | 'disciplinarian' | 'fitness_guru' | 'scout_network' | 'fan_favourite'
  // Tier 1 additions
  | 'set_piece_coach' | 'media_savvy'
  // Tier 2 additions
  | 'loan_master' | 'deadline_dealer'
  // Tier 3 additions
  | 'iron_will' | 'formation_master'
  // Tier 4
  | 'galactico' | 'wonder_coach'
  // Tier 5
  | 'dynasty_builder' | 'invincible';

export interface ManagerPerk {
  id: PerkId;
  name: string;
  description: string;
  icon: string;
  cost: number; // XP cost
  tier: 1 | 2 | 3 | 4 | 5;
  prerequisite?: PerkId;
}

export interface ManagerProgression {
  xp: number;
  level: number;
  unlockedPerks: PerkId[];
  prestigeLevel: number;
}

export interface RecordEntry {
  name: string;
  value: number;
  season: number;
  detail?: string;
}

export interface ClubRecords {
  allTimeTopScorer: RecordEntry | null;
  allTimeTopAssister: RecordEntry | null;
  bestSeasonPoints: RecordEntry | null;
  worstSeasonPoints: RecordEntry | null;
  biggestWin: RecordEntry | null;
  mostGoalsInSeason: RecordEntry | null;
  fewestGoalsAgainst: RecordEntry | null;
  highestLeaguePosition: RecordEntry | null;
  cupWins: number;
  seasonsManaged: number;
  hallOfFame: RecordEntry[];
}

export interface SeasonAward {
  name: string;
  recipientName: string;
  recipientClub: string;
  stat?: number;
}

export interface SeasonHistory {
  season: number;
  position: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  topScorer: { name: string; goals: number };
  boardVerdict: 'excellent' | 'good' | 'acceptable' | 'poor' | 'sacked';
  cupResult?: string;
  divisionId?: DivisionId;
  promoted?: boolean;
  relegated?: boolean;
  awards?: SeasonAward[];
}

export interface FormationSlot {
  x: number;
  y: number;
  pos: Position;
}

export const FORMATION_POSITIONS: Record<FormationType, FormationSlot[]> = {
  '4-3-3': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 18, y: 25, pos: 'LB' }, { x: 38, y: 20, pos: 'CB' }, { x: 62, y: 20, pos: 'CB' }, { x: 82, y: 25, pos: 'RB' },
    { x: 30, y: 45, pos: 'CM' }, { x: 50, y: 40, pos: 'CM' }, { x: 70, y: 45, pos: 'CM' },
    { x: 18, y: 70, pos: 'LW' }, { x: 50, y: 78, pos: 'ST' }, { x: 82, y: 70, pos: 'RW' },
  ],
  '4-4-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 18, y: 25, pos: 'LB' }, { x: 38, y: 20, pos: 'CB' }, { x: 62, y: 20, pos: 'CB' }, { x: 82, y: 25, pos: 'RB' },
    { x: 18, y: 50, pos: 'LM' }, { x: 38, y: 45, pos: 'CM' }, { x: 62, y: 45, pos: 'CM' }, { x: 82, y: 50, pos: 'RM' },
    { x: 36, y: 75, pos: 'ST' }, { x: 64, y: 75, pos: 'ST' },
  ],
  '3-5-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 28, y: 20, pos: 'CB' }, { x: 50, y: 18, pos: 'CB' }, { x: 72, y: 20, pos: 'CB' },
    { x: 12, y: 45, pos: 'LM' }, { x: 35, y: 40, pos: 'CM' }, { x: 50, y: 35, pos: 'CDM' }, { x: 65, y: 40, pos: 'CM' }, { x: 88, y: 45, pos: 'RM' },
    { x: 36, y: 72, pos: 'ST' }, { x: 64, y: 72, pos: 'ST' },
  ],
  '4-2-3-1': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 18, y: 25, pos: 'LB' }, { x: 38, y: 20, pos: 'CB' }, { x: 62, y: 20, pos: 'CB' }, { x: 82, y: 25, pos: 'RB' },
    { x: 35, y: 40, pos: 'CDM' }, { x: 65, y: 40, pos: 'CDM' },
    { x: 18, y: 60, pos: 'LW' }, { x: 50, y: 55, pos: 'CAM' }, { x: 82, y: 60, pos: 'RW' },
    { x: 50, y: 78, pos: 'ST' },
  ],
  '4-1-4-1': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 18, y: 25, pos: 'LB' }, { x: 38, y: 20, pos: 'CB' }, { x: 62, y: 20, pos: 'CB' }, { x: 82, y: 25, pos: 'RB' },
    { x: 50, y: 38, pos: 'CDM' },
    { x: 18, y: 55, pos: 'LM' }, { x: 38, y: 52, pos: 'CM' }, { x: 62, y: 52, pos: 'CM' }, { x: 82, y: 55, pos: 'RM' },
    { x: 50, y: 78, pos: 'ST' },
  ],
  '3-4-3': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 28, y: 20, pos: 'CB' }, { x: 50, y: 18, pos: 'CB' }, { x: 72, y: 20, pos: 'CB' },
    { x: 18, y: 45, pos: 'LM' }, { x: 40, y: 40, pos: 'CM' }, { x: 60, y: 40, pos: 'CM' }, { x: 82, y: 45, pos: 'RM' },
    { x: 18, y: 70, pos: 'LW' }, { x: 50, y: 78, pos: 'ST' }, { x: 82, y: 70, pos: 'RW' },
  ],
  '5-3-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 10, y: 28, pos: 'LB' }, { x: 30, y: 20, pos: 'CB' }, { x: 50, y: 18, pos: 'CB' }, { x: 70, y: 20, pos: 'CB' }, { x: 90, y: 28, pos: 'RB' },
    { x: 30, y: 45, pos: 'CM' }, { x: 50, y: 42, pos: 'CM' }, { x: 70, y: 45, pos: 'CM' },
    { x: 36, y: 72, pos: 'ST' }, { x: 64, y: 72, pos: 'ST' },
  ],
};

export const POSITION_COMPATIBILITY: Record<Position, Position[]> = {
  'GK': ['GK'],
  'CB': ['CB'],
  'LB': ['LB', 'LM'],
  'RB': ['RB', 'RM'],
  'CDM': ['CDM', 'CM'],
  'CM': ['CM', 'CDM', 'CAM'],
  'CAM': ['CAM', 'CM'],
  'LM': ['LM', 'LW', 'LB'],
  'RM': ['RM', 'RW', 'RB'],
  'LW': ['LW', 'LM', 'ST'],
  'RW': ['RW', 'RM', 'ST'],
  'ST': ['ST', 'CAM', 'LW', 'RW'],
};

// ── Settings ──
export interface GameSettings {
  matchSpeed: 'normal' | 'fast' | 'instant';
  showOverallOnPitch: boolean;
  autoSave: boolean;
}

// ── Tactics ──
export type Mentality = 'defensive' | 'cautious' | 'balanced' | 'attacking' | 'all-out-attack';
export type TeamWidth = 'narrow' | 'normal' | 'wide';
export type Tempo = 'slow' | 'normal' | 'fast';
export type DefensiveLine = 'deep' | 'normal' | 'high';

// ── AI Manager Profiles ──
export type AIManagerStyle = 'attacking' | 'defensive' | 'possession' | 'counter-attack' | 'balanced' | 'direct';

export interface AIManagerProfile {
  name: string;
  style: AIManagerStyle;
  defaultTactics: TacticalInstructions;
  /** How aggressively the AI buys players (0-1) */
  transferAggression: number;
  /** Preference for young players in transfers (0-1) */
  youthFocus: number;
  /** How much AI adapts tactics mid-match based on scoreline (0-1) */
  adaptability: number;
}

export interface TacticalInstructions {
  mentality: Mentality;
  width: TeamWidth;
  tempo: Tempo;
  defensiveLine: DefensiveLine;
  pressingIntensity: number;
}

// ── Training ──
export type TrainingModule = 'fitness' | 'attacking' | 'defending' | 'mentality' | 'set-pieces' | 'tactical';
export type TrainingIntensity = 'light' | 'medium' | 'heavy';

export interface TrainingSchedule {
  mon: TrainingModule;
  tue: TrainingModule;
  wed: TrainingModule;
  thu: TrainingModule;
  fri: TrainingModule;
}

export interface IndividualTraining {
  playerId: string;
  focus: TrainingModule;
}

export interface TrainingState {
  schedule: TrainingSchedule;
  intensity: TrainingIntensity;
  individualPlans: IndividualTraining[];
  tacticalFamiliarity: number;
}

// ── Staff ──
export type StaffRole = 'assistant-manager' | 'first-team-coach' | 'fitness-coach' | 'goalkeeping-coach' | 'scout' | 'youth-coach' | 'physio';

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  quality: number;
  wage: number;
}

// ── Scouting ──
export type ScoutRegion = 'domestic' | 'europe' | 'south-america' | 'africa' | 'asia';

export interface ScoutAssignment {
  id: string;
  region: ScoutRegion;
  weeksRemaining: number;
  totalWeeks: number;
}

export interface ScoutReport {
  id: string;
  playerId: string;
  knowledgeLevel: number;
  estimatedOverall: number;
  recommendation: 'sign' | 'monitor' | 'avoid';
  week: number;
  season: number;
}

export interface ScoutingState {
  maxAssignments: number;
  assignments: ScoutAssignment[];
  reports: ScoutReport[];
  discoveredPlayers: string[];
}

// ── Youth Academy ──
export interface YouthProspect {
  playerId: string;
  readyToPromote: boolean;
  developmentScore: number;
}

export interface YouthAcademyState {
  prospects: YouthProspect[];
  nextIntakePreview: { position: Position; estimatedPotential: number }[];
}

// ── Facilities ──
export interface FacilitiesState {
  trainingLevel: number;
  youthLevel: number;
  stadiumLevel: number;
  medicalLevel: number;
  recoveryLevel: number;
  upgradeInProgress: { type: string; weeksRemaining: number; totalWeeks: number } | null;
}

// ── Finance ──
export interface FinanceRecord {
  week: number;
  season: number;
  income: number;
  expenses: number;
  transfers: number;
  balance: number;
}

// ── Sponsorship ──
export type SponsorSlotId = 'kit_main' | 'kit_sleeve' | 'stadium_naming' | 'training_kit' | 'match_ball' | 'academy' | 'digital';

export type SponsorBonusCondition =
  | 'win_league' | 'top_2' | 'top_4' | 'top_6' | 'avoid_relegation'
  | 'win_cup' | 'cup_final' | 'cup_semi'
  | 'win_20_matches' | 'score_80_goals' | 'clean_sheets_15'
  | 'goal_diff_30' | 'promotion' | 'unbeaten_home_10';

export interface SponsorDef {
  id: string;
  name: string;
  industry: string;
  tier: 1 | 2 | 3 | 4 | 5;
  weeklyPaymentRange: [number, number];
  preferredDuration: number[];
  bonusConditions: SponsorBonusCondition[];
  minReputation: number;
}

export interface SponsorDeal {
  id: string;
  sponsorId: string;
  slotId: SponsorSlotId;
  weeklyPayment: number;
  seasonDuration: number;
  startSeason: number;
  performanceBonus: number;
  bonusCondition: SponsorBonusCondition;
  bonusMet: boolean;
  satisfaction: number;
  buyoutCost: number;
}

export interface SponsorOffer {
  id: string;
  sponsorId: string;
  slotId: SponsorSlotId;
  weeklyPayment: number;
  seasonDuration: number;
  performanceBonus: number;
  bonusCondition: SponsorBonusCondition;
  buyoutCost: number;
  expiresWeek: number;
}

export interface SponsorSlotDef {
  id: SponsorSlotId;
  label: string;
  valueTier: number;
  unlock: { facilityType: 'stadium' | 'training' | 'youth' | 'medical'; level: number } | null;
}

// ── Match Ratings ──
export interface PlayerMatchRating {
  playerId: string;
  rating: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

// ── Save Slots ──
export interface SlotSummary {
  slot: number;
  exists: boolean;
  clubName?: string;
  season?: number;
  position?: string;
  week?: number;
}

// Cup competition types
export type CupRound = 'R1' | 'R2' | 'R3' | 'R4' | 'QF' | 'SF' | 'F';

export interface CupTie {
  id: string;
  round: CupRound;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  week: number; // which league week this cup match is played
  penaltyShootout?: { home: number; away: number };
  winnerId?: string; // set on forfeits and resolved cup ties
}

export interface CupState {
  ties: CupTie[];
  currentRound: CupRound | null;
  eliminated: boolean;
  winner: string | null;
}

// ── Press Conferences ──
export type PressResponseTone = 'confident' | 'humble' | 'deflect';

export interface PressOption {
  tone: PressResponseTone;
  text: string;
  effects: {
    morale: number;       // -15 to +15
    boardConfidence: number; // -10 to +10
    fanMood: number;      // -10 to +10 (affects stadium income next week)
  };
}

export interface PressConference {
  id: string;
  context: 'post_win' | 'post_loss' | 'post_draw' | 'pre_big_match' | 'transfer_rumour' | 'poor_form' | 'good_form';
  question: string;
  options: [PressOption, PressOption, PressOption] | [PressOption, PressOption, PressOption, PressOption];
}

// ── Player Chemistry ──
export type ChemistryType = 'nationality' | 'mentor' | 'partnership' | 'loyalty';

export interface ChemistryLink {
  playerIdA: string;
  playerIdB: string;
  type: ChemistryType;
  strength: number; // 1-3
}

// ── Contract Negotiation ──
export type NegotiationStatus = 'pending' | 'in_progress' | 'accepted' | 'rejected' | 'expired';

export interface ContractOffer {
  id: string;
  playerId: string;
  type: 'new' | 'renewal';
  offeredWage: number;
  demandedWage: number;
  agentFee: number;
  loyaltyBonus: number;
  contractYears: number;
  round: number;       // negotiation round (1-3)
  status: NegotiationStatus;
  playerMood: number;  // 0-100, willingness to accept
}

// ── Challenge Mode ──
export interface ChallengeScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  startingClubId?: string;       // forced club, or null for choice
  seasonLimit: number;           // must complete within N seasons
  winCondition: string;
  constraints: string[];
  budgetModifier: number;        // multiplier: 0.5 = half budget, 2.0 = double
  youthOnly?: boolean;           // can only use players under 23
  noTransfers?: boolean;         // cannot buy players
}

// ── Storyline Events ──
export interface StorylineOption {
  label: string;
  text: string;
  effects: {
    morale?: number;
    boardConfidence?: number;
    fanMood?: number;
    targetPlayerId?: string;
    playerMorale?: number;
  };
}

export interface StorylineEvent {
  id: string;
  title: string;
  body: string;
  icon: string;
  options: StorylineOption[];
}

// ── Multi-Week Storyline Chains ──
export interface StorylineChainStep {
  weekOffset: number; // weeks from chain start
  title: string;
  body: string;
  icon: string;
  options: StorylineOption[];
  /** Which option index from previous step leads here (undefined = always triggers) */
  requiredPrevChoice?: number;
}

export interface StorylineChainDef {
  id: string;
  name: string;
  steps: StorylineChainStep[];
  /** Condition function is evaluated at runtime; chain definitions just store the id */
}

export interface ActiveStorylineChain {
  chainId: string;
  startWeek: number;
  currentStep: number;
  choices: number[]; // option index chosen at each step
  targetPlayerId?: string; // some chains focus on a specific player
}

export interface ActiveChallenge {
  scenarioId: string;
  startSeason: number;
  seasonsRemaining: number;
  completed: boolean;
  failed: boolean;
}

// ── Merchandise System ──

export type MerchProductLine = 'matchday_essentials' | 'replica_kits' | 'lifestyle_apparel' | 'memorabilia' | 'digital_global';

export type MerchPricingTier = 'budget' | 'standard' | 'premium';

export type MerchCampaignType = 'kit_launch' | 'title_race' | 'cup_run' | 'end_of_season_sale' | 'star_signing' | 'holiday_special';

export interface MerchCampaign {
  type: MerchCampaignType;
  weeksRemaining: number;
  totalWeeks: number;
  revenueBoost: number; // e.g. 0.8 = +80%
}

export interface MerchState {
  activeProductLines: MerchProductLine[];
  pricingTier: MerchPricingTier;
  activeCampaign: MerchCampaign | null;
  campaignCooldownWeeks: number;
  lastSeasonRevenue: number;
  currentSeasonRevenue: number;
  starPlayerDip: number; // weeks remaining of post-sale merch dip
  starSigningBuzz: number; // weeks remaining of post-signing merch boost
  kitLaunchUsedThisSeason: boolean; // prevents multiple kit launches per season
}

// ── Cliffhanger System ──
export type CliffhangerCategory = 'title_race' | 'big_match' | 'player_drama' | 'transfer_deadline' | 'board_pressure' | 'youth_breakthrough' | 'record_chase' | 'rivalry';

export interface CliffhangerItem {
  icon: string;
  text: string;
  category: CliffhangerCategory;
  intensity: 'low' | 'medium' | 'high';
}

// ── Match Drama ──
export type MatchDramaType = 'comeback_win' | 'late_winner' | 'thrashing' | 'underdog_upset' | 'heartbreak_loss' | null;

// ── Objective Rarity ──
export type ObjectiveRarity = 'common' | 'rare' | 'legendary';

// ── Session Stats ──
export interface SessionStats {
  startWeek: number;
  startSeason: number;
  weeksPlayed: number;
  xpEarned: number;
  matchesWon: number;
  matchesLost: number;
  objectivesCompleted: number;
}

// ── Monetization System ──

export type ProductId =
  | 'com.dynastymanager.pro'
  | 'com.dynastymanager.pro.monthly'
  | 'com.dynastymanager.pro.yearly'
  | 'com.dynastymanager.pro.lifetime'
  | 'com.dynastymanager.pack.manager'
  | 'com.dynastymanager.pack.stadium'
  | 'com.dynastymanager.pack.legends'
  | 'com.dynastymanager.bundle.all';

export type SubscriptionTier = 'monthly' | 'yearly' | 'lifetime';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  productId: ProductId;
  /** ISO date string of expiration, or null for lifetime */
  expiresAt: string | null;
  /** Whether the subscription has a billing issue (grace period) */
  isInGracePeriod: boolean;
  /** Whether the subscription will auto-renew */
  willRenew: boolean;
}

export type ProFeature =
  | 'ad_free'
  | 'advanced_analytics'
  | 'custom_tactics'
  | 'expanded_press'
  | 'historical_records'
  | 'instant_sim'
  | 'pro_badge';

export type CosmeticCategory = 'avatar' | 'title_badge' | 'celebration_text' | 'stadium_theme' | 'pitch_skin' | 'confetti_style' | 'cabinet_style' | 'prestige_badge' | 'hom_frame';

export interface CosmeticItem {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  pack: ProductId;
}

export type AdRewardType = 'scout_potential' | 'transfer_budget' | 'xp_double' | 'youth_preview' | 'season_bonus';

export interface MonetizationState {
  /** Product IDs the player has purchased */
  entitlements: ProductId[];
  /** Selected cosmetic per category */
  activeCosmetics: Partial<Record<CosmeticCategory, string>>;
  /** Ad rewards claimed this season (keyed by type + context) */
  adRewardsClaimed: Record<string, number>;
  /** Timestamp of first app launch (for time-limited offers) */
  firstLaunchTimestamp: number;
  /** Whether the starter kit offer has been dismissed or expired */
  starterKitDismissed: boolean;
  /** Active subscription info, null if no subscription */
  subscription: SubscriptionInfo | null;
}

// ── National Team System ──

export interface NationalTeamState {
  nationality: string;
  squad: string[];                        // player IDs called up (max 23)
  lineup: string[];                       // starting 11 player IDs
  subs: string[];                         // bench player IDs (up to 7)
  formation: FormationType;
  fifaRanking: number;                    // 1-51, used for seeding
  caps: Record<string, number>;           // playerId -> total caps
  internationalGoals: Record<string, number>; // playerId -> intl goals
  results: NationalTeamResult[];
}

export interface NationalTeamResult {
  season: number;
  opponent: string;                       // nationality name
  goalsFor: number;
  goalsAgainst: number;
  tournament: string;                     // "World Cup Group A", "Friendly", etc.
  round: string;
}

// ── International Tournament ──

export type InternationalTournamentType = 'world-cup' | 'continental';

export type InternationalKnockoutRound = 'R16' | 'QF' | 'SF' | 'F';

export interface InternationalTournamentState {
  type: InternationalTournamentType;
  name: string;                           // "World Cup Season 4", "Continental Cup Season 2"
  season: number;
  phase: 'group' | 'knockout' | 'complete';
  groups: InternationalGroup[];
  knockoutTies: InternationalKnockoutTie[];
  currentRound: InternationalKnockoutRound | null;
  playerEliminated: boolean;
  winner: string | null;                  // nationality name
  currentWeek: number;                    // tracks which international week we're on (47-52)
}

export interface InternationalGroup {
  name: string;                           // "Group A", "Group B", etc.
  teams: string[];                        // nationality names
  fixtures: InternationalFixture[];
  table: InternationalGroupEntry[];
}

export interface InternationalGroupEntry {
  nationality: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface InternationalFixture {
  id: string;
  homeNation: string;
  awayNation: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  week: number;                           // international break week (47-52)
}

export interface InternationalKnockoutTie {
  id: string;
  round: InternationalKnockoutRound;
  homeNation: string;
  awayNation: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  penaltyShootout?: { home: number; away: number };
  winnerId?: string;                      // nationality name of winner
  week: number;
}
