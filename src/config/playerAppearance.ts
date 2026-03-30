/**
 * Player appearance constants shared between PlayerAvatar and player generation.
 */

import type { PlayerAppearance } from '@/types/game';

// ── Skin Tones (8 options, same as manager) ──
export const PLAYER_SKIN_TONES = [
  '#FCDEC0', // Porcelain
  '#F5D0A9', // Fair
  '#E8B88A', // Light
  '#D4A574', // Medium
  '#C08A5C', // Tan
  '#A0785A', // Brown
  '#7A5A3E', // Dark Brown
  '#5A3825', // Deep
];

// ── Hair Styles (12 options) ──
export const PLAYER_HAIR_STYLES = ['none', 'buzz', 'short', 'medium', 'curly', 'mohawk', 'long', 'afro', 'fade', 'man_bun', 'braids', 'undercut'] as const;

// ── Hair Colors (8 options) ──
export const PLAYER_HAIR_COLORS = [
  '#1A1A1A', // Black
  '#2C1B0E', // Dark Brown
  '#5C3317', // Brown
  '#D4A843', // Blonde
  '#8B3A1A', // Auburn
  '#C0392B', // Red
  '#9E9E9E', // Silver
  '#E8D5B7', // Platinum
];

// ── Facial Hair (5 options) ──
export const PLAYER_FACIAL_HAIR = ['none', 'stubble', 'goatee', 'short_beard', 'full_beard'] as const;

// ── Accessories (5 options) ──
export const PLAYER_ACCESSORIES = ['none', 'headband', 'wristband', 'armband', 'sleeve_tape'] as const;

// ── Boot Colors (4 options) ──
export const PLAYER_BOOT_COLORS = ['#1a1a1a', '#f0f0f0', '#39ff14', '#e63946'] as const;

// ── Height (3 options) ──
export const PLAYER_HEIGHTS = ['short', 'medium', 'tall'] as const;

// ── Build (3 options) ──
export const PLAYER_BUILDS = ['lean', 'average', 'stocky'] as const;

// ── Nationality → Skin Tone Distribution ──
// Weights for each skin tone index (0-7). Higher weight = more likely.
type SkinWeights = [number, number, number, number, number, number, number, number];

const LIGHT_BIAS: SkinWeights   = [3, 4, 3, 2, 1, 0, 0, 0];
const MEDIUM_BIAS: SkinWeights  = [1, 2, 3, 4, 3, 2, 1, 0];
const TAN_BIAS: SkinWeights     = [0, 1, 2, 3, 4, 3, 2, 1];
const DARK_BIAS: SkinWeights    = [0, 0, 0, 1, 2, 3, 4, 3];
const DIVERSE_BIAS: SkinWeights = [1, 2, 2, 2, 2, 2, 1, 1];

const REGION_SKIN: Record<string, SkinWeights> = {
  // European
  england: LIGHT_BIAS, scotland: LIGHT_BIAS, wales: LIGHT_BIAS, ireland: LIGHT_BIAS,
  norway: LIGHT_BIAS, sweden: LIGHT_BIAS, denmark: LIGHT_BIAS, finland: LIGHT_BIAS,
  germany: LIGHT_BIAS, austria: LIGHT_BIAS, switzerland: LIGHT_BIAS,
  netherlands: LIGHT_BIAS, belgium: LIGHT_BIAS, czech_republic: LIGHT_BIAS,
  poland: LIGHT_BIAS, hungary: LIGHT_BIAS, serbia: LIGHT_BIAS, croatia: LIGHT_BIAS,
  ukraine: LIGHT_BIAS,
  // Southern European / Mediterranean
  spain: MEDIUM_BIAS, italy: MEDIUM_BIAS, portugal: MEDIUM_BIAS, france: DIVERSE_BIAS,
  turkey: MEDIUM_BIAS, greece: MEDIUM_BIAS,
  // South American
  brazil: DIVERSE_BIAS, argentina: MEDIUM_BIAS, uruguay: MEDIUM_BIAS,
  colombia: TAN_BIAS, ecuador: TAN_BIAS, paraguay: TAN_BIAS, mexico: TAN_BIAS,
  // African
  nigeria: DARK_BIAS, senegal: DARK_BIAS, ghana: DARK_BIAS, cameroon: DARK_BIAS,
  ivory_coast: DARK_BIAS, mali: DARK_BIAS, gabon: DARK_BIAS,
  morocco: TAN_BIAS, algeria: TAN_BIAS, egypt: TAN_BIAS, tunisia: TAN_BIAS,
  // Asian
  japan: MEDIUM_BIAS, south_korea: MEDIUM_BIAS, china: MEDIUM_BIAS,
  // Caribbean
  jamaica: DARK_BIAS,
  // North American
  usa: DIVERSE_BIAS, canada: DIVERSE_BIAS,
};

