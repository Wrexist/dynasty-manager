import type { PackRarityWeights, PackTierDefinition, PackTierKey, Position } from '@/types/game';

/**
 * Pack Opening — tuning constants, tier definitions, and animation timing.
 * Keep all pack-economy and pack-animation numbers here so they can be
 * balanced independently of feature code.
 *
 * Types live in `src/types/game.ts` per the single-source-of-truth rule.
 */

// Color fields reference the HSL-tuple CSS vars declared in `src/index.css`
// (`--pack-<tier>-from`, `-to`, `-accent`). Using `hsl(var(--x))` keeps pack
// tiers in the same theme system as the rest of the dark UI — future themes
// can swap the palette without touching config.
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
    gradientFrom: 'hsl(var(--pack-bronze-from))',
    gradientTo: 'hsl(var(--pack-bronze-to))',
    accent: 'hsl(var(--pack-bronze-accent))',
    artSrc: '/packs/bronze.png',
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
    gradientFrom: 'hsl(var(--pack-silver-from))',
    gradientTo: 'hsl(var(--pack-silver-to))',
    accent: 'hsl(var(--pack-silver-accent))',
    artSrc: '/packs/silver.png',
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
    gradientFrom: 'hsl(var(--pack-gold-from))',
    gradientTo: 'hsl(var(--pack-gold-to))',
    accent: 'hsl(var(--pack-gold-accent))',
    artSrc: '/packs/gold.png',
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
    gradientFrom: 'hsl(var(--pack-premium-from))',
    gradientTo: 'hsl(var(--pack-premium-to))',
    accent: 'hsl(var(--pack-premium-accent))',
    artSrc: '/packs/premium.png',
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
    gradientFrom: 'hsl(var(--pack-rare-from))',
    gradientTo: 'hsl(var(--pack-rare-to))',
    accent: 'hsl(var(--pack-rare-accent))',
    artSrc: '/packs/rare.png',
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
    gradientFrom: 'hsl(var(--pack-icon-from))',
    gradientTo: 'hsl(var(--pack-icon-to))',
    accent: 'hsl(var(--pack-icon-accent))',
    artSrc: '/packs/icon.png',
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

/** Max number of walkouts to play per pack. Even if multiple cards qualify
 *  for a walkout, only the highest-OVR pull gets the cinematic — the rest
 *  flip normally with a "Rare" badge. Keeps a Rare Gold pack from forcing
 *  the user to sit through 30+ seconds of back-to-back walkouts. */
export const MAX_WALKOUTS_PER_PACK = 1;

/** ── AI counter-signings (league-balance scaling) ──
 *  Each pack the user opens triggers a small set of AI signings that keep
 *  the league quality from drifting too far below the user. The system is
 *  deliberately calibrated so the user always gains MORE and BETTER
 *  players than any single AI club: AI gets fewer cards, at lower OVR,
 *  spread across multiple clubs. */
export const AI_BACKFILL_PER_TIER: Record<PackTierKey, number> = {
  bronze: 1,
  silver: 1,
  gold: 2,
  premium: 2,
  rare: 3,
  icon: 0,    // Icon is the user's special prize — no AI peer
};

/** OVR gap between the player's pack guarantee and the AI counter-signings.
 *  AI players can never roll higher than `userTier.guaranteedMinOvr - GAP`. */
export const AI_BACKFILL_OVR_GAP = 5;

/** OVR variance below the AI ceiling — AI signings roll in
 *  [ceiling - SPREAD, ceiling]. Keeps distribution interesting without
 *  giving any single AI club a star. */
export const AI_BACKFILL_OVR_SPREAD = 6;

/** After this many non-gold (< 80 OVR max) pulls, the next pack promotes its
 *  guaranteed slot to a minimum of 80 OVR. */
export const PACK_PITY_THRESHOLD = 8;

/** Max recent pulls shown in the shop's "Recent pulls" strip. */
export const RECENT_PULLS_LIMIT = 5;

/** Positions considered when rolling players for a pack. Keeps rolls fair
 *  across the pitch rather than favouring any one slot. */
export const PACK_POSITION_POOL: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

/** OVR bands for each rarity rung — used by pack generation to pick a
 *  target band after a rarity roll. Kept alongside the rest of the pack
 *  tuning so all balance numbers live together. */
export const PACK_RARITY_BANDS: Record<keyof PackRarityWeights, [number, number]> = {
  common: [45, 59],
  bronze: [60, 69],
  silver: [70, 79],
  gold: [80, 89],
  legendary: [90, 94],
};

/** Rotation of tiers surfaced in the Featured slot. Icon is excluded so it
 *  stays special and doesn't show up every month. Cycles deterministically
 *  by (season, week) so the same week shows the same featured pack. */
export const FEATURED_PACK_ROTATION: PackTierKey[] = ['premium', 'rare', 'gold', 'silver', 'premium', 'rare'];

export function getFeaturedPackTier(season: number, week: number): PackTierKey {
  const idx = Math.abs(season * 100 + week) % FEATURED_PACK_ROTATION.length;
  return FEATURED_PACK_ROTATION[idx];
}

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
