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
import type { CosmeticCategory, CosmeticEarnSource, CosmeticItem, LegacyTier, ManagerPassTierDef } from '@/types/game';
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
//
// Written as compact rows because this file ships in the main chunk (the
// catalog is read at startup) and that chunk has a hard size cap. The shared
// `description` is never drawn for an earned item — the Shop lists only sold
// cosmetics — and banner colours live in config/profileBanners.ts, which only
// the (lazy) Pass and Legacy pages load.

type EarnedRow = [id: string, category: CosmeticCategory, name: string];
const TITLE: CosmeticCategory = 'title_badge';
const CELEB: CosmeticCategory = 'celebration_text';
const BANNER: CosmeticCategory = 'profile_banner';

const earned = (earnedBy: CosmeticEarnSource, description: string) =>
  ([id, category, name]: EarnedRow): CosmeticItem => ({ id, category, name, description, earnedBy });

export const MANAGER_PASS_COSMETICS: CosmeticItem[] = ([
  // Free row
  ['banner-touchline', BANNER, 'Touchline'],
  ['badge-the-grafter', TITLE, 'The Grafter'],
  ['celeb-text-pass-get-in', CELEB, 'Get In!'],
  ['banner-floodlights', BANNER, 'Floodlights'],
  ['badge-the-strategist', TITLE, 'The Strategist'],
  ['celeb-text-pass-what-a-night', CELEB, 'What a Night!'],
  ['banner-matchday', BANNER, 'Matchday'],
  ['badge-the-motivator', TITLE, 'The Motivator'],
  ['celeb-text-pass-scenes', CELEB, 'Scenes!'],
  ['badge-the-closer', TITLE, 'The Closer'],
  // Pro row — titles
  ['badge-the-tinkerman', TITLE, 'The Tinkerman'],
  ['badge-the-visionary', TITLE, 'The Visionary'],
  ['badge-the-mastermind', TITLE, 'The Mastermind'],
  ['badge-the-alchemist', TITLE, 'The Alchemist'],
  ['badge-the-conductor', TITLE, 'The Conductor'],
  ['badge-the-pragmatist', TITLE, 'The Pragmatist'],
  ['badge-the-innovator', TITLE, 'The Innovator'],
  ['badge-the-kingmaker', TITLE, 'The Kingmaker'],
  ['badge-the-headmaster', TITLE, 'The Headmaster'],
  ['badge-the-maestro', TITLE, 'The Maestro'],
  ['badge-the-mentor', TITLE, 'The Mentor'],
  ['badge-the-guv', TITLE, 'The Guv'],
  // Pro row — celebration lines
  ['celeb-text-pass-get-in-there', CELEB, 'Get In There!'],
  ['celeb-text-pass-masterclass', CELEB, 'Masterclass!'],
  ['celeb-text-pass-pure-football', CELEB, 'Pure Football!'],
  ['celeb-text-pass-limbs', CELEB, 'Limbs!'],
  ['celeb-text-pass-clinical', CELEB, 'Clinical!'],
  ['celeb-text-pass-written', CELEB, 'Written in the Stars!'],
  ['celeb-text-pass-box-office', CELEB, 'Box Office!'],
  ['celeb-text-pass-total-control', CELEB, 'Total Control!'],
  ['celeb-text-pass-history-made', CELEB, 'History Made!'],
  // Pro row — banners
  ['banner-pro-gold-rush', BANNER, 'Gold Rush'],
  ['banner-pro-emerald-night', BANNER, 'Emerald Night'],
  ['banner-pro-midnight-blue', BANNER, 'Midnight Blue'],
  ['banner-pro-crimson-derby', BANNER, 'Crimson Derby'],
  ['banner-pro-royal-violet', BANNER, 'Royal Violet'],
  ['banner-pro-sunset', BANNER, 'Sunset Kickoff'],
  ['banner-pro-arctic', BANNER, 'Arctic'],
  ['banner-pro-obsidian', BANNER, 'Obsidian'],
  ['banner-pro-champions', BANNER, 'Champions'],
] as EarnedRow[]).map(earned('manager_pass', 'Manager Pass reward'));

/**
 * The track: 30 tiers, a Pro reward on every tier and a free reward on every
 * third — row N is tier N as [pro, free?]. The same track runs each season
 * (progress and claims reset; rewards already owned stay owned). A themed
 * per-season track is a content drop: give a season its own rows here —
 * nothing else changes.
 */
const TRACK_ROWS: [pro: string, free?: string][] = [
  ['badge-the-tinkerman'],
  ['celeb-text-pass-get-in-there'],
  ['banner-pro-midnight-blue', 'banner-touchline'],
  ['badge-the-pragmatist'],
  ['celeb-text-pass-clinical'],
  ['banner-pro-emerald-night', 'badge-the-grafter'],
  ['badge-the-mentor'],
  ['celeb-text-pass-limbs'],
  ['banner-pro-arctic', 'celeb-text-pass-get-in'],
  ['badge-the-innovator'],
  ['celeb-text-pass-pure-football'],
  ['banner-pro-crimson-derby', 'banner-floodlights'],
  ['badge-the-conductor'],
  ['celeb-text-pass-box-office'],
  ['banner-pro-sunset', 'badge-the-strategist'],
  ['badge-the-headmaster'],
  ['celeb-text-pass-masterclass'],
  ['banner-pro-royal-violet', 'celeb-text-pass-what-a-night'],
  ['badge-the-alchemist'],
  ['celeb-text-pass-total-control'],
  ['banner-pro-obsidian', 'banner-matchday'],
  ['badge-the-kingmaker'],
  ['celeb-text-pass-written'],
  ['banner-pro-gold-rush', 'badge-the-motivator'],
  ['badge-the-visionary'],
  ['celeb-text-pass-history-made'],
  ['badge-the-maestro', 'celeb-text-pass-scenes'],
  ['badge-the-guv'],
  ['badge-the-mastermind'],
  ['banner-pro-champions', 'badge-the-closer'],
];

export const MANAGER_PASS_TRACK: ManagerPassTierDef[] = TRACK_ROWS.map(([pro, free], i) =>
  (free ? { tier: i + 1, free, pro } : { tier: i + 1, pro }));

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

export const LEGACY_COSMETICS: CosmeticItem[] = ([
  ['badge-the-journeyman', TITLE, 'The Journeyman'],
  ['banner-legacy-bronze', BANNER, 'Bronze Legacy'],
  ['celeb-text-legacy-pedigree', CELEB, 'Pedigree!'],
  ['badge-elite-manager', TITLE, 'Elite Manager'],
  ['banner-legacy-silver', BANNER, 'Silver Legacy'],
  ['celeb-text-legacy-legendary', CELEB, 'Legendary!'],
  ['banner-legacy-gold', BANNER, 'Gold Legacy'],
  ['badge-the-immortal', TITLE, 'The Immortal'],
  ['banner-legacy-immortal', BANNER, 'Immortal Legacy'],
] as EarnedRow[]).map(earned('legacy', 'Legacy tier reward'));

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
