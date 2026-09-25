/**
 * Radix Dialog warns "Missing `Description` or `aria-describedby={undefined}`"
 * (console.warn) — and errors when a title is missing — for every sheet that
 * lacks them. The playthrough's console showed it on every More-drawer open
 * and on the forced-substitution sheet (2026-09, R19). A sheet either carries
 * a (visually hidden) SheetDescription, or says `aria-describedby={undefined}`
 * where its content is its own description. `src/components/ui/*` is untouched.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { cleanup, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { MoreDrawer } from '@/components/game/MoreDrawer';
import { SubstitutionSheet } from '@/components/game/SubstitutionSheet';

function radixA11yMessages(spies: ReturnType<typeof vi.spyOn>[]): string[] {
  return spies.flatMap(spy => spy.mock.calls.map(args => String(args[0])))
    .filter(msg => /Description|DialogTitle|requires a `/.test(msg));
}

describe('sheets open without Radix a11y warnings', () => {
  beforeAll(() => {
    useGameStore.getState().initGame('celtic');
    useGameStore.setState({ currentScreen: 'dashboard', matchSubsUsed: 0 });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('the More drawer', () => {
    const spies = [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    render(<MoreDrawer open onOpenChange={() => {}} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(radixA11yMessages(spies)).toEqual([]);
    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeTruthy();
  });

  it('the substitution sheet, forced (an injury) and voluntary', () => {
    const s = useGameStore.getState();
    const outId = s.clubs[s.playerClubId].lineup[0];
    for (const forceMode of [true, false]) {
      const spies = [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
      render(
        <SubstitutionSheet
          open onOpenChange={() => {}} forceMode={forceMode} preSelectedOutId={forceMode ? outId : undefined}
          injuredPlayerIds={forceMode ? [outId] : []} matchMinute={63} homeGoals={1} awayGoals={0}
        />,
      );
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(radixA11yMessages(spies), `forceMode=${forceMode}`).toEqual([]);
      cleanup();
      vi.restoreAllMocks();
    }
  });

  it('the forced sheet with no substitutions left has a title and a description', () => {
    useGameStore.setState({ matchSubsUsed: 5 });
    const s = useGameStore.getState();
    const outId = s.clubs[s.playerClubId].lineup[0];
    const spies = [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    render(<SubstitutionSheet open onOpenChange={() => {}} forceMode preSelectedOutId={outId} injuredPlayerIds={[outId]} />);
    const dialog = screen.getByRole('dialog', { name: 'No Substitutions Remaining' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(radixA11yMessages(spies)).toEqual([]);
    useGameStore.setState({ matchSubsUsed: 0 });
  });
});

describe('every Radix sheet or dialog in the app describes itself', () => {
  const root = resolve(__dirname, '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { if (name !== 'ui' && name !== 'test') walk(full); }
      else if (full.endsWith('.tsx')) files.push(full);
    }
  };
  walk(root);

  it('each file rendering SheetContent / DialogContent has a Description or aria-describedby', () => {
    const offenders = files.filter(f => {
      const src = readFileSync(f, 'utf8');
      if (!/<(SheetContent|DialogContent)\b/.test(src)) return false;
      return !/(SheetDescription|DialogDescription|aria-describedby)/.test(src);
    }).map(f => f.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
