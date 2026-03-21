/**
 * UI Helper Functions
 * Centralized color/rating logic used across pages and components.
 */

import { PlayerAttributes } from '@/types/game';
import { FAN_CONFIDENCE_FAN_WEIGHT, FAN_CONFIDENCE_BOARD_WEIGHT } from '@/config/gameBalance';
import {
  RATING_COLOR_THRESHOLDS,
  STAT_BAR_THRESHOLDS,
  CONFIDENCE_COLOR_THRESHOLDS,
  FAN_CONFIDENCE_THRESHOLDS,
  FITNESS_COLOR_THRESHOLDS,
  MATCH_RATING_THRESHOLDS,
  MOOD_COLOR_THRESHOLDS,
  POTENTIAL_COLOR_THRESHOLDS,
} from '@/config/ui';

/** Get top 3 highest attributes from a player's attribute set */
export function getTop3Attributes(attrs: PlayerAttributes): { label: string; value: number }[] {
  const entries = [
    { label: 'PAC', value: attrs.pace },
    { label: 'SHO', value: attrs.shooting },
    { label: 'PAS', value: attrs.passing },
    { label: 'DEF', value: attrs.defending },
    { label: 'PHY', value: attrs.physical },
    { label: 'MEN', value: attrs.mental },
  ];
  return entries.sort((a, b) => b.value - a.value).slice(0, 3);
}

/** Get text color class for an overall/attribute value (80=emerald, 70=primary, 60=amber) */
export function getRatingColor(value: number): string {
  for (const t of RATING_COLOR_THRESHOLDS) {
    if (value >= t.min) return t.textClass;
  }
  return 'text-muted-foreground';
}

/** Get background color class for a stat bar percentage */
export function getStatBarColor(pct: number): string {
  for (const t of STAT_BAR_THRESHOLDS) {
    if (pct >= t.min) return t.bgClass;
  }
  return 'bg-destructive';
}

/** Get text + bg color classes for board confidence value */
export function getConfidenceColor(value: number): { textClass: string; bgClass: string } {
  for (const t of CONFIDENCE_COLOR_THRESHOLDS) {
    if (value >= t.min) return { textClass: t.textClass, bgClass: t.bgClass };
  }
  return { textClass: 'text-destructive', bgClass: 'bg-destructive' };
}

/** Get text color class for fan confidence (uses higher thresholds than board confidence) */
export function getFanConfidenceColor(value: number): string {
  for (const t of FAN_CONFIDENCE_THRESHOLDS) {
    if (value >= t.min) return t.textClass;
  }
  return 'text-destructive';
}

/** Get background color class for fitness/morale bars */
export function getFitnessColor(value: number): string {
  for (const t of FITNESS_COLOR_THRESHOLDS) {
    if (value >= t.min) return t.bgClass;
  }
  return 'bg-destructive';
}

/** Get text color class for match rating (8+=emerald, 6+=primary, else amber) */
export function getMatchRatingColor(rating: number): string {
  for (const t of MATCH_RATING_THRESHOLDS) {
    if (rating >= t.min) return t.textClass;
  }
  return 'text-amber-400';
}

/** Get combined bg + text classes for a rating badge (e.g. 'bg-emerald-500/20 text-emerald-400') */
export function getRatingBadgeClasses(value: number): string {
  for (const t of RATING_COLOR_THRESHOLDS) {
    if (value >= t.min) return `${t.bgClass}/20 ${t.textClass}`;
  }
  return 'bg-muted/50 text-muted-foreground';
}

/** Get risk level string for board confidence */
export function getConfidenceRisk(value: number): 'safe' | 'warning' | 'danger' {
  if (value >= 60) return 'safe';
  if (value >= 30) return 'warning';
  return 'danger';
}

/** Get background color class for morale dots/bars (uses mood thresholds) */
export function getMoraleBgColor(morale: number): string {
  if (morale >= 60) return 'bg-emerald-500';
  if (morale >= 35) return 'bg-amber-500';
  return 'bg-destructive';
}

/** Get text color class for player mood */
export function getMoodColor(mood: number): string {
  for (const t of MOOD_COLOR_THRESHOLDS) {
    if (mood >= t.min) return t.textClass;
  }
  return 'text-destructive';
}

/** Get mood label ('Positive', 'Cautious', 'Frustrated') */
export function getMoodLabel(mood: number): string {
  for (const t of MOOD_COLOR_THRESHOLDS) {
    if (mood >= t.min) return t.label;
  }
  return 'Frustrated';
}

/** Get potential badge classes + label for scouting/youth */
export function getPotentialInfo(value: number): { bgClass: string; fillClass: string; textClass: string; label: string } {
  for (const t of POTENTIAL_COLOR_THRESHOLDS) {
    if (value >= t.min) return { bgClass: t.bgClass, fillClass: t.fillClass, textClass: t.textClass, label: t.label };
  }
  return { bgClass: 'bg-muted/50 text-muted-foreground', fillClass: 'text-muted-foreground', textClass: 'text-muted-foreground', label: 'Average' };
}

/** Calculate fan confidence from fanBase and boardConfidence using config weights */
export function getFanConfidence(fanBase: number, boardConfidence: number): number {
  return Math.min(100, Math.round(fanBase * FAN_CONFIDENCE_FAN_WEIGHT + boardConfidence * FAN_CONFIDENCE_BOARD_WEIGHT));
}
