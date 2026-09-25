import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Start every route at the top of the page.
 *
 * The router swaps pages inside one document, so the window kept the scroll
 * offset of the page you left. Mode Select is scrolled to reach its lower
 * cards (World Cup, Sunday League on a small phone); the setup page they open
 * then arrived scrolled down with its back button above the fold
 * (playthrough 2026-09, World Cup setup at 390x844).
 */
export function RouteScrollReset() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
