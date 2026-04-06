/**
 * Manager emblem badge constants shared between ManagerAvatar and the onboarding wizard.
 */

import type { ManagerAppearance } from '@/types/game';

// ── Badge Shapes (4 options) ──
export const BADGE_SHAPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'shield', label: 'Shield' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'diamond', label: 'Diamond' },
] as const;

// ── Badge Patterns (4 options) ──
export const BADGE_PATTERNS = [
  { id: 'solid', label: 'Solid' },
  { id: 'striped', label: 'Striped' },
  { id: 'split', label: 'Split' },
  { id: 'chevron', label: 'Chevron' },
] as const;

// ── Badge Icons (5 options) ──
export const BADGE_ICONS = [
  { id: 'suit', label: 'Suit' },
  { id: 'tracksuit', label: 'Tracksuit' },
  { id: 'whistle', label: 'Whistle' },
  { id: 'clipboard', label: 'Clipboard' },
  { id: 'trophy', label: 'Trophy' },
] as const;

// ── Defaults ──
export const DEFAULT_MALE_APPEARANCE: ManagerAppearance = {
  gender: 'male',
  badgeShape: 1,            // shield
  backgroundColor: '#1a1a2e',
  accentColor: '#10b981',
  pattern: 0,               // solid
  icon: 0,                  // suit
};

export const DEFAULT_APPEARANCE: ManagerAppearance = { ...DEFAULT_MALE_APPEARANCE };
