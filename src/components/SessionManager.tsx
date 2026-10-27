import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { SessionWarningModal } from './SessionWarningModal';

const SESSION_TIMEOUT_MS = 300_000;
const WARNING_MS = 60_000;
const REFRESH_INTERVAL_MS = 60_000;

export function SessionManager() {
  const { logout, refresh, session } = useAuth();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    lastRefreshRef.current = Date.now();
  }, []);

  const handleActivity = useCallback(() => {
    if (Date.now() - lastRefreshRef.current < REFRESH_INTERVAL_MS) return;

    lastRefreshRef.current = Date.now();
    refresh().catch(() => undefined);
  }, [refresh]);

  const handleExpire = useCallback(() => {
    void logout('expired');
  }, [logout]);

  const { remainingMs, isWarning, reset } = useSessionTimeout({
    timeoutMs: SESSION_TIMEOUT_MS,
    warningMs: WARNING_MS,
    onExpire: handleExpire,
    onActivity: handleActivity,
    expiresAt: session ? Date.parse(session.expiresAt) : undefined,
  });

  async function handleStay() {
    try {
      await refresh();
      lastRefreshRef.current = Date.now();
      reset();
    } catch {
      // A rejected session is handled globally by the API client.
    }
  }

  if (!isWarning) return null;

  return (
    <SessionWarningModal
      remainingMs={remainingMs}
      onStay={() => void handleStay()}
      onSignOut={() => void logout()}
    />
  );
}
