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

// ── Position Group Colors ──
export const POSITION_GROUP_COLORS: Record<string, string> = {
  GK: 'bg-amber-500',
  DEF: 'bg-blue-500',
  MID: 'bg-emerald-500',
  ATT: 'bg-red-500',
} as const;

// ── Board Verdict Colors & Labels ──
export const VERDICT_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-primary',
  acceptable: 'text-muted-foreground',
  poor: 'text-amber-400',
  sacked: 'text-destructive',
} as const;

export const VERDICT_LABELS: Record<string, string> = {
  excellent: '🏆 Excellent Season!',
  good: '👏 Good Season',
  acceptable: '👍 Acceptable',
  poor: '😤 Disappointing',
  sacked: '🔴 Under Pressure',
} as const;

// ── Attribute Short Labels ──
export const ATTRIBUTE_LABELS: { key: string; label: string }[] = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'PHY' },
  { key: 'mental', label: 'MEN' },
];

// ── Match Rating Color Thresholds (used in MatchReview) ──
export const MATCH_RATING_THRESHOLDS = [
  { min: 8, textClass: 'text-emerald-400' },
  { min: 6, textClass: 'text-primary' },
  { min: 0, textClass: 'text-amber-400' },
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
