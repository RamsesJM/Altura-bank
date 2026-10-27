import { createContext } from 'react';
import type { Session, User } from '../types/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type LogoutReason = 'manual' | 'expired';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
