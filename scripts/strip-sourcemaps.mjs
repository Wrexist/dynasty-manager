#!/usr/bin/env node
/**
 * Delete build source maps from `dist/` before the native sync.
 *
 * `vite.config.ts` sets `sourcemap: 'hidden'`, which suppresses the
 * `//# sourceMappingURL` comment but still WRITES every `.map` file. Capacitor's
 * `webDir` is `dist`, so `npx cap sync` copies the whole directory — maps
 * included — straight into the app bundle.
 *
 * Measured on a clean production build: dist was 66 MB, of which 35 MB across
 * 122 `.map` files. Two problems, both shipping today:
 *
 *   1. Over half the download is dead weight. Download size is a direct App
 *      Store conversion factor, especially over mobile networks.
 *   2. `'hidden'` hides the maps from a browser devtools pane, not from a
 *      person. Anyone who unzips the IPA gets the full original TypeScript.
 *
 * Run this between `npm run build` and `npx cap sync`. It is idempotent and a
 * no-op when there is nothing to remove, so it is safe on any build.
 *
 * If you later want maps for crash symbolication, upload them to Sentry in a
 * step BEFORE this one — do not stop deleting them.
 */
import { readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve(process.cwd(), process.argv[2] ?? 'dist');

/** Recursively collect every *.map path under `dir`. */
function collectMaps(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // dist/ absent — nothing built yet, nothing to strip.
  }
  const found = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectMaps(full));
    else if (entry.isFile() && entry.name.endsWith('.map')) found.push(full);
  }
  return found;
}

const maps = collectMaps(DIST);

if (maps.length === 0) {
  console.log(`No source maps under ${DIST} — nothing to strip.`);
  process.exit(0);
}

let bytes = 0;
for (const file of maps) {
  try {
    bytes += statSync(file).size;
    rmSync(file);
  } catch (err) {
    console.error(`Failed to remove ${file}: ${err.message}`);
    process.exit(1);
  }
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(`Stripped ${maps.length} source map${maps.length === 1 ? '' : 's'} (${mb} MB) from ${DIST}.`);
