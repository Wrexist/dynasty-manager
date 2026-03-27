/**
 * Manager appearance constants shared between ManagerAvatar and the onboarding wizard.
 */

import type { ManagerAppearance } from '@/types/game';

export const SKIN_TONES = ['#F5D0A9', '#D4A574', '#A0785A', '#6B4423'];
export const HAIR_COLORS = ['#2C1B0E', '#5C3317', '#8B6914', '#D4A843', '#C0392B', '#1A1A2E'];
export const HAIR_STYLES = ['none', 'short', 'medium', 'mohawk', 'buzz', 'long'] as const;

export const SUIT_COLORS = [
  { color: '#1a1a2e', label: 'Navy' },
  { color: '#2d2d2d', label: 'Charcoal' },
  { color: '#0a0a0a', label: 'Black' },
  { color: '#3d2b1f', label: 'Brown' },
  { color: '#1a3a2a', label: 'Green' },
  { color: '#3b1929', label: 'Burgundy' },
];

export const DEFAULT_APPEARANCE: ManagerAppearance = {
  skinTone: 0,
  hairStyle: 1,
  hairColor: 0,
  suitColor: '#1a1a2e',
};
