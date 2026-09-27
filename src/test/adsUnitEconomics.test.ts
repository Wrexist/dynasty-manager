import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const runModel = (...args: string[]) => execFileSync(process.execPath,
  ['marketing/ads/unit-economics.mjs', ...args], { encoding: 'utf8' });

describe('advertising scenario model', () => {
  it('requires more revenue when the target ROAS rises', () => {
    const output = runModel('--cpt=1', '--cr=0.5', '--commission=0', '--roas=2');
    expect(output).toMatch(/Gross-equivalent revenue\/install must reach\s+\$4\.00/);
    expect(output).toContain('SCENARIO ONLY');
    expect(output).not.toContain('PAYS BACK — scale');
  });

  it('reduces the bid ceiling in proportion to target ROAS', () => {
    const baseline = JSON.parse(runModel('--json', '--roas=1'));
    const target = JSON.parse(runModel('--json', '--roas=2'));
    expect(target.maxCpt).toBeCloseTo(baseline.maxCpt / 2);
    expect(target.netPerInstall).toBe(baseline.netPerInstall);
  });
});
