import { useEffect, useState } from 'react';

/**
 * Reveal a string character-by-character. Returns the currently-visible
 * substring. Used by WalkoutReveal to type the player's name dramatically
 * after their silhouette rises.
 */
export function useTypewriter(text: string, perCharMs: number, active: boolean): string {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!active) {
      setShown('');
      return;
    }
    setShown('');
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setShown(text.slice(0, i));
      if (i < text.length) {
        window.setTimeout(tick, perCharMs);
      }
    };
    const startId = window.setTimeout(tick, perCharMs);
    return () => {
      cancelled = true;
      window.clearTimeout(startId);
    };
  }, [text, perCharMs, active]);

  return shown;
}
