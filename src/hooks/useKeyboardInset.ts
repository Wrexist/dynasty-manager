import { useEffect, useState } from 'react';

/**
 * Returns the height (in CSS px) of the on-screen keyboard, or 0 when no
 * keyboard is visible.
 *
 * Powered by the Visual Viewport API, which is supported on iOS Safari /
 * Capacitor WKWebView and reflects the visible area not occluded by the
 * software keyboard. Subtracting `visualViewport.height` from
 * `window.innerHeight` yields the keyboard's height.
 *
 * Why we need this: `capacitor.config.ts` sets `Keyboard.resize: 'body'`,
 * which resizes the body element but does NOT shrink the layout viewport
 * — so a `position: fixed; bottom: 0` element (e.g. shadcn `Sheet` with
 * `side="bottom"`) stays anchored to the bottom of the screen and gets
 * fully covered by the keyboard. We use this hook to apply
 * `paddingBottom: kbOffset` to the sheet so its inner content (textarea,
 * Send button) rises above the keyboard while typing.
 *
 * Safe on web/SSR: returns 0 if `window.visualViewport` is undefined.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // window.innerHeight - vv.height = keyboard height (clamped to 0).
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(prev => (prev === next ? prev : next));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
