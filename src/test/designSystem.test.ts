/**
 * Design-system guardrails.
 *
 * These tests exist because the audit's finding was not "the primitives are
 * bad" — they're genuinely good — but "roughly 60% of the app ignores them".
 * Discipline that isn't enforced decays back within a few PRs, so each block
 * below pins one invariant that was actually violated in the codebase.
 *
 * Scope note: assertions are deliberately scoped to the files this pass
 * cleaned. Widening a glob here is how the rest of the app gets brought in
 * line — a failure means "adopt the primitive", not "loosen the test".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatMoney } from '@/utils/helpers';
import { formatWage } from '@/utils/contracts';
import { getClubDisplayName } from '@/utils/uiHelpers';
import { getStatBarStyle, getStatBarColor } from '@/utils/uiHelpers';
import { PRESS, PRESS_CARD, FAST, BASE, SLOW } from '@/config/motion';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

/** Files brought onto the design system by the visual-craft pass. */
const CLEANED = [
  'src/pages/LeagueTable.tsx',
  'src/pages/CupPage.tsx',
  'src/pages/LeagueCupPage.tsx',
  'src/pages/TacticsPage.tsx',
  'src/pages/NationalTeamPage.tsx',
  'src/pages/BallonDor.tsx',
  'src/pages/TrophyCabinet.tsx',
  'src/pages/HallOfManagers.tsx',
  'src/pages/ClubPage.tsx',
  'src/pages/MatchPrep.tsx',
  'src/pages/MatchReview.tsx',
  'src/pages/JobMarket.tsx',
  'src/pages/ManagerCreation.tsx',
  'src/pages/DynastyLegacy.tsx',
  'src/pages/FinancePage.tsx',
  'src/pages/CompetitionsPage.tsx',
  'src/components/matchday/ScoreHeader.tsx',
  'src/components/game/StatBar.tsx',
  'src/components/game/FinanceBreakdownSheet.tsx',
];

describe('money formatting — one canonical formatter', () => {
  it('never renders a sub-£1000 value as £0K', () => {
    // The FinanceBreakdownSheet bug: every line was hardcoded to `K`, so a
    // £400 revenue line rendered as "£0K".
    expect(formatMoney(400)).toBe('£400');
    expect(formatMoney(999)).toBe('£999');
    expect(formatMoney(0)).toBe('£0');
  });

  it('switches to K at £1,000 and M at £1,000,000 — one magnitude policy', () => {
    expect(formatMoney(1_000)).toBe('£1K');
    expect(formatMoney(999_999)).toBe('£1000K');
    expect(formatMoney(1_000_000)).toBe('£1.0M');
    expect(formatMoney(1_200_000)).toBe('£1.2M');
  });

  it('does not show the same number at two magnitudes one tap apart', () => {
    // Dashboard showed +£1.2M; the sheet it opened showed +£1200K/week net.
    const net = 1_200_000;
    expect(formatMoney(net, { signed: true })).toBe('+£1.2M');
    expect(formatMoney(net)).toBe('£1.2M');
  });

  it('keeps the minus sign on losses — never Math.abs at a call site', () => {
    expect(formatMoney(-450_000)).toBe('-£450K');
    expect(formatMoney(-2_500_000)).toBe('-£2.5M');
    expect(formatMoney(-450_000, { signed: true })).toBe('-£450K');
  });

  it('only prefixes + for positives when explicitly asked', () => {
    expect(formatMoney(50_000)).toBe('£50K');
    expect(formatMoney(50_000, { signed: true })).toBe('+£50K');
    expect(formatMoney(0, { signed: true })).toBe('£0');
  });

  it('formatWage agrees with formatMoney on rounding', () => {
    // formatWage used to FLOOR while formatMoney ROUNDED, so a £42,900 wage
    // read £42K/wk on one screen and £43K on another.
    expect(formatWage(42_900)).toBe('£43K/wk');
    expect(formatMoney(42_900)).toBe('£43K');
    expect(formatWage(42_900).replace('/wk', '')).toBe(formatMoney(42_900));
  });

  it('formatWage handles every magnitude via the shared formatter', () => {
    expect(formatWage(800)).toBe('£800/wk');
    expect(formatWage(1_500_000)).toBe('£1.5M/wk');
  });

  it('survives non-finite input rather than rendering £NaN', () => {
    expect(formatMoney(Number.NaN)).toBe('£0');
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('£0');
  });

  it('no page re-implements a local money formatter', () => {
    for (const file of CLEANED) {
      const src = read(file);
      expect(
        /const formatMoney\s*=/.test(src),
        `${file} declares a local formatMoney, shadowing utils/helpers`,
      ).toBe(false);
    }
  });
});

