/**
 * Guardrail: source maps must never reach a native app bundle.
 *
 * `vite.config.ts` sets `sourcemap: 'hidden'`. That suppresses the
 * `//# sourceMappingURL` comment but still WRITES every `.map` file, and
 * Capacitor's `webDir` is `dist`, so `npx cap sync` copies the whole directory
 * into the app bundle.
 *
 * Measured on a clean production build: 66 MB of dist, 35 MB of it across 122
 * `.map` files. Over half the download was dead weight, and `'hidden'` hides
 * maps from a devtools pane, not from anyone who unzips the IPA.
 *
 * These tests pin the fix structurally rather than trusting a habit: any
 * workflow that runs `cap sync` must strip first, and it must strip BEFORE the
 * sync — stripping afterwards leaves the copy already made.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const WORKFLOWS = [
  '.github/workflows/ios-testflight.yml',
  '.github/workflows/android-build.yml',
];

describe('source-map stripping', () => {
  it('the strip script exists and is referenced by an npm script', () => {
    expect(existsSync(resolve(REPO_ROOT, 'scripts/strip-sourcemaps.mjs'))).toBe(true);
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['strip-sourcemaps']).toContain('strip-sourcemaps.mjs');
  });

  it('cap:sync strips maps rather than syncing a raw build', () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
    // Must not be the plain `build` — that is the one that leaves maps behind.
    expect(pkg.scripts['cap:sync']).toContain('build:native');
    expect(pkg.scripts['build:native']).toContain('strip-sourcemaps.mjs');
  });

  it.each(WORKFLOWS)('%s strips source maps before cap sync', rel => {
    // Compare RUN lines only. Matching raw text finds the rationale comment
    // above the strip step (which necessarily names `cap sync`) and reads it as
    // the sync itself, inverting the order check.
    const src = readFileSync(resolve(REPO_ROOT, rel), 'utf8')
      .split('\n')
      .filter(line => !/^\s*#/.test(line))
      .join('\n');
    const stripAt = src.indexOf('strip-sourcemaps');
    const syncAt = src.indexOf('npx cap sync');

    expect(syncAt, `${rel} should run cap sync`).toBeGreaterThan(-1);
    expect(stripAt, `${rel} runs cap sync without stripping source maps first`).toBeGreaterThan(-1);
    // Order matters: stripping after the sync leaves the copy already made.
    expect(stripAt, `${rel} strips source maps AFTER cap sync — too late`).toBeLessThan(syncAt);
  });

  it('vite still emits hidden maps, so the strip step stays load-bearing', () => {
    // If this ever changes to `sourcemap: false`, the strip step becomes a
    // harmless no-op rather than wrong — but the comment above it, and this
    // guardrail, should be revisited deliberately.
    const cfg = readFileSync(resolve(REPO_ROOT, 'vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/sourcemap:\s*'hidden'/);
  });
});
