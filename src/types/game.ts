// ── League System ──
// LeagueId is a string identifier for each league division (e.g. 'eng', 'eng-2', 'esp', 'esp-2')
export type LeagueId = string;

export interface LeagueInfo {
  id: LeagueId;
  name: string;
  shortName: string;
  country: string;
  countryCode: string;
  teamCount: number;
  totalWeeks: number;
  replacedSlots: number;
  description: string;
  difficulty: string;
  colorClass: string;
  prizeMoney: number;
  averageWage: number;
  /** Quality tier for squad generation (1=elite, 2=strong, 3=mid, 4=developing) */
  qualityTier: 1 | 2 | 3 | 4;
  /** Tier within the country pyramid (1=top flight, 2=second tier, etc.) */
  tier: number;
  /** Country grouping key — same for all tiers in a country (e.g. 'eng' for all English leagues) */
  countryId: string;
  /** Number of auto-promotion spots from below (0 for top tier) */
  promotionSpots: number;
  /** Number of auto-relegation spots to tier below (0 for bottom tier) */
  relegationSpots: number;
  /** Number of playoff promotion spots from below */
  playoffSpots: number;
}

export interface QualificationZones {
  championsCup: number[];  // league positions that qualify for Champions Cup
  shieldCup: number[];     // league positions that qualify for Shield Cup
  conferenceCup: number[]; // league positions that qualify for Conference Cup
  replaced: number[];      // league positions that get relegated/replaced
  promotion: number[];     // league positions that qualify for auto-promotion (lower tiers)
  playoff: number[];       // league positions that enter promotion playoffs (lower tiers)
}

export interface SeasonTurnover {
  leagueId: LeagueId;
  promotedClubs: string[];    // Clubs promoted TO this league from below
  relegatedClubs: string[];   // Clubs relegated FROM this league to below
  playoffWinners: string[];   // Clubs promoted via playoffs
  /** @deprecated kept for save compat — use promotedClubs/relegatedClubs */
  replacedClubs?: string[];
  /** @deprecated kept for save compat */
  newClubs?: string[];
}

/** Describes the full league pyramid for a single country */
export interface CountryLeagueSystem {
  countryId: string;
  country: string;
  countryCode: string;
  /** League IDs ordered by tier (tier 1 first) */
  leagueIds: string[];
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

export type FormationType = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '4-1-4-1' | '3-4-3' | '5-3-2' | '4-5-1' | '4-1-2-1-2' | '3-4-1-2';

export type SeasonPhase = 'regular' | 'offseason' | 'international';

export type GameScreen = 'dashboard' | 'squad' | 'tactics' | 'transfers' | 'club' | 'match' | 'player-detail' | 'league-table' | 'inbox' | 'season-summary' | 'calendar' | 'training' | 'scouting' | 'packs' | 'staff' | 'youth-academy' | 'facilities' | 'finance' | 'merchandise' | 'match-prep' | 'match-review' | 'board' | 'settings' | 'comparison' | 'manager-profile' | 'cup' | 'league-cup' | 'champions-cup' | 'shield-cup' | 'conference-cup' | 'super-cup' | 'perks' | 'trophy-cabinet' | 'prestige' | 'hall-of-managers' | 'team-detail' | 'shop' | 'help' | 'whats-new' | 'national-team' | 'national-squad-picker' | 'international-tournament' | 'job-market' | 'career-overview' | 'ballon-dor' | 'festival' | 'dynasty-legacy' | 'world-cup-result';

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

/**
 * Player rarity tier — derived from overall rating + Ballon d'Or pedigree.
 *  - `legend`: world-class superstar with sustained award-winning form (OVR ≥ 90 + Ballon d'Or pedigree, or OVR ≥ 93)
 *  - `icon`:   elite superstar (OVR ≥ 88) — recognised globally, premium wage and value
 *  - `star`:   established first-team-quality at top level (OVR ≥ 82)
 *  - `rare`:   solid professional, regular starter (OVR ≥ 75)
 *  - `common`: rotation player or below (OVR < 75)
 *
 * Legend and icon tiers carry permanent value/wage premiums and trigger hype
 * effects (walkout animations, special badges). The tier is recomputed on
 * every meaningful overall change (development, training, decline, awards).
 */
export type PlayerRarity = 'common' | 'rare' | 'star' | 'icon' | 'legend';

/** Resolved tier/Ballon-d'Or shield artwork for the player-card background. */
export interface PlayerCardArt {
  src: string;
  filter?: string;
}

/** Options for {@link PlayerCardArt} resolution — currently only the
 *  Ballon d'Or top-10 override, which outranks every overall-based tier. */
export interface PlayerCardArtOptions {
  /** When true, return the Ballon d'Or top-10 card instead of the tier shield.
   *  Set this for players whose `ballonDOrTop10HoldSeason` is the current
   *  reigning season — see src/utils/ballonDorBoost.ts for the lifecycle. */
  ballonDorTop10?: boolean;
}

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
  lastTrainingGains?: Partial<Record<keyof PlayerAttributes, number>>;
  lastAttributeChanges?: Partial<Record<keyof PlayerAttributes, number>>;
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
  transferCooldownUntilWeek?: number; // after being convinced to stay, immune until this week
  lastTransferTalkWeek?: number; // week of last transfer talk interaction (prevents spam)
  alternatePositions?: Position[];  // positions this player can fill naturally (from FC26 data)
  skillMoves?: number;              // 1-5 star skill moves rating
  internationalCaps?: number;
  internationalGoals?: number;
  appearance?: PlayerAppearance;
  matchHistory?: PlayerMatchRecord[];
  ballonDOrPlacements?: BallonDOrPlacement[];
  seasonRatingTotal?: number;   // cumulative match ratings this season (for avg rating calc)
  seasonRatedMatches?: number;  // number of matches with ratings this season
  source?: 'generated' | 'real';
  fcId?: string;
  heightCm?: number;
  weightKg?: number;
  /** Rarity tier — see `PlayerRarity`. Recomputed whenever overall changes. */
  rarity?: PlayerRarity;
  /**
   * Season in which the player most recently finished in the Ballon d'Or
   * top 10. While set, the player is the reigning top-10 holder — they
   * carry a stats boost and the special `ballondor.png` card. The marker is
   * refreshed each season they re-make the top 10, and cleared at next
   * season-end if they drop out (along with reverting the stats boost).
   */
  ballonDOrTop10HoldSeason?: number;
  /**
   * Per-attribute deltas applied by the active Ballon d'Or top-10 boost.
   * Stored as deltas (not absolute snapshots) so development, training, and
   * decline that happen *during* the reign are preserved when the boost is
   * reverted — we just subtract these numbers and the rest of the player's
   * progression stays intact.
   */
  ballonDOrTop10BoostDeltas?: Partial<PlayerAttributes>;
}

