import type { PackOddsRow, PackRarityWeights, PackTierDefinition, PackTierKey, Position, WeeklyPackSkin } from '@/types/game';

/**
 * Pack Opening — storefront definition, economy tuning, and animation timing.
 * Keep all pack-economy and pack-animation numbers here so they can be
 * balanced independently of feature code.
 *
 * Types live in `src/types/game.ts` per the single-source-of-truth rule.
 *
 * ── THE MARKET, IN ONE PARAGRAPH ──
 * One free pack a day whose quality rises with the login streak; four paid
 * packs forming a clean price ladder; one of the paid packs featured each real
 * week with a bonus card on its first purchase. Nothing else. The previous
 * lineup ran THREE free daily packs (Bronze, Silver and a free-odds Gold) that
 * dominated one another — a rational player opened free Gold and treated the
 * other two as squad-slot litter — and shipped ~11 free players a day into a
 * 40-man squad, which made the transfer market decorative.
 *
 * ── ARCHIVED TIERS ──
 * `bronze` and `silver` are no longer sold or given away, but their definitions
 * stay here forever: `OpenedPackRecord.tier` in every existing save points at
 * them and Recent Pulls resolves label/art/palette through `PACK_TIER_MAP`.
 * `PACK_STOREFRONT_ORDER` is what the Market renders — not `PACK_TIERS`.
 */

