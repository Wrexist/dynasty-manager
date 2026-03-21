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

// --- Android: update versionName in build.gradle ---
const gradlePath = resolve(root, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
const androidUpdated = gradle.replace(
  /versionName "[\d.]+"/,
  `versionName "${version}"`
);
if (androidUpdated !== gradle) {
  writeFileSync(gradlePath, androidUpdated);
  console.log(`  Android versionName → "${version}"`);
} else {
  console.log('  Android: no changes needed');
}

console.log('Done.');