export interface PlayerAppearance {
  skinTone: number;      // index 0-7 into PLAYER_SKIN_TONES
  hairStyle: number;     // index 0-11 into PLAYER_HAIR_STYLES_V2
  hairColor: number;     // index 0-7 into PLAYER_HAIR_COLORS
  height: number;        // 0=short, 1=medium, 2=tall (visual only)
  build: number;         // 0=lean, 1=average, 2=stocky (visual only)
  facialHair?: number;   // 0-4: none, stubble, goatee, short beard, full beard
  accessory?: number;    // 0-4: none, headband, wristband, captain armband, sleeve tape
  bootColor?: number;    // 0-3: black, white, neon, red
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
  divisionId: LeagueId;
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
  divisionId: LeagueId;
  stadiumName: string;
  stadiumCapacity: number;
}

export interface MatchEvent {
  minute: number;
  // 'added_time' = the "+X minutes added time" announcement (was previously
  // typed 'half_time', which suppressed the real Half Time divider and showed
  // a "HALF TIME" pill at minute 90). Additive union member — old saves with
  // half_time-typed announcements still render via the legacy handling, so
  // no save migration is needed.
  type: 'goal' | 'own_goal' | 'penalty_scored' | 'penalty_missed' | 'shot_saved' | 'shot_missed' | 'hit_woodwork' | 'goal_line_clearance' | 'foul' | 'yellow_card' | 'red_card' | 'injury' | 'substitution' | 'half_time' | 'added_time' | 'full_time' | 'kickoff' | 'extra_time_goal' | 'penalty_shootout' | 'commentary' | 'ai_tactical_change' | 'free_kick_goal' | 'long_range_goal' | 'counter_attack_goal' | 'header_goal' | 'solo_goal' | 'goalkeeper_error' | 'var_check' | 'var_disallowed';
  playerId?: string;
  assistPlayerId?: string;
  /** Secondary player involved in the event (currently: the keeper who fumbled on `goalkeeper_error`). */
  goalkeeperId?: string;
  clubId: string;
  description: string;
  momentum?: number;
  /** Cumulative xG at this point for the shooting team (set on shot events) */
  homeXG?: number;
  awayXG?: number;
  /** Human-readable minute label for stoppage-time events (e.g. "45+2").
   *  The stored `minute` is clamped to the half's nominal end (45/90) so the
   *  next half's stoppage-time window math doesn't double-count these events.
   *  Optional + additive — events without it render the plain minute, so no
   *  save migration is needed. */
  displayMinute?: string;
  /** Tactical insight pill text (e.g. "High press countering slow tempo +14%") */
  tacticalInsight?: string;
  /** Snapshot of player fitness levels at this minute */
  playerFitness?: Record<string, number>;
}

// ── Weather & Pitch ──
export type WeatherCondition = 'clear' | 'rain' | 'snow' | 'wind';
export type PitchCondition = 'excellent' | 'good' | 'poor' | 'waterlogged';

export interface MatchWeather {
  weather: WeatherCondition;
  pitch: PitchCondition;
}

// ── Touchline Shout System ──
export type ShoutType = 'push_forward' | 'hold_the_line' | 'calm_down' | 'time_waste';

export interface MatchShout {
  type: ShoutType;
  startMinute: number;
}

// ── Key Moment Branching Choices ──
export interface KeyMomentChoice {
  label: string;
  description: string;
  icon: string; // lucide icon name
  tactics?: Partial<TacticalInstructions>;
  /** If true, open substitution sheet instead of applying tactics */
  openSubSheet?: boolean;
  /** If set, suggest this formation */
  suggestFormation?: FormationType;
}

export interface PenaltyKick {
  round: number;
  isHome: boolean;
  takerName: string;
  scored: boolean;
  homeTotal: number;
  awayTotal: number;
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
  weather?: MatchWeather;
}

// ── Match Choreography (2.5D pitch visualization) ──
// Derived at view time from a finished Match by src/engine/match/choreography.ts.
// RUNTIME-ONLY: never written to persisted game state, so it carries no
// save-migration cost. Coordinates are normalized 0-100 with the HOME goal at
// y=0 and the AWAY goal at y=100; home attacks toward +y, away toward 0.
export interface PitchPoint {
  x: number;
  y: number;
}

export type PitchMotionKind =
  | 'idle' | 'pass' | 'dribble' | 'shot' | 'cross' | 'clearance' | 'longball' | 'restart';

export interface ChoreoPlayer {
  /** Source player id, or null for a synthetic placeholder when the lineup is short. */
  id: string | null;
  team: 'home' | 'away';
  pos: Position;
  /** Display shirt-number fallback (slot order, 1 = GK). */
  number: number;
  /** Short display name (last name) shown above the chip, when known. */
  name?: string;
  /** Player overall, shown on the chip when the "show overall on pitch" setting is on. */
  overall?: number;
  point: PitchPoint;
  /** True when this player is the focus of the current beat (scorer, keeper, …). */
  highlighted: boolean;
}

export interface CameraHint {
  focus: PitchPoint;
  /** 1 = wide broadcast, >1 = tighter. */
  zoom: number;
}

export interface MatchBeat {
  seq: number;
  minute: number;
  /** Driving event type, or null for a possession (keep-ball) filler beat. */
  eventType: MatchEvent['type'] | null;
  possession: 'home' | 'away';
  /** Player whose feet the ball is at this beat (null while the ball is in flight). */
  ballCarrierId: string | null;
  ball: PitchPoint;
  ballMotion: PitchMotionKind;
  /** Vertical arc height of the ball's travel into this beat (0 = ground). */
  ballArc: number;
  camera: CameraHint;
  players: ChoreoPlayer[];
  /** Player ids spotlighted this beat. */
  highlightIds: string[];
  /** Broadcast caption (event description) when this beat has an event. */
  caption?: string;
  /** Relative duration hint (ms) the renderer scales by match speed. */
  durationMs: number;
}

/** Which match-day view the user has selected. UI preference only. */
export type MatchViewMode = 'pitch' | 'commentary' | 'split';

/** Resolved render budget for the pitch view, chosen per device capability. */
export interface PitchQuality {
  tier: 'high' | 'balanced' | 'battery';
  /** devicePixelRatio cap. */
  dprCap: number;
  /** Ball-trail sample count (0 = no trail). */
  trailLen: number;
  /** Goal confetti piece count (0 = none). */
  confetti: number;
  /** Weather particle density multiplier (0..1). */
  weatherScale: number;
  vignette: boolean;
  gradient: boolean;
}

export interface MatchTimeline {
  matchId: string;
  homeClubId: string;
  awayClubId: string;
  homeColor: string;
  awayColor: string;
  /** Deterministic seed derived from the event list (same match → same motion). */
  seed: number;
  beats: MatchBeat[];
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
  scoutedPlayer?: boolean;
  /** Week number the player was listed (for expiry tracking) */
  listedWeek?: number;
  /** Season the player was listed (for cross-season expiry tracking) */
  listedSeason?: number;
  /** Division tier the player belongs to (for UI display) */
  divisionId?: string;
  /** True if this is an externally generated player (not from an existing club roster) */
  externalPlayer?: boolean;
}

