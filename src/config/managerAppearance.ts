/**
 * Manager appearance constants shared between ManagerAvatar and the onboarding wizard.
 */

import type { ManagerAppearance } from '@/types/game';

// ── Skin Tones (8 options) ──
export const SKIN_TONES = [
  '#FCDEC0', // Porcelain
  '#F5D0A9', // Fair
  '#E8B88A', // Light
  '#D4A574', // Medium
  '#C08A5C', // Tan
  '#A0785A', // Brown
  '#7A5A3E', // Dark Brown
  '#5A3825', // Deep
];

// ── Face Shapes ──
export const FACE_SHAPES = ['round', 'oval', 'square', 'angular'] as const;
export const FACE_SHAPE_LABELS = ['Round', 'Oval', 'Square', 'Angular'];

// ── Eye Styles ──
export const EYE_STYLES = ['default', 'narrow', 'wide', 'round'] as const;
export const EYE_STYLE_LABELS = ['Default', 'Narrow', 'Wide', 'Round'];

// ── Hair Styles (gender-specific, 8 each) ──
export const MALE_HAIR_STYLES = ['none', 'crew', 'short', 'side-part', 'slicked', 'medium', 'curly', 'afro'] as const;
export const MALE_HAIR_LABELS = ['Bald', 'Crew Cut', 'Short', 'Side Part', 'Slicked', 'Medium', 'Curly', 'Afro'];

export const FEMALE_HAIR_STYLES = ['none', 'pixie', 'bob', 'shoulder', 'ponytail', 'bun', 'long', 'braids'] as const;
export const FEMALE_HAIR_LABELS = ['Bald', 'Pixie', 'Bob', 'Shoulder', 'Ponytail', 'Bun', 'Long', 'Braids'];

// Legacy compat — old code imported HAIR_STYLES
export const HAIR_STYLES = MALE_HAIR_STYLES;

// ── Hair Colors (8 options) ──
export const HAIR_COLORS = [
  '#1A1A1A', // Black
  '#2C1B0E', // Dark Brown
  '#5C3317', // Brown
  '#D4A843', // Blonde
  '#8B3A1A', // Auburn
  '#C0392B', // Red
  '#9E9E9E', // Gray / Silver
  '#E8D5B7', // Platinum
];
export const HAIR_COLOR_LABELS = ['Black', 'Dark Brown', 'Brown', 'Blonde', 'Auburn', 'Red', 'Silver', 'Platinum'];

// ── Facial Hair (male only, 6 options) ──
export const FACIAL_HAIR_STYLES = ['none', 'stubble', 'goatee', 'short-beard', 'full-beard', 'mustache'] as const;
export const FACIAL_HAIR_LABELS = ['None', 'Stubble', 'Goatee', 'Short Beard', 'Full Beard', 'Mustache'];

// ── Glasses (4 options) ──
export const GLASSES_STYLES = ['none', 'rectangular', 'round', 'aviator'] as const;
export const GLASSES_LABELS = ['None', 'Rectangular', 'Round', 'Aviator'];

// ── Outfit Types (3 options) ──
export const OUTFIT_TYPES = ['suit', 'tracksuit', 'polo'] as const;
export const OUTFIT_LABELS = ['Suit', 'Tracksuit', 'Polo'];

// ── Outfit Colors (8 options) ──
export const OUTFIT_COLORS = [
  { color: '#1a1a2e', label: 'Navy' },
  { color: '#2d2d2d', label: 'Charcoal' },
  { color: '#0a0a0a', label: 'Black' },
  { color: '#3d2b1f', label: 'Brown' },
  { color: '#1a3a2a', label: 'Green' },
  { color: '#3b1929', label: 'Burgundy' },
  { color: '#e8e8e8', label: 'White' },
  { color: '#3a5a8c', label: 'Light Blue' },
];

// Legacy compat
export const SUIT_COLORS = OUTFIT_COLORS;

// ── Tie Colors (6 options) ──
export const TIE_COLORS = [
  { color: '#D4A017', label: 'Gold' },
  { color: '#C0392B', label: 'Red' },
  { color: '#2E5090', label: 'Blue' },
  { color: '#B0B0B0', label: 'Silver' },
  { color: '#1a1a1a', label: 'Black' },
  { color: '#6B3FA0', label: 'Purple' },
];

// ── Accessories (4 options) ──
export const ACCESSORIES = ['none', 'watch', 'earring', 'lanyard'] as const;
export const ACCESSORY_LABELS = ['None', 'Watch', 'Earring', 'Lanyard'];

// ── Defaults ──
export const DEFAULT_MALE_APPEARANCE: ManagerAppearance = {
  gender: 'male',
  skinTone: 1,
  faceShape: 1,
  eyeStyle: 0,
  hairStyle: 2,
  hairColor: 1,
  facialHair: 0,
  glasses: 0,
  outfit: 0,
  outfitColor: '#1a1a2e',
  tieColor: '#D4A017',
  accessory: 0,
};

export const DEFAULT_FEMALE_APPEARANCE: ManagerAppearance = {
  gender: 'female',
  skinTone: 1,
  faceShape: 1,
  eyeStyle: 0,
  hairStyle: 3,
  hairColor: 1,
  facialHair: 0,
  glasses: 0,
  outfit: 0,
  outfitColor: '#1a1a2e',
  tieColor: '#D4A017',
  accessory: 0,
};

export const DEFAULT_APPEARANCE: ManagerAppearance = { ...DEFAULT_MALE_APPEARANCE };
