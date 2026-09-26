/**
 * More drawer — four groups, one icon per destination, no second entry point
 * for screens a sub-nav already owns, and search still reaching everything.
 *
 * Before: 25 rows in Competition / Squad / Management / Career, with Trophy
 * standing for League, Trophies and Hall of Fame (and Globe for both National
 * Team and Job Market), and Training / Staff / Youth listed both here and as
 * the Squad tab's pills.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MoreDrawer } from '@/components/game/MoreDrawer';
import { useGameStore } from '@/store/gameStore';
import { DRAWER_GROUPS, PINNED_DRAWER_SCREENS } from '@/config/navigation';
import { SQUAD_SUB_NAV, MARKET_SUB_NAV } from '@/config/ui';

function openDrawer() {
  return render(<MoreDrawer open onOpenChange={() => {}} />);
}

/** Every navigation row / pinned tile in the open drawer, keyed by its label. */
function rows(): { label: string; icon: string }[] {
  const dialog = screen.getByRole('dialog');
  return within(dialog).getAllByRole('button')
    .map(button => {
      const label = button.querySelector('p.text-sm, span.text-\\[11px\\]')?.textContent?.trim() ?? '';
      const svg = button.querySelector('svg');
      const icon = [...(svg?.classList ?? [])].find(c => c.startsWith('lucide-')) ?? '';
      return { label, icon };
    })
    .filter(r => r.label && r.icon);
}

function search(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/search all features/i), { target: { value: text } });
}

beforeEach(() => {
  useGameStore.getState().initGame('celtic');
  useGameStore.setState({ gameMode: 'career', careerManager: null, season: 3, week: 10, currentScreen: 'dashboard' });
});

describe('More drawer — groups', () => {
  it('shows exactly Club, Competitions, Me, App, in that order', () => {
    openDrawer();
    const headings = screen.getAllByRole('button', { expanded: true }).map(b => b.textContent?.replace(/\d+$/, '').trim());
    expect(headings).toEqual(['Club', 'Competitions', 'Me', 'App']);
    expect(DRAWER_GROUPS.map(g => g.id)).toEqual(['club', 'competitions', 'me', 'app']);
  });

  it('keeps every pinned screen inside a group, so search and pinning agree', () => {
    const grouped = new Set(DRAWER_GROUPS.flatMap(g => g.screens));
    for (const screenId of PINNED_DRAWER_SCREENS) expect(grouped.has(screenId)).toBe(true);
  });

  it('no longer lists screens a sub-nav already owns', () => {
    const grouped = new Set(DRAWER_GROUPS.flatMap(g => g.screens));
    for (const entry of [...SQUAD_SUB_NAV, ...MARKET_SUB_NAV]) expect(grouped.has(entry.screen)).toBe(false);
    openDrawer();
    const labels = rows().map(r => r.label);
    for (const gone of ['Training', 'Staff', 'Youth Academy', 'Youth', 'Scouting', 'Packs']) {
      expect(labels).not.toContain(gone);
    }
  });

  it('still lists every club-management screen', () => {
    openDrawer();
    const labels = rows().map(r => r.label);
    for (const label of ['Club', 'Board', 'Finance', 'Merchandise', 'Facilities', 'Competitions', 'Rivalries',
      "Ballon d'Or", 'Trophies', 'Perks', 'Legacy', 'Hall of Fame', 'Shop', 'Settings', 'Career Overview', 'Job Market']) {
      expect(labels).toContain(label);
    }
  });

  it('hides career-only rows outside Manager Career', () => {
    useGameStore.setState({ gameMode: 'sandbox' as never });
    openDrawer();
    const labels = rows().map(r => r.label);
    expect(labels).not.toContain('Career Overview');
    expect(labels).not.toContain('Job Market');
  });
});

describe('More drawer — icons', () => {
  it('gives every destination its own icon, including search-only rows', () => {
    openDrawer();
    const seen = rows();
    for (const label of ['Squad', 'Training', 'Staff', 'Youth', 'Tactics', 'Transfers', 'Scouting', 'Packs']) {
      search(label);
      const hit = rows().find(r => r.label === label);
      expect(hit, `search "${label}"`).toBeTruthy();
      seen.push(hit!);
    }
    const byIcon = new Map<string, string[]>();
    for (const r of seen) byIcon.set(r.icon, [...(byIcon.get(r.icon) ?? []), r.label]);
    const shared = [...byIcon.entries()].filter(([, labels]) => new Set(labels).size > 1);
    expect(shared).toEqual([]);
  });
});

describe('More drawer — search', () => {
  it('finds a sub-nav screen and navigates to it', () => {
    openDrawer();
    search('staff');
    expect(screen.getByText('Jump to')).toBeTruthy();
    const staffRow = screen.getAllByRole('button').find(b => b.textContent?.includes('Coaches, scouts & physios'));
    expect(staffRow).toBeTruthy();
    fireEvent.click(staffRow!);
    expect(useGameStore.getState().currentScreen).toBe('staff');
  });

  it('finds Tactics — a bottom-nav tab the old search could not reach', () => {
    openDrawer();
    search('tactics');
    expect(screen.getAllByRole('button').some(b => b.textContent?.includes('Formation, lineup & instructions'))).toBe(true);
  });
});
