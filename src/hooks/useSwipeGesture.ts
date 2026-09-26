import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxVerticalDeviation?: number;
  maxDuration?: number;
  /**
   * Ignore swipes that start within this many px of either screen edge.
   * iOS reserves the leftmost ~20px for the back-swipe gesture, so an in-app
   * right-swipe that starts at x≈0 collides with the OS gesture and the user
   * sees neither action fire reliably. Default 24 keeps us clear of the OS
   * hit zone on both edges.
   */
  edgeIgnore?: number;
}

/**
 * Touch targets that own their own horizontal gesture. A swipe that STARTS on
 * one of these is the control's, never a screen switch: dragging a bid slider
 * used to jump to Scouting and throw the negotiation away.
 */
const SWIPE_EXEMPT_SELECTOR = [
  'input[type="range"]',
  '[role="slider"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
  '[data-radix-popper-content-wrapper]',
  '[data-no-swipe]',
].join(',');

/**
 * True when a touch that started on `target` must not become a screen swipe.
 *
 * Walks from the target up to (not including) `boundary` — the element the
 * handlers are attached to. A target OUTSIDE the boundary reached it through a
 * React portal (Radix sheets, dialogs, popovers render into <body> but their
 * events bubble through the React tree), so it is an overlay by definition.
 * `position: fixed` ancestors are in-page overlays and pinned bars — the
 * negotiation modals are fixed full-screen layers inside <main>.
 */
export function isSwipeExemptTarget(target: EventTarget | null, boundary?: Element | null): boolean {
  if (!target || typeof Element === 'undefined' || !(target instanceof Element)) return false;
  if (boundary && !boundary.contains(target)) return true;
  for (let el: Element | null = target; el && el !== boundary; el = el.parentElement) {
    if (el.matches(SWIPE_EXEMPT_SELECTOR)) return true;
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed') return true;
    // A row that scrolls sideways (club carousels, stat strips, chip rows).
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true;
    }
  }
  return false;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVerticalDeviation = 40,
  maxDuration = 400,
  edgeIgnore = 24,
}: UseSwipeOptions): SwipeHandlers {
  const touchRef = useRef<
    { startX: number; startY: number; startTime: number; fromEdge: boolean } | null
  >(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // A slider, a sideways-scrolling row or an overlay owns this touch.
    if (isSwipeExemptTarget(e.target, e.currentTarget as Element)) {
      touchRef.current = null;
      return;
    }
    const touch = e.touches[0];
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const fromEdge =
      touch.clientX <= edgeIgnore ||
      (viewportWidth > 0 && touch.clientX >= viewportWidth - edgeIgnore);
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      fromEdge,
    };
  }, [edgeIgnore]);

  const onTouchMove = useCallback((_e: React.TouchEvent) => {
    // Intentionally empty — we only need start and end
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;

    const { startX, startY, startTime, fromEdge } = touchRef.current;
    touchRef.current = null;

    // Yield to the OS back/forward gesture when the swipe started in the edge
    // hot zone — competing here would cancel the system animation.
    if (fromEdge) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);
    const duration = Date.now() - startTime;

    if (duration > maxDuration || deltaY > maxVerticalDeviation || Math.abs(deltaX) < threshold) {
      return;
    }

    if (deltaX < 0) {
      onSwipeLeft?.();
    } else {
      onSwipeRight?.();
    }
  }, [onSwipeLeft, onSwipeRight, threshold, maxVerticalDeviation, maxDuration]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
