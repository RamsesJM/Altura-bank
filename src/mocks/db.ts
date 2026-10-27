import type { User } from '../types/auth';

export const DEMO_EMAIL = 'demo@alturabank.com';
export const DEMO_PASSWORD = 'Demo1234';
export const MAX_FAILED_ATTEMPTS = 3;
export const LOCKOUT_MS = 60_000;
export const SESSION_TTL_MS = 300_000;

interface StoredUser extends User {
  password: string;
  currentLoginAt: string | null;
}

interface StoredSession {
  userId: string;
  expiresAt: number;
}

interface Database {
  users: StoredUser[];
  sessions: Map<string, StoredSession>;
  failedAttempts: number;
  lockedUntil: number | null;
}

function createDatabase(): Database {
  return {
    users: [
      {
        id: 'usr-1',
        fullName: 'Ramses Demo',
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        lastLoginAt: null,
        currentLoginAt: null,
      },
    ],
    sessions: new Map(),
    failedAttempts: 0,
    lockedUntil: null,
  };
}

export const db = createDatabase();

export function resetDb(): void {
  Object.assign(db, createDatabase());
}

export function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function toPublicUser(user: StoredUser): User {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    lastLoginAt: user.lastLoginAt,
  };
}