export interface IncomingOffer {
  id: string;
  playerId: string;
  buyerClubId: string;
  fee: number;
  week: number;
}

// ── Negotiation Strikes ──
export interface NegotiationStrike {
  strikes: number;         // 0-3
  cooldownUntil?: number;  // absolute week (season * totalWeeks + week) when cooldown expires
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

export interface OutgoingLoanRequest {
  id: string;
  playerId: string;
  toClubId: string;       // club that owns the player
  durationWeeks: number;
  wageSplit: number;
  recallClause: boolean;
  obligatoryBuyFee?: number;
  week: number;
  season: number;
  status: 'pending' | 'accepted' | 'rejected' | 'counter';
  counterWageSplit?: number;
  counterDuration?: number;
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
  // Tiered objective fields (optional — backward-compatible)
  checkType?: 'league_position' | 'cup_round' | 'budget';
  targetMin?: number;
  targetOverachieve?: number;
  overachieved?: boolean;
  xpReward?: number;
  xpRewardOverachieve?: number;
  budgetBoost?: number;
  progressCurrent?: number;
  // Mid-season adjustment tracking
  adjusted?: boolean;
  originalDescription?: string;
  originalTargetMin?: number;
}

export interface Message {
  id: string;
  week: number;
  season: number;
  type: 'match_preview' | 'match_result' | 'board' | 'injury' | 'transfer' | 'contract' | 'development' | 'general' | 'sponsorship' | 'national_team' | 'warning';
  title: string;
  body: string;
  read: boolean;
  playerId?: string;
  actioned?: boolean;
}

// ── Transfer Talk (interactive dialog when player requests transfer) ──
export interface TransferTalkOption {
  label: string;
  text: string;
  tone: 'empathize' | 'convince' | 'promise' | 'refuse';
  effects: {
    morale?: number;
    teamMorale?: number;
    boardConfidence?: number;
    listForSale?: boolean;
    withdrawChance?: number;
  };
}

export interface TransferTalk {
  playerId: string;
  playerName: string;
  reason: 'low_morale' | 'ambition';
  body: string;
  options: TransferTalkOption[];
}

export interface CareerMilestone {
  id: string;
  type: 'first_win' | 'first_trophy' | 'promotion' | 'cup_win' | 'record_signing' | 'biggest_win' | 'milestone_matches' | 'unbeaten_run' | 'youth_graduate' | 'season_start' | 'prestige' | 'national_team_appointed' | 'national_team_sacked' | 'custom';
  title: string;
  description: string;
  season: number;
  week: number;
  icon?: string;
}

export type PerkId =
  | 'tactical_genius' | 'youth_developer' | 'transfer_shark' | 'motivator'
  | 'disciplinarian' | 'fitness_guru' | 'scout_network' | 'fan_favourite'
  | 'set_piece_coach' | 'media_savvy'
  | 'loan_master' | 'deadline_dealer'
  | 'iron_will' | 'formation_master'
  | 'galactico' | 'wonder_coach'
  | 'dynasty_builder' | 'invincible'
  // Talent tree additions
  | 'fortress_mentality' | 'training_ground' | 'golden_generation'
  // Prestige-exclusive perks
  | 'counter_master' | 'puppet_master'
  | 'cult_hero' | 'icon_status'
  | 'war_chest' | 'kingmaker'
  | 'prodigy_factory' | 'dna_coach';

export type TalentBranch = 'tactician' | 'motivator' | 'dealmaker' | 'developer';

export interface ManagerPerk {
  id: PerkId;
  name: string;
  description: string;
  icon: string;
  cost: number; // XP cost
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  prerequisite?: PerkId;
  branch: TalentBranch | 'capstone';
  row: number; // 0-4 within branch, 5 for capstone, 5-6 for prestige
  prestigeRequired?: number; // Minimum prestige level to unlock
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

export interface BallonDOrPlacement {
  season: number;
  rank: number;        // 1-25
  score: number;       // total Ballon d'Or score
}

export interface BallonDOrEntry {
  playerId: string;
  playerName: string;
  clubName: string;
  clubColor: string;
  position: Position;
  overall: number;
  age: number;
  rank: number;
  score: number;
  goals: number;
  assists: number;
  appearances: number;
  avgRating?: number;
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
  leagueCupResult?: string;
  championsCupResult?: string;
  shieldCupResult?: string;
  conferenceCupResult?: string;
  divisionId?: LeagueId;
  replaced?: boolean;
  promoted?: boolean;
  awards?: SeasonAward[];
  financialSummary?: { totalIncome: number; totalExpenses: number; netBalance: number };
  transferActivity?: { bought: { playerName: string; fee: number }[]; sold: { playerName: string; fee: number }[] };
  squadStrengthDelta?: { startAvgOVR: number; endAvgOVR: number; delta: number };
  ballonDOrRanking?: BallonDOrEntry[];
}

/** Lifetime achievement tier, derived from total trophies across all dynasties. */
export type LegacyTier = 'Rookie' | 'Journeyman' | 'Established' | 'Elite' | 'Legendary' | 'Immortal';

/** Cross-save lifetime manager record — aggregated from every dynasty in the
 *  Hall of Managers. Computed on demand (not persisted on its own); see
 *  `utils/managerLegacy.ts`. */
export interface ManagerLegacy {
  /** Number of recorded careers (Hall of Managers entries). */
  dynasties: number;
  /** Distinct club names managed across all dynasties. */
  clubsManaged: string[];
  totalSeasons: number;
  totalTitles: number;
  totalCupWins: number;
  totalLeagueCupWins: number;
  totalContinentalWins: number;
  /** Sum of every trophy type above. */
  totalTrophies: number;
  totalWins: number;
  totalMatches: number;
  /** 0–100, across all dynasties. */
  winRate: number;
  /** Best league finish ever (1 = champions); 0 when no career recorded. */
  bestPosition: number;
  bestPoints: number;
  highestPrestige: number;
  tier: LegacyTier;
}

export interface FormationSlot {
  x: number;
  y: number;
  pos: Position;
}

export const FORMATION_POSITIONS: Record<FormationType, FormationSlot[]> = {
  '4-3-3': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 12, y: 22, pos: 'LB' }, { x: 36, y: 19, pos: 'CB' }, { x: 64, y: 19, pos: 'CB' }, { x: 88, y: 22, pos: 'RB' },
    { x: 26, y: 48, pos: 'CM' }, { x: 50, y: 45, pos: 'CM' }, { x: 74, y: 48, pos: 'CM' },
    { x: 12, y: 75, pos: 'LW' }, { x: 50, y: 82, pos: 'ST' }, { x: 88, y: 75, pos: 'RW' },
  ],
  '4-4-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 12, y: 22, pos: 'LB' }, { x: 36, y: 19, pos: 'CB' }, { x: 64, y: 19, pos: 'CB' }, { x: 88, y: 22, pos: 'RB' },
    { x: 12, y: 50, pos: 'LM' }, { x: 36, y: 47, pos: 'CM' }, { x: 64, y: 47, pos: 'CM' }, { x: 88, y: 50, pos: 'RM' },
    { x: 35, y: 78, pos: 'ST' }, { x: 65, y: 78, pos: 'ST' },
  ],
  '3-5-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 24, y: 22, pos: 'CB' }, { x: 50, y: 18, pos: 'CB' }, { x: 76, y: 22, pos: 'CB' },
    { x: 8, y: 48, pos: 'LM' }, { x: 32, y: 45, pos: 'CM' }, { x: 50, y: 38, pos: 'CDM' }, { x: 68, y: 45, pos: 'CM' }, { x: 92, y: 48, pos: 'RM' },
    { x: 35, y: 78, pos: 'ST' }, { x: 65, y: 78, pos: 'ST' },
  ],
  '4-2-3-1': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 12, y: 22, pos: 'LB' }, { x: 36, y: 19, pos: 'CB' }, { x: 64, y: 19, pos: 'CB' }, { x: 88, y: 22, pos: 'RB' },
    { x: 32, y: 42, pos: 'CDM' }, { x: 68, y: 42, pos: 'CDM' },
    { x: 12, y: 64, pos: 'LW' }, { x: 50, y: 60, pos: 'CAM' }, { x: 88, y: 64, pos: 'RW' },
    { x: 50, y: 82, pos: 'ST' },
  ],
  '4-1-4-1': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 12, y: 22, pos: 'LB' }, { x: 36, y: 19, pos: 'CB' }, { x: 64, y: 19, pos: 'CB' }, { x: 88, y: 22, pos: 'RB' },
    { x: 50, y: 40, pos: 'CDM' },
    { x: 12, y: 60, pos: 'LM' }, { x: 36, y: 57, pos: 'CM' }, { x: 64, y: 57, pos: 'CM' }, { x: 88, y: 60, pos: 'RM' },
    { x: 50, y: 82, pos: 'ST' },
  ],
  '3-4-3': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 24, y: 22, pos: 'CB' }, { x: 50, y: 18, pos: 'CB' }, { x: 76, y: 22, pos: 'CB' },
    { x: 10, y: 48, pos: 'LM' }, { x: 38, y: 45, pos: 'CM' }, { x: 62, y: 45, pos: 'CM' }, { x: 90, y: 48, pos: 'RM' },
    { x: 12, y: 75, pos: 'LW' }, { x: 50, y: 82, pos: 'ST' }, { x: 88, y: 75, pos: 'RW' },
  ],
  '5-3-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 8, y: 25, pos: 'LB' }, { x: 28, y: 19, pos: 'CB' }, { x: 50, y: 17, pos: 'CB' }, { x: 72, y: 19, pos: 'CB' }, { x: 92, y: 25, pos: 'RB' },
    { x: 26, y: 50, pos: 'CM' }, { x: 50, y: 47, pos: 'CM' }, { x: 74, y: 50, pos: 'CM' },
    { x: 35, y: 78, pos: 'ST' }, { x: 65, y: 78, pos: 'ST' },
  ],
  // ── Formation Master perk formations ──
  '4-5-1': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 12, y: 22, pos: 'LB' }, { x: 36, y: 19, pos: 'CB' }, { x: 64, y: 19, pos: 'CB' }, { x: 88, y: 22, pos: 'RB' },
    { x: 8, y: 55, pos: 'LM' }, { x: 30, y: 50, pos: 'CM' }, { x: 50, y: 45, pos: 'CDM' }, { x: 70, y: 50, pos: 'CM' }, { x: 92, y: 55, pos: 'RM' },
    { x: 50, y: 82, pos: 'ST' },
  ],
  '4-1-2-1-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 12, y: 22, pos: 'LB' }, { x: 36, y: 19, pos: 'CB' }, { x: 64, y: 19, pos: 'CB' }, { x: 88, y: 22, pos: 'RB' },
    { x: 50, y: 38, pos: 'CDM' },
    { x: 28, y: 55, pos: 'CM' }, { x: 72, y: 55, pos: 'CM' },
    { x: 50, y: 70, pos: 'CAM' },
    { x: 35, y: 82, pos: 'ST' }, { x: 65, y: 82, pos: 'ST' },
  ],
  '3-4-1-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 24, y: 22, pos: 'CB' }, { x: 50, y: 18, pos: 'CB' }, { x: 76, y: 22, pos: 'CB' },
    { x: 10, y: 47, pos: 'LM' }, { x: 35, y: 42, pos: 'CM' }, { x: 65, y: 42, pos: 'CM' }, { x: 90, y: 47, pos: 'RM' },
    { x: 50, y: 65, pos: 'CAM' },
    { x: 35, y: 82, pos: 'ST' }, { x: 65, y: 82, pos: 'ST' },
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

