/**
 * The in-app Reduced Motion setting must reach CSS, not only framer-motion.
 *
 * `settings.reducedMotion` used to feed MotionConfig and useReducedMotionPref
 * and nothing else. index.css's kill switch listened to the OS preference and
 * `.perf-mode` only, so a player who turned motion off in Settings still got
 * ~50 pulsing `animate-pulse` badges and every Tailwind `transition-*` (audit
 * 2026-09-25 §2). App.tsx now mirrors the setting onto a root `reduce-motion`
 * class, and index.css cancels loops, keyframes and transitions under it.
 *
 * The CSS half is read as text (like overlayLayering.test.ts): jsdom does no
 * cascade for class-scoped rules, and the question is which rules ship.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, act, cleanup } from '@testing-library/react';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));
// The title screen and the recovery dialog are irrelevant to the root class
// and pull in save hydration; stub them so the test isolates App's effect.
vi.mock('@/pages/TitleScreen', () => ({ default: () => <div>title</div> }));
vi.mock('@/components/SaveRecoveryDialog', () => ({ SaveRecoveryDialog: () => null }));

import App from '@/App';
import { useGameStore } from '@/store/gameStore';

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

function setMotion(reducedMotion: boolean, performanceMode: boolean) {
  act(() => {
    useGameStore.setState(s => ({ settings: { ...s.settings, reducedMotion, performanceMode } }));
  });
}

const rootHas = () => document.documentElement.classList.contains('reduce-motion');

afterEach(() => {
  cleanup();
  setMotion(false, false);
});

describe('reduce-motion root class (App.tsx)', () => {
  it('follows the in-app Reduced Motion setting', () => {
    setMotion(false, false);
    render(<App />);
    expect(rootHas()).toBe(false);

    setMotion(true, false);
    expect(rootHas()).toBe(true);

    setMotion(false, false);
    expect(rootHas()).toBe(false);
  });

  it('is also set by Performance mode, which implies reduced motion', () => {
    setMotion(false, true);
    render(<App />);
    expect(rootHas()).toBe(true);
    expect(document.documentElement.classList.contains('perf-mode')).toBe(true);
  });

  it('is removed when App unmounts', () => {
    setMotion(true, false);
    const { unmount } = render(<App />);
    expect(rootHas()).toBe(true);
    unmount();
    expect(rootHas()).toBe(false);
  });
});

/** Every selector list whose rule body contains `decl`. */
function selectorsDeclaring(decl: RegExp): string[] {
  const out: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(css))) {
    if (decl.test(m[2])) out.push(m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim());
  }
  return out;
}

describe('reduce-motion CSS (index.css)', () => {
  it('stops the infinite decorative loops under .reduce-motion', () => {
    const stopped = selectorsDeclaring(/animation:\s*none\s*!important/).join('\n');
    for (const loop of ['pulse', 'bounce', 'ping']) {
      expect(stopped, `.reduce-motion does not stop animate-${loop}`)
        .toContain(`.reduce-motion [class*="animate-${loop}"]`);
    }
  });

  it('slows rather than freezes the spinner', () => {
    const slowed = selectorsDeclaring(/animation-duration:\s*1\.5s/).join('\n');
    expect(slowed).toContain('.reduce-motion [class*="animate-spin"]');
  });

  it('collapses every CSS transition under .reduce-motion', () => {
    const collapsed = selectorsDeclaring(/transition-duration:\s*0\.01ms\s*!important/).join('\n');
    expect(collapsed).toMatch(/\.reduce-motion \*(?![:\w])/);
    expect(collapsed).toContain('.reduce-motion *::before');
  });

  it('collapses the remaining keyframe utilities, but not the spinner', () => {
    const collapsed = selectorsDeclaring(/animation-duration:\s*0\.01ms\s*!important/).join('\n');
    expect(collapsed).toContain('.reduce-motion [class*="animate-"]:not([class*="animate-spin"])');
  });

  it('reaches the named decorative loops that only had OS-preference guards', () => {
    const stopped = selectorsDeclaring(/animation:\s*none\s*!important/).join('\n');
    for (const cls of ['holo-ring', 'pack-rays', 'player-avatar-idle', 'title-float-circle', 'pack-starfield-near']) {
      expect(stopped, `.reduce-motion does not stop .${cls}`).toContain(`.reduce-motion .${cls}`);
    }
  });

  it('hides the stadium-upgrade flash instead of freezing it as a solid block', () => {
    const hidden = selectorsDeclaring(/display:\s*none\s*!important/).join('\n');
    expect(hidden).toContain('.reduce-motion .stadium-upgrade-fill');
    expect(hidden).toContain('.reduce-motion .stadium-upgrade-ring');
  });

  it('gives the OS preference the same transition cut', () => {
    const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  [class*="animate-pulse"]'));
    const block = media.slice(0, media.indexOf('\n}\n'));
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
