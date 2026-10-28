import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown'] as const;
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
  const deadlineRef = useRef(deadline);
  const expiresAtRef = useRef(expiresAt);
  const expiredRef = useRef(false);

  useEffect(() => {
    isWarningRef.current = isWarning;
    onExpireRef.current = onExpire;
    onActivityRef.current = onActivity;
    expiresAtRef.current = expiresAt;
  });

  const extendDeadline = useCallback(
    (current: number) => {
      deadlineRef.current = current + timeoutMs;
      setDeadline(deadlineRef.current);
      setNow(current);
    },
    [timeoutMs],
  );

  // Reads refs only, so it sees the real deadline even when no tick has run,
  // for example right after a locked phone is unlocked.
  const expireIfDue = useCallback((): boolean => {
    const current = Date.now();
    const limit = Math.min(deadlineRef.current, expiresAtRef.current ?? Number.POSITIVE_INFINITY);
    if (current < limit) return false;

    setNow(current);
    if (!expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
    return true;
  }, []);

  const reset = useCallback(() => {
    expiredRef.current = false;
    extendDeadline(Date.now());
  }, [extendDeadline]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let lastActivity = Number.NEGATIVE_INFINITY;

    function handleActivity() {
      if (expireIfDue()) return;
      if (isWarningRef.current) return;

      const current = Date.now();
      if (current - lastActivity < ACTIVITY_THROTTLE_MS) return;

      lastActivity = current;
      extendDeadline(current);
      onActivityRef.current?.();
    }

    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, handleActivity, { passive: true }),
    );
    document.addEventListener('scroll', handleActivity, { capture: true, passive: true });
    return () => {
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, handleActivity));
      document.removeEventListener('scroll', handleActivity, { capture: true });
    };
  }, [enabled, expireIfDue, extendDeadline]);

  useEffect(() => {
    if (!enabled) return;

    function handleReturn() {
      if (!expireIfDue()) setNow(Date.now());
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') handleReturn();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handleReturn);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleReturn);
    };
  }, [enabled, expireIfDue]);

  useEffect(() => {
    if (enabled && remainingMs === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, [enabled, remainingMs]);

  return { remainingMs, isWarning, reset };
}
