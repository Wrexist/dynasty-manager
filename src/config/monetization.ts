/**
 * Monetization configuration for Dynasty Manager.
 * All product definitions, pricing, ad reward values, and cosmetic catalogs.
 *
 * IMPORTANT: No constant here may modify match outcomes, training rates,
 * transfer values, or any core simulation parameter.
 */

import type { ProductId, ProFeature, CosmeticItem, AdRewardType, MonetizationState, SubscriptionTier } from '@/types/game';

// ── Product Definitions ──

interface ProductDef {
  id: ProductId;
  name: string;
  description: string;
  priceUsd: number;
  /** Product IDs included when this bundle is purchased */
  includes?: ProductId[];
  /** Whether this is a one-time purchase or subscription */
  type: 'one_time' | 'subscription';
  /** Subscription tier (only for subscription products) */
  subscriptionTier?: SubscriptionTier;
  /** Billing period label for display (e.g. '/month', '/year', 'one-time') */
  billingPeriod?: string;
}

export const PRODUCTS: Record<ProductId, ProductDef> = {
  'com.dynastymanager.pro': {
    id: 'com.dynastymanager.pro',
    name: 'Dynasty Pro',
    description: 'Ad-free play, advanced analytics, custom tactics, expanded press conferences, historical records, instant sim, and a Pro badge.',
    priceUsd: 7.99,
    type: 'one_time',
  },
  'com.dynastymanager.pro.monthly': {
    id: 'com.dynastymanager.pro.monthly',
    name: 'Dynasty Pro Monthly',
    description: 'All Pro features, billed monthly. Cancel anytime.',
    priceUsd: 1.99,
    type: 'subscription',
    subscriptionTier: 'monthly',
    billingPeriod: '/month',
  },
  'com.dynastymanager.pro.yearly': {
    id: 'com.dynastymanager.pro.yearly',
    name: 'Dynasty Pro Yearly',
    description: 'All Pro features, billed yearly. Save 58% vs monthly.',
    priceUsd: 9.99,
    type: 'subscription',
    subscriptionTier: 'yearly',
    billingPeriod: '/year',
  },
  'com.dynastymanager.pro.lifetime': {
    id: 'com.dynastymanager.pro.lifetime',
    name: 'Dynasty Pro Lifetime',
    description: 'All Pro features forever. One-time purchase.',
    priceUsd: 19.99,
    type: 'subscription',
    subscriptionTier: 'lifetime',
    billingPeriod: 'one-time',
  },
  'com.dynastymanager.pack.manager': {
    id: 'com.dynastymanager.pack.manager',
    name: 'Manager Identity Pack',
    description: '12 avatar styles, 8 title badges, and custom celebration text.',
    priceUsd: 2.99,
    type: 'one_time',
  },
  'com.dynastymanager.pack.stadium': {
    id: 'com.dynastymanager.pack.stadium',
    name: 'Stadium Atmosphere Pack',
    description: '4 stadium themes, confetti styles, and custom pitch grass patterns.',
    priceUsd: 1.99,
    type: 'one_time',
  },
  'com.dynastymanager.pack.legends': {
    id: 'com.dynastymanager.pack.legends',
    name: 'Dynasty Legends Pack',
    description: 'Premium trophy cabinet styles, 6 prestige badge designs, animated Hall of Managers frame, and Legacy title.',
    priceUsd: 3.99,
    type: 'one_time',
  },
  'com.dynastymanager.bundle.all': {
    id: 'com.dynastymanager.bundle.all',
    name: 'Dynasty Edition',
    description: 'Everything — Dynasty Pro plus all cosmetic packs.',
    priceUsd: 9.99,
    type: 'one_time',
    includes: [
      'com.dynastymanager.pro',
      'com.dynastymanager.pack.manager',
      'com.dynastymanager.pack.stadium',
      'com.dynastymanager.pack.legends',
    ],
  },
};

/** Product IDs that grant Pro access (one-time purchases + subscriptions) */
export const PRO_PRODUCT_IDS: ProductId[] = [
  'com.dynastymanager.pro',
  'com.dynastymanager.pro.monthly',
  'com.dynastymanager.pro.yearly',
  'com.dynastymanager.pro.lifetime',
  'com.dynastymanager.bundle.all',
];

// ── Pro Features ──