describe('club display names — abbreviations a fan would say', () => {
  it('never returns a mid-word slice for a major club', () => {
    const cases: Record<string, string> = {
      'Tottenham Hotspur': 'Spurs',
      'Borussia Mönchengladbach': 'Gladbach',
      'Bayer 04 Leverkusen': 'Leverkusen',
      'Leicester City': 'Leicester',
      'AFC Bournemouth': 'Bournemouth',
      'Newcastle United': 'Newcastle',
      'Nottingham Forest': 'Forest',
      'Grasshopper Club Zürich': 'GC Zürich',
      'AS Saint-Étienne': 'St-Étienne',
    };
    for (const [full, expected] of Object.entries(cases)) {
      expect(getClubDisplayName(full), `${full} should abbreviate cleanly`).toBe(expected);
    }
  });

  it('keeps the abbreviations that already worked', () => {
    expect(getClubDisplayName('Paris Saint-Germain')).toBe('PSG');
    expect(getClubDisplayName('Manchester United')).toBe('Man Utd');
    expect(getClubDisplayName('Wolverhampton Wanderers')).toBe('Wolves');
  });

  it('ellipsizes rather than hard-slicing when it must truncate', () => {
    const out = getClubDisplayName('Verylongsinglewordclubname');
    expect(out.endsWith('…')).toBe(true);
  });

  it('handles empty / unknown input', () => {
    expect(getClubDisplayName('')).toBe('?');
    expect(getClubDisplayName('?')).toBe('?');
  });
});

