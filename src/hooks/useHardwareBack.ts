import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { resolveHardwareBack } from '@/utils/backNavigation';

/**
 * Anything that is currently a modal layer: Radix dialogs/sheets, the in-page
 * role="dialog" overlays, and the hand-rolled `fixed inset-0` layers that
 * carry no role (TransferApproach, Match Prep's confirm, the Packs overlay).
 * A layer with `pointer-events: none` is decoration, not a modal.
 */
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .fixed.inset-0';

export function hasOpenOverlay(doc: Document = document): boolean {
  return Array.from(doc.querySelectorAll(OVERLAY_SELECTOR)).some(
    el => window.getComputedStyle(el).pointerEvents !== 'none',
  );
}

/** Ask the top overlay to close the way a keyboard user would. Radix layers and
 *  `useEscapeClose` both listen on the document; an overlay with no Escape
 *  handling simply stays open — never navigated out from under. */
export function dismissTopOverlay(doc: Document = document): void {
  const target = doc.activeElement ?? doc.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

interface HardwareBackOptions {
  matchLocked: boolean;
  /** Current screen is a bottom-nav tab — nowhere further back in the game. */
  onTab: boolean;
  onBack: () => void;
}

/**
 * Android hardware back inside the game shell. Registering a `backButton`
 * listener disables Capacitor's default (WebView history back, or exit at the
 * root), so this hook is mounted only by GameShell: outside /game the listener
 * is removed and Android's default behaviour returns. iOS never fires it.
 */
export function useHardwareBack(options: HardwareBackOptions): void {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let cancelled = false;
    let remove: (() => void) | null = null;
    import('@capacitor/app')
      .then(({ App }) => App.addListener('backButton', () => {
        const { matchLocked, onTab, onBack } = latest.current;
        const action = resolveHardwareBack({ overlayOpen: hasOpenOverlay(), matchLocked, onTab });
        if (action === 'dismiss-overlay') dismissTopOverlay();
        else if (action === 'back') onBack();
        // Background, don't kill: the game keeps its in-memory state and the
        // 'pause' listener in main.tsx flushes the save.
        else if (action === 'minimize') void App.minimizeApp();
      }))
      .then(handle => {
        if (cancelled) void handle.remove();
        else remove = () => { void handle.remove(); };
      })
      .catch(() => { /* plugin unavailable — Android keeps its default back */ });
    return () => { cancelled = true; remove?.(); };
  }, []);
}
