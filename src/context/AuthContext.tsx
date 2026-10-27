import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { setAuthToken, setUnauthorizedHandler } from '../services/apiClient';
import * as authService from '../services/authService';
import { readSession, writeSession } from '../services/sessionStore';
import type { Session, User } from '../types/auth';
import { AuthContext, type AuthStatus, type LogoutReason } from './authContextValue';

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>(() =>
    readSession() ? 'loading' : 'unauthenticated',
  );
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applySession = useCallback((nextUser: User, nextSession: Session) => {
    setAuthToken(nextSession.token);
    writeSession(nextSession);
    setUser(nextUser);
    setSession(nextSession);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAuthToken(null);
    writeSession(null);
    setUser(null);
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authService.login(email, password);
      applySession(response.user, response.session);
    },
    [applySession],
  );

  const logout = useCallback(
    async (reason: LogoutReason = 'manual') => {
      if (reason === 'manual') {
        await authService.logout().catch(() => undefined);
      }
      clearSession();
      navigate('/login', { replace: true, state: reason === 'expired' ? { reason } : null });
    },
    [clearSession, navigate],
  );

  const refresh = useCallback(async () => {
    const response = await authService.refreshSession();
    writeSession(response.session);
    setSession(response.session);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current === 'authenticated') void logout('expired');
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    const stored = readSession();
    if (!stored) return;

    let cancelled = false;
    setAuthToken(stored.token);

    authService
      .getCurrentUser()
      .then((response) => {
        if (!cancelled) applySession(response.user, response.session);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const value = useMemo(
    () => ({ status, user, session, login, logout, refresh }),
    [status, user, session, login, logout, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
