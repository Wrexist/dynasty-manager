/**
 * Guardrails on the CI workflows — pinned structurally, like the source-map
 * test, because a workflow regression is invisible until the build it breaks.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
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

/** The child lines of the first `key:` mapping (deeper-indented lines and
 *  blank lines until the indent returns), or '' if the key is absent. */
function block(src: string, key: string): string {
  const lines = src.split('\n');
  const start = lines.findIndex(l => new RegExp(`^\\s*${key}:\\s*$`).test(l));
  if (start < 0) return '';
  const indent = lines[start].search(/\S/);
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && line.search(/\S/) <= indent) break;
    out.push(line);
  }
  return out.join('\n');
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

  it('seals and stamps What\'s New like the iOS workflow, before the web build', () => {
    // Without the seal an AAB shipped the previous release's notes in-app.
    const sealAt = src.indexOf('npm run whats-new:seal');
    const checkAt = src.search(/node scripts\/check-whats-new\.mjs --inject-build \$\{\{ inputs\.version_code \}\}/);
    const buildAt = src.indexOf('run: npm run build');
    expect(sealAt, 'no whats-new:seal').toBeGreaterThan(-1);
    expect(checkAt, 'no check-whats-new --inject-build <version_code>').toBeGreaterThan(-1);
    expect(src.indexOf('check-marketing-version.mjs')).toBeLessThan(sealAt);
    expect(sealAt).toBeLessThan(checkAt);
    expect(checkAt).toBeLessThan(buildAt);
    // Runner-only, as on iOS: nothing is committed or pushed back.
    expect(src).not.toMatch(/git (commit|push)/);
  });
});

describe('the release builds pass the optional redeem-code secret to the web build only', () => {
  for (const file of ['.github/workflows/android-build.yml', '.github/workflows/ios-testflight.yml']) {
    it(file, () => {
      const src = workflow(file);
      const buildAt = src.indexOf('run: npm run build');
      const buildStep = src.slice(src.lastIndexOf('- name:', buildAt), buildAt);
      expect(buildStep).toMatch(/VITE_REDEEM_SECRET:\s*\$\{\{\s*secrets\.VITE_REDEEM_SECRET\s*\}\}/);
      expect(src.match(/VITE_REDEEM_SECRET:/g)).toHaveLength(1);
    });
  }
});

describe('release.yml', () => {
  const src = workflow('.github/workflows/release.yml');

  it('stages only the files the version bump writes', () => {
    // `git add -A` / `git add .` are banned project-wide; here they would
    // commit anything else on the runner straight to main.
    expect(src).not.toMatch(/git add (-A|--all|\.)(\s|$)/m);
    const add = src.match(/git add ([^\n]+)/);
    expect(add, 'release.yml no longer stages the bump').not.toBeNull();
    expect(add[1].split(/\s+/).sort()).toEqual([
      'android/app/build.gradle',
      'ios/App/App.xcodeproj/project.pbxproj',
      'package-lock.json',
      'package.json',
    ]);
  });

  it('stages every file sync-version.mjs writes', () => {
    const sync = readFileSync(resolve(REPO_ROOT, 'scripts/sync-version.mjs'), 'utf8');
    const add = src.match(/git add ([^\n]+)/)[1];
    for (const written of ['ios/App/App.xcodeproj/project.pbxproj', 'android/app/build.gradle']) {
      expect(sync).toContain(written);
      expect(add).toContain(written);
    }
  });
});

describe('pr-checks.yml', () => {
  const src = workflow('.github/workflows/pr-checks.yml');
  const scripts = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')).scripts;

  it('runs the release gate by name, so CI and local preflight cannot drift', () => {
    expect(src).toMatch(/run:\s*npm run preflight:full\s*$/m);
    // The bundle budgets live in scripts/check-eager-bundle.mjs now, not in an
    // inline shell copy that local preflight never ran.
    expect(src).not.toMatch(/bundle-budget\.json/);
    expect(src).not.toMatch(/\bjq\b/);
  });

  it('preflight:full is preflight with the full suite — never a weaker gate', () => {
    const steps = (cmd: string) => cmd.split('&&').map(x => x.trim());
    expect(steps(scripts['preflight:full'])).toEqual(
      steps(scripts.preflight).map(x => (x === 'npm run test:fast' ? 'npm run test' : x)),
    );
    expect(steps(scripts['preflight:full'])).toContain('npm run size:check');
    expect(scripts['size:check']).toContain('check-eager-bundle.mjs');
  });

  it('cancels superseded runs and bounds every job', () => {
    expect(block(src, 'concurrency')).toMatch(/cancel-in-progress:\s*true/);
    const jobs = block(src, 'jobs').match(/^ {2}[\w-]+:\s*$/gm) ?? [];
    const timeouts = src.match(/^\s+timeout-minutes:\s*\d+/gm) ?? [];
    expect(jobs.length).toBeGreaterThan(0);
    expect(timeouts.length, 'a job has no timeout-minutes').toBe(jobs.length);
  });
});

describe('check-eager-bundle.mjs enforces every budget', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/check-eager-bundle.mjs');
  const dirs: string[] = [];
  afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

  /** A fake build: an eager entry chunk plus whatever lazy chunks are given. */
  function run(lazy: Record<string, number>) {
    const root = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    dirs.push(root);
    mkdirSync(join(root, 'dist/assets'), { recursive: true });
    mkdirSync(join(root, '.github'));
    writeFileSync(join(root, 'dist/index.html'), '<script type="module" src="/assets/index-abc.js"></script>');
    writeFileSync(join(root, 'dist/assets/index-abc.js'), 'x'.repeat(1000));
    for (const [name, bytes] of Object.entries(lazy)) {
      writeFileSync(join(root, 'dist/assets', name), 'y'.repeat(bytes));
    }
    writeFileSync(join(root, '.github/bundle-budget.json'), JSON.stringify({
      eagerGzHardLimitBytes: 100_000,
      mainChunkHardLimitBytes: 100_000,
      coreJsTargetBytes: 3_000,
      coreJsHardLimitBytes: 5_000,
      communityPackHardLimitBytes: 4_000,
    }));
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  }

  it('passes a build inside every budget', () => {
    const r = run({ 'lazy-1.js': 1000, 'byClub-1.js': 3000 });
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/::warning::/);
  });

  it('warns, but passes, over the core target', () => {
    const r = run({ 'lazy-1.js': 3000 });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/::warning::Core JS/);
  });

  it('fails when lazy app chunks push core JS over its hard limit', () => {
    // Eager payload and main chunk are tiny, so only the core budget can trip.
    const r = run({ 'lazy-1.js': 3000, 'lazy-2.js': 2000 });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/Core JS .* exceeds/);
  });

  it('keeps community-pack chunks out of core and holds them to their own limit', () => {
    const r = run({ 'freeAgents-1.js': 2500, 'cpLeagueSquads-1.js': 2000 });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/Community pack chunks .* exceed/);
    expect(r.out).not.toMatch(/Core JS .* exceeds/);
  });
});