describe('gold is gold on every screen', () => {
  it('exposes gold/silver/bronze as Tailwind tokens', () => {
    const cfg = read('tailwind.config.ts');
    // Assert the VAR is wired, not the exact literal — `gold` carries
    // light/deep siblings for gradients, so it is a nested token, and a future
    // shade addition shouldn't break this.
    expect(cfg).toMatch(/gold:\s*\{[^}]*hsl\(var\(--gold\)\)/s);
    expect(cfg).toContain('hsl(var(--gold-light))');
    expect(cfg).toContain('hsl(var(--gold-deep))');
    expect(cfg).toContain('silver: "hsl(var(--silver))"');
    expect(cfg).toContain('bronze: "hsl(var(--bronze))"');
  });

  it('no cleaned file hardcodes the gold hue as a literal', () => {
    // `.game-theme` flips --primary to emerald, so `text-primary` renders
    // GREEN in-game. Gold-tier UI must use the `gold` token; the old fix was
    // ~45 copies of hsl(43,96%,46%) pasted across three pages.
    for (const file of CLEANED) {
      const src = read(file);
      expect(/hsl\(\s*43[,\s]/.test(src), `${file} hardcodes the gold hue`).toBe(false);
    }
  });

  it('no cleaned file hardcodes silver/bronze medal hex', () => {
    for (const file of CLEANED) {
      const src = read(file);
      expect(src, `${file} hardcodes a medal hex`).not.toMatch(/#C0C0C0|#CD7F32/i);
    }
  });
});

describe('typography', () => {
  it('registers the seven-step type scale', () => {
    const cfg = read('tailwind.config.ts');
    for (const step of ['micro', 'caption', 'body', 'title', 'h3', 'h2', 'hero']) {
      expect(cfg).toContain(`${step}: [`);
    }
  });

  it('has no sub-11px type left in cleaned files', () => {
    // Tiny type is the loudest "hobbyist" signal an App Store reviewer picks
    // up. 11px (`text-micro`) is the floor.
    for (const file of CLEANED) {
      const hits = read(file).match(/text-\[(?:[0-9]|10)px\]/g) ?? [];
      expect(hits, `${file} still has sub-11px type: ${hits.join(', ')}`).toHaveLength(0);
    }
  });

  it('uses no font-mono — the app ships only Oswald and DM Sans', () => {
    // `font-mono` isn't registered in tailwind.config.ts, so it fell through
    // to SF Mono/Menlo — a third typeface, on scorelines of all places.
    const cfg = read('tailwind.config.ts');
    expect(cfg).not.toContain('mono:');
    for (const file of CLEANED) {
      expect(read(file), `${file} uses font-mono`).not.toContain('font-mono');
    }
  });
});

describe('motion tokens', () => {
  it('orders durations fast < base < slow', () => {
    expect(FAST).toBeLessThan(BASE);
    expect(BASE).toBeLessThan(SLOW);
  });

  it('presses cards more gently than buttons', () => {
    expect(PRESS).toBeLessThan(PRESS_CARD);
    expect(PRESS).toBeGreaterThan(0.9);
    expect(PRESS_CARD).toBeLessThan(1);
  });
});

describe('press feedback', () => {
  it('Button has a press transform, not colours only', () => {
    const src = read('src/components/ui/button.tsx');
    expect(src).toContain('active:scale-[0.97]');
    expect(src).toContain('motion-reduce:active:scale-100');
  });

  it('SubNav fires haptics before the active-tab early return', () => {
    // Re-tapping the current tab used to produce literally nothing.
    const src = read('src/components/game/SubNav.tsx');
    const haptic = src.indexOf('hapticLight();');
    const earlyReturn = src.indexOf('if (active) return;');
    expect(haptic).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(haptic).toBeLessThan(earlyReturn);
  });
});

describe('club crest — one rendering, not five', () => {
  it('cleaned match/club screens render ClubCrest, not a bare colour circle', () => {
    for (const file of [
      'src/pages/MatchPrep.tsx',
      'src/pages/MatchReview.tsx',
      'src/pages/ClubPage.tsx',
      'src/pages/CupPage.tsx',
      'src/pages/LeagueCupPage.tsx',
      'src/components/matchday/ScoreHeader.tsx',
    ]) {
      const src = read(file);
      expect(src, `${file} should use <ClubCrest>`).toContain('ClubCrest');
      // The specific anti-pattern: a CREST-SIZED (>= 24px, i.e. w-6+) rounded
      // div whose only content is a background colour — an anonymous dot
      // where a crest belongs. Deliberately excludes w-2/w-3 club-colour
      // dots, which are legitimate inline swatches next to a club name.
      expect(
        /className="w-(?:[6-9]|\d\d) h-(?:[6-9]|\d\d) rounded-(?:full|2xl)[^"]*"\s+style=\{\{ backgroundColor: \w+[.?]/.test(src),
        `${file} still renders an empty coloured circle`,
      ).toBe(false);
    }
  });

  it('carries the premium sphere treatment, not a flat fill', () => {
    const src = read('src/components/game/ClubCrest.tsx');
    expect(src).toContain('radial-gradient');
    expect(src).toContain('color-mix');
    expect(src).toContain('textShadow');
  });
});

describe('stat bars are single-sourced', () => {
  it('StatBar no longer duplicates the 80/60/40 boundaries', () => {
    const src = read('src/components/game/StatBar.tsx');
    expect(src).toContain('getStatBarStyle');
    expect(src).not.toContain('pct >= 80');
    expect(src).not.toContain('pct >= 60');
  });

  it('gradient tiers align with the config tier for the same value', () => {
    // Same value must land in the same tier for both the flat class helper
    // and the gradient helper — they had drifted (sky-600 vs sky-500).
    expect(getStatBarColor(85)).toBe('bg-emerald-500');
    expect(getStatBarColor(65)).toBe('bg-sky-500');
    expect(getStatBarColor(45)).toBe('bg-amber-500');
    expect(getStatBarColor(10)).toBe('bg-destructive');

    for (const pct of [0, 39, 40, 59, 60, 79, 80, 100]) {
      const style = getStatBarStyle(pct);
      expect(style.background, `no gradient for pct=${pct}`).toBeTruthy();
      expect(style.boxShadow, `no rim/glow for pct=${pct}`).toBeTruthy();
    }
  });
});

describe('layout stability', () => {
  it('the competition tab fallback reserves space instead of collapsing', () => {
    // League -> Cup used to collapse a 20-row table to a 64px spinner.
    const src = read('src/pages/CompetitionsPage.tsx');
    expect(src).toContain('min-h-[60vh]');
    expect(src).not.toContain('justify-center py-16');
  });

  it('the scoreline cannot slide sideways when a goal goes in', () => {
    const src = read('src/components/matchday/ScoreHeader.tsx');
    // Fixed-width digit cells pin the layout under AnimatePresence popLayout.
    expect(src).toContain('w-[1ch]');
  });

  it('the goal flash returns to --foreground, not a raw white', () => {
    const src = read('src/components/matchday/ScoreHeader.tsx');
    expect(src).toContain("color: 'hsl(var(--foreground))'");
    expect(src).not.toContain("hsl(0, 0%, 95%)");
  });

  it('the match clock is tabular so the header does not jitter each minute', () => {
    const src = read('src/components/matchday/ScoreHeader.tsx');
    const clockLine = src.split('\n').find(l => l.includes('{headerLabel}'));
    expect(clockLine).toBeDefined();
    expect(clockLine).toContain('tabular-nums');
  });
});

describe('elevation scale', () => {
  it('registers the shadow tokens seeded from GlassPanel', () => {
    const cfg = read('tailwind.config.ts');
    for (const token of [
      'rim:', '"elev-1"', '"elev-2"', '"elev-3"',
      'glass:', '"glass-danger"', '"glow-primary"', '"glow-gold"', 'sheet:',
    ]) {
      expect(cfg, `missing boxShadow token ${token}`).toContain(token);
    }
  });
});
