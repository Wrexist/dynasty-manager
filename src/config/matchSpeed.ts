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

export const MATCH_SPEEDS: MatchSpeedOption[] = [
  { value: 1200, label: 'Slow',    shortLabel: '0.5x', pro: false },
  { value: 600,  label: 'Normal',  shortLabel: '1x',   pro: false },
  { value: 200,  label: 'Fast',    shortLabel: '2x',   pro: false },
  { value: 80,   label: 'Turbo',   shortLabel: '4x',   pro: true  },
  { value: 20,   label: 'Instant', shortLabel: '10x',  pro: true  },
];

export const DEFAULT_MATCH_SPEED = 600;

/**
 * Minimum ms-per-minute when the 2.5D pitch view is on screen. The pitch plays
 * a chain of passes/runs per minute, so it needs real time to breathe — we floor
 * the tick well above the fastest commentary speeds so the action stays legible
 * and lifelike instead of strobing. Commentary-only keeps the user's chosen
 * speed (including Turbo/Instant).
 */
export const PITCH_VIEW_MIN_SPEED = 1500;

