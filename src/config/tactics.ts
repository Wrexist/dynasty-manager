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

export const STYLE_PRESETS: (StylePreset & { description: string })[] = [
  { label: 'Park the Bus', description: 'Ultra-defensive. Sit deep, absorb pressure, and protect the lead.', values: { mentality: 'defensive', width: 'narrow', tempo: 'slow', defensiveLine: 'deep', pressingIntensity: 25 } },
  { label: 'Balanced', description: 'No extreme risks. A solid default for most matches.', values: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 } },
  { label: 'All-Out Attack', description: 'Maximum attacking intent. High line, fast tempo. Risky but explosive.', values: { mentality: 'all-out-attack', width: 'wide', tempo: 'fast', defensiveLine: 'high', pressingIntensity: 75 } },
  { label: 'Counter-Attack', description: 'Defend deep then strike quickly on fast transitions.', values: { mentality: 'cautious', width: 'narrow', tempo: 'fast', defensiveLine: 'deep', pressingIntensity: 40 } },
];
