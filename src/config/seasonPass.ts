/**
 * Dynasty Pass — a FREE, season-long reward track.
 *
 * The player earns Season Pass Points just by playing (matches, weekly
 * objectives, trophies) and claims a tiered track of manager-XP rewards. There
 * is NO premium tier in v1 — every tier is free and the payout is manager XP
 * only, so the pass is sim-neutral by construction (it never touches match
 * outcomes, training, transfer values, or any other sim parameter — XP simply
 * feeds the existing manager-progression path, identical to the World Cup
 * Festival and weekly-objective rewards).
 *
 * Progress lives on the save (`GameState.seasonPass`) and resets each season in
 * seasonEnd's new-season block. Trophies won in the concluding season seed the
 * next season's pass with a head-start (see SEASON_PASS_POINTS.trophy).
 *
 * Point thresholds are tuned for a full ~40-week campaign of an engaged player:
 * matches played (+10 each), wins (+25), monthly objectives (+15 each), and
 * trophy seeds. All balance constants live here — never hardcode them in logic.
 */

/** One rung of the reward track. */
export interface SeasonPassTier {
  /** 1-based index. Persisted in `GameState.seasonPass.claimedTiers`. */
  tier: number;
  /** Season Pass Points required to unlock this tier. */
  points: number;
  /** Manager XP granted when the tier is claimed (sim-neutral reward). */
  xp: number;
  /** Short, player-facing label. */
  label: string;
}

/** Point awards for each in-game action. Wired at the existing XP-grant sites
 *  (match processing, weekly-objective completion, season-end trophies). */
export const SEASON_PASS_POINTS = {
  /** Every match the player's club plays. */
  matchPlayed: 10,
  /** Bonus on top of `matchPlayed` for a win (draws/losses get played only). */
  win: 25,
  /** Each monthly objective completed. */
  objectiveCompleted: 15,
  /** Each trophy won in the concluding season (seeds next season's pass). */
  trophy: 200,
} as const;

/** The reward track, ascending by `points`. 15 tiers spanning a full season. */
export const SEASON_PASS_TIERS: SeasonPassTier[] = [
  { tier: 1,  points: 25,   xp: 20,  label: 'Kickoff' },
  { tier: 2,  points: 60,   xp: 25,  label: 'Matchday Regular' },
  { tier: 3,  points: 110,  xp: 30,  label: 'Squad Builder' },
  { tier: 4,  points: 175,  xp: 35,  label: 'Rising Force' },
  { tier: 5,  points: 250,  xp: 40,  label: 'Contender' },
  { tier: 6,  points: 340,  xp: 50,  label: 'In the Hunt' },
  { tier: 7,  points: 440,  xp: 60,  label: 'Silverware Chase' },
  { tier: 8,  points: 550,  xp: 70,  label: 'Title Challenger' },
  { tier: 9,  points: 675,  xp: 85,  label: 'Elite Manager' },
  { tier: 10, points: 810,  xp: 100, label: 'Continental Class' },
  { tier: 11, points: 960,  xp: 120, label: 'Dynasty Rising' },
  { tier: 12, points: 1120, xp: 140, label: 'Legendary Run' },
  { tier: 13, points: 1300, xp: 170, label: 'Icon' },
  { tier: 14, points: 1500, xp: 210, label: 'Hall of Fame' },
  { tier: 15, points: 1750, xp: 300, label: 'Immortal' },
];

/** Points needed to fully complete the track (top tier threshold). */
export const SEASON_PASS_MAX_POINTS = SEASON_PASS_TIERS[SEASON_PASS_TIERS.length - 1].points;
