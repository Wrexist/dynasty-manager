/**
 * Sunday League navigation — the invariants that would have caught the bugs.
 *
 * The mode shipped with a tab called "Club" that opened a screen headed
 * "Sunday League" and a tab called "Money" that opened one headed "The Club",
 * while three screens (League, Recruitment, History) had no home in the tab
 * strip at all. Both were invisible to the test suite because nothing asserted
 * anything about navigation.
 *
 * These five assertions mechanise exactly those failures. Three of them read
 * source files as TEXT rather than importing the modules: `BottomNav`'s tab set
 * and `GameShell`'s screen map are module-private, and importing either would
 * drag React, framer-motion and every lazy page into a fast unit suite for no
 * benefit. `renderHygiene.test.ts` already uses the same technique.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BACK_TARGET, SCREEN_TITLES, SUNDAY_MAIN_TABS, SUNDAY_SCREEN_GROUPS,
} from '@/config/navigation';
import { SUNDAY_CLUB_SUB_NAV, SUNDAY_TEAM_SUB_NAV } from '@/config/ui';
import { en } from '@/i18n/locales/en';
import { sundayPrimaryAction } from '@/utils/sunday/primaryAction';
import { SUNDAY_MIN_START } from '@/config/sundayLeague';
import type { GameScreen, SundayState } from '@/types/game';

const read = (rel: string) => fs.readFileSync(path.resolve(rel), 'utf8');

/** Keys of GameShell's `screens` record. */
function registeredScreens(): Set<string> {
  const src = read('src/pages/GameShell.tsx');
  const block = src.match(/const screens: Record<string, React\.ComponentType> = \{([\s\S]*?)\n\};/);
  expect(block, 'GameShell still declares a `screens` record').toBeTruthy();
  return new Set([...block![1].matchAll(/^\s*'?([a-z][\w-]*)'?\s*:/gm)].map(m => m[1]));
}

/** The `sundayTabs` array literal from BottomNav, as `{ screen, labelKey?, label? }`. */
function sundayTabEntries(): { screen: string; labelKey?: string; label?: string }[] {
  const src = read('src/components/game/BottomNav.tsx');
  const block = src.match(/const sundayTabs: NavTab\[\] = \[([\s\S]*?)\n\];/);
  expect(block, 'BottomNav still declares `sundayTabs`').toBeTruthy();
  return [...block![1].matchAll(/\{\s*screen:\s*'([\w-]+)'([^}]*)\}/g)].map(m => ({
    screen: m[1],
    labelKey: m[2].match(/labelKey:\s*'([^']+)'/)?.[1],
    label: m[2].match(/[^K]label:\s*'([^']+)'/)?.[1],
  }));
}

/** Every `sunday-*` member of the GameScreen union. */
function sundayScreenIds(): string[] {
  const src = read('src/types/game.ts');
  const union = src.match(/export type GameScreen = ([^;]+);/);
  expect(union, 'GameScreen is still a single-line union').toBeTruthy();
  return [...union![1].matchAll(/'(sunday-[\w-]+)'/g)].map(m => m[1]);
}

describe('Sunday navigation — every destination resolves', () => {
  it('every tab and every group member is a registered screen', () => {
    const registered = registeredScreens();
    const ids = [...SUNDAY_MAIN_TABS, ...SUNDAY_SCREEN_GROUPS.flat()];
    expect(ids.length).toBeGreaterThan(0);
    const missing = ids.filter(id => !registered.has(id));
    expect(missing, 'nav points at screens GameShell does not render').toEqual([]);
  });

  it('the tab strip agrees with SUNDAY_MAIN_TABS, screen for screen', () => {
    expect(sundayTabEntries().map(e => e.screen)).toEqual(SUNDAY_MAIN_TABS);
  });
});

describe('Sunday navigation — every label comes from a key', () => {
  it('no Sunday tab or sub-nav entry carries a bare English literal', () => {
    const bare = sundayTabEntries().filter(e => !e.labelKey || e.label);
    expect(bare, 'a Sunday tab is hardcoding its label again').toEqual([]);
  });

  it('every nav label key exists in en.ts', () => {
    const keys = [
      ...sundayTabEntries().map(e => e.labelKey!),
      ...SUNDAY_TEAM_SUB_NAV.map(i => i.labelKey),
      ...SUNDAY_CLUB_SUB_NAV.map(i => i.labelKey),
    ];
    const missing = keys.filter(k => !(k in en));
    expect(missing).toEqual([]);
  });
});

