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
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVerticalDeviation = 40,
  maxDuration = 400,
}: UseSwipeOptions): SwipeHandlers {
  const touchRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchMove = useCallback((_e: React.TouchEvent) => {
    // Intentionally empty — we only need start and end
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = Math.abs(touch.clientY - touchRef.current.startY);
    const duration = Date.now() - touchRef.current.startTime;

    touchRef.current = null;

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