export const PRO_FEATURES: ProFeature[] = [
  'ad_free',
  'advanced_analytics',
  'custom_tactics',
  'expanded_press',
  'historical_records',
  'instant_sim',
  'pro_badge',
];

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  ad_free: 'Ad-Free Experience',
  advanced_analytics: 'Advanced Analytics',
  custom_tactics: 'Custom Tactics Creator',
  expanded_press: 'Expanded Press Conferences',
  historical_records: 'Historical Record Book',
  instant_sim: 'Instant Match Sim',
  pro_badge: 'Pro Badge',
};

// ── Rewarded Ad Constants ──
// Budget bonuses are intentionally small relative to weekly income
// to avoid breaking the in-game economy.

export const AD_REWARDS: Record<AdRewardType, { label: string; description: string }> = {
  scout_potential: {
    label: 'Reveal Potential',
    description: 'See the hidden potential rating of a scouted player.',
  },
  transfer_budget: {
    label: 'Budget Boost',
    description: 'Get a one-time £500K transfer budget injection.',
  },
  xp_double: {
    label: 'Double XP',
    description: 'Earn 2× XP from this match result.',
  },
  youth_preview: {
    label: 'Youth Preview',
    description: 'Preview your next youth academy intake\'s top prospect.',
  },
  season_bonus: {
    label: 'Season Bonus',
    description: 'Start next season with an extra £1M in the transfer budget.',
  },
};

export const AD_REWARD_VALUES = {
  TRANSFER_BUDGET_BONUS: 500_000,
  SEASON_END_BONUS: 1_000_000,
  XP_MULTIPLIER: 2,
} as const;

/** Max ad rewards claimable per season per type */
export const AD_REWARD_LIMITS: Record<AdRewardType, number> = {
  scout_potential: 10,
  transfer_budget: 2,
  xp_double: 20,
  youth_preview: 2,
  season_bonus: 1,
};

// ── Cosmetic Catalog ──

