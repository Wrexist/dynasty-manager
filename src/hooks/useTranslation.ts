/**
 * Subscribe a component to the active locale.
 *
 * `t` is re-created on locale change so anything using it re-renders. Kept as a
 * hook rather than a context provider because there is no per-subtree locale —
 * the app has exactly one, and a provider would add a wrapper to every tree for
 * no gain.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { getLocale, subscribeToLocale, t as translate, type TranslationKey } from '@/i18n';

export function useTranslation() {
  const locale = useSyncExternalStore(subscribeToLocale, getLocale, getLocale);
  // `locale` IS a real dependency even though the body does not name it:
  // `translate` reads module-level state that `setLocale` swaps out, so the
  // function's OUTPUT changes with the locale while its source text does not.
  // exhaustive-deps can only see the source, hence "unnecessary dependency".
  // Dropping it would freeze `t`'s identity across a locale switch and leave
  // memoised children rendering the old language.
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(key, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );
  return { t, locale };
}
