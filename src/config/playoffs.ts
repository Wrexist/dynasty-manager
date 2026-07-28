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