export const COSMETIC_ITEMS: CosmeticItem[] = [
  // Manager Identity Pack
  { id: 'avatar-classic', category: 'avatar', name: 'Classic Manager', description: 'Traditional suited look', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-tracksuit', category: 'avatar', name: 'Tracksuit Boss', description: 'Touchline warrior', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-tactical', category: 'avatar', name: 'The Tactician', description: 'Glasses and clipboard', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-veteran', category: 'avatar', name: 'Old School', description: 'Weathered dugout legend', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-modern', category: 'avatar', name: 'Modern Manager', description: 'Sharp casual look', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-youth', category: 'avatar', name: 'Young Gun', description: 'Fresh-faced prodigy coach', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-continental', category: 'avatar', name: 'Continental', description: 'European flair', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-stoic', category: 'avatar', name: 'The Stoic', description: 'Calm under pressure', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-fiery', category: 'avatar', name: 'Firebrand', description: 'Passionate and intense', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-professor', category: 'avatar', name: 'The Professor', description: 'Analytical mastermind', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-pioneer', category: 'avatar', name: 'Trailblazer', description: 'Innovative thinker', pack: 'com.dynastymanager.pack.manager' },
  { id: 'avatar-legend', category: 'avatar', name: 'Living Legend', description: 'Hall of fame material', pack: 'com.dynastymanager.pack.manager' },

  { id: 'badge-gaffer', category: 'title_badge', name: 'The Gaffer', description: 'A proper football man', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-professor', category: 'title_badge', name: 'The Professor', description: 'Tactical genius', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-fox', category: 'title_badge', name: 'The Fox', description: 'Cunning and shrewd', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-boss', category: 'title_badge', name: 'The Boss', description: 'Undisputed authority', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-architect', category: 'title_badge', name: 'The Architect', description: 'Builds dynasties', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-magician', category: 'title_badge', name: 'The Magician', description: 'Makes the impossible happen', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-general', category: 'title_badge', name: 'The General', description: 'Commands respect', pack: 'com.dynastymanager.pack.manager' },
  { id: 'badge-maverick', category: 'title_badge', name: 'The Maverick', description: 'Breaks the mould', pack: 'com.dynastymanager.pack.manager' },

  { id: 'celeb-text-dynasty', category: 'celebration_text', name: 'Dynasty!', description: '"Dynasty!" after wins', pack: 'com.dynastymanager.pack.manager' },
  { id: 'celeb-text-unstoppable', category: 'celebration_text', name: 'Unstoppable!', description: '"Unstoppable!" after wins', pack: 'com.dynastymanager.pack.manager' },
  { id: 'celeb-text-levels', category: 'celebration_text', name: 'Levels!', description: '"Levels above!" after wins', pack: 'com.dynastymanager.pack.manager' },

  // Stadium Atmosphere Pack
  { id: 'stadium-fortress', category: 'stadium_theme', name: 'Fortress', description: 'Intimidating concrete colosseum', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'stadium-cauldron', category: 'stadium_theme', name: 'Cauldron', description: 'Fiery red atmosphere', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'stadium-theatre', category: 'stadium_theme', name: 'Theatre', description: 'Dramatic spotlight ambience', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'stadium-colosseum', category: 'stadium_theme', name: 'Colosseum', description: 'Ancient grandeur meets modern sport', pack: 'com.dynastymanager.pack.stadium' },

  { id: 'pitch-stripes', category: 'pitch_skin', name: 'Classic Stripes', description: 'Bold diagonal stripe pattern', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'pitch-checkerboard', category: 'pitch_skin', name: 'Checkerboard', description: 'Alternating square pattern', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'pitch-diamond', category: 'pitch_skin', name: 'Diamond Cut', description: 'Diamond pattern grass', pack: 'com.dynastymanager.pack.stadium' },

  { id: 'confetti-gold', category: 'confetti_style', name: 'Gold Rush', description: 'Golden confetti rain', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'confetti-pyro', category: 'confetti_style', name: 'Pyro Show', description: 'Spark and flame effects', pack: 'com.dynastymanager.pack.stadium' },
  { id: 'confetti-snow', category: 'confetti_style', name: 'Snowfall', description: 'Gentle white flakes', pack: 'com.dynastymanager.pack.stadium' },

  // Dynasty Legends Pack
  { id: 'cabinet-marble', category: 'cabinet_style', name: 'Marble Hall', description: 'Elegant marble trophy display', pack: 'com.dynastymanager.pack.legends' },
  { id: 'cabinet-neon', category: 'cabinet_style', name: 'Neon Gallery', description: 'Glowing neon-lit showcase', pack: 'com.dynastymanager.pack.legends' },
  { id: 'cabinet-vault', category: 'cabinet_style', name: 'The Vault', description: 'Secure vault-style display', pack: 'com.dynastymanager.pack.legends' },

  { id: 'prestige-crown', category: 'prestige_badge', name: 'Crown', description: 'Royal crown prestige icon', pack: 'com.dynastymanager.pack.legends' },
  { id: 'prestige-laurel', category: 'prestige_badge', name: 'Laurel', description: 'Classical laurel wreath', pack: 'com.dynastymanager.pack.legends' },
  { id: 'prestige-diamond', category: 'prestige_badge', name: 'Diamond', description: 'Cut diamond prestige icon', pack: 'com.dynastymanager.pack.legends' },
  { id: 'prestige-phoenix', category: 'prestige_badge', name: 'Phoenix', description: 'Rising phoenix prestige icon', pack: 'com.dynastymanager.pack.legends' },
  { id: 'prestige-shield', category: 'prestige_badge', name: 'Shield', description: 'Heraldic shield prestige icon', pack: 'com.dynastymanager.pack.legends' },
  { id: 'prestige-flame', category: 'prestige_badge', name: 'Eternal Flame', description: 'Burning flame prestige icon', pack: 'com.dynastymanager.pack.legends' },

  { id: 'hom-frame-gold', category: 'hom_frame', name: 'Gold Frame', description: 'Animated golden card border', pack: 'com.dynastymanager.pack.legends' },
  { id: 'hom-frame-holographic', category: 'hom_frame', name: 'Holographic', description: 'Shimmering holographic border', pack: 'com.dynastymanager.pack.legends' },
];

// ── Starter Kit (time-limited offer) ──

/** Starter kit is available for this many milliseconds after first launch */
export const STARTER_KIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const STARTER_KIT = {
  name: 'Starter Kit',
  description: 'Manager Identity Pack — 12 avatars, 8 title badges & 3 celebration texts. Limited-time offer!',
  priceUsd: 2.99,
  includes: ['com.dynastymanager.pack.manager'] as ProductId[],
};

// ── Default State ──

export const DEFAULT_MONETIZATION_STATE: MonetizationState = {
  entitlements: [],
  activeCosmetics: {},
  adRewardsClaimed: {},
  firstLaunchTimestamp: 0,
  starterKitDismissed: false,
  subscription: null,
};
