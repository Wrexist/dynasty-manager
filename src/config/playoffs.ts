/**
 * Playoff Simulation Configuration
 * Board verdict offsets and storyline chain settings.
 */

// ── Board Verdict Position Offsets ──
export const VERDICT_EXCELLENT_OFFSET = -3;
export const VERDICT_ACCEPTABLE_OFFSET = 4;
export const BOARD_SACKING_THRESHOLD = 20;

// ── Storyline Chains ──
export const STORYLINE_CHAIN_TRIGGER_CHANCE = 0.25;
export const STORYLINE_CHAIN_MIN_WEEK = 5;
/** Seasons a completed storyline chain sits out before it can fire again.
 *
 *  `completedStorylineChainIds` was append-only and never reset, and there are
 *  only 15 chains with one active at a time. A season burns 6-8 of them, so by
 *  season 2-3 the pool was exhausted and the storyline system went PERMANENTLY
 *  dark for the rest of a 10-season dynasty — the single biggest content cliff
 *  in the game. A cooldown recycles chains without letting the same one land in
 *  consecutive seasons, which a plain wipe would allow. */
export const STORYLINE_CHAIN_COOLDOWN_SEASONS = 3;

/** Converts an earned `grudgeLevel` (0-5) into match intensity on the same scale
 *  `DERBIES` uses. Below 1.0 so a grudge you built yourself reads slightly under a
 *  century-old derby at the same numeric level. See `getEffectiveMatchIntensity`. */
export const GRUDGE_INTENSITY_SCALE = 0.8;

// ── content: storyline chain targets ──
/** Overall at which a squad player can anchor a star-player chain. Mirrors the
 *  `hasStarPlayer` bar the trigger predicates already use. */
export const STORYLINE_STAR_MIN_OVERALL = 75;
/** Wonderkid hype: the target is at most this old… */
export const STORYLINE_WONDERKID_MAX_AGE = 21;
/** …and at least this potential. */
export const STORYLINE_WONDERKID_MIN_POTENTIAL = 78;
/** Injury comeback: weeks still to serve for a lay-off to count as a "long road back". */
export const STORYLINE_COMEBACK_MIN_INJURY_WEEKS = 4;
/** Goal drought: a striker with at least this many league appearances… */
export const STORYLINE_DROUGHT_MIN_APPS = 6;
/** …and no more than this many league goals is genuinely in a drought. */
export const STORYLINE_DROUGHT_MAX_GOALS = 1;
/** Goal drought: only a first-team striker makes the back pages. */
export const STORYLINE_DROUGHT_MIN_OVERALL = 65;
/** Title race: the club is in the top N… */
export const STORYLINE_TITLE_RACE_TOP_N = 2;
/** …of a league at least this big (tiny leagues make every club a "contender"). */
export const STORYLINE_TITLE_RACE_MIN_TEAMS = 8;
/** Relegation dogfight: within this many places above the drop zone counts. */
export const STORYLINE_RELEGATION_MARGIN = 1;