// Color fields reference the HSL-tuple CSS vars declared in `src/index.css`
// (`--pack-<tier>-from`, `-to`, `-accent`). Using `hsl(var(--x))` keeps pack
// tiers in the same theme system as the rest of the dark UI — future themes
// can swap the palette without touching config.
export const PACK_TIERS: PackTierDefinition[] = [
  {
    // ── The single free pack ──
    // Replaces the free Bronze + free Silver + free-odds Gold. Its odds scale
    // with the player's LOGIN STREAK (see `PACK_STREAK_BANDS`), so returning
    // seven days running is worth materially more than dipping in once — the
    // retention lever the three flat free packs never pulled.
    //
    // The base fields below ARE the day-1 pack; `streakOverrides` lift it.
    key: 'daily',
    label: 'Rise to Glory',
    storeCaption: '3 players, free every day. Better the longer your streak.',
    price: 0,
    cards: 3,
    guaranteedMinOvr: 66,
    ovrMin: 56,
    ovrMax: 74,
    rarity: { common: 0.32, bronze: 0.48, silver: 0.20, gold: 0, legendary: 0 },
    // ── Why the ceilings sit where they do ──
    // The guaranteed card rolls UNIFORMLY in [guaranteedMinOvr, ovrMax], so the
    // ceiling — not the rarity table — is what decides how often the free pack
    // hands out an 80+. A first pass at this ladder topped out at 77+/82 and
    // measured 0.80 elite cards per open at max streak, which is most of a
    // gold card every single day for free: the exact firehose the three old
    // free packs were removed for. The top band now measures ~0.30, pinned by
    // a unit test, with 80+ still reachable so the pull keeps its tension.
    streakOverrides: [
      // Band 1 (days 1-2) — identical to the base fields. Spelled out rather
      // than left implicit so the odds sheet can render all four rows from one
      // array and a reader can compare the ladder at a glance.
      { guaranteedMinOvr: 66, ovrMin: 56, ovrMax: 74, rarity: { common: 0.32, bronze: 0.48, silver: 0.20, gold: 0, legendary: 0 } },
      // Band 2 (days 3-4)
      { guaranteedMinOvr: 69, ovrMin: 58, ovrMax: 76, rarity: { common: 0.20, bronze: 0.47, silver: 0.33, gold: 0, legendary: 0 } },
      // Band 3 (days 5-6)
      { guaranteedMinOvr: 72, ovrMin: 60, ovrMax: 78, rarity: { common: 0.11, bronze: 0.42, silver: 0.46, gold: 0.01, legendary: 0 } },
      // Band 4 (day 7+) — the ceiling. Still below what the $2.99 Gold Pack
      // guarantees (78+) and below its band, so the free path never dominates
      // the entry purchase. Measured at ~0.30 elite (80+) cards per open;
      // 76+/80 measured 0.38 and 74+/79 measured 0.00, and neither is what this
      // pack should be — the first is a supply, the second removes the tension.
      { guaranteedMinOvr: 75, ovrMin: 62, ovrMax: 80, rarity: { common: 0.04, bronze: 0.34, silver: 0.60, gold: 0.02, legendary: 0 } },
    ],
    gradientFrom: 'hsl(var(--pack-silver-from))',
    gradientTo: 'hsl(var(--pack-silver-to))',
    accent: 'hsl(var(--pack-silver-accent))',
    artSrc: '/packs/rise-to-glory.webp',
    cardFrame: 'rise-to-glory',
    freeDailyLimit: 1,
    // A SECOND daily pack for one rewarded ad — one, not three. Inert while
    // `REWARDED_ADS_USABLE` is false (see `utils/ads.ts`); the Market never
    // renders an ad affordance it cannot honour. One ad for one extra pack is
    // an opportunity; three is a chore, and three was what the old Bronze and
    // Silver tiers each advertised in a `tagline` that no screen ever rendered.
    adDailyLimit: 1,
  },
  {
    // ── ARCHIVED — history replay only. Not in PACK_STOREFRONT_ORDER. ──
    key: 'bronze',
    label: 'Bronze Pack',
    storeCaption: 'Retired pack.',
    price: 0,
    cards: 3,
    guaranteedMinOvr: 60,
    ovrMin: 55,
    ovrMax: 68,
    rarity: { common: 0.38, bronze: 0.55, silver: 0.07, gold: 0, legendary: 0 },
    gradientFrom: 'hsl(var(--pack-bronze-from))',
    gradientTo: 'hsl(var(--pack-bronze-to))',
    accent: 'hsl(var(--pack-bronze-accent))',
    artSrc: '/packs/bronze.webp',
  },
  {
    // ── ARCHIVED — history replay only. Not in PACK_STOREFRONT_ORDER. ──
    key: 'silver',
    label: 'Silver Pack',
    storeCaption: 'Retired pack.',
    price: 0,
    cards: 3,
    guaranteedMinOvr: 70,
    ovrMin: 62,
    ovrMax: 76,
    rarity: { common: 0.10, bronze: 0.42, silver: 0.44, gold: 0.04, legendary: 0 },
    gradientFrom: 'hsl(var(--pack-silver-from))',
    gradientTo: 'hsl(var(--pack-silver-to))',
    accent: 'hsl(var(--pack-silver-accent))',
    artSrc: '/packs/silver.webp',
  },
  {
    // ── Entry purchase ──
    // The `freeOpenOverride` is GONE along with the free daily open. One pack
    // that guaranteed 74+ when free and 78+ when bought is one pack with two
    // identities: the card's badge changed depending on the day, and no player
    // could form a stable idea of what "Gold Pack" means. It is now purely the
    // $2.99 entry rung, at its full paid odds — nobody's purchase got worse.
    key: 'gold',
    label: 'Champions Pack',
    storeCaption: '5 players, one guaranteed 78+.',
    badge: 'entry',
    price: 0,
    cards: 5,
    guaranteedMinOvr: 78,
    ovrMin: 68,
    ovrMax: 84,
    rarity: { common: 0, bronze: 0.12, silver: 0.48, gold: 0.38, legendary: 0.02 },
    gradientFrom: 'hsl(var(--pack-gold-from))',
    gradientTo: 'hsl(var(--pack-gold-to))',
    accent: 'hsl(var(--pack-gold-accent))',
    artSrc: '/packs/champions.webp',
    cardFrame: 'champions',
    productId: 'com.dynastymanager.pack.gold',
    iapPriceDisplay: '$2.99',
    weeklyEligible: true,
  },
  {
    // ── The value pick, and the only card carrying `best_value` ──
    // It genuinely is, and not by intuition: `packEliteCardsPerDollar` scores
    // Premium at ~0.75 expected 80+ cards per dollar against Rare's ~0.65 and
    // Gold's ~0.54. Rare has the better FLOOR (84+ and a walkout) and sells on
    // that; Premium has the better RATE. The badge follows the metric, and a
    // unit test asserts the badged tier is its argmax, so a future price or
    // rarity edit cannot leave the label sitting on the wrong card.
    key: 'premium',
    label: 'Elite Pack',
    storeCaption: '5 players, one guaranteed 82+.',
    badge: 'best_value',
    price: 0,
    cards: 5,
    guaranteedMinOvr: 82,
    ovrMin: 72,
    ovrMax: 87,
    rarity: { common: 0, bronze: 0.04, silver: 0.28, gold: 0.63, legendary: 0.05 },
    gradientFrom: 'hsl(var(--pack-premium-from))',
    gradientTo: 'hsl(var(--pack-premium-to))',
    accent: 'hsl(var(--pack-premium-accent))',
    artSrc: '/packs/elite.webp',
    cardFrame: 'elite',
    productId: 'com.dynastymanager.pack.premium_gold',
    iapPriceDisplay: '$4.99',
    weeklyEligible: true,
  },
  {
    // Deliberately unbadged. Rare's pitch is its floor — 84+ guaranteed, which
    // is the walkout threshold — and that is already the loudest thing on the
    // card. Adding a second superlative next to Premium's `best_value` would
    // put two "buy this one" signals side by side and neutralise both.
    key: 'rare',
    label: 'World Class Pack',
    storeCaption: '5 players, one guaranteed 84+, walkout possible.',
    price: 0,
    cards: 5,
    guaranteedMinOvr: 84,
    ovrMin: 75,
    ovrMax: 89,
    rarity: { common: 0, bronze: 0, silver: 0.12, gold: 0.78, legendary: 0.10 },
    gradientFrom: 'hsl(var(--pack-rare-from))',
    gradientTo: 'hsl(var(--pack-rare-to))',
    accent: 'hsl(var(--pack-rare-accent))',
    artSrc: '/packs/world-class.webp',
    cardFrame: 'world-class',
    productId: 'com.dynastymanager.pack.rare_gold',
    iapPriceDisplay: '$6.99',
    weeklyEligible: true,
  },
  {
    // Deliberately NOT `weeklyEligible`. Icon is the one purchase that should
    // stay a decision rather than a habit, and a +1 card weekly bonus on a
    // one-card pack would double it — the single most distorting bonus in the
    // lineup, on the tier that least needs a reason to be bought.
    key: 'icon',
    label: 'Legends Pack',
    storeCaption: '1 guaranteed Icon, 88+, walkout guaranteed.',
    badge: 'trophy',
    price: 0,
    cards: 1,
    guaranteedMinOvr: 88,
    ovrMin: 85,
    // 91, not 93: that is the highest rating in the real player pool, and pack
    // pulls are real players now. A ceiling above what the world contains is a
    // published odds row nobody can ever be dealt.
    ovrMax: 91,
    rarity: { common: 0, bronze: 0, silver: 0, gold: 0.55, legendary: 0.45 },
    gradientFrom: 'hsl(var(--pack-icon-from))',
    gradientTo: 'hsl(var(--pack-icon-to))',
    accent: 'hsl(var(--pack-icon-accent))',
    artSrc: '/packs/legends.webp',
    cardFrame: 'legends',
    productId: 'com.dynastymanager.pack.icon',
    iapPriceDisplay: '$9.99',
  },
];

