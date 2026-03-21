/**
 * Tactics Configuration
 * Available formations, mentalities, widths, tempos, defensive lines, and style presets.
 */

import type { FormationType, Mentality, TeamWidth, Tempo, DefensiveLine, TacticalInstructions } from '@/types/game';
import { FORMATION_POSITIONS } from '@/types/game';

// Derive available formations from the canonical FORMATION_POSITIONS map
export const FORMATIONS: FormationType[] = Object.keys(FORMATION_POSITIONS) as FormationType[];

export const MENTALITIES: { value: Mentality; label: string }[] = [
  { value: 'defensive', label: 'Defensive' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'attacking', label: 'Attacking' },
  { value: 'all-out-attack', label: 'All-Out' },
];

export const WIDTHS: { value: TeamWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
];

export const TEMPOS: { value: Tempo; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

export const DEFENSIVE_LINES: { value: DefensiveLine; label: string }[] = [
  { value: 'deep', label: 'Deep' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

export const PRESSING_OPTIONS: { label: string; value: number }[] = [
  { label: 'Low', value: 25 },
  { label: 'Medium', value: 50 },
  { label: 'High', value: 75 },
];

export interface StylePreset {
  label: string;
  values: Partial<TacticalInstructions>;
}
