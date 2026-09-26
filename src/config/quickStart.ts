/**
 * Quick Start — the one-tap path from the nationality step to kickoff.
 *
 * A new player used to face Nation → League (45) → Club (756) with no
 * recommendation anywhere, before seeing a single match. Quick Start offers one
 * strong, recognisable club up front; everything it skips is still on the same
 * screen for anyone who wants to choose.
 *
 * Rule for an entry: the nation's own top flight has a genuine giant (squad
 * quality ~75+) that a fan of that country would expect to be offered. Every
 * other nation gets the default — the Premier League is the most-followed
 * league across our biggest markets, and a title-chasing squad makes the first
 * season a good one. A test pins that every id resolves to a real club.
 *
 * Community-pack leagues (Argentina, Brazil, MLS, Saudi Arabia) are only valid
 * when the pack is on; `pickQuickStartClub` falls back to the default when not.
 */

/** Offered when the nation has no entry below, or its club is unavailable. */
export const QUICK_START_DEFAULT_CLUB_ID = 'liverpool';

/** Nationality used when the device locale maps to nothing — matches the default club. */
export const QUICK_START_FALLBACK_NATION = 'England';

export const QUICK_START_CLUB_BY_NATION: Readonly<Record<string, string>> = {
  Spain: 'real-madrid',
  Germany: 'bayern-munich',
  Italy: 'inter-milan',
  France: 'paris-saint-germain',
  Portugal: 'benfica',
  Netherlands: 'ajax',
  Belgium: 'club-brugge',
  Turkey: 'galatasaray',
  // Community-pack leagues — fall back to the default when the pack is off.
  // (MLS is absent on purpose: its best squads sit around 72, below the bar.)
  Argentina: 'boca-juniors',
  Brazil: 'flamengo',
  'Saudi Arabia': 'al-hilal',
};