describe('Sunday navigation — no two labels collide', () => {
  const labelOf = (key: string) => en[key as keyof typeof en] as string;

  it('the four tab labels are all different', () => {
    const labels = sundayTabEntries().map(e => labelOf(e.labelKey!));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('each sub-nav group has distinct labels', () => {
    for (const group of [SUNDAY_TEAM_SUB_NAV, SUNDAY_CLUB_SUB_NAV]) {
      const labels = group.map(i => labelOf(i.labelKey));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  // THE Club/Money bug: the tab called Club opened the screen titled
  // "Sunday League", and the screen titled "The Club" sat behind a tab called
  // Money. A tab's label may only match its OWN screen's title.
  it('a tab label never matches another tab’s screen title', () => {
    const entries = sundayTabEntries();
    const clashes: string[] = [];
    for (const tab of entries) {
      const label = labelOf(tab.labelKey!);
      for (const other of entries) {
        if (other.screen === tab.screen) continue;
        if (SCREEN_TITLES[other.screen as GameScreen] === label) {
          clashes.push(`tab "${label}" (${tab.screen}) collides with the title of ${other.screen}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe('Sunday navigation — group membership is total', () => {
  // The assertion that would have caught Recruitment and History being
  // reachable only from a button grid on the hub.
  it('every sunday-* screen is a tab, a group member, or has a back target', () => {
    const homed = new Set<string>([
      ...SUNDAY_MAIN_TABS,
      ...SUNDAY_SCREEN_GROUPS.flat(),
      ...Object.keys(BACK_TARGET),
    ]);
    const orphans = sundayScreenIds().filter(id => !homed.has(id));
    expect(orphans, 'a Sunday screen has no way back into the app').toEqual([]);
  });

  it('every sunday-* screen has a SCREEN_TITLES entry', () => {
    const missing = sundayScreenIds().filter(id => !SCREEN_TITLES[id as GameScreen]);
    expect(missing).toEqual([]);
  });
});

describe('sundayPrimaryAction — all four states', () => {
  const WEEK = 5;
  const base = (over: Partial<SundayState>) =>
    ({ seasonComplete: false, teamsheet: [], halfTime: null, ...over }) as SundayState;
  const xi = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
  /** Only the two fields the helper reads; the rest of a real pause is the
   *  engine state, which no routing decision depends on. */
  const pause = (week: number) => ({ week, season: 1 } as SundayState['halfTime']);

  it('season over → review, whatever the fixture says', () => {
    expect(sundayPrimaryAction(base({ seasonComplete: true }), true, WEEK).kind).toBe('review');
    expect(sundayPrimaryAction(base({ seasonComplete: true }), false, WEEK).kind).toBe('review');
  });

  it('a fixture and a legal side → play', () => {
    const a = sundayPrimaryAction(base({ teamsheet: xi(SUNDAY_MIN_START) }), true, WEEK);
    expect(a.kind).toBe('play');
    expect(a.screen).toBe('sunday-match');
  });

  it('a fixture and too few named → pick', () => {
    const a = sundayPrimaryAction(base({ teamsheet: xi(SUNDAY_MIN_START - 1) }), true, WEEK);
    expect(a.kind).toBe('pick');
    expect(a.screen).toBe('sunday-teamsheet');
  });

  it('no fixture → advance, with no screen to navigate to', () => {
    const a = sundayPrimaryAction(base({ teamsheet: xi(11) }), false, WEEK);
    expect(a.kind).toBe('advance');
    expect(a.screen).toBeUndefined();
  });

  it('a match paused at the break → back to it, even with the sheet gutted', () => {
    // The morning can leave fewer than seven names on the sheet, and the pause
    // holds the side that actually kicked off. Routing that manager to the
    // teamsheet sends him to a screen that can only refuse him.
    const a = sundayPrimaryAction(
      base({ teamsheet: xi(SUNDAY_MIN_START - 2), halfTime: pause(WEEK) }), true, WEEK,
    );
    expect(a.kind).toBe('play');
    expect(a.screen).toBe('sunday-match');
  });

  it('a pause left behind by an earlier week does not hijack this one', () => {
    const a = sundayPrimaryAction(base({ teamsheet: xi(11), halfTime: pause(WEEK - 1) }), false, WEEK);
    expect(a.kind).toBe('advance');
  });

  it('every label key it can return exists in en.ts', () => {
    const cases: SundayPrimaryCase[] = [
      [base({ seasonComplete: true }), true],
      [base({ teamsheet: xi(SUNDAY_MIN_START) }), true],
      [base({ teamsheet: xi(1) }), true],
      [base({}), false],
      [base({ halfTime: pause(WEEK) }), true],
    ];
    for (const [state, hasFixture] of cases) {
      expect(sundayPrimaryAction(state, hasFixture, WEEK).labelKey in en).toBe(true);
    }
  });
});

type SundayPrimaryCase = [SundayState, boolean];
