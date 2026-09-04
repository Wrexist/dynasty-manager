/**
 * Player standing — the thresholds that decide when a player stops being a
 * row in the squad list and becomes someone the manager remembers.
 *
 * Nothing here is a sim parameter. Standing is derived, never persisted, and
 * never feeds back into development, value, wage or match outcome — it is a
 * reading of what the simulation already did. That separation is deliberate:
 * the moment "club legend" starts making a player better, it stops being a
 * story and becomes a stat, and the squad list goes back to being numbers.
 *
 * Lives in config per the no-hardcoded-balance rule — these are tuning knobs
 * for how often the game says something, and how loud.
 */

/** Career appearance marks worth announcing. Career totals fold in at season
 *  end (`seasonEnd.ts`), so these are crossed once a season at most. */
export const APPEARANCE_MILESTONES = [50, 100, 200, 300, 400, 500] as const;

/** Career goal marks worth announcing. Sparser than appearances so a striker
 *  does not generate a milestone every single season. */
export const GOAL_MILESTONES = [25, 50, 100, 150, 200, 250] as const;

/** Cumulative overall gained in ONE season that counts as a breakthrough.
 *  Read against `GameState.seasonGrowthTracker`, which the growth cap already
 *  maintains per player — this only decides when it is worth mentioning. */
export const BREAKTHROUGH_MIN_SEASON_GROWTH = 4;

/** A breakthrough is a young player's story. Above this age the same growth is
 *  a late bloomer, which is a different (and rarer) headline. */
export const BREAKTHROUGH_MAX_AGE = 23;

/** Age at or above which sustained growth reads as a late-career surge rather
 *  than a breakthrough. */
export const LATE_BLOOMER_MIN_AGE = 29;

/** Seasons at the same club before the game calls a player long-serving. */
export const LOYAL_SERVICE_SEASONS = 5;

/** Seasons at the same club before "one-club man" is a fair thing to say —
 *  only ever applied to academy graduates, who have no previous club. */
export const ONE_CLUB_SEASONS = 8;
