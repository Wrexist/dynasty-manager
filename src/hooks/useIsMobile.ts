import { useEffect, useState } from 'react';

/**
 * Reactive mobile breakpoint hook. Listens to `matchMedia` changes so
 * components re-render when the user resizes their browser or rotates
 * their device — unlike reading `window.innerWidth` during render, which
 * produces a stale one-shot value.
 *
 * Default breakpoint: 430px (matches existing hardcoded checks in MatchDay
 * for iPhone 14 Pro Max width). Callers can override.
 *
 * SSR-safe: returns `false` when `window.matchMedia` is undefined.
 */
export function useIsMobile(maxWidthPx = 430): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // addEventListener is standard since Safari 14; addListener fallback covers older browsers.
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [maxWidthPx]);

  return isMobile;
}
