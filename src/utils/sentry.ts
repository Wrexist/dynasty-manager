import * as Sentry from '@sentry/react';

// Build-time constant injected by Vite's `define` (see vite.config.ts).
// `declare` so TypeScript accepts the bare identifier in source; we still
// guard with `typeof` in case the constant isn't defined (e.g. in vitest,
// whose config doesn't inject it).
declare const __APP_VERSION__: string;

let initialized = false;

/** Object keys that almost certainly carry PII or full save content. Any
 *  value at one of these keys in a Sentry event payload is replaced with
 *  `[REDACTED]` before the event leaves the browser. Case-insensitive. */
const SENSITIVE_KEY_RE = /^(name|firstName|lastName|fullName|displayName|managerName|manager|careerManager|email|user|username|userId|clubName|save|saveData|clubs|players|allPlayers|fixtures|divisionFixtures|divisionTables|leagueTable|messages|inbox|cpPool|squad|lineup|subs|transferMarket|freeAgents|jobOffers|jobVacancies|sponsorDeals|sponsorOffers)$/i;

const MAX_STRING_LEN = 500;
const MAX_ARRAY_LEN = 20;
const MAX_DEPTH = 6;

/** Deep-scrub an arbitrary value for Sentry transmission. Replaces values
 *  at sensitive keys with a marker, truncates long strings, and caps arrays
 *  so a runaway `extra: state` block can't ship a whole save to the server.
 *  Pure — does not mutate the input. Exported for unit testing. */
export function scrubPII<T>(input: T, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[DEPTH_LIMIT]';
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return input.length > MAX_STRING_LEN
      ? input.slice(0, MAX_STRING_LEN) + '…[truncated]'
      : input;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    const capped = input.slice(0, MAX_ARRAY_LEN).map(v => scrubPII(v, depth + 1));
    if (input.length > MAX_ARRAY_LEN) capped.push(`…[+${input.length - MAX_ARRAY_LEN} more]`);
    return capped;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubPII(v, depth + 1);
    }
  }
  return out;
}

function getAppVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  } catch {
    return 'dev';
  }
}

/** Initialise Sentry exactly once. No-op when VITE_SENTRY_DSN is unset so
 *  local dev without a DSN doesn't ship errors anywhere. Release is tied
 *  to package.json version via a Vite-injected constant so uploaded
 *  sourcemaps line up with the user's build. */
export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? 'development' : 'production',
    release: `dynasty-manager@${getAppVersion()}`,
    sampleRate: 1.0,
    tracesSampleRate: import.meta.env.DEV ? 0 : 0.1,
    // We never set Sentry.setUser — this flag just makes sure the SDK doesn't
    // collect IP address / cookies on its own.
    sendDefaultPii: false,
    maxBreadcrumbs: 50,
    beforeSend(event) {
      // `extra` and `contexts` are the risky fields — `tags` values are
      // short non-PII strings by convention (we never put user data there).
      if (event.extra) event.extra = scrubPII(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrubPII(event.contexts) as typeof event.contexts;
      if (event.user) event.user = undefined;
      if (event.request) {
        // `cookies` is typed as Record<string,string>; wipe entirely rather
        // than stuff a string marker where the type demands a dict.
        if (event.request.cookies) delete event.request.cookies;
        if (event.request.data) event.request.data = '[REDACTED]';
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubPII(breadcrumb.data) as typeof breadcrumb.data;
      }
      return breadcrumb;
    },
  });

  initialized = true;
}

export function isSentryInitialised(): boolean {
  return initialized;
}

/** The narrow set of game-lifecycle breadcrumbs the observability plan calls
 *  out. Keep this list small — every addition becomes a field in the Sentry
 *  dashboard filter dropdown. */
export type GameBreadcrumbCategory = 'game_start' | 'season_end' | 'save' | 'crash';

/** Record a game-lifecycle breadcrumb. The allowed `data` shape is narrow on
 *  purpose — numeric/boolean facts only, no names or save contents — so the
 *  crumb is safe to send without depending on `beforeBreadcrumb` scrubbing.
 *  No-op if Sentry isn't initialised (so code sites don't need a guard). */
export function addGameBreadcrumb(
  category: GameBreadcrumbCategory,
  message: string,
  data?: Record<string, string | number | boolean | null>,
): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    category: `game.${category}`,
    message,
    level: category === 'crash' ? 'error' : 'info',
    data,
  });
}

/** Dev-only test hook. Throws an unhandled error so the user can confirm the
 *  pipeline end-to-end (breadcrumb + exception reaches the Sentry dashboard).
 *  Wired to the hidden "Test Sentry" button in Settings when `import.meta.env.DEV`. */
export function triggerTestError(): never {
  addGameBreadcrumb('crash', 'Manual test error triggered from Settings');
  throw new Error('Sentry test error — if you can read this in your Sentry dashboard, crash reporting is working.');
}