export const PACK_TIER_MAP: Record<PackTierKey, PackTierDefinition> = PACK_TIERS.reduce(
  (acc, t) => { acc[t.key] = t; return acc; },
  {} as Record<PackTierKey, PackTierDefinition>,
);

/** ── What the Market actually renders, in order ──
 *  Free first (it costs the player nothing to understand), then the paid ladder
 *  cheapest to dearest so the price axis reads left-to-right, top-to-bottom.
 *  Archived tiers are absent by construction: adding a tier to `PACK_TIERS`
 *  does NOT put it on sale. */
export const PACK_STOREFRONT_ORDER: PackTierKey[] = ['daily', 'gold', 'premium', 'rare', 'icon'];

/** The free tier. Exactly one — a second free pack is a design change, not a
 *  config change, and every surface that says "today's free pack" reads this. */
export const FREE_PACK_TIER: PackTierKey = 'daily';

/** Paid storefront tiers, in ladder order. */
export const PAID_PACK_TIERS: PackTierKey[] = PACK_STOREFRONT_ORDER.filter(
  k => !!PACK_TIER_MAP[k].productId,
);

/** True when a tier is currently offered by the Market. Archived tiers resolve
 *  through `PACK_TIER_MAP` for history but must never render a buy CTA. */
export function isStorefrontTier(key: PackTierKey): boolean {
  return PACK_STOREFRONT_ORDER.includes(key);
}

// ── Daily-Pack streak ladder ──
//
// Minimum consecutive-login streak for each band, ascending. Index i of this
// array pairs with index i of `daily.streakOverrides`. Read through
// `streakBandIndex` so the two can never be indexed apart.
//
// Why 7 bands' worth of value compressed into 4: a ladder the player can hold
// in their head ("it gets better on day 3, day 5 and day 7") beats a smooth
// curve nobody can perceive. The top band is reachable inside one week, so the
// reward is a habit worth forming rather than a month-long grind.
export const PACK_STREAK_BANDS: number[] = [1, 3, 5, 7];

