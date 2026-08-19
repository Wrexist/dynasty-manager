/**
 * The Sunday icon vocabulary — one glyph, one meaning.
 *
 * Forty-five lucide icons were spread across eleven Sunday files with no shared
 * map, and two had quietly acquired second jobs: `Trophy` marked the cup, the
 * completed season AND the derby banner; `Flag` marked a folded club and the
 * ratings list. Those are the collisions this file pins.
 *
 * WHY IT READS SOURCE AS TEXT. The second test is a drift guard, not a render
 * check: a screen that imports lucide directly can reintroduce a third meaning
 * for `Trophy` without touching the map. Same technique `sundayI18n.test.ts`
 * and `renderHygiene.test.ts` use, and for the same reason.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Flag, Trophy } from 'lucide-react';
import {
  SUNDAY_AVAILABILITY_ICON, SUNDAY_EVENT_CATEGORY_ICON, SUNDAY_EVENT_CATEGORY_TONE,
  SUNDAY_ICON, SUNDAY_MEMORY_ICON, SUNDAY_NEWS_ICON, SUNDAY_RELATIONSHIP_ICON,
  SUNDAY_UPGRADE_ICON, SUNDAY_WEATHER_ICON,
} from '@/config/sundayIcons';
import { SUNDAY_UPGRADES } from '@/config/sundayLeague';

const MAPS = {
  SUNDAY_ICON,
  SUNDAY_AVAILABILITY_ICON,
  SUNDAY_WEATHER_ICON,
  SUNDAY_EVENT_CATEGORY_ICON,
  SUNDAY_UPGRADE_ICON,
  SUNDAY_MEMORY_ICON,
  SUNDAY_RELATIONSHIP_ICON,
  SUNDAY_NEWS_ICON,
} as const;

/** Files that are allowed to name a glyph. Only the map. */
const SUNDAY_UI_FILES = [
  ...fs.readdirSync(path.resolve('src/pages'))
    .filter(f => f.startsWith('Sunday') && f.endsWith('.tsx'))
    .map(f => path.join('src', 'pages', f)),
  ...fs.readdirSync(path.resolve('src/components/game/sunday'))
    .filter(f => f.endsWith('.tsx'))
    .map(f => path.join('src', 'components', 'game', 'sunday', f)),
];

describe('Sunday icon map', () => {
  it('every entry in every map is a renderable component', () => {
    for (const [name, map] of Object.entries(MAPS)) {
      for (const [key, icon] of Object.entries(map)) {
        expect(typeof icon, `${name}.${key}`).toMatch(/function|object/);
        expect(icon, `${name}.${key}`).toBeTruthy();
      }
    }
  });

  it('Trophy means the cup and nothing else', () => {
    const keys = Object.entries(SUNDAY_ICON).filter(([, v]) => v === Trophy).map(([k]) => k);
    expect(keys).toEqual(['cup']);
  });

  it('Flag means the end of a season and nothing else', () => {
    const keys = Object.entries(SUNDAY_ICON).filter(([, v]) => v === Flag).map(([k]) => k);
    expect(keys).toEqual(['seasonComplete']);
  });

  it('covers every upgrade id, so a new upgrade cannot ship without a glyph', () => {
    for (const u of SUNDAY_UPGRADES) {
      expect(SUNDAY_UPGRADE_ICON[u.id], u.id).toBeTruthy();
    }
    expect(Object.keys(SUNDAY_UPGRADE_ICON).sort()).toEqual(SUNDAY_UPGRADES.map(u => u.id).slice().sort());
  });

  it('pairs every event category with both a glyph and a tone', () => {
    expect(Object.keys(SUNDAY_EVENT_CATEGORY_ICON).sort())
      .toEqual(Object.keys(SUNDAY_EVENT_CATEGORY_TONE).sort());
  });

  it('no Sunday screen names a glyph of its own', () => {
    const offenders = SUNDAY_UI_FILES.filter(f =>
      /from '(?:lucide-react)'/.test(fs.readFileSync(path.resolve(f), 'utf8')));
    expect(offenders, 'import icons from @/config/sundayIcons instead').toEqual([]);
  });
});
