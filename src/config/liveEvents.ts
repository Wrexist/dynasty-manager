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
 *
 * Every event pays for check-ins and wins; an event can also declare its own
 * MECHANIC (derby wins ×2, draws, clean sheets, goals, academy graduates who
 * play, completed signings) so events play differently rather than all being
 * "check in + win". A tagline must only promise a mechanic the event declares
 * — `liveEventMechanics.test.ts` holds that line.
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
  /** Multiplier on `matchWinPoints` for a win in a derby (a `DERBIES` fixture
   *  or an earned grudge rivalry — see `getEffectiveMatchIntensity`). Omitted
   *  = derbies score like any other win. A derby win still uses one of the
   *  day's MATCH_WIN_POINTS_DAILY_CAP awards. */
  derbyWinMultiplier?: number;
  /** Reward track, ascending by `points`. */
  tiers: LiveEventTier[];
  // ── content: event mechanics (all optional; omitted = off). Every match
  // mechanic rides on the same per-day match award as a win, so the daily cap
  // still bounds the event: a match that earns nothing uses no award. ──
  /** Festival Points for a drawn match (an "unbeaten" event). */
  drawPoints?: number;
  /** Bonus when the player's side keeps a clean sheet, whatever the result. */
  cleanSheetPoints?: number;
  /** Points per goal scored, up to GOAL_POINTS_MAX_PER_MATCH a match. */
  goalPoints?: number;
  /** Points per academy graduate (`isFromYouthAcademy`) who plays, up to
   *  ACADEMY_APPEARANCES_MAX_PER_MATCH a match. */
  academyAppearancePoints?: number;
  /** Points per completed signing (fee or free agent), up to
   *  SIGNING_POINTS_DAILY_CAP a day. */
  signingPoints?: number;
}

/** Max match-win point awards per local day — keeps the festival a nudge to
 *  play, not a grind. */
export const MATCH_WIN_POINTS_DAILY_CAP = 3;
// ── content: event mechanic caps ──
/** Goals that earn `goalPoints` in one match (a 9-0 is not nine times the fun). */
export const GOAL_POINTS_MAX_PER_MATCH = 4;
/** Academy graduates who earn `academyAppearancePoints` in one match. */
export const ACADEMY_APPEARANCES_MAX_PER_MATCH = 3;
/** Signings that earn `signingPoints` per local day — sign-and-release farming
 *  of free agents is bounded here. */
export const SIGNING_POINTS_DAILY_CAP = 2;

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

/** Shared reward track for the curated marquee events below. Point thresholds
 *  and XP payouts match the World Cup event's scale so every event feels
 *  consistent; only the tier LABELS are themed per event. */
function marqueeTiers(labels: [string, string, string, string, string]): LiveEventTier[] {
  return [
    { id: 'tier1', points: 10,  xp: 25,  label: labels[0] },
    { id: 'tier2', points: 30,  xp: 40,  label: labels[1] },
    { id: 'tier3', points: 60,  xp: 60,  label: labels[2] },
    { id: 'tier4', points: 100, xp: 90,  label: labels[3] },
    { id: 'tier5', points: 150, xp: 150, label: labels[4] },
  ];
}

/**
 * Hand-authored "special" events. These are the marquee, calendar-pegged
 * events (World Cup, future tournaments) that a designer curates. They take
 * PRECEDENCE over the auto-generated monthly festival on any date overlap
 * (see `getActiveLiveEvent`).
 *
 * ⚠ MAINTENANCE: `getUpcomingSpecialEvent` only ever looks FORWARD (and only
 * 45 days out), so once every entry here is in the past the "next event in N
 * days" teaser silently becomes dead code — which is exactly what happened
 * when this list held nothing but the expired 2026 World Cup. Keep at least
 * one entry with a `start` in the future, and top the list up whenever a
 * build is cut. The monthly-festival fallback means no surface ever goes
 * blank, but the marquee teaser is the only thing that says "come back".
 */
