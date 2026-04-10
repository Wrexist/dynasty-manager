/**
 * Match Speed Configuration
 * Interval durations (ms per game minute) for match animation.
 */

export interface MatchSpeedOption {
  value: number;      // ms per game minute (used in setInterval)
  label: string;      // Full display label (pre-match, overlays)
  shortLabel: string; // Compact label for live controls (mobile)
}

export const MATCH_SPEEDS: MatchSpeedOption[] = [
  { value: 1200, label: 'Slow',    shortLabel: '0.5x' },
  { value: 600,  label: 'Normal',  shortLabel: '1x'   },
  { value: 200,  label: 'Fast',    shortLabel: '2x'   },
  { value: 80,   label: 'Turbo',   shortLabel: '4x'   },
  { value: 20,   label: 'Instant', shortLabel: '10x'  },
];

export const DEFAULT_MATCH_SPEED = 600;
