/**
 * Date-boxed live events — the lightweight "live-ops calendar" foundation.
 *
 * Events ship in the binary with a real-world start/end window, so a themed
 * event can go live without any backend or push infrastructure (the game is
 * offline-first). The 2026 World Cup Festival is the inaugural event; add
 * future events to LIVE_EVENTS and the same surfaces (Dashboard banner +
 * Festival hub) pick them up.
 *
 * Rewards are sim-neutral: a daily check-in earns Festival Points, and point
 * milestones pay out manager XP only — never match, training, or transfer maths.
 */

export interface LiveEventTier {
  /** Stable id, persisted in the player's claimed-tier list. */
  id: string;
  /** Festival Points required to unlock this tier. */
  points: number;
  /** Manager XP granted when the tier is claimed. */
  xp: number;
  /** Short, themed label (World Cup rounds for the inaugural event). */
  label: string;
}

export interface LiveEvent {
  /** Stable id — also namespaces persisted progress, so a new event starts
   *  the player fresh rather than inheriting last event's points. */
  id: string;
  name: string;
  tagline: string;
  /** Inclusive local start day, 'YYYY-MM-DD'. */
  start: string;
  /** Inclusive local end day, 'YYYY-MM-DD'. */
  end: string;
  /** Festival Points granted per daily check-in. */
  checkInPoints: number;
  /** Festival Points granted for each won match during the window (capped per
   *  day — see MATCH_WIN_POINTS_DAILY_CAP) so the festival rewards *playing*. */
  matchWinPoints: number;
  /** Reward track, ascending by `points`. */
  tiers: LiveEventTier[];
}

/** Max match-win point awards per local day — keeps the festival a nudge to
 *  play, not a grind. */
export const MATCH_WIN_POINTS_DAILY_CAP = 3;

/** The 2026 FIFA World Cup runs June 11 – July 19, 2026 (USA/Canada/Mexico).
 *  The Festival window tracks the real tournament so the in-app event lines up
 *  with what players are watching. */
const WORLD_CUP_2026: LiveEvent = {
  id: 'world-cup-2026',
  name: '2026 World Cup Festival',
  tagline: 'Check in daily through the tournament to climb the rewards track.',
  start: '2026-06-11',
  end: '2026-07-19',
  checkInPoints: 10,
  matchWinPoints: 5,
  tiers: [
    { id: 'group',  points: 10,  xp: 25,  label: 'Group Stage' },
    { id: 'r16',    points: 30,  xp: 40,  label: 'Round of 16' },
    { id: 'qf',     points: 60,  xp: 60,  label: 'Quarter-Final' },
    { id: 'sf',     points: 100, xp: 90,  label: 'Semi-Final' },
    { id: 'final',  points: 150, xp: 150, label: 'Champions' },
  ],
};

export const LIVE_EVENTS: LiveEvent[] = [WORLD_CUP_2026];
