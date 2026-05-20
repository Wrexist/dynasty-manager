import { useEffect, useRef, type RefObject } from 'react';

/**
 * Trap keyboard focus inside a modal container.
 *
 * When `active` flips to true, focus moves into the container (the first
 * focusable element by default, or the `initialFocus` ref if provided),
 * and the previously-focused element is remembered. Tab / Shift+Tab cycle
 * focus within the container — Tab on the last focusable wraps to the
 * first, Shift+Tab on the first wraps to the last. When `active` flips
 * back to false (modal closes), focus restores to whatever had it before.
 *
 * Pairs with `useEscapeClose` for full keyboard a11y on motion-based
 * modals that don't go through Radix Dialog.
 *
 * Why this matters:
 *   - Without a trap, Tab from inside the modal jumps focus to elements
 *     in the dimmed-out background, which screen-reader users perceive as
 *     "the modal moved" and sighted keyboard users can't see at all.
 *   - Without initial focus, screen readers announce whatever element was
 *     focused before — usually a stale button behind the backdrop — when
 *     the modal opens.
 *   - Without restoration, closing the modal drops focus to the document
 *     body, forcing keyboard users to retab from the start of the page.
 *
 * NOT meant to be airtight against malicious focus stealing — just to
 * keep the common case (keyboard nav, VoiceOver swipe-nav) inside the
 * modal so the user can actually use it.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function isVisible(el: HTMLElement): boolean {
  // jsdom doesn't do layout, so both offsetParent and getClientRects come
  // back zero/null for every element. Use a style-only fallback in that
  // case — same intent (skip display:none / visibility:hidden) but
  // doesn't require layout to be computed.
  if (typeof el.offsetParent !== 'undefined' && el.offsetParent !== null) return true;
  if (el.getClientRects().length > 0) return true;
  // Layout-less fallback (jsdom + happy-dom): walk up the tree checking
  // the inline-style display/visibility props. We accept this isn't as
  // robust as a real layout check, but it's enough to keep the trap
  // working in unit tests.
  let cur: HTMLElement | null = el;
  while (cur) {
    const style = cur.style;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    cur = cur.parentElement;
  }
  return true;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return isVisible(el);
  });
}

interface UseFocusTrapOptions {
  /**
   * Optional explicit initial-focus target. If null/omitted, focus goes to
   * the first focusable element inside the container. Set this to a CTA's
   * ref when "primary action" focus matters (e.g. Continue button on
   * PostMatchPopup).
   */
  initialFocus?: RefObject<HTMLElement | null>;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus } = options;
  // Hold the element that had focus before the trap activated so we can
  // restore it on close. Using a ref so the cleanup callback captures
  // the live value, not a stale closure copy.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    // Move focus into the modal. Wait one frame so Framer Motion's
    // initial mount animations don't reset focus right after we set it.
    const focusTimer = requestAnimationFrame(() => {
      const explicit = initialFocus?.current;
      if (explicit) {
        explicit.focus();
        return;
      }
      const focusables = getFocusable(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        // No focusable child — fall back to focusing the container itself
        // so screen readers announce the modal's accessible name. Requires
        // tabIndex=-1 on the container (callers must set this).
        container.focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      // Tab on last → wrap to first. Shift+Tab on first → wrap to last.
      // We also catch the case where focus has somehow escaped the
      // container entirely (e.g. the user clicked outside, then tabbed)
      // and pull it back in.
      const inContainer = activeEl && container.contains(activeEl);
      if (!inContainer) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus on close. Guard against the previously-focused
      // element having been removed from the DOM while the modal was up
      // (e.g. a navigation under the backdrop) — calling .focus() on a
      // detached node is a silent no-op, but the contains() check makes
      // the intent explicit and avoids a console-noisy `.focus is not a
      // function` if previouslyFocusedRef somehow holds a non-HTMLElement.
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [active, containerRef, initialFocus]);
}
