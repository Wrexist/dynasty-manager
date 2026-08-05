/**
 * Minimal i18n — no dependency, no build step, safe to adopt one screen at a time.
 *
 * WHY HAND-ROLLED. The project forbids adding npm dependencies without
 * discussing the tradeoff, and the eager bundle is budgeted. A library would buy
 * plurals, interpolation grammar and ICU messages; this app needs lookup and
 * `{placeholder}` substitution. The whole core is under 40 lines, so the
 * dependency was not worth opening.
 *
 * WHY PARTIAL MIGRATION IS SAFE. English is the source of truth and is ALWAYS
 * loaded, so `t()` on an unmigrated or untranslated key returns the English
 * string exactly as a literal would have. A screen that has not been migrated
 * behaves identically to today, and a locale that is missing a key falls back to
 * English rather than showing an id. That is what makes it sane to do this in
 * increments instead of one 490-file change.
 *
 * WHAT DOES NOT BELONG HERE. The match engine, `src/config/`, save data and
 * anything that produces stored strings stay English — they are game data and
 * logic, not presentation. Translate what the player reads on screen.
 */
import { en } from './locales/en';

export type Locale = 'en' | 'sv';
export type TranslationKey = keyof typeof en;

/** Every locale is a partial of English: missing keys fall through, never break. */
export type LocaleMessages = Partial<Record<TranslationKey, string>>;

let currentLocale: Locale = 'en';
let overlay: LocaleMessages = {};

/** Subscribers re-render when the locale changes. */
const listeners = new Set<() => void>();

/** Locales other than English are lazy — only the active one is ever fetched. */
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ messages: LocaleMessages }>> = {
  sv: () => import('./locales/sv'),
};

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Switch locale, fetching its messages if needed.
 *
 * Failure is deliberately non-fatal: a locale chunk that will not load leaves
 * the app on English rather than on a screen of raw keys.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (locale === currentLocale) return;
  if (locale === 'en') {
    currentLocale = 'en';
    overlay = {};
  } else {
    try {
      const mod = await loaders[locale]();
      currentLocale = locale;
      overlay = mod.messages;
    } catch {
      return; // stay on the current locale
    }
  }
  listeners.forEach(fn => fn());
}

export function subscribeToLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Look up `key`, substituting `{name}` placeholders.
 *
 * Resolution order is overlay → English → the key itself. The last step should
 * never be reached for a key that exists in `en`, and exists only so a typo
 * degrades to something readable rather than throwing.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const template = overlay[key] ?? en[key] ?? String(key);
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole);
}