function normalizeNationality(nat: string): string {
  return nat.toLowerCase().replace(/\s+/g, '_');
}

function weightedPick(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ── Position → Build Distribution ──
// Weights for [lean, average, stocky]
const POSITION_BUILD: Record<string, [number, number, number]> = {
  GK:  [1, 3, 3],
  CB:  [1, 3, 4],
  LB:  [3, 3, 1],
  RB:  [3, 3, 1],
  CDM: [1, 3, 3],
  CM:  [2, 4, 2],
  CAM: [3, 3, 1],
  LM:  [3, 3, 1],
  RM:  [3, 3, 1],
  LW:  [4, 3, 1],
  RW:  [4, 3, 1],
  ST:  [2, 3, 3],
};

// ── Position → Height Distribution ──
// Weights for [short, medium, tall]
const POSITION_HEIGHT: Record<string, [number, number, number]> = {
  GK:  [0, 2, 5],
  CB:  [0, 3, 4],
  LB:  [2, 4, 1],
  RB:  [2, 4, 1],
  CDM: [1, 4, 2],
  CM:  [2, 4, 1],
  CAM: [2, 4, 1],
  LM:  [3, 3, 1],
  RM:  [3, 3, 1],
  LW:  [3, 4, 1],
  RW:  [3, 4, 1],
  ST:  [1, 3, 3],
};

// ── Generation ──
export function generatePlayerAppearance(nationality: string, position: string): PlayerAppearance {
  const key = normalizeNationality(nationality);
  const skinWeights = REGION_SKIN[key] || DIVERSE_BIAS;
  const buildWeights = POSITION_BUILD[position] || [2, 4, 2];
  const heightWeights = POSITION_HEIGHT[position] || [2, 4, 1];

  return {
    skinTone: weightedPick(skinWeights),
    hairStyle: Math.floor(Math.random() * PLAYER_HAIR_STYLES.length),
    hairColor: weightedPick([4, 3, 2, 1, 1, 1, 0, 0]), // darker hair more common
    height: weightedPick(heightWeights),
    build: weightedPick(buildWeights),
    facialHair: weightedPick([5, 2, 1, 1, 1]),   // most clean-shaven
    accessory: weightedPick([7, 1, 1, 1, 1]),     // most have none
    bootColor: weightedPick([3, 3, 2, 1]),         // black/white most common
  };
}

// ── Deterministic generation from player ID (for backward compat / migration) ──
export function generateAppearanceFromId(playerId: string): PlayerAppearance {
  let hash = 5381;
  for (let i = 0; i < playerId.length; i++) {
    hash = ((hash << 5) + hash + playerId.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  return {
    skinTone: hash % PLAYER_SKIN_TONES.length,
    hairStyle: (hash >> 3) % PLAYER_HAIR_STYLES.length,
    hairColor: (hash >> 6) % PLAYER_HAIR_COLORS.length,
    height: (hash >> 9) % 3,
    build: (hash >> 11) % 3,
    facialHair: (hash >> 13) % PLAYER_FACIAL_HAIR.length,
    accessory: (hash >> 15) % PLAYER_ACCESSORIES.length,
    bootColor: (hash >> 17) % PLAYER_BOOT_COLORS.length,
  };
}
