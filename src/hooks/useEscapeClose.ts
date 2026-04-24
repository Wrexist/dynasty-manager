import { useEffect } from 'react';

/**
 * Register a document-level keydown listener that calls `onClose` when the
 * user presses Escape. No-op when `active` is false — lets callers gate on
 * their modal's mount state without conditional hook calls.
 *
 * Matches browser conventions for dismissing dialogs: a single global
 * listener bound to the document so we pick up the key even when focus has
 * drifted to a nested control inside the modal.
 */
export function useEscapeClose(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, active]);
}
