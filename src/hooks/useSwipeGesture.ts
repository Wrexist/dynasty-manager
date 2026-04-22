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
