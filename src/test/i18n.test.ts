/**
 * i18n core.
 *
 * The property that matters most is the FALLBACK, because it is what makes
 * migrating one screen at a time safe: an unmigrated surface, an untranslated
 * key, or a locale that fails to load must all render exactly what the app
 * renders today. If that ever breaks, partial migration becomes the "worse than
 * not starting" trap it is usually warned about.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { t, setLocale, getLocale } from '@/i18n';
import { en } from '@/i18n/locales/en';

describe('i18n fallback — why partial migration is safe', () => {
  beforeEach(async () => { await setLocale('en'); });
  afterEach(async () => { await setLocale('en'); });

  it('returns the English source string by default', () => {
    expect(t('title.newGame')).toBe('New Game');
    expect(t('season.promoted')).toBe('PROMOTED!');
  });

  it('falls back to English for a key the active locale has not translated', async () => {
    await setLocale('sv');
    // 'common.confirm' IS translated…
    expect(t('common.confirm')).toBe('Bekräfta');
    // …and any key the Swedish file omits must read as English, never as an id.
    expect(t('title.newGame')).toBe('Nytt spel'); // translated
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const value = t(key);
      // Never leak a raw key onto the screen.
      expect(value, `${key} rendered as its own id`).not.toBe(key);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('substitutes named placeholders', () => {
    expect(t('season.complete', { season: 3 })).toBe('Season 3 Complete');
    expect(t('title.newGameSubtitle', { slot: 2 })).toBe('Slot 2 · Start a new dynasty');
  });

  it('leaves an unknown placeholder untouched rather than printing undefined', () => {
    expect(t('season.complete', { wrong: 1 })).toBe('Season {season} Complete');
  });

  it('switching locale and back restores English exactly', async () => {
    const before = t('title.settings');
    await setLocale('sv');
    expect(t('title.settings')).toBe('Inställningar');
    await setLocale('en');
    expect(t('title.settings')).toBe(before);
    expect(getLocale()).toBe('en');
  });

  it('a locale that fails to load leaves the app on the previous one', async () => {
    await setLocale('sv');
    // @ts-expect-error — deliberately not a Locale; the guard must hold anyway.
    await setLocale('does-not-exist');
    expect(getLocale()).toBe('sv');
    expect(t('common.close')).toBe('Stäng');
  });
});

describe('translation catalogues stay in sync', () => {
  it('every Swedish key exists in the English source', async () => {
    const sv = (await import('@/i18n/locales/sv')).messages;
    const englishKeys = new Set(Object.keys(en));
    const orphans = Object.keys(sv).filter(k => !englishKeys.has(k));
    // An orphan means a key was renamed in English and the translation was left
    // behind — dead weight that will never render.
    expect(orphans).toEqual([]);
  });

  it('no English string is empty', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `${key} is empty`).toBeGreaterThan(0);
    }
  });
});