/** Band index (0-based) for a login streak length. Clamped at both ends. */
export function streakBandIndex(streak: number): number {
  let idx = 0;
  for (let i = 0; i < PACK_STREAK_BANDS.length; i++) {
    if (streak >= PACK_STREAK_BANDS[i]) idx = i;
  }
  return idx;
}

/** Streak needed to reach the NEXT band, or null when already at the top.
 *  Drives the Market's "day 5 unlocks 74+ guaranteed" teaser. */
export function nextStreakBand(streak: number): number | null {
  const idx = streakBandIndex(streak);
  return idx >= PACK_STREAK_BANDS.length - 1 ? null : PACK_STREAK_BANDS[idx + 1];
}

// ── Weekly featured offer ──
//
// One paid pack is featured for a whole REAL week and its first purchase that
// week ships an extra card at the pack's guaranteed floor, for the same price.
//
// Why a bonus card on an existing SKU and not a "Weekly Dynasty Pack" product:
// StoreKit and RevenueCat match products by exact identifier string and Apple
// does not allow a product ID to be created ad hoc from the client. A brand-new
// weekly SKU would render as a buy button the store rejects — precisely the
// Guideline 2.1.0 condition that got build 174 rejected. The weekly offer must
// therefore be a *contents* change on a SKU that already exists, and it is.
//
// Why the bonus and not the pack is limited: nothing is ever taken away. After
// the bonus is spent the pack is still on sale at its normal contents, so the
// countdown is a genuine "this is better this week", not a gate. That is the
// difference between scarcity a player respects and scarcity they resent.
export const FEATURED_PACK_ROTATION: PackTierKey[] = ['rare', 'premium', 'gold'];

/** Extra cards granted on the first purchase of the featured pack each week. */
export const WEEKLY_BONUS_CARDS = 1;

/** Featured tier for a given real-world week index (see `currentWeekIndex`).
 *
 *  Keyed on the REAL week, not `(season, week)` as before. In-game weeks tick
 *  several times in one sitting, so the old "featured" pack changed while the
 *  player watched — a rotation with no scarcity and no countdown that could be
 *  trusted. A real week is a week. */
export function getFeaturedPackTier(weekIndex: number): PackTierKey {
  const rotation = FEATURED_PACK_ROTATION.filter(k => PACK_TIER_MAP[k]?.weeklyEligible);
  const safe = rotation.length > 0 ? rotation : ['rare' as PackTierKey];
  return safe[Math.abs(Math.floor(weekIndex)) % safe.length];
}

/** ── Weekly promo covers ──
 *
 *  One per entry in `FEATURED_PACK_ROTATION`, index-for-index, so the week's
 *  headline has a name and a cover of its own instead of being the same card
 *  the grid already shows with a ribbon stuck on it.
 *
 *  A skin changes the NAME and the ART. It never changes the contents: the card
 *  and the odds sheet both render the backing tier's real numbers, and the
 *  bonus card is stated explicitly. That line matters — a promo name over
 *  quietly worse contents is the thing that makes players stop trusting a
 *  store, and it is the reason this is a `name`/`artSrc` pair and not a second
 *  set of rarity weights. */
export const WEEKLY_PACK_SKINS: WeeklyPackSkin[] = [
  { name: 'The Dynasty Pack', artSrc: '/packs/dynasty.webp', tier: 'rare', cardFrame: 'dynasty' },
  { name: 'Golden Era Pack', artSrc: '/packs/golden-era.webp', tier: 'premium', cardFrame: 'golden-era' },
  { name: 'Royal Reserve Pack', artSrc: '/packs/royal-reserve.webp', tier: 'gold', cardFrame: 'royal-reserve' },
];

