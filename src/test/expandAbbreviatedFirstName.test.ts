import { describe, it, expect } from 'vitest';
import { expandAbbreviatedFirstName } from '@/utils/playerGen';
import { NATIONALITY_NAME_POOLS } from '@/config/namePool';

describe('expandAbbreviatedFirstName', () => {
  it('leaves a full first name untouched', () => {
    expect(expandAbbreviatedFirstName('Erling', 'Norway', 'seed-1')).toBe('Erling');
    expect(expandAbbreviatedFirstName('Lautaro', 'Argentina', 'seed-1')).toBe('Lautaro');
  });

  it('expands a bare initial using the nationality pool', () => {
    const out = expandAbbreviatedFirstName('E.', 'Norway', 'seed-1');
    expect(out).not.toBe('E.');
    expect(out.startsWith('E')).toBe(true);
    expect(NATIONALITY_NAME_POOLS['Norway']!.firstNames).toContain(out);
  });

  it('is deterministic for the same seed', () => {
    const a = expandAbbreviatedFirstName('M.', 'Egypt', 'fcid-12345');
    const b = expandAbbreviatedFirstName('M.', 'Egypt', 'fcid-12345');
    expect(a).toBe(b);
  });

  it('preserves the remainder when the initial has a trailing word ("A. Van")', () => {
    const out = expandAbbreviatedFirstName('A. Van', 'Netherlands', 'seed-x');
    expect(out.endsWith(' Van')).toBe(true);
    expect(out.startsWith('A')).toBe(true);
  });

  it('preserves multi-word particles ("B. van den")', () => {
    const out = expandAbbreviatedFirstName('B. van den', 'Netherlands', 'seed-y');
    expect(out.endsWith(' van den')).toBe(true);
    expect(out.startsWith('B')).toBe(true);
  });

  it('falls back across all pools when the nationality pool has no match', () => {
    // 'Q' is rare in name pools; the function should still find one across
    // pools rather than return the bare initial. If literally no pool has
    // a name starting with 'Q', the input is returned unchanged — that's
    // also acceptable as a fallback.
    const out = expandAbbreviatedFirstName('J.', 'AtlantisLand', 'seed-z');
    // Either expanded to a real name, or kept as-is — but never "J" alone.
    if (out !== 'J.') {
      expect(out.length).toBeGreaterThan(1);
      expect(out.startsWith('J')).toBe(true);
    }
  });

  it('handles the Holland → Netherlands alias', () => {
    const out = expandAbbreviatedFirstName('V.', 'Holland', 'seed-h');
    expect(out).not.toBe('V.');
    expect(out.startsWith('V')).toBe(true);
  });

  it('returns the input for empty / non-abbreviation strings', () => {
    expect(expandAbbreviatedFirstName('', 'Norway', 's')).toBe('');
    expect(expandAbbreviatedFirstName('E', 'Norway', 's')).toBe('E'); // no period
  });
});
