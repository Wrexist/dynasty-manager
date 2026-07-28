/**
 * Motion tokens — the single source of truth for durations, easing, springs
 * and press-scale across the app.
 *
 * WHY: a visual audit found 20+ distinct `duration-*` values, five different
 * spring configs and three different `active:scale-[...]` amounts. Motion is
 * the cheapest place for an app to feel incoherent, and the easiest to fix
 * centrally. Reach for a token here before typing a number.
 *
 * REDUCED MOTION: these are raw values, not policy. App-level reduced-motion
 * is already handled by `<MotionConfig reducedMotion>` in `App.tsx` (which
 * also honours `settings.performanceMode`). For CSS transitions, pair the
 * press tokens with `motion-reduce:active:scale-100`.
 */

/** Durations in SECONDS — framer-motion's unit. */
export const FAST = 0.15;
export const BASE = 0.25;
export const SLOW = 0.4;

/** Durations in MILLISECONDS — for CSS/Tailwind `duration-*` and setTimeout. */
export const FAST_MS = 150;
export const BASE_MS = 250;
export const SLOW_MS = 400;

/**
 * The one easing curve. Standard-decelerate: leaves fast, settles soft —
 * reads as "responsive" rather than "floaty" on a touch device.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Tight, confident settle. Nav pills, toggles, score pops. */
export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 38,
  mass: 0.8,
};

/** Slower, weightier settle. Sheets, panels, reveals. */
export const SPRING_SOFT = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 26,
  mass: 1,
};

/** Press feedback: buttons/pills/chips (small targets need a bigger dip). */
export const PRESS = 0.97;

/** Press feedback: cards/panels (large targets — a 3% dip looks broken). */
export const PRESS_CARD = 0.985;

/** Ready-made framer-motion transition using the shared duration + curve. */
export const TRANSITION_BASE = { duration: BASE, ease: EASE_OUT };
export const TRANSITION_FAST = { duration: FAST, ease: EASE_OUT };