// ── Pack card frames ──
//
// A card pulled from a pack AT OR ABOVE that pack's guaranteed floor keeps the
// pack's frame forever. It is the only lasting thing a pack leaves behind: the
// players themselves get sold, loaned and retired, but a Golden Era card is
// proof you were there the week Golden Era ran.
//
// Two rules make it worth having rather than merely decorative:
//
//   1. THE FLOOR GATE. Only a card that cleared the guarantee wears the frame,
//      so a promo frame always means a good card. Without it the Daily Pack's
//      62-rated filler would wear the same frame as its best pull, and the
//      frame would stop meaning anything — which is also what would break the
//      at-a-glance read of a squad list, where the card art IS the tier signal.
//   2. THE WEEKLY FRAMES CANNOT BE FARMED. Dynasty, Golden Era and Royal
//      Reserve are only awarded while their week is running, so they are
//      genuinely dated. Nothing about them is stronger than a base card.
//
// Cosmetic only. A frame never touches an attribute, a wage, a value or any
// simulation parameter — same contract as the cosmetic IAPs.
export const PACK_CARD_FRAMES: Record<string, string> = {
  'rise-to-glory': '/player-cards/rise-to-glory.webp',
  champions: '/player-cards/champions.webp',
  elite: '/player-cards/elite.webp',
  'world-class': '/player-cards/world-class.webp',
  legends: '/player-cards/legends.webp',
  // Weekly promo frames.
  dynasty: '/player-cards/dynasty.webp',
  'golden-era': '/player-cards/golden-era.webp',
  'royal-reserve': '/player-cards/royal-reserve.webp',
};

/** Resolve a frame id to its artwork, or null when the id is unknown.
 *
 *  Null is a supported answer, not an error: a save can carry a frame id that a
 *  later build has retired, and the card must fall back to its ordinary OVR
 *  tier art rather than render a broken image. Same contract as the archived
 *  pack tiers — stop awarding it, keep resolving it, and when you cannot
 *  resolve it, degrade quietly. */
export function packFrameArt(frameId: string | null | undefined): string | null {
  if (!frameId) return null;
  return PACK_CARD_FRAMES[frameId] ?? null;
}

/** The frame a pull from this pack earns, accounting for the weekly promo skin.
 *
 *  `weekIndex` is what makes a promo frame dated: pass the week the pack was
 *  opened in and a featured pack awards its promo frame; pass nothing and it
 *  awards the tier's own. */
export function packFrameFor(tierKey: PackTierKey, weekIndex?: number): string | null {
  if (typeof weekIndex === 'number' && getFeaturedPackTier(weekIndex) === tierKey) {
    const skin = getWeeklyPackSkin(weekIndex);
    if (skin?.cardFrame) return skin.cardFrame;
  }
  return PACK_TIER_MAP[tierKey]?.cardFrame ?? null;
}

/** This week's promo cover, or null if the rotation and the skin list have
 *  drifted apart — in which case the featured slot falls back to the plain
 *  tier rather than showing a name backed by the wrong pack. */
export function getWeeklyPackSkin(weekIndex: number): WeeklyPackSkin | null {
  const tierKey = getFeaturedPackTier(weekIndex);
  const skin = WEEKLY_PACK_SKINS.find(sk => sk.tier === tierKey);
  return skin ?? null;
}

/** The featured tier wearing this week's cover. Contents, odds, price and
 *  guarantees all still come from the tier — only `label` and `artSrc` move. */
export function getFeaturedPackPresentation(weekIndex: number): PackTierDefinition {
  const tier = PACK_TIER_MAP[getFeaturedPackTier(weekIndex)];
  const skin = getWeeklyPackSkin(weekIndex);
  if (!skin) return tier;
  return { ...tier, label: skin.name, artSrc: skin.artSrc, artLegacySrc: tier.artSrc };
}

/** OVR at/above which a card triggers the walkout reveal instead of a flip. */
export const WALKOUT_OVR_THRESHOLD = 84;

/** Legendary threshold — extra animation polish layered on top of walkout. */
export const LEGENDARY_OVR_THRESHOLD = 90;

/** Max number of walkouts to play per pack. Even if multiple cards qualify
 *  for a walkout, only the highest-OVR pull gets the cinematic — the rest
 *  flip normally with a "Rare" badge. Keeps a Rare Gold pack from forcing
 *  the user to sit through 30+ seconds of back-to-back walkouts. */
export const MAX_WALKOUTS_PER_PACK = 1;

