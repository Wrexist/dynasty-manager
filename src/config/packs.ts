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
    tagline: '1 free daily · watch ad for 3 more · 1× 60+ guaranteed',
    price: 0,
    cards: 3,
    guaranteedMinOvr: 60,
    ovrMin: 55,
    ovrMax: 68,
    // Every rung above `silver` clamps to `ovrMax` in rollPackPlayer, so the
    // old silver+gold 15% was really "15% of cards land exactly on the tier
    // ceiling". Trimmed to 7% and pushed into `common` — a Bronze pack should
    // feel like a Bronze pack, not a reliable route to its own best card.
    rarity: { common: 0.38, bronze: 0.55, silver: 0.07, gold: 0, legendary: 0 },
    gradientFrom: 'hsl(var(--pack-bronze-from))',
    gradientTo: 'hsl(var(--pack-bronze-to))',
    accent: 'hsl(var(--pack-bronze-accent))',
    artSrc: '/packs/bronze.webp',
    freeDailyLimit: 1,
    adDailyLimit: 3,
  },
  {
    key: 'silver',
    label: 'Silver Pack',
    tagline: '1 free daily · watch ad for 3 more · 1× 70+ guaranteed',
    price: 0,
    cards: 3,
    guaranteedMinOvr: 70,
    ovrMin: 62,
    ovrMax: 76,
    // Same ceiling-pinning as Bronze: gold+legendary was 12% of cards landing
    // exactly on 76. Cut to 4%.
    rarity: { common: 0.10, bronze: 0.42, silver: 0.44, gold: 0.04, legendary: 0 },
    gradientFrom: 'hsl(var(--pack-silver-from))',
    gradientTo: 'hsl(var(--pack-silver-to))',
    accent: 'hsl(var(--pack-silver-accent))',
    artSrc: '/packs/silver.webp',
    freeDailyLimit: 1,
    adDailyLimit: 3,
  },
  {
    key: 'gold',
    label: 'Gold Pack',
    tagline: '1 free daily (74+) · in-app purchase for 78+ guaranteed',
    price: 0,
    cards: 5,
    guaranteedMinOvr: 78,
    ovrMin: 68,
    ovrMax: 84,
    rarity: { common: 0, bronze: 0.12, silver: 0.48, gold: 0.38, legendary: 0.02 },
    // The free daily Gold was the single biggest source of good players in the
    // game: a guaranteed 78+ (≥80 about 71% of the time) plus four more cards
    // at a 40% chance each of landing in the 80–84 band — roughly 2.3 cards at
    // 80+ EVERY DAY, for nothing. Measured, that outpaces the transfer market
    // as a squad-building route, which makes the rest of the game decorative.
    //
    // The free path is now a taster: ~0.65 expected 80+ per open instead of
    // ~2.3, with 80+ still reachable so the pull keeps its tension. The PAID
    // $2.99 open is untouched — nobody's purchase gets worse.
    freeOpenOverride: {
      guaranteedMinOvr: 74,
      ovrMax: 82,
      rarity: { common: 0.04, bronze: 0.26, silver: 0.62, gold: 0.08, legendary: 0 },
    },
    gradientFrom: 'hsl(var(--pack-gold-from))',
    gradientTo: 'hsl(var(--pack-gold-to))',
    accent: 'hsl(var(--pack-gold-accent))',
    artSrc: '/packs/gold.webp',
    freeDailyLimit: 1,
    productId: 'com.dynastymanager.pack.gold',
    iapPriceDisplay: '$2.99',
  },
  {
    key: 'premium',
    label: 'Premium Gold',
    tagline: '5 players · 1× 82+ guaranteed · in-app purchase',
    price: 0,
    cards: 5,
    guaranteedMinOvr: 82,
    ovrMin: 72,
    ovrMax: 87,
    rarity: { common: 0, bronze: 0.04, silver: 0.28, gold: 0.63, legendary: 0.05 },
    gradientFrom: 'hsl(var(--pack-premium-from))',
    gradientTo: 'hsl(var(--pack-premium-to))',
    accent: 'hsl(var(--pack-premium-accent))',
    artSrc: '/packs/premium.webp',
    productId: 'com.dynastymanager.pack.premium_gold',
    iapPriceDisplay: '$4.99',
  },
  {
    key: 'rare',
    label: 'Rare Gold',
    tagline: '5 players · 1× 84+ guaranteed · walkout possible · in-app purchase',
    price: 0,
    cards: 5,
    guaranteedMinOvr: 84,
    ovrMin: 75,
    ovrMax: 89,
    rarity: { common: 0, bronze: 0, silver: 0.12, gold: 0.78, legendary: 0.10 },
    gradientFrom: 'hsl(var(--pack-rare-from))',
    gradientTo: 'hsl(var(--pack-rare-to))',
    accent: 'hsl(var(--pack-rare-accent))',
    artSrc: '/packs/rare.webp',
    productId: 'com.dynastymanager.pack.rare_gold',
    iapPriceDisplay: '$6.99',
  },
  {
    key: 'icon',
    label: 'Icon Pack',
    tagline: '1 player · 88+ guaranteed · walkout guaranteed · in-app purchase',
    price: 0,
    cards: 1,
    guaranteedMinOvr: 88,
    ovrMin: 85,
    ovrMax: 93,
    rarity: { common: 0, bronze: 0, silver: 0, gold: 0.55, legendary: 0.45 },
    gradientFrom: 'hsl(var(--pack-icon-from))',
    gradientTo: 'hsl(var(--pack-icon-to))',
    accent: 'hsl(var(--pack-icon-accent))',
    artSrc: '/packs/icon.webp',
    productId: 'com.dynastymanager.pack.icon',
    iapPriceDisplay: '$9.99',
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
 *  guaranteed slot toward `PACK_PITY_MIN_OVR`. */
export const PACK_PITY_THRESHOLD = 8;

/** OVR the pity bonus aims the guaranteed slot at. */
export const PACK_PITY_MIN_OVR = 80;

/** How far above its OWN ceiling a pity pull may push a pack.
 *
 *  Pity used to ignore `tier.ovrMax` completely (`respectTierCeiling = !pityOn`),
 *  so one free daily Bronze pack in nine could produce an 89 — a card better
 *  than anything the $6.99 Rare Gold guarantees. Now the mercy pull is relative
 *  to what the pack itself is worth: a Bronze pity lands ~69–71, a Silver ~77–79,
 *  and Premium/Rare/Icon are unaffected because their ceilings already sit at or
 *  above the 80–89 pity band. */
export const PACK_PITY_MAX_OVERSHOOT = 3;

/** Minimum width of the pity band, so a capped tier still rolls a range
 *  instead of always handing out the same number. */
export const PACK_PITY_MIN_BAND = 2;

/**
 * Resolve the odds that actually apply to an open.
 *
 * A tier can carry weaker `freeOpenOverride` odds for its unpaid path. Both the
 * generator and the shop badge MUST go through here — reading `tier.*` directly
 * is how a card ends up promising "78+" and delivering 74.
 */
export function resolvePackTier(
  tier: PackTierDefinition,
  freeOpen: boolean,
): PackTierDefinition {
  if (!freeOpen || !tier.freeOpenOverride) return tier;
  return { ...tier, ...tier.freeOpenOverride };
}

/** True when an unlock method costs the user nothing (free daily or ad). */
export function isFreeOpenMethod(method: string | null | undefined): boolean {
  return method === 'free' || method === 'ad';
}

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
  /** Cinematic "opening…" beat — dim + loading ring before the pack scene.
   *  Kept short: at 1000ms the first visible motion arrived ~1.5s after the
   *  tap and read as a hang (live UX run-through P2 finding). */
  loadingMs: 400,
  portalOpenMs: 400,
  arrivalMs: 600,
  chargeBaseMs: 1200,
  chargePerTierBonusMs: 250,
  explodeMs: 400,
  revealStaggerMs: 110,
  flipMs: 520,
  walkout: {
    slitMs: 700,
    silhouetteMs: 900,
    typewriterPerCharMs: 45,
    ovrRollMs: 420,
    enterMs: 600,
    /** Held-breath pause between name and flip — total stillness, no
     *  particles, no halo pulse. The brain reads silence as "something
     *  big is coming". Tunes the dopamine ramp. */
    breathMs: 280,
    flipMs: 800,
    /** OVR overlay — massive number ticks from 0 → rating over the card
     *  during/right after the flip, then fades to let the stats land. */
    ovrOverlayMs: 900,
    statsMs: 1500,
    statsStaggerMs: 200,
    holdMs: 2400,
    lingerMs: 450,
  },
  confetti: {
    silver: 12,
    gold: 24,
    legendary: 36,
    icon: 48,
  },
  spring: { stiffness: 260, damping: 22 },
} as const;
