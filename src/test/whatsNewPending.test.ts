import { describe, it, expect } from 'vitest';
import { PENDING_NEWS, PENDING_CATEGORIES, type PendingRelease } from '@/data/pendingNews';
import * as io from '../../scripts/lib/whatsNewIO.mjs';

/** Render PENDING_NEWS to source, parse it back, and assert round-trip equality.
 *  Catches regressions in the regex-based parser without needing a full seal. */
describe('pendingNews shape', () => {
  it('exposes the documented PendingRelease shape', () => {
    expect(Array.isArray(PENDING_NEWS.highlights)).toBe(true);
    expect(Array.isArray(PENDING_NEWS.new)).toBe(true);
    expect(Array.isArray(PENDING_NEWS.improved)).toBe(true);
    expect(Array.isArray(PENDING_NEWS.fixed)).toBe(true);
    for (const cat of PENDING_CATEGORIES) {
      for (const bullet of PENDING_NEWS[cat]) expect(typeof bullet).toBe('string');
    }
    expect(PENDING_NEWS.headline === null || typeof PENDING_NEWS.headline === 'string').toBe(true);
    expect(PENDING_NEWS.summary === null || typeof PENDING_NEWS.summary === 'string').toBe(true);
  });

  it('lists the four release categories in the canonical order', () => {
    expect(PENDING_CATEGORIES).toEqual(['highlights', 'new', 'improved', 'fixed']);
  });
});

describe('whatsNewIO helpers', () => {
  it('round-trips a pending object through render → parse', () => {
    const fields: PendingRelease = {
      highlights: ['Marquee feature.'],
      new: ['Added thing one.', "Added thing two — with a quote: 'wow'."],
      improved: [],
      fixed: ['Fixed a crash on boot.'],
      headline: 'Big release.',
      summary: 'A short summary that is longer than twenty characters.',
    };
    const wrapped =
      "export const PENDING_NEWS: PendingRelease = " +
      io.renderPendingObject(fields, { indent: '' }) +
      ';\n';
    const parsed = io.parsePendingNews(wrapped).fields;
    expect(parsed).toEqual(fields);
  });

  it('renders null overrides as the literal `null` (not an empty string)', () => {
    const fields: PendingRelease = {
      highlights: [],
      new: [],
      improved: [],
      fixed: [],
      headline: null,
      summary: null,
    };
    const out = io.renderPendingObject(fields, { indent: '' });
    expect(out).toMatch(/headline:\s*null/);
    expect(out).toMatch(/summary:\s*null/);
  });

  it('normalises bullets — capitalises and adds a period', () => {
    expect(io.normaliseBullet('fixed crash on boot')).toBe('Fixed crash on boot.');
    expect(io.normaliseBullet('Already good.')).toBe('Already good.');
    expect(io.normaliseBullet('  trim me  ')).toBe('Trim me.');
    expect(io.normaliseBullet('')).toBe('');
  });

  it('strips conventional-commit prefixes from PR titles', () => {
    expect(io.normaliseTitle('feat: add training slider')).toBe('add training slider');
    expect(io.normaliseTitle('fix(match): late-game crash')).toBe('late-game crash');
    expect(io.normaliseTitle('chore: bump deps')).toBe('bump deps');
    expect(io.normaliseTitle('Plain title')).toBe('Plain title');
  });

  it('auto-headline picks from highest-priority non-empty category', () => {
    expect(io.buildAutoHeadline({ highlights: ['H one.'], new: ['N one.'], improved: [], fixed: [] })).toBe('H one.');
    expect(io.buildAutoHeadline({ highlights: [], new: ['N one.'], improved: ['I one.'], fixed: [] })).toBe('N one.');
    expect(io.buildAutoHeadline({ highlights: [], new: [], improved: [], fixed: ['F one.'] })).toBe('F one.');
    expect(io.buildAutoHeadline({ highlights: [], new: [], improved: [], fixed: [] })).toBe('Stability and polish update.');
  });

  it('auto-summary always returns a string at least 20 chars long', () => {
    expect(io.buildAutoSummary({ highlights: [], new: [], improved: [], fixed: [] }).length).toBeGreaterThanOrEqual(20);
    expect(io.buildAutoSummary({ highlights: [], new: ['N one.'], improved: ['I one.'], fixed: [] }).length).toBeGreaterThanOrEqual(20);
    const summary = io.buildAutoSummary({
      highlights: ['Lead bullet number one is here.'],
      new: ['Second lead bullet.'],
      improved: ['One.', 'Two.'],
      fixed: ['Crash fix.'],
    });
    expect(summary).toContain('Lead bullet number one');
    expect(summary).toContain('Plus');
  });
});
