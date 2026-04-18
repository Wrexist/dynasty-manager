import { useEffect, useState } from 'react';

/**
 * R3F `frameloop` prop that pauses the render loop when the page is hidden
 * (tab switched, PWA backgrounded, window minimised). R3F supports
 * `'always' | 'demand' | 'never'`; switching to `'never'` stops the RAF loop
 * entirely, cutting GPU / battery draw to zero. Resumes on visibilitychange.
 *
 * Use as:
 *   <Canvas frameloop={useVisibilityFrameloop()} ... />
 *
 * Safe in SSR / jsdom — falls back to `'always'` when `document` is undefined.
 */
export function useVisibilityFrameloop(): 'always' | 'never' {
  const [hidden, setHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return hidden ? 'never' : 'always';
}
