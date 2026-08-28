/**
 * UI Configuration
 * Rating colors, confidence colors, position filters, verdict labels, and thresholds.
 */

import type { TranslationKey } from '@/i18n';
import type { GameScreen, Position } from '@/types/game';

// ── Rating Color Thresholds (overall, attribute values) ──
// Each tier carries a `textClass` (foreground only), `bgClass` (solid fill),
// and `badgeClass` (translucent fill + matching text + border — used for
// inline rating chips on rosters and squad pickers).
export const RATING_COLOR_THRESHOLDS = [
  { min: 80, textClass: 'text-emerald-400', bgClass: 'bg-emerald-500', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  { min: 70, textClass: 'text-sky-400',     bgClass: 'bg-sky-500',     badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/40' },
  { min: 60, textClass: 'text-amber-400',   bgClass: 'bg-amber-500',   badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  { min: 0,  textClass: 'text-muted-foreground', bgClass: 'bg-destructive', badgeClass: 'bg-muted/20 text-muted-foreground border-border/30' },
] as const;

// ── Player Tier Thresholds (Legendary / Gold / Silver / Bronze / Common) ──
// Single source of truth for tier identity. Used to render crisp gradient
// borders and on-card text labels. Tune `min` to shift band boundaries.
export const PLAYER_TIER_THRESHOLDS = [
  {
    min: 90, key: 'legendary', label: 'Legendary',
    gradientFrom: '#fbbf24', gradientVia: '#ef4444', gradientTo: '#7f1d1d',
    textClass: 'text-rose-200',
    outlineColor: 'rgba(76, 5, 25, 0.9)',
    badgeClass: 'bg-rose-400/20 text-rose-200 border border-rose-300/40',
  },
  {
    min: 80, key: 'gold', label: 'Gold',
    gradientFrom: '#fcd34d', gradientVia: '#f59e0b', gradientTo: '#92400e',
    textClass: 'text-amber-200',
    outlineColor: 'rgba(69, 26, 3, 0.9)',
    badgeClass: 'bg-amber-500/15 text-amber-200 border border-amber-300/40',
  },
  {
    min: 70, key: 'silver', label: 'Silver',
    gradientFrom: '#e2e8f0', gradientVia: '#cbd5e1', gradientTo: '#64748b',
    textClass: 'text-slate-200',
    outlineColor: 'rgba(15, 23, 42, 0.9)',
    badgeClass: 'bg-slate-300/15 text-slate-200 border border-slate-300/40',
  },
  {
    min: 60, key: 'bronze', label: 'Bronze',
    gradientFrom: '#fed7aa', gradientVia: '#c2410c', gradientTo: '#7c2d12',
    textClass: 'text-orange-400',
    outlineColor: 'rgba(45, 13, 5, 0.9)',
    badgeClass: 'bg-orange-600/15 text-orange-400 border border-orange-500/40',
  },
  {
    min: 0, key: 'common', label: 'Common',
    gradientFrom: '#475569', gradientVia: '#334155', gradientTo: '#1e293b',
    textClass: 'text-muted-foreground',
    outlineColor: 'rgba(226, 232, 240, 0.55)',
    badgeClass: 'bg-muted/30 text-muted-foreground border border-border',
  },
] as const;

export type PlayerTier = typeof PLAYER_TIER_THRESHOLDS[number];

// ── Stat Bar Color Thresholds (percentage-based) ──
export const STAT_BAR_THRESHOLDS = [
  { min: 80, bgClass: 'bg-emerald-500' },
  { min: 60, bgClass: 'bg-sky-500' },
  { min: 40, bgClass: 'bg-amber-500' },
  { min: 0,  bgClass: 'bg-destructive' },
] as const;

// ── Confidence Color Thresholds ──
export const CONFIDENCE_COLOR_THRESHOLDS = [
  { min: 60, textClass: 'text-emerald-400', bgClass: 'bg-emerald-500' },
  { min: 30, textClass: 'text-amber-400', bgClass: 'bg-amber-500' },
  { min: 0,  textClass: 'text-destructive', bgClass: 'bg-destructive' },
] as const;

// ── Fan Confidence Color Thresholds (higher bar than board confidence) ──
export const FAN_CONFIDENCE_THRESHOLDS = [
  { min: 70, textClass: 'text-emerald-400' },
  { min: 40, textClass: 'text-amber-400' },
  { min: 0,  textClass: 'text-destructive' },
] as const;

// ── Fitness/Morale Color Thresholds ──
export const FITNESS_COLOR_THRESHOLDS = [
  { min: 70, bgClass: 'bg-emerald-500' },
  { min: 40, bgClass: 'bg-amber-500' },
  { min: 0,  bgClass: 'bg-destructive' },
] as const;

// ── Position Filters ──
export const POSITION_FILTERS: { label: string; positions: Position[] }[] = [
  { label: 'All', positions: [] },
  { label: 'GK', positions: ['GK'] },
  { label: 'DEF', positions: ['CB', 'LB', 'RB'] },
  { label: 'MID', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'] },
  { label: 'FWD', positions: ['LW', 'RW', 'ST'] },
];

// ── Board Verdict Colors & Labels ──
export const VERDICT_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-sky-400',
  acceptable: 'text-muted-foreground',
  poor: 'text-amber-400',
  sacked: 'text-destructive',
} as const;

export const VERDICT_LABELS: Record<string, string> = {
  excellent: 'Excellent Season!',
  good: 'Good Season',
  acceptable: 'Acceptable',
  poor: 'Disappointing',
  sacked: 'Under Pressure',
} as const;

// ── Match Rating Color Thresholds (used in MatchReview) ──
export const MATCH_RATING_THRESHOLDS = [
  { min: 8, textClass: 'text-emerald-400' },
  { min: 6, textClass: 'text-sky-400' },
  { min: 0, textClass: 'text-amber-400' },
] as const;

// ── Fitness Hex Colors (for SVG rendering on pitch) ──
export const FITNESS_HEX_THRESHOLDS = [
  { min: 80, color: '#22c55e' },
  { min: 60, color: '#38bdf8' },
  { min: 40, color: '#f97316' },
  { min: 0,  color: '#ef4444' },
] as const;

// ── Pitch SVG Colors ──
export const PITCH_COLORS = {
  FILL: '#1a3a2a',
  LINE: '#2d5a3f',
  HOME_DEFAULT: '#10b981',
  AWAY_DEFAULT: '#666',
} as const;

// ── Pitch Slot Y-Mapping ──
// Vertical span (in SVG units) used to lay out formation slots inside the
// half-pitch views (LineupEditor + SubstitutionSheet). Wider span → more
// vertical room between player tiles → less overlap on formations that
// stack attackers / midfielders close together. The canonical formation
// `y` values top out around 82, so `y=100` doesn't need to fit on screen —
// keep room above the GK row for the highest strikers / wingers without
// overflowing the pitch. Shared so the same formation renders with the
// same shape on the tactics screen and in-match.
export const SLOT_Y_RANGE = 54;
export const SLOT_Y_BOTTOM = 97;

/**
 * A formation slot's centre, in the half-pitch SVG's own units.
 *
 * Lives beside the constants it uses rather than in `PitchBoard`, because the
 * chemistry lines, the tokens and (one day) `SubstitutionSheet`'s badges all
 * need it and none of them should have to import a component to get it. Two
 * copies of this arithmetic is how a chemistry line ends up half a tile off
 * the player it belongs to.
 */
export function pitchSlotPoint(slot: { x: number; y: number }): { x: number; y: number } {
  return {
    x: 2 + (slot.x / 100) * 64,
    y: SLOT_Y_BOTTOM - (slot.y / 100) * SLOT_Y_RANGE,
  };
}

// ── Chart Colors ──
export const CHART_COLORS = {
  PRIMARY: 'hsl(160, 84%, 39%)',
  COMPARISON: '#34d399',
  FILL_OPACITY_PRIMARY: 0.2,
  FILL_OPACITY_SECONDARY: 0.15,
  STROKE_WIDTH: 2,
} as const;

// ── Player Radar Chart ──
export const PLAYER_RADAR = {
  HEIGHT: 180,
  OUTER_RADIUS: '70%',
  LABEL_FONT_SIZE: 10,
  CHANGE_FONT_SIZE: 9,
  CHANGE_POSITIVE_COLOR: '#34d399',
  CHANGE_NEGATIVE_COLOR: '#f87171',
} as const;

// ── Player Mood Thresholds (used in ContractNegotiation) ──
export const MOOD_COLOR_THRESHOLDS = [
  { min: 60, textClass: 'text-emerald-400', label: 'Positive' },
  { min: 35, textClass: 'text-amber-400', label: 'Cautious' },
  { min: 0,  textClass: 'text-destructive', label: 'Frustrated' },
] as const;

// ── Scouting Knowledge Thresholds ──
export const SCOUTING_KNOWLEDGE_THRESHOLDS = {
  REVEAL_OVERALL: 60,
  REVEAL_IDENTITY: 40,
} as const;

// ── Scouting / Youth Potential Color Thresholds ──
// NOTE: `text-primary` must never appear in a tier ladder that also contains an
// emerald step. `.game-theme` overrides `--primary` to emerald 160 84% 39%
// (src/index.css), so in-game the min-65 tier used to render at the same hue as
// the min-75 tier, 13% lightness apart — "Good" and "High" potential were
// visually indistinguishable. Sky matches the mid tier of STAT_BAR_THRESHOLDS
// and getRatingHex's 70-band, so the ladder now reads muted -> sky -> emerald.
export const POTENTIAL_COLOR_THRESHOLDS = [
  { min: 75, textClass: 'text-emerald-400', fillClass: 'text-emerald-400 fill-emerald-400', bgClass: 'bg-emerald-500/20 text-emerald-400', label: 'High' },
  { min: 65, textClass: 'text-sky-400', fillClass: 'text-sky-400 fill-sky-400', bgClass: 'bg-sky-500/20 text-sky-400', label: 'Good' },
  { min: 0,  textClass: 'text-muted-foreground', fillClass: 'text-muted-foreground', bgClass: 'bg-muted/50 text-muted-foreground', label: 'Average' },
] as const;

// ── Club Selection Difficulty Config ──
export const DIFFICULTY_CONFIG: Record<string, { color: string; bg: string; bar: string; label: string }> = {
  Easy: { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', bar: 'bg-emerald-400/50', label: 'Recommended' },
  'Medium-Low': { color: 'text-teal-400', bg: 'bg-teal-400/10 border-teal-400/20', bar: 'bg-teal-400/50', label: 'Moderate' },
  Medium: { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', bar: 'bg-blue-400/50', label: 'Medium' },
  Hard: { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', bar: 'bg-amber-400/50', label: 'Hard' },
  'Very Hard': { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', bar: 'bg-red-400/50', label: 'Expert' },
} as const;

export const DIFFICULTY_BARS: Record<string, number> = { Easy: 1, 'Medium-Low': 2, Medium: 2, Hard: 3, 'Very Hard': 4 } as const;

// ── Help Texts (used by InfoTip component) ──
export const HELP_TEXTS = {
  boardConfidence: 'Board confidence reflects how happy the board is with your results. Winning boosts it, losing drops it. Below 25% you risk being sacked.',
  morale: 'Average squad morale. Winning boosts morale, losing lowers it. Low morale hurts match performance.',
  budget: 'Your transfer budget. Income comes from matchday, commercial, and stadium revenue minus your weekly wage bill.',
  fanMood: 'Fan mood scales your matchday income up or down. Good results and winning streaks keep fans happy. Note that the size of that matchday income depends on your league — top-flight gates are worth many times a lower-division gate, so promotion is the biggest revenue jump available to you.',
  trainingIntensity: 'Training intensity affects development speed and injury risk. Heavy training develops players faster but increases injury risk. Light training recovers fitness but progress is slower. Medium balances both.',
  tacticalFamiliarity: 'How well your team knows the current formation. Higher familiarity improves match performance. Train "Tactical" to boost it.',
  transferBudget: 'Your available funds for buying players. Wage costs reduce your weekly income, so watch the wage bill too.',
  transferWindow: 'You can only buy/sell players during the summer window (season start) and the winter window (mid-season). Exact weeks scale with your league\'s season length — check the Transfers page header.',
  chemistry: 'Chemistry reflects how well players work together. Players from the same nationality, with compatible positions, or who have played together longer build stronger links.',
  form: 'A player\'s recent match performance. Good form boosts morale and match ratings. Poor form can lower confidence.',
  playerRating: 'Player ratings run 1–99. Tiers: Legendary 90+ (red-gold), Gold 80–89 (amber), Silver 70–79, Bronze 60–69, Common below 60. Inline rating text uses green for world-class, sky for solid, amber for average, grey for weak.',
  potential: 'A player\'s maximum possible rating. Young players (<24) grow toward their potential through training and match time. Veterans (31+) gradually decline.',
  personality: 'Personality traits affect how a player behaves. Professionalism boosts training, ambition drives growth, temperament affects cards, loyalty reduces transfer demands, and leadership inspires teammates.',
  mentality: 'Team mentality affects how aggressively your team plays. Attacking pushes players forward for more goals but leaves gaps at the back. Defensive sits deep and absorbs pressure.',
  pressingIntensity: 'How aggressively your team pressures the opposition. High pressing wins the ball back quickly but tires players faster. Low pressing conserves energy but gives opponents more time on the ball.',
  defensiveLine: 'How high your defensive line sits. A high line compresses the pitch but risks being caught by long balls. A deep line is harder to break down but concedes territory.',
  width: 'How wide your team spreads. Wide play stretches defences and creates crossing chances. Narrow play keeps everything compact and central.',
  tempo: 'The speed of your passing. Fast tempo creates quick attacks and catches opponents off guard. Slow tempo controls possession and waits for openings.',
  wageRatio: 'Your wage bill as a percentage of weekly income. Keep this below 70% to avoid Financial Fair Play penalties. The board will lose confidence if you overspend.',
  playerValue: 'A player\'s estimated transfer value, based on age, overall rating, potential, and contract length. Younger players with high potential are worth more.',
  contractLength: 'How many seasons remain on a player\'s contract. Players with expiring contracts may leave for free. Renew early to protect your investment.',
  fitnessImpact: 'Player fitness affects match performance. Below 75% players perform noticeably worse. Fitness drops ~15% per match and recovers during rest weeks. The Recovery Center facility speeds recovery.',
  injuryRisk: 'Heavy training and low fitness increase injury risk. The Medical Center facility reduces recovery time. Players returning from injury have elevated re-injury risk for several weeks.',
} as const;

// ── Page Hints (first-visit tips) ──
export const PAGE_HINTS: Record<string, { title: string; body: string }> = {
  tactics: {
    title: 'Tactics Guide',
    body: 'Pick a formation and set your mentality. Tactical familiarity builds over time — avoid switching formations too often.',
  },
  training: {
    title: 'Training Guide',
    body: 'Set your weekly training schedule. Heavy training develops players faster but risks injuries. Train "Tactical" to boost formation familiarity.',
  },
  transfers: {
    title: 'Transfer Guide',
    body: 'Browse the market and make offers during transfer windows. Add players to your shortlist to track them between sessions.',
  },
  squad: {
    title: 'Squad Guide',
    body: 'View your players, check fitness and morale, and spot injuries. Tap any player for full details. Keep squad depth balanced across positions.',
  },
  finance: {
    title: 'Finance Guide',
    body: 'Track your budget, wage bill, and income. Selling players and winning matches generate revenue. Keep wages under control to stay profitable.',
  },
  matchPrep: {
    title: 'Match Prep Guide',
    body: 'Review opponent formation, key threats, and form. Rotate tired players before kick-off. Tap "Edit Lineup" to make changes.',
  },
  matchDay: {
    title: 'Match Day Guide',
    body: 'Watch the match unfold minute-by-minute. At half-time you can make substitutions, change mentality, and give a team talk.',
  },
  comparison: {
    title: 'Player Comparison',
    body: 'Compare two players side-by-side using radar charts and stats. Great for deciding between transfer targets or lineup picks.',
  },
  cup: {
    title: 'Cup Competition',
    body: 'Track your cup progress through each round. Win to advance — lose and you\'re out. Cup matches can bring surprise results.',
  },
  scouting: {
    title: 'Scouting Guide',
    body: 'Assign scouts to regions to discover hidden talent. Better scouts find higher-potential players. Check the watch list for discoveries.',
  },
  packs: {
    title: 'Market Guide',
    body: 'One free pack every day — it gets better the longer your login streak runs. Paid packs guarantee a higher floor, and every pack publishes its drop rates under "Odds". One pack is featured each week with a bonus card on its first purchase. Revealed players join your squad straight away, so keep a squad slot free.',
  },
  staff: {
    title: 'Staff Guide',
    body: 'Hire coaching staff to boost training quality and match preparation. Each role provides specific bonuses to your squad.',
  },
  youthAcademy: {
    title: 'Youth Academy',
    body: 'Your academy produces young prospects each season. Promote the best to your first team and release the rest. Upgrade facilities for better prospects.',
  },
  perks: {
    title: 'Manager Perks',
    body: 'Earn XP from matches and achievements to unlock perks. Each perk provides a permanent bonus — choose wisely to match your playstyle.',
  },
  prestige: {
    title: 'Prestige Mode',
    body: 'Reset your career with permanent bonuses carried over. The more you achieve before prestiging, the stronger your bonuses for the next run.',
  },
  facilities: {
    title: 'Facilities Guide',
    body: 'Upgrade your stadium, training ground, medical centre, and youth academy. Higher levels improve revenue, player development, and injury recovery.',
  },
  inbox: {
    title: 'Inbox',
    body: 'All club communications arrive here — transfer offers, contract alerts, board messages, and injury updates. Filter by type to find what you need.',
  },
  playerDetail: {
    title: 'Player Profile',
    body: 'View detailed stats, personality traits, and contract info. Personality affects training, morale stability, and transfer demands.',
  },
  leagueTable: {
    title: 'League Table',
    body: 'Track your division standings. Promotion zones are highlighted in green, relegation in red. Playoff contenders are marked in amber.',
  },
  nationalTeam: {
    title: 'National Team',
    body: 'Manage your country\'s squad for international tournaments. Select players, set formation, and compete for glory on the world stage.',
  },
  jobMarket: {
    title: 'Job Market',
    body: 'Browse available managerial positions and apply for clubs that match your reputation. Wait for offers or seek new challenges.',
  },
  internationalTournament: {
    title: 'International Tournament',
    body: 'Your national team competes in a group stage followed by knockout rounds. Advance the tournament week by week — win the final to become world champions!',
  },
  nationalSquadPicker: {
    title: 'Squad Selection',
    body: 'Pick your 23-man national squad before the first match. Your top 50 eligible players are listed by overall — choose the best mix of stars, depth, and youth.',
  },
} as const;

// ── More Drawer (New Player Onboarding) ──
export const NEW_PLAYER_DRAWER_WEEK_THRESHOLD = 4;

// ── Dashboard Thresholds ──
export const MID_SEASON_WEEK = 23;
export const CONFIDENCE_CRITICAL_THRESHOLD = 35;
export const CONFIDENCE_LOW_THRESHOLD = 50;
export const FAN_MOOD_HIGH_THRESHOLD = 70;
export const FAN_MOOD_MID_THRESHOLD = 40;

// ── Rivalries Hub Thresholds ──
// A repeat opponent qualifies as a "rival" for the Rivalries Hub when either
// the grudge level has climbed at least this high, or the two clubs have met
// at least this many times (head-to-head record). Hardcoded derbies always
// qualify regardless of these.
export const RIVAL_MIN_GRUDGE = 1;
export const RIVAL_MIN_MEETINGS = 4;

// ── Tactics Thresholds ──
export const PRESSING_LOW_THRESHOLD = 30;
export const PRESSING_MED_THRESHOLD = 60;

// ── Transfer Page Thresholds ──
export const SIGNIFICANT_OFFER_OVERALL = 70;
export const SIGNIFICANT_OFFER_FEE = 5_000_000;
export const BUDGET_WARNING_THRESHOLD = 0.5;         // Amber affordability dot at 50% of budget
export const HOT_FORM_THRESHOLD = 1.15;              // Performance multiplier for "Hot form" badge
export const GOOD_FORM_THRESHOLD = 1.05;             // Performance multiplier for "Good form" badge
export const OFFER_EXPIRY_WARNING_WEEKS = 2;         // Show "Expiring" badge this many weeks early

// ── Listing Attractiveness Thresholds (ListForSaleModal) ──
export const LISTING_ATTRACTIVENESS = [
  { maxRatio: 0.8, label: 'Bargain', color: 'text-emerald-400' },
  { maxRatio: 1.1, label: 'Fair', color: 'text-emerald-400' },
  { maxRatio: 1.4, label: 'Normal', color: 'text-amber-400' },
  { maxRatio: 1.7, label: 'Steep', color: 'text-amber-400' },
  { maxRatio: Infinity, label: 'Unlikely', color: 'text-red-400' },
] as const;

// ── Attribute Rating Thresholds (for per-attribute color coding in PlayerDetail/TeamDetail) ──
export const ATTR_RATING_HIGH = 15;
export const ATTR_RATING_MID = 10;
export const ATTR_RATING_LOW = 7;

// ── Weekly Digest significance ──
//
// `advanceWeek` builds a digest every single week. Surfacing it as a
// scroll-locked, haptic + chime modal every week is ~43 forced dismiss-taps a
// season and ~430 across a ten-season dynasty — the highest-frequency
// interruption in the game, and most of those weeks contain nothing the player
// can act on.
//
// The rule below is deliberately about ACTION, not information: a week is
// "significant" when the digest is telling the player something they may want
// to respond to (a lineup change, an offer, a renewal, a report to read, XP to
// claim, a morale problem). Passive readouts — finances, per-attribute growth,
// training star performers — are *not* significant on their own: they happen
// almost every week and they are fully visible on the inline Dashboard card,
// so they never justify stealing the screen.

/** Morale swing (absolute points) that makes a quiet week worth interrupting.
 *  Matches the threshold the digest headline already uses. */
export const DIGEST_SIGNIFICANT_MORALE_SWING = 8;

/** Structural shape of `GameState['weeklyDigest']`, declared locally so this
 *  config module stays free of store imports. */
export interface WeeklyDigestSummary {
  injuriesThisWeek: string[];
  recoveriesThisWeek: string[];
  offersReceived: number;
  moraleChange: number;
  scoutReportsCompleted: number;
  contractWarnings: string[];
  objectiveProgress: { completed: boolean }[];
}

/** True when the weekly digest earns a full-screen, scroll-locking modal. */
export function isWeeklyDigestSignificant(digest: WeeklyDigestSummary | null | undefined): boolean {
  if (!digest) return false;
  return (
    digest.injuriesThisWeek.length > 0 ||
    digest.recoveriesThisWeek.length > 0 ||
    digest.offersReceived > 0 ||
    digest.contractWarnings.length > 0 ||
    digest.scoutReportsCompleted > 0 ||
    digest.objectiveProgress.some(o => o.completed) ||
    Math.abs(digest.moraleChange) >= DIGEST_SIGNIFICANT_MORALE_SWING
  );
}

// ── Animation & Timer Durations (ms) ──
export const SAVE_CONFIRMATION_MS = 2000;
export const GOAL_FLASH_MS = 600;
export const CELEBRATION_STAGGER_MS = 800;
export const ADVANCE_DONE_MS = 300;
export const FLASH_DURATION_MS = 600;
export const XP_GLOW_MS = 1500;

// ── Market Sub-Navigation ──
export const MARKET_SUB_NAV: { screen: GameScreen; label: string }[] = [
  { screen: 'transfers', label: 'Transfers' },
  { screen: 'scouting', label: 'Scouting' },
  { screen: 'packs', label: 'Packs' },
];

// ── Squad Sub-Navigation ──
export const SQUAD_SUB_NAV: { screen: GameScreen; label: string }[] = [
  { screen: 'squad', label: 'Squad' },
  { screen: 'training', label: 'Training' },
  { screen: 'staff', label: 'Staff' },
  { screen: 'youth-academy', label: 'Youth' },
];

// ── Sunday League Sub-Navigation ──
// Key-based, unlike the two lists above: every Sunday nav label resolves
// through `t()` so the tab strip, the sub-nav strip and SCREEN_TITLES cannot
// drift apart the way "Club"/"Money" did. The legacy English literals above
// are left alone deliberately — converting them is a separate job.
export const SUNDAY_TEAM_SUB_NAV: { screen: GameScreen; labelKey: TranslationKey }[] = [
  { screen: 'sunday-teamsheet', labelKey: 'sunday.nav.teamsheet' },
  { screen: 'sunday-squad', labelKey: 'sunday.nav.squad' },
  { screen: 'sunday-recruit', labelKey: 'sunday.nav.recruits' },
];

export const SUNDAY_CLUB_SUB_NAV: { screen: GameScreen; labelKey: TranslationKey }[] = [
  { screen: 'sunday-clubhouse', labelKey: 'sunday.nav.clubhouse' },
  { screen: 'sunday-history', labelKey: 'sunday.nav.history' },
];

// ── Team Talk Options (match day half-time) ──
export const TEAM_TALK_OPTIONS = [
  {
    id: 'motivate', label: 'Motivate', icon: 'Flame',
    description: "Let's show them what we're made of!",
    effects: [
      { label: '+8% Attack', type: 'positive' as const },
      { label: 'Slight energy drain', type: 'warning' as const },
    ],
  },
  {
    id: 'calm', label: 'Stay Calm', icon: 'Shield',
    description: 'Keep focused, stick to the game plan.',
    effects: [
      { label: '+6% Defence', type: 'positive' as const },
      { label: 'Conserves energy', type: 'positive' as const },
      { label: '-10% Fouls', type: 'positive' as const },
    ],
  },
  {
    id: 'demand', label: 'Demand More', icon: 'AlertTriangle',
    description: "I expect more from every one of you!",
    effects: [
      { label: '+12% Attack', type: 'positive' as const },
      { label: '-6% Defence', type: 'negative' as const },
      { label: 'High energy drain', type: 'negative' as const },
      { label: 'Morale risk', type: 'warning' as const },
    ],
  },
] as const;
