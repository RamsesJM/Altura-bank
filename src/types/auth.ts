export interface User {
  id: string;
  fullName: string;
  email: string;
  lastLoginAt: string | null;
}

export interface Session {
  token: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: User;
  session: Session;
}

export type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_EXPIRED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
}
