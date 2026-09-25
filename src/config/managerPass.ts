/**
 * Manager Pass — a seasonal, cosmetic-only reward track (free + Pro rows).
 *
 * WHY A REAL-CALENDAR SEASON, NOT AN IN-GAME ONE. A Pass season is two calendar
 * months (Jan–Feb, Mar–Apr, … Nov–Dec), derived from the date alone the way the
 * monthly festival is (`generateMonthlyEvent`) — no server, no push. An in-game
 * season would have been the wrong clock: league seasons run 30–46 weeks, a
 * Pro player with Instant Sim clears one in an hour, and three save slots would
 * have meant three passes running in parallel. A calendar season paces every
 * player the same, lines up with the Pro billing period (two Monthly cycles),
 * and gives the track a date to end on.
 *
 * WHY DEVICE-GLOBAL. Progress lives in one localStorage record
 * (`STORAGE_KEYS.MANAGER_PASS`), not in a save slot, exactly like Festival
 * points and the daily streak: the pass belongs to the player, so a new career
 * neither resets it nor lets it be earned again, and a reward collected in one
 * slot is worn in every slot.
 *
 * INVARIANT — COSMETIC ONLY. Pass XP is its own currency and is NEVER manager
 * XP (manager XP buys perks, and perks move training rates and match
 * probabilities). Every reward is a COSMETIC_ITEMS entry — a title, a
 * celebration line or a banner. The Pro row is gated by `isPro()` and must
 * never carry anything the simulation reads (CLAUDE.md, monetization
 * invariant 4). `managerPass.test.ts` pins both.
 */
import type { CosmeticItem, LegacyTier, ManagerPassTierDef } from '@/types/game';
import type { TranslationKey } from '@/i18n';

// ── Track shape ──

/** Tiers per season. */
export const MANAGER_PASS_TIER_COUNT = 30;

/** Pass XP per tier (flat, so "tier N" always means N × this). */
export const MANAGER_PASS_XP_PER_TIER = 100;

/** Pass XP by source. Sized so a regular player (4 play days a week, a handful
 *  of matches each) reaches tier 30 in about five weeks of an ~8.5-week season,
 *  a daily heavy player in about two, and a check-in-only player tier ~16 —
 *  the Pro row's value is visible to everyone who plays. */
export const MANAGER_PASS_XP = {
  /** Once per local day, claimed on the Pass page. */
  dailyCheckIn: 30,
  /** Any match the manager's club plays (league, cup, continental). */
  matchPlayed: 10,
  /** Added to `matchPlayed` for a win / a draw. */
  matchWinBonus: 15,
  matchDrawBonus: 5,
  /** A monthly objective completing (claimed or not). */
  objectiveCompleted: 25,
  /** A completed in-game season, plus a bonus per trophy won in it. */
  seasonCompleted: 100,
  trophyWon: 150,
} as const;

/** Matches that earn Pass XP per local day. Keeps an Instant-Sim afternoon
 *  from clearing an eight-week track, and keeps the season a season. */
export const MANAGER_PASS_MATCH_XP_DAILY_CAP = 10;

/** Awarded-event keys remembered for dedupe. A replayed match/season/objective
 *  (reloading an older save) finds its key and pays nothing. ~600 keys covers
 *  several full seasons of play; older keys can no longer be replayed anyway. */
export const MANAGER_PASS_LEDGER_MAX = 600;

// ── Seasons ──

/** Months per Pass season. Six seasons a year, aligned to calendar months. */
export const MANAGER_PASS_SEASON_MONTHS = 2;

/** Player-facing name and tagline per bimonth (index 0 = Jan–Feb). */
export const MANAGER_PASS_SEASON_THEMES: { nameKey: TranslationKey; taglineKey: TranslationKey }[] = [
  { nameKey: 'managerPass.theme.0.name', taglineKey: 'managerPass.theme.0.tagline' },
  { nameKey: 'managerPass.theme.1.name', taglineKey: 'managerPass.theme.1.tagline' },
  { nameKey: 'managerPass.theme.2.name', taglineKey: 'managerPass.theme.2.tagline' },
  { nameKey: 'managerPass.theme.3.name', taglineKey: 'managerPass.theme.3.tagline' },
  { nameKey: 'managerPass.theme.4.name', taglineKey: 'managerPass.theme.4.tagline' },
  { nameKey: 'managerPass.theme.5.name', taglineKey: 'managerPass.theme.5.tagline' },
];

// ── Rewards (earned cosmetics) ──
//
// Spread onto the END of COSMETIC_ITEMS (config/monetization.ts), so every
// existing reader — CelebrationModal, ManagerProfile, getActiveCosmetic —
// resolves them like any other cosmetic. They carry `earnedBy` and no `pack`:
// no product grants them, and `hasCosmetic` routes them to
// `isEarnedCosmeticOwned` instead of `entitlements`.
//
// Title badge ids are `badge-<words>` on purpose: ManagerProfile derives the
// displayed title from the id ("badge-the-grafter" → "The Grafter").