/**
 * Check if a player can fill a given slot position.
 * Uses both the static POSITION_COMPATIBILITY table and the player's
 * FC26-sourced alternatePositions for per-player flexibility.
 */
export function canPlayPosition(player: { position: Position; alternatePositions?: Position[] }, slotPos: Position): boolean {
  if (player.position === slotPos) return true;
  const staticCompat = POSITION_COMPATIBILITY[player.position] || [];
  if (staticCompat.includes(slotPos)) return true;
  if (player.alternatePositions?.includes(slotPos)) return true;
  return false;
}

// ── Settings ──
export interface GameSettings {
  matchSpeed: number;
  showOverallOnPitch: boolean;
  autoSave: boolean;
  hapticsEnabled: boolean;
  hidePageHints: boolean;
  hideOnboarding: boolean;
  confirmAllOffers: boolean;
  reducedMotion: boolean;
  /** Maximises smoothness on lower-end devices: disables backdrop-blur (solid
   *  surfaces), drops decorative specular overlays, and forces reduced motion. */
  performanceMode: boolean;
}

// ── Team Talk ──
export type TeamTalkType = 'motivate' | 'calm' | 'demand' | 'none';

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

export interface TacticalPreset {
  id: string;
  name: string;
  formation: FormationType;
  tactics: TacticalInstructions;
  createdAt: string;
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

export interface TrainingDrill {
  id: string;
  moduleId: TrainingModule;
  name: string;
  description: string;
  attrWeights: Partial<Record<keyof PlayerAttributes, number>>;
}

export interface DrillSchedule {
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
}

export type TrainingStreaks = Partial<Record<TrainingModule, number>>;

export interface TrainingReport {
  week: number;
  season: number;
  starPerformers: { playerId: string; attrGained: string; newValue: number }[];
  totalGains: number;
  injuries: string[];
  streakProgress: TrainingStreaks;
  fitnessChange: number;
  playerBreakdown?: { playerId: string; playerName: string; gains: { attribute: string; amount: number; newValue: number }[] }[];
}

export interface TrainingState {
  schedule: TrainingSchedule;
  intensity: TrainingIntensity;
  individualPlans: IndividualTraining[];
  tacticalFamiliarity: number;
  drillSchedule?: DrillSchedule;
  streaks?: TrainingStreaks;
  lastReport?: TrainingReport;
}

// ── Staff ──
export type StaffRole = 'assistant-manager' | 'first-team-coach' | 'fitness-coach' | 'goalkeeping-coach' | 'scout' | 'youth-coach' | 'physio';

/**
 * Personality / specialism traits. 1–2 per staff member, baked at generation.
 * Traits add small effective-quality bonuses in their domain and influence
 * morale dynamics. Display on StaffPage as colored chips.
 */
export type StaffTrait =
  | 'tactician'        // +1 effective for asst-manager / first-team-coach
  | 'motivator'        // higher morale floor; stronger praise gain
  | 'talent_spotter'   // +1 effective for scout / youth-coach
  | 'innovator'        // +1 effective for first-team-coach / fitness-coach
  | 'disciplinarian'   // +1 effective for physio
  | 'veteran'          // morale decays slower; stable performer
  | 'rising_star';     // gains +1 quality every 2 seasons (max cap)

export interface StaffPerformance {
  /** Player attribute gains attributable to this staff member this season. */
  trainingGains: number;
  /** Promoted youths credited (incremented when youth-coach is on staff at promotion). */
  youthPromotions: number;
  /** Scout reports completed by this scout. */
  scoutFinds: number;
  /** Approximate injuries prevented by physio (seasonal estimate). */
  injuriesPrevented: number;
  /** Weeks they have been on staff (used for "Seasons at Club" derivation). */
  weeksAtClub: number;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  quality: number;
  wage: number;
  /** Morale 0-100. Affects effective quality (0.6× at 0 → 1.2× at 100). */
  morale?: number;
  /** Personality / specialism chips (1-2). */
  traits?: StaffTrait[];
  /** Years remaining on contract. Decremented at season end. 0 = walks away. */
  contractYearsRemaining?: number;
  /** Total seasons at the club (informational). */
  seasonsAtClub?: number;
  /** Running tally for the current season (resets at season end). */
  performance?: StaffPerformance;
  /** Week number of last praise/criticize action (used for 4-week cooldown). */
  lastInteractionWeek?: number;
  /** Week number of last contract renewal (used for renewal lockout). */
  lastRenewalWeek?: number;
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
/**
 * Per-prospect coaching focus. Biases the attribute group that gains in the
 * weekly youth tick. `balanced` is the default.
 */
export type YouthFocus = 'balanced' | 'technical' | 'physical' | 'mental';

export interface YouthProspect {
  playerId: string;
  readyToPromote: boolean;
  developmentScore: number;
  /** Per-prospect coaching focus. Defaults to 'balanced' on intake. */
  trainingFocus?: YouthFocus;
  /** Set when the prospect has been given a spotlight session this season. */
  spotlightedThisSeason?: boolean;
}

export interface YouthAcademyState {
  prospects: YouthProspect[];
  nextIntakePreview: { position: Position; estimatedPotential: number }[];
  youthPreviewEnhanced: boolean;
  /** Spotlight sessions remaining this season. Refilled at season end. */
  spotlightUsesRemaining?: number;
}

// ── Facilities ──
export type StandKey = 'north' | 'south' | 'east' | 'west';

export interface StadiumStands {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface FacilitiesState {
  trainingLevel: number;
  youthLevel: number;
  stadiumStands: StadiumStands;
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

/** A player counter-proposal during sponsor negotiation. */
export interface SponsorNegotiationProposal {
  weeklyPayment: number;
  seasonDuration: number;
  performanceBonus: number;
}

/**
 * Live state of a haggling negotiation on a pending SponsorOffer. Absent
 * until the player sends their first counter-proposal. The payment/duration/
 * bonus fields are the terms currently on the table — what `acceptSponsorOffer`
 * signs if the player accepts now.
 */
export interface SponsorNegotiation {
  /** Counter-proposals the player has sent so far. */
  roundsUsed: number;
  weeklyPayment: number;
  seasonDuration: number;
  performanceBonus: number;
  /**
   * - 'countered' : sponsor proposed these terms; player may haggle again or sign.
   * - 'accepted'  : sponsor agreed to the player's exact ask.
   * - 'final'     : last round reached — take-it-or-leave-it, no more haggling.
   */
  outcome: 'countered' | 'accepted' | 'final';
  /** Sponsor's reaction to the last proposal — drives copy + colour. */
  mood: 'pleased' | 'neutral' | 'annoyed';
}

/** Result of evaluating a player counter-proposal against the original offer. */
export interface SponsorNegotiationResult {
  outcome: 'accepted' | 'countered' | 'withdrawn';
  weeklyPayment: number;
  seasonDuration: number;
  performanceBonus: number;
  mood: 'pleased' | 'neutral' | 'annoyed';
  /** True when this exchange exhausts the round budget. */
  isFinal: boolean;
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
  /** Present once the player has opened negotiations on this offer. */
  negotiation?: SponsorNegotiation;
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

export interface PlayerMatchRecord {
  week: number;
  season: number;
  opponentName: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
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
  gameMode?: GameMode;
}

/** Why a `loadGame()` call failed. Populated on GameState.loadError so the
 *  SaveRecoveryDialog can render the appropriate message + actions. */
export type LoadErrorKind =
  /** JSON parse failed on primary (and backup if it was tried too). */
  | 'corrupt'
  /** Save was written by a newer version of the app. Refuse, don't guess. */
  | 'newer_version'
  /** Structural check failed after migration (missing required fields). */
  | 'validation_failed'
  /** migrateSaveData threw during one of the version steps. */
  | 'migration_failed';

export interface LoadError {
  slot: number;
  kind: LoadErrorKind;
  /** Free-form detail for logs / DEV surface. */
  reason?: string;
  /** True if an untried backup still exists for this slot. The dialog shows
   *  a "Try recovery" action only when this is true. */
  canRecover: boolean;
  /** Save file version, when known (populated for 'newer_version'). */
  saveVersion?: number;
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

// ── League Cup (Secondary Domestic Cup) ──
export interface LeagueCupState {
  ties: CupTie[];
  currentRound: CupRound | null;
  eliminated: boolean;
  winner: string | null;
}

// ── Continental Club Competitions ──
export type ContinentalCompetition = 'champions_cup' | 'shield_cup' | 'conference_cup';
export type ContinentalRound = 'group' | 'R16' | 'QF' | 'SF' | 'F';

export interface ContinentalGroupMatch {
  id: string;
  matchday: number; // 1-6
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
}

export interface ContinentalGroupStanding {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface ContinentalGroup {
  id: string; // 'A' through 'H'
  clubIds: string[];
  matches: ContinentalGroupMatch[];
  standings: ContinentalGroupStanding[];
}

export interface ContinentalKnockoutTie {
  id: string;
  round: 'R16' | 'QF' | 'SF' | 'F';
  homeClubId: string;
  awayClubId: string;
  leg1Played: boolean;
  leg1HomeGoals: number;
  leg1AwayGoals: number;
  leg2Played: boolean;
  leg2HomeGoals: number;
  leg2AwayGoals: number;
  week1: number;
  week2: number;
  winnerId: string | null;
  penaltyShootout?: { home: number; away: number };
}

export interface ContinentalTournamentState {
  competition: ContinentalCompetition;
  season: number;
  groups: ContinentalGroup[];
  knockoutTies: ContinentalKnockoutTie[];
  currentPhase: 'group' | 'knockout' | 'complete';
  currentRound: ContinentalRound | null;
  playerEliminated: boolean;
  playerGroupId: string | null;
  winnerId: string | null;
}

// Virtual club for continental opponents from other leagues
export interface VirtualClub {
  id: string;
  name: string;
  shortName: string;
  color: string;
  secondaryColor: string;
  leagueId: string;
  reputation: number;
  country: string;
  countryCode: string;
}

// ── Continental Coefficients ──
/** Tracks a club's continental performance over multiple seasons for seeding */
export interface ContinentalCoefficient {
  clubId: string;
  /** Points accumulated across seasons (recent seasons weighted more) */
  points: number;
  /** Per-season breakdown: { season: points } */
  seasonPoints: Record<number, number>;
}

// ── Super Cup ──
export interface SuperCupMatch {
  type: 'domestic' | 'continental';
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  week: number;
  winnerId: string | null;
  penaltyShootout?: { home: number; away: number };
}

// ── Press Conferences ──
export type PressResponseTone = 'confident' | 'humble' | 'deflect' | 'strategic' | 'analytical' | 'visionary';

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
  context: 'post_win' | 'post_loss' | 'post_draw' | 'pre_big_match' | 'transfer_rumour' | 'poor_form' | 'good_form' | 'promotion_race' | 'relegation_battle' | 'new_signing' | 'injury_crisis' | 'derby_preview';
  question: string;
  options: [PressOption, PressOption, PressOption] | [PressOption, PressOption, PressOption, PressOption];
  hasProOption?: boolean;
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
  playerAge: number;   // cached for years-based acceptance calculation
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
  clubFilter?: 'relegation' | 'contender' | 'youth-academy' | 'mid-table' | 'underdog' | 'all';
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

/**
 * One-week revenue spike tied to a specific star player. Stacks with other
 * boosts. Limited to 1 active drop at a time, with a cooldown.
 */
export interface MerchSignatureDrop {
  playerId: string;
  playerName: string;
  weeksRemaining: number;
  totalWeeks: number;
  /** Flat extra weekly revenue while active. */
  weeklyBonus: number;
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
  /** Active signature drop (nullable). Optional for save compat. */
  signatureDrop?: MerchSignatureDrop | null;
  /** Cooldown in weeks before another signature drop can be launched. */
  signatureDropCooldownWeeks?: number;
  /** Tracks player IDs that have had a signature drop this season (one per player per season). */
  signatureDropsUsedThisSeason?: string[];
  /** Current win streak (any competition). Drives the streak revenue bonus. */
  winStreak?: number;
  /** Set to a small number of weeks when a derby is played (auto-spike). */
  derbyBuzzWeeks?: number;
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
  | 'com.dynastymanager.pro.annual'
  | 'com.dynastymanager.pro.lifetime'
  | 'com.dynastymanager.pack.manager'
  | 'com.dynastymanager.pack.stadium'
  | 'com.dynastymanager.pack.legends'
  | 'com.dynastymanager.bundle.all'
  | 'com.dynastymanager.pack.gold'
  | 'com.dynastymanager.pack.premium_gold'
  | 'com.dynastymanager.pack.rare_gold'
  | 'com.dynastymanager.pack.icon';

export type SubscriptionTier = 'trial' | 'monthly' | 'annual' | 'lifetime';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  productId: ProductId;
  /** ISO date string of expiration, or null for lifetime */
  expiresAt: string | null;
  /** Whether the subscription has a billing issue (grace period) */
  isInGracePeriod: boolean;
  /** Whether the subscription will auto-renew */
  willRenew: boolean;
  /** True if the player is currently in the introductory free-trial window
   *  for the monthly subscription. Auto-converts to a paid monthly billing
   *  cycle when `expiresAt` is reached unless the user cancels. */
  isTrial?: boolean;
}

export type ProFeature =
  | 'ad_free'
  | 'advanced_analytics'
  | 'custom_tactics'
  | 'expanded_press'
  | 'historical_records'
  | 'instant_sim'
  | 'optimize_lineup'
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

export interface NationalTeamOffer {
  id: string;
  nationality: string;
  reason: 'initial' | 'vacancy';         // initial = first approach, vacancy = previous manager left
  offerSeason: number;
  offerWeek: number;
  expiresSeason: number;
  expiresWeek: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

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
  poolPlayerIds: string[];                // IDs of generated national team pool players
}

export interface NationalTeamResult {
  season: number;
  opponent: string;                       // nationality name
  goalsFor: number;
  goalsAgainst: number;
  tournament: string;                     // "World Cup Group A", "Friendly", etc.
  round: string;
  /** Did the manager's nation win this match? Stamped on knockout results so
   *  penalty-shootout wins (goalsFor === goalsAgainst) are classifiable.
   *  Optional: legacy records fall back to a goals comparison. Added in save
   *  schema v72. */
  won?: boolean;
}

// ── International Tournament ──

export type InternationalTournamentType = 'world-cup' | 'continental';

export type InternationalKnockoutRound = 'R16' | 'QF' | 'SF' | 'F';

export interface InternationalTournamentState {
  type: InternationalTournamentType;
  name: string;                           // "World Cup Season 4", "European Championship", etc.
  season: number;
  phase: 'group' | 'knockout' | 'complete';
  groups: InternationalGroup[];
  knockoutTies: InternationalKnockoutTie[];
  currentRound: InternationalKnockoutRound | null;
  playerEliminated: boolean;
  winner: string | null;                  // nationality name
  currentWeek: number;                    // tracks which international week we're on (47-52)
  /** Player has confirmed their 23-man squad via the pre-tournament picker.
   *  When false, advanceWeek's international step will not progress fixtures
   *  involving the player nation — they are gated behind the picker. */
  squadConfirmed: boolean;
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

// ── Game Modes ──

export type GameMode = 'sandbox' | 'career' | 'world-cup';

// ── Manager Career Mode ──

export interface ManagerAttributes {
  tacticalKnowledge: number;  // 1-20
  motivation: number;         // 1-20
  negotiation: number;        // 1-20
  scoutingEye: number;        // 1-20
  youthDevelopment: number;   // 1-20
  discipline: number;         // 1-20
  mediaHandling: number;      // 1-20
}

export type ManagerTraitId =
  | 'tactician' | 'motivator' | 'youth_developer' | 'transfer_guru'
  | 'disciplinarian' | 'media_darling' | 'fitness_fanatic' | 'scout_master';

export type ReputationTier = 'unknown' | 'regional' | 'national' | 'continental' | 'world_class' | 'legendary';

export interface ManagerContract {
  clubId: string;
  salary: number;              // weekly salary
  startSeason: number;
  endSeason: number;           // contract expires after this season
  bonuses: ManagerBonus[];
}

export interface ManagerBonus {
  condition: 'promotion' | 'top_half' | 'title' | 'cup_win' | 'avoid_relegation';
  amount: number;
  met: boolean;
}

export interface ManagerAppearance {
  gender: 'male' | 'female';
  badgeShape: number;       // 0-3: circle, shield, hexagon, diamond
  backgroundColor: string;  // hex color for badge background
  accentColor: string;      // hex color for accent ring
  pattern: number;          // 0-3: solid, striped, split, chevron
  icon: number;             // 0-4: suit, tracksuit, whistle, clipboard, trophy
  // Legacy fields (kept for save migration compat, unused by new renderer)
  skinTone?: number;
  faceShape?: number;
  eyeStyle?: number;
  hairStyle?: number;
  hairColor?: number;
  facialHair?: number;
  glasses?: number;
  outfit?: number;
  outfitColor?: string;
  tieColor?: string;
  accessory?: number;
}

export interface CareerManager {
  name: string;
  nationality: string;
  age: number;
  retirementAge: number;               // 65 default, 75 if legendary
  appearance: ManagerAppearance;
  attributes: ManagerAttributes;
  traits: ManagerTraitId[];            // 2 picked at creation
  contract: ManagerContract | null;    // null = between jobs
  careerHistory: ManagerCareerEntry[];
  reputationScore: number;             // 0-1000
  reputationTier: ReputationTier;
  totalCareerWins: number;
  totalCareerDraws: number;
  totalCareerLosses: number;
  totalCareerMatches: number;
  promotionsWon: number;
  titlesWon: number;
  cupsWon: number;
  continentalCupsWon: number;
  leagueCupsWon: number;
  sackedCount: number;
  resignedCount: number;
  awardsWon: ManagerAward[];
  legacyScore: number;
  personalWealth: number;              // accumulated career earnings from salary + bonuses
  unemployedWeeks: number;             // tracks how long between jobs
  nationalTeamAppointedSeason: number | null;  // null = never appointed
  nationalTeamSacked: boolean;                 // true if previously sacked from NT
}

export interface ManagerCareerEntry {
  clubId: string;
  clubName: string;
  divisionId: string;
  startSeason: number;
  endSeason: number | null;            // null if still managing
  reason: 'hired' | 'sacked' | 'resigned' | 'retired' | 'moved' | 'contract_expired';
  bestFinish: number;
  titlesWon: number;
}

export interface JobVacancy {
  id: string;
  clubId: string;
  clubName: string;
  divisionId: string;
  minReputation: number;               // 0-1000
  salary: number;
  contractLength: number;
  boardExpectations: string;
  expiresWeek: number;
  expiresSeason: number;
  applied: boolean;
  competitors?: CompetingCandidate[];   // AI rival candidates
  interviewActive?: boolean;            // true while interview in progress

