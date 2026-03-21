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
  trainingIntensity: 'Heavy training develops players faster but increases injury risk. Light training is safer but progress is slower.',
  tacticalFamiliarity: 'How well your team knows the current formation. Higher familiarity improves match performance. Train "Tactical" to boost it.',
  transferBudget: 'Your available funds for buying players. Wage costs reduce your weekly income, so watch the wage bill too.',
  transferWindow: 'You can only buy/sell players during transfer windows: Weeks 1-8 (summer) and Weeks 20-24 (winter).',
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
} as const;

// ── Team Talk Options (match day half-time) ──
export const TEAM_TALK_OPTIONS = [
  { id: 'motivate', label: 'Motivate', icon: 'Flame', description: "Let's show them what we're made of!" },
  { id: 'calm', label: 'Stay Calm', icon: 'Shield', description: 'Keep focused, stick to the game plan.' },
  { id: 'demand', label: 'Demand More', icon: 'AlertTriangle', description: "I expect more from every one of you!" },
] as const;
