/**
 * UI Configuration
 * Rating colors, confidence colors, position filters, verdict labels, and thresholds.
 */

import type { Position } from '@/types/game';

// ── Rating Color Thresholds (overall, attribute values) ──
export const RATING_COLOR_THRESHOLDS = [
  { min: 80, textClass: 'text-emerald-400', bgClass: 'bg-emerald-500' },
  { min: 70, textClass: 'text-primary', bgClass: 'bg-primary' },
  { min: 60, textClass: 'text-amber-400', bgClass: 'bg-amber-500' },
  { min: 0,  textClass: 'text-muted-foreground', bgClass: 'bg-destructive' },
] as const;

// ── Stat Bar Color Thresholds (percentage-based) ──
export const STAT_BAR_THRESHOLDS = [
  { min: 80, bgClass: 'bg-emerald-500' },
  { min: 60, bgClass: 'bg-primary' },
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
  good: 'text-primary',
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
  { min: 6, textClass: 'text-primary' },
  { min: 0, textClass: 'text-amber-400' },
] as const;

// ── Fitness Hex Colors (for SVG rendering on pitch) ──
export const FITNESS_HEX_THRESHOLDS = [
  { min: 80, color: '#22c55e' },
  { min: 60, color: '#eab308' },
  { min: 40, color: '#f97316' },
  { min: 0,  color: '#ef4444' },
] as const;

// ── Pitch SVG Colors ──
export const PITCH_COLORS = {
  FILL: '#1a3a2a',
  LINE: '#2d5a3f',
  HOME_DEFAULT: '#D4A843',
  AWAY_DEFAULT: '#666',
} as const;

// ── Chart Colors ──
export const CHART_COLORS = {
  PRIMARY: 'hsl(43, 96%, 46%)',
  COMPARISON: '#34d399',
  FILL_OPACITY_PRIMARY: 0.2,
  FILL_OPACITY_SECONDARY: 0.15,
  STROKE_WIDTH: 2,
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
export const POTENTIAL_COLOR_THRESHOLDS = [
  { min: 75, textClass: 'text-emerald-400', fillClass: 'text-emerald-400 fill-emerald-400', bgClass: 'bg-emerald-500/20 text-emerald-400', label: 'High' },
  { min: 65, textClass: 'text-primary', fillClass: 'text-primary fill-primary', bgClass: 'bg-primary/20 text-primary', label: 'Good' },
  { min: 0,  textClass: 'text-muted-foreground', fillClass: 'text-muted-foreground', bgClass: 'bg-muted/50 text-muted-foreground', label: 'Average' },
] as const;

// ── Club Selection Difficulty Config ──
export const DIFFICULTY_CONFIG: Record<string, { color: string; bg: string; bar: string; label: string }> = {
  Easy: { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', bar: 'bg-emerald-400/50', label: 'Recommended' },
  Medium: { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', bar: 'bg-blue-400/50', label: 'Medium' },
  Hard: { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', bar: 'bg-amber-400/50', label: 'Hard' },
  'Very Hard': { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', bar: 'bg-red-400/50', label: 'Expert' },
} as const;

export const DIFFICULTY_BARS: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3, 'Very Hard': 4 } as const;

// ── Help Texts (used by InfoTip component) ──
export const HELP_TEXTS = {
  boardConfidence: 'Board confidence reflects how happy the board is with your results. Winning boosts it, losing drops it. Below 25% you risk being sacked.',
  morale: 'Average squad morale. Winning boosts morale, losing lowers it. Low morale hurts match performance.',
  budget: 'Your transfer budget. Income comes from matchday, commercial, and stadium revenue minus your weekly wage bill.',
  fanMood: 'Fan mood affects stadium atmosphere and income. Good results and winning streaks keep fans happy.',
  trainingIntensity: 'Training intensity affects development speed and injury risk. Heavy training develops players faster but increases injury risk. Light training recovers fitness but progress is slower. Medium balances both.',
  tacticalFamiliarity: 'How well your team knows the current formation. Higher familiarity improves match performance. Train "Tactical" to boost it.',
  transferBudget: 'Your available funds for buying players. Wage costs reduce your weekly income, so watch the wage bill too.',
  transferWindow: 'You can only buy/sell players during transfer windows: Weeks 1-8 (summer) and Weeks 20-24 (winter).',
  chemistry: 'Chemistry reflects how well players work together. Players from the same nationality, with compatible positions, or who have played together longer build stronger links.',
  form: 'A player\'s recent match performance. Good form boosts morale and match ratings. Poor form can lower confidence.',
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
} as const;

// ── Dashboard Thresholds ──
export const MID_SEASON_WEEK = 23;
export const CONFIDENCE_CRITICAL_THRESHOLD = 35;
export const CONFIDENCE_LOW_THRESHOLD = 50;
export const CONFIDENCE_HIGH_THRESHOLD = 70;
export const FAN_MOOD_HIGH_THRESHOLD = 70;
export const FAN_MOOD_MID_THRESHOLD = 40;
export const HOT_STREAK_MIN_WINS = 4;

// ── Tactics Thresholds ──
export const PRESSING_LOW_THRESHOLD = 30;
export const PRESSING_MED_THRESHOLD = 60;

// ── Transfer Page Thresholds ──
export const SIGNIFICANT_OFFER_OVERALL = 70;
export const SIGNIFICANT_OFFER_FEE = 5_000_000;

// ── Attribute Rating Thresholds (for per-attribute color coding in PlayerDetail/TeamDetail) ──
export const ATTR_RATING_HIGH = 15;
export const ATTR_RATING_MID = 10;
export const ATTR_RATING_LOW = 7;

// ── Animation & Timer Durations (ms) ──
export const SAVE_CONFIRMATION_MS = 2000;
export const GOAL_FLASH_MS = 600;
export const CELEBRATION_STAGGER_MS = 800;
export const ADVANCE_DONE_MS = 300;
export const FLASH_DURATION_MS = 600;
export const SAVE_INDICATOR_MS = 1200;
export const XP_GLOW_MS = 1500;

// ── Team Talk Options (match day half-time) ──
export const TEAM_TALK_OPTIONS = [
  { id: 'motivate', label: 'Motivate', icon: 'Flame', description: "Let's show them what we're made of!" },
  { id: 'calm', label: 'Stay Calm', icon: 'Shield', description: 'Keep focused, stick to the game plan.' },
  { id: 'demand', label: 'Demand More', icon: 'AlertTriangle', description: "I expect more from every one of you!" },
] as const;
