import { useEffect, useState } from 'react';

export function useCountdown(targetTime: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetTime === null) return;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return targetTime === null ? 0 : Math.max(0, targetTime - now);
}
