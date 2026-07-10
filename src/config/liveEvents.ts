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

/**
 * Hand-authored "special" events. These are the marquee, calendar-pegged
 * events (World Cup, future tournaments) that a designer curates. They take
 * PRECEDENCE over the auto-generated monthly festival on any date overlap
 * (see `getActiveLiveEvent`). Add future special events here.
 */
export const SPECIAL_EVENTS: LiveEvent[] = [WORLD_CUP_2026];

/** Back-compat alias — historically the only event list. Now == special
 *  (hand-authored) events; the monthly festival is generated, not listed. */
export const LIVE_EVENTS: LiveEvent[] = SPECIAL_EVENTS;

// ── Auto-generated monthly festival ──
//
// Retention can't depend on a designer hand-authoring an event every month, so
// there is ALWAYS a live event: a deterministic, real-calendar-keyed monthly
// "Festival" generated from the date alone (no server, no push). It mirrors the
// free-daily-pack pattern of bucketing by the device-local calendar. Each month
// gets its own themed name and its own progress namespace (id = `monthly-YYYY-MM`),
// so a new month starts the player fresh — exactly like a new special event.

/** Reward track shared by every generated monthly event. Point thresholds and
 *  XP payouts match the World Cup event's scale so the two feel consistent. */
const MONTHLY_TIERS: LiveEventTier[] = [
  { id: 'warmup',    points: 10,  xp: 25,  label: 'Warm-Up' },
  { id: 'rising',    points: 30,  xp: 40,  label: 'Rising' },
  { id: 'onform',    points: 60,  xp: 60,  label: 'On Form' },
  { id: 'contender', points: 100, xp: 90,  label: 'In Contention' },
  { id: 'champion',  points: 150, xp: 150, label: 'Champion' },
];

/** Themed name per calendar month (1-based index). Football-flavoured but
 *  season-agnostic so it reads well year-round for a global audience. */
const MONTHLY_THEMES: { name: string; tagline: string }[] = [
  { name: 'New Year Kickoff Festival', tagline: 'Start the year strong — check in daily to climb the rewards track.' },
  { name: 'Winter Cup Festival',       tagline: 'Brave the winter fixtures — daily check-ins earn Festival Points.' },
  { name: 'Spring Surge Festival',     tagline: 'The run-in begins — check in daily and chase the rewards.' },
  { name: 'Title Run-In Festival',     tagline: 'Every point counts — check in daily to climb the track.' },
  { name: 'Season Finale Festival',    tagline: 'The finale is here — daily check-ins earn Festival Points.' },
  { name: 'Summer Transfer Festival',  tagline: 'Deal season — check in daily to climb the rewards track.' },
  { name: 'Pre-Season Festival',       tagline: 'Build for the new campaign — daily check-ins earn rewards.' },
  { name: 'Kickoff Festival',          tagline: 'A new season kicks off — check in daily to climb the track.' },
  { name: 'Autumn Rivalries Festival', tagline: 'Derby season — daily check-ins earn Festival Points.' },
  { name: 'Golden Boot Festival',      tagline: 'Chase the goals — check in daily to climb the rewards track.' },
  { name: 'International Break Festival', tagline: 'Nations collide — daily check-ins earn Festival Points.' },
  { name: 'Festive Fixtures Festival', tagline: 'Pack the calendar — check in daily to climb the track.' },
];

/** Two-digit, zero-padded string for a 1-based month. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Deterministically build the monthly festival for the calendar month that
 * contains `now`. Pure function of the date — the same (year, month) always
 * produces the same event, so no persistence or server is needed. The window
 * spans the whole local month (day 1 → last day inclusive).
 */
export function generateMonthlyEvent(now: Date = new Date()): LiveEvent {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this one
  const theme = MONTHLY_THEMES[month - 1];
  return {
    id: `monthly-${year}-${pad2(month)}`,
    name: theme.name,
    tagline: theme.tagline,
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    checkInPoints: 10,
    matchWinPoints: 5,
    tiers: MONTHLY_TIERS,
  };
}
