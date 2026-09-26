import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The bottom nav must sit BELOW every full-screen overlay.
 *
 * GameShell renders <BottomNav /> after <main>, and <main> creates no stacking
 * context, so a `fixed inset-0` overlay inside a page competes with the nav in
 * the root stacking context. At an equal z-index the later element wins — the
 * nav painted over ~17 z-50 modals (TransferNegotiation, CelebrationModal,
 * OptimizeResultModal, Match Prep's confirm…) and stayed tappable while a
 * negotiation was open (audit 2026-09-25 #8). Strictly-greater is the rule.
 *
 * Read as text, like sundayNav.test.ts: the question is which Tailwind class
 * ships, not what jsdom (which does no layout) would compute.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function zOf(cls: string): number | null {
  const m = cls.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$|['"`])/);
  if (!m) return null;
  return Number(m[1] ?? m[2]);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('overlay layering', () => {
  const navSrc = read('src/components/game/BottomNav.tsx');
  const navLine = navSrc.split('\n').find(l => l.includes('fixed bottom-0 left-0 right-0'));
  const navZ = navLine ? zOf(navLine) : null;

  it('BottomNav declares a z-index on its fixed container', () => {
    expect(navLine, 'BottomNav fixed container not found').toBeTruthy();
    expect(navZ).not.toBeNull();
  });

  it('every full-screen overlay stacks strictly above the bottom nav', () => {
    const files = [
      ...walk(join(ROOT, 'src/components')),
      ...walk(join(ROOT, 'src/pages')),
    ].filter(f => !f.includes(`${join('src', 'components', 'ui')}`));

    const offenders: string[] = [];
    let overlays = 0;
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!line.includes('fixed inset-0')) return;
        const z = zOf(line);
        if (z == null) return; // no z on this line (comment, or class assembled elsewhere)
        overlays++;
        if (z <= (navZ as number)) offenders.push(`${relative(ROOT, file)}:${i + 1} z-${z}`);
      });
    }

    expect(overlays).toBeGreaterThan(15);
    expect(offenders, `overlays at or below the nav (z-${navZ})`).toEqual([]);
  });
});
