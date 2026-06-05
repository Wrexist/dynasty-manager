import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Render a long list in growing chunks instead of all at once.
 *
 * The Transfer market / free-agent lists can hold hundreds of rows, each a
 * heavy image-backed card. Mounting them all in one pass tanks first paint and
 * scroll. This hook renders an initial slice and reveals more as a sentinel
 * element scrolls into view (via IntersectionObserver) — keeping the DOM small
 * and scrolling smooth without pulling in a virtualization dependency.
 *
 * The visible count resets to `initial` whenever the source `items` array
 * identity changes (e.g. the user changes a filter/sort), which is exactly the
 * "jump back to the top with a fresh list" behaviour we want.
 *
 * Usage:
 *   const { visible, sentinelRef, hasMore } = useIncrementalReveal(rows);
 *   {visible.map(...)}
 *   {hasMore && <div ref={sentinelRef} aria-hidden />}
 */
export function useIncrementalReveal<T>(items: T[], initial = 24, step = 18) {
  const [count, setCount] = useState(initial);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when the source list changes (filter / sort / tab switch).
  useEffect(() => { setCount(initial); }, [items, initial]);

  const hasMore = count < items.length;

  // Reveal more when the sentinel nears the viewport. We re-attach the observer
  // when `count` changes so that, if the sentinel is still on-screen after a
  // batch loads, it triggers again (IntersectionObserver only fires on
  // transitions, so a fresh observe() is needed to chain-load until full).
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // No observer (SSR/old engine): fall back to revealing everything.
      setCount(items.length);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(c + step, items.length));
        }
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, step, items.length, count]);

  const visible = useMemo(() => items.slice(0, count), [items, count]);

  return { visible, sentinelRef, hasMore };
}
