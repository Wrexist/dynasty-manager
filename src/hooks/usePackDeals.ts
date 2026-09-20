import { useEffect, useState } from 'react';
import { getStoreDeals } from '@/utils/packDeals';

export function usePackDeals() {
  const [deals, setDeals] = useState(getStoreDeals);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => setDeals(getStoreDeals());
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
