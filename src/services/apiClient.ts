import type { ApiErrorBody, ApiErrorCode } from '../types/auth';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "We couldn't connect. Please try again.";
const SERVER_ERROR_CODES: ApiErrorCode[] = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'SESSION_EXPIRED',
  'VALIDATION_ERROR',
  'INSUFFICIENT_FUNDS',
  'LIMIT_EXCEEDED',
  'DAILY_LIMIT_EXCEEDED',
  'SAME_ACCOUNT',
  'ACCOUNT_NOT_FOUND',
  'OWN_ACCOUNT',
  'QUOTE_EXPIRED',
  'QUOTE_USED',
  'INVALID_OTP',
  'OTP_LOCKED',
];
const UNAUTHORIZED_EXEMPT_PATHS = ['/api/auth/login'];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly attemptsRemaining?: number;
  readonly lockedUntil?: string;
  readonly field?: ApiErrorBody['field'];
  readonly dailyRemaining?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.attemptsRemaining = body.attemptsRemaining;
    this.lockedUntil = body.lockedUntil;
    this.field = body.field;
    this.dailyRemaining = body.dailyRemaining;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const { code, message } = value as Record<string, unknown>;
  return (
    typeof message === 'string' && SERVER_ERROR_CODES.includes(code as ApiErrorCode)
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);

  if (response.status < 500 && isApiErrorBody(body)) {
    return new ApiError(response.status, body);
  }

  return new ApiError(response.status, { code: 'UNKNOWN_ERROR', message: GENERIC_MESSAGE });
}

async function send(path: string, options: RequestOptions, accept: string): Promise<Response> {
  const { method = 'GET', body } = options;
  const headers: Record<string, string> = { ...options.headers, Accept: accept };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response: Response;

  try {
    response = await fetch(new URL(path, window.location.origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: NETWORK_MESSAGE });
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (response.status === 401 && !UNAUTHORIZED_EXEMPT_PATHS.includes(path)) {
      unauthorizedHandler?.();
    }
    throw error;
  }

  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options, 'application/json');

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await send(path, {}, 'text/csv');
  return response.blob();
}
