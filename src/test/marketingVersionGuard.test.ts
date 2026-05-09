import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');
const GUARD_SCRIPT = 'scripts/check-marketing-version.mjs';

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as { version: string };
  return pkg.version;
}

function previousSemver(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  if ([major, minor, patch].some(Number.isNaN)) {
    throw new Error(`Unexpected package version: ${version}`);
  }
  if (patch > 0) return `${major}.${minor}.${patch - 1}`;
  if (minor > 0) return `${major}.${minor - 1}.999`;
  if (major > 0) return `${major - 1}.999.999`;
  throw new Error(`Cannot build an older valid semver from ${version}`);
}

function runGuard(args: string[]) {
  return spawnSync(process.execPath, [GUARD_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

describe('marketing version guard', () => {
  it('accepts an explicit candidate matching package.json', () => {
    const result = runGuard(['--candidate', packageVersion()]);

    expect(result.status).toBe(0);
  });

  it('rejects a marketing_version override that downgrades package.json', () => {
    const result = runGuard(['--candidate', previousSemver(packageVersion())]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/checked-in package\.json version/);
  });

  it('keeps workflow dispatch input out of shell run interpolation', () => {
    const workflow = readFileSync(resolve(REPO_ROOT, '.github/workflows/ios-testflight.yml'), 'utf8');

    expect(workflow).toMatch(/MARKETING_VERSION: \$\{\{ github\.event\.inputs\.marketing_version \}\}/);
    expect(workflow).not.toMatch(/run:.*\$\{\{ github\.event\.inputs\.marketing_version \}\}/);
  });
});
