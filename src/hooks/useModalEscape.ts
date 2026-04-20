import { useEffect } from 'react';

/** Close a modal when the user presses Escape.
 *
 *  The listener is only registered while `open` is true and is torn down on
 *  close or unmount, so Escape only closes the top-most modal that enabled
 *  the hook on its most recent render.
 *
 *  Pass `enabled=false` to phase-gate the close (e.g. don't dismiss during an
 *  in-flight negotiation animation) — mirrors the existing
 *  `onClick={phase==='negotiate' ? onClose : undefined}` pattern on the
 *  backdrop `<div>` so click and Escape behave identically. */
export function useModalEscape(open: boolean, onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!open || !enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, enabled, onClose]);
}
