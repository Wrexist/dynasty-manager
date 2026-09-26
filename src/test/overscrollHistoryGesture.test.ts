/**
 * The browser's swipe-to-go-back must not fire inside the game
 * (playthrough 2026-09). A right swipe on the League Table ran the in-game
 * swipe back AND Chromium's overscroll history navigation, which popped the
 * hash route from #/game to #/ — the title screen. Chromium reads
 * overscroll-behavior-x from the root element, so it has to be on `html`
 * (it was tried on body first and did nothing). Read as text like the other
 * index.css tests: jsdom does no cascade.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

describe('overscroll history gesture', () => {
  it('the root element disables horizontal overscroll', () => {
    const htmlRules = [...css.matchAll(/(^|\n)\s*html\s*\{([^}]*)\}/g)].map(m => m[2]);
    expect(htmlRules.some(body => /overscroll-behavior-x:\s*none/.test(body))).toBe(true);
  });
});