  // Enriched club profile (optional for backward compat / desperation vacancies)
  leagueName?: string;
  country?: string;
  clubColor?: string;
  reputation?: number;
  budget?: number;
  estimatedSquadValue?: number;
  expectedPosition?: string;
  facilities?: number;
  youthRating?: number;
  boardPatience?: number;

  // Live league data (populated from divisionTables when available)
  currentPosition?: number;
  currentForm?: ('W' | 'D' | 'L')[];
  currentPoints?: number;
  matchesPlayed?: number;
}

export interface JobOffer {
  id: string;
  clubId: string;
  clubName: string;
  divisionId: string;
  salary: number;
  contractLength: number;
  bonuses: ManagerBonus[];
  boardExpectations: string;
  expiresWeek: number;
  expiresSeason: number;

  // Club profile info
  leagueName?: string;
  country?: string;
  clubColor?: string;
  reputation?: number;
  budget?: number;
  estimatedSquadValue?: number;
  expectedPosition?: string;
  facilities?: number;
  youthRating?: number;
  boardPatience?: number;
  stadiumName?: string;
  stadiumCapacity?: number;
  fanBase?: number;

  // Negotiation state
  initialSalary?: number;
  negotiationRound?: number;
  negotiationStatus?: 'pending' | 'accepted' | 'final';

