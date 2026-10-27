import type { Session } from '../types/auth';

const STORAGE_KEY = 'altura.session';

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const { token, expiresAt } = value as Record<string, unknown>;
  return typeof token === 'string' && typeof expiresAt === 'string';
}

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null): void {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing; the session then lives in memory only.
  }
}
