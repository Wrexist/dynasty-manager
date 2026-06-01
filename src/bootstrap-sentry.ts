// Minimal Sentry bootstrap. Imported as the very first statement of
// main.tsx so it runs before any heavier module evaluation. If a top-level
// constant in App / gameStore / store slices throws during import (e.g. a
// future regression that calls into Capacitor at module scope), the error
// still reaches Sentry. The full `initSentry()` later upgrades the config
// with PII scrubbing, release tagging, and breadcrumb policy.
import * as Sentry from '@sentry/react';

try {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      // Conservative defaults; the full initSentry() upgrades these.
      sampleRate: 1.0,
      tracesSampleRate: 0,
      maxBreadcrumbs: 20,
      sendDefaultPii: false,
    });
  }
} catch {
  // Sentry itself threw during bootstrap — nothing we can do.
}