  // Enhanced negotiation
  initialContractLength?: number;       // original contract length for negotiation
  bonusPool?: number;                   // total bonus budget available
  boardTolerance?: number;              // 0-100, decreases with aggressive negotiation
}

export interface ManagerAward {
  type: 'manager_of_month' | 'manager_of_season';
  season: number;
  week?: number;
  divisionId: string;
}

// ── Interview System ──

export type InterviewStep = 'pitch' | 'result';
export type PitchTone = 'ambitious' | 'pragmatic' | 'developmental' | 'defensive';

export interface PitchQuestion {
  id: string;
  question: string;
  context: 'vision' | 'budget' | 'youth' | 'transfers' | 'pressure';
  options: PitchOption[];
}

export interface PitchOption {
  tone: PitchTone;
  text: string;
  scoreModifier: number;
  bestForTier?: number;
}

export interface CompetingCandidate {
  name: string;
  reputationTier: ReputationTier;
  reputationScore: number;
  previousClub: string;
  strength: number;
}

export interface ActiveInterview {
  vacancyId: string;
  clubId: string;
  clubName: string;
  divisionId: string;
  step: InterviewStep;
  pitchQuestions: PitchQuestion[];
  currentQuestionIndex: number;
  pitchScore: number;
  responses: PitchTone[];
  competitors: CompetingCandidate[];
  result: 'pending' | 'hired' | 'rejected';
  resultMessage: string;
}

// ── Player Packs ──
export type PackTierKey = 'bronze' | 'silver' | 'gold' | 'premium' | 'rare' | 'icon';

export interface PackRarityWeights {
  common: number;     // < 60
  bronze: number;     // 60-69
  silver: number;     // 70-79
  gold: number;       // 80-89
  legendary: number;  // 90+
}

/** Method used to unlock a single pack open.
 *  - `free`: zero-cost daily allowance, capped by `freeDailyLimit`.
 *  - `ad`: rewarded video ad, capped by `adDailyLimit`. Used after free runs out.
 *  - `currency`: spends in-game club budget at `price` per open.
 *  - `iap`: real-money in-app purchase via RevenueCat at `productId`.
 *
 *  A tier can support multiple methods. The page picks the active one in
 *  this priority: `free` → `ad` → `iap` → `currency`. */
export type PackUnlockMethod = 'free' | 'ad' | 'currency' | 'iap';

export interface PackTierDefinition {
  key: PackTierKey;
  label: string;
  tagline: string;
  /** In-game currency price. 0 means the pack is not buyable with money. */
  price: number;
  cards: number;
  /** Guaranteed-rare floor applied to one card in the pack. */
  guaranteedMinOvr: number;
  /** OVR band used when generating common cards in this pack. */
  ovrMin: number;
  ovrMax: number;
  rarity: PackRarityWeights;
  /** Visual gradient endpoints for the pack tile (hex, design-system anchor). */
  gradientFrom: string;
  gradientTo: string;
  /** Glow/accent color used during the charge-up beat. */
  accent: string;
  /** Optional pack-cover artwork. When set, renders inside the pack tile
   *  and the cinematic pack body in place of the centered-letter
   *  placeholder. Public asset path (e.g. `/packs/bronze.png`). The img
   *  fails silently to the placeholder if the asset isn't deployed yet. */
  artSrc?: string;
  /** Free opens per real-world day (no ad, no payment). Default 0. */
  freeDailyLimit?: number;
  /** Rewarded-ad opens per real-world day, used after free opens are
   *  exhausted. Default 0. */
  adDailyLimit?: number;
  /** RevenueCat / store product identifier. When set, the pack supports
   *  unlimited consumable IAP opens after free/ad allowances run out. */
  productId?: ProductId;
  /** Display-only price string for the IAP path (e.g. `'$4.99'`). Real
   *  price comes from the store at runtime — this is the planned tier. */
  iapPriceDisplay?: string;
}

export interface OpenedPackRecord {
  id: string;
  tier: PackTierKey;
  season: number;
  week: number;
  timestamp: number;
  /** Snapshot of player IDs in reveal order. Players live in the main `players` map. */
  playerIds: string[];
  /** Cached top OVR so the shop can badge the record without touching `players`. */
  topOvr: number;
}

/** Where a pulled player landed after auto-place: XI, bench, or squad-only. */
export type PackPlayerPlacement = 'starter' | 'bench' | 'squad';

export interface OpenPackResult {
  success: boolean;
  message: string;
  players?: Player[];
  record?: OpenedPackRecord;
  pityTriggered?: boolean;
  /** Which unlock method was used for this open. */
  method?: PackUnlockMethod;
  /** Set when an IAP pack was charged in the App Store but the slice
   *  refused at re-validation. The page MUST surface a support / refund
   *  path to the user rather than a generic error toast. */
  paidButRejected?: boolean;
}

export interface ReleasePackedPlayerResult {
  success: boolean;
  message: string;
}

export interface QuickSellPackedPlayerResult {
  success: boolean;
  message: string;
  /** Amount credited to the club budget when the sale succeeds. */
  amount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-local UI types — centralized here per CLAUDE.md single-source-of-truth
// rule ("NEVER create type files outside src/types/game.ts"). Each block notes
// which page(s) consume the type.
// ─────────────────────────────────────────────────────────────────────────────

/** SquadPage: sort key for the squad list. */
export type SquadSortKey = 'overall' | 'potential' | 'age' | 'value' | 'fitness' | 'morale' | 'wage' | 'form';

/** SquadPage: status chip filter for the squad list. */
export type SquadStatusFilter = 'injured' | 'listed' | 'expiring' | 'onLoan' | 'youth' | 'starters' | 'bench' | 'unhappy';

/** CalendarView: one row in the weekly schedule. */
export interface CalendarEntry {
  week: number;
  type: 'league' | 'cup' | 'international' | 'bye';
  match: Match | null;
  cupTie: CupTie | null;
  intlLabel?: string;
  competitionLabel?: string;
}

/** CalendarView: phase grouping (Pre-season, Autumn, Spring, End of Season). */
export interface CalendarPhaseGroup {
  id: string;
  label: string;
  startWeek: number;
  endWeek: number;
  entries: CalendarEntry[];
  phaseSummary: { wins: number; draws: number; losses: number; total: number };
}

/** ManagerCreation: step in the onboarding wizard. */
export type ManagerCreationStep = 'name' | 'nationality' | 'age' | 'traits' | 'offers';

/** ClubSelection: step in the club-selection onboarding flow. */
export type OnboardingStep = 'nationality' | 'league' | 'club';

/** ClubSelection: session-scoped draft persisted across refreshes. */
export interface OnboardingDraft {
  step: OnboardingStep;
  nation: string | null;
  league: LeagueId | null;
}

/** FacilitiesPage: which tab is active. */
export type FacilityTab = 'stadium' | 'facilities';

/** HelpPage: one entry in the help accordion. */
export interface HelpSection {
  title: string;
  content: string;
}

/** InboxPage: color styling for each message type. */
export interface MessageColorScheme {
  iconBg: string;
  iconText: string;
  border: string;
  dot: string;
}

/** MatchReview: tone of a highlight row. */
export type MatchHighlightTone = 'goal' | 'card' | 'var' | 'disallowed' | 'neutral' | 'own-goal' | 'sub';

/** TitleScreen: decorative floating circle in the background. */
export interface TitleFloatingCircle {
  id: number;
  size: number;
  x: number;
  y: number;
  opacity: number;
  color: string;
  duration: number;
  driftX: number;
  driftY: number;
}

/** WhatsNewPage: bucket a release-note bullet falls into. */
export type ReleaseCategory = 'highlights' | 'new' | 'improved' | 'fixed';

/** WhatsNewPage: one TestFlight build's release notes. Authored in
 *  src/data/whatsNew.ts and validated by scripts/check-whats-new.mjs. */
export interface ReleaseNote {
  /** Semver marketing version, e.g. "1.0.1". Must match package.json on ship. */
  version: string;
  /** iOS CFBundleVersion / Android versionCode. Injected by CI if null. */
  build: number | null;
  /** ISO calendar date the TestFlight build was shipped (YYYY-MM-DD). */
  date: string;
  /** Short headline, App Store style. 3–8 words. */
  headline: string;
  /** 1–3 sentence player-facing summary. */
  summary: string;
  /** Marquee changes worth calling out at the top of the card. */
  highlights?: string[];
  /** Brand-new features. */
  new?: string[];
  /** Improvements to existing features. */
  improved?: string[];
  /** Bug fixes. */
  fixed?: string[];
}

/**
 * OVR window passed to `pickUnclaimedRealPlayer` so weak clubs do
 * not snatch elite real players (and vice-versa) when filling slots
 * from the FC26 pool.
 */
export interface PickRealPlayerOptions {
  /** Inclusive lower OVR bound. */
  minOvr?: number;
  /** Inclusive upper OVR bound. */
  maxOvr?: number;
}
