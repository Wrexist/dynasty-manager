/**
 * Guardrails on the CI workflows — pinned structurally, like the source-map
 * test, because a workflow regression is invisible until the build it breaks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Workflow source with comment lines dropped, so a rationale comment that
 *  names a command is never mistaken for the step that runs it. */
function workflow(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8')
    .split('\n')
    .filter(line => !/^\s*#/.test(line))
    .join('\n');
}

/** The indented block under `key:` (its child lines), or '' if absent. */
function block(src: string, key: string): string {
  const m = src.match(new RegExp(`^(\\s*)${key}:\\s*\\n((?:\\1\\s+.*\\n?)+)`, 'm'));
  return m ? m[2] : '';
}

describe('android-build.yml', () => {
  const src = workflow('.github/workflows/android-build.yml');

  it('does not default the version name to a literal', () => {
    // TestFlight #142 class: a hardcoded default ('1.0.0') built whatever the
    // form said, not what package.json says.
    const input = block(src, 'version_name');
    expect(input, 'version_name input missing').not.toBe('');
    expect(input).toMatch(/required:\s*false/);
    expect(input).toMatch(/default:\s*''/);
  });

  it('passes gradle the version resolved from package.json, not the raw input', () => {
    expect(src).not.toMatch(/VERSION_NAME:\s*\$\{\{\s*inputs\.version_name/);
    expect(src).toMatch(/require\('\.\/package\.json'\)\.version/);
  });

  it('guards the version and runs the release gates before building', () => {
    const guardAt = src.indexOf('check-marketing-version.mjs');
    const gatesAt = src.indexOf('npm run preflight:full');
    const gradleAt = src.indexOf('bundleRelease');
    expect(guardAt, 'no marketing-version guard').toBeGreaterThan(-1);
    expect(gatesAt, 'no preflight:full').toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(gradleAt);
    expect(gatesAt).toBeLessThan(gradleAt);
  });

  it('caches npm', () => {
    expect(block(src, 'with')).toMatch(/cache:\s*npm/);
  });
});
