#!/usr/bin/env node
// Syncs the version from package.json to iOS and Android native projects.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;

if (!version || version === '0.0.0') {
  console.error('Error: package.json version is not set (still 0.0.0)');
  process.exit(1);
}

console.log(`Syncing version: ${version}`);

// --- iOS: update MARKETING_VERSION in project.pbxproj ---
const pbxprojPath = resolve(root, 'ios/App/App.xcodeproj/project.pbxproj');
let pbxproj = readFileSync(pbxprojPath, 'utf8');
const iosUpdated = pbxproj.replace(
  /MARKETING_VERSION = [\d.]+;/g,
  `MARKETING_VERSION = ${version};`
);
if (iosUpdated !== pbxproj) {
  writeFileSync(pbxprojPath, iosUpdated);
  console.log(`  iOS MARKETING_VERSION → ${version}`);
} else {
  console.log('  iOS: no changes needed');
}

// --- Android: update the versionName fallback default in build.gradle ---
// build.gradle resolves versionName from the VERSION_NAME env var (the
// android-build workflow passes it explicitly) and falls back to a literal
// default for local / unconfigured builds. We keep that fallback in sync
// with package.json so an env-less build never ships a stale 1.0.0.
const gradlePath = resolve(root, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
const androidVersionRe = /(versionName\s+System\.getenv\("VERSION_NAME"\)\s*\?:\s*")[\d.]+(")/;
if (!androidVersionRe.test(gradle)) {
  console.error(
    'Error: could not find the versionName fallback in android/app/build.gradle. ' +
      'Expected: versionName System.getenv("VERSION_NAME") ?: "x.y.z"'
  );
  process.exit(1);
}
const androidUpdated = gradle.replace(androidVersionRe, `$1${version}$2`);
if (androidUpdated !== gradle) {
  writeFileSync(gradlePath, androidUpdated);
  console.log(`  Android versionName fallback → "${version}"`);
} else {
  console.log(`  Android: versionName fallback already "${version}"`);
}

console.log('Done.');
