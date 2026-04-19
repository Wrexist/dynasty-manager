import type { Position } from '@/types/game';

/**
 * Pack Opening — tuning constants, tier definitions, and animation timing.
 * Keep all pack-economy and pack-animation numbers here so they can be
 * balanced independently of feature code.
 */

export type PackTierKey = 'bronze' | 'silver' | 'gold' | 'premium' | 'rare' | 'icon';

export interface PackRarityWeights {
  common: number;   // < 60
  bronze: number;   // 60-69
  silver: number;   // 70-79
  gold: number;     // 80-89
  legendary: number; // 90+
}

export interface PackTierDefinition {
  key: PackTierKey;
  label: string;
  tagline: string;
  price: number;
  cards: number;
  /** Guaranteed-rare floor applied to one card in the pack. */
  guaranteedMinOvr: number;
  /** OVR band used when generating common cards in this pack. */
  ovrMin: number;
  ovrMax: number;
  rarity: PackRarityWeights;
  /** Visual gradient endpoints for the pack tile (hex). */
  gradientFrom: string;
  gradientTo: string;
  /** Glow/accent color used during the charge-up beat. */
  accent: string;
}

export const PACK_TIERS: PackTierDefinition[] = [
  {
    key: 'bronze',
    label: 'Bronze Pack',
    tagline: '3 players · 1× 60+ guaranteed',
    price: 250_000,
    cards: 3,
    guaranteedMinOvr: 60,
    ovrMin: 55,
    ovrMax: 68,
    rarity: { common: 0.30, bronze: 0.55, silver: 0.13, gold: 0.02, legendary: 0 },
    gradientFrom: '#7c2d12',
    gradientTo: '#fed7aa',
    accent: '#fb923c',
  },
  {
    key: 'silver',
    label: 'Silver Pack',
    tagline: '3 players · 1× 70+ guaranteed',
    price: 1_000_000,
    cards: 3,
    guaranteedMinOvr: 70,
    ovrMin: 62,
    ovrMax: 76,
    rarity: { common: 0.05, bronze: 0.35, silver: 0.48, gold: 0.11, legendary: 0.01 },
    gradientFrom: '#475569',
    gradientTo: '#e2e8f0',
    accent: '#cbd5e1',
  },
  {
    key: 'gold',
    label: 'Gold Pack',
    tagline: '5 players · 1× 78+ guaranteed',
    price: 4_000_000,
    cards: 5,
    guaranteedMinOvr: 78,
    ovrMin: 68,
    ovrMax: 84,
    rarity: { common: 0, bronze: 0.12, silver: 0.48, gold: 0.38, legendary: 0.02 },
    gradientFrom: '#92400e',
    gradientTo: '#fcd34d',
    accent: '#f59e0b',
  },
  {
    key: 'premium',
    label: 'Premium Gold',
    tagline: '5 players · 1× 82+ guaranteed',
    price: 12_000_000,
    cards: 5,
    guaranteedMinOvr: 82,
    ovrMin: 72,
    ovrMax: 87,
    rarity: { common: 0, bronze: 0.04, silver: 0.28, gold: 0.63, legendary: 0.05 },
    gradientFrom: '#78350f',
    gradientTo: '#fde68a',
    accent: '#fbbf24',
  },
  {
    key: 'rare',
    label: 'Rare Gold',
    tagline: '5 players · 1× 84+ guaranteed · walkout possible',
    price: 35_000_000,
    cards: 5,
    guaranteedMinOvr: 84,
    ovrMin: 75,
    ovrMax: 89,
    rarity: { common: 0, bronze: 0, silver: 0.12, gold: 0.78, legendary: 0.10 },
    gradientFrom: '#4c1d95',
    gradientTo: '#f472b6',
    accent: '#c084fc',
  },
  {
    key: 'icon',
    label: 'Icon Pack',
    tagline: '1 player · 88+ guaranteed · walkout guaranteed',
    price: 120_000_000,
    cards: 1,
    guaranteedMinOvr: 88,
    ovrMin: 85,
    ovrMax: 93,
    rarity: { common: 0, bronze: 0, silver: 0, gold: 0.55, legendary: 0.45 },
    gradientFrom: '#312e81',
    gradientTo: '#fde68a',
    accent: '#fde047',
  },
];

export const PACK_TIER_MAP: Record<PackTierKey, PackTierDefinition> = PACK_TIERS.reduce(
  (acc, t) => { acc[t.key] = t; return acc; },
  {} as Record<PackTierKey, PackTierDefinition>,
);

/** OVR at/above which a card triggers the walkout reveal instead of a flip. */
export const WALKOUT_OVR_THRESHOLD = 84;

/** Legendary threshold — extra animation polish layered on top of walkout. */
export const LEGENDARY_OVR_THRESHOLD = 90;

/** After this many non-gold (< 80 OVR max) pulls, the next pack promotes its
 *  guaranteed slot to a minimum of 80 OVR. */
export const PACK_PITY_THRESHOLD = 8;

/** Max recent pulls shown in the shop's "Recent pulls" strip. */
export const RECENT_PULLS_LIMIT = 5;

/** Positions considered when rolling players for a pack. Keeps rolls fair
 *  across the pitch rather than favouring any one slot. */
export const PACK_POSITION_POOL: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

/** All animation timings in ms. Tune here, not in components. */
export const PACK_ANIM = {
  portalOpenMs: 400,
  arrivalMs: 600,
  chargeBaseMs: 1200,
  chargePerTierBonusMs: 250,
  explodeMs: 400,
  revealStaggerMs: 140,
  flipMs: 520,
  walkout: {
    slitMs: 700,
    silhouetteMs: 900,
    typewriterPerCharMs: 45,
    ovrRollMs: 420,
    holdMs: 2200,
    lingerMs: 400,
  },
  confetti: {
    silver: 20,
    gold: 40,
    legendary: 60,
    icon: 80,
  },
  spring: { stiffness: 260, damping: 22 },
} as const;
