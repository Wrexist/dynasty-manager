/**
 * Match Speed Configuration
 * Interval durations (ms per game minute) for match animation.
 */

export interface MatchSpeedOption {
  value: number;      // ms per game minute (used in setInterval)
  label: string;      // Full display label (pre-match, overlays)
  shortLabel: string; // Compact label for live controls (mobile)
  pro: boolean;       // Requires Dynasty Pro to unlock
}

// Calibrated so a normal 90-minute match at 1x runs ~5 minutes of real time
// (~90 minute-ticks × 3300ms ≈ 4.95 min). The faster tiers stay proportional to
// their labels.
//
// Turbo (4x ≈ 1.25 min/match) is FREE: forcing new players to sit through a
// multi-minute match is the biggest single drag on early-session retention,
// and gating *speed* throttles the free funnel we need before anyone converts.
// The Pro headline is the genuine skip — `Instant` (10x + the MatchPrep
// skip-to-result path, the `instant_sim` Pro feature) — not merely "faster".
export const MATCH_SPEEDS: MatchSpeedOption[] = [
  { value: 6600, label: 'Slow',    shortLabel: '0.5x', pro: false },
  { value: 3300, label: 'Normal',  shortLabel: '1x',   pro: false },
  { value: 1650, label: 'Fast',    shortLabel: '2x',   pro: false },
  { value: 825,  label: 'Turbo',   shortLabel: '4x',   pro: false },
  { value: 330,  label: 'Instant', shortLabel: '10x',  pro: true  },
];

export const DEFAULT_MATCH_SPEED = 3300;

/**
 * Minimum ms-per-minute when the 2.5D pitch view is on screen. The pitch plays
 * a chain of passes/runs per minute, so it needs real time to breathe — we floor
 * the tick well above the fastest commentary speeds so the action stays legible
 * and lifelike instead of strobing. Commentary-only keeps the user's chosen
 * speed (including Turbo/Instant).
 */
export const PITCH_VIEW_MIN_SPEED = 1500;

/** How long the match clock holds when the player's own team scores, so the goal
 *  lands before play resumes (roughly the length of the goal celebration). */
export const GOAL_PAUSE_MS = 2200;