export const SPECIAL_EVENTS: LiveEvent[] = [
  WORLD_CUP_2026,
  {
    id: 'kickoff-cup-2026',
    name: 'Kickoff Cup',
    tagline: 'A new campaign begins. Check in daily and win matches to climb the track.',
    start: '2026-08-15',
    end: '2026-09-06',
    checkInPoints: 10,
    matchWinPoints: 5,
    tiers: marqueeTiers(['First Whistle', 'Early Pace', 'Front Runner', 'Table Topper', 'Kickoff Champion']),
  },
  {
    id: 'derby-days-2026',
    name: 'Derby Days',
    tagline: 'Rivalry season. Derby wins count double on the rewards track.',
    start: '2026-10-17',
    end: '2026-11-08',
    checkInPoints: 10,
    matchWinPoints: 5,
    derbyWinMultiplier: 2,
    tiers: marqueeTiers(['Local Pride', 'Bragging Rights', 'City Rivals', 'Derby Winner', 'King of the City']),
  },
  {
    id: 'festive-fixtures-2026',
    name: 'Festive Fixtures',
    tagline: 'The busiest run of the season. Draws score too — stay unbeaten.',
    start: '2026-12-18',
    end: '2027-01-04',
    checkInPoints: 10,
    matchWinPoints: 5,
    drawPoints: 2,
    tiers: marqueeTiers(['Boxing Day', 'Congestion', 'Squad Depth', 'Unbeaten Run', 'Festive Champion']),
  },
  {
    id: 'winter-window-2027',
    name: 'Winter Window',
    tagline: 'Deadline season. Every signing you complete earns Festival Points.',
    start: '2027-01-22',
    end: '2027-02-14',
    checkInPoints: 10,
    matchWinPoints: 5,
    signingPoints: 10,
    tiers: marqueeTiers(['Scouting', 'First Bid', 'Negotiation', 'Deal Agreed', 'Deadline Hero']),
  },
  {
    id: 'run-in-2027',
    name: 'The Run-In',
    tagline: 'Defences win titles. Every clean sheet earns bonus points.',
    start: '2027-04-16',
    end: '2027-05-16',
    checkInPoints: 10,
    matchWinPoints: 5,
    cleanSheetPoints: 3,
    tiers: marqueeTiers(['Squeaky Bum Time', 'Six-Pointer', 'Title Race', 'Final Day', 'Champion']),
  },
];

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

/** Event mechanics a monthly theme can switch on (see `LiveEvent`). */
type EventMechanics = Pick<LiveEvent, 'derbyWinMultiplier' | 'drawPoints' | 'cleanSheetPoints' | 'goalPoints' | 'academyAppearancePoints' | 'signingPoints'>;

/** Themed name per calendar month (1-based index). Football-flavoured but
 *  season-agnostic so it reads well year-round for a global audience. Several
 *  themes used to promise a mechanic their name implied ("Derby season", "Chase
 *  the goals", "Deal season") while paying for check-ins and wins only; each
 *  now declares the mechanic its tagline names. */
const MONTHLY_THEMES: ({ name: string; tagline: string } & EventMechanics)[] = [
  { name: 'New Year Kickoff Festival', tagline: 'Start the year strong — check in daily to climb the rewards track.' },
  { name: 'Winter Cup Festival',       tagline: 'Brave the winter fixtures — every clean sheet earns bonus points.', cleanSheetPoints: 3 },
  { name: 'Spring Surge Festival',     tagline: 'The run-in begins — check in daily and chase the rewards.' },
  { name: 'Title Run-In Festival',     tagline: 'Every point counts — check in daily to climb the track.' },
  { name: 'Season Finale Festival',    tagline: 'The finale is here — daily check-ins earn Festival Points.' },
  { name: 'Summer Transfer Festival',  tagline: 'Deal season — every signing you complete earns Festival Points.', signingPoints: 10 },
  { name: 'Pre-Season Festival',       tagline: 'Build for the new campaign — academy graduates who play earn bonus points.', academyAppearancePoints: 2 },
  { name: 'Kickoff Festival',          tagline: 'A new season kicks off — check in daily to climb the track.' },
  { name: 'Autumn Rivalries Festival', tagline: 'Derby season — derby wins count double on the rewards track.', derbyWinMultiplier: 2 },
  { name: 'Golden Boot Festival',      tagline: 'Chase the goals — every goal you score earns a bonus point.', goalPoints: 1 },
  { name: 'International Break Festival', tagline: 'Nations collide — daily check-ins earn Festival Points.' },
  { name: 'Festive Fixtures Festival', tagline: 'Pack the calendar — draws score too, so stay unbeaten.', drawPoints: 2 },
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
  const { name, tagline, ...mechanics } = MONTHLY_THEMES[month - 1];
  return {
    id: `monthly-${year}-${pad2(month)}`,
    name,
    tagline,
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    checkInPoints: 10,
    matchWinPoints: 5,
    tiers: MONTHLY_TIERS,
    ...mechanics,
  };
}