const pass = (item: Omit<CosmeticItem, 'earnedBy' | 'pack'>): CosmeticItem => ({ ...item, earnedBy: 'manager_pass' });

export const MANAGER_PASS_COSMETICS: CosmeticItem[] = [
  // Free row
  pass({ id: 'banner-touchline', category: 'profile_banner', name: 'Touchline', description: 'Cool blue manager banner' }),
  pass({ id: 'badge-the-grafter', category: 'title_badge', name: 'The Grafter', description: 'Earned on the Manager Pass' }),
  pass({ id: 'celeb-text-pass-get-in', category: 'celebration_text', name: 'Get In!', description: '"Get In!" after wins' }),
  pass({ id: 'banner-floodlights', category: 'profile_banner', name: 'Floodlights', description: 'Silver night-match banner' }),
  pass({ id: 'badge-the-strategist', category: 'title_badge', name: 'The Strategist', description: 'Earned on the Manager Pass' }),
  pass({ id: 'celeb-text-pass-what-a-night', category: 'celebration_text', name: 'What a Night!', description: '"What a Night!" after wins' }),
  pass({ id: 'banner-matchday', category: 'profile_banner', name: 'Matchday', description: 'Fresh-cut green banner' }),
  pass({ id: 'badge-the-motivator', category: 'title_badge', name: 'The Motivator', description: 'Earned on the Manager Pass' }),
  pass({ id: 'celeb-text-pass-scenes', category: 'celebration_text', name: 'Scenes!', description: '"Scenes!" after wins' }),
  pass({ id: 'badge-the-closer', category: 'title_badge', name: 'The Closer', description: 'Reached the final tier of a Manager Pass' }),

  // Pro row — titles
  pass({ id: 'badge-the-tinkerman', category: 'title_badge', name: 'The Tinkerman', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-visionary', category: 'title_badge', name: 'The Visionary', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-mastermind', category: 'title_badge', name: 'The Mastermind', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-alchemist', category: 'title_badge', name: 'The Alchemist', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-conductor', category: 'title_badge', name: 'The Conductor', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-pragmatist', category: 'title_badge', name: 'The Pragmatist', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-innovator', category: 'title_badge', name: 'The Innovator', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-kingmaker', category: 'title_badge', name: 'The Kingmaker', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-headmaster', category: 'title_badge', name: 'The Headmaster', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-maestro', category: 'title_badge', name: 'The Maestro', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-mentor', category: 'title_badge', name: 'The Mentor', description: 'Manager Pass Pro reward' }),
  pass({ id: 'badge-the-guv', category: 'title_badge', name: 'The Guv', description: 'Manager Pass Pro reward' }),
  // Pro row — celebration lines
  pass({ id: 'celeb-text-pass-get-in-there', category: 'celebration_text', name: 'Get In There!', description: '"Get In There!" after wins' }),
  pass({ id: 'celeb-text-pass-masterclass', category: 'celebration_text', name: 'Masterclass!', description: '"Masterclass!" after wins' }),
  pass({ id: 'celeb-text-pass-pure-football', category: 'celebration_text', name: 'Pure Football!', description: '"Pure Football!" after wins' }),
  pass({ id: 'celeb-text-pass-limbs', category: 'celebration_text', name: 'Limbs!', description: '"Limbs!" after wins' }),
  pass({ id: 'celeb-text-pass-clinical', category: 'celebration_text', name: 'Clinical!', description: '"Clinical!" after wins' }),
  pass({ id: 'celeb-text-pass-written', category: 'celebration_text', name: 'Written in the Stars!', description: '"Written in the Stars!" after wins' }),
  pass({ id: 'celeb-text-pass-box-office', category: 'celebration_text', name: 'Box Office!', description: '"Box Office!" after wins' }),
  pass({ id: 'celeb-text-pass-total-control', category: 'celebration_text', name: 'Total Control!', description: '"Total Control!" after wins' }),
  pass({ id: 'celeb-text-pass-history-made', category: 'celebration_text', name: 'History Made!', description: '"History Made!" after wins' }),
  // Pro row — banners
  pass({ id: 'banner-pro-gold-rush', category: 'profile_banner', name: 'Gold Rush', description: 'Molten gold banner' }),
  pass({ id: 'banner-pro-emerald-night', category: 'profile_banner', name: 'Emerald Night', description: 'Deep emerald banner' }),
  pass({ id: 'banner-pro-midnight-blue', category: 'profile_banner', name: 'Midnight Blue', description: 'Late-kickoff navy banner' }),
  pass({ id: 'banner-pro-crimson-derby', category: 'profile_banner', name: 'Crimson Derby', description: 'Derby-day red banner' }),
  pass({ id: 'banner-pro-royal-violet', category: 'profile_banner', name: 'Royal Violet', description: 'Regal violet banner' }),
  pass({ id: 'banner-pro-sunset', category: 'profile_banner', name: 'Sunset Kickoff', description: 'Orange-to-pink evening banner' }),
  pass({ id: 'banner-pro-arctic', category: 'profile_banner', name: 'Arctic', description: 'Ice-blue winter banner' }),
  pass({ id: 'banner-pro-obsidian', category: 'profile_banner', name: 'Obsidian', description: 'Black-glass banner' }),
  pass({ id: 'banner-pro-champions', category: 'profile_banner', name: 'Champions', description: 'Final-tier Pro banner' }),
];

