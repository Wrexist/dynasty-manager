import { useEffect, useState } from 'react';
import { getActiveDeals } from '@/utils/packDeals';

export function usePackDeals() {
  const [deals, setDeals] = useState(getActiveDeals);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => setDeals(getActiveDeals());
    const resume = () => {
      clearInterval(timer);
      if (!document.hidden) {
        refresh();
        timer = setInterval(refresh, 1000);
      }
    };
    resume();
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, []);
  return deals;
}
