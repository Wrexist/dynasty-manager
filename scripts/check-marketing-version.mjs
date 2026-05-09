#!/usr/bin/env node
/**
 * check-marketing-version.mjs
 *
 * Guard-rail that runs in CI before the iOS TestFlight build to catch the
 * "silent regression" class of bug — where someone triggers the workflow
 * with a marketing version (or leaves it blank, falling back to package.json)
 * that is LOWER than the most recently sealed entry in src/data/whatsNew.ts.
 *
 * Apple App Store Connect tolerates that scenario but hides the resulting
 * build under an older version "train", which looks like the upload silently
 * failed. We fail loudly here instead, with a clear actionable error.
 *
 * Compared values:
 *   • package.json `version`.
 *   • optional `--candidate X.Y.Z` override from the TestFlight workflow input,
 *     checked before `npm version` mutates package.json on the runner.
 *   • Top entry of src/data/whatsNew.ts — the last version that was sealed
 *     and shipped through this pipeline.
 *
 * Outcomes:
 *   effective >  whatsNew[0]  → forward ship (normal). Pass.
 *   effective == whatsNew[0]  → re-ship of same version (supported re-trigger). Pass.
 *   effective <  whatsNew[0]  → regression. Fail with explicit instructions.
 *   candidate <  package.json → override downgrade. Fail before mutating package.json.
 *
 * This does NOT detect orphaned version trains (a marketing_version override
 * that was uploaded but never sealed/committed back). For that, the operator
 * has to bump package.json past the orphan manually.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PKG_PATH = resolve(root, 'package.json');
const WHATS_NEW_PATH = resolve(root, 'src/data/whatsNew.ts');

const args = process.argv.slice(2);
const candidateIdx = args.indexOf('--candidate');
const candidateVersion = candidateIdx >= 0 ? args[candidateIdx + 1] : null;

function fail(msg) {
  console.error(`::error file=package.json::${msg}`);
  process.exit(1);
}

const pkgVersion = JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;
if (!pkgVersion) fail('package.json has no version field.');
if (candidateIdx >= 0 && !candidateVersion) fail('--candidate requires a version value.');

const whatsNewSource = readFileSync(WHATS_NEW_PATH, 'utf8');
// Pull the first `version: '...'` after the RELEASE_NOTES array opens.
const arrayMatch = whatsNewSource.match(/export const RELEASE_NOTES:\s*ReleaseNote\[\]\s*=\s*\[/);
if (!arrayMatch) fail('Could not find RELEASE_NOTES in src/data/whatsNew.ts.');
const after = whatsNewSource.slice(arrayMatch.index + arrayMatch[0].length);
const versionMatch = after.match(/version\s*:\s*['"]([\d.]+)['"]/);
if (!versionMatch) fail('Could not parse top RELEASE_NOTES entry version.');
const sealedVersion = versionMatch[1];

function parseSemver(v) {
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    fail(`Invalid semver: ${v}. Expected MAJOR.MINOR.PATCH.`);
  }
  return parts;
}

function cmp(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

const marketingVersion = candidateVersion || pkgVersion;
const packageCmp = cmp(marketingVersion, pkgVersion);
if (packageCmp < 0) {
  fail(
    `Refusing to ship. Marketing version override ${marketingVersion} is OLDER than the checked-in package.json version ${pkgVersion}. ` +
      `Use package.json's version (leave the workflow input blank) or a higher version so TestFlight does not upload to an older hidden version train.`,
  );
}

const c = cmp(marketingVersion, sealedVersion);
const comparedVersions = candidateVersion
  ? `candidate=${marketingVersion}, package.json=${pkgVersion}`
  : `package.json=${pkgVersion}`;
console.log(`Marketing-version check: ${comparedVersions}, sealed top of whatsNew.ts=${sealedVersion}.`);

if (c < 0) {
  fail(
    `Refusing to ship. Marketing version ${marketingVersion} is OLDER than the most recently sealed version ${sealedVersion} in src/data/whatsNew.ts. ` +
      `This is the class of bug where a TestFlight upload silently lands on an older version train and disappears from the user's TestFlight view. ` +
      `Fix by either (a) bumping package.json to ${sealedVersion} or higher and re-running, or (b) re-triggering the workflow with marketing_version set to ${sealedVersion} or higher.`,
  );
}

if (c === 0) {
  console.log(`  Re-ship of v${marketingVersion} — same as sealed top. Allowed (build number from run_number ensures uniqueness).`);
} else {
  console.log(`  Forward ship: v${marketingVersion} > sealed v${sealedVersion}. OK.`);
}

process.exit(0);
