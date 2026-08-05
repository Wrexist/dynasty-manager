#!/usr/bin/env node
/**
 * Observability build check.
 *
 * `analytics.ts` and `sentry.ts` both hard-return when their env var is empty:
 *
 *     const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
 *     if (!endpoint || typeof fetch === 'undefined') return;   // analytics.ts
 *     const dsn = import.meta.env.VITE_SENTRY_DSN;
 *     if (!dsn) return;                                        // sentry.ts
 *
 * That is the correct runtime behaviour — a missing secret must never crash the
 * app — but it means a release built with NO secrets is byte-for-byte
 * indistinguishable, from the outside, from one built with them. You ship,
 * everything looks fine, and no crash report or analytics event ever arrives.
 * That is exactly the state this app was in until the workflow wiring landed.
 *
 * So: make it loud at build time instead of silent at run time.
 *
 *   node scripts/check-observability.mjs           # warn only (default)
 *   node scripts/check-observability.mjs --strict  # exit 1 if anything missing
 *
 * Use --strict in the TestFlight/release workflow once the secrets exist, so a
 * secret that gets rotated away or renamed fails the build instead of silently
 * blinding production.
 */

const CHECKS = [
  {
    env: 'VITE_SENTRY_DSN',
    what: 'Crash reporting',
    consequence:
      'No crash report leaves a production device, and every Sentry.captureException in the purchase paths is a no-op — a live revenue incident would be invisible.',
    fix: 'Create a project at https://sentry.io, copy its DSN, and add it as a GitHub Actions secret named VITE_SENTRY_DSN.',
  },
  {
    env: 'VITE_ANALYTICS_ENDPOINT',
    what: 'Product analytics',
    consequence:
      'No analytics event leaves the device, so every conversion rate in marketing/ads/unit-economics.mjs stays a guess.',
    fix: 'Stand up a collector endpoint and add it as a GitHub Actions secret named VITE_ANALYTICS_ENDPOINT — or decide deliberately to rely on RevenueCat + App Store Connect instead (see marketing/ads/RELEASE-READINESS.md §1.3).',
  },
];

const strict = process.argv.includes('--strict');
const missing = CHECKS.filter((c) => !process.env[c.env]);

if (missing.length === 0) {
  console.log('Observability: all secrets present.');
  process.exit(0);
}

const label = strict ? 'ERROR' : 'WARNING';
console.log('');
console.log(`  ${label}: ${missing.length} of ${CHECKS.length} observability secret(s) missing.`);
console.log('  ' + '─'.repeat(70));
for (const c of missing) {
  console.log('');
  console.log(`  ✗ ${c.env} — ${c.what} is DISABLED`);
  console.log(`    Consequence: ${c.consequence}`);
  console.log(`    Fix: ${c.fix}`);
}
console.log('');

if (strict) {
  console.error('  Failing the build because --strict was requested.');
  process.exit(1);
}

console.log('  Building anyway (warn-only mode). Pass --strict to make this fatal.');
console.log('');
process.exit(0);
