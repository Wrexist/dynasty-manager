/**
 * `npm run docs:check` (scripts/check-docs-drift.mjs) must see EVERY
 * occurrence of a claim, not only the first.
 *
 * The first version used a non-global `String.match`, so a number repeated in
 * CLAUDE.md was checked once: weekAdvance.ts was right in the architecture
 * tree and ~400 lines stale in Critical Files and Tech Debt while the gate
 * stayed green; game.ts, match.ts, the Vitest version and the national-team
 * count drifted the same way.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildChecks, findDrift } from '../../scripts/check-docs-drift.mjs';

const LOC = { label: 'weekAdvance.ts LOC', actual: 3482, re: /weekAdvance\.ts(?:(?!\.tsx?\b)[^\n(]){0,60}\((\d[\d,]*) LOC/g };

describe('docs drift checker', () => {
  it('flags a stale repeat of a claim whose first occurrence is correct', () => {
    const doc = [
      '│   └── orchestration/ → weekAdvance.ts (3,482 LOC — THE game loop)',
      '1. **`src/store/slices/orchestration/weekAdvance.ts`** — THE game loop (3,094 LOC).',
    ].join('\n');
    const { drift } = findDrift(doc, [LOC]);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ documented: '3,094', actual: 3482 });
  });

  it('--fix rewrites every stale occurrence and keeps the thousands separator', () => {
    const doc = 'weekAdvance.ts (3,094 LOC) … later … `weekAdvance.ts` (3094 LOC)';
    const { fixed } = findDrift(doc, [LOC]);
    expect(fixed).toBe('weekAdvance.ts (3,482 LOC) … later … `weekAdvance.ts` (3482 LOC)');
  });

  it('attributes each number to its own file on a shared line', () => {
    const dash = { label: 'Dashboard LOC', actual: 2168, re: /\bDashboard(?:\.tsx)?(?:(?!\.tsx?\b)[^\n(]){0,60}\((\d[\d,]*) LOC/g };
    const doc = '- `orchestration/weekAdvance.ts` (3,482 LOC) and `pages/Dashboard.tsx` (2,168 LOC) are oversized.';
    expect(findDrift(doc, [LOC, dash]).drift).toEqual([]);
  });

  it('reports a claim that no longer appears at all', () => {
    const { drift } = findDrift('nothing to see', [LOC]);
    expect(drift).toEqual([expect.objectContaining({ documented: null, reason: 'claim not found in CLAUDE.md' })]);
  });

  it('compares versions by documented precision', () => {
    const vitest = { label: 'Vitest version', actual: '4.1.11', kind: 'version', re: /\*\*Vitest (\d[\d.]*)/g };
    expect(findDrift('**Vitest 4.1 + jsdom**', [vitest]).drift).toEqual([]);
    const stale = findDrift('**Vitest 3.2.4 + jsdom**', [vitest]);
    expect(stale.drift).toHaveLength(1);
    expect(stale.fixed).toBe('**Vitest 4.1.11 + jsdom**');
  });

  it('reads the shipped version from whatsNew.ts and national teams net of legacy aliases', () => {
    const root = mkdtempSync(join(tmpdir(), 'docs-drift-'));
    try {
      mkdirSync(join(root, 'src/data'), { recursive: true });
      writeFileSync(join(root, 'src/data/whatsNew.ts'), [
        "export const RELEASE_NOTES: ReleaseNote[] = [",
        "  { version: '2.3.4', build: null },",
        "  { version: '2.3.3', build: 7 },",
        '];',
      ].join('\n'));
      writeFileSync(join(root, 'src/data/nations.ts'), [
        'export const NATIONS: NationData[] = [',
        "  { name: 'France', confederation: 'UEFA' },",
        "  { name: 'Czechia', confederation: 'UEFA' },",
        "  { name: 'Brazil', confederation: 'CONMEBOL' },",
        '];',
        "export const SELECTABLE_NATIONS = NATIONS.filter(n => !['Czechia'].includes(n.name));",
      ].join('\n'));
      const byLabel = Object.fromEntries(buildChecks(root).map(c => [c.label, c.actual]));
      expect(byLabel['latest shipped version (top of whatsNew.ts)']).toBe('2.3.4');
      expect(byLabel['national team count']).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
