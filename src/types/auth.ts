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
  | 'UNKNOWN_ERROR'
  | 'INSUFFICIENT_FUNDS'
  | 'LIMIT_EXCEEDED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'SAME_ACCOUNT'
  | 'ACCOUNT_NOT_FOUND'
  | 'OWN_ACCOUNT'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_USED'
  | 'INVALID_OTP'
  | 'OTP_LOCKED';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
  field?: 'from' | 'to' | 'amount' | 'description';
  dailyRemaining?: number;
}
