import { useEffect, useRef, useState } from 'react';
import { FLASH_DURATION_MS } from '@/config/ui';

/**
 * Returns a CSS class that briefly highlights when the watched value changes.
 * Uses a gold glow that fades out over FLASH_DURATION_MS.
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
      timeoutRef.current = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [value]);

  return flashing ? 'flash-highlight' : '';
}