/**
 * Wage a pack-pulled player signs for, as a fraction of their market wage.
 *
 * Pack pulls are real players at real ratings, so an Icon Pack hands you
 * someone who genuinely earns £400k a week. Measured before this existed: one
 * $6.99 Rare Gold added ~£920k/week to the bill — 21% of Arsenal's entire wage
 * budget, or 58% of Celtic's — so buying a pack made your club materially worse
 * off. Paying money to be punished is the worst shape a store can have.
 *
 * Applied to EVERY pull, free daily included. That is deliberate: it makes the
 * discount a property of "arrived through a pack" rather than of "was paid
 * for", which keeps it clear of the rule that monetization must never move a
 * simulation parameter. A free pull and a paid pull sign identical contracts.
 *
 * In fiction: a pack player joins on the club's own wage scale rather than the
 * deal they would have commanded in a bidding war — you found them, you did not
 * outbid anyone for them.
 */
export const PACK_WAGE_FACTOR = 0.55;

/** Fraction of a pulled player's market value returned by quick-sell.
 *  Lives here rather than inline in `packsSlice` per the no-hardcoded-balance
 *  rule — it is the exchange rate between the pack economy and the transfer
 *  budget, and it belongs next to the packs it prices. */
export const PACK_QUICK_SELL_RATE = 0.65;

/** ── AI counter-signings (league-balance scaling) ──
 *  Each pack the user opens triggers a small set of AI signings that keep
 *  the league quality from drifting too far below the user. The system is
 *  deliberately calibrated so the user always gains MORE and BETTER
 *  players than any single AI club: AI gets fewer cards, at lower OVR,
 *  spread across multiple clubs. */
