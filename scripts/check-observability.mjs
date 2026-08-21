#!/usr/bin/env node
/**
 * Observability build check — Sentry only.
 *
 * `sentry.ts` hard-returns when VITE_SENTRY_DSN is empty:
 *
 *     const dsn = import.meta.env.VITE_SENTRY_DSN;
 *     if (!dsn) return;
 *
 * That is the correct runtime behaviour — a missing secret must never crash the
 * app — but it means a release built with NO Sentry DSN is byte-for-byte
 * indistinguishable, from the outside, from one built with it. You ship,
 * everything looks fine, and no crash report ever arrives.
 *
 * So: make it loud at build time instead of silent at run time.
 *
 *   node scripts/check-observability.mjs           # warn only (default)
 *   node scripts/check-observability.mjs --strict  # exit 1 if DSN missing
 *
 * Use --strict in the TestFlight/release workflow once the DSN secret exists,
 * so a secret that gets rotated away or renamed fails the build instead of
 * silently blinding production.
 *
 * Analytics travels via RevenueCat + App Store Connect (decision in
 * docs/growth-overhaul-plan.md §1.2); no first-party endpoint exists.
 */

const CHECKS = [
  {
    env: 'VITE_SENTRY_DSN',
    what: 'Crash reporting',
    fatal: true,
    consequence:
      'No crash report leaves a production device, and every Sentry.captureException in the purchase paths is a no-op — a live revenue incident would be invisible.',
    fix: 'Create a project at https://sentry.io, copy its DSN, and add it as a GitHub Actions secret named VITE_SENTRY_DSN.',
  },
];

const strict = process.argv.includes('--strict');
const missing = CHECKS.filter((c) => !process.env[c.env]);

if (missing.length === 0) {
  console.log('Observability: all secrets present.');
  process.exit(0);
}

const failing = missing.filter((c) => strict && c.fatal);

const label = failing.length > 0 ? 'ERROR' : 'WARNING';
console.log('');
console.log(`  ${label}: ${missing.length} of ${CHECKS.length} observability secret(s) missing.`);
console.log('  ' + '─'.repeat(70));
for (const c of missing) {
  console.log('');
  console.log(`  ✗ ${c.env} — ${c.what} is DISABLED${c.fatal && !strict ? ' (fatal under --strict)' : ''}`);
  console.log(`    Consequence: ${c.consequence}`);
  console.log(`    Fix: ${c.fix}`);
}
console.log('');

if (failing.length > 0) {
  console.error('  Failing the build: fatal observability secrets are missing.');
  process.exit(1);
}

console.log('  Building anyway (warn-only mode). Pass --strict to make this fatal.');
console.log('');
process.exit(0);