/**
 * The track: 30 tiers, a Pro reward on every tier and a free reward on every
 * third. The same track runs each season (progress and claims reset; rewards
 * already owned stay owned and show as such). A themed per-season track is a
 * content drop: give a season its own entry here — nothing else changes.
 */
export const MANAGER_PASS_TRACK: ManagerPassTierDef[] = [
  { tier: 1, pro: 'badge-the-tinkerman' },
  { tier: 2, pro: 'celeb-text-pass-get-in-there' },
  { tier: 3, free: 'banner-touchline', pro: 'banner-pro-midnight-blue' },
  { tier: 4, pro: 'badge-the-pragmatist' },
  { tier: 5, pro: 'celeb-text-pass-clinical' },
  { tier: 6, free: 'badge-the-grafter', pro: 'banner-pro-emerald-night' },
  { tier: 7, pro: 'badge-the-mentor' },
  { tier: 8, pro: 'celeb-text-pass-limbs' },
  { tier: 9, free: 'celeb-text-pass-get-in', pro: 'banner-pro-arctic' },
  { tier: 10, pro: 'badge-the-innovator' },
  { tier: 11, pro: 'celeb-text-pass-pure-football' },
  { tier: 12, free: 'banner-floodlights', pro: 'banner-pro-crimson-derby' },
  { tier: 13, pro: 'badge-the-conductor' },
  { tier: 14, pro: 'celeb-text-pass-box-office' },
  { tier: 15, free: 'badge-the-strategist', pro: 'banner-pro-sunset' },
  { tier: 16, pro: 'badge-the-headmaster' },
  { tier: 17, pro: 'celeb-text-pass-masterclass' },
  { tier: 18, free: 'celeb-text-pass-what-a-night', pro: 'banner-pro-royal-violet' },
  { tier: 19, pro: 'badge-the-alchemist' },
  { tier: 20, pro: 'celeb-text-pass-total-control' },
  { tier: 21, free: 'banner-matchday', pro: 'banner-pro-obsidian' },
  { tier: 22, pro: 'badge-the-kingmaker' },
  { tier: 23, pro: 'celeb-text-pass-written' },
  { tier: 24, free: 'badge-the-motivator', pro: 'banner-pro-gold-rush' },
  { tier: 25, pro: 'badge-the-visionary' },
  { tier: 26, pro: 'celeb-text-pass-history-made' },
  { tier: 27, free: 'celeb-text-pass-scenes', pro: 'badge-the-maestro' },
  { tier: 28, pro: 'badge-the-guv' },
  { tier: 29, pro: 'badge-the-mastermind' },
  { tier: 30, free: 'badge-the-closer', pro: 'banner-pro-champions' },
];

/**
 * How each banner is drawn: Tailwind gradient stops layered over the hero of
 * the Manager Pass and Legacy pages. Written out in full so the JIT sees every
 * class. Purely presentational.
 */
export const PROFILE_BANNER_STYLES: Record<string, string> = {
  'banner-touchline': 'from-sky-500/25 via-sky-500/5 to-transparent',
  'banner-floodlights': 'from-slate-200/20 via-slate-300/5 to-transparent',
  'banner-matchday': 'from-emerald-500/25 via-emerald-500/5 to-transparent',
  'banner-pro-gold-rush': 'from-amber-400/35 via-amber-500/10 to-transparent',
  'banner-pro-emerald-night': 'from-emerald-400/30 via-teal-900/20 to-transparent',
  'banner-pro-midnight-blue': 'from-blue-600/35 via-indigo-900/20 to-transparent',
  'banner-pro-crimson-derby': 'from-rose-600/35 via-red-900/15 to-transparent',
  'banner-pro-royal-violet': 'from-violet-500/35 via-purple-900/15 to-transparent',
  'banner-pro-sunset': 'from-orange-500/35 via-pink-600/15 to-transparent',
  'banner-pro-arctic': 'from-cyan-300/30 via-sky-800/15 to-transparent',
  'banner-pro-obsidian': 'from-zinc-300/15 via-zinc-900/40 to-transparent',
  'banner-pro-champions': 'from-amber-300/40 via-primary/15 to-sky-500/10',
  // Legacy tier banners
  'banner-legacy-bronze': 'from-orange-700/35 via-amber-900/15 to-transparent',
  'banner-legacy-silver': 'from-slate-300/30 via-slate-500/10 to-transparent',
  'banner-legacy-gold': 'from-yellow-400/40 via-amber-600/15 to-transparent',
  'banner-legacy-immortal': 'from-fuchsia-500/30 via-amber-400/15 to-cyan-400/15',
};

