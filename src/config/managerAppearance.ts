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

// ── Background Colors (8 options) ──
export const BADGE_COLORS = [
  { color: '#1a1a2e', label: 'Navy' },
  { color: '#2d2d2d', label: 'Charcoal' },
  { color: '#0a0a0a', label: 'Black' },
  { color: '#3d2b1f', label: 'Brown' },
  { color: '#1a3a2a', label: 'Forest' },
  { color: '#3b1929', label: 'Burgundy' },
  { color: '#1a2a4e', label: 'Royal' },
  { color: '#2e1a3a', label: 'Purple' },
] as const;

// ── Accent / Ring Colors (6 options) ──
export const ACCENT_COLORS = [
  { color: '#D4A017', label: 'Gold' },
  { color: '#B0B0B0', label: 'Silver' },
  { color: '#C0392B', label: 'Red' },
  { color: '#2E86C1', label: 'Blue' },
  { color: '#27AE60', label: 'Emerald' },
  { color: '#8E44AD', label: 'Purple' },
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
  accentColor: '#D4A017',
  pattern: 0,               // solid
  icon: 0,                  // suit
};

export const DEFAULT_FEMALE_APPEARANCE: ManagerAppearance = {
  gender: 'female',
  badgeShape: 0,            // circle
  backgroundColor: '#2e1a3a',
  accentColor: '#D4A017',
  pattern: 0,               // solid
  icon: 0,                  // suit
};

export const DEFAULT_APPEARANCE: ManagerAppearance = { ...DEFAULT_MALE_APPEARANCE };
