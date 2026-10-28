import { DEMO_EMAIL, DEMO_PASSWORD } from '../config/demoAccount';
import type { User } from '../types/auth';
import type { Account, Transaction } from '../types/banking';
import { createAccounts, createTransactions } from './bankingData';

export { DEMO_EMAIL, DEMO_PASSWORD };
export const MAX_FAILED_ATTEMPTS = 3;
export const LOCKOUT_MS = 60_000;
export const SESSION_TTL_MS = 300_000;

const STORAGE_KEY = 'altura.mockdb';

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
  accounts: Account[];
  transactions: Transaction[];
  failedAttempts: number;
  lockedUntil: number | null;
}

function createDatabase(transactions: Transaction[] = createTransactions(Date.now())): Database {
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
    accounts: createAccounts(),
    transactions,
    failedAttempts: 0,
    lockedUntil: null,
  };
}

interface PersistedDatabase extends Omit<Database, 'sessions'> {
  sessions: [string, StoredSession][];
}

function readPersistedDatabase(): Database | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<PersistedDatabase>;
    const defaults = createDatabase(data.transactions ?? createTransactions(Date.now()));
    return { ...defaults, ...data, sessions: new Map(data.sessions ?? []) };
  } catch {
    return null;
  }
}

export const db: Database = readPersistedDatabase() ?? createDatabase();

export function saveDb(): void {
  const data: PersistedDatabase = { ...db, sessions: [...db.sessions] };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Without storage the mock keeps working in memory until the next reload.
  }
}

export function restoreDb(): void {
  Object.assign(db, readPersistedDatabase() ?? createDatabase());
}

export function resetDb(): void {
  Object.assign(db, createDatabase());
  sessionStorage.removeItem(STORAGE_KEY);
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
