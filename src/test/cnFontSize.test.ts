/**
 * Regression guard for the custom `text-<scale>` font sizes.
 *
 * `tailwind-merge` only knows Tailwind's stock size scale. Any other `text-*`
 * class is filed as a text COLOUR, so before `src/lib/utils.ts` configured the
 * merger, `cn('text-h3', 'text-foreground')` returned `'text-foreground'` and
 * the size was silently deleted. That broke the title of every screen in the
 * app (`SectionHeader` does `cn(LEVEL_STYLES[level], 'truncate')`).
 *
 * These tests pin the fixed behaviour so the bug cannot return.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cn, CUSTOM_FONT_SIZES } from '@/lib/utils';

describe('cn() and the custom font-size scale', () => {
  it('keeps the size when a colour is merged in', () => {
    expect(cn('text-h3', 'text-foreground')).toContain('text-h3');
    expect(cn('text-h3', 'text-foreground')).toContain('text-foreground');
  });

  it('keeps the size when a size+colour string meets an unrelated class', () => {
    const out = cn('text-caption text-muted-foreground', 'truncate');
    expect(out).toContain('text-caption');
    expect(out).toContain('text-muted-foreground');
    expect(out).toContain('truncate');
  });

  it('still lets a later size override an earlier one', () => {
    expect(cn('text-body', 'text-h3')).toBe('text-h3');
    expect(cn('text-h3', 'text-body')).toBe('text-body');
  });

  it('interoperates with the stock Tailwind scale in both directions', () => {
    expect(cn('text-sm', 'text-h3')).toBe('text-h3');
    expect(cn('text-h3', 'text-sm')).toBe('text-sm');
    expect(cn('text-h2', 'text-[13px]')).toBe('text-[13px]');
  });

  it('does not confuse a colour that merely looks like a scale name', () => {
    // `text-gold` is a real colour in tailwind.config.ts and must NOT be
    // treated as a size — it has to survive alongside one.
    const out = cn('text-h2 text-gold');
    expect(out).toContain('text-h2');
    expect(out).toContain('text-gold');
  });

  it('survives responsive/state prefixes', () => {
    const out = cn('text-body sm:text-h3 text-foreground');
    expect(out).toContain('text-body');
    expect(out).toContain('sm:text-h3');
    expect(out).toContain('text-foreground');
  });

  it('every custom size round-trips against a colour', () => {
    for (const size of CUSTOM_FONT_SIZES) {
      expect(cn(`text-${size}`, 'text-muted-foreground')).toContain(`text-${size}`);
    }
  });

  it('CUSTOM_FONT_SIZES matches theme.extend.fontSize in tailwind.config.ts', () => {
    const config = fs.readFileSync(
      path.resolve(process.cwd(), 'tailwind.config.ts'),
      'utf8',
    );
    const block = config.match(/fontSize:\s*\{([\s\S]*?)\n\s{6}\},/);
    expect(block, 'could not locate fontSize block in tailwind.config.ts').toBeTruthy();
    const keys = [...block![1].matchAll(/^\s*([A-Za-z0-9_-]+):\s*\[/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect([...keys].sort()).toEqual([...CUSTOM_FONT_SIZES].sort());
  });
});
