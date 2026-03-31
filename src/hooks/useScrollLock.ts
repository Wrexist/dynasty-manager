import { useEffect } from 'react';

/** Lock body scroll when a modal/overlay is active. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;

    const body = document.body;
    const lockCount = Number(body.dataset.scrollLockCount || '0');

    if (lockCount === 0) {
      body.dataset.scrollLockPrevOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
    }

    body.dataset.scrollLockCount = String(lockCount + 1);

    return () => {
      const currentCount = Number(body.dataset.scrollLockCount || '0');
      const nextCount = Math.max(0, currentCount - 1);

      if (nextCount === 0) {
        body.style.overflow = body.dataset.scrollLockPrevOverflow || '';
        delete body.dataset.scrollLockPrevOverflow;
        delete body.dataset.scrollLockCount;
        return;
      }

      body.dataset.scrollLockCount = String(nextCount);
    };
  }, [active]);
}