// ── Legacy tier unlocks ──
//
// The lifetime Legacy tier (utils/managerLegacy.ts — total trophies across
// every recorded dynasty) used to be a label and nothing else. Each tier now
// unlocks cosmetics and a Manager Career JOB-MARKET reputation bonus: a
// decorated manager is considered for bigger jobs. The bonus is read ONLY by
// the job-market helpers in utils/managerCareer.ts (which vacancies are listed
// and how high their bar is, which clubs approach you, the starting offers of
// a new career) — never by a match, training, a transfer or the board. It is
// earned by winning trophies, never bought, so the monetization invariant does
// not apply, but the "never match results" line is the same.

const legacy = (item: Omit<CosmeticItem, 'earnedBy' | 'pack'>): CosmeticItem => ({ ...item, earnedBy: 'legacy' });

export const LEGACY_COSMETICS: CosmeticItem[] = [
  legacy({ id: 'badge-the-journeyman', category: 'title_badge', name: 'The Journeyman', description: 'Legacy tier: Journeyman' }),
  legacy({ id: 'banner-legacy-bronze', category: 'profile_banner', name: 'Bronze Legacy', description: 'Legacy tier: Journeyman' }),
  legacy({ id: 'celeb-text-legacy-pedigree', category: 'celebration_text', name: 'Pedigree!', description: 'Legacy tier: Established' }),
  legacy({ id: 'badge-elite-manager', category: 'title_badge', name: 'Elite Manager', description: 'Legacy tier: Elite' }),
  legacy({ id: 'banner-legacy-silver', category: 'profile_banner', name: 'Silver Legacy', description: 'Legacy tier: Elite' }),
  legacy({ id: 'celeb-text-legacy-legendary', category: 'celebration_text', name: 'Legendary!', description: 'Legacy tier: Legendary' }),
  legacy({ id: 'banner-legacy-gold', category: 'profile_banner', name: 'Gold Legacy', description: 'Legacy tier: Legendary' }),
  legacy({ id: 'badge-the-immortal', category: 'title_badge', name: 'The Immortal', description: 'Legacy tier: Immortal' }),
  legacy({ id: 'banner-legacy-immortal', category: 'profile_banner', name: 'Immortal Legacy', description: 'Legacy tier: Immortal' }),
];

/** What each Legacy tier adds. Rewards are cumulative (reaching Elite also
 *  unlocks Journeyman's and Established's); `jobReputationBonus` is the bonus
 *  AT that tier, not an increment. On the manager reputation scale a new
 *  career starts at 30 and a top-flight job needs 500, so even Immortal (+125)
 *  opens the second tier's listings to a new career, not the first's. */
export const LEGACY_TIER_UNLOCKS: Record<LegacyTier, { rewardIds: string[]; jobReputationBonus: number }> = {
  Rookie: { rewardIds: [], jobReputationBonus: 0 },
  Journeyman: { rewardIds: ['badge-the-journeyman', 'banner-legacy-bronze'], jobReputationBonus: 15 },
  Established: { rewardIds: ['celeb-text-legacy-pedigree'], jobReputationBonus: 35 },
  Elite: { rewardIds: ['badge-elite-manager', 'banner-legacy-silver'], jobReputationBonus: 60 },
  Legendary: { rewardIds: ['celeb-text-legacy-legendary', 'banner-legacy-gold'], jobReputationBonus: 90 },
  Immortal: { rewardIds: ['badge-the-immortal', 'banner-legacy-immortal'], jobReputationBonus: 125 },
};

/** From this bonus up (Elite), one of a new career's starting offers comes
 *  from the league tier above the usual starting tiers. */
export const LEGACY_START_OFFER_UPGRADE_BONUS = 60;

/** Every earned cosmetic, spread onto the end of COSMETIC_ITEMS. */
export const EARNED_COSMETICS: CosmeticItem[] = [...MANAGER_PASS_COSMETICS, ...LEGACY_COSMETICS];
