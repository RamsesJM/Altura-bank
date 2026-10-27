import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'] as const;
const TICK_MS = 1_000;
const ACTIVITY_THROTTLE_MS = 1_000;

interface SessionTimeoutOptions {
  timeoutMs: number;
  warningMs: number;
  onExpire: () => void;
  onActivity?: () => void;
  expiresAt?: number;
  enabled?: boolean;
}

interface SessionTimeoutState {
  remainingMs: number;
  isWarning: boolean;
  reset: () => void;
}

export function useSessionTimeout({
  timeoutMs,
  warningMs,
  onExpire,
  onActivity,
  expiresAt,
  enabled = true,
}: SessionTimeoutOptions): SessionTimeoutState {
  const [deadline, setDeadline] = useState(() => Date.now() + timeoutMs);
  const [now, setNow] = useState(() => Date.now());

  const effectiveDeadline = expiresAt === undefined ? deadline : Math.min(deadline, expiresAt);
  const remainingMs = Math.max(0, effectiveDeadline - now);
  const isWarning = enabled && remainingMs <= warningMs;

  const isWarningRef = useRef(isWarning);
  const onExpireRef = useRef(onExpire);
  const onActivityRef = useRef(onActivity);
  const expiredRef = useRef(false);

  useEffect(() => {
    isWarningRef.current = isWarning;
    onExpireRef.current = onExpire;
    onActivityRef.current = onActivity;
  });

  const reset = useCallback(() => {
    const current = Date.now();
    expiredRef.current = false;
    setDeadline(current + timeoutMs);
    setNow(current);
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let lastActivity = Number.NEGATIVE_INFINITY;

    function handleActivity() {
      if (isWarningRef.current) return;

      const current = Date.now();
      if (current - lastActivity < ACTIVITY_THROTTLE_MS) return;

      lastActivity = current;
      setDeadline(current + timeoutMs);
      setNow(current);
      onActivityRef.current?.();
    }

    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, handleActivity, { passive: true }),
    );
    return () => {
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, handleActivity));
    };
  }, [enabled, timeoutMs]);

  useEffect(() => {
    if (enabled && remainingMs === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, [enabled, remainingMs]);

  return { remainingMs, isWarning, reset };
}
