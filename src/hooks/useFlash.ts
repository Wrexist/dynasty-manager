import { useEffect, useRef, useState } from 'react';

/**
 * Returns a CSS class that briefly highlights when the watched value changes.
 * Uses a gold glow that fades out over 600ms.
 */
export function useFlash(value: number | string): string {
  const prevRef = useRef(value);
  const [flashing, setFlashing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlashing(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setFlashing(false), 600);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [value]);

  return flashing ? 'flash-highlight' : '';
}
