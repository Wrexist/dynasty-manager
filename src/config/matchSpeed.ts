/**
 * Match Speed Configuration
 * Interval durations (ms per game minute) for match animation.
 */

import type { MatchDayPhase } from '@/types/game';

export interface MatchSpeedOption {
  value: number;      // ms per game minute (used in setInterval)
  label: string;      // Full display label (pre-match, overlays)
  shortLabel: string; // Compact label for live controls (mobile)
  pro: boolean;       // Requires Dynasty Pro to unlock
}

// Calibrated so a normal 90-minute match at 1x runs ~5 minutes of real time
// (~90 minute-ticks × 3300ms ≈ 4.95 min). The faster tiers stay proportional to
// their labels.
export const MATCH_SPEEDS: MatchSpeedOption[] = [
  { value: 6600, label: 'Slow',    shortLabel: '0.5x', pro: false },
  { value: 3300, label: 'Normal',  shortLabel: '1x',   pro: false },
  { value: 1650, label: 'Fast',    shortLabel: '2x',   pro: false },
  { value: 825,  label: 'Turbo',   shortLabel: '4x',   pro: true  },
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


/**
 * Where MatchDay offers "Skip to full time".
 *
 * PLAYBACK-ONLY. A skip runs the exact store calls the clock would have made —
 * the remaining second-half segments, then extra time — with the lineup and
 * tactics as they stand, so the result, events and player stats are the ones
 * watching without touching anything would have produced. That is what keeps
 * it clear of the rule that monetization never moves a sim parameter: the
 * free/Pro split below changes how long you wait, never what happens.
 *
 * Free players get it from half-time: the fastest free speed is ~2.5 minutes of
 * real time per match, every match, and the first half (plus the half-time team
 * talk) is where the managing happens. Pro keeps the kickoff-onward version
 * alongside Instant Sim, so the Pro time saving stays the larger one.
 */
export const SKIP_TO_FULL_TIME_PHASES: Readonly<Record<'free' | 'pro', readonly MatchDayPhase[]>> = {
  free: ['half_time', 'second_half', 'extra_time_break', 'extra_time'],
  pro: ['first_half', 'half_time', 'second_half', 'extra_time_break', 'extra_time'],
};
