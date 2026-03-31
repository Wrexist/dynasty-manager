import { useEffect, useRef, useState } from 'react';
import { FLASH_DURATION_MS } from '@/config/ui';

/**
 * Returns a CSS class that briefly highlights when the watched value changes.
 * Uses a gold glow that fades out over FLASH_DURATION_MS.
 * Skips the first value change to avoid false flashes on deferred mount.
 */
export function useFlash(value: number | string): string {
  const prevRef = useRef(value);
  const initialRef = useRef(true);
  const [flashing, setFlashing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      // Skip the very first change (e.g. 0 → real value on deferred mount)
      if (initialRef.current) {
        initialRef.current = false;
        return;
      }
      setFlashing(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [value]);

  return flashing ? 'flash-highlight' : '';
}