export const AI_BACKFILL_PER_TIER: Record<PackTierKey, number> = {
  daily: 1,
  bronze: 1,   // archived tier — kept so a legacy record can never index undefined
  silver: 1,   // archived tier
  gold: 2,
  premium: 2,
  rare: 3,
  icon: 0,     // Icon is the user's special prize — no AI peer
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

/** OVR the pity bonus aims the guaranteed slot at.
 *
 *  ⚠ Pity iseffectively a no-op on the top tiers now, and that is a real limitation
 *  rather than a bug to chase. It works by widening the band the guaranteed
 *  card is drawn from, and pack pulls are real players — so widening only helps
 *  where the pool holds anyone up there. Above each tier's ceiling it holds 101
 *  templates (Gold), 28 (Premium), 8 (Rare) and none at all (Icon). Making pity
 *  meaningful for Rare and Icon would mean a different mechanic, not a bigger
 *  number: there is nobody better to give you. */
export const PACK_PITY_MIN_OVR = 80;

/** How far above its OWN ceiling a pity pull may push a pack.
 *
 *  Pity used to ignore `tier.ovrMax` completely, so one free pack in nine could
 *  produce an 89 — a card better than anything the $6.99 Rare Gold guarantees.
 *  The mercy pull is now relative to what the pack itself is worth: a Daily
 *  pity lands a few points over its band, and Premium/Rare/Icon are unaffected
 *  because their ceilings already sit at or above the 80-89 pity band. */
export const PACK_PITY_MAX_OVERSHOOT = 3;

/** Minimum width of the pity band, so a capped tier still rolls a range
 *  instead of always handing out the same number. */
export const PACK_PITY_MIN_BAND = 2;

/** What an open costs the player, and what they have earned toward it. */
export interface PackOddsContext {
  /** True when the open costs nothing (free daily or rewarded ad). */
  freeOpen?: boolean;
  /** Consecutive-login streak, for the streak-scaled Daily Pack. */
  streak?: number;
}

/**
 * Resolve the odds that actually apply to an open.
 *
 * A tier can carry weaker `freeOpenOverride` odds for its unpaid path, and the
 * Daily Pack carries a `streakOverrides` ladder. Both the generator, the odds
 * sheet and the shop badge MUST go through here — reading `tier.*` directly is
 * how a card ends up promising 78+ and delivering 74.
 *
 * Order matters: the streak ladder is applied first (it defines the pack), then
 * any free-path penalty on top (it discounts the pack).
 */
export function resolvePackTier(
  tier: PackTierDefinition,
  ctx: PackOddsContext = {},
): PackTierDefinition {
  let resolved = tier;
  if (tier.streakOverrides && tier.streakOverrides.length > 0) {
    const band = tier.streakOverrides[
      Math.min(streakBandIndex(ctx.streak ?? 1), tier.streakOverrides.length - 1)
    ];
    if (band) resolved = { ...resolved, ...band };
  }
  if (ctx.freeOpen && tier.freeOpenOverride) {
    resolved = { ...resolved, ...tier.freeOpenOverride };
  }
  return resolved;
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

/** Human labels for the published odds table. */
const RARITY_LABELS: Record<keyof PackRarityWeights, string> = {
  common: 'Common',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  legendary: 'Legendary',
};

const RARITY_ORDER: (keyof PackRarityWeights)[] = ['legendary', 'gold', 'silver', 'bronze', 'common'];

/**
 * Published per-card odds for a pack, derived from the SAME config the
 * generator reads.
 *
 * This exists because it has to. Apple Guideline 3.1.1 requires an app that
 * sells randomized items to disclose the odds of each outcome BEFORE purchase,
 * and this app sold four randomized consumable packs disclosing nothing at all.
 * Deriving the table rather than authoring it means the disclosure cannot drift
 * from what `generatePackContents` actually rolls — a hand-written odds table
 * that goes stale is worse than none, because it is a false claim.
 *
 * Weights are normalised: the tier tables are authored to sum to 1 but a future
 * edit that sums to 0.99 must not publish odds that quietly don't add up.
 * Bands are clamped to the tier ceiling, so a rung the pack cannot actually
 * reach is reported at its real (clamped) band rather than its nominal one.
 */
export function describePackOdds(
  tier: PackTierDefinition,
  ctx: PackOddsContext = {},
): PackOddsRow[] {
  const t = resolvePackTier(tier, ctx);

  // ── Fold unreachable rungs into the rung they actually land in ──
  //
  // `rollPackPlayer` clamps every roll to the tier's own [ovrMin, ovrMax], so a
  // rarity rung whose band lies entirely outside that window does not produce a
  // card of that rarity — it produces a card pinned to the tier's edge, which
  // belongs to a different rung. Reporting the nominal rung instead published
  // rows the pack cannot deliver: the Elite Pack's sheet read "Bronze (72 OVR)
  // 4%" — a Bronze row paying more than the Silver row's own floor — and
  // "Legendary (87 OVR) 5%", a legendary card three points short of legendary.
  //
  // Both were true to the config and false about the pack. Weight from a rung
  // below the window folds upward into the lowest reachable rung and weight
  // from a rung above folds downward into the highest, which is exactly where
  // the clamp sends those rolls. The tier tables are untouched — they still
  // shape the distribution inside the band; only the disclosure is corrected.
  const rungs = RARITY_ORDER.filter(k => (t.rarity[k] || 0) > 0);
  const reachable = RARITY_ORDER.filter(k => {
    const [lo, hi] = PACK_RARITY_BANDS[k];
    return hi >= t.ovrMin && lo <= t.ovrMax;
  });
  if (reachable.length === 0) return [];
  // RARITY_ORDER runs highest-first, so index 0 is the top reachable rung.
  const highest = reachable[0];
  const lowest = reachable[reachable.length - 1];

  const merged = new Map<keyof PackRarityWeights, number>();
  for (const k of rungs) {
    const [lo] = PACK_RARITY_BANDS[k];
    const target = reachable.includes(k)
      ? k
      : lo > t.ovrMax ? highest : lowest;
    merged.set(target, (merged.get(target) || 0) + Math.max(0, t.rarity[k]));
  }

  const total = [...merged.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  return RARITY_ORDER
    .filter(k => (merged.get(k) || 0) > 0)
    .map(k => {
      const [lo, hi] = PACK_RARITY_BANDS[k];
      const clampedLo = Math.max(t.ovrMin, Math.min(lo, t.ovrMax));
      const clampedHi = Math.max(clampedLo, Math.min(hi, t.ovrMax));
      const band = clampedLo === clampedHi ? `${clampedLo}` : `${clampedLo}-${clampedHi}`;
      return {
        label: `${RARITY_LABELS[k]} (${band} OVR)`,
        chance: (merged.get(k) as number) / total,
      };
    });
}

/**
 * Expected number of 80+ ("elite") cards per dollar for a paid tier.
 *
 * The one number that decides which card may wear `best_value`. The guaranteed
 * slot counts as elite when its floor is 80+; every other card contributes its
 * gold + legendary weight. A unit test asserts the badged tier is the argmax,
 * so the label can never become decoration bolted onto whatever we want to sell
 * that month — which is exactly how "BEST VALUE" stops meaning anything.
 *
 * Uses `iapPriceDisplay` (the planned US price) purely to RANK tiers against
 * each other. It is never shown as a price: what a buyer is charged comes
 * localized from the store.
 */
export function packEliteCardsPerDollar(tier: PackTierDefinition): number {
  const usd = Number((tier.iapPriceDisplay || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  const guaranteedElite = tier.guaranteedMinOvr >= 80 ? 1 : 0;
  const perCard = (tier.rarity.gold || 0) + (tier.rarity.legendary || 0);
  const expectedElite = guaranteedElite + Math.max(0, tier.cards - 1) * perCard;
  return expectedElite / usd;
}

/** All animation timings in ms. Tune here, not in components. */
export const PACK_ANIM = {
  // ── The open, beat by beat ──
  //
  //   loading → portal → arrival → charge → (breath) → explode → reveal
  //
  // The pack is TAPPABLE FROM THE FIRST FRAME. Every beat before `explode` is
  // a build the player can cut short whenever they like; nothing here is a
  // gate. That is the whole shape of it — an opening that rewards waiting and
  // never punishes not waiting.
  //
  // The pre-tap beats used to run 1.7s before the pack would even accept a
  // tap, which is the opposite trade: it made an impatient player feel the app
  // was ignoring them, and it made a patient one watch a loading ring.

  /** Dim + loading ring before the pack scene. Short — this beat exists to
   *  cover the first paint of the pack art, not to be watched. */
  loadingMs: 220,
  portalOpenMs: 260,
  arrivalMs: 520,
  /** Base charge length. Longer than it was (1200ms) because the charge is
   *  now a genuine escalation rather than a constant rattle — a ramp needs
   *  room to be felt, and this is the only beat a player would choose to sit
   *  through. */
  chargeBaseMs: 1700,
  chargePerTierBonusMs: 250,
  /** Held breath at the end of the charge: shake stops dead, glow spikes,
   *  nothing moves. The contrast is what makes the burst land — the walkout
   *  reveal uses the same trick (`walkout.breathMs`) for the same reason. */
  chargeBreathMs: 240,
  /** Haptic pulse spacing at the start and end of the charge. The gap closes
   *  as the charge builds, so the rumble accelerates into the burst instead of
   *  ticking at one flat rate. */
  chargeHapticStartMs: 260,
  chargeHapticEndMs: 70,
  /** Tear start → cards on screen.
   *
   *  Tuned so the cards arrive at the PEAK of the burst (burstDelayMs plus the
   *  bloom's own rise), which is the oldest trick in the reveal book: the light
   *  hides the swap, so there is no moment where the player watches an empty
   *  stage between the pack leaving and the cards arriving.
   *
   *  There used to be two of these — a long one for a charge that ran out and a
   *  short one for a tap. Once the tap path was lengthened enough to actually
   *  show the tear the two numbers met in the middle, so there is one. */
  explodeMs: 340,
  /** ── The side tear ──
   *  The pack is torn down its LEFT edge, the way you actually open a foil
   *  booster: a narrow strip comes away from the side rather than the top
   *  third lifting off like a lid.
   *
   *  It is built as `segments` horizontal slices of that strip, each with its
   *  OWN STATIC clip-path, peeling on a stagger from top to bottom. The
   *  obvious implementation — one strip whose clip-path animates as the tear
   *  travels — is the wrong one: `clip-path` is not a compositor property, so
   *  animating it repaints a 260x360 element every frame, and this overlay
   *  already treats iOS WebKit rasterization as its main performance budget
   *  (see the note on `filter: blur()` in PackCardAura). Static clips plus
   *  transform-and-opacity per segment reads as the same travelling tear and
   *  stays on the fast path. */
  tear: {
    /** Distance of the seam from the left edge, as a % of pack width. */
    seamXPct: 17,
    /** Slices the strip is cut into. More is smoother and costs more layers;
     *  below about 6 the stagger reads as a flip-book rather than a tear. */
    segments: 9,
    /** Delay between one slice starting to peel and the next. This IS the
     *  speed the tear travels down the edge. */
    staggerMs: 26,
    /** How long a single slice takes to come away. */
    segmentMs: 380,
    /** Half-width of the jagged seam wobble, in % of pack width. */
    jagPct: 1.8,
    /** How long after the tear starts the burst of light fires. The flash used
     *  to go off on the same frame as the tear and washed it out completely —
     *  which is why the pack has never visibly ripped, before this change or
     *  after it. The light belongs at the END of the tear, not over it. */
    burstDelayMs: 220,
  },
  /** Delay between the pack landing and tearing when the player tapped before
   *  it had even flown in. Long enough that the entrance still reads as a
   *  landing rather than the pack appearing already torn. */
  earlyRipMs: 260,
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
