import { useEffect, useState } from 'react';

/**
 * Reveal a string character-by-character. Returns the currently-visible
 * substring. Used by WalkoutReveal to type the player's name dramatically
 * after their silhouette rises.
 *
 * Driven by requestAnimationFrame so character advances coalesce with the
 * browser paint cycle and can't stack behind other work during a busy
 * walkout beat. When `reducedMotion` is set, jumps straight to full text.
 */
export function useTypewriter(text: string, perCharMs: number, active: boolean, reducedMotion = false): string {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!active) {
      setShown('');
      return;
    }
    if (reducedMotion) {
      setShown(text);
      return;
    }
    setShown('');
    let raf = 0;
    let last = performance.now();
    let i = 0;
    const tick = (now: number) => {
      if (now - last >= perCharMs) {
        i += 1;
        setShown(text.slice(0, i));
        last = now;
      }
      if (i < text.length) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, perCharMs, active, reducedMotion]);

  return shown;
}
